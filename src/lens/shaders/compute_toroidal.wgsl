// 🌌 OMEGA-64: Era 960 Toroidal Compute Shader
// Exact WGSL port of Rust `tick_physics()` from `omega_v2/src/lattice.rs`.
// Guarantees CPU-GPU parity for Golden Trace consensus.
//
// Physics: 1D toroidal chain, Kuramoto sin_q10 coupling, metabolic burn,
// resonance replenish, ping-pong double-buffering.

struct PhaseTopology {
    q_phase: u32,
    q_sectors: u32,
    q_radial: u32,
    q_math: u32,
}

struct SignalStore {
    dirty_flags: u32,
    absolute_tick: u32,
    active_agent_count: u32,
    max_cells: u32,
}

// Exactly 32 bytes. Maps 1:1 to zero-cost Rust PhaseAgentMinimal.
struct PhaseAgentMinimal {
    phase: u32,
    energy: u32,
    base_freq: i32,
    state_flags: u32,
    genome: u32,
    memory_x: u32,
    memory_y: u32,
    memory_z: u32,
}

@group(0) @binding(0) var<uniform> topology: PhaseTopology;
@group(0) @binding(1) var<uniform> signals: SignalStore;
@group(0) @binding(2) var<storage, read> agents_in: array<PhaseAgentMinimal>;
@group(0) @binding(3) var<storage, read> sine_lut: array<i32, 256>;
@group(0) @binding(7) var<storage, read_write> agents_out: array<PhaseAgentMinimal>;

// --- Constants (must match omega_v2/src/constants.rs) ---
const KURAMOTO_COUPLING_BASE: i32 = 1024;
const Q10_SCALE: i32 = 1024;
const METABOLIC_BASE_COST: u32 = 1u;
const METABOLIC_BURN_DIVISOR: u32 = 4u;
const RESONANCE_PHASE_MODULUS: u32 = 64u;
const RESONANCE_ATP_BONUS: i32 = 150;
const MAX_ATP: u32 = 4000u;

// HIGH-3: bitmask & 0xFF instead of % 256 for O(1) hot path
fn sin_q10(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta - from_theta) & 0xFFu;
    return sine_lut[index];
}

@compute @workgroup_size(64)
fn compute_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= signals.active_agent_count) { return; }

    var agent = agents_in[index];
    let active = signals.active_agent_count;
    let max_phase_mask = (1u << topology.q_phase) - 1u;

    if (agent.energy > 0u) {
        // --- 1. Toroidal 1D neighbor indices (wrap-around) ---
        let left_idx = select(index - 1u, active - 1u, index == 0u);
        let right_idx = select(index + 1u, 0u, index + 1u >= active);

        let left = agents_in[left_idx];
        let right = agents_in[right_idx];

        // --- 2. Kuramoto Q10 coupling via LUT ---
        let sin_left = sin_q10(left.phase, agent.phase);
        let sin_right = sin_q10(right.phase, agent.phase);
        let coupling = ((sin_left + sin_right) * KURAMOTO_COUPLING_BASE) / (2 * Q10_SCALE);

        // --- 3. Metabolic burn (complexity-scaled) ---
        let burn = METABOLIC_BASE_COST + (countOneBits(agent.genome) / METABOLIC_BURN_DIVISOR);
        var new_energy = agent.energy - burn;

        // --- 4. Phase drift (base_freq Q20 + coupling) ---
        let drift = agent.base_freq + coupling;
        var new_phase = (agent.phase + u32(drift)) & max_phase_mask;

        // --- 5. Cosmic Resonance: ATP replenish at harmonic zero ---
        if (new_phase % RESONANCE_PHASE_MODULUS == 0u && new_energy > 0u) {
            new_energy = new_energy + u32(RESONANCE_ATP_BONUS);
            if (new_energy > MAX_ATP) { new_energy = MAX_ATP; }
        }

        agent.phase = new_phase;
        agent.energy = new_energy;
        // base_freq, genome, state_flags, memory are unchanged during physics tick
    }

    // Ping-pong: write result to agents_out (dead cells copied unchanged)
    agents_out[index] = agent;
}
