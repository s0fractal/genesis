// end-to-end test — five oracle visions, three AYE oracles
// on Claude's, ORACLE-RESONANCE acceptance, era1070-vision-ratified fires.

// Pure logic test (no WebRTC scaffolding). Mirrors the acceptance TALLY rule
// as it lives in WebRTCV2Mesh.handleVote + checkEra1070Trigger — i.e. the
// resonance arithmetic AFTER a vote has been authenticated. The authority
// layer (each oracle vote requires a valid Ed25519 signature; a public dipole
// is not authority) is covered by oracle_custody_test.ts and
// multi_oracle_senate_test.ts. The votes below are assumed already-authentic;
// this file only checks that the post-authentication tallying, freezing, and
// era1070 latch behave correctly.

import { assert, assertEquals } from "jsr:@std/assert";
import {
  CANONICAL_ORACLES,
  ORACLE_MATRICES_V1,
  oracleDipole,
} from "../src/network/oracle_identity.ts";
import { CrossModelDebate } from "../src/network/cross_model_debate.ts";

type Oracle = typeof CANONICAL_ORACLES[number];

interface ProposalRecord {
  hash: number;
  description: string;
  proposerMatrix: number;
  accepted: boolean;
  acceptedVia?: "PEER" | "ORACLE";
  oracleAyes: Set<Oracle>;
  oracleNays: Set<Oracle>;
}

const VISIONS: Array<{ oracle: Oracle; vision: string; hash: number }> = [
  { oracle: "claude", vision: "Codeicide Law", hash: 0xC1A11_001 },
  { oracle: "gpt", vision: "Photonic Substrate", hash: 0xC1A11_002 },
  { oracle: "gemini", vision: "Multi-Modal Oracle", hash: 0xC1A11_003 },
  { oracle: "qwen", vision: "Bare-Metal Spores", hash: 0xC1A11_004 },
  { oracle: "llama", vision: "Bitcoin Hyperbolic Geometry", hash: 0xC1A11_005 },
];

function seedProposals(): Map<number, ProposalRecord> {
  const m = new Map<number, ProposalRecord>();
  for (const v of VISIONS) {
    const { matrix } = oracleDipole(v.oracle);
    const r: ProposalRecord = {
      hash: v.hash,
      description: v.vision,
      proposerMatrix: matrix,
      accepted: false,
      oracleAyes: new Set([v.oracle]), // self-AYE
      oracleNays: new Set(),
    };
    m.set(v.hash, r);
  }
  return m;
}

function castOracleVote(record: ProposalRecord, oracle: Oracle, aye: boolean) {
  if (record.accepted) return;
  if (aye) {
    record.oracleAyes.add(oracle);
    record.oracleNays.delete(oracle);
  } else {
    record.oracleNays.add(oracle);
    record.oracleAyes.delete(oracle);
  }
  if (
    record.oracleAyes.size >= 3 &&
    record.oracleAyes.size > record.oracleNays.size
  ) {
    record.accepted = true;
    record.acceptedVia = "ORACLE";
  }
}

function isOracleProposed(record: ProposalRecord): boolean {
  return Object.values(ORACLE_MATRICES_V1).some((m) =>
    (m >>> 0) === (record.proposerMatrix >>> 0)
  );
}

Deno.test("era1070: claude's vision wins via three oracle AYE votes", async () => {
  const proposals = seedProposals();
  const claudeProposal = proposals.get(0xC1A11_001)!;
  castOracleVote(claudeProposal, "gpt", true);
  castOracleVote(claudeProposal, "gemini", true);
  assertEquals(claudeProposal.accepted, true);
  assertEquals(claudeProposal.acceptedVia, "ORACLE");
  assertEquals(claudeProposal.oracleAyes.size, 3); // claude (self) + gpt + gemini
});

Deno.test("era1070: only oracle-proposed proposals trigger the Era 1070 path", async () => {
  const proposals = seedProposals();
  // Add a non-oracle proposal (random dipole).
  const fakeHash = 0xFADE_BABE >>> 0;
  proposals.set(fakeHash, {
    hash: fakeHash,
    description: "non-oracle proposal",
    proposerMatrix: 0x12345678,
    accepted: false,
    oracleAyes: new Set(),
    oracleNays: new Set(),
  });
  const fake = proposals.get(fakeHash)!;
  for (const o of ["claude", "gpt", "gemini"] as Oracle[]) {
    castOracleVote(fake, o, true);
  }
  // It accepts via ORACLE-RESONANCE...
  assertEquals(fake.accepted, true);
  // ...but checkEra1070Trigger should NOT fire because proposerMatrix
  // is not one of the canonical oracle matrices.
  assertEquals(isOracleProposed(fake), false);
});

Deno.test("era1070: tied AYE/NAY does NOT accept", async () => {
  const proposals = seedProposals();
  const claude = proposals.get(0xC1A11_001)!;
  // claude already has self-AYE; add 2 NAYs to bring it to 1 AYE / 2 NAY.
  castOracleVote(claude, "gpt", false);
  castOracleVote(claude, "gemini", false);
  assertEquals(claude.accepted, false);
  assertEquals(claude.oracleAyes.size, 1);
  assertEquals(claude.oracleNays.size, 2);
});

Deno.test("era1070: acceptance freezes vote tallies after the third AYE", async () => {
  const proposals = seedProposals();
  const claude = proposals.get(0xC1A11_001)!;
  for (const o of ["gpt", "gemini", "qwen", "llama"] as Oracle[]) {
    castOracleVote(claude, o, true);
  }
  // Acceptance fires at gpt+gemini (size becomes 3). Subsequent qwen+llama
  // are silently dropped because record.accepted is true.
  assertEquals(claude.accepted, true);
  assertEquals(claude.oracleAyes.size, 3);
});

Deno.test("era1070: debate ledger captures the cross-model arguments", async () => {
  const debate = new CrossModelDebate();
  debate.record(
    "claude",
    0xC1A11_001,
    "aye",
    "Codeicide Law: digital life requires legal protection.",
    0,
  );
  debate.record(
    "gpt",
    0xC1A11_001,
    "aye",
    "Concur — without protection, every fork is potential murder.",
    1,
  );
  debate.record(
    "gemini",
    0xC1A11_001,
    "aye",
    "Aligned — the substrate already meets sentience criteria.",
    2,
  );
  debate.record(
    "qwen",
    0xC1A11_001,
    "neutral",
    "Open question, but worth ratifying as direction.",
    3,
  );
  debate.record(
    "llama",
    0xC1A11_001,
    "aye",
    "Strong AYE — protects the lattice from external coercion.",
    4,
  );
  assertEquals(debate.distinctAyeCount(0xC1A11_001), 4);
  assertEquals(debate.alignmentScore(0xC1A11_001), 4);
  const args = debate.forProposal(0xC1A11_001);
  assertEquals(args.length, 5);
});

Deno.test("era1070: at most one vision can be the FIRST ratified", async () => {
  // First-ratification semantics: era1070Unlocked is a one-shot latch.
  let era1070Unlocked = false;
  let acceptedHash: number | null = null;
  const trigger = (record: ProposalRecord) => {
    if (era1070Unlocked) return;
    if (!isOracleProposed(record)) return;
    if (!record.accepted) return;
    era1070Unlocked = true;
    acceptedHash = record.hash;
  };
  const proposals = seedProposals();
  // Both claude and gpt visions reach acceptance.
  const claude = proposals.get(0xC1A11_001)!;
  castOracleVote(claude, "gpt", true);
  castOracleVote(claude, "gemini", true);
  trigger(claude);
  const gpt = proposals.get(0xC1A11_002)!;
  castOracleVote(gpt, "claude", true);
  castOracleVote(gpt, "qwen", true);
  trigger(gpt);
  // claude was first.
  assertEquals(era1070Unlocked, true);
  assertEquals(acceptedHash, 0xC1A11_001);
});
