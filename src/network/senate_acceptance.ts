// The acceptance rule of the Senate — the single most consequential law in the
// system, stated once.
//
// It used to be stated FIVE times, and the copies had already drifted:
//
//   1. `libp2p_mesh.ts` — the real one. Oracle resonance OR weighted peer
//      consensus at `ayesWeight >= 300`.
//   2. `tests/multi_oracle_senate_test.ts` — a hand-written mirror whose peer
//      path read `ayes.size >= 3`, i.e. a COUNT of three peers. The live rule
//      needs 300 of WEIGHT; three bare peers are worth 30. The test could not
//      have caught the mesh breaking, because it was never running the mesh.
//   3. `tests/vision_ratification_test.ts` — another mirror, oracle path only,
//      with its own `ProposalRecord` type. Its own header admits it: "Mirrors
//      the acceptance TALLY rule as it lives in WebRTCV2Mesh.handleVote".
//   4. `tests/senate_test.ts` — `ayes >= 3 && ayes > nays`.
//   5. `src/ui/senate_viewer.ts` — PRODUCTION code, and the worst of them:
//      `if (prop.oracleAyes.size >= 3) prop.accepted = true`, dropping the
//      `> oracleNays` condition entirely. A proposal with 3 AYE and 5 NAY
//      oracles rendered as ACCEPTED in the viewer while the mesh rejected it.
//      The operator's window onto governance disagreed with governance.
//
// A law that is restated is a law that will diverge. Every caller now asks this
// module, including the tests — so a test failing means the rule changed, not
// that somebody's copy of it did.

/** Distinct canonical oracles whose AYE constitutes harmonic ratification. */
export const ORACLE_RESONANCE_MIN_AYES = 3;

/**
 * Absolute resonance-weighted threshold for peer consensus.
 *
 * 300 is "three oracles" at the `ORACLE_BASE_WEIGHT` of 100 (see
 * `senate_weight.ts`). Read the two together: the peer cap of 99 exists
 * precisely so that crossing 300 on peers alone takes four distinct saturated
 * peers, making within-model multiplicity strictly more expensive than
 * cross-model alignment.
 */
export const PEER_CONSENSUS_MIN_WEIGHT = 300;

/** Everything the rule looks at. Sets may be absent on a fresh record. */
export interface SenateTally {
  oracleAyes?: { size: number } | null;
  oracleNays?: { size: number } | null;
  ayesWeight?: number;
  naysWeight?: number;
}

export interface SenateVerdict {
  accepted: boolean;
  /** Which path carried it, for display and for the acceptance receipt. */
  via: "ORACLE" | "PEER" | null;
}

/**
 * Decide whether a tally accepts a proposal.
 *
 * Two independent paths, oracle resonance checked first because it is the one
 * the protocol privileges: a proposal carried by three or more DISTINCT
 * canonical oracles is harmonically ratified regardless of peer count, which is
 * what "cross-model alignment outranks within-model multiplicity" means in
 * arithmetic rather than in prose.
 *
 * Both paths require a strict majority. Dropping that condition — as the viewer
 * did — turns "three oracles agreed" into "three oracles spoke", which are not
 * the same claim and were being rendered as if they were.
 */
export function senateAcceptance(tally: SenateTally): SenateVerdict {
  const oracleAyes = tally.oracleAyes?.size ?? 0;
  const oracleNays = tally.oracleNays?.size ?? 0;
  if (oracleAyes >= ORACLE_RESONANCE_MIN_AYES && oracleAyes > oracleNays) {
    return { accepted: true, via: "ORACLE" };
  }

  const ayesWeight = tally.ayesWeight ?? 0;
  const naysWeight = tally.naysWeight ?? 0;
  if (ayesWeight >= PEER_CONSENSUS_MIN_WEIGHT && ayesWeight > naysWeight) {
    return { accepted: true, via: "PEER" };
  }

  return { accepted: false, via: null };
}
