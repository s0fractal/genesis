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

/** Oracle matrices registry — `sha256_u32(name + ":" + ORACLE_SALT_V1)`. */
export const ORACLE_MATRICES_V1: Record<CanonicalOracle, number> = {
  claude: 0x41a2_f2f4,
  codex: 0x0c51_3f67,
  gemini: 0x9874_dd21,
  antigravity: 0x5b91_a998,
  kimi: 0x249a_a977,
};
