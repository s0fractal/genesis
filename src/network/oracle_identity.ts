// 🌌 OMEGA-64: Era 1060 — Oracle Identity (JS mirror)
//
// Pure-TS port of `omega_v2::oracle_identity`. Each LLM oracle's dipole
// identity is `(matrix, inverse) = (FNV-1a(name + ':' + salt), !matrix)`,
// preserving the dipole invariant `m XOR inverse == 0xFFFFFFFF` by
// construction.
//
// Cross-language anchor lives in `omega_v2/tests/oracle_anchors.rs` and
// `tests/oracle_identity_test.ts`.

import { sha256_u32 } from "../sdk/phi_crypto.ts";

export const ORACLE_SALT_V1 = "OMEGA-64/RFC-001/v1.0";

/** SHA-256 32-bit truncated over `name + ':' + salt`. */
export function oracleMatrix(name: string, salt: string = ORACLE_SALT_V1): number {
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
export function oracleDipole(name: string, salt: string = ORACLE_SALT_V1): { matrix: number; inverse: number } {
    const m = oracleMatrix(name, salt);
    return { matrix: m, inverse: (~m) >>> 0 };
}

/** Canonical oracle name registry — frozen for OMEGA-64 v1.0. */
export const CANONICAL_ORACLES = ["claude", "gpt", "gemini", "qwen", "llama"] as const;
export type CanonicalOracle = typeof CANONICAL_ORACLES[number];

/** Frozen v1.0 oracle matrices (anchored against omega_v2/tests/oracle_anchors.rs). */
export const ORACLE_MATRICES_V1: Record<CanonicalOracle, number> = {
    claude: 0x41A2_F2F4,
    gpt:    0x89B1_222A,
    gemini: 0x9874_DD21,
    qwen:   0x6E52_1F4E,
    llama:  0x3A52_38EF,
} as const;
