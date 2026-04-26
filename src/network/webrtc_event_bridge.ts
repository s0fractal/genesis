// 🌌 OMEGA-64: Era 1500 — WebRTC Event Bridge
//
// The Cortex-M4F substrate (Eras 1400-1490) and the JS substrate
// (Eras 1380-1390) both run the forensic event protocol over their
// native transports — UART/SPI/BLE for the spore, in-process
// function calls for JS unit tests. Era 1500 connects browser
// peers to the same protocol via WebRTC DataChannels.
//
// DESIGN: a thin message-passing bridge that wraps Era 1380's
// `ForensicEventSink` and Era 1390's pure sync functions. The
// underlying WebRTC transport is abstracted behind a `Transport`
// interface so the bridge can be tested without instantiating
// real RTCPeerConnections — a paired in-process loopback is the
// canonical test vector.
//
// MESSAGE FORMAT: discriminated-union JSON. Three kinds:
//
//   • HASH_LIST     — sender announces its anchor + sorted hash set
//                     so the receiver can compute set-difference
//                     locally.
//   • DELTA         — sender ships entries the receiver was missing.
//                     Carries delta_hash for envelope-level integrity.
//   • PEER_HELLO    — first-message handshake announcing peer_id and
//                     bridge schema; lets receivers confirm protocol
//                     version without inspecting message bodies.
//
// The bridge handles routing automatically: on receipt of a
// peer's HASH_LIST that differs from local, immediately compute
// the missing entries and send a DELTA back. The interaction is
// stateless beyond the underlying sink — no per-peer scheduling,
// no retransmission. Higher layers (Era 1340 coordinator) can
// drive the bridge if more sophisticated orchestration is needed.

import {
    ForensicEventSink,
    ForensicEvent,
    EVENT_SINK_SCHEMA,
} from "./forensic_event_sink.ts";
import {
    SYNC_SCHEMA_VERSION,
    applyEventDelta,
    buildEventHashList,
    computeEventDelta,
    eventHashSetHash,
    EventDelta,
    EventHashList,
} from "./event_sink_sync.ts";

export const BRIDGE_SCHEMA = "OMEGA-1500/v1";

/** Discriminated union of bridge messages. Sent as JSON over the
 *  underlying transport (typically a WebRTC DataChannel). */
export type BridgeMessage =
    | { kind: "PEER_HELLO"; schema: string; peer_id: number }
    | { kind: "HASH_LIST"; from: number; list: EventHashList }
    | { kind: "DELTA"; from: number; delta: EventDelta };

/** Transport contract. WebRTC implementation wraps an
 *  `RTCDataChannel.send`; tests use an in-process paired loopback. */
export interface BridgeTransport {
    /** Send a serialized message to one specific peer. Returns
     *  true if the transport accepted the bytes. */
    send(peer_id: number, msg: BridgeMessage): boolean;
}

/** Telemetry for HUD/operator visibility. */
export interface BridgeStats {
    hellos_sent: number;
    hellos_received: number;
    hash_lists_sent: number;
    hash_lists_received: number;
    deltas_sent: number;
    deltas_received: number;
    deltas_applied: number;
    apply_collisions: number;
    schema_mismatches: number;
}

export class WebRTCEventBridge {
    private stats: BridgeStats = {
        hellos_sent: 0,
        hellos_received: 0,
        hash_lists_sent: 0,
        hash_lists_received: 0,
        deltas_sent: 0,
        deltas_received: 0,
        deltas_applied: 0,
        apply_collisions: 0,
        schema_mismatches: 0,
    };

    /** Peers that completed PEER_HELLO. Used to gate sends. */
    private knownPeers = new Set<number>();

    constructor(
        public readonly self_peer_id: number,
        public readonly sink: ForensicEventSink,
        public readonly transport: BridgeTransport,
    ) {}

    /** Send PEER_HELLO to a freshly-connected peer. */
    helloPeer(peer_id: number): boolean {
        const ok = this.transport.send(peer_id, {
            kind: "PEER_HELLO",
            schema: BRIDGE_SCHEMA,
            peer_id: this.self_peer_id >>> 0,
        });
        if (ok) this.stats.hellos_sent++;
        return ok;
    }

    /** Broadcast our local hash-list anchor to a peer. Caller
     *  decides cadence — typically a periodic timer. */
    broadcastHashList(peer_id: number, now_ms: number): boolean {
        if (!this.knownPeers.has(peer_id >>> 0)) return false;
        const list = buildEventHashList(this.sink, now_ms);
        const ok = this.transport.send(peer_id, {
            kind: "HASH_LIST",
            from: this.self_peer_id >>> 0,
            list,
        });
        if (ok) this.stats.hash_lists_sent++;
        return ok;
    }

    /** Manually ship a delta containing specified entries to a peer.
     *  Higher-level callers may use this when they've already
     *  computed which entries the peer needs. */
    sendDelta(peer_id: number, entries: ReadonlyArray<ForensicEvent>, now_ms: number): boolean {
        if (!this.knownPeers.has(peer_id >>> 0)) return false;
        // Build a minimal EventDelta envelope. initiator_anchor=0
        // because the sender (us) doesn't claim a specific
        // initiator state for this manual ship — the receiver's
        // applyEventDelta only depends on delta_hash + schema.
        const delta: EventDelta = {
            schema: SYNC_SCHEMA_VERSION,
            initiator_anchor: 0,
            missing_entries: [...entries].sort(
                (a, b) => (a.event_hash >>> 0) - (b.event_hash >>> 0),
            ),
            peer_missing_hashes: [],
            delta_hash: eventHashSetHash(entries.map((e) => e.event_hash)),
            replied_at_ms: now_ms,
        };
        const ok = this.transport.send(peer_id, {
            kind: "DELTA",
            from: this.self_peer_id >>> 0,
            delta,
        });
        if (ok) this.stats.deltas_sent++;
        return ok;
    }

    /** Process an incoming message. Returns true if the message
     *  was understood and handled (even if it triggered an apply
     *  failure — caller should consult `stats`). */
    handleIncoming(msg: BridgeMessage, now_ms: number): boolean {
        switch (msg.kind) {
            case "PEER_HELLO": {
                if (msg.schema !== BRIDGE_SCHEMA) {
                    this.stats.schema_mismatches++;
                    return false;
                }
                this.knownPeers.add(msg.peer_id >>> 0);
                this.stats.hellos_received++;
                return true;
            }
            case "HASH_LIST": {
                this.stats.hash_lists_received++;
                if (msg.list.schema !== SYNC_SCHEMA_VERSION) {
                    this.stats.schema_mismatches++;
                    return false;
                }
                // Mark peer as known on hash-list receipt (HELLO is
                // optional in unreliable orderings).
                this.knownPeers.add(msg.from >>> 0);
                // Compute what the peer is missing from us.
                const delta = computeEventDelta(msg.list, this.sink.list(), now_ms);
                if (delta.missing_entries.length === 0) {
                    return true; // already converged toward the peer
                }
                // Ship the missing entries straight back.
                const ok = this.transport.send(msg.from >>> 0, {
                    kind: "DELTA",
                    from: this.self_peer_id >>> 0,
                    delta,
                });
                if (ok) this.stats.deltas_sent++;
                return ok;
            }
            case "DELTA": {
                this.stats.deltas_received++;
                if (msg.delta.schema !== SYNC_SCHEMA_VERSION) {
                    this.stats.schema_mismatches++;
                    return false;
                }
                this.knownPeers.add(msg.from >>> 0);
                const outcome = applyEventDelta(this.sink, msg.delta, now_ms);
                if (outcome.ok) {
                    if (outcome.added_count > 0) this.stats.deltas_applied++;
                } else {
                    // applyEventDelta surfaces a `reason` string;
                    // collision rejections share the same return
                    // shape as schema/hash drift.
                    if (outcome.reason.includes("collision")) {
                        this.stats.apply_collisions++;
                    }
                }
                return true;
            }
            default: {
                // Unknown kind — schema drift or future extension.
                return false;
            }
        }
    }

    /** Has the peer completed handshake (HELLO or first HASH_LIST)? */
    isPeerKnown(peer_id: number): boolean {
        return this.knownPeers.has(peer_id >>> 0);
    }

    /** Snapshot of all telemetry counters. */
    telemetry(): BridgeStats {
        return { ...this.stats };
    }

    /** Cross-relay-stable anchor of the local sink. */
    anchor(): number {
        return this.sink.eventChainAnchor();
    }
}
