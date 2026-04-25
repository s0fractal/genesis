#![no_main]
sp1_zkvm::entrypoint!(main);

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::pouw::evaluate_poeuw_trace;
use omega_v2::resonance::scan_resonance_field;

/// ZK Guest Entry Point — Dual Mode
///
/// Mode 0: Legacy PoUW single-agent trace verification.
/// Mode 1: Resonance field verification for small lattice (≤16 agents).
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
        _ => {
            panic!("Unknown ZK guest mode: {}. Supported modes: 0 (PoUW), 1 (Resonance)", mode);
        }
    }
}
