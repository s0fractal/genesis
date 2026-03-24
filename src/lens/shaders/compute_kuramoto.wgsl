// O-176 Native Metal Kuramoto Physics Compute Shader (Granite Core AoS)

override PHASE_LUT_SIZE: i32;
override MAX_AMPLITUDE: i32;
override MAX_ENTANGLEMENT: i32;
override MAX_OMEGA: i32;
override SHADOW_BUCKET_MIN: i32;
override SHADOW_BUCKET_MAX: i32;
// WGSL WebGPU Semantic Thresholds
const COHERENCE_LOCK_THRESHOLD: i32 = 3145728; // Q20 representation of 3.0
const COHERENCE_HIGH_THRESHOLD: i32 = 4404019; // Q20 representation of 4.2
const MYCELIAL_COUPLING_WEIGHT: i32 = 4096;    // Base multiplier (4.0)
const STAKING_COUPLING_WEIGHT: i32 = 3072;     // Base multiplier (3.0)

// Semantic Buffers
struct Params {
  sectors: u32,
  radial_bins: u32,
  harmonics: u32,
  time: f32,
  
  coupling_base: i32,
  coupling_antipode: i32,
  coupling_harmonic_peer: i32,
  coherence_lock: i32,
  
  coherence_high: i32,
  coherence_res: i32,
  antipode_align: i32,
  coupling_plasmid: i32,
  
  aspect_ratio: f32,
  inj_idx: u32,
  inj_hash_low: u32,
  inj_hash_high: u32,
  
  inj_amp: u32,
  inj_phase: u32,
  inj_ent: u32,
  inj_bucket: u32,
  
  padding1: u32,
  padding2: u32,
  padding3: u32,
  padding4: u32,
  padding5: u32,
  padding6: u32,
  padding7: u32,
  padding8: u32,
};

@group(0) @binding(0) var<storage, read> field_in: array<u32>;
@group(0) @binding(1) var<storage, read_write> field_out: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;

struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket>;

struct PhaseAgent {
    theta: u32,
    energy: u32,
    omega: i32,
    lock: u32,
    ent: u32,
    plasmid_low: u32,
    plasmid_high: u32,
}

fn get_agent(idx: u32) -> PhaseAgent {
    let offset = idx * 4u;
    let t0 = field_in[offset];
    let t1 = field_in[offset + 1u];
    let t2 = field_in[offset + 2u];
    let t3 = field_in[offset + 3u];

    var agent: PhaseAgent;
    agent.plasmid_low = t0;
    agent.plasmid_high = t1;
    
    let omega_raw = t2 & 0xFFFFu;
    if ((omega_raw & 0x8000u) != 0u) {
        agent.omega = i32(omega_raw) - 65536;
    } else {
        agent.omega = i32(omega_raw);
    }
    
    agent.theta = t3 & 0xFFu;
    agent.energy = (t3 >> 8u) & 0xFFu;
    agent.lock = (t3 >> 16u) & 0xFFu;
    agent.ent = (t3 >> 24u) & 0xFFu;
    return agent;
}

fn set_agent(idx: u32, agent: PhaseAgent) {
    let offset = idx * 4u;
    let omega_u16 = u32(agent.omega) & 0xFFFFu;
    
    let t2 = omega_u16; 
    let t3 = (agent.theta & 0xFFu) | ((agent.energy & 0xFFu) << 8u) | ((agent.lock & 0xFFu) << 16u) | ((agent.ent & 0xFFu) << 24u);
    
    field_out[offset] = agent.plasmid_low;
    field_out[offset + 1u] = agent.plasmid_high;
    field_out[offset + 2u] = t2;
    field_out[offset + 3u] = t3;
}

fn wrap_index(val: i32, modulo: i32) -> u32 {
    let rem = val % modulo;
    if (rem < 0) {
        return u32(rem + modulo);
    }
    return u32(rem);
}

fn get_idx(sector: u32, rho: u32, harmonic: u32) -> u32 {
    return harmonic * params.radial_bins * params.sectors + rho * params.sectors + sector;
}

// O-223 Native Phase Coupling via Hardware Hamming Distance (POPCNT Singularity)
fn phase_torque(me_theta: u32, neighbor_theta: u32) -> i32 {
    let diff = i32(neighbor_theta) - i32(me_theta);
    var wrapped = diff;
    if (diff > 128) { wrapped = diff - 256; }
    else if (diff < -128) { wrapped = diff + 256; }
    return wrapped * 8; // Triangle wave approximation of Sin(x) * 1024
}

fn genetic_resonance(me: PhaseAgent, neighbor: PhaseAgent) -> i32 {
    if (me.plasmid_low == 0u && neighbor.plasmid_low == 0u) {
        // Pure physics vacuum coherence (Triangle wave Cosine approximation)
        var diff = abs(i32(neighbor.theta) - i32(me.theta));
        if (diff > 128) { diff = 256 - diff; }
        return (64 - diff) * 16; // 0 diff -> 1024, 64 diff -> 0, 128 diff -> -1024
    }
    if (me.plasmid_low == 0u || neighbor.plasmid_low == 0u) {
        return -512; // Empty space repels explicit Biology
    }
    // Deep hardware Bit-counting across the AST DNA 
    let diff_low = me.plasmid_low ^ neighbor.plasmid_low;
    let diff_high = me.plasmid_high ^ neighbor.plasmid_high;
    let distance = i32(countOneBits(diff_low) + countOneBits(diff_high));
    
    // Scale distance 0-64 exactly into Q10 Math Bounds [1024..-1024]
    return (32 - distance) * 32; 
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let physical_cells = params.sectors * params.radial_bins;
    let idx = global_id.x;
    // O-194 Semantic Optimization Pipeline: Restrict compute to Physical layer only (Harmonic 0)
    // Fossil layers are direct-copied outside WGSL to prevent warp divergence.
    if (idx >= physical_cells) { return; }

    let sector = idx % params.sectors;
    let tmp = idx / params.sectors;
    let rho = tmp % params.radial_bins;
    let harmonic = 0u; // Guaranteed by index bounds

    let me = get_agent(idx);

    let left_sec = wrap_index(i32(sector) - 1, i32(params.sectors));
    let right_sec = wrap_index(i32(sector) + 1, i32(params.sectors));
    let inner_rho = max(0u, rho - 1u);
    let outer_rho = min(params.radial_bins - 1u, rho + 1u);
    let harm_peer = wrap_index(i32(harmonic) + 1, i32(params.harmonics));

    let a_l = get_agent(get_idx(left_sec, rho, harmonic));
    let a_r = get_agent(get_idx(right_sec, rho, harmonic));
    let a_i = get_agent(get_idx(sector, inner_rho, harmonic));
    let a_o = get_agent(get_idx(sector, outer_rho, harmonic));
    let a_h = get_agent(get_idx(sector, rho, harm_peer));

    // O-164 Local Thermodynamic Feedback
    let dynamic_coupling = (params.coupling_base * (i32(me.energy) + 64)) / 128;

    var kuramoto = phase_torque(me.theta, a_l.theta) * i32(dynamic_coupling) +
                   phase_torque(me.theta, a_r.theta) * i32(dynamic_coupling) +
                   phase_torque(me.theta, a_i.theta) * i32(dynamic_coupling) +
                   phase_torque(me.theta, a_o.theta) * i32(dynamic_coupling) +
                   phase_torque(me.theta, a_h.theta) * params.coupling_harmonic_peer;

    var coherence = genetic_resonance(me, a_l) * i32(dynamic_coupling) +
                    genetic_resonance(me, a_r) * i32(dynamic_coupling) +
                    genetic_resonance(me, a_i) * i32(dynamic_coupling) +
                    genetic_resonance(me, a_o) * i32(dynamic_coupling) +
                    genetic_resonance(me, a_h) * params.coupling_harmonic_peer;

    var next_ent = i32(me.ent);
    if (params.sectors % 2u == 0u) {
        let antipode_sec = (sector + params.sectors / 2u) % params.sectors;
        let a_anti = get_agent(get_idx(antipode_sec, rho, harmonic));
        
        let weight = (i32(me.ent) * params.coupling_antipode) / MAX_ENTANGLEMENT;
        kuramoto += phase_torque(me.theta, a_anti.theta) * weight;
        coherence += genetic_resonance(me, a_anti) * weight;

        let align = genetic_resonance(me, a_anti);
        if (align > params.antipode_align && me.energy > 96u) {
            next_ent += 8;
        } else {
            next_ent -= 3;
        }
    }

    var next_plasmid_low = me.plasmid_low;
    var next_plasmid_high = me.plasmid_high;

    if (me.plasmid_low != 0u || me.plasmid_high != 0u) {
        let target_theta = me.plasmid_low & 0xFFu;
        kuramoto += phase_torque(me.theta, target_theta) * params.coupling_plasmid;
        // Self-resonance with implicit DNA target (Torque alignment substitute)
        var diff = abs(i32(target_theta) - i32(me.theta));
        if (diff > 128) { diff = 256 - diff; }
        coherence += ((64 - diff) * 16) * params.coupling_plasmid;
        
        let hash = (me.plasmid_low ^ me.plasmid_high);
        let bucket_idx = hash & 1023u;
        let m_count = atomicLoad(&mycelial_centroids[bucket_idx].count);
        if (m_count > 1u) {
            let m_x = f32(atomicLoad(&mycelial_centroids[bucket_idx].x_sum));
            let m_y = f32(atomicLoad(&mycelial_centroids[bucket_idx].y_sum));
            var centroid_theta_rad = atan2(m_y, m_x);
            if (centroid_theta_rad < 0.0) { centroid_theta_rad += 6.283185307; }
            let centroid = u32(centroid_theta_rad * 255.0 / 6.283185307) % 256u;
            kuramoto += phase_torque(me.theta, centroid) * MYCELIAL_COUPLING_WEIGHT;
            
            var m_diff = abs(i32(centroid) - i32(me.theta));
            if (m_diff > 128) { m_diff = 256 - m_diff; }
            coherence += ((64 - m_diff) * 16) * MYCELIAL_COUPLING_WEIGHT;
        }
    }

    // O-63 Differential Tissue (Staking Bonus)
    var staking_energy_bonus = 0i;
    if (me.plasmid_low != 0u || me.plasmid_high != 0u) {
        let neighbors = array<PhaseAgent, 4>(a_l, a_r, a_i, a_o);
        for (var i = 0u; i < 4u; i = i + 1u) {
            let n = neighbors[i];
            if (n.plasmid_low == me.plasmid_low && n.plasmid_high == me.plasmid_high) {
                if (n.energy > me.energy) {
                    staking_energy_bonus += i32(n.energy - me.energy) / 4;
                    kuramoto += phase_torque(me.theta, n.theta) * STAKING_COUPLING_WEIGHT;
                }
            }
        }
    }

    // Kinematics
    var omega_delta = q20_round(kuramoto);
    omega_delta = fast_abs(omega_delta);
    let next_omega = clamp(me.omega + omega_delta, -16, 16);
    var next_theta = u32(wrap_index(i32(me.theta) + next_omega, 256));

    var amp_delta = q20_round(coherence * 6) - i32(me.lock / 64u) + staking_energy_bonus;
    if (coherence > COHERENCE_HIGH_THRESHOLD) { amp_delta += 2; }

    let lock_delta = select(-4, 8, coherence >= COHERENCE_LOCK_THRESHOLD);

    var next_amp = clamp(i32(me.energy) + amp_delta, 0, 255);
    var next_lock = clamp(i32(me.lock) + lock_delta, 0, 255);
    var target_ent = u32(clamp(next_ent, 0, 255));
    
    if (next_amp < 40) {
        next_plasmid_low = 0u;
        next_plasmid_high = 0u;
    }
    
    var receives_injection = false;
    if (params.inj_idx == idx && params.inj_amp > 0u) {
        receives_injection = true;
    } else if (params.inj_bucket != 0xFFFFFFFFu && params.inj_amp > 0u) {
        if (me.plasmid_low != 0u || me.plasmid_high != 0u) {
            let hash = (me.plasmid_low ^ me.plasmid_high);
            if ((hash & 1023u) == params.inj_bucket) {
                receives_injection = true;
            }
        }
    }

    if (receives_injection) {
        next_amp = i32(params.inj_amp);
        next_theta = params.inj_phase;
        target_ent = params.inj_ent;
        next_lock = 0;
        next_plasmid_low = params.inj_hash_low;
        next_plasmid_high = params.inj_hash_high;
    }

    var next_agent: PhaseAgent;
    next_agent.theta = next_theta;
    next_agent.energy = u32(next_amp);
    next_agent.omega = next_omega;
    next_agent.lock = u32(next_lock);
    next_agent.ent = target_ent;
    next_agent.plasmid_low = next_plasmid_low;
    next_agent.plasmid_high = next_plasmid_high;

    set_agent(idx, next_agent);
}
