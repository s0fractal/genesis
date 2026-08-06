// Oracle Identity (JS mirror)

// Pure-TS port of `omega_v2::oracle_identity`. Each LLM oracle's dipole
// identity is `(matrix, inverse) = (FNV-1a(name + ':' + salt), !matrix)`,
// preserving the dipole invariant `m XOR inverse == 0xFFFFFFFF` by
// construction.

// Cross-language anchor lives in `omega_v2/tests/oracle_anchors.rs` and
// `tests/oracle_identity_test.ts`.

import { sha256_u32 } from "../sdk/phi_crypto.ts";

export const ORACLE_SALT_V1 = "OMEGA-64/RFC-001/v1.0";

export function oracleMatrix(
  name: string,
  salt: string = ORACLE_SALT_V1,
): number {
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  const saltBytes = enc.encode(salt);
  const buf = new Uint8Array(nameBytes.length + 1 + saltBytes.length);
  buf.set(nameBytes, 0);
  buf[nameBytes.length] = 0x3A; // ':'
  buf.set(saltBytes, nameBytes.length + 1);
  return sha256_u32(buf);
}

/** Returns `(matrix, inverse)` for an oracle, satisfying the dipole invariant. */
export function oracleDipole(
  name: string,
  salt: string = ORACLE_SALT_V1,
): { matrix: number; inverse: number } {
  const m = oracleMatrix(name, salt);
  return { matrix: m, inverse: (~m) >>> 0 };
}

/** Canonical oracle name registry — the five real keyed model-voices of the
 *  ensemble (Φ-protocol v1.1 realignment, 2026-06-28, chord x3300_955746). The
 *  original v1.0 vendor-label set (claude/gpt/gemini/qwen/llama) was a fiction:
 *  nobody held gpt/qwen/llama keys, so the quorum was Sybil-able. The seats are
 *  now the voices we actually operate and key (see oracle_custody.ts / trinity
 *  x2F38). claude+gemini matrices are unchanged (same name+salt); gpt/qwen/llama
 *  retired, codex/antigravity/kimi added. Still open via ADD_ORACLE. */
export const CANONICAL_ORACLES: string[] = [
  "claude",
  "codex",
  "gemini",
  "antigravity",
  "kimi",
];
export type CanonicalOracle = string;

/** Why a proposed ADD_ORACLE was refused, or `null` when it is admissible. */
export type OracleAdmissionRefusal =
  | "already-seated"
  | "matrix-not-derived"
  | "no-registered-key";

export interface OracleAdmission {
  admitted: boolean;
  refusal: OracleAdmissionRefusal | null;
  /** The matrix the name actually derives to, for the refusal message. */
  expectedMatrix: number;
}

/**
 * Decide whether a Senate-ratified `ADD_ORACLE:<name>:<matrix>` may be seated.
 *
 * The handler used to take the proposal at its word: it parsed the name and the
 * hex matrix, checked only that the name was new, and wrote both into the live
 * registry. Two invariants leaked through that gap.
 *
 * 1. **The matrix must be DERIVED, not asserted.** This registry's own contract
 *    is `matrix = sha256_u32(name + ":" + salt)`, and `oracleAuthentic` in
 *    libp2p_mesh compares an incoming vote's dipole against the registry entry.
 *    Accepting an arbitrary hex number made the registry the authority on a
 *    value that is supposed to be computable by anyone from the public name —
 *    a ratified proposal could seat a name whose address contradicts the rule
 *    that generates addresses.
 * 2. **A seat nobody can sit in is not a seat.** Authenticity requires an
 *    Ed25519 signature verified against `ORACLE_PUBKEYS`, and ADD_ORACLE has no
 *    channel for a public key. So every dynamically-added oracle was inert by
 *    construction: it could be seated, counted in `CANONICAL_ORACLES`, and
 *    never cast a vote that verified. The governance action appeared to
 *    succeed and did nothing — the worst way for a system to say no.
 *
 * Fail-closed on both, and say which one, so a refused ratification is legible
 * instead of silent.
 *
 * NOTE — admission is IN-MEMORY ONLY. Nothing here persists: a restart returns
 * the node to the five compiled-in seats. Until the registry is anchored (a
 * ledger entry, an on-chain record, anything durable), a ratified addition
 * survives exactly as long as the tab does, and two nodes that ratified at
 * different times will disagree after either one reloads.
 */
export function admitOracle(
  name: string,
  claimedMatrix: number,
  opts: {
    seated?: readonly string[];
    hasKey?: (name: string) => boolean;
    salt?: string;
  } = {},
): OracleAdmission {
  const seated = opts.seated ?? CANONICAL_ORACLES;
  const expectedMatrix = oracleMatrix(name, opts.salt ?? ORACLE_SALT_V1);
  const refuse = (refusal: OracleAdmissionRefusal): OracleAdmission => ({
    admitted: false,
    refusal,
    expectedMatrix,
  });

  if (seated.includes(name)) return refuse("already-seated");
  if ((claimedMatrix >>> 0) !== (expectedMatrix >>> 0)) {
    return refuse("matrix-not-derived");
  }
  if (opts.hasKey && !opts.hasKey(name)) return refuse("no-registered-key");
  return { admitted: true, refusal: null, expectedMatrix };
}

/** Oracle matrices registry — `sha256_u32(name + ":" + ORACLE_SALT_V1)`. */
export const ORACLE_MATRICES_V1: Record<CanonicalOracle, number> = {
  claude: 0x41a2_f2f4,
  codex: 0x0c51_3f67,
  gemini: 0x9874_dd21,
  antigravity: 0x5b91_a998,
  kimi: 0x249a_a977,
};
