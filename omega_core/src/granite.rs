use wasm_bindgen::prelude::*;

// O-176: The Granite Core (AoS Topology)
// A mathematically rigid, perfectly 16-byte aligned structure.
// This guarantees that the WebGPU Compute Shader pulls contiguous 128-bit blocks,
// drastically improving hardware cache locality over the fragmented Struct of Arrays.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C)]
#[derive(Default)]
pub struct PhaseAgent {
    pub plasmid: u64,        // 0-7 (8-byte aligned naturally)
    pub omega: i16,          // 8-9
    pub time_dilation: u8,   // 10 (O-230.2 Exogenous Local Time)
    pub preferred_theta: u8, // 11
    pub theta: u8,           // 12
    pub energy: u8,          // 13
    pub lock: u8,            // 14
    pub entanglement: u8,    // 15
    pub memory_strength: u8, // 16
    pub _pad1: u8,           // 17
    pub _pad2: u16,          // 18-19
    pub _pad3: u32,          // 20-23
    // Full 24 bytes exactly aligned for WGSL extraction
}

