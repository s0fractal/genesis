use wasm_bindgen::prelude::*;

include!("generated_constants.rs");

// FNV64 Mask is handled natively
pub const FNV64_MASK: u64 = 0xFFFFFFFFFFFFFFFF;

// O-80 The Mycelial Lattice: Homotopy Type Theory (HoTT) ∞-groupoid 
// Tau-buffer is a physical realization of a 4-level groupoid:
// Layer 0 (theta_now): Points (cells).
// Layer 1 (theta_f1): Paths (current synchronization/1-morphisms).
// Layer 2 (theta_f2): Paths between paths (2-morphisms, how paths deformed).
// Layer 3 (theta_f3): Higher coherent memory (3-morphisms).

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
