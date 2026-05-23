// Adaptive TTL

// Era 1130 stamped every outgoing frame with a fixed `DEFAULT_TTL = 4`.
// That works for short, healthy daisy chains, but it wastes propagation
// margin on a chain of healthy nodes (TTL=2 would suffice) AND it
// strands a frame too early on a chain of marginal nodes (TTL=8 needed).

// Era 1150 lets the originator compute a TTL value as a deterministic
// function of:
// - the path's expected reliability (reputation scores from Era 1140);
// - a configurable safety factor (extra hops as retry headroom);
// - hard floors and ceilings (TTL ∈ [1, 16]).

// The math:
// reliability(path) = product_i  (score_i / MAX_REASONABLE_SCORE)
// margin(path)      = ceil( log_2( 1 / reliability ) )    // hops needed for >50%
// ttl(path)         = clamp( path.length + margin + safety,
// MIN_TTL, MAX_TTL )

// Forked or zero-score nodes contribute 0 reliability → infinite margin
// → ttl = MAX_TTL. The path is still tried (so we never refuse a route
// that has a slim chance), but with maximum retries.

// This is the LAST piece of the routing stack: from now on, every
// frame's TTL reflects what the originator actually observed about the
// network state at emission time, not a network-wide constant.

import { ReputationScore } from "./reputation_routing.ts";

export const MIN_TTL = 1;
export const MAX_TTL = 16;
const MAX_REASONABLE_SCORE = 250; // a healthy spore with full caps + bonus

export interface AdaptiveTtlOptions {
  /** Extra hops added regardless of path reliability. Default 1. */
  safetyHops: number;
  /** Lower bound on the computed TTL. */
  minTtl: number;
  /** Upper bound on the computed TTL. */
  maxTtl: number;
}

const DEFAULT_OPTS: AdaptiveTtlOptions = {
  safetyHops: 1,
  minTtl: MIN_TTL,
  maxTtl: MAX_TTL,
};

/** Convert a single reputation score (0..MAX_REASONABLE_SCORE) into a
 *  reliability proxy in (0, 1]. Score 0 (forked) returns 0. */
export function reliabilityOf(score: number): number {
  if (score <= 0) return 0;
  const r = score / MAX_REASONABLE_SCORE;
  return r > 1 ? 1 : r;
}

/** Aggregate the per-hop reliabilities into a path probability. */
export function pathReliability(
  scores: ReadonlyArray<ReputationScore>,
): number {
  if (scores.length === 0) return 1;
  let p = 1;
  for (const s of scores) {
    const r = reliabilityOf(s.score);
    if (r === 0) return 0;
    p *= r;
  }
  return p;
}

/** Hops needed so that p^margin > 0.5 → margin ≥ log_2(1/p). */
export function marginHops(reliability: number): number {
  if (reliability >= 1) return 0;
  if (reliability <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(Math.log2(1 / reliability));
}

/**
 * Compute the per-frame TTL for a chosen path. The path is the ordered
 * list of `ReputationScore`s for each hop the originator expects the
 * frame to traverse (typically returned by `pickTopK` / chained).
 */
export function adaptiveTtl(
  path: ReadonlyArray<ReputationScore>,
  opts: Partial<AdaptiveTtlOptions> = {},
): number {
  const o = { ...DEFAULT_OPTS, ...opts };
  if (path.length === 0) return o.minTtl;
  const r = pathReliability(path);
  let margin: number;
  if (r === 0) {
    margin = o.maxTtl; // forked / zero-rep node anywhere → max retries
  } else {
    const m = marginHops(r);
    margin = Number.isFinite(m) ? Math.min(m, o.maxTtl) : o.maxTtl;
  }
  const raw = path.length + margin + o.safetyHops;
  if (raw < o.minTtl) return o.minTtl;
  if (raw > o.maxTtl) return o.maxTtl;
  return raw;
}

/**
 * Convenience: build a deterministic per-frame TTL summary including
 * each input — useful for logging, the spore_relay HUD, and tests.
 */
export interface TtlReport {
  path_length: number;
  reliability: number;
  margin: number;
  safety: number;
  raw_ttl: number;
  final_ttl: number;
}

export function adaptiveTtlReport(
  path: ReadonlyArray<ReputationScore>,
  opts: Partial<AdaptiveTtlOptions> = {},
): TtlReport {
  const o = { ...DEFAULT_OPTS, ...opts };
  const r = pathReliability(path);
  const m = r === 0
    ? o.maxTtl
    : Number.isFinite(marginHops(r))
    ? Math.min(marginHops(r), o.maxTtl)
    : o.maxTtl;
  const raw = path.length + m + o.safetyHops;
  const final = raw < o.minTtl ? o.minTtl : raw > o.maxTtl ? o.maxTtl : raw;
  return {
    path_length: path.length,
    reliability: r,
    margin: m,
    safety: o.safetyHops,
    raw_ttl: raw,
    final_ttl: final,
  };
}
