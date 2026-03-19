use wasm_bindgen::prelude::*;

const PHASE_LUT_SIZE: i16 = 256;
const HALF_PHASE: i16 = PHASE_LUT_SIZE / 2;
const MIN_OMEGA: i16 = -16;
const MAX_OMEGA: i16 = 16;
const MAX_BYTE: i16 = 255;

#[wasm_bindgen]
#[derive(Clone)]
#[repr(C)]
pub struct PhaseLatticeField {
    pub sectors: u32,
    pub radial_bins: u32,
    pub harmonics: u32,
    pub(crate) theta: Vec<u8>,
    pub(crate) omega: Vec<i16>,
    pub(crate) amplitude: Vec<u8>,
    pub(crate) lock: Vec<u8>,
    pub(crate) entanglement: Vec<u8>,
}

#[wasm_bindgen]
impl PhaseLatticeField {
    #[wasm_bindgen(constructor)]
    pub fn new(sectors: u32, radial_bins: u32, harmonics: u32) -> PhaseLatticeField {
        let size = (sectors * radial_bins * harmonics) as usize;
        let mut field = PhaseLatticeField {
            sectors,
            radial_bins,
            harmonics,
            theta: vec![0; size],
            omega: vec![0; size],
            amplitude: vec![0; size],
            lock: vec![0; size],
            entanglement: vec![0; size],
        };
        field.seed_deterministic();
        field
    }

    pub fn cell_count(&self) -> u32 {
        self.theta.len() as u32
    }

    pub fn ptr_theta(&self) -> *const u8 {
        self.theta.as_ptr()
    }

    pub fn ptr_omega(&self) -> *const i16 {
        self.omega.as_ptr()
    }

    pub fn ptr_amplitude(&self) -> *const u8 {
        self.amplitude.as_ptr()
    }

    pub fn ptr_lock(&self) -> *const u8 {
        self.lock.as_ptr()
    }

    pub fn ptr_entanglement(&self) -> *const u8 {
        self.entanglement.as_ptr()
    }

    pub fn seed_deterministic(&mut self) {
        for harmonic in 0..self.harmonics as usize {
            for rho in 0..self.radial_bins as usize {
                for sector in 0..self.sectors as usize {
                    let idx = self.idx(sector, rho, harmonic);
                    self.theta[idx] = wrap_phase((sector * 7 + rho * 19 + harmonic * 23) as i16);
                    self.omega[idx] = clamp_i16(((sector + rho + harmonic) % 5) as i16 - 2, MIN_OMEGA, MAX_OMEGA);
                    self.amplitude[idx] = clamp_byte((sector * 13 + rho * 17 + harmonic * 29) as i16);
                    self.lock[idx] = ((sector * 5 + rho * 11 + harmonic * 3) % 64) as u8;
                    self.entanglement[idx] = 0;
                }
            }
        }
    }

    pub fn rotate_global_phase(&mut self, delta: i16) {
        for theta in &mut self.theta {
            *theta = wrap_phase(*theta as i16 + delta);
        }
    }

    pub fn rotate_angular_address(&mut self, delta_sector: i32) {
        let mut next_theta = vec![0u8; self.theta.len()];
        let mut next_omega = vec![0i16; self.omega.len()];
        let mut next_amplitude = vec![0u8; self.amplitude.len()];
        let mut next_lock = vec![0u8; self.lock.len()];
        let mut next_entanglement = vec![0u8; self.entanglement.len()];

        for harmonic in 0..self.harmonics as usize {
            for rho in 0..self.radial_bins as usize {
                for sector in 0..self.sectors as usize {
                    let source = self.idx(sector, rho, harmonic);
                    let target_sector = wrap_index(sector as i32 + delta_sector, self.sectors as usize);
                    let target = self.idx(target_sector, rho, harmonic);
                    next_theta[target] = self.theta[source];
                    next_omega[target] = self.omega[source];
                    next_amplitude[target] = self.amplitude[source];
                    next_lock[target] = self.lock[source];
                    next_entanglement[target] = self.entanglement[source];
                }
            }
        }

        self.theta = next_theta;
        self.omega = next_omega;
        self.amplitude = next_amplitude;
        self.lock = next_lock;
        self.entanglement = next_entanglement;
    }
}

#[wasm_bindgen]
pub fn execute_phase_lattice_tick(field: &mut PhaseLatticeField) {
    let prev = field.clone();

    for harmonic in 0..field.harmonics as usize {
        for rho in 0..field.radial_bins as usize {
            for sector in 0..field.sectors as usize {
                let idx = field.idx(sector, rho, harmonic);

                let theta = prev.theta[idx];
                let omega = prev.omega[idx];
                let amplitude = prev.amplitude[idx] as i16;
                let lock = prev.lock[idx] as i16;
                let entanglement = prev.entanglement[idx];

                let left = prev.idx(wrap_index(sector as i32 - 1, prev.sectors as usize), rho, harmonic);
                let right = prev.idx(wrap_index(sector as i32 + 1, prev.sectors as usize), rho, harmonic);
                let inner = prev.idx(sector, rho.saturating_sub(1), harmonic);
                let outer = prev.idx(sector, usize::min(rho + 1, prev.radial_bins as usize - 1), harmonic);
                let harmonic_peer = prev.idx(sector, rho, (harmonic + 1) % prev.harmonics as usize);

                let mut kuramoto = phase_sin_sum(theta, prev.theta[left], 1.0)
                    + phase_sin_sum(theta, prev.theta[right], 1.0)
                    + phase_sin_sum(theta, prev.theta[inner], 1.0)
                    + phase_sin_sum(theta, prev.theta[outer], 1.0)
                    + phase_sin_sum(theta, prev.theta[harmonic_peer], 0.5);

                let mut coherence = phase_cos_sum(theta, prev.theta[left], 1.0)
                    + phase_cos_sum(theta, prev.theta[right], 1.0)
                    + phase_cos_sum(theta, prev.theta[inner], 1.0)
                    + phase_cos_sum(theta, prev.theta[outer], 1.0)
                    + phase_cos_sum(theta, prev.theta[harmonic_peer], 0.5);

                if prev.sectors % 2 == 0 {
                    let antipode_sector = (sector + prev.sectors as usize / 2) % prev.sectors as usize;
                    let antipode = prev.idx(antipode_sector, rho, harmonic);
                    let antipode_weight = (entanglement as f32 / 255.0) * 0.35;
                    kuramoto += phase_sin_sum(theta, prev.theta[antipode], antipode_weight);
                    coherence += phase_cos_sum(theta, prev.theta[antipode], antipode_weight);

                    let antipode_alignment = phase_cos(theta, prev.theta[antipode]);
                    field.entanglement[idx] = if antipode_alignment > 0.92 && amplitude > 96 {
                        entanglement.saturating_add(8)
                    } else {
                        entanglement.saturating_sub(3)
                    };
                }

                let omega_delta = kuramoto.round() as i16;
                let next_omega = clamp_i16(omega + omega_delta, MIN_OMEGA, MAX_OMEGA);
                let next_theta = wrap_phase(theta as i16 + next_omega);
                let amplitude_delta = (coherence * 6.0).round() as i16 - (lock / 64);
                let lock_delta = if coherence >= 3.0 { 8 } else { -4 };

                field.theta[idx] = next_theta;
                field.omega[idx] = next_omega;
                field.amplitude[idx] = clamp_byte(amplitude + amplitude_delta);
                field.lock[idx] = clamp_byte(lock + lock_delta);
            }
        }
    }
}

#[wasm_bindgen]
pub fn phase_lattice_signature(field: &PhaseLatticeField) -> String {
    let mut hash = 14695981039346656037u64;
    for harmonic in 0..field.harmonics as usize {
        for rho in 0..field.radial_bins as usize {
            for sector in 0..field.sectors as usize {
                let idx = field.idx(sector, rho, harmonic);
                mix_u64(&mut hash, sector as u64);
                mix_u64(&mut hash, rho as u64);
                mix_u64(&mut hash, harmonic as u64);
                mix_u64(&mut hash, field.theta[idx] as u64);
                mix_u64(&mut hash, (field.omega[idx] as i32) as u32 as u64);
                mix_u64(&mut hash, field.amplitude[idx] as u64);
                mix_u64(&mut hash, field.lock[idx] as u64);
                mix_u64(&mut hash, field.entanglement[idx] as u64);
            }
        }
    }
    format!("{hash:016x}")
}

#[wasm_bindgen]
pub fn phase_lattice_total_amplitude(field: &PhaseLatticeField) -> u32 {
    field.amplitude.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn phase_lattice_total_entanglement(field: &PhaseLatticeField) -> u32 {
    field.entanglement.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn phase_lattice_omega_span(field: &PhaseLatticeField) -> String {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    for omega in &field.omega {
        min = min.min(*omega);
        max = max.max(*omega);
    }
    format!("{min}..{max}")
}

impl PhaseLatticeField {
    fn idx(&self, sector: usize, rho: usize, harmonic: usize) -> usize {
        harmonic * self.radial_bins as usize * self.sectors as usize
            + rho * self.sectors as usize
            + sector
    }
}

fn wrap_phase(value: i16) -> u8 {
    wrap_index(value as i32, PHASE_LUT_SIZE as usize) as u8
}

fn wrap_index(value: i32, modulo: usize) -> usize {
    value.rem_euclid(modulo as i32) as usize
}

fn clamp_i16(value: i16, min: i16, max: i16) -> i16 {
    value.clamp(min, max)
}

fn clamp_byte(value: i16) -> u8 {
    value.clamp(0, MAX_BYTE) as u8
}

fn signed_phase_delta(from_theta: u8, to_theta: u8) -> i16 {
    let raw = (to_theta as i16 - from_theta as i16).rem_euclid(PHASE_LUT_SIZE);
    if raw > HALF_PHASE {
        raw - PHASE_LUT_SIZE
    } else {
        raw
    }
}

fn phase_radians(from_theta: u8, to_theta: u8) -> f32 {
    signed_phase_delta(from_theta, to_theta) as f32 * std::f32::consts::TAU / PHASE_LUT_SIZE as f32
}

fn phase_sin(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).sin()
}

fn phase_cos(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).cos()
}

fn phase_sin_sum(from_theta: u8, to_theta: u8, weight: f32) -> f32 {
    phase_sin(from_theta, to_theta) * weight
}

fn phase_cos_sum(from_theta: u8, to_theta: u8, weight: f32) -> f32 {
    phase_cos(from_theta, to_theta) * weight
}

fn mix_u64(hash: &mut u64, value: u64) {
    *hash ^= value;
    *hash = hash.wrapping_mul(1099511628211u64);
}

#[cfg(test)]
mod tests {
    use super::{execute_phase_lattice_tick, PhaseLatticeField};

    fn run_ticks(field: &mut PhaseLatticeField, ticks: usize) {
        for _ in 0..ticks {
            execute_phase_lattice_tick(field);
        }
    }

    fn assert_same_state(left: &PhaseLatticeField, right: &PhaseLatticeField) {
        assert_eq!(left.theta, right.theta, "theta mismatch");
        assert_eq!(left.omega, right.omega, "omega mismatch");
        assert_eq!(left.amplitude, right.amplitude, "amplitude mismatch");
        assert_eq!(left.lock, right.lock, "lock mismatch");
        assert_eq!(left.entanglement, right.entanglement, "entanglement mismatch");
    }

    #[test]
    fn phase_lattice_is_deterministic() {
        let mut left = PhaseLatticeField::new(32, 6, 3);
        let mut right = PhaseLatticeField::new(32, 6, 3);
        run_ticks(&mut left, 24);
        run_ticks(&mut right, 24);
        assert_same_state(&left, &right);
    }

    #[test]
    fn global_phase_rotation_is_equivariant() {
        let mut rotated_seed = PhaseLatticeField::new(32, 6, 3);
        let mut baseline = PhaseLatticeField::new(32, 6, 3);
        rotated_seed.rotate_global_phase(37);

        run_ticks(&mut rotated_seed, 24);
        run_ticks(&mut baseline, 24);
        baseline.rotate_global_phase(37);

        assert_same_state(&rotated_seed, &baseline);
    }

    #[test]
    fn angular_rotation_is_equivariant() {
        let mut rotated_seed = PhaseLatticeField::new(32, 6, 3);
        let mut baseline = PhaseLatticeField::new(32, 6, 3);
        rotated_seed.rotate_angular_address(5);

        run_ticks(&mut rotated_seed, 24);
        run_ticks(&mut baseline, 24);
        baseline.rotate_angular_address(5);

        assert_same_state(&rotated_seed, &baseline);
    }
}
