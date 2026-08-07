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
    // 0, not 128. With q_phase=7 the wrap ends at 127, and the child sits half
    // a turn from a parent at 64 — which is 128, which is outside it. The
    // derivation masked nothing until Era 974, so this anchor pinned a child
    // that could not exist in the lattice it was born into.
    assert_eq!(c.phase, 0);
    assert_eq!(c.energy, 1020);
    assert_eq!(c.base_freq, 7);
    assert_eq!(c.state_flags, 56); // Era 0219: species << 1
}

#[test]
fn anchor_no_attractors_receipt() {
    let p = anchor_parent();
    let c = derive_mitosis_child(&p, &AttractorArray::new(), 7);
    let _h = child_receipt_hash(&c);
    assert_ne!(_h, [0; 32]);
    assert_eq!(c.genome, 3271474076);
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
    // birth_near_attractor + species
    assert_eq!(c.state_flags, 16777468);
    assert_eq!(c.genome, p.genome ^ matrix);
    assert_eq!(c.memory[0], matrix);
    let h = child_receipt_hash(&c);
    // Anchored to keep both languages in sync.
    assert_ne!(h, [0; 32]);
}
