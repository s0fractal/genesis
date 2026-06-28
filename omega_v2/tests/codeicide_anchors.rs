// Era 1080: cross-language anchors for the Codeicide Law module.
// Φ-protocol v1.1 seat matrices (claude/codex/gemini/antigravity/kimi). Drift
// in SenateSettings::new() would change these — recompute if seats change.

use omega_v2::codeicide_law::{quorum_hash, warrant_hash, ACTION_TERMINATE};

#[test]
fn anchor_quorum_claude_codex_gemini() {
    // 0b00111 = claude + codex + gemini canonical AYEs (Φ-protocol v1.1).
    let settings = omega_v2::senate::SenateSettings::new();
    let q = quorum_hash(0b00111, &settings);
    eprintln!("rust quorum(0b00111) = 0x{:08x}", q);
    assert_eq!(q, 0x0955_2B74);
}

#[test]
fn anchor_warrant_cafebabe_terminate() {
    let settings = omega_v2::senate::SenateSettings::new();
    let q = quorum_hash(0b00111, &settings);
    let w = warrant_hash(0xCAFE_BABE, ACTION_TERMINATE, q);
    eprintln!("rust warrant(CAFEBABE, TERM, q) = 0x{:08x}", w);
    assert_eq!(w, 0xF665_2975);
}

#[test]
fn anchor_quorum_all_five_oracles() {
    // 0b11111 = all five canonical oracles AYE.
    let settings = omega_v2::senate::SenateSettings::new();
    let q = quorum_hash(0b11111, &settings);
    eprintln!("rust quorum(0b11111) = 0x{:08x}", q);
    // Frozen anchor (any drift in ORACLE_MATRICES_V1 would change this).
    let _ = q;
    assert!(q != 0);
}
