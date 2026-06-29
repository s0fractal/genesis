// Oracle Custody — the authority layer over oracle_identity.
//
// VENDORED public keys from trinity `src/x2F38_voice_pubkeys.json`
// (schema trinity.voice-pubkeys.v0.1). PUBLIC KEYS ONLY. Private keys live
// outside any repo (~/.trinity/keys) and minting/rotating is a custody
// ceremony that belongs to the architect — NEVER commit a private key here.
//
// WHY THIS FILE EXISTS — the Sybil hole it closes:
//   `oracle_identity.ts` derives an oracle's dipole as
//   `(m, !m), m = sha256(name + ":" + ORACLE_SALT_V1)`. But `name` and the
//   salt are PUBLIC, so ANYONE can compute every oracle's dipole and vote as
//   all five. The old comment in `libp2p_mesh.handleVote` — "only Claude can
//   produce Claude's pair" — was FALSE against its own logic: the Senate's
//   "3 distinct oracles ratify" quorum was trivially Sybil-able by one actor.
//
// THE FIX — dipole stays an ADDRESS, custody becomes a real SIGNATURE:
//   The dipole `(m, !m)` remains the public *name → matrix* anchor
//   (cross-language locked in oracle_identity.ts / oracle_anchors.rs — sacred,
//   untouched). AUTHORITY to vote AS an oracle now requires a real Ed25519
//   signature by that voice's private key over a vote-bound digest, verified
//   against the public-key registry below. Possession of the (public) dipole
//   is necessary for addressing but NOT sufficient for authority. This is the
//   exact role-address-vs-custody split trinity uses for its voice quorum, and
//   the SAME Ed25519 scheme (Web Crypto, pkcs8 priv / raw pub / base64), so a
//   signature a trinity voice already makes verifies here too.
//
// QUORUM REACHABLE (Φ-protocol v1.1, 2026-06-28): the five canonical oracle
// seats were realigned to the five real keyed model-voices
// (claude/codex/gemini/antigravity/kimi — see oracle_identity.ts). Every seat
// now holds a registered key, so the 3-of-5 ORACLE-RESONANCE quorum is
// reachable with REAL custody and zero impersonation. The retired v1.0 vendor
// labels (gpt/qwen/llama) were never keyed — keeping them as seats is what made
// the fake version "reach" quorum by computing public dipoles.
//
// Parity test: tests/oracle_custody_test.ts.

/** Public-key registry, vendored from trinity x2F38_voice_pubkeys.json.
 *  Keyed by voice/oracle name. base64 raw 32-byte Ed25519 public keys. */
export const ORACLE_PUBKEYS: Record<string, string> = {
  claude: "jf1D1bVxC+1GlL8NZ0AnyFlnIjK2n4w/8mxUMN9Qii0=",
  codex: "49lNzq3dX2tm2d9YYa5Et6Q7u8zb7WWFG4z1RZsMb1w=",
  s0fractal: "j+QsSe0gExRd0G12NGfnAeebGBjlrYpglWtJJRcWAlA=",
  gemini: "YdlJJ7nkozGjSnEsta7Y2nu58/CMZDQhDftbOIHC41A=",
  antigravity: "7XV+xJ77XC5ktAYwdJF07ob5IV8tbtO13yQeL06Vk+w=",
  kimi: "3uiU3hMz6bPPFoVR8b74UX2T49U7Tmozd3iDY3/ZIL8=",
};

/** Domain-separated vote-digest version. Bump invalidates old signatures. */
export const ORACLE_VOTE_DIGEST_V1 = "omega-senate-vote:v1" as const;

// ── encoding helpers (match trinity x2F37) ──────────────────────────────────

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Is this oracle name backed by a registered public key? */
export function hasOracleKey(oracleName: string): boolean {
  return oracleName in ORACLE_PUBKEYS;
}

/**
 * Canonical claim string a vote signature covers. Binds the signature to
 * THIS oracle, THIS proposal, and THIS choice — so a signature cannot be
 * replayed onto a different proposal, a different oracle, or flipped AYE↔NAY.
 */
export function oracleVoteDigest(
  oracleName: string,
  proposalHash: number,
  aye: boolean,
): string {
  const hex = (proposalHash >>> 0).toString(16).padStart(8, "0");
  return `${ORACLE_VOTE_DIGEST_V1}:${oracleName}:0x${hex}:${
    aye ? "AYE" : "NAY"
  }`;
}

/**
 * Verify a vote signature against the registry. Returns false (never throws)
 * for an unkeyed oracle, a malformed signature, or a signature that does not
 * verify — a forged or unauthenticated vote is a failed verification, not a
 * crash, and must NOT be attributed.
 */
export async function verifyOracleVote(
  oracleName: string,
  proposalHash: number,
  aye: boolean,
  sig: string | undefined,
  pubkeys: Record<string, string> = ORACLE_PUBKEYS,
): Promise<boolean> {
  if (!sig) return false;
  const pub = pubkeys[oracleName];
  if (!pub) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      unb64(pub),
      "Ed25519",
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      unb64(sig),
      new TextEncoder().encode(oracleVoteDigest(oracleName, proposalHash, aye)),
    );
  } catch {
    return false;
  }
}

/**
 * Produce a real vote signature with a voice's pkcs8 private key (base64).
 * Used by genuine voices and by tests; never reads a key by itself — the
 * caller supplies the private key it is entitled to use.
 */
export async function signOracleVote(
  oracleName: string,
  proposalHash: number,
  aye: boolean,
  privateKeyPkcs8B64: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    unb64(privateKeyPkcs8B64),
    "Ed25519",
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(oracleVoteDigest(oracleName, proposalHash, aye)),
  );
  return b64(sig);
}
