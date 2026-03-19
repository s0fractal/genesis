use wasm_bindgen::prelude::*;
use crate::memory::Field;

#[wasm_bindgen]
pub fn apply_perturbation(
    field: &mut Field, 
    x: i16, 
    y: i16, 
    energy: i16, 
    radius: i16, 
    phase_shift: i16, 
    plasmid_low: u32,
    plasmid_high: u32
) {
    let r = radius.abs() as i32;
    let r_sq = r * r;
    let cx = x as i32;
    let cy = y as i32;

    for dy in -r..=r {
        for dx in -r..=r {
            if dx * dx + dy * dy <= r_sq {
                let tx = cx + dx;
                let ty = cy + dy;
                if tx >= 0 && tx < 256 && ty >= 0 && ty < 256 {
                    let cell_idx = (ty * 256 + tx) as usize;
                    
                    // Thermal injection
                    let mut e = field.energy[cell_idx] as i32 + energy as i32;
                    if e > 255 { e = 255; }
                    if e < 0 { e = 0; }
                    field.energy[cell_idx] = e as u8;

                    // Phase shift
                    let mut phase = field.theta_now[cell_idx] as i32 + phase_shift as i32;
                    phase &= 255;
                    field.theta_now[cell_idx] = phase as u8;
                }
            }
        }
    }

    // Drop the Plasmid exactly at the epicenter (merging high/low back to u64)
    if cx >= 0 && cx < 256 && cy >= 0 && cy < 256 {
         let center_idx = (cy * 256 + cx) as usize;
         let plasmid_u64 = ((plasmid_high as u64) << 32) | (plasmid_low as u64);
         if plasmid_u64 != 0 {
             field.plasmids[center_idx] = plasmid_u64;
         }
    }
}
