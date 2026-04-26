// 🌌 OMEGA-64: Era 1330 — Sync Scheduler + Retransmission Driver
//
// Era 1320 is synchronous: a caller chunks an entire delta and ships
// every frame in a tight loop. In production, syncs run periodically
// over a lossy link, frames may go missing, and the receiver must
// be able to surgically request retransmission without re-shipping
// the whole envelope.
//
// Era 1330 provides two pure decision-making layers on top of
// Era 1320's chunk/reassemble functions:
//
//   1. SCHEDULER — decides *when* a relay should initiate a sync
//      with a given peer. Tracks per-peer state (last attempt /
//      last success / consecutive failures) and applies exponential
//      backoff on failure with a hard cap.
//
//   2. RETRANSMISSION DRIVER — owns the per-envelope state for an
//      in-flight sync. Ingests incoming frames, computes the next
//      action (`complete`, `retransmit`, `wait`, `giveup`), tracks
//      per-sequence retry counts, and surrenders after a configured
//      horizon to prevent infinite chatter on a flaky link.
//
// PURE: every function takes `now_ms` explicitly. No `Date.now()`,
// no timers, no I/O. Tests run with deterministic clocks.

import { SporeFrame } from "./spore_frame.ts";
import { ArchiveDelta } from "./archive_sync.ts";
import { reassembleDelta } from "./archive_sync_wire.ts";

export const DRIVER_SCHEMA = "OMEGA-1330/v1";

// ---------------------------------------------------------------- //
// SCHEDULER                                                        //
// ---------------------------------------------------------------- //

export interface SchedulerConfig {
    /** Default cadence between sync attempts when previous attempts succeeded. */
    base_interval_ms: number;
    /** Multiplier applied to backoff after each consecutive failure. */
    backoff_multiplier: number;
    /** Hard ceiling on the backoff interval. */
    max_backoff_ms: number;
    /** After this many consecutive failures, the peer is considered cold;
     *  callers may use this to demote the peer in routing. */
    failure_giveup_count: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
    base_interval_ms: 30_000,
    backoff_multiplier: 2,
    max_backoff_ms: 600_000, // 10 min
    failure_giveup_count: 6,
};

export interface PeerSyncState {
    peer_id: number;
    last_attempt_ms: number; // 0 = never
    last_success_ms: number; // 0 = never
    consecutive_failures: number;
    /** Earliest ms at which the scheduler will recommend another attempt. */
    next_attempt_ms: number;
}

export function initPeerSyncState(peer_id: number): PeerSyncState {
    return {
        peer_id: peer_id >>> 0,
        last_attempt_ms: 0,
        last_success_ms: 0,
        consecutive_failures: 0,
        next_attempt_ms: 0,
    };
}

/** True when the scheduler thinks this peer is due for a fresh sync.
 *  Initial state has `next_attempt_ms = 0`, so a freshly-added peer
 *  is always due. After success/failure, next_attempt_ms gates further
 *  attempts. */
export function shouldSyncNow(
    state: PeerSyncState,
    now_ms: number,
): boolean {
    return now_ms >= state.next_attempt_ms;
}

/** Mark an attempt has begun. Updates `last_attempt_ms` only — the
 *  outcome is recorded later via recordSyncSuccess/Failure. */
export function recordSyncAttempt(
    state: PeerSyncState,
    now_ms: number,
): PeerSyncState {
    return { ...state, last_attempt_ms: now_ms };
}

/** Resets failure counter and schedules the next attempt one
 *  base interval out. */
export function recordSyncSuccess(
    state: PeerSyncState,
    config: SchedulerConfig,
    now_ms: number,
): PeerSyncState {
    return {
        ...state,
        last_success_ms: now_ms,
        consecutive_failures: 0,
        next_attempt_ms: now_ms + config.base_interval_ms,
    };
}

/** Increments failure counter and applies exponential backoff. */
export function recordSyncFailure(
    state: PeerSyncState,
    config: SchedulerConfig,
    now_ms: number,
): PeerSyncState {
    const failures = state.consecutive_failures + 1;
    // backoff = base_interval * multiplier^failures, capped.
    let backoff = config.base_interval_ms;
    for (let i = 0; i < failures; i++) {
        backoff = Math.min(config.max_backoff_ms, backoff * config.backoff_multiplier);
    }
    return {
        ...state,
        consecutive_failures: failures,
        next_attempt_ms: now_ms + backoff,
    };
}

/** True when the peer has hit `failure_giveup_count` consecutive failures
 *  — caller should consider the peer cold. */
export function isPeerCold(
    state: PeerSyncState,
    config: SchedulerConfig,
): boolean {
    return state.consecutive_failures >= config.failure_giveup_count;
}

// ---------------------------------------------------------------- //
// RETRANSMISSION DRIVER                                            //
// ---------------------------------------------------------------- //

export interface RetransmitConfig {
    /** Wait at least this long between retransmit requests for the same
     *  envelope, even if missing_sequences is non-empty. */
    retransmit_cooldown_ms: number;
    /** After this many retransmit requests for the *same* sequence,
     *  declare it permanently lost and surrender the envelope. */
    max_attempts_per_sequence: number;
    /** Hard ceiling on total time spent on this envelope. After this,
     *  the driver gives up regardless of progress. */
    envelope_giveup_ms: number;
}

export const DEFAULT_RETRANSMIT_CONFIG: RetransmitConfig = {
    retransmit_cooldown_ms: 500,
    max_attempts_per_sequence: 3,
    envelope_giveup_ms: 30_000,
};

export interface PendingEnvelope {
    envelope_hash: number;
    /** All frames received so far for this envelope, deduped by sequence. */
    frames_by_sequence: Map<number, SporeFrame>;
    started_at_ms: number;
    last_progress_ms: number;
    last_retransmit_request_ms: number;
    /** Per-sequence retransmit request counter. */
    retransmit_attempts: Map<number, number>;
    /** Sequences that exceeded `max_attempts_per_sequence` — driver has
     *  surrendered on these specifically. */
    abandoned_sequences: Set<number>;
}

export function makePendingEnvelope(
    envelope_hash: number,
    now_ms: number,
): PendingEnvelope {
    return {
        envelope_hash: envelope_hash >>> 0,
        frames_by_sequence: new Map(),
        started_at_ms: now_ms,
        last_progress_ms: now_ms,
        last_retransmit_request_ms: 0,
        retransmit_attempts: new Map(),
        abandoned_sequences: new Set(),
    };
}

/** Ingest new frames into the envelope. Returns a new envelope with
 *  the frames merged in (immutable update style). Mismatched
 *  envelope_hash frames are silently filtered. */
export function ingestFrames(
    env: PendingEnvelope,
    new_frames: ReadonlyArray<SporeFrame>,
    now_ms: number,
): PendingEnvelope {
    const map = new Map(env.frames_by_sequence);
    let added = 0;
    for (const f of new_frames) {
        if ((f.tick >>> 0) !== env.envelope_hash) continue;
        const seq = (f.reserved >>> 16) & 0xFFFF;
        if (!map.has(seq)) {
            map.set(seq, f);
            added++;
        }
        // Duplicate frames are silently skipped here; reassembleDelta
        // handles conflict detection on the merged set.
    }
    return {
        ...env,
        frames_by_sequence: map,
        last_progress_ms: added > 0 ? now_ms : env.last_progress_ms,
    };
}

export type DriverAction =
    | { kind: "complete"; delta: ArchiveDelta }
    | { kind: "retransmit"; sequences: number[] }
    | { kind: "wait"; reason: string }
    | { kind: "giveup"; reason: string; partial_frame_count: number };

/** Decide what to do next for this envelope. Pure: no state mutation,
 *  no I/O. Caller dispatches the action. */
export function decideAction(
    env: PendingEnvelope,
    config: RetransmitConfig,
    now_ms: number,
): DriverAction {
    // Try a full reassembly first — if every chunk is in, we're done.
    const frames = [...env.frames_by_sequence.values()];
    const result = reassembleDelta(frames, env.envelope_hash);
    if (result.ok) {
        return { kind: "complete", delta: result.delta! };
    }

    // Hard giveup: total time spent exceeds horizon.
    if (now_ms - env.started_at_ms >= config.envelope_giveup_ms) {
        return {
            kind: "giveup",
            reason: `envelope giveup horizon (${config.envelope_giveup_ms}ms) exceeded`,
            partial_frame_count: env.frames_by_sequence.size,
        };
    }

    // Partial result — find sequences we still need.
    const missing = result.missing_sequences ?? [];
    if (missing.length === 0) {
        // Reassembly failed for a non-missing reason (e.g. envelope_hash
        // drift, conflict). Don't retry — bail.
        return {
            kind: "giveup",
            reason: result.error ?? "reassembly failed without missing-sequence info",
            partial_frame_count: env.frames_by_sequence.size,
        };
    }

    // Filter out sequences we've already given up on per the
    // per-sequence cap.
    const eligible: number[] = [];
    for (const s of missing) {
        if (env.abandoned_sequences.has(s)) continue;
        const tries = env.retransmit_attempts.get(s) ?? 0;
        if (tries >= config.max_attempts_per_sequence) continue;
        eligible.push(s);
    }
    if (eligible.length === 0) {
        return {
            kind: "giveup",
            reason: `every missing sequence exceeded max_attempts_per_sequence (${config.max_attempts_per_sequence})`,
            partial_frame_count: env.frames_by_sequence.size,
        };
    }

    // Cooldown: don't spam retransmit requests faster than the configured
    // interval allows.
    if (
        env.last_retransmit_request_ms !== 0 &&
        now_ms - env.last_retransmit_request_ms < config.retransmit_cooldown_ms
    ) {
        return {
            kind: "wait",
            reason: `cooldown active: ${config.retransmit_cooldown_ms - (now_ms - env.last_retransmit_request_ms)}ms remaining`,
        };
    }

    return { kind: "retransmit", sequences: eligible };
}

/** Mark that a retransmit request was just issued. Increments the per-
 *  sequence attempt counter and bumps `last_retransmit_request_ms`. */
export function recordRetransmitRequest(
    env: PendingEnvelope,
    sequences: ReadonlyArray<number>,
    config: RetransmitConfig,
    now_ms: number,
): PendingEnvelope {
    const attempts = new Map(env.retransmit_attempts);
    const abandoned = new Set(env.abandoned_sequences);
    for (const s of sequences) {
        const t = (attempts.get(s) ?? 0) + 1;
        attempts.set(s, t);
        if (t >= config.max_attempts_per_sequence) {
            abandoned.add(s);
        }
    }
    return {
        ...env,
        retransmit_attempts: attempts,
        abandoned_sequences: abandoned,
        last_retransmit_request_ms: now_ms,
    };
}
