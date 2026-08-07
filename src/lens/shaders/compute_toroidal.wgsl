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
const SENESCENCE_TICKS: u32 = 512u;
const LATITUDE_AMPLITUDE_Q10: i32 = 768i;
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
    // ASYMMETRIC CYCLIC FOOD WEB — mirrors agent.rs::species_advantage.
    //
    // This compared avalanche hashes of the whole genome, which measured as a
    // perfectly fair coin: every genome beat exactly half of any panel, and half
    // of the actual living population too, because a hash decorrelates from
    // whatever the population has become. The ring is now the predation TRAIT
    // itself — genome bits 8..15 — so whatever the population converges on,
    // something beats it. Equal hands are neutral, which is reachable in a way
    // that bit-identical genomes were not.
    let pa = (a_genome >> 8u) & 0xFFu;
    let pb = (b_genome >> 8u) & 0xFFu;
    let delta = (pa - pb) & 0xFFu;
    if (delta == 0u) { return 0i; }
    if (delta < 128u) { return 1i; }
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
        // CEILING, mirroring PhaseLattice::grid_rows. Flooring left the agents
        // past the last full row OUTSIDE the torus: wrap_index_2d can only
        // return indices in [0, h*w), so they read eight neighbours and were the
        // neighbour of nobody — drawing energy from counterparties that never
        // paid it. Generic now that mitosis grows the population one at a time.
        let h = max(1i, (i32(active_count) + w - 1i) / w);
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
        // WEIGHTED BY THE SYNAPSES — mirrors PhaseLattice::tick_physics.
        //
        // This used to sum unweighted and divide by Q10_SCALE alone, with the
        // comment noting that the HEBBIAN_DEFAULT_WEIGHT factors cancel. They
        // did, on both substrates, which is exactly the defect: the learned
        // weights multiplied in and divided straight back out, so the Hebbian
        // rule ran every tick and changed nothing. Each neighbour now carries
        // the synapse the agent learned for it — slots 3 and 4 are the left and
        // right the update rule trains against, the rest are ambient field —
        // and the normalisation is the mean of the weights actually used, so
        // strong synapses redirect attention rather than amplifying the pull.
        //
        // Max accumulator = 8 * 1024 * 4096 = 33_554_432; product with agent_cos
        // is taken after the division below, as in the Rust i64 path.
        var sum_cos: i32 = 0i;
        var sum_sin: i32 = 0i;
        var total_weight: i32 = 0i;
        var coupled_neighbours: i32 = 0i;

        for (var i = 0u; i < 8u; i = i + 1u) {
            let n_idx = n_indices[i];
            if (n_idx < active_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    let n_ortho = (n.memory_y >> 16u) & 0xFFu;
                    var d_ortho: u32 = 0u;
                    if (ortho_agent > n_ortho) { d_ortho = ortho_agent - n_ortho; } else { d_ortho = n_ortho - ortho_agent; }
                    let n_phase = (n.phase + d_ortho * 4u) & max_phase_mask;

                    var synapse: i32 = HEBBIAN_DEFAULT_WEIGHT;
                    if (i == 3u) { synapse = weight_left; }
                    if (i == 4u) { synapse = weight_right; }

                    total_weight += synapse;
                    coupled_neighbours += 1i;

                    sum_cos += cos_q10(0u, n_phase) * synapse;
                    sum_sin += sin_q10(0u, n_phase) * synapse;
                }
            }
        }

        // Sakaguchi-Kuramoto phase lag (alpha). Match Rust: wrapping_add(alpha as u32).
        let agent_phase_shifted = (agent.phase + u32(topology.alpha)) & max_phase_mask;
        let agent_cos = cos_q10(0u, agent_phase_shifted);
        let agent_sin = sin_q10(0u, agent_phase_shifted);
        
        // Exact match of the Rust i64 path:
        //   (sum_sin * agent_cos - sum_cos * agent_sin) / (Q10_SCALE * mean_weight)
        // With every synapse at the default, mean_weight == HEBBIAN_DEFAULT_WEIGHT
        // and this is bit-identical to the form it replaces.
        var mean_weight: i32 = total_weight / max(coupled_neighbours, 1i);
        mean_weight = max(mean_weight, 1i);
        // Divide BEFORE the cross product. Weighting raised the sums by 4x, so
        // projecting first would reach ~3.4e10 — fine in the Rust i64 path and
        // an overflow here, i.e. a silent substrate divergence in the exact term
        // the federation cross-witnesses.
        let norm_cos = sum_cos / mean_weight;
        let norm_sin = sum_sin / mean_weight;
        let total_coupling = (norm_sin * agent_cos - norm_cos * agent_sin) / Q10_SCALE;
// One more Q10 division than this had. `total_coupling` is already a
        // Q10 mean-field term and `k` is Q10, so the old form left a factor of
        // 1024 in a value added directly to a phase of 0..127. Measured with
        // base_freq zeroed: the coupling alone displaced 132 of 256 agents by a
        // quarter of the phase space per tick, so every tick randomised the
        // lattice and the order parameter sat at 0.02. Correctly scaled it is a
        // small pull toward the neighbourhood mean, and order reaches 0.41.
        // THE COUPLING KEEPS ITS FRACTIONAL PART — mirrors
        // PhaseLattice::tick_physics. Truncating this to an integer phase made
        // it exactly zero for 89.7% of living agents every tick: not a weak
        // force, no force. The remainder is banked in memory_x.
        //
        // WGSL `/` truncates toward zero and `%` follows it, while Rust's
        // div_euclid/rem_euclid floor. They differ for negative numerators,
        // which is most of the time here, so the euclidean form is written out
        // rather than assumed.
        let coupling_q10 = (total_coupling * k) / (6i * Q10_SCALE);
        // The stress term reads the OLD resolution, bit-identical to before.
        let coupling_stress = coupling_q10 / Q10_SCALE;

        // --- 3. Metabolic burn (decoded from phenotype) ---
        let efficiency_adj = 2i - i32(p_efficiency / 64u);
        var base_burn: u32 = 1u;
        
        let set_bits = countOneBits(agent.genome);
        var maintenance_cost = (set_bits / STRUCTURAL_MAINTENANCE_DIVISOR) * LANDAUER_BIT_COST;
        if (maintenance_cost == 0u) { maintenance_cost = 1u; }
        
        // SENESCENCE — mirrors PhaseLattice::tick_physics. Upkeep rises with
        // age until it outruns what photosynthesis pays, so death stays an
        // energy outcome and the conservation books close unchanged. The rate is
        // scaled by the `resilience` gene: a single lifespan for everyone ages
        // the population as one cohort, and the resulting boom-bust amplified
        // until the world collapsed.
        let age = (agent.state_flags & 0x00FFFF00u) >> 8u;
        // Scale before dividing — mirrors PhaseLattice::tick_physics. `1 + res/64`
        // collapsed 256 gene values onto four lifespan classes, and selection
        // stalled at the class boundary because further gain bought nothing.
        // Resilience costs what it buys — mirrors PhaseLattice::tick_physics.
        // The same factor that slows ageing scales the upkeep, so longevity
        // trades cost for time one-for-one instead of being free.
        let resilience_scale = 64u + p_resilience;
        let upkeep = (maintenance_cost * resilience_scale) / 64u;
        let senescence_ticks = (SENESCENCE_TICKS * resilience_scale) / 64u;
        let senesced = (upkeep * (senescence_ticks + age)) / senescence_ticks;
        let base_cost = (senesced * topology.weather_multiplier) / 1024u;
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
        // LATITUDE — mirrors PhaseLattice::tick_physics. The grid's y axis is
        // latitude: row 0 is the equator, row h/2 the pole. On a torus that is
        // one bright band and one dark one. Same laws everywhere, different
        // light — which is what lets two strategies pay at once.
        let lat_phase = (u32(cy) * 256u) / u32(max(h, 1i));
        let lat = cos_q10(0u, lat_phase);
        let insolation = 1024i - ((LATITUDE_AMPLITUDE_Q10 * (1024i - lat)) / 2048i);
        let local_sun = (max(sun_multiplier, 0i) * max(insolation, 0i)) / 1024i;
        let solar = (SOLAR_YIELD_Q10 * u32(local_sun)) / (1024u * 1024u);
        var energy_delta: i32 = i32(solar) - i32(burn);
        var energy_diffusion: i32 = 0i;
        // For the tissue gate below, over the same neighbours already read.
        var neighbour_energy: u32 = 0u;
        var neighbour_count: u32 = 0u;

        for (var i = 0u; i < 8u; i = i + 1u) {
            let n_idx = n_indices[i];
            if (n_idx < active_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    neighbour_energy = neighbour_energy + n.energy;
                    neighbour_count = neighbour_count + 1u;
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
        let thermodynamic_stress = u32(abs(coupling_stress)) + u32(abs(energy_diffusion));
        var time_dilation_multiplier = 1u + (thermodynamic_stress / CHRONOTOPOLOGY_STRESS_DIVISOR);
        if (time_dilation_multiplier > MAX_TIME_DILATION) {
            time_dilation_multiplier = MAX_TIME_DILATION;
        }

        // Emergent Organ Differentiation (Tissue Crystallization)
        //
        // LOCAL, RELATIVE and REVERSIBLE — mirrors PhaseLattice::tick_physics.
        // The threshold was the fixed line MAX_ATP - 1000, which every agent
        // crossed once the population reached carrying capacity (100% tissue by
        // tick 640). Making it the population's top decile stopped the latch but
        // gave every agent the same number to read, so the lattice crystallised
        // and dissolved AS ONE — a global oscillation, not organs. It was also
        // the only term in the physics that read a population-wide number
        // instead of the eight neighbours, which is action at a distance; that
        // is the argument for this change, and it stands alone. The lateral-
        // inhibition story that predicted spatial domains was measured and NOT
        // supported — see PhaseLattice::tick_physics for the numbers. The
        // MAX_ATP/2 floor stops the local king of a starving patch from
        // counting as structure.
        //
        // Integer division on both substrates; neighbour_energy is at most
        // 8 * MAX_ATP, well inside u32, so the u64 accumulator on the CPU side
        // cannot disagree with this one.
        var local_mean: u32 = 0u;
        if (neighbour_count > 0u) {
            local_mean = neighbour_energy / neighbour_count;
        }
        let tissue_threshold = max(local_mean, MAX_ATP / 2u);
        if (!is_tissue && ortho_agent > 0u && agent.energy > tissue_threshold && thermodynamic_stress < 5u) {
            agent.state_flags = agent.state_flags | 0x08000000u;
            is_tissue = true;
            weight_left = HEBBIAN_MAX_WEIGHT;
            weight_right = HEBBIAN_MAX_WEIGHT;
        }
        // ...and back. Nothing used to clear this flag, so the first agent to
        // qualify was structure forever. base_freq is no longer zeroed on
        // crystallisation — the drift is gated on is_tissue instead — because
        // zeroing it destroys the frequency there would be to return to.
        if (is_tissue && (agent.energy <= tissue_threshold || thermodynamic_stress >= 5u)) {
            agent.state_flags = agent.state_flags & ~0x08000000u;
            is_tissue = false;
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
        // Nyquist in the units base_freq is STORED in. Ignition writes it as
        // Q10; this clamped it against a raw phase bound, so 905 distinct
        // natural frequencies collapsed to exactly two, -63 and +63, with every
        // agent pinned to the rail.
        let max_freq_q10 = i32(max_phase_mask / 2u) * Q10_SCALE;
        // Kept in Q10 — mirrors PhaseLattice::tick_physics. Dividing here
        // truncated every natural frequency to a whole phase unit per tick.
        let clamped_base_freq_q10 =
            clamp(agent.base_freq, -max_freq_q10, max_freq_q10);
        // Structure does not drift. Gated rather than zeroing base_freq, so
        // dissolving back to motile restores the agent's own frequency.
        //
        // ONE ACCUMULATOR FOR THE WHOLE PHASE ADVANCE — mirrors
        // PhaseLattice::tick_physics. Every term is summed at Q10 and the
        // remainder is banked in memory_x rather than discarded; truncating each
        // term separately is what made the coupling exactly zero for 89.7% of
        // agents every tick. WGSL `/` truncates toward zero where Rust's
        // div_euclid floors, and drifts are negative about half the time, so the
        // euclidean form is written out rather than assumed.
        //
        // Structure banks nothing, so dissolving back to motile resumes from a
        // clean residue instead of discharging a debt built up while frozen.
        var drift_q10 = 0i;
        var residue_in = 0i;
        if (!is_tissue) {
            drift_q10 = (clamped_base_freq_q10 + coupling_q10
                + attractor_drift * Q10_SCALE) * i32(time_dilation_multiplier);
            residue_in = i32(agent.memory_x & 0x3FFu);
        }
        let drift_acc = residue_in + drift_q10;
        var drift = drift_acc / Q10_SCALE;
        if ((drift_acc % Q10_SCALE) != 0 && drift_acc < 0) {
            drift = drift - 1i;
        }
        let residue_out = drift_acc - drift * Q10_SCALE;
        var new_phase = (agent.phase + u32(drift)) & max_phase_mask;
        agent.memory_x = (u32(residue_out) & 0x3FFu)
            | ((u32(coupling_stress) & 0xFFFFu) << 16u);
        // One tick older, saturating — an age that wraps would make the oldest
        // agents the youngest and hand them a second life for free.
        var next_age = age + 1u;
        if (next_age > 65535u) { next_age = 65535u; }
        agent.state_flags = (agent.state_flags & ~0x00FFFF00u) | (next_age << 8u);

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
