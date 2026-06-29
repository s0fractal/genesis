// Self-contained tests for the shared chord verifier (src/network/chord_verify.ts).
// No trinity/src dependency (omega CI clones standalone): we mint a key, sign a
// chord, and verify it against an inline registry — exercising the exact scheme
// the relay (store) and client (get/fetch) rely on.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  chordPayloadHash,
  verifyChordWithRegistry,
} from "../src/network/chord_verify.ts";

const b64 = (u: ArrayBuffer | Uint8Array) => {
  const a = u instanceof Uint8Array ? u : new Uint8Array(u);
  let s = "";
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
};

/** Build a signed chord (frontmatter holds the content_sig; payload covers
 *  filename + "\n" + body, where body is everything after the frontmatter). */
async function signedChord(filename: string, body: string, voice: string) {
  const kp = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]) as CryptoKeyPair;
  const pub = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
  // payload is over (filename + "\n" + body); content_sig sits in frontmatter.
  const probe = `---\nx: y\n---\n${body}`;
  const payload = (await chordPayloadHash(filename, probe))!;
  const sig = b64(
    await crypto.subtle.sign(
      "Ed25519",
      kp.privateKey,
      new TextEncoder().encode(payload),
    ),
  );
  const full =
    `---\ntopic: t\ncontent_sig:\n  voice: ${voice}\n  alg: ed25519\n  payload: "${payload}"\n  sig: "${sig}"\n---\n${body}`;
  const registry = { keys: { [voice]: { alg: "ed25519", pubkey: pub } } };
  return { full, registry, pub };
}

const NAME = "xTEST_chord.myc.md";
const BODY = "# Test chord\n\nbody content that is signed over.\n";

Deno.test("a correctly-signed chord verifies VALID against its registry", async () => {
  const { full, registry } = await signedChord(NAME, BODY, "tester");
  const v = await verifyChordWithRegistry(NAME, full, registry);
  assertEquals(v.ok, true);
  assertEquals(v.voice, "tester");
});

Deno.test("tampering the body breaks verification (payload mismatch)", async () => {
  const { full, registry } = await signedChord(NAME, BODY, "tester");
  const tampered = full.replace("body content", "BODY CONTENT");
  const v = await verifyChordWithRegistry(NAME, tampered, registry);
  assertEquals(v.ok, false);
  assert(v.reason.includes("payload mismatch"));
});

Deno.test("a different filename breaks verification (name binds the address)", async () => {
  const { full, registry } = await signedChord(NAME, BODY, "tester");
  const v = await verifyChordWithRegistry("xOTHER.myc.md", full, registry);
  assertEquals(v.ok, false);
});

Deno.test("a voice absent from the registry fails closed", async () => {
  const { full } = await signedChord(NAME, BODY, "tester");
  const v = await verifyChordWithRegistry(NAME, full, { keys: {} });
  assertEquals(v.ok, false);
  assert(v.reason.includes("not in registry"));
});

Deno.test("an unsigned chord (no content_sig) is rejected", async () => {
  const v = await verifyChordWithRegistry(NAME, `---\ntopic: t\n---\n${BODY}`, {
    keys: {},
  });
  assertEquals(v.ok, false);
  assertEquals(v.reason, "no content_sig block");
});
