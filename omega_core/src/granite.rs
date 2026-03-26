use wasm_bindgen::prelude::*;

// O-176: The Granite Core (AoS Topology)
// A mathematically rigid, perfectly 32-byte aligned structure.
// This guarantees that the WebGPU Compute Shader pulls contiguous 256-bit blocks.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(C)]
pub struct PhaseAgent {
    pub plasmid: u64,        // 0-7 (8-byte aligned naturally)
    pub omega: i16,          // 8-9
    pub time_dilation: u8,   // 10
    pub preferred_theta: u8, // 11
    pub theta: u8,           // 12
    pub energy: u8,          // 13
    pub lock: u8,            // 14
    pub entanglement: u8,    // 15
    pub memory_strength: u8, // 16
}

impl Default for PhaseAgent {
    fn default() -> Self {
        PhaseAgent {
            plasmid: 0,
            omega: 0,
            time_dilation: 0,
            preferred_theta: 0,
            theta: 0,
            energy: 0,
            lock: 0,
            entanglement: 0,
            memory_strength: 0,
        }
    }
}
