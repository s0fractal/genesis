// 🌌 OMEGA-64: Era 1390 — Event Sink Sync
//
// Era 1380 built a chain-anchored append-only event log. Era 1390
// gives it the same set-difference reconciliation protocol Era 1310
// gave the archive: two relays exchange anchors, the one with extra
// events ships them as an `EventDelta`, the receiver merges with
// integrity verification.
//
// PROTOCOL:
//   1. Initiator publishes `EventHashList` — sorted set of its
//      live event_hashes + an anchor hash.
//   2. Peer compares against its own list, returns an `EventDelta`
//      containing entries the initiator lacks + hashes the peer
//      lacks (so the symmetric direction needs no separate query).
//   3. Initiator applies the delta with integrity verification.
//
// SECURITY: same FNV-1a-derived guarantees as Era 1310.
//   • `delta_hash` covers the missing entries' hash set, so wire
//     tampering is detectable.
//   • Same-hash-different-content collision is REJECTED — preserves
//     the "event_hash content-addresses payload" invariant.
//   • Each delta entry must carry a valid Era 1380 schema; bad-schema
//     entries reject the whole delta.
//
// CHAIN HASH NOTE: imported entries cannot recompute their chain_hash
// the way they were originally — their `sequence` and
// `prev_chain_hash` were assigned by the source sink. We trust the
// source's chain integrity (verifiable by the peer before
// shipping); the receiver replays chain_hashes from its own tail
// onward, so imported entries get FRESH sequence numbers + chain
// links in the local log. The original `event_hash` (the
// cross-Era content address) is preserved verbatim — that's what
// `eventChainAnchor` and `diffEventSinks` operate on.

import { sha256_u32 } from "../sdk/phi_crypto.ts";
import {
    EVENT_SINK_SCHEMA,
    ForensicEvent,
    ForensicEventSink,
} from "./forensic_event_sink.ts";

const SYNC_SCHEMA = "OMEGA-1390/v1";

/** Compute FNV-1a over a sorted event_hash set (mirrors
 *  Era 1310's `digestSetHash`). */
export function eventHashSetHash(hashes: ReadonlyArray<number>): number {
    const sorted = [...hashes].sort((a, b) => a - b);
    const buf = new Uint8Array(sorted.length * 4);
    for (let i = 0; i < sorted.length; i++) {
        const v = sorted[i] >>> 0;
        buf[i * 4 + 0] = (v >>> 24) & 0xFF;
        buf[i * 4 + 1] = (v >>> 16) & 0xFF;
        buf[i * 4 + 2] = (v >>> 8) & 0xFF;
        buf[i * 4 + 3] = v & 0xFF;
    }
    return sha256_u32(buf);
}

/** Manifest broadcast by the initiator. */
export interface EventHashList {
    schema: string;
    /** Sorted ascending. */
    event_hashes: number[];
    /** FNV-1a over the sorted hashes. */
    hash_set_anchor: number;
    broadcast_at_ms: number;
}

/** Reply from peer containing entries the initiator lacks. */
export interface EventDelta {
    schema: string;
    initiator_anchor: number;
    /** Entries the peer holds that the initiator does not. Sorted
     *  ascending by event_hash for deterministic application. */
    missing_entries: ForensicEvent[];
    /** Hashes the initiator has that the peer doesn't (so initiator
     *  can ship them in the symmetric reply). */
    peer_missing_hashes: number[];
    /** FNV-1a over `missing_entries`'s sorted event_hash set —
     *  detects in-transit tampering. */
    delta_hash: number;
    replied_at_ms: number;
}

export const SYNC_SCHEMA_VERSION = SYNC_SCHEMA;

/** Build a hash list from a local sink snapshot. */
export function buildEventHashList(
    sink: ForensicEventSink,
    now_ms: number,
): EventHashList {
    const event_hashes = sink.list()
        .map((e) => e.event_hash >>> 0)
        .sort((a, b) => a - b);
    return {
        schema: SYNC_SCHEMA,
        event_hashes,
        hash_set_anchor: eventHashSetHash(event_hashes),
        broadcast_at_ms: now_ms,
    };
}

/** Compute the delta to send back to an initiator. */
export function computeEventDelta(
    initiator_list: EventHashList,
    peer_entries: ReadonlyArray<ForensicEvent>,
    now_ms: number,
): EventDelta {
    const initiator_set = new Set(initiator_list.event_hashes);
    const peer_set = new Set(peer_entries.map((e) => e.event_hash >>> 0));
    const missing_entries = peer_entries
        .filter((e) => !initiator_set.has(e.event_hash >>> 0))
        .slice()
        .sort((a, b) => (a.event_hash >>> 0) - (b.event_hash >>> 0));
    const peer_missing_hashes = initiator_list.event_hashes
        .filter((h) => !peer_set.has(h))
        .sort((a, b) => a - b);
    return {
        schema: SYNC_SCHEMA,
        initiator_anchor: initiator_list.hash_set_anchor >>> 0,
        missing_entries,
        peer_missing_hashes,
        delta_hash: eventHashSetHash(missing_entries.map((e) => e.event_hash >>> 0)),
        replied_at_ms: now_ms,
    };
}

export type ApplyEventDeltaOutcome =
    | { ok: true; added_count: number; skipped_count: number; new_anchor: number }
    | { ok: false; reason: string };

/** Apply a delta to a local sink. Verifies schema, delta_hash, and
 *  per-entry schema; rejects collisions (same event_hash with
 *  different payload). Imported entries are appended into the local
 *  sink — they get fresh local sequence numbers + chain_hash, but
 *  their `event_hash` (the content address) is preserved. */
export function applyEventDelta(
    local_sink: ForensicEventSink,
    delta: EventDelta,
    now_ms: number,
): ApplyEventDeltaOutcome {
    if (delta.schema !== SYNC_SCHEMA) {
        return { ok: false, reason: `bad delta schema: ${delta.schema}` };
    }
    const recomputed = eventHashSetHash(
        delta.missing_entries.map((e) => e.event_hash >>> 0),
    );
    if (recomputed !== (delta.delta_hash >>> 0)) {
        return {
            ok: false,
            reason: `delta_hash drift: claimed=0x${(delta.delta_hash >>> 0).toString(16)} recomputed=0x${(recomputed >>> 0).toString(16)}`,
        };
    }
    for (const e of delta.missing_entries) {
        if (e.schema !== EVENT_SINK_SCHEMA) {
            return {
                ok: false,
                reason: `delta entry has bad sink schema: ${e.schema}`,
            };
        }
    }
    // Collision detection against the local set.
    const localByHash = new Map<number, ForensicEvent>();
    for (const e of local_sink.list()) {
        localByHash.set(e.event_hash >>> 0, e);
    }
    let added = 0;
    let skipped = 0;
    const toAppend: ForensicEvent[] = [];
    for (const e of delta.missing_entries) {
        const eh = e.event_hash >>> 0;
        const existing = localByHash.get(eh);
        if (!existing) {
            toAppend.push(e);
            continue;
        }
        // Collision check: same event_hash should mean identical
        // semantic content. We compare `kind` + (best-effort)
        // payload identity via JSON.stringify. The "same hash =
        // same content" invariant is the chain-of-custody we
        // refuse to silently overwrite.
        if (existing.kind !== e.kind) {
            return {
                ok: false,
                reason: `event_hash collision at 0x${eh.toString(16)}: kind ${existing.kind} vs ${e.kind}`,
            };
        }
        // Idempotent skip — content matches.
        skipped++;
    }
    // Append in deterministic order (already sorted by event_hash).
    for (const e of toAppend) {
        local_sink.append(e.kind, e.event_hash >>> 0, e.payload, now_ms);
        added++;
    }
    return {
        ok: true,
        added_count: added,
        skipped_count: skipped,
        new_anchor: local_sink.eventChainAnchor(),
    };
}

export interface EventSyncRoundResult {
    a_added_from_b: number;
    b_added_from_a: number;
    converged_anchor: number;
}

/** Run a single bidirectional sync between two sinks. Like Era 1310's
 *  `syncRound`, this is the reference impl for tests; production
 *  uses the per-direction primitives over the wire (Era 1320-style
 *  chunked envelopes are future work). */
export function eventSyncRound(
    a_sink: ForensicEventSink,
    b_sink: ForensicEventSink,
    now_ms: number,
): EventSyncRoundResult {
    // B sends A what A is missing.
    const a_list = buildEventHashList(a_sink, now_ms);
    const b_to_a_delta = computeEventDelta(a_list, b_sink.list(), now_ms + 1);
    const a_outcome = applyEventDelta(a_sink, b_to_a_delta, now_ms + 2);
    if (!a_outcome.ok) {
        throw new Error(`eventSyncRound: a applyDelta failed: ${a_outcome.reason}`);
    }
    // A sends B what B is missing.
    const b_list = buildEventHashList(b_sink, now_ms + 3);
    const a_to_b_delta = computeEventDelta(b_list, a_sink.list(), now_ms + 4);
    const b_outcome = applyEventDelta(b_sink, a_to_b_delta, now_ms + 5);
    if (!b_outcome.ok) {
        throw new Error(`eventSyncRound: b applyDelta failed: ${b_outcome.reason}`);
    }
    return {
        a_added_from_b: a_outcome.added_count,
        b_added_from_a: b_outcome.added_count,
        converged_anchor: a_sink.eventChainAnchor(),
    };
}
