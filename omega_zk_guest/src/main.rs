#![no_main]
sp1_zkvm::entrypoint!(main);

extern crate alloc;
use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::{AttractorArray, AttractorMatrix};
use omega_v2::mitosis_proof::{child_receipt_hash, derive_mitosis_child};
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
        // Mode 0: Proof-of-Useful-Work (single-agent metabolic trace) [LEGACY]
        // -----------------------------------------------------------------
        0 => {
            panic!("Mode 0 (Legacy PoUW) is no longer supported.");
        }

        // -----------------------------------------------------------------
        // Mode 1: EpicyclicSoul Resonance Field Verification
        // -----------------------------------------------------------------
        1 => {
            let agent_count = sp1_zkvm::io::read::<u32>() as usize;
            assert!(
                agent_count > 0 && agent_count <= 16,
                "ZK resonance verification supports 1..16 agents, got {}",
                agent_count
            );

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
            assert!(
                field.active_count > 0,
                "No living agents in resonance field"
            );

            sp1_zkvm::io::commit(&(
                mode,
                r_q10,
                field.sum_cos as i64,
                field.sum_sin as i64,
                field.total_energy,
            ));
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
            assert_eq!(
                derived.base_freq, claimed_child.base_freq,
                "base_freq mismatch"
            );
            assert_eq!(
                derived.state_flags, claimed_child.state_flags,
                "state_flags mismatch"
            );
            assert_eq!(derived.genome, claimed_child.genome, "genome mismatch");
            assert_eq!(derived.memory, claimed_child.memory, "memory mismatch");

            let receipt = child_receipt_hash(&derived);
            sp1_zkvm::io::commit(&(mode, parent.genome, attractor_count, receipt));
        }

        // -----------------------------------------------------------------
        // Mode 3: Era 2060 — ZK Physics Tick Rollup (V3 Metaphysics)
        // Inputs:
        //   - PhaseTopology
        //   - active_count
        //   - snapshot (PhaseAgentMinimal array)
        //   - attractor_count + AttractorMatrix array
        // Outputs (committed):
        //   - (mode, q_phase, initial_hash, final_hash, active_count)
        // -----------------------------------------------------------------
        3 => {
            let q_phase = sp1_zkvm::io::read::<u32>();
            let q_sectors = sp1_zkvm::io::read::<u32>();
            let q_radial = sp1_zkvm::io::read::<u32>();
            let q_math = sp1_zkvm::io::read::<u32>();
            let weather_multiplier = sp1_zkvm::io::read::<u32>();

            let topology = omega_v2::topology::PhaseTopology {
                q_phase,
                q_sectors,
                q_radial,
                q_math,
                weather_multiplier,
                alpha: 0,
                _pad1: 0,
                _pad2: 0,
            };

            let active_count = sp1_zkvm::io::read::<u32>();
            assert!(
                active_count > 0 && active_count <= 2048,
                "active_count out of bounds for rollup"
            );

            let mut snapshot = alloc::vec::Vec::with_capacity(active_count as usize);
            for _ in 0..active_count {
                snapshot.push(PhaseAgentMinimal {
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
                });
            }

            let attractor_count = sp1_zkvm::io::read::<u32>();
            assert!(attractor_count <= 4, "attractor_count must be 0..=4");

            let mut arr = AttractorArray::new();
            for i in 0..(attractor_count as usize) {
                let matrix = sp1_zkvm::io::read::<u32>();
                let inverse = sp1_zkvm::io::read::<u32>();
                let pulse_freq = sp1_zkvm::io::read::<u32>();
                let pulse_amp = sp1_zkvm::io::read::<u32>();
                let m = AttractorMatrix::new(matrix, inverse, pulse_freq, pulse_amp);
                assert!(m.is_valid_dipole(), "attractor {} is not a valid dipole", i);
                arr.set(i, m);
            }

            // Calculate Initial State Hash
            let mut initial_bytes = alloc::vec::Vec::with_capacity(active_count as usize * 32);
            for agent in &snapshot {
                initial_bytes.extend_from_slice(&agent.phase.to_le_bytes());
                initial_bytes.extend_from_slice(&agent.energy.to_le_bytes());
                initial_bytes.extend_from_slice(&agent.base_freq.to_le_bytes());
                initial_bytes.extend_from_slice(&agent.state_flags.to_le_bytes());
                initial_bytes.extend_from_slice(&agent.genome.to_le_bytes());
                initial_bytes.extend_from_slice(&agent.memory[0].to_le_bytes());
                initial_bytes.extend_from_slice(&agent.memory[1].to_le_bytes());
                initial_bytes.extend_from_slice(&agent.memory[2].to_le_bytes());
            }
            let initial_hash = omega_v2::senate::sha256_hash(&initial_bytes);

            // Execute Physics Tick
            let mut agents_out = snapshot.clone();
            // We need a dummy smart agent array, though it isn't strictly used for physics ticks in V2 minimal loop.
            let mut smart_agents =
                alloc::vec![omega_v2::agent::PhaseAgentSmart::default(); active_count as usize];

            let mut lattice = omega_v2::lattice::PhaseLattice::new_from_host_memory(
                topology,
                smart_agents.as_mut_ptr(),
                agents_out.as_mut_ptr(),
            );
            lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
            lattice.attractors_ptr = &arr as *const _;
            lattice.active_agent_count = active_count;
            lattice.signals.active_agent_count = active_count;
            lattice.signals.max_cells = 4096; // Some large bounds

            lattice.tick_physics();

            // Calculate Final State Hash
            let mut final_bytes = alloc::vec::Vec::with_capacity(active_count as usize * 32);
            for agent in &agents_out {
                final_bytes.extend_from_slice(&agent.phase.to_le_bytes());
                final_bytes.extend_from_slice(&agent.energy.to_le_bytes());
                final_bytes.extend_from_slice(&agent.base_freq.to_le_bytes());
                final_bytes.extend_from_slice(&agent.state_flags.to_le_bytes());
                final_bytes.extend_from_slice(&agent.genome.to_le_bytes());
                final_bytes.extend_from_slice(&agent.memory[0].to_le_bytes());
                final_bytes.extend_from_slice(&agent.memory[1].to_le_bytes());
                final_bytes.extend_from_slice(&agent.memory[2].to_le_bytes());
            }
            let final_hash = omega_v2::senate::sha256_hash(&final_bytes);

            assert!(
                initial_hash != final_hash || active_count == 0,
                "Static state, skipping ZK proof"
            );

            // Commit the rollup proof bundle
            sp1_zkvm::io::commit(&(mode, q_phase, initial_hash, final_hash, active_count));
        }

        // -----------------------------------------------------------------
        _ => {
            panic!("Unknown ZK guest mode: {}. Supported modes: 0 (PoUW), 1 (Resonance), 2 (Mitosis), 3 (Physics Rollup)", mode);
        }
    }
}
