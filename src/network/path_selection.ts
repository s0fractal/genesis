// Path Selection by Reputation × TTL Budget

// Era 1140 ranked individual neighbors. Era 1150 turned per-frame TTL
// into a function of path reliability. Era 1160 closes the loop: when
// the originator has multiple eligible PATHS (each a sequence of
// neighbors), pick the one with the best (reliability / TTL) tradeoff.

// PRINCIPLE: a path of 2 healthy hops with TTL=4 is preferable to a
// path of 5 marginal hops with TTL=12 — even if both have the same
// final reliability — because the shorter path costs less radio time
// and leaves the mesh available for other traffic.

// FORMULA: efficiency = (reliability × 1000) / ttl
// - reliability ∈ (0, 1] — product of per-hop reputation/MAX_REASONABLE.
// - ttl ∈ [MIN_TTL, MAX_TTL] — output of `adaptiveTtl(path)`.
// - higher efficiency wins; ties broken by shorter path, then by
// lexicographic spore_id sequence (full determinism).

import { ReputationScore } from "./reputation_routing.ts";
import { adaptiveTtl, pathReliability } from "./adaptive_ttl.ts";

export interface PathCandidate {
    /** Spores in order from originator to destination. */
    hops: ReputationScore[];
    /** Tag identifying this candidate (caller-provided). */
    label: string;
}

export interface PathRanking {
    label: string;
    hops: ReputationScore[];
    reliability: number;
    ttl: number;
    efficiency: number;
    eligible: boolean;
}

const EFFICIENCY_SCALE = 1000;

/** Compute the efficiency score for one candidate path. */
export function rankPath(candidate: PathCandidate): PathRanking {
    const r = pathReliability(candidate.hops);
    const t = adaptiveTtl(candidate.hops);
    // Eligible iff every hop is itself eligible (excludes forked nodes).
    const eligible = candidate.hops.every(h => h.eligible);
    const efficiency = !eligible || r === 0 || t === 0
        ? 0
        : (r * EFFICIENCY_SCALE) / t;
    return {
        label: candidate.label,
        hops: candidate.hops,
        reliability: r,
        ttl: t,
        efficiency,
        eligible,
    };
}

/** Stable comparator: efficiency desc → path length asc → label asc. */
function comparePathRankings(a: PathRanking, b: PathRanking): number {
    // Eligible always wins over ineligible.
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    if (a.hops.length !== b.hops.length) return a.hops.length - b.hops.length;
    return a.label.localeCompare(b.label);
}

/**
 * Rank a set of candidate paths from best to worst.
 * Returns full diagnostic per candidate (caller may inspect efficiencies).
 */
export function rankPaths(candidates: PathCandidate[]): PathRanking[] {
    return candidates.map(rankPath).sort(comparePathRankings);
}

/**
 * Pick the single best path, or null if no eligible candidate exists.
 */
export function pickBestPath(candidates: PathCandidate[]): PathRanking | null {
    if (candidates.length === 0) return null;
    const ranked = rankPaths(candidates);
    if (!ranked[0].eligible) return null;
    return ranked[0];
}

/**
 * Evaluate one specific path without ranking against others.
 * Useful for "is this candidate good enough?" gate-style checks.
 */
export function evaluatePath(
    hops: ReputationScore[],
    label = "single",
): PathRanking {
    return rankPath({ hops, label });
}
