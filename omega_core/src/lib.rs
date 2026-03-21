pub mod memory;
pub mod simd_tick;
pub mod phase_lattice;
pub mod perturbation;
pub mod generated_biology;

use wasm_bindgen::prelude::*;

static mut GLOBAL_PHASE_LUT: [f32; 256] = [0.0; 256];

#[wasm_bindgen]
pub fn get_phase_lut_ptr() -> *mut f32 {
    unsafe { GLOBAL_PHASE_LUT.as_mut_ptr() }
}
