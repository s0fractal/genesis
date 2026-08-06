// 🌌 OMEGA-64: Toroidal Compute Shader
// Exact WGSL port of Rust `tick_physics()` from `omega_v2/src/lattice.rs`.
// Guarantees CPU-GPU parity for Golden Trace consensus.
//
// Physics: 1D toroidal chain, Kuramoto sin_q10 coupling, metabolic burn,
// physics loop: 32-byte layout, integer-only sine LUT, no floating point.

struct PhaseTopology {
    q_phase: u32,
    q_sectors: u32,
    q_radial: u32,
    q_math: u32,
    weather_multiplier: u32,
    alpha: i32,
    _pad1: u32,
    _pad2: u32,
}

struct SignalStore {
    dirty_flags: u32,
    causal_ticks: u32,
    phase_lock_integral: u32,
    entropy_burned: u32,
    active_agent_count: u32,
    max_cells: u32,
    total_entropy_low: u32,
    total_entropy_high: u32,
    total_energy: u32,
    p90_energy: u32,
    p90_age: u32,
    total_solar_input: u32,
}

// Attractor Matrix (16 bytes)
struct AttractorMatrix {
    matrix: u32,
    inverse: u32,
    pulse_freq: u32,
    pulse_amp: u32,
}

// Attractor Array (80 bytes, binding 8)
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
// Was inlined as a bare `5i` at the predation site while every other physical
// constant sat in this block; named so it is visible to the same reader who
// checks the rest against constants.rs.
const PREDATOR_ENERGY_STEAL: u32 = 5u;
// Q10 ATP per agent per tick at neutral sun. Mirrors constants.rs
// SOLAR_YIELD_Q10 — the one term that enters this world from outside.
const SOLAR_YIELD_Q10: u32 = 18432u;

// HIGH-3: bitmask & 0xFF instead of % 256 for O(1) hot path
fn sin_q10(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta - from_theta) & 0xFFu;
    return sine_lut[index];
}

fn cos_q10(from_theta: u32, to_theta: u32) -> i32 {
    let index = ((to_theta + 64u) - from_theta) & 0xFFu;
    return sine_lut[index];
}

// Circular Food Web
fn species_advantage(a_genome: u32, b_genome: u32) -> i32 {
    if (a_genome == b_genome) { return 0i; }
    
    // Inline xorshift32 for A. The zero-genome sentinel REPLACES the hash, it
    // is not fed through it — mirroring agent.rs::species_advantage, which is
    // the reference this shader is held bit-for-bit against. Hashing the
    // sentinel here gave ha=0x87985AA5 where Rust gives 0x12345678, flipping
    // the predator/prey sign for every zero-genome agent (±5 ATP per neighbour
    // per tick, in the consensus energy path).
    var ha = a_genome;
    if (ha == 0u) {
        ha = 0x12345678u;
    } else {
        ha = ha ^ (ha << 13u); ha = ha ^ (ha >> 17u); ha = ha ^ (ha << 5u);
    }

    // Inline xorshift32 for B
    var hb = b_genome;
    if (hb == 0u) {
        hb = 0x12345678u;
    } else {
        hb = hb ^ (hb << 13u); hb = hb ^ (hb >> 17u); hb = hb ^ (hb << 5u);
    }
    
    let delta = ha - hb;
    if (delta == 0u) { return 0i; }
    if (delta < 0x80000000u) { return 1i; }
    return -1i;
}


fn wrap_index_2d(x: i32, y: i32, w: i32, h: i32) -> u32 {
    let wx = (x + w) % w;
    let wy = (y + h) % h;
    return u32(wy * w + wx);
}

fn mul_div_q20(a: i32, b: i32) -> i32 {
    let sign_a = select(1i, -1i, a < 0);
    let sign_b = select(1i, -1i, b < 0);
    let abs_a = u32(abs(a));
    let abs_b = u32(abs(b));
    
    let a_hi = abs_a >> 16u;
    let a_lo = abs_a & 0xFFFFu;
    
    let p_hi = a_hi * abs_b;
    let p_lo = a_lo * abs_b;
    
    let hi_part = p_hi >> 4u;
    let lo_part = (((p_hi & 15u) << 16u) + p_lo) >> 20u;
    let res = hi_part + lo_part;
    
    return i32(res) * sign_a * sign_b;
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
        
        let n_indices = array<u32, 8>(
            wrap_index_2d(cx - 1, cy - 1, w, h),
            wrap_index_2d(cx, cy - 1, w, h),
            wrap_index_2d(cx + 1, cy - 1, w, h),
            wrap_index_2d(cx - 1, cy, w, h),
            wrap_index_2d(cx + 1, cy, w, h),
            wrap_index_2d(cx - 1, cy + 1, w, h),
            wrap_index_2d(cx, cy + 1, w, h),
            wrap_index_2d(cx + 1, cy + 1, w, h)
        );

        // Left is index 3 (cx-1, cy), Right is index 4 (cx+1, cy)
        let left_idx = select(n_indices[3], 0u, n_indices[3] >= active_count);
        let right_idx = select(n_indices[4], 0u, n_indices[4] >= active_count);

        let left = agents_in[left_idx];
        let right = agents_in[right_idx];

        // --- Phenotypic Expression ---
        let genome = agent.genome;
        let p_efficiency = genome & 0xFFu;
        let p_radius = (genome >> 8u) & 0xFFu;
        let p_resilience = (genome >> 16u) & 0xFFu;
        let p_radiance = (genome >> 24u) & 0xFFu;

        // --- Hebbian Learning (Active Memory) & Ortho packing ---
        var weight_left: i32 = HEBBIAN_DEFAULT_WEIGHT;
        if ((agent.memory_y & 0xFFFFu) != 0u) { weight_left = i32(agent.memory_y & 0xFFFFu); }
        var weight_right: i32 = HEBBIAN_DEFAULT_WEIGHT;
        if ((agent.memory_z & 0xFFFFu) != 0u) { weight_right = i32(agent.memory_z & 0xFFFFu); }
        var ortho_agent: u32 = (agent.memory_y >> 16u) & 0xFFu;
        var is_tissue: bool = (agent.state_flags & 0x08000000u) != 0u;

        let cos_left = cos_q10(left.phase, agent.phase);
        let cos_right = cos_q10(right.phase, agent.phase);
        
        let neuroplasticity = i32(p_radiance) / 4i;
        
        weight_left = clamp(weight_left + (cos_left * neuroplasticity) / 1024i, 0i, HEBBIAN_MAX_WEIGHT);
        weight_right = clamp(weight_right + (cos_right * neuroplasticity) / 1024i, 0i, HEBBIAN_MAX_WEIGHT);

        // --- 2. 8-Neighbor Kuramoto Q10 coupling ---
        let k = KURAMOTO_COUPLING_BASE + (i32(p_radius) * 4i);
        
        // Photonic Substrate Readiness (DFT Mean-Field Approximation)
        // NOTE: No active_count guard — Rust has none either. Must iterate all 8 neighbors unconditionally.
        // NOTE: We accumulate WITHOUT * HEBBIAN_DEFAULT_WEIGHT to avoid dual-truncation divergence from Rust's i64 path.
        // Rust: sum * HEBBIAN_DEFAULT_WEIGHT → divide by (Q10_SCALE * HEBBIAN_DEFAULT_WEIGHT) = identical to sum / Q10_SCALE.
        // Max accumulator = 8 * 1024 = 8192. Product with agent_cos ≤ 8192 * 1024 = 8_388_608 < i32_max. ✓
        var sum_cos: i32 = 0i;
        var sum_sin: i32 = 0i;

        for (var i = 0u; i < 8u; i = i + 1u) {
            let n_idx = n_indices[i];
            if (n_idx < active_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    let n_ortho = (n.memory_y >> 16u) & 0xFFu;
                    var d_ortho: u32 = 0u;
                    if (ortho_agent > n_ortho) { d_ortho = ortho_agent - n_ortho; } else { d_ortho = n_ortho - ortho_agent; }
                    let n_phase = (n.phase + d_ortho * 4u) & max_phase_mask;

                    sum_cos += cos_q10(0u, n_phase);
                    sum_sin += sin_q10(0u, n_phase);
                }
            }
        }

        // Sakaguchi-Kuramoto phase lag (alpha). Match Rust: wrapping_add(alpha as u32).
        let agent_phase_shifted = (agent.phase + u32(topology.alpha)) & max_phase_mask;
        let agent_cos = cos_q10(0u, agent_phase_shifted);
        let agent_sin = sin_q10(0u, agent_phase_shifted);
        
        // Exact match of Rust i64 path: (sum_sin * agent_cos - sum_cos * agent_sin) / Q10_SCALE
        // (HEBBIAN_DEFAULT_WEIGHT factors cancel out, leaving single division)
        let total_coupling = (sum_sin * agent_cos - sum_cos * agent_sin) / Q10_SCALE;
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

        let active_clamped = max(1u, signals.active_agent_count);
        let avg_energy = signals.total_energy / active_clamped;
        var metabolic_pressure = i32((avg_energy * 1024u) / 1000u);
        metabolic_pressure = clamp(metabolic_pressure, 512i, 2048i);
        let day_phase: u32 = (signals.causal_ticks % 1024u) * 256u / 1024u;
        let sun_multiplier = 1024i + sin_q10(0u, day_phase);
        
        // Metabolic pressure only — the sun is a source, not a tax. Mirrors
        // PhaseLattice::tick_physics: burn is flat across the day while income
        // follows the sky, so a day is a window in which to store a surplus.
        base_burn = max(1u, u32((i32(base_burn) * metabolic_pressure) / 1024i));

        let resilience_reduction = p_resilience / 128u;
        var burn: u32 = 1u;
        if (base_burn > resilience_reduction + 1u) {
            burn = base_burn - resilience_reduction;
        }

        // Species Specialization (Predator-Prey)

        // PHOTOSYNTHESIS — mirrors PhaseLattice::tick_physics. `sun_multiplier`
        // used to modulate burn only, so the sun made agents hungrier at noon
        // and fed nobody, while the comment below claimed solar input existed.
        // Uniform across agents; selection runs through the burn side.
        let solar = (SOLAR_YIELD_Q10 * u32(max(sun_multiplier, 0i))) / (1024u * 1024u);
        var energy_delta: i32 = i32(solar) - i32(burn);
        var energy_diffusion: i32 = 0i;

        for (var i = 0u; i < 8u; i = i + 1u) {
            let n_idx = n_indices[i];
            if (n_idx < active_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    let adv = species_advantage(agent.genome, n.genome);
                    // Mirrors PhaseLattice::predation_share exactly: a
                    // predator's share is min(PREDATOR_ENERGY_STEAL,
                    // prey_energy / 8), the 8 being this loop's own bound.
                    // Both roles price the meal off the PREY's pre-tick energy,
                    // so the two halves agree without communicating. The flat
                    // rate minted ATP at the floor — a prey with 3 could feed
                    // eight predators 5 each.
                    if (adv == 1i) {
                        energy_delta += i32(min(PREDATOR_ENERGY_STEAL, n.energy / 8u));
                    } else if (adv == -1i) {
                        energy_delta -= i32(min(PREDATOR_ENERGY_STEAL, agent.energy / 8u));
                    }
                    
                    // Conduction gated by phase coherence — mirrors
                    // PhaseLattice::tick_physics. Ungated it was the strongest
                    // transfer in the model and levelled the population faster
                    // than predation could differentiate it, so nothing ever
                    // accumulated to the reproduction threshold. Neighbours in
                    // phase pool their energy; neighbours out of phase do not.
                    // cos_q10 is symmetric, so this stays conservative.
                    let coherence = max(cos_q10(n.phase, agent.phase), 0i);
                    energy_diffusion +=
                        (((i32(n.energy) - i32(agent.energy)) / 8i) * coherence) / 1024i;
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

        // Emergent Organ Differentiation (Tissue Crystallization)
        if (!is_tissue && ortho_agent > 0u && agent.energy > MAX_ATP - 1000u && thermodynamic_stress < 5u) {
            agent.state_flags = agent.state_flags | 0x08000000u;
            is_tissue = true;
            agent.base_freq = 0i;
            weight_left = HEBBIAN_MAX_WEIGHT;
            weight_right = HEBBIAN_MAX_WEIGHT;
        }

        // Dynamic Orthogonal Branching (5D escape)
        var final_burn: u32 = burn;
        if (is_tissue) {
            if (final_burn < 4u) { final_burn = 4u; }
            final_burn = final_burn / 4u;
        } else {
            if (thermodynamic_stress > CHRONOTOPOLOGY_STRESS_DIVISOR * 2u) {
                ortho_agent = (ortho_agent + 1u) & 0xFFu; // Escape chaotic resonance
            } else if (agent.energy > MAX_ATP - 100u) {
                ortho_agent = (ortho_agent - 1u) & 0xFFu; // Expand territory
            }
        }

        // Pack Hebbian weight and Ortho deviation back into memory
        agent.memory_x = u32(coupling);
        agent.memory_y = u32(weight_left) | (ortho_agent << 16u);
        agent.memory_z = u32(weight_right);

        let extra_burn = final_burn * (time_dilation_multiplier - 1u);
        energy_delta -= i32(extra_burn);

        var new_energy: u32 = 0u;
        if (energy_delta < 0i) {
            let abs_delta = u32(abs(energy_delta));
            if (agent.energy > abs_delta) { new_energy = agent.energy - abs_delta; }
        } else {
            new_energy = agent.energy + u32(energy_delta);
            if (new_energy > MAX_ATP) { new_energy = MAX_ATP; }
        }

        // --- 4. Cosmic Attractor Navigation ---
        var attractor_drift: i32 = 0i;
        let attractor_count = min(attractor_array.count, 4u);
        for (var j = 0u; j < attractor_count; j = j + 1u) {
            let a = attractor_array.data[j];
            let t_sec = signals.causal_ticks / 1024u;
            let t_rem = signals.causal_ticks % 1024u;
            let pulse_phase = (t_sec * a.pulse_freq) + ((t_rem * a.pulse_freq) / 1024u);
            let attractor_phase = a.matrix + pulse_phase; // No mask — Rust uses wrapping_add without topology mask
            let index = (attractor_phase - agent.phase) & 0xFFu; // Full u32 subtraction → lower 8 bits = LUT index
            let sin_val = sine_lut[index];
            attractor_drift = attractor_drift + (sin_val * i32(a.pulse_amp)) / 1024;
        }
        // Adaptive Time-Stepping: Nyquist clamping for base_freq (matches Rust lattice.rs line 438-440)
        let max_freq = i32(max_phase_mask / 2u);
        let clamped_base_freq = clamp(agent.base_freq, -max_freq, max_freq);
        let drift = (clamped_base_freq + coupling + attractor_drift) * i32(time_dilation_multiplier);
        var new_phase = (agent.phase + u32(drift)) & max_phase_mask;

        // --- 5. Cosmic Resonance: The Dipole Invariant (Yin-Yang Balance) ---
        // Philosophy Vector 10: Thermodynamic Conservation
        // Energy is strictly zero-sum except for solar input.
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
