// 🌌 OMEGA-64: Era 1060 — Oracle Identity (JS mirror)
//
// Pure-TS port of `omega_v2::oracle_identity`. Each LLM oracle's dipole
// identity is `(matrix, inverse) = (FNV-1a(name + ':' + salt), !matrix)`,
// preserving the dipole invariant `m XOR inverse == 0xFFFFFFFF` by
// construction.
//
// Cross-language anchor lives in `omega_v2/tests/oracle_anchors.rs` and
// `tests/oracle_identity_test.ts`.

export const ORACLE_SALT_V1 = "OMEGA-64/RFC-001/v1.0";

/** FNV-1a 32-bit over `name + ':' + salt`. */
export function oracleMatrix(name: string, salt: string = ORACLE_SALT_V1): number {
    let h = 0x811C_9DC5 >>> 0;
    const enc = new TextEncoder();
    const nameBytes = enc.encode(name);
    const saltBytes = enc.encode(salt);
    for (let i = 0; i < nameBytes.length; i++) {
        h = (h ^ nameBytes[i]) >>> 0;
        h = Math.imul(h, 0x0100_0193) >>> 0;
    }
    h = (h ^ 0x3A) >>> 0; // ':' separator (0x3A)
    h = Math.imul(h, 0x0100_0193) >>> 0;
    for (let i = 0; i < saltBytes.length; i++) {
        h = (h ^ saltBytes[i]) >>> 0;
        h = Math.imul(h, 0x0100_0193) >>> 0;
    }
    return h >>> 0;
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
