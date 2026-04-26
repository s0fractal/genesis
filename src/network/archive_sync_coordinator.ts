// 🌌 OMEGA-64: Era 1340 — Multi-Peer Sync Coordinator
//
// Eras 1310-1330 handle one peer + one envelope at a time:
//   1310: pure delta exchange (computeDelta / applyDelta).
//   1320: chunk a delta into wire frames, reassemble.
//   1330: per-peer scheduler + per-envelope retransmission driver.
//
// Era 1340 is the orchestrator. A real relay tracks N peers, may
// receive frames for several envelopes concurrently, must decide
// which peer to sync with NEXT given everyone's status, and needs
// to expose fleet-wide convergence telemetry to operators.
//
// COORDINATOR RESPONSIBILITIES:
//   • Own per-peer schedule state (PeerSyncState map).
//   • Own per-envelope reassembly state (PendingEnvelope map).
//   • Track which peers contributed frames to each envelope, so
//     retransmit requests can be fanned out to the right sources.
//   • Pick the next sync candidate(s) using a priority order that
//     favours overdue / under-tested peers without thundering-herd.
//   • Expose `fleetConvergenceRate` — Q16 fraction of
//     network-known digests this relay has observed.
//
// PURE: every function takes `now_ms` and returns a new
// `CoordinatorState`. No internal timers, no I/O. The mutable
// glue belongs to the relay loop, not this kernel.

import {
    DEFAULT_RETRANSMIT_CONFIG,
    DEFAULT_SCHEDULER_CONFIG,
    DriverAction,
    PendingEnvelope,
    PeerSyncState,
    RetransmitConfig,
    SchedulerConfig,
    decideAction,
    ingestFrames,
    initPeerSyncState,
    isPeerCold,
    makePendingEnvelope,
    recordRetransmitRequest,
    recordSyncAttempt,
    recordSyncFailure,
    recordSyncSuccess,
    shouldSyncNow,
} from "./archive_sync_driver.ts";
import {
    FRAME_TYPE_DELTA_CHUNK,
    SporeFrame,
} from "./spore_frame.ts";

export const COORDINATOR_SCHEMA = "OMEGA-1340/v1";

/** Per-envelope peer attribution. */
export interface PeerEnvelopeSource {
    envelope_hash: number;
    /** Peer that contributed the FIRST frame seen for this envelope. */
    originator: number;
    /** All peers that have contributed at least one frame. */
    contributors: Set<number>;
    /** Frame count per peer (for fairness / diagnostics). */
    frames_per_peer: Map<number, number>;
}

export interface CoordinatorState {
    self_relay_id: number;
    peers: Map<number, PeerSyncState>;
    envelopes: Map<number, PendingEnvelope>;
    sources: Map<number, PeerEnvelopeSource>;
    scheduler_config: SchedulerConfig;
    retransmit_config: RetransmitConfig;
}

export function makeCoordinator(
    self_relay_id: number,
    scheduler_config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
    retransmit_config: RetransmitConfig = DEFAULT_RETRANSMIT_CONFIG,
): CoordinatorState {
    return {
        self_relay_id: self_relay_id >>> 0,
        peers: new Map(),
        envelopes: new Map(),
        sources: new Map(),
        scheduler_config,
        retransmit_config,
    };
}

export function addPeer(
    coord: CoordinatorState,
    peer_id: number,
): CoordinatorState {
    const peers = new Map(coord.peers);
    if (!peers.has(peer_id >>> 0)) {
        peers.set(peer_id >>> 0, initPeerSyncState(peer_id));
    }
    return { ...coord, peers };
}

export function removePeer(
    coord: CoordinatorState,
    peer_id: number,
): CoordinatorState {
    const peers = new Map(coord.peers);
    peers.delete(peer_id >>> 0);
    return { ...coord, peers };
}

/**
 * Pick up to `max` peers that are due for a sync, in priority order.
 *
 * Priority (highest first):
 *   1. Never-attempted peers (last_attempt_ms === 0).
 *   2. Among due peers, the one whose `last_success_ms` is oldest.
 *   3. Among ties, lower `consecutive_failures` first (avoid spamming
 *      a flaky partner before exhausting healthy ones).
 *
 * Cold peers (≥ failure_giveup_count consecutive failures) are
 * excluded entirely — caller should consider re-bootstrapping.
 */
export function selectNextSyncPeers(
    coord: CoordinatorState,
    now_ms: number,
    max: number = 1,
): number[] {
    const candidates: PeerSyncState[] = [];
    for (const peer of coord.peers.values()) {
        if (isPeerCold(peer, coord.scheduler_config)) continue;
        if (!shouldSyncNow(peer, now_ms)) continue;
        candidates.push(peer);
    }
    candidates.sort((a, b) => {
        // Never-attempted first.
        if (a.last_attempt_ms === 0 && b.last_attempt_ms !== 0) return -1;
        if (b.last_attempt_ms === 0 && a.last_attempt_ms !== 0) return 1;
        // Older last_success_ms wins (0 = never succeeded → most overdue).
        if (a.last_success_ms !== b.last_success_ms) {
            return a.last_success_ms - b.last_success_ms;
        }
        // Fewer failures preferred.
        if (a.consecutive_failures !== b.consecutive_failures) {
            return a.consecutive_failures - b.consecutive_failures;
        }
        // Stable tiebreak by peer_id.
        return a.peer_id - b.peer_id;
    });
    return candidates.slice(0, Math.max(0, max)).map((p) => p.peer_id);
}

/** Mark that we initiated a sync to this peer. */
export function recordPeerSyncAttempt(
    coord: CoordinatorState,
    peer_id: number,
    now_ms: number,
): CoordinatorState {
    const peer = coord.peers.get(peer_id >>> 0);
    if (!peer) return coord;
    const peers = new Map(coord.peers);
    peers.set(peer_id >>> 0, recordSyncAttempt(peer, now_ms));
    return { ...coord, peers };
}

export function recordPeerSyncSuccess(
    coord: CoordinatorState,
    peer_id: number,
    now_ms: number,
): CoordinatorState {
    const peer = coord.peers.get(peer_id >>> 0);
    if (!peer) return coord;
    const peers = new Map(coord.peers);
    peers.set(
        peer_id >>> 0,
        recordSyncSuccess(peer, coord.scheduler_config, now_ms),
    );
    return { ...coord, peers };
}

export function recordPeerSyncFailure(
    coord: CoordinatorState,
    peer_id: number,
    now_ms: number,
): CoordinatorState {
    const peer = coord.peers.get(peer_id >>> 0);
    if (!peer) return coord;
    const peers = new Map(coord.peers);
    peers.set(
        peer_id >>> 0,
        recordSyncFailure(peer, coord.scheduler_config, now_ms),
    );
    return { ...coord, peers };
}

/**
 * Ingest delta-chunk frames received from a specific peer. The
 * coordinator routes each frame to its envelope (creating one if
 * needed) and updates per-peer source tracking.
 *
 * Frames whose `frameType` is not DELTA_CHUNK are silently ignored.
 */
export function ingestPeerFrames(
    coord: CoordinatorState,
    peer_id: number,
    frames: ReadonlyArray<SporeFrame>,
    now_ms: number,
): CoordinatorState {
    if (frames.length === 0) return coord;
    const envelopes = new Map(coord.envelopes);
    const sources = new Map(coord.sources);
    const pid = peer_id >>> 0;

    // Group frames by envelope_hash (= tick).
    const grouped = new Map<number, SporeFrame[]>();
    for (const f of frames) {
        if (f.frameType !== FRAME_TYPE_DELTA_CHUNK) continue;
        const key = f.tick >>> 0;
        const arr = grouped.get(key);
        if (arr) arr.push(f);
        else grouped.set(key, [f]);
    }

    for (const [envHash, group] of grouped) {
        let env = envelopes.get(envHash);
        if (!env) env = makePendingEnvelope(envHash, now_ms);

        const before = env.frames_by_sequence.size;
        env = ingestFrames(env, group, now_ms);
        const added = env.frames_by_sequence.size - before;

        envelopes.set(envHash, env);

        let src = sources.get(envHash);
        if (!src) {
            src = {
                envelope_hash: envHash,
                originator: pid,
                contributors: new Set([pid]),
                frames_per_peer: new Map([[pid, added]]),
            };
        } else {
            const fpp = new Map(src.frames_per_peer);
            fpp.set(pid, (fpp.get(pid) ?? 0) + added);
            const contributors = new Set(src.contributors);
            contributors.add(pid);
            src = { ...src, contributors, frames_per_peer: fpp };
        }
        sources.set(envHash, src);
    }
    return { ...coord, envelopes, sources };
}

/** Information returned alongside a driver action so the caller knows
 *  WHICH peers to send retransmit requests to. */
export interface CoordinatorAction {
    envelope_hash: number;
    action: DriverAction;
    /** Peers that have contributed to this envelope; retransmit
     *  requests should be fanned out to these. Empty for completed
     *  or unknown envelopes. */
    target_peers: number[];
    /** Peer that originated the envelope (best initial retransmit
     *  target). Undefined for unknown envelopes. */
    originator?: number;
}

/**
 * Compute the next action for a given envelope. Wraps Era 1330's
 * `decideAction` with peer attribution.
 */
export function progressEnvelope(
    coord: CoordinatorState,
    envelope_hash: number,
    now_ms: number,
): CoordinatorAction | null {
    const env = coord.envelopes.get(envelope_hash >>> 0);
    if (!env) return null;
    const action = decideAction(env, coord.retransmit_config, now_ms);
    const src = coord.sources.get(envelope_hash >>> 0);
    return {
        envelope_hash: envelope_hash >>> 0,
        action,
        target_peers: src ? [...src.contributors].sort((a, b) => a - b) : [],
        originator: src?.originator,
    };
}

/** Mark that a retransmit request was issued for the given sequences
 *  on the given envelope. Updates per-sequence attempt counts. */
export function recordEnvelopeRetransmit(
    coord: CoordinatorState,
    envelope_hash: number,
    sequences: ReadonlyArray<number>,
    now_ms: number,
): CoordinatorState {
    const env = coord.envelopes.get(envelope_hash >>> 0);
    if (!env) return coord;
    const envelopes = new Map(coord.envelopes);
    envelopes.set(
        envelope_hash >>> 0,
        recordRetransmitRequest(env, sequences, coord.retransmit_config, now_ms),
    );
    return { ...coord, envelopes };
}

/** Drop an envelope from the coordinator (e.g. after `complete` is
 *  applied or `giveup` is decided). */
export function dropEnvelope(
    coord: CoordinatorState,
    envelope_hash: number,
): CoordinatorState {
    const envelopes = new Map(coord.envelopes);
    const sources = new Map(coord.sources);
    envelopes.delete(envelope_hash >>> 0);
    sources.delete(envelope_hash >>> 0);
    return { ...coord, envelopes, sources };
}

/**
 * Fleet-wide convergence rate as Q16 fixed-point (`fraction × 65536`).
 *
 * Given:
 *   • `local_digests` — digests this relay holds (e.g. its archive's
 *     digest set).
 *   • `network_digests` — union of digests known to *anyone* in the
 *     network (typically computed by aggregating digest lists from
 *     all peers).
 *
 * Returns the Q16 representation of `|local ∩ network| / |network|`,
 * clamped to [0, 65536]. When the network has no known digests, the
 * convention is "fully converged" (65536) — there's nothing left to
 * sync.
 */
export function fleetConvergenceRate(
    local_digests: ReadonlyArray<number>,
    network_digests: ReadonlyArray<number>,
): number {
    const networkSet = new Set(network_digests);
    if (networkSet.size === 0) return 65536;
    const local = new Set(local_digests);
    let intersection = 0;
    for (const d of networkSet) if (local.has(d)) intersection++;
    const ratio = intersection / networkSet.size;
    return Math.max(0, Math.min(65536, Math.round(ratio * 65536)));
}

/** Snapshot for telemetry / HUD. */
export interface CoordinatorTelemetry {
    peer_count: number;
    cold_peer_count: number;
    due_peer_count: number;
    envelope_count: number;
    total_pending_frames: number;
    abandoned_sequence_count: number;
}

export function coordinatorTelemetry(
    coord: CoordinatorState,
    now_ms: number,
): CoordinatorTelemetry {
    let cold = 0;
    let due = 0;
    for (const p of coord.peers.values()) {
        if (isPeerCold(p, coord.scheduler_config)) cold++;
        else if (shouldSyncNow(p, now_ms)) due++;
    }
    let pending = 0;
    let abandoned = 0;
    for (const e of coord.envelopes.values()) {
        pending += e.frames_by_sequence.size;
        abandoned += e.abandoned_sequences.size;
    }
    return {
        peer_count: coord.peers.size,
        cold_peer_count: cold,
        due_peer_count: due,
        envelope_count: coord.envelopes.size,
        total_pending_frames: pending,
        abandoned_sequence_count: abandoned,
    };
}
