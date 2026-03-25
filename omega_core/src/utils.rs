use crate::constants::PHASE_LUT_SIZE;

const MAX_BYTE: i16 = 255;

#[inline(always)]
pub(crate) fn wrap_phase(value: i16) -> u8 {
    wrap_index(value as i32, PHASE_LUT_SIZE as usize) as u8
}

#[inline(always)]
pub(crate) fn wrap_index(value: i32, modulo: usize) -> usize {
    // Era 218: Micro-Optimizations (Power-of-Two Masking)
    // Assumes `modulo` is strictly a power of 2 (e.g. 256, 512, 1024)
    (value & (modulo as i32 - 1)) as usize
}

#[inline(always)]
pub(crate) fn clamp_i16(value: i16, min: i16, max: i16) -> i16 {
    value.clamp(min, max)
}

#[inline(always)]
pub(crate) fn clamp_byte(value: i16) -> u8 {
    value.clamp(0, MAX_BYTE) as u8
}

#[inline(always)]
pub(crate) fn sin(from_theta: u8, to_theta: u8) -> i32 {
    let index = to_theta.wrapping_sub(from_theta) as usize;
    crate::constants::SINE_LUT[index]
}

#[inline(always)]
pub(crate) fn cos(from_theta: u8, to_theta: u8) -> i32 {
    let index = to_theta.wrapping_sub(from_theta).wrapping_add(64) as usize;
    crate::constants::SINE_LUT[index]
}


#[inline(always)]
pub(crate) fn mix_u64(hash: &mut u64, value: u64) {
    *hash ^= value;
    *hash = hash.wrapping_mul(1099511628211u64);
}
