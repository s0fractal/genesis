use wasm_bindgen::prelude::*;
use crate::memory::Field;

#[wasm_bindgen]
pub fn execute_simd_tick(field: &mut Field, lut_ptr: *const i16) {
    let size = field.x.len();
    let default_lut: [i16; 256] = [0; 256];
    let lut = if lut_ptr.is_null() {
        &default_lut[..]
    } else {
        unsafe { std::slice::from_raw_parts(lut_ptr, 256) }
    };
    
    // Process in chunks of 8 (since eight i16s fit in a 128-bit vector)
    for i in (0..size).step_by(8) {
        // In a purely `#![feature(wasm_simd)]` environment, this loop is replaced 
        // with `v128_load`, `i8x16_add`, the swizzle `lut_gather`, and `v128_bitselect`.
        
        // For standard compilation, we execute the rigorous logical equivalent 
        // of the Zero-Alloc Register Superposition Tournament:
        
        for lane in 0..8 {
            let idx = i + lane;
            if idx >= size { break; }
            
            // --- Ontology 20: AOMQ Freeze ---
            // If the cell is blocked awaiting Oracle semantic evaluation, freeze its temporal physics.
            if field.cell_status[idx] == 1 {
                continue;
            }
            
            let p = field.theta_now[idx];
            let raw_energy = field.energy[idx] as i16;
            
            let mut best_energy = raw_energy;
            let mut best_score = i16::MAX;
            
            // The Superposition Tournament (4 candidate $\Delta$ offsets)
            let deltas: [u8; 4] = [1, 2, 3, 4];
            
            for &d in &deltas {
                // Temporary phase shift mutation (Access offset)
                let p_mut = p.wrapping_add(d);
                let val = lut[p_mut as usize];
                
                // Invoke the auto-generated AST from Ontology 16 Compiler Bridge!
                let mutated_val = crate::generated_biology::fast_abs(val as i32) as i16;
                let next_energy = raw_energy.saturating_add(mutated_val);
                
                // Drift evaluation (geometric tension against the future f1 horizon)
                let future_val = lut[field.theta_f1[idx] as usize];
                let score = (next_energy - future_val).abs();
                
                // Evolutionary Selection within the "Register" -> `v128_bitselect`
                if score < best_score {
                    best_score = score;
                    best_energy = next_energy;
                }
            }
            
            // Collapse the superposition into reality
            field.energy[idx] = best_energy.clamp(0, 255) as u8;
            
            // Advance local time via native frequency omega
            field.theta_now[idx] = field.theta_now[idx].wrapping_add(field.omega[idx]);

            // --- Ontology 11: The Genetic Wave-Field ---

            // 1. Plasmid Secretion (Autopoiesis)
            // If the cell achieves extreme mathematical coherence (low tension score, high energy)
            if best_score < 5 && best_energy > 200 {
                // Secrete a mathematical plasmid encoding current optimal geometry
                let structural_plasmid = (field.theta_now[idx] as u64) | ((field.omega[idx] as u64) << 8);
                field.plasmids[idx] = structural_plasmid;
            }

            // 2. Horizontal Gene Transfer (Plasmid Adoption)
            // If the cell is in chaotic distress (high geometric tension) and failing to resolve reality
            if best_score > 100 {
                // --- Ontology 13: Immunological Rejection ---
                // If local energy is extremely toxic/hot, the cell is inflamed and rejects external ideas.
                if best_energy < 240 {
                    // Sample adjacent neighbor's plasmid (Northern neighbor W-offset)
                    let w = field.width as usize;
                    let neighbor_idx = if idx >= w { idx - w } else { idx + w };
                    let mut adopted = false;
                    
                    if neighbor_idx < size {
                        let foreign_plasmid = field.plasmids[neighbor_idx];
                        if foreign_plasmid != 0 {
                            // Incorporate plasmid: Overwrite host structural genetic parameters
                            field.theta_now[idx] = (foreign_plasmid & 0xFF) as u8;
                            field.omega[idx] = ((foreign_plasmid >> 8) & 0xFF) as u8;
                            // Officially adopt the plasmid footprint so the Idea's color spreads!
                            field.plasmids[idx] = foreign_plasmid;
                            adopted = true;
                        }
                    }
                    
                    // --- Ontology 20: Pray to the Oracle ---
                    // If severe chaos persists (score > 160) and no local plasmid solved it, trigger an Oracle Request.
                    if !adopted && best_score > 160 && field.oracle_request_count < 1024 {
                        field.oracle_requests[field.oracle_request_count] = idx as u32;
                        field.oracle_request_count += 1;
                        field.cell_status[idx] = 1; // AWAITING_ORACLE
                    }
                }
            }

            // 3. Hebbian Phase Locks (Topological Freezing)
            // If phase velocity synchronizes with neighbor, permanently merge tensor transmission coefficients
            let right_idx = idx + 1;
            if right_idx < size {
                if field.theta_now[idx] == field.theta_now[right_idx] {
                    field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_add(1);
                } else {
                    // Ontology 13: Continual degeneration of dead phase locks
                    field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_sub(1);
                }
            }

            // 4. Plasmid Decay (TTL)
            // If energy is extremely low (matrix is starving), plasmids dissolve back into pure math
            if best_energy < 15 && field.plasmids[idx] != 0 {
                // Stochastic decay utilizing structural phase to avoid uniform visual erasure
                if (field.theta_now[idx] % 4) == 0 {
                    field.plasmids[idx] = 0;
                }
            }
        }
    }
}

#[wasm_bindgen]
pub fn execute_phase_bridge_tick(field: &mut Field, lut_ptr: *const i16) {
    let size = field.x.len();
    let width = field.width as usize;
    let height = field.height as usize;
    let default_lut: [i16; 256] = [0; 256];
    let lut = if lut_ptr.is_null() {
        &default_lut[..]
    } else {
        unsafe { std::slice::from_raw_parts(lut_ptr, 256) }
    };

    let theta_prev = field.theta_now.clone();
    let omega_prev = field.omega.clone();
    let energy_prev = field.energy.clone();
    let plasmids_prev = field.plasmids.clone();
    let locks_prev = field.hebbian_locks.clone();
    let status_prev = field.cell_status.clone();

    for idx in 0..size {
        if status_prev[idx] == 1 {
            continue;
        }

        let sector = idx % width;
        let rho = idx / width;

        let left_idx = idx_from_sector_rho(width, height, wrap_index(sector as i32 - 1, width), rho);
        let right_idx = idx_from_sector_rho(width, height, wrap_index(sector as i32 + 1, width), rho);
        let inner_idx = idx_from_sector_rho(width, height, sector, rho.saturating_sub(1));
        let outer_idx = idx_from_sector_rho(width, height, sector, usize::min(rho + 1, height - 1));
        let antipode_idx = if width % 2 == 0 {
            idx_from_sector_rho(width, height, (sector + width / 2) % width, rho)
        } else {
            idx
        };

        let p = theta_prev[idx];
        let raw_energy = energy_prev[idx] as i16;
        let local_target = local_target(lut, &theta_prev, [left_idx, right_idx, inner_idx, outer_idx], antipode_idx, width % 2 == 0);

        let mut best_energy = raw_energy;
        let mut best_score = i16::MAX;
        for &d in &[1u8, 2, 3, 4] {
            let p_mut = p.wrapping_add(d);
            let val = lut[p_mut as usize];
            let mutated_val = crate::generated_biology::fast_abs(val as i32) as i16;
            let next_energy = raw_energy.saturating_add(mutated_val);
            let score = (next_energy - local_target).abs();
            if score < best_score {
                best_score = score;
                best_energy = next_energy;
            }
        }

        let antipode_weight = if width % 2 == 0 {
            (locks_prev[idx] as f32 / 255.0) * 0.35
        } else {
            0.0
        };

        let kuramoto =
            phase_sin(theta_prev[idx], theta_prev[left_idx]) +
            phase_sin(theta_prev[idx], theta_prev[right_idx]) +
            phase_sin(theta_prev[idx], theta_prev[inner_idx]) +
            phase_sin(theta_prev[idx], theta_prev[outer_idx]) +
            phase_sin(theta_prev[idx], theta_prev[antipode_idx]) * antipode_weight;

        let coherence =
            phase_cos(theta_prev[idx], theta_prev[left_idx]) +
            phase_cos(theta_prev[idx], theta_prev[right_idx]) +
            phase_cos(theta_prev[idx], theta_prev[inner_idx]) +
            phase_cos(theta_prev[idx], theta_prev[outer_idx]) +
            phase_cos(theta_prev[idx], theta_prev[antipode_idx]) * antipode_weight;

        let next_omega = clamp_bridge_omega(decode_bridge_omega(omega_prev[idx]) + kuramoto.round() as i16);
        let next_theta = wrap_phase(theta_prev[idx] as i16 + next_omega);
        let coupled_energy = (best_energy + (coherence * 6.0).round() as i16 - (locks_prev[idx] as i16 / 64)).clamp(0, 255);

        field.theta_now[idx] = next_theta;
        field.omega[idx] = encode_bridge_omega(next_omega);
        field.energy[idx] = coupled_energy as u8;
        field.theta_f1[idx] = theta_prev[left_idx];
        field.theta_f2[idx] = theta_prev[right_idx];
        field.theta_f3[idx] = theta_prev[antipode_idx];

        if coherence > 3.0 && coupled_energy > 200 {
            let structural_plasmid =
                (field.theta_now[idx] as u64) |
                ((field.omega[idx] as u64) << 8) |
                ((field.hebbian_locks[idx] as u64) << 16) |
                ((coupled_energy as u64) << 24);
            field.plasmids[idx] = structural_plasmid;
        }

        if best_score > 100 && coupled_energy < 240 {
            let neighbors = [left_idx, right_idx, inner_idx, outer_idx, antipode_idx];
            let mut adopted = false;
            let mut best_resonance = -2.0f32;
            let mut donor_plasmid = 0u64;

            for &neighbor_idx in &neighbors {
                let candidate_plasmid = plasmids_prev[neighbor_idx];
                if candidate_plasmid == 0 {
                    continue;
                }
                let candidate_resonance = phase_cos(theta_prev[idx], theta_prev[neighbor_idx]);
                if candidate_resonance > best_resonance {
                    best_resonance = candidate_resonance;
                    donor_plasmid = candidate_plasmid;
                }
            }

            if donor_plasmid != 0 && best_resonance > 0.15 {
                field.theta_now[idx] = (donor_plasmid & 0xFF) as u8;
                let donor_omega = decode_bridge_omega(((donor_plasmid >> 8) & 0xFF) as u8);
                field.omega[idx] = encode_bridge_omega(clamp_bridge_omega(donor_omega));
                field.plasmids[idx] = donor_plasmid;
                adopted = true;
            }

            if !adopted && best_score > 160 && field.oracle_request_count < 1024 {
                field.oracle_requests[field.oracle_request_count] = idx as u32;
                field.oracle_request_count += 1;
                field.cell_status[idx] = 1;
            }
        }

        let alignment = phase_cos(theta_prev[idx], theta_prev[right_idx]).max(phase_cos(theta_prev[idx], theta_prev[antipode_idx]));
        if alignment > 0.92 {
            field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_add(2);
        } else {
            field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_sub(1);
        }

        if coupled_energy < 15 && field.plasmids[idx] != 0 && field.theta_now[idx] % 4 == 0 {
            field.plasmids[idx] = 0;
        }
    }
}

#[wasm_bindgen]
pub fn field_signature(field: &Field) -> String {
    let mut hash = 14695981039346656037u64;
    for idx in 0..field.theta_now.len() {
        mix_u64(&mut hash, idx as u64);
        mix_u64(&mut hash, field.theta_now[idx] as u64);
        mix_u64(&mut hash, field.theta_f1[idx] as u64);
        mix_u64(&mut hash, field.theta_f2[idx] as u64);
        mix_u64(&mut hash, field.theta_f3[idx] as u64);
        mix_u64(&mut hash, field.omega[idx] as u64);
        mix_u64(&mut hash, field.energy[idx] as u64);
        mix_u64(&mut hash, field.hebbian_locks[idx] as u64);
        mix_u64(&mut hash, field.plasmids[idx]);
        mix_u64(&mut hash, field.cell_status[idx] as u64);
    }
    format!("{hash:016x}")
}

#[wasm_bindgen]
pub fn field_total_energy(field: &Field) -> u32 {
    field.energy.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn field_total_locks(field: &Field) -> u32 {
    field.hebbian_locks.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn field_total_plasmids(field: &Field) -> u32 {
    field.plasmids.iter().filter(|value| **value != 0).count() as u32
}

#[wasm_bindgen]
pub fn field_omega_span(field: &Field) -> String {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    for raw in &field.omega {
        let omega = decode_bridge_omega(*raw);
        min = min.min(omega);
        max = max.max(omega);
    }
    format!("{min}..{max}")
}

#[wasm_bindgen]
pub fn seed_phase_bridge_pattern(field: &mut Field) {
    let size = (field.width * field.height) as usize;
    let width = field.width as usize;

    field.oracle_request_count = 0;
    for idx in 0..size {
        let sector = idx % width;
        let rho = idx / width;
        field.theta_now[idx] = ((sector * 17 + rho * 11) & 255) as u8;
        field.theta_f1[idx] = 0;
        field.theta_f2[idx] = 0;
        field.theta_f3[idx] = 0;
        field.omega[idx] = ((sector as i16 - (rho as i16 % 5)) as i8) as u8;
        field.energy[idx] = ((sector * 7 + rho * 13) & 255) as u8;
        field.hebbian_locks[idx] = ((sector * 3 + rho * 5) & 63) as u8;
        field.cell_status[idx] = 0;
        field.plasmids[idx] = if (sector + rho) % 9 == 0 {
            0xAA55u64 | ((sector as u64) << 16) | ((rho as u64) << 24)
        } else {
            0
        };
    }
}

#[wasm_bindgen]
pub fn rotate_field_sectors(field: &mut Field, delta: i32) {
    let width = field.width as usize;
    let height = field.height as usize;
    let mut theta_now = vec![0u8; field.theta_now.len()];
    let mut theta_f1 = vec![0u8; field.theta_f1.len()];
    let mut theta_f2 = vec![0u8; field.theta_f2.len()];
    let mut theta_f3 = vec![0u8; field.theta_f3.len()];
    let mut omega = vec![0u8; field.omega.len()];
    let mut energy = vec![0u8; field.energy.len()];
    let mut locks = vec![0u8; field.hebbian_locks.len()];
    let mut plasmids = vec![0u64; field.plasmids.len()];
    let mut status = vec![0u8; field.cell_status.len()];

    for rho in 0..height {
        for sector in 0..width {
            let source = rho * width + sector;
            let target_sector = wrap_index(sector as i32 + delta, width);
            let target = rho * width + target_sector;
            theta_now[target] = field.theta_now[source];
            theta_f1[target] = field.theta_f1[source];
            theta_f2[target] = field.theta_f2[source];
            theta_f3[target] = field.theta_f3[source];
            omega[target] = field.omega[source];
            energy[target] = field.energy[source];
            locks[target] = field.hebbian_locks[source];
            plasmids[target] = field.plasmids[source];
            status[target] = field.cell_status[source];
        }
    }

    field.theta_now = theta_now;
    field.theta_f1 = theta_f1;
    field.theta_f2 = theta_f2;
    field.theta_f3 = theta_f3;
    field.omega = omega;
    field.energy = energy;
    field.hebbian_locks = locks;
    field.plasmids = plasmids;
    field.cell_status = status;
}

fn idx_from_sector_rho(width: usize, _height: usize, sector: usize, rho: usize) -> usize {
    rho * width + sector
}

fn wrap_index(value: i32, modulo: usize) -> usize {
    value.rem_euclid(modulo as i32) as usize
}

fn wrap_phase(value: i16) -> u8 {
    value.rem_euclid(256) as u8
}

fn decode_bridge_omega(raw: u8) -> i16 {
    (raw as i8) as i16
}

fn encode_bridge_omega(value: i16) -> u8 {
    (value as i8) as u8
}

fn clamp_bridge_omega(value: i16) -> i16 {
    value.clamp(-32, 32)
}

fn signed_phase_delta(from_theta: u8, to_theta: u8) -> i16 {
    let raw = (to_theta as i16 - from_theta as i16).rem_euclid(256);
    if raw > 128 {
        raw - 256
    } else {
        raw
    }
}

fn phase_radians(from_theta: u8, to_theta: u8) -> f32 {
    signed_phase_delta(from_theta, to_theta) as f32 * std::f32::consts::TAU / 256.0
}

fn phase_sin(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).sin()
}

fn phase_cos(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).cos()
}

fn local_target(lut: &[i16], theta_prev: &[u8], neighborhood: [usize; 4], antipode_idx: usize, include_antipode: bool) -> i16 {
    let mut total = 0i32;
    let mut count = 0i32;
    for idx in neighborhood {
        total += lut[theta_prev[idx] as usize] as i32;
        count += 1;
    }
    if include_antipode {
        total += (lut[theta_prev[antipode_idx] as usize] as i32) / 2;
        count += 1;
    }
    if count == 0 {
        0
    } else {
        (total / count) as i16
    }
}

fn mix_u64(hash: &mut u64, value: u64) {
    *hash ^= value;
    *hash = hash.wrapping_mul(1099511628211u64);
}

#[cfg(test)]
mod phase_bridge_tests {
    use super::execute_phase_bridge_tick;
    use crate::memory::Field;

    fn seed_field() -> Field {
        let mut field = Field::new(32, 8);
        super::seed_phase_bridge_pattern(&mut field);
        field
    }

    fn rotate_rows(field: &Field, delta: usize) -> Field {
        let mut rotated = seed_field();
        rotated.theta_now.clone_from(&field.theta_now);
        rotated.theta_f1.clone_from(&field.theta_f1);
        rotated.theta_f2.clone_from(&field.theta_f2);
        rotated.theta_f3.clone_from(&field.theta_f3);
        rotated.omega.clone_from(&field.omega);
        rotated.energy.clone_from(&field.energy);
        rotated.hebbian_locks.clone_from(&field.hebbian_locks);
        rotated.plasmids.clone_from(&field.plasmids);
        rotated.cell_status.clone_from(&field.cell_status);
        super::rotate_field_sectors(&mut rotated, delta as i32);
        rotated
    }

    fn assert_same_state(left: &Field, right: &Field) {
        assert_eq!(left.theta_now, right.theta_now, "theta_now mismatch");
        assert_eq!(left.theta_f1, right.theta_f1, "theta_f1 mismatch");
        assert_eq!(left.theta_f2, right.theta_f2, "theta_f2 mismatch");
        assert_eq!(left.theta_f3, right.theta_f3, "theta_f3 mismatch");
        assert_eq!(left.omega, right.omega, "omega mismatch");
        assert_eq!(left.energy, right.energy, "energy mismatch");
        assert_eq!(left.hebbian_locks, right.hebbian_locks, "lock mismatch");
        assert_eq!(left.plasmids, right.plasmids, "plasmid mismatch");
        assert_eq!(left.cell_status, right.cell_status, "status mismatch");
    }

    #[test]
    fn phase_bridge_is_deterministic() {
        let mut left = seed_field();
        let mut right = seed_field();
        for _ in 0..8 {
            execute_phase_bridge_tick(&mut left, std::ptr::null());
            execute_phase_bridge_tick(&mut right, std::ptr::null());
        }
        assert_same_state(&left, &right);
    }

    #[test]
    fn phase_bridge_is_angularly_equivariant() {
        let mut rotated_seed = rotate_rows(&seed_field(), 5);
        let mut baseline = seed_field();

        for _ in 0..6 {
            execute_phase_bridge_tick(&mut rotated_seed, std::ptr::null());
            execute_phase_bridge_tick(&mut baseline, std::ptr::null());
        }

        let rotated_baseline = rotate_rows(&baseline, 5);
        assert_same_state(&rotated_seed, &rotated_baseline);
    }
}
