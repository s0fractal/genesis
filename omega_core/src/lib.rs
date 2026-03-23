pub mod phase_lattice;
pub mod granite;
pub mod lut;
pub mod constants;
pub mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn fnv1a_64(s: &str) -> u64 {
    let mut hash = 14695981039346656037u64;
    for code_unit in s.encode_utf16() {
        utils::mix_u64(&mut hash, code_unit as u64);
    }
    hash
}
