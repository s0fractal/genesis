// Era 1040: Cross-language anchor for the mitosis proof derivation.
//
// These constants MUST stay in lockstep with `tests/mitosis_proof_test.ts`.
// If you change either side, re-anchor here and there at the same time.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::AttractorArray;
use omega_v2::mitosis_proof::{child_receipt_hash, derive_mitosis_child};

fn anchor_parent() -> PhaseAgentMinimal {
    PhaseAgentMinimal {
        phase: 64,
        energy: 3000,
        base_freq: 7,
        state_flags: 0,
        genome: 0xCAFE_BABE,
        memory: [0xDEAD_BEEF, 1, 2],
    }
}

#[test]
fn anchor_no_attractors_phase() {
    let p = anchor_parent();
    let c = derive_mitosis_child(&p, &AttractorArray::new(), 7);
    assert_eq!(c.phase, 128);
    assert_eq!(c.energy, 1000);
    assert_eq!(c.base_freq, 7);
    assert_eq!(c.state_flags, 0);
}

#[test]
fn anchor_no_attractors_receipt() {
    // Cross-language anchor: the same parent + empty attractor array MUST
    // produce this exact receipt hash from both Rust and JS. If you see
    // this fail, EITHER the Rust pure path drifted OR the JS port did.
    // Mirror constant lives in `tests/mitosis_proof_test.ts`.
    let p = anchor_parent();
    let c = derive_mitosis_child(&p, &AttractorArray::new(), 7);
    let h = child_receipt_hash(&c);
    assert_eq!(h, 0xD434_E690);
    // The genome is derived from xorshift64_once(0xCAFEBABE).
    assert_eq!(c.genome, 972_722_933);
    assert_eq!(c.memory, [0xDEAD_BEEF, 1, 2]);
}

#[test]
fn anchor_with_dominant_attractor() {
    use omega_v2::attractor::AttractorMatrix;
    let p = anchor_parent();
    let mut arr = AttractorArray::new();
    let matrix: u32 = 0xABCD_0000 | p.phase;
    arr.set(0, AttractorMatrix::new(matrix, !matrix, 256, 512));
    let c = derive_mitosis_child(&p, &arr, 7);
    // birth_near_attractor was triggered.
    assert_eq!(c.state_flags, 0x0100_0000);
    assert_eq!(c.genome, p.genome ^ matrix);
    assert_eq!(c.memory[0], matrix);
    let h = child_receipt_hash(&c);
    // Anchored to keep both languages in sync.
    assert_eq!(h, 0x3B88_1A47);
}

