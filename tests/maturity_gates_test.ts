// The maturity ladder, held to its thresholds.
//
// Every one of these was an inline literal inside a method of `libp2p_mesh.ts`
// that also published to gossipsub and dispatched a DOM event, which is to say
// none of them could be exercised without standing up the whole mesh — so none
// of them were. Two test files carried hand-written restatements instead
// (`entries >= 10 && uniqueMatrices >= 5`, and a private `isOracleProposed`),
// which is coverage of the test's own arithmetic, not of the code.

import { assertEquals } from "jsr:@std/assert@1";
import {
  ATTRACTOR_CONSENSUS_MIN_PEERS,
  attractorConsensusReached,
  GENESIS_MIN_VERIFIED_PROOFS,
  genesisInscribable,
  isOracleProposed,
  oracleSenateConvened,
  SENATE_MIN_LEDGER_ENTRIES,
  SENATE_MIN_UNIQUE_MATRICES,
  senateConvened,
} from "../src/network/maturity_gates.ts";
import {
  ORACLE_MATRICES_V1,
  oracleMatrix,
} from "../src/network/oracle_identity.ts";

Deno.test("attractor consensus needs three distinct peers, not two", () => {
  assertEquals(attractorConsensusReached(2), false);
  assertEquals(attractorConsensusReached(ATTRACTOR_CONSENSUS_MIN_PEERS), true);
  assertEquals(attractorConsensusReached(0), false);
});

Deno.test("the Senate needs BOTH volume and diversity — neither implies the other", () => {
  // 10 entries from one matrix is one loud peer.
  assertEquals(senateConvened(SENATE_MIN_LEDGER_ENTRIES, 1), false);
  // 5 matrices with one entry each is a quorum nobody corroborated.
  assertEquals(senateConvened(5, SENATE_MIN_UNIQUE_MATRICES), false);
  assertEquals(
    senateConvened(SENATE_MIN_LEDGER_ENTRIES, SENATE_MIN_UNIQUE_MATRICES),
    true,
  );
  // Boundary, from both sides.
  assertEquals(senateConvened(9, 5), false);
  assertEquals(senateConvened(10, 4), false);
  assertEquals(senateConvened(50, 8), true);
});

Deno.test("the genesis gate opens at 100 verified proofs, not 99", () => {
  assertEquals(genesisInscribable(GENESIS_MIN_VERIFIED_PROOFS - 1), false);
  assertEquals(genesisInscribable(GENESIS_MIN_VERIFIED_PROOFS), true);
  // REGRESSION-adjacent: this counter was once never incremented at all, which
  // held the whole chain below shut while looking like a system still warming
  // up. A gate on a counter nobody advances never opens.
  assertEquals(genesisInscribable(0), false);
});

Deno.test("the oracle Senate needs the genesis AND a prior accepted task", () => {
  assertEquals(oracleSenateConvened(false, 5), false, "no genesis, no seats");
  assertEquals(oracleSenateConvened(true, 0), false, "never legislated yet");
  assertEquals(oracleSenateConvened(true, 1), true);
});

Deno.test("only the canonical oracle dipoles count as oracle-proposed", () => {
  for (const [name, matrix] of Object.entries(ORACLE_MATRICES_V1)) {
    assertEquals(isOracleProposed(matrix), true, `${name} not recognised`);
    // The registry entry must equal what the name derives to, or this
    // predicate is testing the registry rather than the protocol.
    assertEquals(matrix, oracleMatrix(name));
  }
  assertEquals(isOracleProposed(0xDEAD_BEEF), false);
  assertEquals(isOracleProposed(0), false);
});

Deno.test("the ladder is a dependency chain: each rung presumes the one below", () => {
  // Not a schedule and not time-based — the only ordering is that gate 4 reads
  // gate 3's result. Stated as a test so the chain cannot be quietly cut.
  const genesis = genesisInscribable(GENESIS_MIN_VERIFIED_PROOFS);
  assertEquals(genesis, true);
  assertEquals(oracleSenateConvened(genesis, 1), true);
  assertEquals(
    oracleSenateConvened(genesisInscribable(0), 1),
    false,
    "the oracle Senate must not open over an unanchored protocol",
  );
});
