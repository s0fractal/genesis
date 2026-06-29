// Regression test for the Senate open-proposal vote weight (libp2p_mesh.ts).
// The bug: a Bitcoin-time "curvature" petrification penalty was applied to the
// vote weight with an early zero-return BEFORE the oracle/liveness weighting, so
// once a proposal was ~2 blocks old EVERY incoming vote — authentic oracles
// included — was silently dropped, freezing the proposal after ~20 minutes.
// senateVoteWeight is now pure, time-independent, and these lock that.

import { assertEquals } from "jsr:@std/assert@1";
import { senateVoteWeight } from "../src/network/senate_weight.ts";

Deno.test("bare peer with no liveness data weighs the default 10", () => {
  assertEquals(senateVoteWeight({ oracleAuthentic: false }), 10);
  assertEquals(
    senateVoteWeight({ oracleAuthentic: false, liveness: null }),
    10,
  );
});

Deno.test("a peer's liveness raises weight: 10 + heartbeat·2 + warrant·5", () => {
  assertEquals(
    senateVoteWeight({
      oracleAuthentic: false,
      liveness: { heartbeat_count: 5, warrant_votes_observed: 3 },
    }),
    10 + 5 * 2 + 3 * 5, // 35
  );
});

Deno.test("an authentic oracle weighs 100 and outranks liveness", () => {
  assertEquals(senateVoteWeight({ oracleAuthentic: true }), 100);
  // oracle precedence: even with liveness present, oracle wins
  assertEquals(
    senateVoteWeight({
      oracleAuthentic: true,
      liveness: { heartbeat_count: 50, warrant_votes_observed: 50 },
    }),
    100,
  );
});

Deno.test("oracle debate-alignment boost adds, floored at 50", () => {
  assertEquals(
    senateVoteWeight({ oracleAuthentic: true, oracleAlignmentBoost: 30 }),
    130,
  );
  // a strongly-misaligned oracle is floored, never erased
  assertEquals(
    senateVoteWeight({ oracleAuthentic: true, oracleAlignmentBoost: -200 }),
    50,
  );
});

Deno.test("REGRESSION: weight does not depend on proposal age — votes never silently vanish", () => {
  // The function takes no tau/age input at all; the same inputs always yield the
  // same positive weight, so a vote can never petrify to 0 and be dropped while
  // a proposal is still open. Oracles and peers keep their full weight forever.
  for (const oracleAuthentic of [true, false]) {
    const w = senateVoteWeight({ oracleAuthentic });
    assertEquals(w > 0, true);
  }
});
