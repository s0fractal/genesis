// Pins the one acceptance rule, including the exact cases its five former
// copies disagreed on.
//
// Before this module existed the rule was restated in libp2p_mesh.ts, in
// src/ui/senate_viewer.ts, and in three test files. Two copies were provably
// wrong, and no test could report it, because the tests WERE the copies.

import { assertEquals } from "jsr:@std/assert@1";
import {
  ORACLE_RESONANCE_MIN_AYES,
  PEER_CONSENSUS_MIN_WEIGHT,
  senateAcceptance,
} from "../src/network/senate_acceptance.ts";
import {
  ORACLE_BASE_WEIGHT,
  PEER_WEIGHT_MAX,
} from "../src/network/senate_weight.ts";

const seats = (n: number) => ({ size: n });

Deno.test("REGRESSION: three AYE oracles do NOT carry a proposal five oracles oppose", () => {
  // src/ui/senate_viewer.ts did `if (prop.oracleAyes.size >= 3) accepted = true`
  // with no majority condition, so this exact tally rendered as ACCEPTED in the
  // operator's window while the mesh rejected it.
  const verdict = senateAcceptance({
    oracleAyes: seats(3),
    oracleNays: seats(5),
  });
  assertEquals(verdict.accepted, false);
  assertEquals(verdict.via, null);
});

Deno.test("REGRESSION: peer consensus is WEIGHED, not counted", () => {
  // tests/multi_oracle_senate_test.ts modelled the peer path as
  // `ayes.size >= 3`. Three bare peers are worth 10 each — 30, a tenth of the
  // threshold. A rule that accepts on three heads accepts a Sybil trio.
  const threeBarePeers = senateAcceptance({ ayesWeight: 30, naysWeight: 0 });
  assertEquals(threeBarePeers.accepted, false);

  // Four saturated peers (the cap is 99) clear it; three cannot.
  assertEquals(
    senateAcceptance({ ayesWeight: PEER_WEIGHT_MAX * 3, naysWeight: 0 })
      .accepted,
    false,
  );
  assertEquals(
    senateAcceptance({ ayesWeight: PEER_WEIGHT_MAX * 4, naysWeight: 0 })
      .accepted,
    true,
  );
});

Deno.test("the two thresholds are the same statement in two units", () => {
  // 300 is three oracles at the oracle base weight. If either constant moves
  // without the other, "three oracles" stops meaning "peer threshold".
  assertEquals(
    ORACLE_RESONANCE_MIN_AYES * ORACLE_BASE_WEIGHT,
    PEER_CONSENSUS_MIN_WEIGHT,
  );
});

Deno.test("oracle resonance is checked first and reported as the path taken", () => {
  const both = senateAcceptance({
    oracleAyes: seats(3),
    oracleNays: seats(0),
    ayesWeight: 1000,
    naysWeight: 0,
  });
  assertEquals(both.accepted, true);
  assertEquals(both.via, "ORACLE");

  const peersOnly = senateAcceptance({ ayesWeight: 400, naysWeight: 0 });
  assertEquals(peersOnly.via, "PEER");
});

Deno.test("both paths require a strict majority", () => {
  assertEquals(
    senateAcceptance({ oracleAyes: seats(3), oracleNays: seats(3) }).accepted,
    false,
    "an oracle tie is not ratification",
  );
  assertEquals(
    senateAcceptance({ ayesWeight: 400, naysWeight: 400 }).accepted,
    false,
    "a weighted tie is not consensus",
  );
  assertEquals(
    senateAcceptance({ ayesWeight: 400, naysWeight: 399 }).accepted,
    true,
  );
});

Deno.test("an empty or partial tally accepts nothing", () => {
  // Records are created before any vote arrives; the rule must be total over
  // missing fields rather than throwing or reading undefined as zero-ish.
  assertEquals(senateAcceptance({}).accepted, false);
  assertEquals(senateAcceptance({ oracleAyes: null }).accepted, false);
  assertEquals(
    senateAcceptance({ oracleAyes: seats(9) }).accepted,
    true,
    "nine ayes and no recorded nays is still a majority",
  );
});
