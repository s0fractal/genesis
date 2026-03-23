use crate::constants::{MATH_Q_SCALE, PHASE_LUT_SIZE};

const MAX_BYTE: i16 = 255;

#[inline(always)]
pub(crate) fn wrap_phase(value: i16) -> u8 {
    wrap_index(value as i32, PHASE_LUT_SIZE as usize) as u8
}

#[inline(always)]
pub(crate) fn wrap_index(value: i32, modulo: usize) -> usize {
    value.rem_euclid(modulo as i32) as usize
}

#[inline(always)]
pub(crate) fn clamp_i16(value: i16, min: i16, max: i16) -> i16 {
    value.clamp(min, max)
}

#[inline(always)]
pub(crate) fn clamp_byte(value: i16) -> u8 {
    value.clamp(0, MAX_BYTE as i16) as u8
}

#[inline(always)]
pub(crate) fn phase_sin_i32(from_theta: u8, to_theta: u8) -> i32 {
    let index = to_theta.wrapping_sub(from_theta) as usize;
    crate::lut::SINE_LUT[index]
}

#[inline(always)]
pub(crate) fn phase_cos_i32(from_theta: u8, to_theta: u8) -> i32 {
    let index = to_theta.wrapping_sub(from_theta).wrapping_add(64) as usize;
    crate::lut::SINE_LUT[index]
}

#[inline(always)]
pub(crate) fn q10_round(x: i32) -> i32 {
    if x >= 0 { (x + (MATH_Q_SCALE / 2)) / MATH_Q_SCALE } else { (x - (MATH_Q_SCALE / 2)) / MATH_Q_SCALE }
}

#[inline(always)]
pub(crate) fn q10_round_i64(x: i64) -> i64 {
    if x >= 0 { (x + (MATH_Q_SCALE as i64 / 2)) / (MATH_Q_SCALE as i64) } else { (x - (MATH_Q_SCALE as i64 / 2)) / (MATH_Q_SCALE as i64) }
}

#[inline(always)]
pub(crate) fn mix_u64(hash: &mut u64, value: u64) {
    *hash ^= value;
    *hash = hash.wrapping_mul(1099511628211u64);
}
