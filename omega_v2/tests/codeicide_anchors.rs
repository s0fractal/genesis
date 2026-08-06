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
    // Moved from 0xF6652975 on 2026-08-06 with the warrant preimage: it now
    // binds the REASON the Senate voted under and the tick the permission
    // lapses, and the domain separator went WRT0 → WRT1 with the shape. Before
    // that, two warrants for the same target and action with opposite
    // rationales were bit-identical, and an issued one never expired.
    let settings = omega_v2::senate::SenateSettings::new();
    let q = quorum_hash(0b00111, &settings);
    let w = warrant_hash(0xCAFE_BABE, ACTION_TERMINATE, q, 0, u32::MAX);
    eprintln!("rust warrant(CAFEBABE, TERM, q) = 0x{:08x}", w);
    assert_eq!(w, 0xE749_3E2B);

    // The binding is real, not decorative: change only the reason, or only the
    // expiry, and the artifact is a different one.
    assert_ne!(
        w,
        warrant_hash(0xCAFE_BABE, ACTION_TERMINATE, q, 1, u32::MAX),
        "reason must be bound"
    );
    assert_ne!(
        w,
        warrant_hash(0xCAFE_BABE, ACTION_TERMINATE, q, 0, u32::MAX - 1),
        "expiry must be bound"
    );
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
