/**
 * OMEGA-64 | UNIVERSAL AXIOM (O-59)
 * 
 * The single source of truth for all simulation mathematics and topological thresholds.
 * "Magic numbers" are strictly forbidden outside this module.
 */

// Core Lattice and Phase Mathematics
export const PHASE_CONSTANTS = {
    LUT_SIZE: 256,
    MAX_AMPLITUDE: 255, // u8 max
    MAX_LOCK: 255,
    MAX_ENTANGLEMENT: 255,
    HALF_PHASE: 128,
    MIN_OMEGA: -16,
    MAX_OMEGA: 16,
    MAX_OMEGA_BRIDGE: 32, // for Bridge extensions
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
    ORACLE_TIMEOUT_MS: 15000,
    MYCELIUM_MIN_LOCKS: 1000,
    MYCELIUM_MIN_ENERGY: 220,
    SHADOW_BUCKET_MIN: 1000,
    SHADOW_BUCKET_MAX: 1024,
} as const;

// WebGPU Shader Injection Bridge
export const generateWgslConstants = (): string => `
// ==========================================
// DYNAMICALLY INJECTED FROM UNIVERSAL AXIOM
// ==========================================
const PHASE_LUT_SIZE: i32 = ${PHASE_CONSTANTS.LUT_SIZE};
const MAX_AMPLITUDE: i32 = ${PHASE_CONSTANTS.MAX_AMPLITUDE};
const MAX_ENTANGLEMENT: f32 = ${PHASE_CONSTANTS.MAX_ENTANGLEMENT}.0;
const MAX_OMEGA: i32 = ${PHASE_CONSTANTS.MAX_OMEGA};
const COUPLING_BASE: f32 = ${KURAMOTO_COEFFICIENTS.COUPLING_BASE};
const COUPLING_ANTIPODE: f32 = ${KURAMOTO_COEFFICIENTS.COUPLING_ANTIPODE};
const COUPLING_HARMONIC_PEER: f32 = ${KURAMOTO_COEFFICIENTS.COUPLING_HARMONIC_PEER};
const COHERENCE_THRESHOLD_LOCK: f32 = ${KURAMOTO_COEFFICIENTS.COHERENCE_THRESHOLD_LOCK};
const COHERENCE_THRESHOLD_HIGH: f32 = ${KURAMOTO_COEFFICIENTS.COHERENCE_THRESHOLD_HIGH};
const ADOPTION_RESONANCE_THRESHOLD: f32 = ${KURAMOTO_COEFFICIENTS.ADOPTION_RESONANCE_THRESHOLD};
const ANTIPODE_ALIGNMENT_THRESHOLD: f32 = ${KURAMOTO_COEFFICIENTS.ANTIPODE_ALIGNMENT_THRESHOLD};
const SHADOW_BUCKET_MIN: i32 = ${SENATE_CONSTANTS.SHADOW_BUCKET_MIN};
const SHADOW_BUCKET_MAX: i32 = ${SENATE_CONSTANTS.SHADOW_BUCKET_MAX};
// ==========================================
`;
