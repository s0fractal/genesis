// O-23 Native Metal Kuramoto Physics Compute Shader

struct Params {
  sectors: u32,
  radial_bins: u32,
  harmonics: u32,
  time: f32,
  off_theta: u32,
  off_omega: u32,
  off_amplitude: u32,
  off_lock: u32,
  off_entanglement: u32,
  off_plasmids: u32,
  aspect_ratio: f32,
  inj_idx: u32,
  inj_hash_low: u32,
  inj_hash_high: u32,
  inj_amp: u32,
  inj_phase: u32,
  inj_ent: u32,
  inj_bucket: u32,
};

@group(0) @binding(0) var<storage, read> field_in: array<u32>;
@group(0) @binding(1) var<storage, read_write> field_out: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: Params;

struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket, 1024>;

// Memory unpackers
fn ext_byte(u32_val: u32, byte_idx: u32) -> u32 {
    return (u32_val >> (byte_idx * 8u)) & 0xFFu;
}
fn get_byte(base_offset: u32, idx: u32) -> u32 {
    return ext_byte(field_in[base_offset + (idx / 4u)], idx % 4u);
}
fn set_byte(base_offset: u32, idx: u32, val: u32) {
    let shift = (idx % 4u) * 8u;
    let mask = 0xFFu << shift;
    let val_shifted = (val & 0xFFu) << shift;
    let u32_idx = base_offset + (idx / 4u);
    atomicAnd(&field_out[u32_idx], ~mask);
    atomicOr(&field_out[u32_idx], val_shifted);
}

// i16 packing
fn get_i16(base_offset: u32, idx: u32) -> i32 {
    let arr_idx = base_offset + (idx / 2u);
    let u32_val = field_in[arr_idx];
    let shift = (idx % 2u) * 16u;
    let u16_val = (u32_val >> shift) & 0xFFFFu;
    if ((u16_val & 0x8000u) != 0u) {
        return i32(u16_val) - 65536;
    }
    return i32(u16_val);
}
fn set_i16(base_offset: u32, idx: u32, val: i32) {
    let shift = (idx % 2u) * 16u;
    let mask = 0xFFFFu << shift;
    let val_shifted = (u32(val) & 0xFFFFu) << shift;
    let u32_idx = base_offset + (idx / 2u);
    atomicAnd(&field_out[u32_idx], ~mask);
    atomicOr(&field_out[u32_idx], val_shifted);
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

fn phase_radians(from_theta: u32, to_theta: u32) -> f32 {
    let diff = (i32(to_theta) - i32(from_theta)) % 256;
    var raw = diff;
    if (raw < 0) { raw = raw + 256; }
    if (raw > 128) { raw = raw - 256; }
    return f32(raw) * 6.2831853 / 256.0;
}

fn phase_sin_sum(p_from: u32, p_to: u32, weight: f32) -> f32 { return sin(phase_radians(p_from, p_to)) * weight; }
fn phase_cos_sum(p_from: u32, p_to: u32, weight: f32) -> f32 { return cos(phase_radians(p_from, p_to)) * weight; }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let total_cells = params.sectors * params.radial_bins * params.harmonics;
    let idx = global_id.x;
    if (idx >= total_cells) { return; }

    // Recover multidimensional address
    let sector = idx % params.sectors;
    let tmp = idx / params.sectors;
    let rho = tmp % params.radial_bins;
    let harmonic = tmp / params.radial_bins;

    // Load Cell State from field_in
    let theta = get_byte(params.off_theta, idx);
    let omega = get_i16(params.off_omega, idx);
    let amplitude = i32(get_byte(params.off_amplitude, idx));
    let lock = i32(get_byte(params.off_lock, idx));
    let entanglement = get_byte(params.off_entanglement, idx);

    // Neighborhood Phase Lookups
    let left_sec = wrap_index(i32(sector) - 1, i32(params.sectors));
    let right_sec = wrap_index(i32(sector) + 1, i32(params.sectors));
    let inner_rho = max(0u, rho - 1u);
    let outer_rho = min(params.radial_bins - 1u, rho + 1u);
    let harm_peer = wrap_index(i32(harmonic) + 1, i32(params.harmonics));

    let t_left = get_byte(params.off_theta, get_idx(left_sec, rho, harmonic));
    let t_right = get_byte(params.off_theta, get_idx(right_sec, rho, harmonic));
    let t_inner = get_byte(params.off_theta, get_idx(sector, inner_rho, harmonic));
    let t_outer = get_byte(params.off_theta, get_idx(sector, outer_rho, harmonic));
    let t_harm = get_byte(params.off_theta, get_idx(sector, rho, harm_peer));

    // Kuramoto Delta sums
    var kuramoto = phase_sin_sum(theta, t_left, COUPLING_BASE) +
                   phase_sin_sum(theta, t_right, COUPLING_BASE) +
                   phase_sin_sum(theta, t_inner, COUPLING_BASE) +
                   phase_sin_sum(theta, t_outer, COUPLING_BASE) +
                   phase_sin_sum(theta, t_harm, COUPLING_HARMONIC_PEER);

    var coherence = phase_cos_sum(theta, t_left, COUPLING_BASE) +
                    phase_cos_sum(theta, t_right, COUPLING_BASE) +
                    phase_cos_sum(theta, t_inner, COUPLING_BASE) +
                    phase_cos_sum(theta, t_outer, COUPLING_BASE) +
                    phase_cos_sum(theta, t_harm, COUPLING_HARMONIC_PEER);

    // Antipode Coupling
    var next_ent = i32(entanglement);
    if (params.sectors % 2u == 0u) {
        let antipode_sec = (sector + params.sectors / 2u) % params.sectors;
        let t_anti = get_byte(params.off_theta, get_idx(antipode_sec, rho, harmonic));
        let weight = (f32(entanglement) / MAX_ENTANGLEMENT) * COUPLING_ANTIPODE;
        kuramoto += phase_sin_sum(theta, t_anti, weight);
        coherence += phase_cos_sum(theta, t_anti, weight);

        let align = cos(phase_radians(theta, t_anti));
        if (align > ANTIPODE_ALIGNMENT_THRESHOLD && amplitude > 96) {
            next_ent += 8;
        } else {
            next_ent -= 3;
        }
        set_byte(params.off_entanglement, idx, u32(clamp(next_ent, 0, 255)));
    } else {
        set_byte(params.off_entanglement, idx, entanglement); // Carry over
    }

    // O-24: Transdimensional Mycelial Lattice Topology
    let p_u32_idx = params.off_plasmids + (idx * 2u);
    let plasmid_low = field_in[p_u32_idx];
    let plasmid_high = field_in[p_u32_idx + 1u];

    if (plasmid_low != 0u || plasmid_high != 0u) {
        // Find bucket from FNV-1a structural hash
        let hash = (plasmid_low ^ plasmid_high);
        let bucket_idx = hash & 1023u;

        let m_count = atomicLoad(&mycelial_centroids[bucket_idx].count);
        // Only trigger non-local pull if more than 1 node shares this exact LLM Semantic Intent
        if (m_count > 1u) {
            let m_x = f32(atomicLoad(&mycelial_centroids[bucket_idx].x_sum));
            let m_y = f32(atomicLoad(&mycelial_centroids[bucket_idx].y_sum));

            // Cartesian recovery back to Radians
            var centroid_theta_rad = atan2(m_y, m_x);
            if (centroid_theta_rad < 0.0) {
                centroid_theta_rad += 6.283185307;
            }
            
            // Map back to 0-255 u8 Phase integer
            let centroid = u32(centroid_theta_rad * 255.0 / 6.283185307) % 256u;

            // Apply a Massive K=4.0 structural pull toward the specific Mycelial thought group
            let mycelial_pull = phase_sin_sum(theta, centroid, 4.0);
            kuramoto += mycelial_pull;
            coherence += phase_cos_sum(theta, centroid, 4.0);
        }
    }

    // Kinematic Updates
    var omega_delta = i32(round(kuramoto));
    omega_delta = fast_abs(omega_delta); // O-62: Evaluated by Autopoietic Transpiler Bridge
    let next_omega = clamp(omega + omega_delta, -16, 16);
    var next_theta = u32(wrap_index(i32(theta) + next_omega, 256));

    var amp_delta = i32(round(coherence * 6.0)) - (lock / 64);
    
    // O-33: Resonance Economics Subsidy
    // If the von Neumann neighborhood is nearly mathematically identical (R > 0.93)
    if (coherence > 4.2) {
        amp_delta += 2; // Inject metabolic heat back into the biological grid
    }

    let lock_delta = select(-4, 8, coherence >= 3.0);

    var next_amp = clamp(amplitude + amp_delta, 0, 255);
    var next_lock = clamp(lock + lock_delta, 0, 255);
    var target_ent = u32(clamp(next_ent, 0, 255));
    
    // Evaluate O-22/O-29 Explicit Intent Injection via Uniform Params
    var receives_injection = false;
    if (params.inj_idx == idx && params.inj_amp > 0u) {
        receives_injection = true;
    } else if (params.inj_bucket != 0xFFFFFFFFu && params.inj_amp > 0u) {
        if (plasmid_low != 0u || plasmid_high != 0u) {
            let hash = (plasmid_low ^ plasmid_high);
            if ((hash & 1023u) == params.inj_bucket) {
                receives_injection = true;
            }
        }
    }

    if (receives_injection) {
        next_amp = i32(params.inj_amp);
        next_theta = params.inj_phase;
        target_ent = params.inj_ent;
        next_lock = 0; // Break kinematic lock to enforce adoption
        
        // Since p_u32_idx is defined in the Mycelial Block, let's redeclare locally to avoid scope errors
        let target_p_idx = params.off_plasmids + (idx * 2u);
        atomicAnd(&field_out[target_p_idx], 0u);
        atomicOr(&field_out[target_p_idx], params.inj_hash_low);
        atomicAnd(&field_out[target_p_idx + 1u], 0u);
        atomicOr(&field_out[target_p_idx + 1u], params.inj_hash_high);
    } else {
        // Carry over existing plasmids if no injection overrides them
        let target_p_idx = params.off_plasmids + (idx * 2u);
        atomicOr(&field_out[target_p_idx], field_in[target_p_idx]);
        atomicOr(&field_out[target_p_idx + 1u], field_in[target_p_idx + 1u]);
    }

    set_byte(params.off_theta, idx, next_theta);
    set_i16(params.off_omega, idx, next_omega);
    set_byte(params.off_amplitude, idx, u32(next_amp));
    set_byte(params.off_lock, idx, u32(next_lock));
    if (params.sectors % 2u == 0u || (params.inj_idx == idx && params.inj_amp > 0u)) {
        // Write entanglement if we computed antipode or if we got an injection
        set_byte(params.off_entanglement, idx, target_ent);
    }
}
