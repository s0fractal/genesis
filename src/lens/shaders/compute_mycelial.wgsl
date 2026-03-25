// @polyfill
const MATH_Q_BITS: i32 = 10;
const MATH_Q_SCALE: i32 = 1024;
const NATIVE_GRAVITY: f32 = -0.05f;
const PHASE_TAU_DEPTH: i32 = 4;
const PHASE_LUT_SIZE: i32 = 256;
const PHASE_MAX_AMPLITUDE: i32 = 255;
const PHASE_MAX_LOCK: i32 = 255;
const PHASE_MAX_ENTANGLEMENT: i32 = 255;
const PHASE_HALF_PHASE: i32 = 128;
const PHASE_MIN_OMEGA: i32 = -16;
const PHASE_MAX_OMEGA: i32 = 16;
const PHASE_MAX_OMEGA_BRIDGE: i32 = 32;
const PHASE_FOSSILIZATION_PULSE_TICKS: i32 = 24;
const KURAMOTO_COUPLING_BASE: i32 = 1024;
const KURAMOTO_SAKAGUCHI_ALPHA: f32 = 0.15f;
const KURAMOTO_COUPLING_HARMONIC_PEER: i32 = 512;
const KURAMOTO_COUPLING_ANTIPODE: i32 = 358;
const KURAMOTO_COHERENCE_THRESHOLD_LOCK: i32 = 3072;
const KURAMOTO_COHERENCE_THRESHOLD_HIGH: i32 = 4301;
const KURAMOTO_ADOPTION_RESONANCE_THRESHOLD: i32 = 614;
const KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD: i32 = 942;
const KURAMOTO_COUPLING_PLASMID: i32 = 768;
const KURAMOTO_PLASMID_DIFFUSION_RATE: i32 = 51;
const MUTATION_BASE_COST: i32 = 50;
const MUTATION_MIN_COST: i32 = 5;
const MUTATION_MAX_COST: i32 = 500;
const MUTATION_SMOOTHING_FACTOR: i32 = 102;
const SENATE_ORACLE_TIMEOUT_MS: i32 = 16;
const SENATE_MYCELIUM_MIN_LOCKS: i32 = 1000;
const SENATE_MYCELIUM_MIN_ENERGY: i32 = 220;
const SENATE_SHADOW_BUCKET_MIN: i32 = 1000;
const SENATE_SHADOW_BUCKET_MAX: i32 = 1024;
const TISSUE_MORPHOLOGICAL_HYSTERESIS: i32 = 5;
const TISSUE_MORPHOLOGICAL_DELTA_MIN: i32 = 154;
const BIOLOGY_SOMATIC_ALPHA: f32 = 1.5f;
const BIOLOGY_SOMATIC_DECAY_RATE: f32 = 0.05f;
const BIOLOGY_SOMATIC_BASE_COST: i32 = 5;
const BIOLOGY_EXTINCTION_THRESHOLD: i32 = 0;
const ADA_HODLER_BRAKE: f32 = 0.95f;
const ADA_QE_STIMULUS_MAX: i32 = 500;
const ADA_QE_STIMULUS_MIN: i32 = 100;
const ADA_MASS_DILATION_MIN: f32 = 0.05f;
const ADA_MASS_DILATION_MAX: f32 = 1.0f;
const ADA_MASS_DILATION_NUM: f32 = 3.0f;
const ORACLE_INVOCATION_COST: i32 = 10000;
const ORACLE_LEDGER_MAX_EVENTS: i32 = 1000;
const ORACLE_LEDGER_TRUNCATE: i32 = 800;
const ORACLE_MAX_SYSTEM_ENERGY: i32 = 21000000;
const ORACLE_BACKOFF_BASE_MS: i32 = 5000;
const ORACLE_BACKOFF_MAX_MS: i32 = 60000;
const ORACLE_AKASHIC_GC_THRESHOLD: i32 = 15000;
const ORACLE_AKASHIC_GC_TARGET: i32 = 8000;
const NETWORK_MYCELIUM_RATE_LIMIT: i32 = 50;
const NETWORK_WEBRTC_RECONNECT_CAP: i32 = 30000;
const NETWORK_MAX_PEERS_BUCKET: i32 = 3;
const WGSL_MYCELIAL_COUPLING: i32 = 4096;
const WGSL_STAKING_COUPLING: i32 = 3072;

fn fast_abs(v: i32) -> i32 { return 0; }
fn q20_round(x: i32) -> i32 { return 0; }
fn sin_q10(from_theta: u32, to_theta: u32) -> i32 { return 0; }
fn cos_q10(from_theta: u32, to_theta: u32) -> i32 { return 0; }
fn wrap_index(value: i32, modulo: i32) -> i32 { return 0; }
fn signed_phase_delta(from_theta: i32, to_theta: i32) -> i32 { return 0; }
fn phase_distance(a: i32, b: i32) -> i32 { return 0; }
fn clamp_i32(value: i32, min_val: i32, max_val: i32) -> i32 { return 0; }
fn atan2_u8(y: i32, x: i32) -> i32 { return 0; }
// @end_polyfill
struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(0) var<storage, read> buffer_a: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket>;



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
            let buckets = u32(SENATE_SHADOW_BUCKET_MAX);
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
