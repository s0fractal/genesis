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
            focus_x: 0, focus_y: 0, mass: 0, radius: 0, 
            semantic_genome: 0, op_mode: 0, _pad1: 0, _pad2: 0 
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
}

impl PhaseTopology {
    /// Creates a generic PhaseTopology for an average device budget.
    pub fn new(q_phase: u32, q_sectors: u32, q_radial: u32, q_math: u32) -> Self {
        Self {
            q_phase,
            q_sectors,
            q_radial,
            q_math,
        }
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
}
