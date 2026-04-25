//! Epigenetic Memory Layer (Era 950+)
//!
//! This module gives OMEGA-64 the ability to "remember" which genetic traits
//! led to survival. Instead of purely random Big Bang genomes, the lattice
//! can bias new agents toward historically successful bit patterns.
//!
//! The memory is intentionally minimalist (no heap, no_std) — just 32 counters
//! tracking the frequency of each genome bit among thriving agents.

/// Tracks how often each of the 32 genome bits was set to 1 in successful agents.
#[derive(Clone, Copy, Debug)]
pub struct EpigeneticMemory {
    /// How many times bit `i` was 1 in recorded survivors.
    pub bit_frequencies: [u32; 32],
    /// Total number of agents recorded.
    pub total_recorded: u32,
    /// Global mutation rate (0..100) applied after bias. 5 = 5% chance to flip.
    pub mutation_rate: u32,
}

impl Default for EpigeneticMemory {
    fn default() -> Self {
        Self::new()
    }
}

impl EpigeneticMemory {
    pub const fn new() -> Self {
        Self {
            bit_frequencies: [0; 32],
            total_recorded: 0,
            mutation_rate: 5,
        }
    }

    /// Record a thriving agent's genome into the collective memory.
    pub fn record(&mut self, genome: u32) {
        let mut g = genome;
        let mut i = 0;
        while i < 32 {
            if g & 1 == 1 {
                self.bit_frequencies[i] = self.bit_frequencies[i].saturating_add(1);
            }
            g >>= 1;
            i += 1;
        }
        self.total_recorded = self.total_recorded.saturating_add(1);
    }

    /// Generate a genome biased toward historically successful bits.
    /// `raw_seed` provides entropy; each bit is weighted by epigenetic frequency.
    pub fn generate_biased_genome(&self, mut raw_seed: u32) -> u32 {
        if self.total_recorded == 0 {
            // No memory yet — pure stochastic.
            return raw_seed;
        }

        let mut genome = 0u32;
        let threshold = self.total_recorded / 2;

        for i in 0..32 {
            // HIGH-1 FIX: xorshift32 replaces NR LCG for per-bit entropy
            raw_seed = crate::math::xorshift32_once(raw_seed);

            let bias_toward_one = self.bit_frequencies[i] > threshold;

            // Mutation: small chance to ignore bias entirely.
            let mutate = (raw_seed % 100) < self.mutation_rate;

            let bit = if mutate {
                // Random flip
                ((raw_seed >> 8) & 1) == 1
            } else {
                bias_toward_one
            };

            if bit {
                genome |= 1 << i;
            }
        }

        genome
    }

    /// Compute a simple "epigenetic pressure" score for a genome.
    /// Higher = more aligned with historical success.
    pub fn alignment_score(&self, genome: u32) -> u32 {
        if self.total_recorded == 0 {
            return 0;
        }
        let mut score = 0u32;
        let threshold = self.total_recorded / 2;
        for i in 0..32 {
            let bit_set = (genome >> i) & 1 == 1;
            let dominant = self.bit_frequencies[i] > threshold;
            if bit_set == dominant {
                score += 1;
            }
        }
        score
    }

    pub fn clear(&mut self) {
        self.bit_frequencies = [0; 32];
        self.total_recorded = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_increments_frequencies() {
        let mut mem = EpigeneticMemory::new();
        mem.record(0b0000_0000_0000_0000_0000_0000_0000_1011);
        assert_eq!(mem.bit_frequencies[0], 1);
        assert_eq!(mem.bit_frequencies[1], 1);
        assert_eq!(mem.bit_frequencies[2], 0);
        assert_eq!(mem.bit_frequencies[3], 1);
        assert_eq!(mem.total_recorded, 1);
    }

    #[test]
    fn test_biased_genome_prefers_dominant_bits() {
        let mut mem = EpigeneticMemory::new();
        mem.mutation_rate = 0; // Strict bias, no mutation

        // Record 10 agents where bit 5 is ALWAYS 1
        for seed in 0..10 {
            mem.record(1 << 5 | (seed * 7));
        }

        // Generate 100 genomes and verify bit 5 is almost always 1
        let mut bit5_count = 0;
        for s in 100..200 {
            let g = mem.generate_biased_genome(s);
            if (g >> 5) & 1 == 1 {
                bit5_count += 1;
            }
        }
        // With 0 mutation rate and 100% dominance, should be 100%
        assert_eq!(bit5_count, 100);
    }

    #[test]
    fn test_alignment_score() {
        let mut mem = EpigeneticMemory::new();
        // Record 5 agents with bit 7 = 1 and bit 3 = 0
        for i in 0..5 {
            mem.record((1 << 7) | (i * 13));
        }
        // Perfect alignment: bit 7 set, bit 3 clear
        let perfect = 1 << 7; // bit 7 = 1, bit 3 = 0
        let score = mem.alignment_score(perfect);
        // bit 7 should match (dominant 1), bit 3 should match (dominant 0)
        assert!(score >= 30, "Alignment score should be very high for dominant pattern");
    }

    #[test]
    fn test_clear_resets_memory() {
        let mut mem = EpigeneticMemory::new();
        mem.record(0xFFFF_FFFF);
        mem.clear();
        assert_eq!(mem.total_recorded, 0);
        assert!(mem.bit_frequencies.iter().all(|&x| x == 0));
    }
}
