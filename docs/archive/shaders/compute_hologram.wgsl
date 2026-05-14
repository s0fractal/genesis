struct Params {
  sectors: u32,
  radial_bins: u32,
  harmonics: u32,
  tau_depth: u32,
  current_tau: u32,
  time: f32,
  aspect_ratio: f32,
  heatmap_toggle: u32,
  off_theta: u32,
  off_omega: u32,
  off_amplitude: u32,
  off_lock: u32,
  off_entanglement: u32,
  off_plasmids: u32,
  debug_shadow: u32,
};

@group(0) @binding(0) var<storage, read> field: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var holo_volume: texture_storage_3d<rgba8unorm, write>;

@compute @workgroup_size(64)
fn compute_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    let total_cells = params.sectors * params.radial_bins * params.harmonics * params.tau_depth;
    if (index >= total_cells) {
        return;
    }
    
    // 3D Matrix Index Unpacking
    let layer_size = params.sectors * params.radial_bins * params.harmonics;
    let t = index / layer_size;
    let rem = index % layer_size;
    
    let h_size = params.sectors * params.radial_bins;
    let h = rem / h_size;
    let r_rem = rem % h_size;
    
    let r = r_rem / params.sectors;
    let s = r_rem % params.sectors;
    
    // Memory Addressing (1D Atomic Array read)
    let addr_theta = params.off_theta + (index >> 2);
    let shift_theta = (index & 3) * 8u;
    let theta_u8 = (field[addr_theta] >> shift_theta) & 0xFFu;
    
    let addr_amp = params.off_amplitude + (index >> 2);
    let shift_amp = (index & 3) * 8u;
    let amp_u8 = (field[addr_amp] >> shift_amp) & 0xFFu;
    
    let addr_ent = params.off_entanglement + (index >> 2);
    let shift_ent = (index & 3) * 8u;
    let ent_u8 = (field[addr_ent] >> shift_ent) & 0xFFu;

    // Convert to floats
    let theta_rad = f32(theta_u8) / 255.0 * 6.283185307;
    let amplitude = f32(amp_u8) / 255.0;
    let entanglement = f32(ent_u8) / 255.0;
    
    // Chronological depth calculation (Current tau is Z=0, oldest is Z=tau_depth-1)
    let t_diff = (params.tau_depth + params.current_tau - t) % params.tau_depth;
    let fade = 1.0 - (f32(t_diff) / f32(params.tau_depth));
    
    // Evaluate interference properties
    let wave = (cos(theta_rad) + 1.0) * 0.5 * amplitude;
    
    let r_col = wave * fade;
    let g_col = amplitude * fade;
    let b_col = entanglement * fade;
    let a_col = fade; 
    
    // Splat voxel into 3D Texture space
    let z_coord = h * params.tau_depth + t_diff;
    
    textureStore(
        holo_volume, 
        vec3<i32>(i32(s), i32(r), i32(z_coord)), 
        vec4<f32>(r_col, g_col, b_col, a_col)
    );
}
