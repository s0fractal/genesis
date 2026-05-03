use wasm_bindgen::prelude::*;

// O-176: The Granite Core (AoS Topology)
// A mathematically rigid, 24-byte structure (8-byte aligned).
// NOTE: NOT 32-byte aligned. The comment previously claimed 256-bit blocks,
// but the actual size is 192 bits (24 bytes). WebGPU accesses it via byte offsets.
// HIGH-6 FIX: Documented real size. Any change to layout MUST sync with
// TypeScript offset calculations in src/lens/phase_compute.ts.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Default)]
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

// Compile-time size guard: TS expects 24 bytes per PhaseAgent.
// If this fails, update src/lens/phase_compute.ts accordingly.
const _: () = assert!(core::mem::size_of::<PhaseAgent>() == 24);
