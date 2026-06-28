// oracle_custody_test.ts — the vote-authority layer is REAL and interoperable.
//
// Locks:
//  - sign → verify roundtrip with a real Ed25519 keypair;
//  - the vendored registry holds exactly the trinity voice set, public-only;
//  - unkeyed omega oracles (gpt/qwen/llama) cannot be authenticated — the
//    honest limit that omega's 3-of-5 oracle resonance is not yet reachable;
//  - registry PARITY with trinity src/x2F38_voice_pubkeys.json when present
//    (omega runs as a submodule under trinity), so a signature a trinity voice
//    makes verifies in omega and vice-versa. Skips gracefully when standalone.

import { assert, assertEquals } from "jsr:@std/assert";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import {
  hasOracleKey,
  ORACLE_PUBKEYS,
  signOracleVote,
  verifyOracleVote,
} from "../src/network/oracle_custody.ts";
import { CANONICAL_ORACLES } from "../src/network/oracle_identity.ts";

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

Deno.test("sign → verify roundtrip against an injected registry", async () => {
  const kp = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]) as CryptoKeyPair;
  const pub = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
  const priv = b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const reg = { claude: pub };
  const sig = await signOracleVote("claude", 0xABCD, true, priv);
  assert(await verifyOracleVote("claude", 0xABCD, true, sig, reg));
  // tampered choice / proposal / oracle all fail
  assert(!(await verifyOracleVote("claude", 0xABCD, false, sig, reg)));
  assert(!(await verifyOracleVote("claude", 0x9999, true, sig, reg)));
  assert(!(await verifyOracleVote("gemini", 0xABCD, true, sig, reg)));
});

Deno.test("malformed signature is a failed verification, not a crash", async () => {
  assertEquals(
    await verifyOracleVote("claude", 0x1, true, "not-base64!!", {
      claude: ORACLE_PUBKEYS.claude,
    }),
    false,
  );
  assertEquals(
    await verifyOracleVote("claude", 0x1, true, undefined),
    false,
  );
});

Deno.test("vendored registry is the trinity voice set, public keys only", () => {
  assertEquals(
    Object.keys(ORACLE_PUBKEYS).sort(),
    ["antigravity", "claude", "codex", "gemini", "kimi", "s0fractal"],
  );
  for (const [name, pk] of Object.entries(ORACLE_PUBKEYS)) {
    // base64 of a raw 32-byte Ed25519 public key is 44 chars; never a pkcs8
    // private key (which is far longer). Guards against committing a secret.
    assertEquals(pk.length, 44, `${name} pubkey is not a raw 32-byte key`);
  }
});

Deno.test("milestone: every canonical oracle is keyed → 3-of-5 reachable", () => {
  // Φ-protocol v1.1: the five seats ARE the five real keyed model-voices, so
  // every canonical oracle can now cast an authenticated vote and the
  // ORACLE-RESONANCE quorum is reachable with real custody (no impersonation).
  for (const oracle of CANONICAL_ORACLES) {
    assert(hasOracleKey(oracle), `canonical oracle ${oracle} must be keyed`);
  }
  assert(CANONICAL_ORACLES.length >= 3, "need ≥3 seats for resonance");
  // The retired vendor labels are no longer oracles and hold no key.
  assert(!hasOracleKey("gpt"));
  assert(!hasOracleKey("llama"));
});

Deno.test("registry parity with trinity x2F38 (when running as submodule)", async () => {
  // omega/ → trinity/ is two levels up from this test file's dir.
  const trinityRegistry = join(
    dirname(dirname(dirname(fromFileUrl(import.meta.url)))),
    "src",
    "x2F38_voice_pubkeys.json",
  );
  let raw: string;
  try {
    raw = await Deno.readTextFile(trinityRegistry);
  } catch {
    console.warn(
      "trinity x2F38 registry not found (standalone checkout) — skipping parity",
    );
    return;
  }
  const parsed = JSON.parse(raw) as {
    keys: Record<string, { pubkey: string }>;
  };
  for (const [voice, pk] of Object.entries(ORACLE_PUBKEYS)) {
    assertEquals(
      parsed.keys[voice]?.pubkey,
      pk,
      `vendored ${voice} pubkey drifted from trinity x2F38 — re-vendor`,
    );
  }
});
