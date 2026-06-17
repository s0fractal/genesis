//! The Foundation of Space-Time (Theory of Constraints)
//! All dimensions MUST be powers of 2 for zero-cost ALU bitshifts.

#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct OntologicalIntent {
    pub focus_x: i32,
    pub focus_y: i32,
    pub mass: i32,
    pub radius: i32,
    pub semantic_genome: u32,
    pub op_mode: u32, // 1 = God Injection (Text-to-Matrix)
    pub _pad1: u32,
    pub _pad2: u32,
}

impl OntologicalIntent {
    pub fn empty() -> Self {
        Self {
            focus_x: 0,
            focus_y: 0,
            mass: 0,
            radius: 0,
            semantic_genome: 0,
            op_mode: 0,
            _pad1: 0,
            _pad2: 0,
        }
    }
}

#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct PhaseTopology {
    /// Power of 2 determining phase resolution (e.g. 8 -> 2^8 = 256 states per wave cycle).
    pub q_phase: u32,

    /// Power of 2 determining the number of angular sectors (e.g. 7 -> 2^7 = 128 sectors).
    pub q_sectors: u32,

    /// Power of 2 determining the number of concentric radial rings.
    pub q_radial: u32,

    /// Power of 2 defining the math fixed-point precision (e.g. 20 -> Q20 notation).
    pub q_math: u32,

    /// Bitcoin UTXO Weather Multiplier in Q10 (1024 = 1.0x)
    pub weather_multiplier: u32,

    /// Sakaguchi-Kuramoto phase lag (alpha). Defines the twist of the coupling.
    /// Derived from golden angle / pi derivations (default: 64 ≈ 90°).
    pub alpha: i32,

    // Padding to ensure exactly 32-byte alignment for WebGPU `vec4<u32>` * 2
    pub _pad1: u32,
    pub _pad2: u32,
}

impl PhaseTopology {
    /// Creates a generic PhaseTopology for an average device budget.
    /// CRIT-6 FIX: q_phase must be in [2, 7] for the 128-element SINE_LUT.
    /// q_sectors/q_radial must be < usize::BITS to prevent shift overflow.
    pub fn new(q_phase: u32, q_sectors: u32, q_radial: u32, q_math: u32) -> Self {
        assert!(
            (2..=7).contains(&q_phase),
            "q_phase must be in [2, 7] for 128-element LUT"
        );
        assert!(
            q_sectors < 32 && q_radial < 32,
            "q_sectors/q_radial must be < 32"
        );
        Self {
            q_phase,
            q_sectors,
            q_radial,
            q_math,
            weather_multiplier: 1024,
            alpha: 64, // Default alpha (approx 90 deg compromise for golden angle)
            _pad1: 0,
            _pad2: 0,
        }
    }

    /// Returns half the phase range (π offset for child mitosis).
    #[inline(always)]
    pub fn half_phase(&self) -> u32 {
        1u32 << self.q_phase.saturating_sub(1)
    }

    /// Evaluates the total geometrical boundaries of a world based entirely on shifts.
    #[inline(always)]
    pub fn max_geometry_cells(&self, harmonics: usize, tau_depth: usize) -> usize {
        let max_sectors = 1usize << self.q_sectors;
        let max_radial = 1usize << self.q_radial;
        max_sectors * max_radial * harmonics * tau_depth
    }

    /// O(1) Zero-Cost routing of any continuous phase integer to a sector bucket.
    /// Calculates `angle >> (q_phase - q_sectors)`
    #[inline(always)]
    pub fn get_sector_index(&self, absolute_phase: u32) -> u32 {
        if self.q_phase >= self.q_sectors {
            absolute_phase >> (self.q_phase - self.q_sectors)
        } else {
            absolute_phase << (self.q_sectors - self.q_phase)
        }
    }

    /// Extends a low-res q_phase angle into the pristine 128-resolution SINE_LUT.
    /// e.g. If q_phase is 6 (64 angles), we shift it left by 1 to span 128.
    #[inline(always)]
    pub fn get_sin(&self, angle: u32) -> i32 {
        let mask = self.phase_mask();
        let idx = angle & mask; // strictly bound

        // Base is Q=7 (128 elements). We shift up if resolution is lower.
        let shift_up = 7 - self.q_phase;
        crate::math::SINE_LUT_128[(idx << shift_up) as usize]
    }

    /// Fetches Cosine natively by shifting the Sine phase forward by 90 degrees (1/4 wave).
    #[inline(always)]
    pub fn get_cos(&self, angle: u32) -> i32 {
        let mask = self.phase_mask();
        let quarter_wave = 1u32 << (self.q_phase - 2); // exactly PI/2

        let idx = (angle + quarter_wave) & mask;
        let shift_up = 7 - self.q_phase;
        crate::math::SINE_LUT_128[(idx << shift_up) as usize]
    }

    /// Returns the wrap-around bitmask for continuous phase overflow.
    /// E.g. if q_phase is 8, mask is 0xFF.
    #[inline(always)]
    pub fn phase_mask(&self) -> u32 {
        (1u32 << self.q_phase) - 1
    }

    /// HIGH-2 FIX: Adaptive phase delta threshold derived from q_phase.
    /// threshold = max(1, phase_mask / DELTA_PHASE_DIVISOR)
    /// For q_phase=7 (mask=127): threshold = 15. For q_phase=5 (mask=31): threshold = 3.
    #[inline(always)]
    pub fn delta_phase_threshold(&self) -> u32 {
        let mask = self.phase_mask();
        core::cmp::max(1, mask / crate::constants::DELTA_PHASE_DIVISOR)
    }

    /// HIGH-2 FIX: Adaptive energy delta threshold derived from energy scale.
    /// threshold = max(1, MAX_ATP / DELTA_ENERGY_DIVISOR)
    /// With MAX_ATP=4096: threshold = 32.
    #[inline(always)]
    pub fn delta_energy_threshold(&self) -> u32 {
        core::cmp::max(
            1,
            crate::constants::MAX_ATP / crate::constants::DELTA_ENERGY_DIVISOR,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delta_phase_threshold_adaptive() {
        // q_phase=2 (mask=3): threshold = max(1, 3/8) = 1
        let t2 = PhaseTopology::new(2, 2, 2, 20);
        assert_eq!(
            t2.delta_phase_threshold(),
            1,
            "Low q_phase should have minimum threshold"
        );

        // q_phase=5 (mask=31): threshold = max(1, 31/8) = 3
        let t5 = PhaseTopology::new(5, 5, 5, 20);
        assert_eq!(
            t5.delta_phase_threshold(),
            3,
            "q_phase=5 threshold should be 3"
        );

        // q_phase=7 (mask=127): threshold = max(1, 127/8) = 15
        let t7 = PhaseTopology::new(7, 7, 7, 20);
        assert_eq!(
            t7.delta_phase_threshold(),
            15,
            "q_phase=7 threshold should be 15"
        );
    }

    #[test]
    fn test_delta_energy_threshold_constant() {
        let t = PhaseTopology::new(7, 7, 7, 20);
        // MAX_ATP=4096, DIVISOR=128 -> 4096/128 = 32
        assert_eq!(
            t.delta_energy_threshold(),
            32,
            "Energy threshold should be MAX_ATP/DIVISOR"
        );
    }

    #[test]
    fn test_phase_mask_pow2() {
        let t = PhaseTopology::new(7, 7, 6, 20);
        assert_eq!(t.phase_mask(), 0x7F, "q_phase=7 mask must be 127");
        assert_eq!(t.half_phase(), 64, "q_phase=7 half_phase must be 64");
    }
}
