// Regression test for the Senate open-proposal vote weight (libp2p_mesh.ts).
// The bug: a Bitcoin-time "curvature" petrification penalty was applied to the
// vote weight with an early zero-return BEFORE the oracle/liveness weighting, so
// once a proposal was ~2 blocks old EVERY incoming vote — authentic oracles
// included — was silently dropped, freezing the proposal after ~20 minutes.
// senateVoteWeight is now pure, time-independent, and these lock that.

import { assertEquals } from "jsr:@std/assert@1";
import {
  ORACLE_BASE_WEIGHT,
  PEER_BASE_WEIGHT,
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

Deno.test("REGRESSION: an oracle's authority is not peer weight", () => {
  // THE CAPTURE VECTOR. senateVoteWeight used to return ORACLE_BASE_WEIGHT
  // (+alignment boost) for an authentic oracle, and applyVote books whatever it
  // returns into `ayesWeight` keyed by the PEER ID that delivered the vote. One
  // genuine oracle signature, republished from three peer IDs, therefore reached
  // the 300 that means "three oracles agreed" while oracleAyes.size was 1 — the
  // ceiling this module exists to enforce, bypassed by the oracle path itself.
  //
  // An oracle now contributes its NAME to the oracle tally and, separately,
  // whatever it is worth as an ordinary node. Nothing more.
  assertEquals(
    senateVoteWeight({ oracleAuthentic: true }),
    PEER_BASE_WEIGHT,
    "an oracle with no liveness is worth one bare node in the peer tally",
  );
  assertEquals(
    senateVoteWeight({
      oracleAuthentic: true,
      liveness: { heartbeat_count: 50, warrant_votes_observed: 50 },
    }),
    PEER_WEIGHT_MAX,
    "and a saturated one is worth a saturated peer — never more",
  );
  // Three peer IDs replaying one oracle signature no longer reach the bar.
  assertEquals(PEER_WEIGHT_MAX * 3 < 300, true);
});

Deno.test("REGRESSION: the alignment boost cannot split consensus", () => {
  // The boost came from CrossModelDebate.alignmentScore, which is populated only
  // by LOCAL WebLLM output and never gossiped — so two nodes computed different
  // weights for the same signed vote, in a value this module requires every node
  // to compute identically. It is ignored now; passing it changes nothing.
  const withBoost = senateVoteWeight({
    oracleAuthentic: true,
    oracleAlignmentBoost: 30,
    liveness: { heartbeat_count: 3, warrant_votes_observed: 0 },
  });
  const without = senateVoteWeight({
    oracleAuthentic: true,
    liveness: { heartbeat_count: 3, warrant_votes_observed: 0 },
  });
  assertEquals(withBoost, without);
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
