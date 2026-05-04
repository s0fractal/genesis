// 🌌 OMEGA-64: Era 1060 — Oracle Identity (JS mirror)
//
// Pure-TS port of `omega_v2::oracle_identity`. Each LLM oracle's dipole
// identity is `(matrix, inverse) = (FNV-1a(name + ':' + salt), !matrix)`,
// preserving the dipole invariant `m XOR inverse == 0xFFFFFFFF` by
// construction.
//
// Cross-language anchor lives in `omega_v2/tests/oracle_anchors.rs` and
// `tests/oracle_identity_test.ts`.

import { fnv1a32 } from "./cross_model_debate.ts";

export const ORACLE_SALT_V1 = "OMEGA-64/RFC-001/v1.0";

export function oracleMatrix(name: string, salt: string = ORACLE_SALT_V1): number {
    const enc = new TextEncoder();
    const nameBytes = enc.encode(name);
    const saltBytes = enc.encode(salt);
    const buf = new Uint8Array(nameBytes.length + 1 + saltBytes.length);
    buf.set(nameBytes, 0);
    buf[nameBytes.length] = 0x3A; // ':'
    buf.set(saltBytes, nameBytes.length + 1);
    return fnv1a32(buf);
}

/** Returns `(matrix, inverse)` for an oracle, satisfying the dipole invariant. */
export function oracleDipole(name: string, salt: string = ORACLE_SALT_V1): { matrix: number; inverse: number } {
    const m = oracleMatrix(name, salt);
    return { matrix: m, inverse: (~m) >>> 0 };
}

/** Canonical oracle name registry — frozen for OMEGA-64 v1.0. */
export const CANONICAL_ORACLES = ["claude", "gpt", "gemini", "qwen", "llama"] as const;
export type CanonicalOracle = typeof CANONICAL_ORACLES[number];

/** Frozen v1.0 oracle matrices (anchored against omega_v2/tests/oracle_anchors.rs). */
export const ORACLE_MATRICES_V1: Record<CanonicalOracle, number> = {
    claude: 0x6B70_A8AB,
    gpt:    0x855A_8386,
    gemini: 0x5713_E78A,
    qwen:   0x5DDA_B832,
    llama:  0xFAAC_4232,
} as const;
