// Regression test for the Senate open-proposal vote weight (libp2p_mesh.ts).
// The bug: a Bitcoin-time "curvature" petrification penalty was applied to the
// vote weight with an early zero-return BEFORE the oracle/liveness weighting, so
// once a proposal was ~2 blocks old EVERY incoming vote — authentic oracles
// included — was silently dropped, freezing the proposal after ~20 minutes.
// senateVoteWeight is now pure, time-independent, and these lock that.

import { assertEquals } from "jsr:@std/assert@1";
import {
  ORACLE_BASE_WEIGHT,
  PEER_WEIGHT_MAX,
  senateVoteWeight,
} from "../src/network/senate_weight.ts";

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

Deno.test("REGRESSION: a long-lived peer can never outweigh one aligned oracle", () => {
  // The bug: heartbeat_count is monotonic and uncapped in liveness_aggregator,
  // so peer weight grew without bound (10 + hb·2 + warrant·5). At hb=145 a
  // SINGLE peer crossed the absolute ayesWeight >= 300 ratification threshold
  // in libp2p_mesh and could unilaterally pass ADD_ORACLE / SET_QUORUM.
  const ancient = senateVoteWeight({
    oracleAuthentic: false,
    liveness: { heartbeat_count: 1_000_000, warrant_votes_observed: 1_000_000 },
  });
  assertEquals(ancient, PEER_WEIGHT_MAX); // 99, not 5_010_010
  assertEquals(ancient < ORACLE_BASE_WEIGHT, true);
  // Peer consensus now costs 4 saturated peers; oracle resonance costs 3.
  assertEquals(PEER_WEIGHT_MAX * 3 < 300, true);
});

Deno.test("liveness saturates at the same caps reputation_routing uses", () => {
  // heartbeatCap 50, warrantCap 20 → 10 + 100 + 100 = 210, clamped to 99.
  const saturated = senateVoteWeight({
    oracleAuthentic: false,
    liveness: { heartbeat_count: 50, warrant_votes_observed: 20 },
  });
  const beyond = senateVoteWeight({
    oracleAuthentic: false,
    liveness: { heartbeat_count: 500, warrant_votes_observed: 200 },
  });
  assertEquals(saturated, beyond);
  // Negative/garbage counters cannot mint weight below the bare-peer floor.
  assertEquals(
    senateVoteWeight({
      oracleAuthentic: false,
      liveness: { heartbeat_count: -50, warrant_votes_observed: -50 },
    }),
    10,
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
