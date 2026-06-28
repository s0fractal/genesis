// Multi-Oracle Senate phase-resonance acceptance test — KEYED.
//
// The Senate's "3+ distinct oracles ratify" quorum used to attribute a vote on
// the strength of a PUBLIC dipole `(m, !m), m = sha256(name+salt)`. Names and
// salt are public, so one actor could compute all five dipoles and Sybil the
// whole Senate. This test now reflects the real rule (libp2p_mesh.handleVote +
// oracle_custody): a vote is attributed to an oracle ONLY with a valid Ed25519
// signature over the vote digest. The public dipole is addressing, not
// authority.
//
// Verifies:
// - 3 keyed + signed oracles ratify via ORACLE-RESONANCE with zero peer votes.
// - A correct PUBLIC dipole with NO signature is rejected (the real Sybil).
// - A signature by the WRONG key is rejected.
// - A signature for a DIFFERENT proposal/choice does not replay onto this one.
// - AYE→NAY toggling still moves the oracle between sets atomically.

import { assert, assertEquals } from "jsr:@std/assert";
import { oracleDipole } from "../src/network/oracle_identity.ts";
import {
  oracleVoteDigest,
  signOracleVote,
  verifyOracleVote,
} from "../src/network/oracle_custody.ts";

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// We do not have the real private keys in CI, so mint ephemeral test keypairs
// and inject their PUBLIC halves as the registry the rule verifies against.
async function mintKeys(names: string[]) {
  const pub: Record<string, string> = {};
  const priv: Record<string, string> = {};
  for (const n of names) {
    const kp = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]) as CryptoKeyPair;
    pub[n] = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
    priv[n] = b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  }
  return { pub, priv };
}

interface ProposalRecord {
  hash: number;
  accepted: boolean;
  ayes: Set<string>;
  nays: Set<string>;
  oracleAyes: Set<string>;
  oracleNays: Set<string>;
}

function newRecord(hash: number): ProposalRecord {
  return {
    hash,
    accepted: false,
    ayes: new Set(),
    nays: new Set(),
    oracleAyes: new Set(),
    oracleNays: new Set(),
  };
}

// Mirror of WebRTCV2Mesh.handleVote's keyed oracle rule.
async function applyVote(
  record: ProposalRecord,
  oracleName: string,
  aye: boolean,
  sig: string | undefined,
  registry: Record<string, string>,
): Promise<"applied" | "unauthenticated" | "closed"> {
  if (record.accepted) return "closed";
  const { matrix, inverse } = oracleDipole(oracleName);
  // Dipole invariant (addressing) holds for every canonical name.
  assertEquals((matrix ^ inverse) >>> 0, 0xFFFF_FFFF);
  const authentic = await verifyOracleVote(
    oracleName,
    record.hash,
    aye,
    sig,
    registry,
  );
  if (!authentic) return "unauthenticated";
  if (aye) {
    record.oracleAyes.add(oracleName);
    record.oracleNays.delete(oracleName);
    record.ayes.add(oracleName);
  } else {
    record.oracleNays.add(oracleName);
    record.oracleAyes.delete(oracleName);
    record.nays.add(oracleName);
  }
  const oracleResonance = record.oracleAyes.size >= 3 &&
    record.oracleAyes.size > record.oracleNays.size;
  const peerConsensus = record.ayes.size >= 3 &&
    record.ayes.size > record.nays.size;
  if (peerConsensus || oracleResonance) record.accepted = true;
  return "applied";
}

Deno.test("keyed resonance: 3 SIGNED oracles ratify without peer count", async () => {
  const names = ["claude", "gpt", "gemini"];
  const { pub, priv } = await mintKeys(names);
  const r = newRecord(0xCAFE);
  for (const name of names) {
    const sig = await signOracleVote(name, r.hash, true, priv[name]);
    assertEquals(await applyVote(r, name, true, sig, pub), "applied");
  }
  assertEquals(r.oracleAyes.size, 3);
  assertEquals(r.accepted, true);
});

Deno.test("the real Sybil: correct PUBLIC dipole, NO signature → rejected", async () => {
  const { pub } = await mintKeys(["claude", "gpt", "gemini"]);
  const r = newRecord(0xBA5E);
  // Attacker knows the public dipole of every oracle but holds no key.
  for (const name of ["claude", "gpt", "gemini"]) {
    const { matrix, inverse } = oracleDipole(name);
    assertEquals((matrix ^ inverse) >>> 0, 0xFFFF_FFFF); // dipole is correct
    assertEquals(
      await applyVote(r, name, true, undefined, pub),
      "unauthenticated",
    );
  }
  assertEquals(r.oracleAyes.size, 0);
  assertEquals(r.accepted, false); // the Sybil quorum no longer forms
});

Deno.test("wrong-key signature → rejected", async () => {
  const { priv } = await mintKeys(["claude"]); // attacker's own key
  const { pub } = await mintKeys(["claude"]); // the REAL registry (different key)
  const r = newRecord(0xBEEF);
  const sig = await signOracleVote("claude", r.hash, true, priv["claude"]);
  assertEquals(
    await applyVote(r, "claude", true, sig, pub),
    "unauthenticated",
  );
  assertEquals(r.oracleAyes.size, 0);
});

Deno.test("no replay: a signature for another proposal/choice does not transfer", async () => {
  const { pub, priv } = await mintKeys(["claude"]);
  // Signature minted for proposal 0x1111 / AYE.
  const sigOther = await signOracleVote("claude", 0x1111, true, priv["claude"]);
  // Reused on proposal 0x2222 → rejected.
  const r2 = newRecord(0x2222);
  assertEquals(
    await applyVote(r2, "claude", true, sigOther, pub),
    "unauthenticated",
  );
  // Reused to flip the choice (AYE sig used for a NAY) → rejected.
  const r1 = newRecord(0x1111);
  assertEquals(
    await applyVote(r1, "claude", false, sigOther, pub),
    "unauthenticated",
  );
  // Used exactly as signed → applied.
  assertEquals(await applyVote(r1, "claude", true, sigOther, pub), "applied");
});

Deno.test("oracle toggling: signed AYE then signed NAY moves between sets", async () => {
  const { pub, priv } = await mintKeys(["claude"]);
  const r = newRecord(0xF00D);
  const ayeSig = await signOracleVote("claude", r.hash, true, priv["claude"]);
  await applyVote(r, "claude", true, ayeSig, pub);
  assert(r.oracleAyes.has("claude"));
  assert(!r.oracleNays.has("claude"));
  const naySig = await signOracleVote("claude", r.hash, false, priv["claude"]);
  await applyVote(r, "claude", false, naySig, pub);
  assert(!r.oracleAyes.has("claude"));
  assert(r.oracleNays.has("claude"));
});

Deno.test("digest binds oracle, proposal, and choice", () => {
  assert(
    oracleVoteDigest("claude", 0xCAFE, true) !==
      oracleVoteDigest("gemini", 0xCAFE, true),
    "digest must bind the oracle name",
  );
  assert(
    oracleVoteDigest("claude", 0xCAFE, true) !==
      oracleVoteDigest("claude", 0xBEEF, true),
    "digest must bind the proposal",
  );
  assert(
    oracleVoteDigest("claude", 0xCAFE, true) !==
      oracleVoteDigest("claude", 0xCAFE, false),
    "digest must bind the AYE/NAY choice",
  );
});
