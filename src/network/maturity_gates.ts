// The maturity ladder: every threshold at which omega unlocks a capability,
// in one file, in order.
//
// These five gates were inline conditions scattered through 1500 lines of
// `libp2p_mesh.ts`, each buried in the method that fires its event. Answering
// "when does the Senate open?" meant reading a WebRTC transport class, and the
// thresholds themselves — 3, 10, 5, 100, 1 — were bare literals sitting next to
// the `console.log` that announced them. Nothing tested them, because there was
// nothing to test: a condition inside a method that also publishes to gossipsub
// and dispatches DOM events cannot be exercised without the whole mesh.
//
// Extracting them is not tidying. Each one becomes a thing that CAN be wrong,
// and therefore a thing a test can hold.
//
//   1. ATTRACTOR CONSENSUS — 3 distinct peers agree on the attractor field.
//      The lattice has company.
//   2. SENATE CONVENED — 10 ledger entries across 5 distinct matrices.
//      Enough independent observers that a proposal means something.
//   3. GENESIS INSCRIBED — 100 unique verified mitosis proofs.
//      The protocol has produced enough evidence of itself to be worth
//      anchoring; the identity closes into `0x716EA2F8`.
//   4. ORACLE SENATE CONVENED — genesis inscribed AND at least one accepted
//      task. Cross-model governance opens only over a protocol that has
//      already legislated once on its own.
//   5. VISION RATIFIED — an accepted proposal whose proposer is one of the
//      canonical oracle dipoles. The first time the ensemble, not the lattice,
//      sets the direction.
//
// The order is a dependency chain, not a schedule: 4 reads 3, and 5 is only
// checked on the acceptance path that 4 gates. Nothing here is time-based.

import { ORACLE_MATRICES_V1 } from "./oracle_identity.ts";

/** Distinct peers that must agree before the attractor field is consensus. */
export const ATTRACTOR_CONSENSUS_MIN_PEERS = 3;

/** Total ledger entries (summed peer counts) before the Senate convenes. */
export const SENATE_MIN_LEDGER_ENTRIES = 10;

/** Distinct attractor matrices those entries must span. */
export const SENATE_MIN_UNIQUE_MATRICES = 5;

/**
 * Unique verified mitosis proofs before the Genesis Inscription crystallizes.
 *
 * This is the odometer that went NEVER INCREMENTED once, which kept the whole
 * genesis → oracle-senate → vision chain unreachable in live mode. A threshold
 * on a counter nobody advances is a gate that never opens, and it looks exactly
 * like a system that is simply still warming up.
 */
export const GENESIS_MIN_VERIFIED_PROOFS = 100;

/** Accepted tasks required before cross-model governance opens. */
export const ORACLE_SENATE_MIN_ACCEPTED_TASKS = 1;

/** 1. The lattice has company. */
export function attractorConsensusReached(distinctPeers: number): boolean {
  return distinctPeers >= ATTRACTOR_CONSENSUS_MIN_PEERS;
}

/**
 * 2. Enough independent observation to legislate.
 *
 * BOTH conditions matter and neither implies the other: 10 entries from a
 * single matrix is one loud peer, and 5 matrices with 5 entries is a quorum
 * nobody has corroborated.
 */
export function senateConvened(
  totalLedgerEntries: number,
  uniqueMatrices: number,
): boolean {
  return totalLedgerEntries >= SENATE_MIN_LEDGER_ENTRIES &&
    uniqueMatrices >= SENATE_MIN_UNIQUE_MATRICES;
}

/** 3. The protocol has produced enough evidence of itself to anchor. */
export function genesisInscribable(verifiedMitosisProofs: number): boolean {
  return verifiedMitosisProofs >= GENESIS_MIN_VERIFIED_PROOFS;
}

/** 4. Cross-model governance opens over an already-legislating protocol. */
export function oracleSenateConvened(
  genesisInscribed: boolean,
  acceptedTasks: number,
): boolean {
  return genesisInscribed &&
    acceptedTasks >= ORACLE_SENATE_MIN_ACCEPTED_TASKS;
}

/**
 * 5. Was this proposal put forward by one of the canonical oracle dipoles?
 *
 * The dipole is an ADDRESS, not authority — it is computable by anyone from the
 * public name, which is why a signature is what actually authenticates a vote
 * (`oracle_custody.ts`). This predicate only asks whose SEAT a vision was filed
 * under, and it runs on the acceptance path, after authentication.
 */
export function isOracleProposed(proposerMatrix: number): boolean {
  const target = proposerMatrix >>> 0;
  return Object.values(ORACLE_MATRICES_V1).some((m) => (m >>> 0) === target);
}
