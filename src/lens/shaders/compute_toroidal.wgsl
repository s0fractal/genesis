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
    weather_multiplier: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
}

struct SignalStore {
    dirty_flags: u32,
    absolute_tick: u32,
    active_agent_count: u32,
    max_cells: u32,
    total_energy: u32,
    _pad2: u32,
    _pad3: u32,
    _pad4: u32,
}

// Era 1010: Attractor Matrix (16 bytes)
struct AttractorMatrix {
    matrix: u32,
    inverse: u32,
    pulse_freq: u32,
    pulse_amp: u32,
}

// Era 1010: Attractor Array (80 bytes, binding 8)
struct AttractorArray {
    count: u32,
    pad0: u32,
    pad1: u32,
    pad2: u32,
    data: array<AttractorMatrix, 4>,
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
@group(0) @binding(8) var<uniform> attractor_array: AttractorArray;

// --- Constants (must match omega_v2/src/constants.rs) ---
const KURAMOTO_COUPLING_BASE: i32 = 1024;
const Q10_SCALE: i32 = 1024;
const LANDAUER_BIT_COST: u32 = 1u;
const STRUCTURAL_MAINTENANCE_DIVISOR: u32 = 8u;
const RESONANCE_PHASE_MODULUS: u32 = 64u;
const CHRONOTOPOLOGY_STRESS_DIVISOR: u32 = 32u;
const MAX_TIME_DILATION: u32 = 8u;
const MAX_ATP: u32 = 4096u;
const HEBBIAN_DEFAULT_WEIGHT: i32 = 1024;
const HEBBIAN_MAX_WEIGHT: i32 = 4096;

// HIGH-3: bitmask & 0xFF instead of % 256 for O(1) hot path
fn sin_q10(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta - from_theta) & 0xFFu;
    return sine_lut[index];
}

fn cos_q10(from_theta: u32, to_theta: u32) -> i32 {
    let index = ((to_theta + 64u) - from_theta) & 0xFFu;
    return sine_lut[index];
}

// Era 0218: Circular Food Web
fn species_advantage(a: u32, b: u32) -> i32 {
    if (a == b) { return 0i; }
    let diff = (a - b) & 0x7Fu;
    if (diff > 0u && diff <= 8u) {
        return 1i;
    } else if (diff >= 120u && diff <= 127u) {
        return -1i;
    }
    return 0i;
}


// Era 950: 2D Hex Grid Wrap
fn wrap_index_2d(x: i32, y: i32, w: i32, h: i32) -> u32 {
    let wx = (x + w) % w;
    let wy = (y + h) % h;
    return u32(wy * w + wx);
}

@compute @workgroup_size(64)
fn compute_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= signals.active_agent_count) { return; }

    var agent = agents_in[index];
    let active_count = signals.active_agent_count;
    let max_phase_mask = (1u << topology.q_phase) - 1u;

    if (agent.energy > 0u) {
        let max_r_cells = 1u << topology.q_radial;
        let w = i32(max_r_cells);
        let h = max(1i, i32(active_count) / w);
        let cx = i32(index) % w;
        let cy = i32(index) / w;
        
        let n_indices = array<u32, 6>(
            wrap_index_2d(cx - 1, cy, w, h),
            wrap_index_2d(cx + 1, cy, w, h),
            wrap_index_2d(cx, cy - 1, w, h),
            wrap_index_2d(cx, cy + 1, w, h),
            wrap_index_2d(cx + 1, cy - 1, w, h),
            wrap_index_2d(cx - 1, cy + 1, w, h)
        );

        let left_idx = select(n_indices[0], 0u, n_indices[0] >= active_count);
        let right_idx = select(n_indices[1], 0u, n_indices[1] >= active_count);

        let left = agents_in[left_idx];
        let right = agents_in[right_idx];

        // --- Era 0215: Phenotypic Expression ---
        let genome = agent.genome;
        let p_efficiency = genome & 0xFFu;
        let p_radius = (genome >> 8u) & 0xFFu;
        let p_resilience = (genome >> 16u) & 0xFFu;
        let p_radiance = (genome >> 24u) & 0xFFu;

        // --- Era 0216: Hebbian Learning (Active Memory) ---
        var weight_left: i32 = HEBBIAN_DEFAULT_WEIGHT;
        if (agent.memory_y != 0u) { weight_left = i32(agent.memory_y); }
        var weight_right: i32 = HEBBIAN_DEFAULT_WEIGHT;
        if (agent.memory_z != 0u) { weight_right = i32(agent.memory_z); }

        let cos_left = cos_q10(left.phase, agent.phase);
        let cos_right = cos_q10(right.phase, agent.phase);
        
        let neuroplasticity = i32(p_radiance) / 4i;
        
        weight_left = clamp(weight_left + (cos_left * neuroplasticity) / 1024i, 0i, HEBBIAN_MAX_WEIGHT);
        weight_right = clamp(weight_right + (cos_right * neuroplasticity) / 1024i, 0i, HEBBIAN_MAX_WEIGHT);

        agent.memory_y = u32(weight_left);
        agent.memory_z = u32(weight_right);

        // --- 2. 6-Neighbor Kuramoto Q10 coupling ---
        let k = KURAMOTO_COUPLING_BASE + (i32(p_radius) * 4i);
        
        // Era 2060: Photonic Substrate Readiness (DFT Mean-Field Approximation)
        var sum_cos: i32 = 0i;
        var sum_sin: i32 = 0i;

        for (var i = 0u; i < 6u; i = i + 1u) {
            let n_idx = n_indices[i];
            if (n_idx < active_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    sum_cos += cos_q10(0u, n.phase) * HEBBIAN_DEFAULT_WEIGHT;
                    sum_sin += sin_q10(0u, n.phase) * HEBBIAN_DEFAULT_WEIGHT;
                }
            }
        }
        
        let agent_cos = cos_q10(0u, agent.phase);
        let agent_sin = sin_q10(0u, agent.phase);
        
        let total_coupling = (sum_sin * agent_cos - sum_cos * agent_sin) / (Q10_SCALE * Q10_SCALE);
        let coupling = (total_coupling * k) / (6i * Q10_SCALE);

        // --- 3. Metabolic burn (decoded from phenotype) ---
        let efficiency_adj = 2i - i32(p_efficiency / 64u);
        var base_burn: u32 = 1u;
        
        let set_bits = countOneBits(agent.genome);
        var maintenance_cost = (set_bits / STRUCTURAL_MAINTENANCE_DIVISOR) * LANDAUER_BIT_COST;
        if (maintenance_cost == 0u) { maintenance_cost = 1u; }
        
        let base_cost = (maintenance_cost * topology.weather_multiplier) / 1024u;
        let raw_base = i32(base_cost) + efficiency_adj;
        if (raw_base > 1i) { base_burn = u32(raw_base); }

        let resilience_reduction = p_resilience / 128u;
        var burn: u32 = 1u;
        if (base_burn > resilience_reduction + 1u) {
            burn = base_burn - resilience_reduction;
        }

        // Era 0218: Species Specialization (Predator-Prey)
        let agent_species = (agent.state_flags >> 1u) & 0x7Fu;

        var energy_delta: i32 = -i32(burn);
        let steal = 5i; // PREDATOR_ENERGY_STEAL
        var energy_diffusion: i32 = 0i;

        for (var i = 0u; i < 6u; i = i + 1u) {
            let n_idx = n_indices[i];
            if (n_idx < active_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    let n_species = (n.state_flags >> 1u) & 0x7Fu;
                    let adv = species_advantage(agent_species, n_species);
                    if (adv == 1i) { energy_delta += steal; }
                    else if (adv == -1i) { energy_delta -= steal; }
                    
                    energy_diffusion += (i32(n.energy) - i32(agent.energy)) / 8i;
                }
            }
        }
        energy_delta += energy_diffusion;

        // Philosophy Vector 3: Relativistic Chronotopology (Time Dilation)
        let thermodynamic_stress = u32(abs(coupling)) + u32(abs(energy_diffusion));
        var time_dilation_multiplier = 1u + (thermodynamic_stress / CHRONOTOPOLOGY_STRESS_DIVISOR);
        if (time_dilation_multiplier > MAX_TIME_DILATION) {
            time_dilation_multiplier = MAX_TIME_DILATION;
        }

        let extra_burn = burn * (time_dilation_multiplier - 1u);
        energy_delta -= i32(extra_burn);

        var new_energy: u32 = 0u;
        if (energy_delta < 0i) {
            let abs_delta = u32(abs(energy_delta));
            if (agent.energy > abs_delta) { new_energy = agent.energy - abs_delta; }
        } else {
            new_energy = agent.energy + u32(energy_delta);
            if (new_energy > MAX_ATP) { new_energy = MAX_ATP; }
        }

        // --- 4. Cosmic Attractor Navigation (Era 1010) ---
        var attractor_drift: i32 = 0i;
        for (var j = 0u; j < attractor_array.count; j = j + 1u) {
            let a = attractor_array.data[j];
            let index = (a.matrix - agent.phase) & 0xFFu;
            let sin_val = sine_lut[index];
            attractor_drift = attractor_drift + (sin_val * i32(a.pulse_amp)) / 1024;
        }
        let drift = (agent.base_freq + coupling + attractor_drift) * i32(time_dilation_multiplier);
        var new_phase = (agent.phase + u32(drift)) & max_phase_mask;

        // --- 5. Cosmic Resonance: The Dipole Invariant (Yin-Yang Balance) ---
        if (new_phase % RESONANCE_PHASE_MODULUS == 0u && new_energy > 0u) {
            new_energy = new_energy + (burn * time_dilation_multiplier * RESONANCE_PHASE_MODULUS);
            if (new_energy > MAX_ATP) { new_energy = MAX_ATP; }
        }

        agent.phase = new_phase;
        agent.energy = new_energy;
        if (new_energy == 0u) {
            agent.state_flags = agent.state_flags | 0x01u;
        }
        // base_freq, genome, memory are unchanged during physics tick
    }

    // Ping-pong: write result to agents_out (dead cells copied unchanged)
    agents_out[index] = agent;
}
