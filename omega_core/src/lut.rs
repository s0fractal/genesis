// O-147 Vector P.1: Integer Q-Format Trigonometry
// Fixed-point sine look-up table (Q10 format). Scaled by 1024.
use crate::constants::ATAN_LUT;

/// Cryptographically deterministic i32 replacement for `f64::atan2(y, x)` returning 0-255 phase.
pub fn atan2_u8(y: i32, x: i32) -> u8 {
    if x == 0 && y == 0 { return 0; }
    
    let abs_y = y.abs();
    let abs_x = x.abs();
    let a = abs_y.min(abs_x);
    let b = abs_y.max(abs_x);
    
    let mut ratio = if b == 0 { 0 } else { (a * 128) / b };
    if ratio > 128 { ratio = 128; }
    
    let octant_angle = ATAN_LUT[ratio as usize];
    
    let quadrant_angle = if abs_y > abs_x { 64 - octant_angle } else { octant_angle };
    
    if x < 0 {
        if y < 0 {
            128u8.wrapping_add(quadrant_angle)
        } else {
            128u8.wrapping_sub(quadrant_angle)
        }
    } else {
        if y < 0 {
            256u16.wrapping_sub(quadrant_angle as u16) as u8
        } else {
            quadrant_angle
        }
    }
}
