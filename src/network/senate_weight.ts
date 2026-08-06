// Pure Senate vote-weighting — no libp2p / native deps, so it is unit-testable
// in isolation (importing libp2p_mesh.ts drags the native WebRTC transport).

/** Weight of one authentic, signed oracle vote before the alignment boost. */
export const ORACLE_BASE_WEIGHT = 100;
/** A maximally-misaligned oracle is damped, never erased. */
export const ORACLE_WEIGHT_FLOOR = 50;

/** Weight of a peer we have never heard liveness from. */
export const PEER_BASE_WEIGHT = 10;
/**
 * Liveness caps are deliberately the same numbers `reputation_routing.ts`
 * uses (heartbeatCap 50 / warrantCap 20), so "saturated liveness" means the
 * same thing to the router and to the Senate.
 */
export const PEER_HEARTBEAT_PER_COUNT = 2;
export const PEER_HEARTBEAT_CAP = 50;
export const PEER_WARRANT_PER_VOTE = 5;
export const PEER_WARRANT_CAP = 20;

/**
 * Hard ceiling on any peer vote, and the governance invariant of this module:
 * NO peer, however long-lived, ever outweighs one aligned oracle.
 *
 * This is not cosmetic. `libp2p_mesh.ts` ratifies an open proposal at an
 * ABSOLUTE `ayesWeight >= 300` — i.e. "three oracles". `heartbeat_count` is
 * monotonic and uncapped in `liveness_aggregator.ts` (it only ever `+= 1`), so
 * without this ceiling a single peer that had merely been *online long enough*
 * crossed 300 on its own and could unilaterally ratify any proposal — including
 * ADD_ORACLE and SET_QUORUM. Capped here, peer consensus costs four distinct
 * saturated peers where oracle resonance costs three oracles: within-model
 * multiplicity is strictly more expensive than cross-model alignment, which is
 * what the Era-1060 rule claims to be doing.
 */
export const PEER_WEIGHT_MAX = ORACLE_BASE_WEIGHT - 1; // 99

/**
 * Resonance weight of a Senate vote on an OPEN proposal. Pure + deterministic
 * (every node must weigh a given vote identically). Precedence, highest first:
 *   - authentic oracle (signed)  → 100, plus a debate-alignment boost, floored 50
 *   - peer with liveness data    → 10 + min(heartbeat,50)·2 + min(warrant,20)·5,
 *                                  then clamped to 99
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
    const w = ORACLE_BASE_WEIGHT + (opts.oracleAlignmentBoost ?? 0);
    return w < ORACLE_WEIGHT_FLOOR ? ORACLE_WEIGHT_FLOOR : w;
  }
  if (opts.liveness) {
    const heartbeats = Math.min(
      Math.max(opts.liveness.heartbeat_count, 0),
      PEER_HEARTBEAT_CAP,
    );
    const warrants = Math.min(
      Math.max(opts.liveness.warrant_votes_observed, 0),
      PEER_WARRANT_CAP,
    );
    const raw = PEER_BASE_WEIGHT + heartbeats * PEER_HEARTBEAT_PER_COUNT +
      warrants * PEER_WARRANT_PER_VOTE;
    return Math.min(raw, PEER_WEIGHT_MAX);
  }
  return PEER_BASE_WEIGHT; // default bare-peer weight
}
