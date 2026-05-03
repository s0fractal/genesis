// omega_core/src/fixed_point.rs
// Era 250: Absolute Integer Substrate — Q20/Q24 Fixed-Point Arithmetic

use crate::constants::{SINE_LUT, Q20_SCALE, Q24_SCALE};

#[inline(always)]
pub const fn q20_mul(a: i32, b: i32) -> i32 {
    ((a as i64 * b as i64) / Q20_SCALE as i64) as i32
}

#[inline(always)]
pub const fn q20_div(a: i32, b: i32) -> i32 {
    ((a as i64 * Q20_SCALE as i64) / b as i64) as i32
}

#[inline(always)]
pub const fn q24_mul(a: i32, b: i32) -> i32 {
    ((a as i64 * b as i64) / Q24_SCALE as i64) as i32
}

#[inline(always)]
pub const fn q24_div(a: i32, b: i32) -> i32 {
    ((a as i64 * Q24_SCALE as i64) / b as i64) as i32
}

// Q20-scaled sine/cosine mathematically normalized from the native Q10 LUT
#[inline(always)]
pub fn sin_q20(from_theta: u8, to_theta: u8) -> i32 {
    let index = (to_theta as u32 + 256 - from_theta as u32) % 256;
    let base_q10 = SINE_LUT[index as usize];
    (base_q10 as i64 * Q20_SCALE as i64 / 1024) as i32
}

#[inline(always)]
pub fn cos_q20(from_theta: u8, to_theta: u8) -> i32 {
    let index = (to_theta as u32 + 256 - from_theta as u32 + 64) % 256;
    let base_q10 = SINE_LUT[index as usize];
    (base_q10 as i64 * Q20_SCALE as i64 / 1024) as i32
}
