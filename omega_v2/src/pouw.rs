//! Era 13000: Proof of Useful Work (PoUW) ZK-VM Evaluator
//! 
//! This module replicates the exact Darwinian phase dynamics and biological
//! RISC opcode logic executed by the `compute_v2.wgsl` GPU shader.
//! It allows the SP1 CPU guest to perfectly trace the metabolic survival 
//! of a single PhaseAgent over N cycles, verifying its evolutionary success cryptographically.

use crate::agent::PhaseAgentMinimal;

/// Simulates a single cell's survival through extreme topological pressure.
pub fn evaluate_poeuw_trace(
    initial_genome: u32,
    kuramoto_base: u32,
    kuramoto_diffusion: u32,
    cycles: u32,
) -> (u32, i32, u32) { // Returns (final_genome, final_base_freq, final_energy)
    
    let mut agent = PhaseAgentMinimal {
        phase: 0,
        energy: crate::constants::MAX_ATP,
        base_freq: kuramoto_base as i32, // Influenced by cosmic entropy
        state_flags: 0,
        genome: initial_genome,
        memory: [0, 0, 0],
    };

    let max_phase_mask = crate::constants::PHASE_MASK_8BIT;
    
    // ZK Trace Loop (Reproducing WebGPU shader metabolic burn & opcode dynamics)
    for tick in 0..cycles {
        // 1. Biological Metabolic Decay
        // Baseline decay scaled by how complex the genome is (Population set bit count)
        let set_bits = agent.genome.count_ones();
        let metabolic_burn = crate::constants::METABOLIC_BASE_COST + (set_bits / crate::constants::METABOLIC_BURN_DIVISOR); // Complex genomes burn ATP faster
        
        let mut new_energy = agent.energy as i32 - metabolic_burn as i32;
        
        // 2. Cosmic Resonance: 1/64 chance to replenish ATP if the agent aligns to harmonic phase zero
        // (A synthetic proxy for Kuramoto topological alignment)
        if agent.phase.is_multiple_of(crate::constants::RESONANCE_PHASE_MODULUS) {
            new_energy += crate::constants::RESONANCE_ATP_BONUS;
        }

        if new_energy <= 0 {
            agent.energy = 0;
            break; // Agent died. Work failed.
        }
        
        agent.energy = new_energy.min(crate::constants::MAX_ATP as i32) as u32; // Limit ATP to cap

        // 3. Simulated Incoming Environmental Opcodes (The "Trial")
        // We inject pseudo-random stressors derived from the blockchain entropy
        let stressor_mod = (kuramoto_diffusion ^ (tick * crate::constants::STRESSOR_MIXER)) % crate::constants::STRESSOR_MODULUS;
        
        if stressor_mod == 0 {
            // Weaponized Neural Paralysis Attack
            agent.memory[1] = 3; // Opcode 3
            agent.memory[2] = 2; // TTL
        } else if stressor_mod == 1 {
            // Lysogenic Integration
            agent.memory[1] = 1; // Opcode 1
            agent.memory[2] = 2; // TTL
        }

        // 4. Evaluate RISC Biological Opcodes (Exact WGSL equivalent)
        if agent.memory[2] > 0 {
            let opcode = agent.memory[1];
            if opcode == 1 {
                // Opcode 1: Lysogenic Viral Integration (XOR Inversion)
                agent.genome ^= 0xFFFFFFFF;
                agent.memory[2] = 0;
            } else if opcode == 2 {
                // Opcode 2: Somatic Burst
                agent.energy = crate::constants::MAX_ATP;
                agent.memory[2] = 0;
            } else if opcode == 3 {
                // Opcode 3: Neural Paralysis (Deep Freeze)
                agent.base_freq = 0;
                agent.memory[2] = 0;
            } else {
                agent.memory[2] -= 1;
            }
            
            if agent.memory[2] == 0 {
                agent.memory[0] = 0;
                agent.memory[1] = 0;
            }
        }

        // 5. Native Lattice Oscillation (Phase Update)
        // Simulate Kuramoto Phase drift with the `base_freq`
        // CRIT-1 FIX: arithmetic shift on i32 preserves sign for negative drift.
        // `>>` on signed integers in Rust is arithmetic (sign-extending).
        let drift = agent.base_freq >> 20;
        agent.phase = (agent.phase as i32).wrapping_add(drift) as u32;
        agent.phase &= max_phase_mask;
        
        // Restore base_freq gradually if Neural Paralyzed (Homeostasis mechanism)
        // FIX: scale homeostasis step with kuramoto_base magnitude
        let homeo_step = core::cmp::max(1, (kuramoto_base >> crate::constants::HOMEOSTASIS_Q_SHIFT) as i32);
        if agent.base_freq < kuramoto_base as i32 {
            agent.base_freq = core::cmp::min(agent.base_freq + homeo_step, kuramoto_base as i32);
        } else if agent.base_freq > kuramoto_base as i32 {
            agent.base_freq = core::cmp::max(agent.base_freq - homeo_step, kuramoto_base as i32);
        }
    }

    (agent.genome, agent.base_freq, agent.energy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pouw_survives_short_trace() {
        // Low-complexity genome (few set bits = low burn), short cycle
        let (final_genome, _final_freq, final_energy) = evaluate_poeuw_trace(
            0x0000_0001, // minimal genome
            1_048_576,   // Q20 = 1.0 Hz
            42,          // diffusion seed
            10,
        );
        assert!(final_energy > 0, "Agent should survive 10 ticks with minimal genome");
        // Genome should be unchanged (no opcodes triggered with this seed in 10 ticks)
        assert_eq!(final_genome, 0x0000_0001);
    }

    #[test]
    fn test_pouw_high_burn_reduces_energy() {
        // Max-complexity genome (32 set bits = 8 extra burn per tick)
        // Base burn = 1 + 32/4 = 9 per tick.
        // Use diffusion=3 to avoid opcodes for first 5 ticks (stressor_mod never hits 0/1/2).
        let (_genome, _freq, energy) = evaluate_poeuw_trace(
            0xFFFF_FFFF, // max complexity
            1_048_576,   // Q20 = 1.0 Hz → drift = 1
            3,           // stressor seed 3 → no opcodes in ticks 0..4
            5,
        );
        // tick0: phase=0, resonance +128, burn -9 → cap 4096
        // tick1: phase=1, burn -9 → 3991
        // tick2: phase=2, burn -9 → 3982
        // tick3: phase=3, burn -9 → 3973
        // tick4: phase=4, burn -9 → 3964
        assert!(energy < crate::constants::MAX_ATP, "High-burn agent should lose energy within 5 ticks");
    }

    #[test]
    fn test_pouw_neural_paralysis_resets_freq() {
        // Find a seed where stressor_mod == 0 (neural paralysis) occurs early
        // stressor_mod = (kuramoto_diffusion ^ (tick * 17)) % 100
        // We need diffusion such that tick=0 gives 0: diffusion % 100 == 0
        let (_genome, freq, energy) = evaluate_poeuw_trace(
            0x0000_0001,
            1_048_576,   // Q20 = 1.0
            100,         // diffusion % 100 == 0 → paralysis at tick 0
            2,
        );
        // After paralysis, base_freq should be 0, then homeostasis restores it slowly
        // But with only 2 ticks, it stays 0 or very low
        assert!(freq < 1_048_576, "Neural paralysis should reset or lower base_freq");
        assert!(energy > 0, "Agent should survive 2 ticks");
    }

    #[test]
    fn test_pouw_lysogenic_inversion() {
        // stressor_mod == 1 → lysogenic integration at tick 0
        // diffusion % 100 == 1
        let (genome, _freq, energy) = evaluate_poeuw_trace(
            0xAAAA_BBBB,
            1_048_576,
            101,         // 101 % 100 == 1 → lysogenic at tick 0
            2,
        );
        assert!(energy > 0, "Agent should survive 2 ticks");
        // Genome should be inverted by XOR with 0xFFFFFFFF
        assert_eq!(genome, 0xAAAA_BBBB ^ 0xFFFF_FFFF, "Lysogenic opcode should invert genome");
    }

    #[test]
    fn test_pouw_determinism() {
        let result1 = evaluate_poeuw_trace(0x1234_5678, 2_000_000, 77, 100);
        let result2 = evaluate_poeuw_trace(0x1234_5678, 2_000_000, 77, 100);
        assert_eq!(result1, result2, "PoUW trace must be deterministic for same inputs");
    }

    #[test]
    fn test_pouw_resonance_replenish() {
        // base_freq = 0 means phase never moves, so phase stays 0.
        // phase % 64 == 0 → resonance triggers every tick!
        let (_g, _f, energy) = evaluate_poeuw_trace(
            0x0000_0001, // low burn
            0,           // no phase movement
            0,           // no stressors
            100,
        );
        // Burn = 1 per tick. Resonance = +128 per tick.
        // Net = +127 per tick. Should cap at MAX_ATP = 4096.
        assert_eq!(energy, crate::constants::MAX_ATP, "Agent should cap at MAX_ATP with continuous resonance");
    }
}
