//! Variable Agent Structure
//! 
//! OMEGA-64 dynamically saturates hardware using these Memory-Aligned structures.
//! Minimum unit is 16 bytes for perfect GPU `vec4<u32>` alignment.

#[derive(Clone, Copy, Debug)]
#[repr(C, align(16))]
pub struct PhaseAgentMinimal {
    /// High-precision Q20 or continuous integer mapping of the 0..255 phase.
    pub phase: u32,
    
    /// ATP Energy limit constraints
    pub energy: u32,
    
    /// Fundamental oscillator frequency `omega_i` (signed Q20)
    pub base_freq: i32,
    
    /// Bitmask for status: [1: is_locked] [7: species] [24: reserved custom traits]
    pub state_flags: u32,
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
