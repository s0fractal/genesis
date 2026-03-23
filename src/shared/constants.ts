/**
 * OMEGA-64 | UNIVERSAL AXIOM (O-59)
 * 
 * The single source of truth for all simulation mathematics and topological thresholds.
 * "Magic numbers" are strictly forbidden outside this module.
 */

// Q10 Fixed-Point Math Constants
export let MATH_Q_BITS = 10;
export let MATH_Q_SCALE = 1 << MATH_Q_BITS; // 1024

// FNV-1a 64-bit BigInt Hashing Constants
export const FNV64_OFFSET_BASIS = 14695981039346656037n;
export const FNV64_PRIME = 1099511628211n;
export const FNV64_MASK = (1n << 64n) - 1n;

// Core Lattice and Phase Mathematics
export let PHASE_TAU_DEPTH = 4;
export let PHASE_LUT_SIZE = 256;
export let PHASE_MAX_AMPLITUDE = 255;
export let PHASE_MAX_LOCK = 255;
export let PHASE_MAX_ENTANGLEMENT = 255;
export let PHASE_HALF_PHASE = 128;
export let PHASE_MIN_OMEGA = -16;
export let PHASE_MAX_OMEGA = 16;
export let PHASE_MAX_OMEGA_BRIDGE = 32;
export let PHASE_FOSSILIZATION_PULSE_TICKS = 24;

// Resonance and Phase Synchronization Weights
export let KURAMOTO_COUPLING_BASE = 1.0;
export let KURAMOTO_COUPLING_HARMONIC_PEER = 0.5;
export let KURAMOTO_COUPLING_ANTIPODE = 0.35;
export let KURAMOTO_COHERENCE_THRESHOLD_LOCK = 3.0;
export let KURAMOTO_COHERENCE_THRESHOLD_HIGH = 4.2;
export let KURAMOTO_ADOPTION_RESONANCE_THRESHOLD = 0.6;
export let KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD = 0.92;
export let KURAMOTO_COUPLING_PLASMID = 0.75;
export let KURAMOTO_PLASMID_DIFFUSION_RATE = 0.05;

// Evolutionary and Thermodynamic Economics
export let MUTATION_BASE_COST = 50;
export let MUTATION_MIN_COST = 5;
export let MUTATION_MAX_COST = 500;
export let MUTATION_SMOOTHING_FACTOR = 0.1;

// The Senate and Shadow Network Governance
export const SENATE_MASK_NOMOS = "NOMOS";
export const SENATE_MASK_LOGOS = "LOGOS";
export const SENATE_MASK_CHRONOS = "CHRONOS";
export const SENATE_MASK_AION = "AION";
export let SENATE_ORACLE_TIMEOUT_MS = 16;
export let SENATE_MYCELIUM_MIN_LOCKS = 1000;
export let SENATE_MYCELIUM_MIN_ENERGY = 220;
export let SENATE_SHADOW_BUCKET_MIN = 1000;
export let SENATE_SHADOW_BUCKET_MAX = 1024;

// Tissue and Morphological Hardening
export let TISSUE_MORPHOLOGICAL_HYSTERESIS = 5;
export let TISSUE_MORPHOLOGICAL_DELTA_MIN = 0.15;

// ===============================================
// LUT HEADER / SUBSTRATE HYDRATION (Ontology 71)
// ===============================================
export let SUBSTRATE_MAGIC = "";
export let SUBSTRATE_VERSION = 0;
export let SUBSTRATE_SECTORS = 0;
export let SUBSTRATE_RADIAL_BINS = 0;
export let SUBSTRATE_HARMONICS = 0;
export let SUBSTRATE_MAX_ATOMS = 0;
export let SUBSTRATE_DAMPING_BASE = 0;

export function hydrateSubstrateHeader(memory: WebAssembly.Memory, headerOffset: number) {
    const view = new DataView(memory.buffer, headerOffset, 64);
    
    // Bytes 0-3: Magic
    const m0 = view.getUint8(0);
    const m1 = view.getUint8(1);
    const m2 = view.getUint8(2);
    const m3 = view.getUint8(3);
    SUBSTRATE_MAGIC = String.fromCharCode(m0, m1, m2, m3);
    if (SUBSTRATE_MAGIC !== "OMGA") {
        throw new Error(`FATAL: Invalid Substrate Header Magic: expected OMGA, got ${SUBSTRATE_MAGIC}`);
    }

    // Bytes 4-7: Version (u32, little-endian)
    SUBSTRATE_VERSION = view.getUint32(4, true);

    // Bytes 8-27: Layout and Thermodynamics
    SUBSTRATE_SECTORS = view.getUint32(8, true);
    SUBSTRATE_RADIAL_BINS = view.getUint32(12, true);
    SUBSTRATE_HARMONICS = view.getUint32(16, true);
    SUBSTRATE_MAX_ATOMS = view.getUint32(20, true);
    SUBSTRATE_DAMPING_BASE = view.getInt32(24, true);
}

// WebGPU Shader Injection Bridge
export const generateWgslConstants = (): string => `
// ==========================================
// DYNAMICALLY INJECTED FROM UNIVERSAL AXIOM
// ==========================================
const PHASE_LUT_SIZE: i32 = ${PHASE_LUT_SIZE};
const MAX_AMPLITUDE: i32 = ${PHASE_MAX_AMPLITUDE};
const MAX_ENTANGLEMENT: i32 = ${PHASE_MAX_ENTANGLEMENT};
const MAX_OMEGA: i32 = ${PHASE_MAX_OMEGA};
const COUPLING_BASE: i32 = ${Math.round(KURAMOTO_COUPLING_BASE * MATH_Q_SCALE)};
const COUPLING_ANTIPODE: i32 = ${Math.round(KURAMOTO_COUPLING_ANTIPODE * MATH_Q_SCALE)};
const COUPLING_HARMONIC_PEER: i32 = ${Math.round(KURAMOTO_COUPLING_HARMONIC_PEER * MATH_Q_SCALE)};
const COHERENCE_THRESHOLD_LOCK: i32 = ${Math.round(KURAMOTO_COHERENCE_THRESHOLD_LOCK * MATH_Q_SCALE)};
const COHERENCE_THRESHOLD_HIGH: i32 = ${Math.round(KURAMOTO_COHERENCE_THRESHOLD_HIGH * MATH_Q_SCALE)};
const ADOPTION_RESONANCE_THRESHOLD: i32 = ${Math.round(KURAMOTO_ADOPTION_RESONANCE_THRESHOLD * MATH_Q_SCALE)};
const ANTIPODE_ALIGNMENT_THRESHOLD: i32 = ${Math.round(KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD * MATH_Q_SCALE)};
const COUPLING_PLASMID: i32 = ${Math.round(KURAMOTO_COUPLING_PLASMID * MATH_Q_SCALE)};
const PLASMID_DIFFUSION_RATE: i32 = ${Math.round(KURAMOTO_PLASMID_DIFFUSION_RATE * MATH_Q_SCALE)};
const SHADOW_BUCKET_MIN: i32 = ${SENATE_SHADOW_BUCKET_MIN};
const SHADOW_BUCKET_MAX: i32 = ${SENATE_SHADOW_BUCKET_MAX};

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
