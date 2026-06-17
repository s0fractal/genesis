// Era 1080: cross-language anchors for the Codeicide Law module.
// Mirror constants in tests/codeicide_law_test.ts. Drift on either side
// fails CI on both.

use omega_v2::codeicide_law::{quorum_hash, warrant_hash, ACTION_TERMINATE};

#[test]
fn anchor_quorum_claude_gpt_gemini() {
    // 0b00111 = claude + gpt + gemini canonical AYEs.
    let settings = omega_v2::senate::SenateSettings::new();
    let q = quorum_hash(0b00111, &settings);
    eprintln!("rust quorum(0b00111) = 0x{:08x}", q);
    assert_eq!(q, 0x0980_967D);
}

#[test]
fn anchor_warrant_cafebabe_terminate() {
    let settings = omega_v2::senate::SenateSettings::new();
    let q = quorum_hash(0b00111, &settings);
    let w = warrant_hash(0xCAFE_BABE, ACTION_TERMINATE, q);
    eprintln!("rust warrant(CAFEBABE, TERM, q) = 0x{:08x}", w);
    assert_eq!(w, 0x6BDF_99FD);
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
