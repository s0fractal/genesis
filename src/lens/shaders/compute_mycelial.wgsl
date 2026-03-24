struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(0) var<storage, read> buffer_a: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket>;

override PHASE_LUT_SIZE: i32;
override MAX_AMPLITUDE: i32;
override MAX_ENTANGLEMENT: i32;
override MAX_OMEGA: i32;
override SHADOW_BUCKET_MIN: i32;
override SHADOW_BUCKET_MAX: i32;

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
}

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
    let t0 = buffer_a[offset];
    let t1 = buffer_a[offset + 1u];
    let t2 = buffer_a[offset + 2u];
    let t3 = buffer_a[offset + 3u];

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

var<workgroup> local_buckets: array<MycelialBucket, 1024>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
    for (var i = 0u; i < 16u; i = i + 1u) {
        let b_idx = local_id.x * 16u + i;
        atomicStore(&local_buckets[b_idx].x_sum, 0i);
        atomicStore(&local_buckets[b_idx].y_sum, 0i);
        atomicStore(&local_buckets[b_idx].count, 0u);
    }
    workgroupBarrier();

    let idx = global_id.x;
    let total_cells = params.sectors * params.radial_bins * params.harmonics;
    
    if (idx < total_cells) {
        let me = get_agent(idx);

        if (me.plasmid_low != 0u || me.plasmid_high != 0u) {
            let hash = (me.plasmid_low ^ me.plasmid_high);
            let buckets = u32(SHADOW_BUCKET_MAX);
            let bucket_idx = hash % buckets;
            
            let x_scaled = cos_q10(0u, me.theta);
            let y_scaled = sin_q10(0u, me.theta);

            atomicAdd(&local_buckets[bucket_idx].x_sum, x_scaled);
            atomicAdd(&local_buckets[bucket_idx].y_sum, y_scaled);
            atomicAdd(&local_buckets[bucket_idx].count, 1u);
        }
    }
    
    workgroupBarrier();

    for (var i = 0u; i < 16u; i = i + 1u) {
        let b_idx = local_id.x * 16u + i;
        let count = atomicLoad(&local_buckets[b_idx].count);
        if (count > 0u) {
            let x = atomicLoad(&local_buckets[b_idx].x_sum);
            let y = atomicLoad(&local_buckets[b_idx].y_sum);
            atomicAdd(&mycelial_centroids[b_idx].x_sum, x);
            atomicAdd(&mycelial_centroids[b_idx].y_sum, y);
            atomicAdd(&mycelial_centroids[b_idx].count, count);
        }
    }
}
