#![no_main]
sp1_zkvm::entrypoint!(main);

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::{AttractorArray, AttractorMatrix};
use omega_v2::mitosis_proof::{child_receipt_hash, derive_mitosis_child};
use omega_v2::pouw::evaluate_poeuw_trace;
use omega_v2::resonance::scan_resonance_field;

/// ZK Guest Entry Point — Tri-Mode
///
/// Mode 0: Legacy PoUW single-agent trace verification.
/// Mode 1: Resonance field verification for small lattice (≤16 agents).
/// Mode 2: Mitosis proof — re-derive a child from (parent, attractor_array)
///         and assert it matches the claimed child bit-for-bit.
#[allow(clippy::needless_range_loop)]
pub fn main() {
    let mode = sp1_zkvm::io::read::<u8>();

    match mode {
        // -----------------------------------------------------------------
        // Mode 0: Proof-of-Useful-Work (single-agent metabolic trace)
        // -----------------------------------------------------------------
        0 => {
            let initial_genome = sp1_zkvm::io::read::<u32>();
            let kuramoto_base = sp1_zkvm::io::read::<u32>();
            let kuramoto_diffusion = sp1_zkvm::io::read::<u32>();
            let simulation_cycles = sp1_zkvm::io::read::<u32>();

            let (final_genome, final_base_freq, final_energy) = evaluate_poeuw_trace(
                initial_genome,
                kuramoto_base,
                kuramoto_diffusion,
                simulation_cycles,
            );

            // PoUW Verification Axiom: surviving cell MUST maintain positive ATP
            assert!(final_energy > 0, "Proof verification failed: Agent died of ATP starvation.");

            sp1_zkvm::io::commit(&(mode, final_genome, final_base_freq, final_energy));
        }

        // -----------------------------------------------------------------
        // Mode 1: EpicyclicSoul Resonance Field Verification
        // -----------------------------------------------------------------
        1 => {
            let agent_count = sp1_zkvm::io::read::<u32>() as usize;
            assert!(agent_count > 0 && agent_count <= 16,
                "ZK resonance verification supports 1..16 agents, got {}", agent_count);

            let mut agents = [PhaseAgentMinimal::default(); 16];
            for i in 0..agent_count {
                agents[i].phase = sp1_zkvm::io::read::<u32>();
                agents[i].energy = sp1_zkvm::io::read::<u32>();
                agents[i].base_freq = sp1_zkvm::io::read::<i32>();
                agents[i].genome = sp1_zkvm::io::read::<u32>();
            }

            let field = scan_resonance_field(&agents[..agent_count]);

            // ZK Invariant: order parameter must be in mathematically valid range
            let r_q10 = field.order_parameter_r_q10();
            assert!(r_q10 <= 1024, "Invalid order parameter: {} > 1024", r_q10);

            // Additional invariant: at least one living agent contributed
            assert!(field.active_count > 0, "No living agents in resonance field");

            sp1_zkvm::io::commit(&(mode, r_q10, field.sum_cos as i64, field.sum_sin as i64, field.total_energy));
        }

        // -----------------------------------------------------------------
        // Mode 2: Era 1040 — Mitosis Proof
        // Inputs:
        //   - q_phase: u32
        //   - parent agent: 8 × u32 (32 bytes)
        //   - attractor count: u32 (clamped 0..=4)
        //   - attractors: count × 4 × u32 (matrix, inverse, pulse_freq, pulse_amp)
        //   - claimed child: 8 × u32 (32 bytes)
        // Output (committed): (mode, parent_genome, attractor_array_count,
        //                      child_receipt_hash)
        // -----------------------------------------------------------------
        2 => {
            let q_phase = sp1_zkvm::io::read::<u32>();
            let parent = PhaseAgentMinimal {
                phase: sp1_zkvm::io::read::<u32>(),
                energy: sp1_zkvm::io::read::<u32>(),
                base_freq: sp1_zkvm::io::read::<i32>(),
                state_flags: sp1_zkvm::io::read::<u32>(),
                genome: sp1_zkvm::io::read::<u32>(),
                memory: [
                    sp1_zkvm::io::read::<u32>(),
                    sp1_zkvm::io::read::<u32>(),
                    sp1_zkvm::io::read::<u32>(),
                ],
            };
            let attractor_count = sp1_zkvm::io::read::<u32>();
            assert!(attractor_count <= 4, "attractor_count must be 0..=4");

            let mut arr = AttractorArray::new();
            for i in 0..(attractor_count as usize) {
                let matrix = sp1_zkvm::io::read::<u32>();
                let inverse = sp1_zkvm::io::read::<u32>();
                let pulse_freq = sp1_zkvm::io::read::<u32>();
                let pulse_amp = sp1_zkvm::io::read::<u32>();
                // Dipole invariant — guest mirrors lattice rejection rule.
                let m = AttractorMatrix::new(matrix, inverse, pulse_freq, pulse_amp);
                assert!(m.is_valid_dipole(), "attractor {} is not a valid dipole", i);
                arr.set(i, m);
            }

            let claimed_child = PhaseAgentMinimal {
                phase: sp1_zkvm::io::read::<u32>(),
                energy: sp1_zkvm::io::read::<u32>(),
                base_freq: sp1_zkvm::io::read::<i32>(),
                state_flags: sp1_zkvm::io::read::<u32>(),
                genome: sp1_zkvm::io::read::<u32>(),
                memory: [
                    sp1_zkvm::io::read::<u32>(),
                    sp1_zkvm::io::read::<u32>(),
                    sp1_zkvm::io::read::<u32>(),
                ],
            };

            let derived = derive_mitosis_child(&parent, &arr, q_phase);

            // Bit-for-bit equivalence is the proof axiom.
            assert_eq!(derived.phase, claimed_child.phase, "phase mismatch");
            assert_eq!(derived.energy, claimed_child.energy, "energy mismatch");
            assert_eq!(derived.base_freq, claimed_child.base_freq, "base_freq mismatch");
            assert_eq!(derived.state_flags, claimed_child.state_flags, "state_flags mismatch");
            assert_eq!(derived.genome, claimed_child.genome, "genome mismatch");
            assert_eq!(derived.memory, claimed_child.memory, "memory mismatch");

            let receipt = child_receipt_hash(&derived);
            sp1_zkvm::io::commit(&(mode, parent.genome, attractor_count, receipt));
        }

        // -----------------------------------------------------------------
        _ => {
            panic!("Unknown ZK guest mode: {}. Supported modes: 0 (PoUW), 1 (Resonance), 2 (Mitosis)", mode);
        }
    }
}
