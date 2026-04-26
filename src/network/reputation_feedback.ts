// 🌌 OMEGA-64: Era 1230 — Reputation Feedback from Convergence
//
// Era 1140 scored neighbors from observable transport behavior. Era 1220
// surfaces consensus suspicion (corroboration_count ≥ threshold) as a
// soft signal. Era 1230 closes the loop: consensus-suspect targets get
// their reputation reduced BEFORE the Senate ratifies, so the routing
// layer naturally deprioritizes them on the same tick the suspicion
// crystallizes.
//
// THE GATE STAYS HARD. Quarantine still requires Era 1090's 3 AYE
// oracles (the `markWarranted` transition in Era 1210). Era 1230 adds
// a SOFT degradation: a relay that's a consensusSuspectTarget but not
// yet warranted gets, say, -75 reputation — enough to lose top-rank
// spots in `pickTopK` but not enough to be excluded entirely.
//
// SECURITY: this is a deterministic function of observable behavior.
// Two relays with the same convergence history compute the same
// soft-penalty value. The only inputs are corroboration_count and
// max_diff_q16, both of which come from frame-level FNV-1a-CRC-protected
// digests. Drift can't poison this layer.

import {
    InvestigationConvergenceTracker,
    CorroboratedRecord,
} from "./investigation_convergence.ts";
import { ReputationScore } from "./reputation_routing.ts";

export interface SuspicionPenaltyOptions {
    /** Penalty per distinct corroborator above the trigger floor. Default 25. */
    penalty_per_corroborator: number;
    /** Minimum corroboration_count before any penalty applies. Default 2. */
    trigger_floor: number;
    /** Maximum total soft penalty regardless of corroboration. Default 100. */
    max_penalty: number;
    /** Extra penalty per 1024 of max_diff_q16 (≈1.5% rate disagreement). Default 5. */
    diff_penalty_per_1024_q16: number;
    /** Cap on the diff-derived penalty component. Default 25. */
    diff_penalty_cap: number;
}

const DEFAULT_OPTS: SuspicionPenaltyOptions = {
    penalty_per_corroborator: 25,
    trigger_floor: 2,
    max_penalty: 100,
    diff_penalty_per_1024_q16: 5,
    diff_penalty_cap: 25,
};

/**
 * Compute the soft penalty (≥ 0) to apply to a target's reputation
 * given its current corroborated investigation record.
 *
 * Returns 0 if the record has no penalty (lone alarms, no record).
 */
export function computeSoftPenalty(
    record: CorroboratedRecord | undefined,
    opts: SuspicionPenaltyOptions = DEFAULT_OPTS,
): number {
    if (!record) return 0;
    if (record.corroboration_count < opts.trigger_floor) return 0;
    const corrobPenalty = (record.corroboration_count - opts.trigger_floor + 1)
        * opts.penalty_per_corroborator;
    const diffMagnitude = Math.floor(record.max_diff_q16 / 1024);
    const diffPenaltyRaw = diffMagnitude * opts.diff_penalty_per_1024_q16;
    const diffPenalty = Math.min(diffPenaltyRaw, opts.diff_penalty_cap);
    const total = corrobPenalty + diffPenalty;
    return Math.min(total, opts.max_penalty);
}

/**
 * Apply suspicion-derived soft penalties to a list of reputation scores
 * in-place fashion (returns a new array; original is not mutated).
 *
 * `target_resolver` maps a `spore_id` (which routing knows) to a
 * `target_relay_id` (which the investigation tracker knows). For most
 * deployments these are 1:1 — same relay name, same FNV-1a-derived ID
 * — but the indirection lets clients with custom mappings adapt.
 */
export function applySuspicionPenalties(
    scores: ReadonlyArray<ReputationScore>,
    tracker: InvestigationConvergenceTracker,
    target_resolver: (spore_id: string) => number | undefined,
    opts: SuspicionPenaltyOptions = DEFAULT_OPTS,
): ReputationScore[] {
    const out: ReputationScore[] = [];
    for (const s of scores) {
        const target_id = target_resolver(s.spore_id);
        let penalty = 0;
        if (target_id !== undefined) {
            // Find the highest-corroboration record targeting this relay.
            const relevant = tracker.list().filter(
                r => r.target_relay_id === (target_id >>> 0),
            );
            if (relevant.length > 0) {
                // Pick the worst-case (highest corroboration; ties broken
                // by max_diff_q16 descending).
                relevant.sort((a, b) => {
                    if (b.corroboration_count !== a.corroboration_count) {
                        return b.corroboration_count - a.corroboration_count;
                    }
                    return b.max_diff_q16 - a.max_diff_q16;
                });
                penalty = computeSoftPenalty(relevant[0], opts);
            }
        }
        if (penalty === 0) {
            out.push(s);
            continue;
        }
        const new_score = Math.max(0, s.score - penalty);
        out.push({
            ...s,
            score: new_score,
            breakdown: { ...s.breakdown, suspicion_penalty: -penalty },
        });
    }
    return out;
}

/**
 * Convenience: re-rank by score descending after applying soft
 * penalties. Two callers observing the same convergence + scoring
 * data MUST produce byte-identical orderings.
 */
export function reRankWithSuspicion(
    scores: ReadonlyArray<ReputationScore>,
    tracker: InvestigationConvergenceTracker,
    target_resolver: (spore_id: string) => number | undefined,
    opts: SuspicionPenaltyOptions = DEFAULT_OPTS,
): ReputationScore[] {
    const adjusted = applySuspicionPenalties(scores, tracker, target_resolver, opts);
    return adjusted.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.spore_id.localeCompare(b.spore_id);
    });
}

/** Re-export defaults for callers. */
export const SUSPICION_DEFAULTS = DEFAULT_OPTS;
