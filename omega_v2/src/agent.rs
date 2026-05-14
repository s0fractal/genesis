//! Variable Agent Structure
//!
//! OMEGA-64 dynamically saturates hardware using these Memory-Aligned structures.
//! Minimum unit is 16 bytes for perfect GPU `vec4<u32>` alignment.

#[derive(Clone, Copy, Debug)]
#[repr(C, align(32))]
pub struct PhaseAgentMinimal {
    /// High-precision Q20 or continuous integer mapping of the 0..255 phase.
    pub phase: u32,

    /// ATP Energy limit constraints
    pub energy: u32,

    /// Fundamental oscillator frequency `omega_i` (signed Q20)
    pub base_freq: i32,

    /// Bitmask for status: [1: is_locked] [7: species] [24: reserved custom traits]
    pub state_flags: u32,

    // ---- Neural Phase Extensions  ----
    /// Cellular Automata state vector or Species Genome
    pub genome: u32,

    /// 3-Dimensional payload for Gradient memory natively mapped avoiding WGSL padding faults
    pub memory: [u32; 3],
}

#[derive(Clone, Copy, Debug)]
pub struct Phenotype {
    /// Bits 0-7: Affects baseline ATP burn rate
    pub metabolic_efficiency: u8,
    /// Bits 8-15: Affects phase interaction distance
    pub interaction_radius: u8,
    /// Bits 16-23: Protection against energy loss in hostile environments
    pub resilience: u8,
    /// Bits 24-31: Strength of influence on neighboring agents
    pub radiance: u8,
}

/// Tissue Crystallization marker
pub const FLAG_TISSUE_LOCKED: u32 = 0x0800_0000;

impl PhaseAgentMinimal {
    /// Decodes the 32-bit genome into 4 distinct phenotypic traits
    pub fn decode_phenotype(&self) -> Phenotype {
        Phenotype {
            metabolic_efficiency: (self.genome & 0xFF) as u8,
            interaction_radius: ((self.genome >> 8) & 0xFF) as u8,
            resilience: ((self.genome >> 16) & 0xFF) as u8,
            radiance: ((self.genome >> 24) & 0xFF) as u8,
        }
    }
}

/// Circular Food Web
/// Returns 1 if `a` is a predator of `b` (steals ATP).
/// Returns -1 if `a` is prey to `b` (loses ATP).
/// Returns 0 if neutral.
pub fn species_advantage(a_genome: u32, b_genome: u32) -> i32 {
    if a_genome == b_genome { return 0; }

    // Philosophy Cryptographic Co-Adaptation (Red Queen's Race)
    // Asymmetric cyclic food web based on GF(2) mixing and ring distance
    let ha = crate::math::xorshift32_once(a_genome);
    let hb = crate::math::xorshift32_once(b_genome);
    let delta = ha.wrapping_sub(hb);

    if delta == 0 {
        0
    } else if delta < 0x80000000 {
        1 // a is ahead of b in the ring (a steals from b)
    } else {
        -1 // b is ahead of a (b steals from a)
    }
}

#[derive(Clone, Copy, Debug)]
#[repr(C, align(32))]
pub struct PhaseAgentSmart {
    // ---- BASE 16 BYTES (Identical to Minimal for pointer casting) ----
    pub phase: u32,
    pub energy: u32,
    pub base_freq: i32,
    pub state_flags: u32,

    // ---- ORTHOGONAL 16 BYTES (The "Smart" depth) ----
    /// Phase in an orthogonal branch of reality (e.g. quantum superposition)
    pub ortho_phase: u32,

    /// Hash or lattice index of the historically strongest attractor this agent synced to
    pub attractor_memory: u32,

    /// Epoch absolute chronos of the last profound mutation
    pub mutation_epoch: u32,

    /// Padding strictly guaranteeing 32-byte Array-of-Structures (AoS) SIMD alignment
    pub padding: u32,
}

impl Default for PhaseAgentMinimal {
    fn default() -> Self {
        Self {
            phase: 0,
            energy: 1000,
            base_freq: 0,
            state_flags: 0,
            genome: 0,
            memory: [0; 3],
        }
    }
}

impl Default for PhaseAgentSmart {
    fn default() -> Self {
        Self {
            phase: 0,
            energy: 1000,
            base_freq: 0,
            state_flags: 0,
            ortho_phase: 0,
            attractor_memory: 0,
            mutation_epoch: 0,
            padding: 0,
        }
    }
}
