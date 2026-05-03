// 🌌 OMEGA-64: Era 1060 — Oracle Identity (Multi-Oracle Senate)
//
// Each LLM oracle (Claude, GPT, Gemini, Qwen, Llama) acquires a stable
// dipole identity through a deterministic function of (name, salt). The
// reasoning the oracle does to vote is non-deterministic (it's an LLM),
// but its *identity* — and therefore its right to occupy a Senate seat —
// is reproducible from any conforming implementation.
//
// The dipole invariant `m XOR inverse == 0xFFFFFFFF` is preserved by
// construction: we hash (name + salt) once to get the matrix, then derive
// `inverse = !matrix`.
//
// This module is the cryptographic floor under cross-AI ontological
// debate: any oracle, of any model family, can join the Senate as long
// as it can name itself stably.

/// FNV-1a 32-bit over `name + b":" + salt`. Two oracles with the same
/// (name, salt) pair acquire the same identity; with different salts,
/// they acquire orthogonal identities.
pub fn oracle_matrix(name: &[u8], salt: &[u8]) -> u32 {
    // Hash name||':'||salt as a single byte stream.
    let mut h: u32 = 0x811C_9DC5;
    for &b in name { h ^= b as u32; h = h.wrapping_mul(0x0100_0193); }
    h ^= b':' as u32; h = h.wrapping_mul(0x0100_0193);
    for &b in salt { h ^= b as u32; h = h.wrapping_mul(0x0100_0193); }
    h
}

/// Returns the perfect dipole pair `(matrix, inverse)` for an oracle.
/// Invariant: `matrix XOR inverse == 0xFFFFFFFF`.
pub fn oracle_dipole(name: &[u8], salt: &[u8]) -> (u32, u32) {
    let m = oracle_matrix(name, salt);
    (m, !m)
}

/// Convenience: same as `fnv1a_32` but exposed under this module's name
/// for symmetry with the JS mirror.
pub fn oracle_hash(name: &[u8], salt: &[u8]) -> u32 {
    oracle_matrix(name, salt)
}

/// Canonical OMEGA-64 v1.0 oracle salt. Frozen along with the protocol.
pub const ORACLE_SALT_V1: &[u8] = b"OMEGA-64/RFC-001/v1.0";

/// The five canonical oracle identities at v1.0.
/// Returns `(matrix, inverse)` for each; all dipoles are bitwise complements.
pub fn canonical_oracle_v1(name: &[u8]) -> (u32, u32) {
    oracle_dipole(name, ORACLE_SALT_V1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::senate::fnv1a_32;

    #[test]
    fn dipole_invariant_holds_by_construction() {
        let (m, inv) = oracle_dipole(b"claude", ORACLE_SALT_V1);
        assert_eq!(m ^ inv, 0xFFFF_FFFF);
    }

    #[test]
    fn distinct_names_produce_distinct_matrices() {
        let claude = oracle_matrix(b"claude", ORACLE_SALT_V1);
        let gpt    = oracle_matrix(b"gpt",    ORACLE_SALT_V1);
        let gemini = oracle_matrix(b"gemini", ORACLE_SALT_V1);
        let qwen   = oracle_matrix(b"qwen",   ORACLE_SALT_V1);
        let llama  = oracle_matrix(b"llama",  ORACLE_SALT_V1);
        // No collisions across the five canonical oracles.
        let all = [claude, gpt, gemini, qwen, llama];
        for i in 0..5 {
            for j in (i + 1)..5 {
                assert_ne!(all[i], all[j], "collision between oracles {} and {}", i, j);
            }
        }
    }

    #[test]
    fn distinct_salts_produce_distinct_matrices() {
        let m1 = oracle_matrix(b"claude", b"v1.0");
        let m2 = oracle_matrix(b"claude", b"v2.0");
        assert_ne!(m1, m2);
    }

    #[test]
    fn same_inputs_produce_same_matrix() {
        let m1 = oracle_matrix(b"claude", ORACLE_SALT_V1);
        let m2 = oracle_matrix(b"claude", ORACLE_SALT_V1);
        assert_eq!(m1, m2);
    }

    #[test]
    fn canonical_v1_oracles_have_non_zero_matrices() {
        for name in [b"claude" as &[u8], b"gpt", b"gemini", b"qwen", b"llama"] {
            let (m, inv) = canonical_oracle_v1(name);
            assert_ne!(m, 0, "matrix for {:?} must not collide with the null dipole", name);
            assert_eq!(m ^ inv, 0xFFFF_FFFF);
        }
    }

    #[test]
    fn fnv1a_consistency_with_senate_module() {
        // Sanity: oracle_matrix uses the same FNV-1a polynomial as senate.
        let direct = fnv1a_32(b"claude:OMEGA-64/RFC-001/v1.0");
        let oracle = oracle_matrix(b"claude", ORACLE_SALT_V1);
        assert_eq!(direct, oracle);
    }
}
