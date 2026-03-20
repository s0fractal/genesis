struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(0) var<storage, read> buffer_a: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket, 1024>;

struct Params {
    sectors: u32,
    radial_bins: u32,
    harmonics: u32,
    time: f32,
    off_theta: u32,
    off_omega: u32,
    off_amplitude: u32,
    off_lock: u32,
    off_ent: u32,
    off_plasmid: u32,
    aspect: f32,
    inj_idx: u32,
    inj_hash_low: u32,
    inj_hash_high: u32,
    inj_amp: u32,
    inj_phase: u32,
    inj_ent: u32,
    pad1: u32,
}

const SCALE: f32 = 1000.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let total_cells = params.sectors * params.radial_bins * params.harmonics;
    if (idx >= total_cells) {
        return;
    }

    // Read 64-bit plasmid (2x u32)
    let p_idx = params.off_plasmid + idx * 2u;
    let plasmid_low = buffer_a[p_idx];
    let plasmid_high = buffer_a[p_idx + 1u];

    // If plasmid is non-zero, this cell belongs to a Semantic Mycelial Thread
    if (plasmid_low != 0u || plasmid_high != 0u) {
        // Simple hash to find the bucket [0..1023]
        // FNV-1a mixes are already well-distributed, just XOR and modulo
        let hash = (plasmid_low ^ plasmid_high);
        let bucket_idx = hash & 1023u; // Modulo 1024

        // Read physical phase
        let t_idx = params.off_theta + idx / 4u;
        let t_word = buffer_a[t_idx];
        let t_shift = (idx % 4u) * 8u;
        let theta_u8 = (t_word >> t_shift) & 0xFFu;
        let theta = f32(theta_u8) / 255.0 * 6.283185307;

        // Convert to Cartesian X/Y scaled to i32 for atomic adds
        let x_scaled = i32(cos(theta) * SCALE);
        let y_scaled = i32(sin(theta) * SCALE);

        // Atomically accumulate to the global bucket
        atomicAdd(&mycelial_centroids[bucket_idx].x_sum, x_scaled);
        atomicAdd(&mycelial_centroids[bucket_idx].y_sum, y_scaled);
        atomicAdd(&mycelial_centroids[bucket_idx].count, 1u);
    }
}
