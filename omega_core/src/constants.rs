use wasm_bindgen::prelude::*;

pub const MATH_Q_BITS: i32 = 10;
pub const MATH_Q_SCALE: i32 = 1 << MATH_Q_BITS;

pub const FNV64_OFFSET_BASIS: u64 = 14695981039346656037;
pub const FNV64_PRIME: u64 = 1099511628211;
pub const FNV64_MASK: u64 = 0xFFFFFFFFFFFFFFFF;

// O-80 The Mycelial Lattice: Homotopy Type Theory (HoTT) ∞-groupoid 
// Tau-buffer is a physical realization of a 4-level groupoid:
// Layer 0 (theta_now): Points (cells).
// Layer 1 (theta_f1): Paths (current synchronization/1-morphisms).
// Layer 2 (theta_f2): Paths between paths (2-morphisms, how paths deformed).
// Layer 3 (theta_f3): Higher coherent memory (3-morphisms).
pub const PHASE_TAU_DEPTH: i32 = 4;
pub const PHASE_LUT_SIZE: u32 = 256;
pub const PHASE_MAX_AMPLITUDE: u8 = 255;
pub const PHASE_MAX_LOCK: u8 = 255;
pub const PHASE_MAX_ENTANGLEMENT: u8 = 255;
pub const PHASE_HALF_PHASE: i32 = 128;
pub const PHASE_MIN_OMEGA: i16 = -16;
pub const PHASE_MAX_OMEGA: i16 = 16;
pub const PHASE_MAX_OMEGA_BRIDGE: i16 = 32;
pub const PHASE_FOSSILIZATION_PULSE_TICKS: i32 = 24;

// Scaled accurately to identical TS representation (x * 1024)
pub const KURAMOTO_COUPLING_BASE: i32 = 1024; 
pub const KURAMOTO_COUPLING_HARMONIC_PEER: i32 = 512; 
pub const KURAMOTO_COUPLING_ANTIPODE: i32 = 358; 
pub const KURAMOTO_COHERENCE_THRESHOLD_LOCK: i32 = 3072; 
pub const KURAMOTO_COHERENCE_THRESHOLD_HIGH: i32 = 4301; 
pub const KURAMOTO_ADOPTION_RESONANCE_THRESHOLD: i32 = 614; 
pub const KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD: i32 = 942; 
pub const KURAMOTO_COUPLING_PLASMID: i32 = 768; 
pub const KURAMOTO_PLASMID_DIFFUSION_RATE: i32 = 51; 

pub const MUTATION_BASE_COST: i32 = 50;
pub const MUTATION_MIN_COST: i32 = 5;
pub const MUTATION_MAX_COST: i32 = 500;
pub const MUTATION_SMOOTHING_FACTOR: i32 = 102; 

pub const SENATE_ORACLE_TIMEOUT_MS: i32 = 16;
pub const SENATE_MYCELIUM_MIN_LOCKS: i32 = 1000;
pub const SENATE_MYCELIUM_MIN_ENERGY: i32 = 220;
pub const SENATE_SHADOW_BUCKET_MIN: i32 = 1000;
pub const SENATE_SHADOW_BUCKET_MAX: i32 = 1024;

pub const TISSUE_MORPHOLOGICAL_HYSTERESIS: i32 = 5;
pub const TISSUE_MORPHOLOGICAL_DELTA_MIN: i32 = 154; 

#[wasm_bindgen]
pub fn get_kuramoto_coupling_base() -> i32 {
    KURAMOTO_COUPLING_BASE
}

#[wasm_bindgen]
pub fn get_mutation_base_cost() -> i32 {
    MUTATION_BASE_COST
}

#[wasm_bindgen]
pub fn get_senate_oracle_timeout() -> i32 {
    SENATE_ORACLE_TIMEOUT_MS
}

#[wasm_bindgen]
pub fn get_math_q_scale() -> i32 {
    MATH_Q_SCALE
}
