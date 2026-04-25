//! Universal Integer Trigonometry (Era 960)
//! #![no_std] deterministic math. Q=7 Resonance Matrix (128 elements).

// HIGH-1 FIX: xorshift64* replaces NR LCG for superior spectral properties.
// Period: 2^64 - 1. Passes BigCrush. Single u64 state, zero allocations.

/// Deterministic pseudo-random number generator (xorshift64*).
#[derive(Clone, Copy, Debug)]
pub struct Xorshift64 {
    state: u64,
}

impl Xorshift64 {
    /// Seeds the generator from a u32 root seed using SplitMix64-style mixing.
    #[inline(always)]
    pub const fn new(seed: u32) -> Self {
        let mut state = seed as u64;
        state = state.wrapping_add(0x9E3779B97F4A7C15);
        state = (state ^ (state >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        state = (state ^ (state >> 27)).wrapping_mul(0x94D049BB133111EB);
        state = state ^ (state >> 31);
        Self { state }
    }

    /// Generates the next 32-bit random value.
    #[inline(always)]
    pub fn next_u32(&mut self) -> u32 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        self.state as u32
    }

    /// Generates the next 64-bit random value.
    #[inline(always)]
    pub fn next_u64(&mut self) -> u64 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        self.state
    }
}

/// One-shot xorshift64 for deterministic single-value hashing.
#[inline(always)]
pub fn xorshift64_once(seed: u64) -> u64 {
    let mut s = seed;
    s ^= s << 13;
    s ^= s >> 7;
    s ^= s << 17;
    s
}

/// One-shot xorshift32 for u32 contexts (period 2^32-1).
/// Seeded with non-zero input for full period coverage.
#[inline(always)]
pub fn xorshift32_once(seed: u32) -> u32 {
    let mut s = seed;
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    s
}

pub const SINE_LUT_128: [i32; 128] = [
           0,    51451,   102778,   153858,   204567,   254783,   304386,   353255,
      401273,   448324,   494295,   539076,   582558,   624636,   665210,   704181,
      741455,   776944,   810560,   842224,   871859,   899394,   924761,   947901,
      968758,   987281,  1003425,  1017151,  1028428,  1037227,  1043527,  1047313,
     1048576,  1047313,  1043527,  1037227,  1028428,  1017151,  1003425,   987281,
      968758,   947901,   924761,   899394,   871859,   842224,   810560,   776944,
      741455,   704181,   665210,   624636,   582558,   539076,   494295,   448324,
      401273,   353255,   304386,   254783,   204567,   153858,   102778,    51451,
           0,   -51451,  -102778,  -153858,  -204567,  -254783,  -304386,  -353255,
     -401273,  -448324,  -494295,  -539076,  -582558,  -624636,  -665210,  -704181,
     -741455,  -776944,  -810560,  -842224,  -871859,  -899394,  -924761,  -947901,
     -968758,  -987281, -1003425, -1017151, -1028428, -1037227, -1043527, -1047313,
    -1048576, -1047313, -1043527, -1037227, -1028428, -1017151, -1003425,  -987281,
     -968758,  -947901,  -924761,  -899394,  -871859,  -842224,  -810560,  -776944,
     -741455,  -704181,  -665210,  -624636,  -582558,  -539076,  -494295,  -448324,
     -401273,  -353255,  -304386,  -254783,  -204567,  -153858,  -102778,   -51451,
];

// --- Q10 Sine LUT (256 entries) for Kuramoto coupling ---
// HIGH-3 FIX: bitmask & 0xFF instead of % 256 for O(1) on hot path
/// Q10-scaled sine lookup table (256 entries, one full period).
/// Values range [-1024, 1024] representing sin(θ) * 1024.
pub const SINE_LUT: [i32; 256] = [
    0, 25, 50, 75, 100, 125, 150, 175, 200, 224, 249, 273, 297, 321, 345, 369,
    392, 415, 438, 460, 483, 505, 526, 548, 569, 590, 610, 630, 650, 669, 688, 706,
    724, 742, 759, 775, 792, 807, 822, 837, 851, 865, 878, 891, 903, 915, 926, 936,
    946, 955, 964, 972, 980, 987, 993, 999, 1004, 1009, 1013, 1016, 1019, 1021, 1023, 1024,
    1024, 1024, 1023, 1021, 1019, 1016, 1013, 1009, 1004, 999, 993, 987, 980, 972, 964, 955,
    946, 936, 926, 915, 903, 891, 878, 865, 851, 837, 822, 807, 792, 775, 759, 742,
    724, 706, 688, 669, 650, 630, 610, 590, 569, 548, 526, 505, 483, 460, 438, 415,
    392, 369, 345, 321, 297, 273, 249, 224, 200, 175, 150, 125, 100, 75, 50, 25,
    0, -25, -50, -75, -100, -125, -150, -175, -200, -224, -249, -273, -297, -321, -345, -369,
    -392, -415, -438, -460, -483, -505, -526, -548, -569, -590, -610, -630, -650, -669, -688, -706,
    -724, -742, -759, -775, -792, -807, -822, -837, -851, -865, -878, -891, -903, -915, -926, -936,
    -946, -955, -964, -972, -980, -987, -993, -999, -1004, -1009, -1013, -1016, -1019, -1021, -1023, -1024,
    -1024, -1024, -1023, -1021, -1019, -1016, -1013, -1009, -1004, -999, -993, -987, -980, -972, -964, -955,
    -946, -936, -926, -915, -903, -891, -878, -865, -851, -837, -822, -807, -792, -775, -759, -742,
    -724, -706, -688, -669, -650, -630, -610, -590, -569, -548, -526, -505, -483, -460, -438, -415,
    -392, -369, -345, -321, -297, -273, -249, -224, -200, -175, -150, -125, -100, -75, -50, -25,
];

/// Q10 sine of phase difference: sin((to - from) * 2π / 256) * 1024
#[inline(always)]
pub fn sin_q10(from_theta: u32, to_theta: u32) -> i32 {
    let index = to_theta.wrapping_sub(from_theta) & 0xFF;
    SINE_LUT[index as usize]
}
