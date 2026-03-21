/**
 * OMEGA-64 | UNIVERSAL AXIOM (O-59)
 * 
 * The single source of truth for all simulation mathematics and topological thresholds.
 * "Magic numbers" are strictly forbidden outside this module.
 */

// Core Lattice and Phase Mathematics
export const PHASE_CONSTANTS = {
    TAU_DEPTH: 4,
    LUT_SIZE: 256,
    MAX_AMPLITUDE: 255, // u8 max
    MAX_LOCK: 255,
    MAX_ENTANGLEMENT: 255,
    HALF_PHASE: 128,
    MIN_OMEGA: -16,
    MAX_OMEGA: 16,
    MAX_OMEGA_BRIDGE: 32, // for Bridge extensions
    FOSSILIZATION_PULSE_TICKS: 24, // The temporal depth rate for Z-axis strata embedding
} as const;

// Resonance and Phase Synchronization Weights
export const KURAMOTO_COEFFICIENTS = {
    COUPLING_BASE: 1.0,
    COUPLING_HARMONIC_PEER: 0.5,
    COUPLING_ANTIPODE: 0.35,
    COHERENCE_THRESHOLD_LOCK: 3.0,
    COHERENCE_THRESHOLD_HIGH: 4.2,
    ADOPTION_RESONANCE_THRESHOLD: 0.6,
    ANTIPODE_ALIGNMENT_THRESHOLD: 0.92,
    COUPLING_PLASMID: 0.75, // O-130
    PLASMID_DIFFUSION_RATE: 0.05, // O-130
} as const;

// Evolutionary and Thermodynamic Economics
export const MUTATION_COSTS = {
    BASE: 50,
    MIN: 5,
    MAX: 500,
    SMOOTHING_FACTOR: 0.1, // Inertial geometric smoothing
} as const;

// The Senate and Shadow Network Governance
export const SENATE_CONSTANTS = {
    MASK_NOMOS: "NOMOS",
    MASK_LOGOS: "LOGOS",
    MASK_CHRONOS: "CHRONOS",
    MASK_AION: "AION",
    ORACLE_TIMEOUT_MS: 16,
    MYCELIUM_MIN_LOCKS: 1000,
    MYCELIUM_MIN_ENERGY: 220,
    SHADOW_BUCKET_MIN: 1000,
    SHADOW_BUCKET_MAX: 1024,
} as const;

// Tissue and Morphological Hardening (O-57)
export const TISSUE_CONSTANTS = {
    MORPHOLOGICAL_HYSTERESIS: 5, // Minimum consecutive ticks to allow resize
    MORPHOLOGICAL_DELTA_MIN: 0.15, // 15% structural deviation required to molt
} as const;

// WebGPU Shader Injection Bridge
export const generateWgslConstants = (): string => `
// ==========================================
// DYNAMICALLY INJECTED FROM UNIVERSAL AXIOM
// ==========================================
const PHASE_LUT_SIZE: i32 = ${PHASE_CONSTANTS.LUT_SIZE};
const MAX_AMPLITUDE: i32 = ${PHASE_CONSTANTS.MAX_AMPLITUDE};
const MAX_ENTANGLEMENT: i32 = ${PHASE_CONSTANTS.MAX_ENTANGLEMENT};
const MAX_OMEGA: i32 = ${PHASE_CONSTANTS.MAX_OMEGA};
const COUPLING_BASE: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.COUPLING_BASE * 1024)};
const COUPLING_ANTIPODE: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.COUPLING_ANTIPODE * 1024)};
const COUPLING_HARMONIC_PEER: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.COUPLING_HARMONIC_PEER * 1024)};
const COHERENCE_THRESHOLD_LOCK: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.COHERENCE_THRESHOLD_LOCK * 1024)};
const COHERENCE_THRESHOLD_HIGH: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.COHERENCE_THRESHOLD_HIGH * 1024)};
const ADOPTION_RESONANCE_THRESHOLD: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.ADOPTION_RESONANCE_THRESHOLD * 1024)};
const ANTIPODE_ALIGNMENT_THRESHOLD: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.ANTIPODE_ALIGNMENT_THRESHOLD * 1024)};
const COUPLING_PLASMID: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.COUPLING_PLASMID * 1024)};
const PLASMID_DIFFUSION_RATE: i32 = ${Math.round(KURAMOTO_COEFFICIENTS.PLASMID_DIFFUSION_RATE * 1024)};
const SHADOW_BUCKET_MIN: i32 = ${SENATE_CONSTANTS.SHADOW_BUCKET_MIN};
const SHADOW_BUCKET_MAX: i32 = ${SENATE_CONSTANTS.SHADOW_BUCKET_MAX};

// ==========================================
// DETERMINISTIC FIXED-POINT TRIGONOMETRY (Q10)
// ==========================================
const SINE_LUT = array<i32, 256>(
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
    -392, -369, -345, -321, -297, -273, -249, -224, -200, -175, -150, -125, -100, -75, -50, -25
);

fn phase_sin_i32(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta + 256u - from_theta) % 256u;
    return SINE_LUT[index];
}

fn phase_cos_i32(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta + 256u - from_theta + 64u) % 256u;
    return SINE_LUT[index];
}

fn q20_round(x: i32) -> i32 {
    if (x >= 0) {
        return (x + 524288) / 1048576;
    }
    return (x - 524288) / 1048576;
}
// ==========================================
`;
