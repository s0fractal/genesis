// 🌌 OMEGA-64: Era 1040 — ZK-Notarized Mutations (Phase 1)
//
// This module isolates the *pure*, *deterministic* child-derivation function
// used by darwinian_mitosis so the same exact code runs in three places:
//   1. Host-side Rust  (omega_v2 lattice tick path)
//   2. SP1 ZK-VM guest (omega_zk_guest, Mode 2)
//   3. JavaScript      (src/network/webrtc_v2.ts cross-check on receipt)
//
// Bit-for-bit equivalence across all three is the cryptographic foundation
// for Era 1040: the lattice can prove that a particular birth event followed
// the integer-only physics laws, and any peer can independently verify.
//
// Determinism contract:
// - All math is integer-only (i32/u32/i64).
// - Attractor lookup follows the same toroidal-distance rule as the lattice.
// - xorshift64_once with parent.genome as seed provides the mutation mask
//   when no attractor is dominant (`birth_near_attractor == false`).

use crate::agent::PhaseAgentMinimal;
use crate::attractor::AttractorArray;

/// Constants extracted from `lattice::darwinian_mitosis` so they cannot drift
/// between the lattice path and the proof path.
pub const CHILD_ENERGY_SEED: u32 = crate::constants::CHILD_ENERGY_SEED;
/// Era 1010: bit set on `state_flags` when a birth happens near a dominant attractor.
pub const BIRTH_NEAR_ATTRACTOR_FLAG: u32 = 0x0100_0000;

/// Pure, deterministic child derivation.
///
/// Given a parent `PhaseAgentMinimal`, the current `AttractorArray`, and the
/// topology's `q_phase`, returns the bit-exact `PhaseAgentMinimal` that the
/// lattice would create as the parent's mitosis offspring.
///
/// This function does **not** mutate anything. Callers (lattice, ZK guest)
/// are responsible for placing the result into the appropriate dead slot and
/// applying the parent's energy debit.
pub fn derive_mitosis_child(
    parent: &PhaseAgentMinimal,
    attractors: &AttractorArray,
    q_phase: u32,
) -> PhaseAgentMinimal {
    let max_phase_mask = (1u32 << q_phase) - 1;
    let half_phase = 1u32 << q_phase.saturating_sub(1);
    let quarter_phase = 1u32 << q_phase.saturating_sub(2);

    // Attractor scan — find dominant attractor by toroidal phase distance.
    let count = attractors.count as usize;
    let mut best_dist = u32::MAX;
    let mut best_matrix: u32 = 0;
    let mut a = 0;
    while a < count && a < 4 {
        let atr = &attractors.data[a];
        if atr.pulse_amp != 0 {
            let diff = parent.phase.abs_diff(atr.matrix & max_phase_mask);
            let dist = core::cmp::min(diff, max_phase_mask + 1 - diff);
            if dist < best_dist {
                best_dist = dist;
                best_matrix = atr.matrix;
            }
        }
        a += 1;
    }

    let birth_near_attractor = best_dist < quarter_phase && best_matrix != 0;

    // Mutation mask + state flags.
    let (genome, memory0, mut state_flags) = if birth_near_attractor {
        let new_state_flags = parent.state_flags | BIRTH_NEAR_ATTRACTOR_FLAG;
        (
            parent.genome ^ best_matrix,
            best_matrix,
            new_state_flags,
        )
    } else {
        // Era 0219: Epigenetic Inheritance
        // The parent's lived experience (memory) and stress (energy) alters the mutation vector.
        let epigenetic_base = (parent.genome as u64)
            ^ ((parent.memory[1] as u64) << 16)
            ^ ((parent.memory[2] as u64) << 32)
            ^ (parent.energy as u64);
        let mut_seed = crate::math::xorshift64_once(epigenetic_base);
        let mask = mut_seed as u32;
        (
            parent.genome ^ mask,
            parent.memory[0],
            parent.state_flags,
        )
    };

    // Era 0218: Species Specialization
    let species = genome & 0x7F;
    state_flags = (state_flags & !0xFE) | (species << 1);

    PhaseAgentMinimal {
        phase: parent.phase.wrapping_add(half_phase),
        energy: CHILD_ENERGY_SEED,
        base_freq: parent.base_freq,
        state_flags,
        genome,
        memory: [memory0, parent.memory[1], parent.memory[2]],
    }
}

/// Compute a deterministic FNV-1a hash of a child agent's 32-byte representation.
/// This is the receipt content that gets committed by the ZK guest in Mode 2.
pub fn child_receipt_hash(child: &PhaseAgentMinimal) -> u32 {
    let mut buf = [0u8; 32];
    buf[0..4].copy_from_slice(&child.phase.to_le_bytes());
    buf[4..8].copy_from_slice(&child.energy.to_le_bytes());
    buf[8..12].copy_from_slice(&child.base_freq.to_le_bytes());
    buf[12..16].copy_from_slice(&child.state_flags.to_le_bytes());
    buf[16..20].copy_from_slice(&child.genome.to_le_bytes());
    buf[20..24].copy_from_slice(&child.memory[0].to_le_bytes());
    buf[24..28].copy_from_slice(&child.memory[1].to_le_bytes());
    buf[28..32].copy_from_slice(&child.memory[2].to_le_bytes());
    crate::senate::fnv1a_32(&buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::attractor::AttractorMatrix;

    fn empty_array() -> AttractorArray {
        AttractorArray::new()
    }

    fn parent() -> PhaseAgentMinimal {
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
    fn derives_deterministically_without_attractors() {
        let p = parent();
        let arr = empty_array();
        let c1 = derive_mitosis_child(&p, &arr, 7);
        let c2 = derive_mitosis_child(&p, &arr, 7);
        assert_eq!(c1.phase, c2.phase);
        assert_eq!(c1.energy, c2.energy);
        assert_eq!(c1.genome, c2.genome);
        assert_eq!(c1.state_flags, c2.state_flags);
        assert_eq!(c1.memory, c2.memory);
    }

    #[test]
    fn child_phase_is_parent_plus_half() {
        let p = parent();
        let arr = empty_array();
        let c = derive_mitosis_child(&p, &arr, 7);
        assert_eq!(c.phase, p.phase.wrapping_add(64));
    }

    #[test]
    fn child_energy_is_seed_constant() {
        let p = parent();
        let arr = empty_array();
        let c = derive_mitosis_child(&p, &arr, 7);
        assert_eq!(c.energy, CHILD_ENERGY_SEED);
    }

    #[test]
    fn no_attractor_uses_xorshift_mask() {
        let p = parent();
        let arr = empty_array();
        let c = derive_mitosis_child(&p, &arr, 7);
        let epigenetic_base = (p.genome as u64)
            ^ ((p.memory[1] as u64) << 16)
            ^ ((p.memory[2] as u64) << 32)
            ^ (p.energy as u64);
        let expected_mask = crate::math::xorshift64_once(epigenetic_base) as u32;
        // The genome has the mask applied, but also species bits embedded?
        // Actually, derive_mitosis_child sets genome = p.genome ^ mask.
        // The state_flags has the species bits, not the genome!
        assert_eq!(c.genome, p.genome ^ expected_mask);
        // Birth flag NOT set when no attractor was dominant.
        assert_eq!(c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG, 0);
    }

    #[test]
    fn dominant_attractor_sets_birth_flag() {
        let p = parent();
        let mut arr = empty_array();
        // Attractor matrix close to parent.phase (distance < quarter_phase = 32).
        // Use matrix whose low 7 bits == parent.phase to have distance 0.
        let attractor_matrix = (0xABCD_0000u32) | p.phase;
        arr.set(
            0,
            AttractorMatrix::new(attractor_matrix, !attractor_matrix, 256, 512),
        );
        let c = derive_mitosis_child(&p, &arr, 7);
        assert_ne!(c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG, 0);
        // Genome must be parent ^ best_matrix (NOT xorshift).
        assert_eq!(c.genome, p.genome ^ attractor_matrix);
        // memory[0] carries the matrix as the parentHash.
        assert_eq!(c.memory[0], attractor_matrix);
    }

    #[test]
    fn far_attractor_does_not_trigger_birth_flag() {
        let p = parent();
        let mut arr = empty_array();
        // Attractor far away (distance >> quarter_phase).
        let far_phase = (p.phase + 64) & 0x7F; // half-circle away on q_phase=7
        let attractor_matrix = far_phase;
        arr.set(0, AttractorMatrix::new(attractor_matrix, !attractor_matrix, 256, 512));
        let c = derive_mitosis_child(&p, &arr, 7);
        assert_eq!(c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG, 0);
    }

    #[test]
    fn zero_pulse_amp_attractor_is_skipped() {
        let p = parent();
        let mut arr = empty_array();
        // pulse_amp = 0 means the attractor is dormant — must be ignored.
        let attractor_matrix = (0xABCD_0000u32) | p.phase;
        arr.set(0, AttractorMatrix::new(attractor_matrix, !attractor_matrix, 256, 0));
        let c = derive_mitosis_child(&p, &arr, 7);
        // Should fall through to xorshift path.
        assert_eq!(c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG, 0);
    }

    #[test]
    fn receipt_hash_changes_with_child() {
        let p = parent();
        let arr = empty_array();
        let c = derive_mitosis_child(&p, &arr, 7);
        let h1 = child_receipt_hash(&c);
        let mut c_modified = c;
        c_modified.energy = c.energy + 1;
        let h2 = child_receipt_hash(&c_modified);
        assert_ne!(h1, h2);
    }

    #[test]
    fn receipt_hash_is_deterministic() {
        let p = parent();
        let arr = empty_array();
        let c = derive_mitosis_child(&p, &arr, 7);
        assert_eq!(child_receipt_hash(&c), child_receipt_hash(&c));
    }
}
