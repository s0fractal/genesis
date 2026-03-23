use wasm_bindgen::prelude::*;

// O-176: The Granite Core (AoS Topology)
// A mathematically rigid, perfectly 16-byte aligned structure.
// This guarantees that the WebGPU Compute Shader pulls contiguous 128-bit blocks,
// drastically improving hardware cache locality over the fragmented Struct of Arrays.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, packed(4))]
#[derive(Default)]
pub struct PhaseAgent {
    pub theta: u8,           // 1 byte
    pub energy: u8,          // 1 byte (Amplitude/Resonance)
    pub omega: i16,          // 2 bytes
    pub lock: u8,            // 1 byte
    pub entanglement: u8,    // 1 byte
    pub _pad: u16,           // 2 bytes (Padding to reach 8-byte alignment before the u64)
    pub plasmid: u64,        // 8 bytes (Mycelial Semantic Blueprint)
}

