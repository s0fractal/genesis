// 🌌 OMEGA-64: Era 1240 — Mesh Health Composite Score
//
// The transport stack now exposes many distinct metrics:
//   - Era 1180 redundancy_rate (per local detector)
//   - Era 1200 partition alarm counts (per peer monitor)
//   - Era 1220 consensus suspect counts (per convergence tracker)
//   - Era 1210 quarantine counts (per investigator)
//
// Operators want a single "is the mesh healthy?" number. Era 1240
// folds the existing metrics into a normalized composite score in
// [0, 1] per relay AND per mesh-as-a-whole. The math is intentionally
// transparent and integer-friendly: a weighted sum of normalized
// components, with each weight tuned so that any one factor can
// drag the score significantly but no single factor can dominate
// catastrophically.
//
// PRINCIPLE: every input is already deterministic and observable.
// Two relays with the same metric history compute the same composite.
// This makes "mesh health" itself a cross-relay-comparable signal —
// the same way `redundancy_rate` was made comparable in Era 1190.

import { ConvergenceDetector } from "./convergence_detector.ts";
import { PeerSnapshotMonitor } from "./peer_snapshot_monitor.ts";
import { InvestigationConvergenceTracker } from "./investigation_convergence.ts";
import { AutoInvestigator } from "./auto_investigation.ts";

export type HealthBand = "healthy" | "watch" | "degraded" | "critical";

export interface CompositeScore {
    /** Final score in [0, 1]. */
    score: number;
    /** Health band derived from the score. */
    band: HealthBand;
    /** Individual contribution components for HUD display. */
    contributions: {
        /** redundancy_rate (Era 1180) — typically the main positive factor. */
        redundancy: number;
        /** Partition alarm penalty (Era 1200). */
        partition_alarms: number;
        /** Consensus suspect penalty (Era 1220). */
        consensus_suspects: number;
        /** Quarantine count penalty (Era 1210). */
        quarantines: number;
    };
}

export interface CompositeOptions {
    /** Weight applied to redundancy_rate (positive). Default 0.55. */
    weight_redundancy: number;
    /** Penalty per partition alarm (negative). Default 0.05. */
    penalty_per_partition: number;
    /** Cap for partition penalty contribution. Default 0.30. */
    max_partition_penalty: number;
    /** Penalty per consensus suspect target (negative). Default 0.10. */
    penalty_per_consensus_suspect: number;
    /** Cap for consensus suspect penalty. Default 0.30. */
    max_consensus_suspect_penalty: number;
    /** Penalty per active quarantine (negative). Default 0.15. */
    penalty_per_quarantine: number;
    /** Cap for quarantine penalty. Default 0.45. */
    max_quarantine_penalty: number;
}

const DEFAULT_OPTS: CompositeOptions = {
    weight_redundancy: 0.55,
    penalty_per_partition: 0.05,
    max_partition_penalty: 0.30,
    penalty_per_consensus_suspect: 0.10,
    max_consensus_suspect_penalty: 0.30,
    penalty_per_quarantine: 0.15,
    max_quarantine_penalty: 0.45,
};

const HEALTHY_THRESHOLD = 0.75;
const WATCH_THRESHOLD = 0.50;
const DEGRADED_THRESHOLD = 0.25;

function clamp01(x: number): number {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
}

function bandOf(score: number): HealthBand {
    if (score >= HEALTHY_THRESHOLD) return "healthy";
    if (score >= WATCH_THRESHOLD) return "watch";
    if (score >= DEGRADED_THRESHOLD) return "degraded";
    return "critical";
}

export interface RelayHealthInputs {
    /** Local Era 1180 detector. */
    detector: ConvergenceDetector;
    /** Local Era 1200 peer monitor. */
    monitor?: PeerSnapshotMonitor;
    /** Local Era 1220 convergence tracker. */
    convergence?: InvestigationConvergenceTracker;
    /** Local Era 1210 investigator. */
    investigator?: AutoInvestigator;
}

/**
 * Compute the composite health score for a single relay's view.
 *
 * Inputs are typed as "all the relay's local observability state".
 * Missing modules contribute 0 (no positive, no negative).
 */
export function computeRelayHealth(
    inputs: RelayHealthInputs,
    opts: CompositeOptions = DEFAULT_OPTS,
): CompositeScore {
    // (1) Redundancy contribution: rate ∈ [0, 1] × weight.
    const stats = inputs.detector.stats();
    const redundancy = stats.redundancy_rate * opts.weight_redundancy;

    // (2) Partition penalty: count of recent alarms.
    let partitionPenalty = 0;
    if (inputs.monitor) {
        const alarms = inputs.monitor.recentAlarms(10).length;
        const raw = alarms * opts.penalty_per_partition;
        partitionPenalty = -Math.min(raw, opts.max_partition_penalty);
    }

    // (3) Consensus suspect penalty: count of high-confidence targets.
    let consensusPenalty = 0;
    if (inputs.convergence) {
        const suspects = inputs.convergence.consensusSuspectTargets().length;
        const raw = suspects * opts.penalty_per_consensus_suspect;
        consensusPenalty = -Math.min(raw, opts.max_consensus_suspect_penalty);
    }

    // (4) Quarantine penalty: count of relays currently in quarantine.
    let quarantinePenalty = 0;
    if (inputs.investigator) {
        const quarantined = inputs.investigator.quarantinedRelays().length;
        const raw = quarantined * opts.penalty_per_quarantine;
        quarantinePenalty = -Math.min(raw, opts.max_quarantine_penalty);
    }

    // The "no observability yet" base — without a detector with data,
    // we can't claim anything. Contribute a small floor so an empty
    // network reports as "watch" (0.5) rather than "critical" (0).
    const noDataFloor = stats.total_intents === 0 ? 0.5 : 0;

    const raw = redundancy
        + partitionPenalty
        + consensusPenalty
        + quarantinePenalty
        + noDataFloor;
    const score = clamp01(raw);

    return {
        score,
        band: bandOf(score),
        contributions: {
            redundancy,
            partition_alarms: partitionPenalty,
            consensus_suspects: consensusPenalty,
            quarantines: quarantinePenalty,
        },
    };
}

/**
 * Compute the mesh-wide health by averaging per-relay composite scores.
 * Caller provides a Map of relay_id → CompositeScore.
 */
export function computeMeshHealth(
    perRelay: Map<number, CompositeScore>,
): CompositeScore {
    if (perRelay.size === 0) {
        return {
            score: 0.5,
            band: "watch",
            contributions: {
                redundancy: 0,
                partition_alarms: 0,
                consensus_suspects: 0,
                quarantines: 0,
            },
        };
    }
    let total_score = 0;
    let total_red = 0;
    let total_part = 0;
    let total_cons = 0;
    let total_quar = 0;
    for (const c of perRelay.values()) {
        total_score += c.score;
        total_red += c.contributions.redundancy;
        total_part += c.contributions.partition_alarms;
        total_cons += c.contributions.consensus_suspects;
        total_quar += c.contributions.quarantines;
    }
    const n = perRelay.size;
    const avg = total_score / n;
    return {
        score: clamp01(avg),
        band: bandOf(avg),
        contributions: {
            redundancy: total_red / n,
            partition_alarms: total_part / n,
            consensus_suspects: total_cons / n,
            quarantines: total_quar / n,
        },
    };
}

/**
 * Format a composite score's band as a colored glyph for terminal HUDs.
 */
export function bandGlyph(band: HealthBand): string {
    switch (band) {
        case "healthy":  return "🟢";
        case "watch":    return "🟡";
        case "degraded": return "🟠";
        case "critical": return "🔴";
    }
}

/**
 * Convert a [0, 1] score to a Q16 fixed-point integer (suitable for
 * SporeFrame transport — same convention as redundancy_rate_q16).
 */
export function scoreToQ16(score: number): number {
    return Math.round(clamp01(score) * 65536) >>> 0;
}

/**
 * Inverse of `scoreToQ16` for receivers.
 */
export function q16ToScore(q16: number): number {
    return clamp01(q16 / 65536);
}

export const HEALTH_DEFAULTS = DEFAULT_OPTS;
