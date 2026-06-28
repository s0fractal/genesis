// Era 1060: Canonical oracle dipole anchors for OMEGA-64 (Φ-protocol v1.1).
// Each value is computed once from oracle_matrix(name, ORACLE_SALT_V1)
// and frozen here. JS mirror in tests/oracle_identity_test.ts MUST
// produce identical values.
//
// v1.1 (2026-06-28): seats realigned from the v1.0 vendor labels
// (claude/gpt/gemini/qwen/llama) to the five real keyed model-voices
// (claude/codex/gemini/antigravity/kimi). claude+gemini are unchanged (same
// name+salt); gpt/qwen/llama retired, codex/antigravity/kimi anchored.

use omega_v2::oracle_identity::{canonical_oracle_v1, oracle_matrix, ORACLE_SALT_V1};

fn print_oracle(name: &[u8]) -> u32 {
    let (m, inv) = canonical_oracle_v1(name);
    eprintln!(
        "oracle {:?}: matrix=0x{:08x} inverse=0x{:08x}",
        core::str::from_utf8(name).unwrap_or("?"),
        m,
        inv
    );
    assert_eq!(m ^ inv, 0xFFFF_FFFF);
    m
}

#[test]
fn print_canonical_oracles() {
    eprintln!("--- OMEGA-64 v1.1 Canonical Oracle Identities ---");
    eprintln!("Salt: {}", core::str::from_utf8(ORACLE_SALT_V1).unwrap());
    print_oracle(b"claude");
    print_oracle(b"codex");
    print_oracle(b"gemini");
    print_oracle(b"antigravity");
    print_oracle(b"kimi");
    eprintln!("---------------------------------------------------");
}

#[test]
fn anchor_claude() {
    assert_eq!(oracle_matrix(b"claude", ORACLE_SALT_V1), 1101198068);
}

#[test]
fn anchor_codex() {
    assert_eq!(oracle_matrix(b"codex", ORACLE_SALT_V1), 206651239);
}

#[test]
fn anchor_gemini() {
    assert_eq!(oracle_matrix(b"gemini", ORACLE_SALT_V1), 2557795617);
}

#[test]
fn anchor_antigravity() {
    assert_eq!(oracle_matrix(b"antigravity", ORACLE_SALT_V1), 1536272792);
}

#[test]
fn anchor_kimi() {
    assert_eq!(oracle_matrix(b"kimi", ORACLE_SALT_V1), 614115703);
}
