// 🌌 OMEGA-64: Era 1140 — Reputation-Weighted Routing
//
// Combines the Era 1120 LivenessAggregator's per-spore health metrics
// with the Era 1130 spore_routing decision logic to choose AMONG
// multiple eligible neighbors instead of flooding all of them.
//
// PRINCIPLE: a spore in a multi-neighbor topology (BLE mesh, UART star,
// CAN bus) wants to forward each frame to the neighbor most likely to
// successfully deliver it onward. This module computes a deterministic
// reputation score per neighbor from observable metrics:
//
//   reputation = base
//                + healthy_bonus       (currently healthy)
//                + heartbeat_density   (recent activity)
//                + warrant_throughput  (carries votes successfully)
//                - stall_penalty       (tick stuck)
//                - silence_penalty     (lost contact)
//                - fork_penalty        (drifted genesis — never picked)
//
// FORKED neighbors are excluded entirely. This is not a soft penalty —
// it's a hard cryptographic gate. Era 1080 codeicide / Era 1130 wire-
// drift containment already established that drift propagates nothing.
//
// The output is a stable ranking. Two relays with the same observation
// history MUST produce the same ranking, so the routing layer above is
// deterministic across nodes.

import { GENESIS_HASH_LEGACY_V1_0 } from "./genesis_inscription.ts";
import {
    LivenessAggregator,
    SporeHealth,
    SporeRecord,
} from "./liveness_aggregator.ts";

export interface ReputationScore {
    spore_id: string;
    score: number;
    health: SporeHealth;
    /** True if this neighbor is eligible to be picked at all. */
    eligible: boolean;
    /** Free-form breakdown of how the score was assembled (debug only). */
    breakdown: Record<string, number>;
}

export interface ReputationOptions {
    base: number;
    healthyBonus: number;
    heartbeatPerCount: number;     // multiplied by min(heartbeat_count, cap)
    heartbeatCap: number;
    warrantPerVote: number;        // multiplied by warrant_votes_observed
    warrantCap: number;
    stallPenalty: number;
    silencePenaltyPerSec: number;
    silenceCapSec: number;
    /** Hard gate: forked neighbors are NEVER eligible. */
    forkExcludes: boolean;
}

const DEFAULT_OPTS: ReputationOptions = {
    base: 100,
    healthyBonus: 50,
    heartbeatPerCount: 2,
    heartbeatCap: 50,        // diminishing returns at 50 heartbeats
    warrantPerVote: 5,
    warrantCap: 20,          // diminishing returns at 20 votes
    stallPenalty: 30,
    silencePenaltyPerSec: 1,
    silenceCapSec: 60,       // cap silence penalty at 60s
    forkExcludes: true,
};

/**
 * Compute a reputation score for one spore record.
 *
 * `now_ms` is used to evaluate silence; if you call this without
 * sweeping the aggregator first, a record's `health` field may lag.
 */
export function scoreOne(
    rec: SporeRecord,
    now_ms: number,
    opts: ReputationOptions = DEFAULT_OPTS,
): ReputationScore {
    const breakdown: Record<string, number> = {};
    let score = opts.base;
    breakdown.base = opts.base;

    // Hard fork gate.
    if (opts.forkExcludes && rec.health === "forked") {
        return {
            spore_id: rec.spore_id,
            score: 0,
            health: rec.health,
            eligible: false,
            breakdown: { fork_excluded: 1 },
        };
    }

    if (rec.health === "healthy") {
        score += opts.healthyBonus;
        breakdown.healthy_bonus = opts.healthyBonus;
    }

    const hbContribution = Math.min(rec.heartbeat_count, opts.heartbeatCap)
        * opts.heartbeatPerCount;
    score += hbContribution;
    breakdown.heartbeat_density = hbContribution;

    const warrantContribution = Math.min(rec.warrant_votes_observed, opts.warrantCap)
        * opts.warrantPerVote;
    score += warrantContribution;
    breakdown.warrant_throughput = warrantContribution;

    if (rec.health === "stalled") {
        score -= opts.stallPenalty;
        breakdown.stall_penalty = -opts.stallPenalty;
    }

    if (rec.health === "lost") {
        const silence_sec = Math.min(
            (now_ms - rec.last_seen_at_ms) / 1000,
            opts.silenceCapSec,
        );
        const penalty = silence_sec * opts.silencePenaltyPerSec;
        score -= penalty;
        breakdown.silence_penalty = -penalty;
    }

    if (rec.health === "unknown") {
        // Mild penalty: we don't know enough yet to trust them.
        score -= 5;
        breakdown.unknown_penalty = -5;
    }

    // Score is never negative; clamp to 0.
    if (score < 0) score = 0;

    return {
        spore_id: rec.spore_id,
        score,
        health: rec.health,
        eligible: rec.health !== "forked",
        breakdown,
    };
}

/**
 * Score every spore the aggregator knows about, returning a stable
 * ranking sorted by score descending, then by spore_id ascending for
 * deterministic tie-breaking.
 */
export function rankNeighbors(
    aggregator: LivenessAggregator,
    now_ms: number,
    opts: ReputationOptions = DEFAULT_OPTS,
): ReputationScore[] {
    aggregator.sweep(now_ms);
    const scores = aggregator.snapshot().map(rec => scoreOne(rec, now_ms, opts));
    scores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.spore_id.localeCompare(b.spore_id);
    });
    return scores;
}

/**
 * Pick the best `k` eligible neighbors for forwarding. `0 < k ≤ 5` in
 * practice — a microcontroller's neighbor table is tiny.
 */
export function pickTopK(
    aggregator: LivenessAggregator,
    now_ms: number,
    k: number,
    opts: ReputationOptions = DEFAULT_OPTS,
): ReputationScore[] {
    return rankNeighbors(aggregator, now_ms, opts)
        .filter(s => s.eligible)
        .slice(0, k);
}

/**
 * Single-neighbor pick. Returns the highest-scoring eligible neighbor,
 * or null if none are eligible.
 */
export function pickBest(
    aggregator: LivenessAggregator,
    now_ms: number,
    opts: ReputationOptions = DEFAULT_OPTS,
): ReputationScore | null {
    const top = pickTopK(aggregator, now_ms, 1, opts);
    return top.length > 0 ? top[0] : null;
}

/**
 * Diagnostic: returns the IDs of forked neighbors so the relay can
 * surface them to the operator.
 */
export function listExcludedForks(aggregator: LivenessAggregator): string[] {
    return aggregator.forkedSpores();
}

/** Re-export helpful constants for callers. */
export const REPUTATION_DEFAULTS = DEFAULT_OPTS;
export { GENESIS_HASH_LEGACY_V1_0 };
