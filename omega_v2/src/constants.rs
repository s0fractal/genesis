//! OMEGA-64 V2 Kernel Constants
//! All thresholds derived from first principles or explicitly documented.

// --- Big Bang Initialization ---
/// Energy range for new agents: [BB_ENERGY_BASE, BB_ENERGY_BASE + BB_ENERGY_RANGE)
pub const BB_ENERGY_RANGE: u32 = 900;
pub const BB_ENERGY_BASE: u32 = 100;

/// Base frequency range in raw units: [-BB_FREQ_OFFSET, BB_FREQ_OFFSET)
pub const BB_FREQ_RANGE: u32 = 4000;
pub const BB_FREQ_OFFSET: i32 = 2000;
/// Q-scale multiplier: shifts raw freq into Q20 fixed-point
pub const BB_FREQ_Q_SCALE: i32 = 1024;

// --- Darwinian Mitosis ---
/// Minimum ATP required for a cell to undergo mitosis
pub const MITOSIS_THRESHOLD: u32 = 2000;
/// ATP cost deducted from parent during replication
pub const MITOSIS_COST: u32 = 1000;
/// Initial ATP granted to the child cell
pub const CHILD_ENERGY_SEED: u32 = 1000;

// --- PoUW ZK-VM Evaluator ---
/// Maximum ATP capacity (agent energy cap)
pub const MAX_ATP: u32 = 4000;
/// Phase mask for 8-bit phase resolution (0-255)
pub const PHASE_MASK_8BIT: u32 = 255;
/// Resonance phase modulus: 1/4 of 8-bit period
pub const RESONANCE_PHASE_MODULUS: u32 = 64;
/// ATP replenishment on resonance alignment
pub const RESONANCE_ATP_BONUS: i32 = 150;
/// Metabolic burn divisor: complexity scaling
pub const METABOLIC_BURN_DIVISOR: u32 = 4;
/// Baseline metabolic cost (minimum burn per tick)
pub const METABOLIC_BASE_COST: u32 = 1;
/// Stressor LCG mixer prime
pub const STRESSOR_MIXER: u32 = 17;
/// Stressor modulus (probability denominator)
pub const STRESSOR_MODULUS: u32 = 100;
/// Homeostasis Q-scale shift (Q20 → Q10)
pub const HOMEOSTASIS_Q_SHIFT: u32 = 10;

// --- Kuramoto Coupling & Hebbian Learning ---
/// Base coupling strength in Q10 fixed-point (1.0 = 1024)
pub const KURAMOTO_COUPLING_BASE: i32 = 1024;
/// Energy decay per tick (metabolic burn)
pub const ENERGY_DECAY_PER_TICK: u32 = 1;
/// Phase drift divisor: base_freq >> Q_SHIFT applied per tick
pub const PHASE_DRIFT_Q_SHIFT: u32 = 20;

/// Default synaptic weight for Hebbian learning (1.0 in Q10)
pub const HEBBIAN_DEFAULT_WEIGHT: i32 = 1024;
/// Maximum synaptic weight for Hebbian learning (4.0 in Q10)
pub const HEBBIAN_MAX_WEIGHT: i32 = 4096;

// --- Delta Snapshot Thresholds (HIGH-2 FIX: Q-derived from topology) ---
/// Divisor for adaptive phase threshold: threshold = phase_mask / DIVISOR
/// Represents "1/8 of full period is a significant phase change".
pub const DELTA_PHASE_DIVISOR: u32 = 8;
/// Divisor for adaptive energy threshold: threshold = MAX_ATP / DIVISOR
// --- Era 0218: Species Specialization ---
/// ATP transferred from prey to predator per tick
pub const PREDATOR_ENERGY_STEAL: u32 = 5;

/// Represents "1/128 of max capacity is a significant energy change".
pub const DELTA_ENERGY_DIVISOR: u32 = 128;

// --- Golden Trace ---
/// Target number of samples for golden trace fingerprinting
pub const GOLDEN_TRACE_SAMPLES: usize = 32;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[allow(clippy::assertions_on_constants)]
    fn constant_consistency() {
        // Big Bang energy range must fit within ATP cap
        assert!(BB_ENERGY_BASE + BB_ENERGY_RANGE <= MAX_ATP,
            "Big Bang energy range exceeds ATP cap");
        // Mitosis must be possible: threshold + cost <= cap
        assert!(MITOSIS_THRESHOLD + MITOSIS_COST <= MAX_ATP,
            "Mitosis threshold + cost exceeds ATP cap");
        // Child energy must be non-zero and within cap
        assert!(CHILD_ENERGY_SEED > 0 && CHILD_ENERGY_SEED <= MAX_ATP,
            "Child energy seed invalid");
        // Phase mask must cover 8-bit range
        assert_eq!(PHASE_MASK_8BIT, 0xFF, "Phase mask must be 8-bit");
        // Resonance modulus must be power-of-2
        assert!(RESONANCE_PHASE_MODULUS.is_power_of_two(),
            "Resonance modulus must be power-of-2");
        // xorshift64* parameters are hardcoded in math.rs (SplitMix64 + xorshift)
        // HIGH-2: Divisors must be positive
        assert!(DELTA_PHASE_DIVISOR > 0, "Phase divisor must be positive");
        assert!(DELTA_ENERGY_DIVISOR > 0, "Energy divisor must be positive");
        // HIGH-2: Adaptive thresholds must be non-zero
        assert!(MAX_ATP / DELTA_ENERGY_DIVISOR > 0, "Energy threshold would be zero");
    }
}
