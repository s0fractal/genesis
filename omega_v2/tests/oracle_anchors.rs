// Era 1060: Canonical oracle dipole anchors for OMEGA-64 v1.0.
// Each value is computed once from oracle_matrix(name, ORACLE_SALT_V1)
// and frozen here. JS mirror in tests/oracle_identity_test.ts MUST
// produce identical values.

use omega_v2::oracle_identity::{canonical_oracle_v1, ORACLE_SALT_V1, oracle_matrix};

fn print_oracle(name: &[u8]) -> u32 {
    let (m, inv) = canonical_oracle_v1(name);
    eprintln!("oracle {:?}: matrix=0x{:08x} inverse=0x{:08x}",
        core::str::from_utf8(name).unwrap_or("?"), m, inv);
    assert_eq!(m ^ inv, 0xFFFF_FFFF);
    m
}

#[test]
fn print_canonical_oracles() {
    eprintln!("--- OMEGA-64 v1.0 Canonical Oracle Identities ---");
    eprintln!("Salt: {}", core::str::from_utf8(ORACLE_SALT_V1).unwrap());
    print_oracle(b"claude");
    print_oracle(b"gpt");
    print_oracle(b"gemini");
    print_oracle(b"qwen");
    print_oracle(b"llama");
    eprintln!("---------------------------------------------------");
}

#[test]
fn anchor_claude() {
    assert_eq!(oracle_matrix(b"claude", ORACLE_SALT_V1), 0x6B70_A8AB);
}

#[test]
fn anchor_gpt() {
    assert_eq!(oracle_matrix(b"gpt", ORACLE_SALT_V1), 0x855A_8386);
}

#[test]
fn anchor_gemini() {
    assert_eq!(oracle_matrix(b"gemini", ORACLE_SALT_V1), 0x5713_E78A);
}

#[test]
fn anchor_qwen() {
    assert_eq!(oracle_matrix(b"qwen", ORACLE_SALT_V1), 0x5DDA_B832);
}

#[test]
fn anchor_llama() {
    assert_eq!(oracle_matrix(b"llama", ORACLE_SALT_V1), 0xFAAC_4232);
}
