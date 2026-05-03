use crate::constants::{PHASE_LUT_SIZE, PHASE_MAX_AMPLITUDE};
use crate::fixed_point::*;

#[inline(always)]
pub(crate) fn wrap_phase(value: i16) -> u8 {
    crate::constants::wrap_index(value as i32, PHASE_LUT_SIZE) as u8
}

#[inline(always)]
pub(crate) fn wrap_index_usize(value: i32, modulo: usize) -> usize {
    crate::constants::wrap_index(value, modulo as i32) as usize
}

#[inline(always)]
pub(crate) fn clamp_i16(value: i16, min: i16, max: i16) -> i16 {
    crate::constants::clamp_i32(value as i32, min as i32, max as i32) as i16
}

#[inline(always)]
pub(crate) fn clamp_byte(value: i16) -> u8 {
    crate::constants::clamp_i32(value as i32, 0, PHASE_MAX_AMPLITUDE as i32) as u8
}

#[inline(always)]
pub(crate) fn sin(from_theta: u8, to_theta: u8) -> i32 {
    sin_q20(from_theta, to_theta)
}

#[inline(always)]
pub(crate) fn cos(from_theta: u8, to_theta: u8) -> i32 {
    cos_q20(from_theta, to_theta)
}
