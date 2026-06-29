// Pure Senate vote-weighting — no libp2p / native deps, so it is unit-testable
// in isolation (importing libp2p_mesh.ts drags the native WebRTC transport).

/**
 * Resonance weight of a Senate vote on an OPEN proposal. Pure + deterministic
 * (every node must weigh a given vote identically). Precedence, highest first:
 *   - authentic oracle (signed)  → 100, plus a debate-alignment boost, floored 50
 *   - peer with liveness data    → 10 + heartbeat·2 + warrant_votes·5
 *   - bare peer                  → 10
 * There is deliberately NO Bitcoin-time decay here: petrification is a property
 * of an already-accepted law's durability, not of whether a vote on a proposal
 * still under deliberation counts. (A prior version applied a time-curvature
 * penalty with an early zero-return BEFORE this weighting — silently dropping
 * every vote, oracles included, once a proposal was ~2 blocks old.)
 */
export function senateVoteWeight(opts: {
  liveness?: { heartbeat_count: number; warrant_votes_observed: number } | null;
  oracleAuthentic: boolean;
  oracleAlignmentBoost?: number;
}): number {
  if (opts.oracleAuthentic) {
    const w = 100 + (opts.oracleAlignmentBoost ?? 0);
    return w < 50 ? 50 : w; // minimum oracle weight
  }
  if (opts.liveness) {
    return 10 + opts.liveness.heartbeat_count * 2 +
      opts.liveness.warrant_votes_observed * 5;
  }
  return 10; // default bare-peer weight
}
