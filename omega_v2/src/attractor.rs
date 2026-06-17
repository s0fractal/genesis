// Attractor Matrix & Dipole Validation

// Attractors are public, immutable matrices with a dipole pair:
// direct matrix (attraction) + inverse matrix (cleansing/inversion).
// They pulse at a fixed frequency and amplitude, modifying local phase space.

/// 16-byte attractor matrix. Fits in GPU uniform buffer and WASM FFI.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AttractorMatrix {
    /// Direct attraction matrix (bit pattern of the attractor's identity)
    pub matrix: u32,
    /// Inverse/cleansing matrix (bitwise complement of `matrix` for perfect dipole)
    pub inverse: u32,
    /// Pulse frequency in Q10 fixed-point (0..1024 maps to 0..1 Hz relative to tick)
    pub pulse_freq: u32,
    /// Pulse amplitude in Q10 fixed-point (0..1024)
    pub pulse_amp: u32,
}

impl AttractorMatrix {
    pub fn new(matrix: u32, inverse: u32, pulse_freq: u32, pulse_amp: u32) -> Self {
        Self {
            matrix,
            inverse,
            pulse_freq: if pulse_freq > 1024 { 1024 } else { pulse_freq },
            pulse_amp: if pulse_amp > 1024 { 1024 } else { pulse_amp },
        }
    }

    /// Perfect dipole: matrix and inverse are bitwise complements.
    /// Returns true if `matrix XOR inverse == 0xFFFFFFFF`.
    pub fn is_valid_dipole(&self) -> bool {
        (self.matrix ^ self.inverse) == 0xFFFFFFFF
    }

    /// Recomputes inverse as bitwise complement of matrix.
    /// Useful when creating a new attractor from a raw matrix.
    pub fn recompute_inverse(&mut self) {
        self.inverse = !self.matrix;
    }

    /// Computes phase drift contribution for a given agent phase.
    /// Returns signed Q10 drift scaled by pulse amplitude.
    /// Formula: sin_q10(agent_phase, matrix_phase) * pulse_amp / Q10_SCALE
    pub fn drift_contribution(
        &self,
        agent_phase: u32,
        absolute_tick: u32,
        _topology: &crate::topology::PhaseTopology,
    ) -> i32 {
        // Pulsing phase: ωt (scaled by Q10)
        let pulse_phase = ((absolute_tick as u64 * self.pulse_freq as u64) / 1024) as u32;
        // Attractor's instantaneous phase = matrix + ωt
        let attractor_phase = self.matrix.wrapping_add(pulse_phase);
        let sin = crate::math::sin_q10(agent_phase, attractor_phase);
        (sin * (self.pulse_amp as i32)) / 1024
    }
}

impl Default for AttractorMatrix {
    fn default() -> Self {
        Self {
            matrix: 0,
            inverse: 0xFFFFFFFF,
            pulse_freq: 0,
            pulse_amp: 0,
        }
    }
}

/// GPU-ready array of attractors. 80 bytes total (16-byte aligned for uniform buffer).
#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct AttractorArray {
    pub count: u32,
    pub _pad: [u32; 3],
    pub data: [AttractorMatrix; 4],
}

impl Default for AttractorArray {
    fn default() -> Self {
        Self::new()
    }
}

impl AttractorArray {
    pub const fn new() -> Self {
        Self {
            count: 0,
            _pad: [0; 3],
            data: [
                AttractorMatrix {
                    matrix: 0,
                    inverse: 0xFFFFFFFF,
                    pulse_freq: 0,
                    pulse_amp: 0,
                },
                AttractorMatrix {
                    matrix: 0,
                    inverse: 0xFFFFFFFF,
                    pulse_freq: 0,
                    pulse_amp: 0,
                },
                AttractorMatrix {
                    matrix: 0,
                    inverse: 0xFFFFFFFF,
                    pulse_freq: 0,
                    pulse_amp: 0,
                },
                AttractorMatrix {
                    matrix: 0,
                    inverse: 0xFFFFFFFF,
                    pulse_freq: 0,
                    pulse_amp: 0,
                },
            ],
        }
    }

    pub fn set(&mut self, index: usize, matrix: AttractorMatrix) {
        if index < 4 {
            self.data[index] = matrix;
            if index >= self.count as usize {
                self.count = (index + 1) as u32;
            }
        }
    }

    pub fn clear(&mut self) {
        self.count = 0;
        self.data = [AttractorMatrix::default(); 4];
    }

    pub fn as_bytes(&self) -> &[u8] {
        unsafe {
            core::slice::from_raw_parts(
                self as *const Self as *const u8,
                core::mem::size_of::<Self>(),
            )
        }
    }
}

// Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_dipole() {
        let m = AttractorMatrix::new(0xDEADBEEF, !0xDEADBEEF, 100, 512);
        assert!(m.is_valid_dipole());
    }

    #[test]
    fn test_invalid_dipole() {
        let m = AttractorMatrix::new(0xDEADBEEF, 0xCAFEBABE, 100, 512);
        assert!(!m.is_valid_dipole());
    }

    #[test]
    fn test_pulse_bounds() {
        let m = AttractorMatrix::new(0, 0xFFFFFFFF, 2000, 2000);
        assert_eq!(m.pulse_freq, 1024);
        assert_eq!(m.pulse_amp, 1024);
    }

    #[test]
    fn test_recompute_inverse() {
        let mut m = AttractorMatrix::new(0x12345678, 0, 10, 10);
        assert!(!m.is_valid_dipole());
        m.recompute_inverse();
        assert!(m.is_valid_dipole());
        assert_eq!(m.inverse, !0x12345678);
    }

    #[test]
    fn test_drift_contribution_zero_amp() {
        let m = AttractorMatrix::new(0xFFFFFFFF, 0, 100, 0);
        let topology = crate::topology::PhaseTopology::new(7, 7, 6, 20);
        let drift = m.drift_contribution(0, 0, &topology);
        assert_eq!(drift, 0, "Zero amp should produce zero drift");
    }

    #[test]
    fn test_drift_contribution_non_zero() {
        let m = AttractorMatrix::new(0xFFFFFFFF, 0, 100, 1024);
        let topology = crate::topology::PhaseTopology::new(7, 7, 6, 20);
        let drift = m.drift_contribution(0, 0, &topology);
        println!(
            "drift={} for matrix=0xFFFFFFFF, agent_phase=0, q_phase=7",
            drift
        );
        // sin_q10 for phase diff = 0 - (0xFF & 0x7F = 0x7F = 127)
        // get_sin(127) should be near 1024, drift = 1024 * 1024 / 1024 = 1024
        assert!(drift.abs() <= 1024, "Drift should be bounded by pulse_amp");
    }
}
