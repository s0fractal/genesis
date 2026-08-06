// One peer, one position.
//
// The bug this pins was in the consensus path in plain sight. The peer tally in
// `handleVote` guarded only the set it was writing to:
//
//   if (aye) { if (!ayes.has(id)) { ayes.add(id); ayesWeight += w } }
//   else     { if (!nays.has(id)) { nays.add(id); naysWeight += w } }
//
// A peer that voted AYE and then sent a NAY sailed past `!nays.has(id)`, was
// added to `nays` while remaining in `ayes`, and had its weight counted in BOTH
// totals — permanently, with no way to withdraw either. The oracle branch
// fifteen lines below switched positions correctly all along, which is what
// makes this a slip and not a policy.
//
// It matters because acceptance is `ayesWeight >= 300 && ayesWeight >
// naysWeight`: a peer could back a proposal, then oppose it, keep its support
// counted, and simultaneously raise the bar its own support has to clear.

import { assertEquals } from "jsr:@std/assert@1";
import {
  applyVote,
  type SenateProposalRecord,
} from "../src/network/senate_ledger.ts";
import { PEER_CONSENSUS_MIN_WEIGHT } from "../src/network/senate_acceptance.ts";

function record(): SenateProposalRecord {
  return {
    hash: 0xABCD_0001,
    description: "test proposal",
    proposerMatrix: 0,
    ayes: new Set(),
    nays: new Set(),
    ayesWeight: 0,
    naysWeight: 0,
    accepted: false,
    localObservedAtMs: 0,
    proposedAtTau: 0,
  };
}

Deno.test("REGRESSION: a peer that switches sides is counted once, not twice", () => {
  const r = record();
  applyVote(r, { voterId: "peer-a", aye: true, weight: 90 });
  assertEquals([r.ayesWeight, r.naysWeight], [90, 0]);

  const out = applyVote(r, { voterId: "peer-a", aye: false, weight: 90 });
  assertEquals(out.switched, true);
  assertEquals(out.counted, true);
  // The old code produced [90, 90] with the peer in BOTH sets.
  assertEquals([r.ayesWeight, r.naysWeight], [0, 90]);
  assertEquals(r.ayes.has("peer-a"), false);
  assertEquals(r.nays.has("peer-a"), true);
});

Deno.test("REGRESSION: one peer cannot both support and block the same proposal", () => {
  // Three saturated-ish peers put a proposal one vote short. A fourth backs it
  // — accepted. Under the old tally that same fourth peer could then send a NAY
  // and keep its AYE weight counted while adding to the opposition.
  const r = record();
  for (const id of ["p1", "p2", "p3", "p4"]) {
    applyVote(r, { voterId: id, aye: true, weight: 99 });
  }
  assertEquals(r.ayesWeight >= PEER_CONSENSUS_MIN_WEIGHT, true);

  applyVote(r, { voterId: "p4", aye: false, weight: 99 });
  // Its support is withdrawn, not duplicated: 3 × 99 = 297, below the bar.
  assertEquals(r.ayesWeight, 297);
  assertEquals(r.naysWeight, 99);
  assertEquals(r.ayes.size, 3);
  assertEquals(r.nays.size, 1);
});

Deno.test("repeating the same position changes nothing", () => {
  const r = record();
  applyVote(r, { voterId: "peer-a", aye: true, weight: 50 });
  const again = applyVote(r, { voterId: "peer-a", aye: true, weight: 50 });
  assertEquals(again.counted, false);
  assertEquals(again.switched, false);
  assertEquals([r.ayesWeight, r.naysWeight], [50, 0]);
  assertEquals(r.ayes.size, 1);
});

Deno.test("a tally can never be driven negative by an inconsistent weight", () => {
  // Weight is recomputed per vote from live liveness data, so a switch can
  // legitimately arrive with a different weight than the original vote. That
  // must not underflow a total into making `ayesWeight > naysWeight` true.
  const r = record();
  applyVote(r, { voterId: "peer-a", aye: true, weight: 10 });
  applyVote(r, { voterId: "peer-a", aye: false, weight: 99 });
  assertEquals(r.ayesWeight, 0);
  assertEquals(r.naysWeight, 99);
});

Deno.test("only a verified signature earns oracle attribution", () => {
  const r = record();
  // Same peer, same vote, no authenticOracle — peer weight only.
  applyVote(r, { voterId: "peer-a", aye: true, weight: 100 });
  assertEquals(r.oracleAyes, undefined);

  applyVote(r, {
    voterId: "peer-b",
    aye: true,
    weight: 100,
    authenticOracle: "claude",
    reasoning: "because X",
  });
  assertEquals([...r.oracleAyes!], ["claude"]);
  assertEquals(r.oracleReasoning!["claude"], "because X");
});

Deno.test("an oracle switching sides moves its seat rather than occupying both", () => {
  const r = record();
  applyVote(r, {
    voterId: "peer-a",
    aye: true,
    weight: 100,
    authenticOracle: "claude",
  });
  applyVote(r, {
    voterId: "peer-a",
    aye: false,
    weight: 100,
    authenticOracle: "claude",
  });
  assertEquals([...r.oracleAyes!], []);
  assertEquals([...r.oracleNays!], ["claude"]);
});

Deno.test("three signed oracles carry a proposal, and the outcome says which path", () => {
  const r = record();
  for (const name of ["claude", "codex", "gemini"]) {
    const out = applyVote(r, {
      voterId: `peer-${name}`,
      aye: true,
      weight: 100,
      authenticOracle: name,
    });
    if (name === "gemini") {
      assertEquals(out.verdict.accepted, true);
      assertEquals(out.verdict.via, "ORACLE");
    }
  }
});
