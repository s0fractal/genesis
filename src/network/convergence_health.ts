// 🌌 OMEGA-64: Era 1350 — Convergence-Driven Composite Health
//
// Era 1340 exposed `fleetConvergenceRate` as a Q16 metric:
// what fraction of network-known digests does this relay hold?
// That metric is informative, but it's not yet wired into anything
// the rest of the OMEGA stack can react to.
//
// Era 1350 closes that loop. It:
//
//   1. Computes a `ConvergenceHealthSignal` from the Era 1340 ratio:
//      score (in [0, 1]), band (matching mesh-health bands), and a
//      soft alarm flag when the score drops below a tunable
//      threshold.
//
//   2. Folds that signal into Era 1240's `CompositeScore` as an
//      optional contribution. Existing `RelayHealthInputs` callers
//      see no change; new callers pass the convergence signal in.
//
//   3. Treats convergence as an *additive* term, not a multiplier
//      — a relay with poor convergence shouldn't cancel out high
//      redundancy, but should noticeably nudge the composite
//      downward proportional to the gap.
//
// PRINCIPLE: convergence is downstream of the forensic stack
// (Eras 1310-1340), not a synonym for it. A relay that has
// adjudicated nothing has no convergence to assess; a relay that
// has full convergence still benefits from redundancy/quorum
// signals from the rest of the composite. The two operate
// orthogonally.

import { fleetConvergenceRate } from "./archive_sync_coordinator.ts";

export const CONVERGENCE_HEALTH_SCHEMA = "OMEGA-1350/v1";

export type ConvergenceBand = "converged" | "lagging" | "diverged" | "stranded";

export interface ConvergenceHealthOptions {
    /** Score below this threshold triggers the soft alarm. Default 0.5. */
    alarm_threshold: number;
    /** Score above this is "converged". Default 0.85. */
    converged_threshold: number;
    /** Score above this (and below converged) is "lagging". Default 0.50. */
    lagging_threshold: number;
    /** Score above this (and below lagging) is "diverged". Default 0.20. */
    diverged_threshold: number;
}

export const DEFAULT_CONVERGENCE_OPTS: ConvergenceHealthOptions = {
    alarm_threshold: 0.50,
    converged_threshold: 0.85,
    lagging_threshold: 0.50,
    diverged_threshold: 0.20,
};

export interface ConvergenceHealthSignal {
    /** Q16 fixed-point convergence rate (mirror of fleetConvergenceRate). */
    rate_q16: number;
    /** Convenience: rate_q16 / 65536 in [0, 1]. */
    score: number;
    band: ConvergenceBand;
    /** True when score is below `alarm_threshold`. */
    alarm: boolean;
    /** Number of digests in the local set ∩ network set. */
    intersection_size: number;
    /** Total digests known to the network (denominator). */
    network_size: number;
}

function clamp01(x: number): number {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}

function bandFromScore(score: number, opts: ConvergenceHealthOptions): ConvergenceBand {
    if (score >= opts.converged_threshold) return "converged";
    if (score >= opts.lagging_threshold) return "lagging";
    if (score >= opts.diverged_threshold) return "diverged";
    return "stranded";
}

/** Compute the convergence health signal from local + network digest sets. */
export function computeConvergenceHealth(
    local_digests: ReadonlyArray<number>,
    network_digests: ReadonlyArray<number>,
    opts: ConvergenceHealthOptions = DEFAULT_CONVERGENCE_OPTS,
): ConvergenceHealthSignal {
    const networkSet = new Set(network_digests);
    const localSet = new Set(local_digests);
    let intersection = 0;
    for (const d of networkSet) if (localSet.has(d)) intersection++;

    // Reuse Era 1340's exact Q16 ratio computation for cross-call
    // consistency.
    const rate_q16 = fleetConvergenceRate(local_digests, network_digests);
    const score = clamp01(rate_q16 / 65536);
    return {
        rate_q16,
        score,
        band: bandFromScore(score, opts),
        alarm: score < opts.alarm_threshold,
        intersection_size: intersection,
        network_size: networkSet.size,
    };
}

/**
 * Convert a `ConvergenceHealthSignal` into the additive contribution it
 * should make to Era 1240's composite score.
 *
 *   contribution = (score - reference) × weight
 *
 * where `reference = converged_threshold`. A "converged" relay
 * contributes roughly +0 (its convergence isn't pulling the score
 * down); a "stranded" relay contributes a meaningful negative.
 *
 * The contribution is clamped to `[-weight, +weight × small_bonus_cap]`
 * so a relay with marginal convergence excess can't dominate, while
 * a stranded relay can drag the composite by a full weight unit.
 */
export function convergenceContribution(
    signal: ConvergenceHealthSignal,
    weight: number,
    opts: ConvergenceHealthOptions = DEFAULT_CONVERGENCE_OPTS,
): number {
    const reference = opts.converged_threshold;
    const raw = (signal.score - reference) * weight;
    // Cap the upside (a fully-converged relay should not boost
    // composite beyond what redundancy already provides) but allow
    // full downside.
    const max_bonus = weight * 0.10;
    if (raw > max_bonus) return max_bonus;
    if (raw < -weight) return -weight;
    return raw;
}

/** Format a convergence band as a colored glyph for terminal HUDs. */
export function convergenceGlyph(band: ConvergenceBand): string {
    switch (band) {
        case "converged":  return "🟢";
        case "lagging":    return "🟡";
        case "diverged":   return "🟠";
        case "stranded":   return "🔴";
    }
}
