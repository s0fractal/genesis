// Genesis Inscription (JS mirror)

// Pure-TS port of `omega_v2::genesis_inscription`. The frozen
// `GENESIS_HASH_LEGACY_V1_0 = 0x716ea2f8` constant below MUST equal the value
// computed by the Rust kernel for any conforming implementation.

// History: the pre-2026-05-04 anchor set produced `0x549a6307`, the value the
// v1.0 RFC froze on paper — but it was never inscribed on-chain, and the Rust
// anchors drifted in e8b685e ("Refactor Translation Policy recursion"). On
// 2026-07-26 the federation canonized the Rust-computed value `0x716ea2f8`
// (ledger model: the hash is a fingerprint of the live anchor set; only a
// Bitcoin inscription canonizes a value permanently).

// Cross-language anchor lives in `omega_v2/src/genesis_inscription.rs`
// (`anchors_v1_0_match_other_modules` test), `tests/genesis_inscription_test.ts`,
// and the drift lock `tests/genesis_cross_lang_lock_test.ts` (parses the Rust
// source — any future anchor drift fails LOUDLY in both languages).
import { sha256_hash } from "../sdk/phi_crypto.ts";

export const PROTOCOL_VERSION = "OMEGA-64/RFC-001/v1.0";
export const DIPOLE_INVARIANT = 0xFFFF_FFFF >>> 0;
export const TOROIDAL_MODULUS = 256;

/** The five non-negotiable invariants of OMEGA-64 v1.0. */
export interface GenesisAnchors {
  senateHashEmpty: number;
  senateHashShort: number;
  firstProposalHash: number;
  mitosisReceiptNoAttr: number;
  mitosisReceiptAttr: number;
}

export const ANCHORS_V1_0: GenesisAnchors = {
  senateHashEmpty: 0xF5A5_FD42,
  senateHashShort: 0x1530_2EC1,
  firstProposalHash: 0x3008_3117,
  mitosisReceiptNoAttr: 0xF73D_B063,
  mitosisReceiptAttr: 0x8C3A_C082,
} as const;

function pushU32BE(buf: number[], v: number) {
  buf.push((v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF);
}

/**
 * FNV-1a 32-bit (offset basis 2166136261, prime 16777619).
 *
 * This function was called `sha256_u32` until an outside reviewer read the
 * tree and reported, reasonably, that OMEGA-64 signs FNV output as SHA-256.
 * The review's conclusion was wrong — the EXPORTED `sha256_u32` in
 * `sdk/phi_crypto.ts` is a genuine truncated SHA-256, matching Rust
 * `crypto.rs`, and it is the one every other module imports — but the name
 * here was indefensible, and a reader who had to open the body to learn the
 * algorithm was one honest mistake away from building a wrong client.
 *
 * FNV is nonetheless CORRECT here and must not be "upgraded": the legacy u32
 * genesis hash is defined as the FNV-1a of the anchor buffer, mirroring the
 * const-eval loop in `omega_v2/src/genesis_inscription.rs`. That value is
 * frozen at 0x716ea2f8 and pinned by a cross-language drift lock. Changing the
 * algorithm would change the genesis, not fix it. The real SHA-256 inscription
 * is `computeGenesisHashSha256` below, which is a separate, additional anchor.
 */
function fnv1a_u32(bytes: number[] | Uint8Array): number {
  let h = 0x811C_9DC5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ bytes[i]) >>> 0;
    h = Math.imul(h, 0x0100_0193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Compute the legacy u32 Genesis Inscription for a given anchor set — FNV-1a,
 * not SHA-256. Mirrors `omega_v2::genesis_inscription::compute_genesis_hash`
 * byte-for-byte. For the SHA-256 anchor see `computeGenesisHashSha256`.
 */
export function computeGenesisHash(a: GenesisAnchors): number {
  const buf: number[] = [];
  const enc = new TextEncoder();
  const ver = enc.encode(PROTOCOL_VERSION);
  for (const b of ver) buf.push(b);
  pushU32BE(buf, a.senateHashEmpty >>> 0);
  pushU32BE(buf, a.senateHashShort >>> 0);
  pushU32BE(buf, a.firstProposalHash >>> 0);
  pushU32BE(buf, a.mitosisReceiptNoAttr >>> 0);
  pushU32BE(buf, a.mitosisReceiptAttr >>> 0);
  pushU32BE(buf, DIPOLE_INVARIANT);
  pushU32BE(buf, TOROIDAL_MODULUS);
  return fnv1a_u32(buf);
}

/** Compute the canonical SHA-256 Genesis Inscription for OMEGA-64 v1.0. */
export function computeGenesisHashSha256(a: GenesisAnchors): Uint8Array {
  const buf: number[] = [];
  const enc = new TextEncoder();
  const ver = enc.encode(PROTOCOL_VERSION);
  for (const b of ver) buf.push(b);
  pushU32BE(buf, a.senateHashEmpty >>> 0);
  pushU32BE(buf, a.senateHashShort >>> 0);
  pushU32BE(buf, a.firstProposalHash >>> 0);
  pushU32BE(buf, a.mitosisReceiptNoAttr >>> 0);
  pushU32BE(buf, a.mitosisReceiptAttr >>> 0);
  pushU32BE(buf, DIPOLE_INVARIANT);
  pushU32BE(buf, TOROIDAL_MODULUS);
  return sha256_hash(new Uint8Array(buf));
}

/** The legacy FNV-1a Genesis Hash — must equal what the Rust kernel computes. */
export const GENESIS_HASH_LEGACY_V1_0 = 0x716E_A2F8;

/** Format a hash as the canonical `OMEGA1:xxxxxxxx` OP_RETURN payload. */
export function formatInscription(hash: number): string {
  return `OMEGA1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Verify that a runtime-computed hash matches the v1.0 anchor.
 * Returns true iff the local environment reproduces the canonical genesis.
 */
export function verifyGenesisV1(): boolean {
  return computeGenesisHash(ANCHORS_V1_0) === GENESIS_HASH_LEGACY_V1_0;
}
