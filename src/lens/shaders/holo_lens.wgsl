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
  pad2: u32,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  sector_heat: array<vec4<f32>, 16>,
};

@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var holo_volume: texture_3d<f32>;
@group(0) @binding(3) var holo_sampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec3<f32>, // 3D UV for the volume
    @location(1) z_depth: f32,
};

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index: u32, @builtin(instance_index) instance_index: u32) -> VertexOutput {
    // Generate an instanced plane for Volumetric Slicing
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );
    var uvs = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(1.0, 0.0)
    );

    let base_pos = pos[vertex_index];
    let base_uv = uvs[vertex_index];
    
    // Scale the plane to cover the Torus geometry (usually radius = Math.PI * ~3) -> roughly 12 units
    let scale = 15.0;
    
    // Calculate vertical slice position (Y axis) based on historical Z (instance)
    // We stack the history vertically
    let total_slices = params.harmonics * params.tau_depth;
    let slice_normalized = f32(instance_index) / f32(total_slices);
    
    // Y offsets for vertical stacking
    let y_height = 8.0; 
    let y_pos = (slice_normalized - 0.5) * y_height;
    
    // Adding slight sinusoidal warping based on time to give it 'fluidity'
    let wave_y = sin(base_pos.x * 2.0 + params.time * 2.0) * cos(base_pos.y * 2.0) * 0.5;

    let world_pos = vec4<f32>(base_pos.x * scale, y_pos + wave_y, base_pos.y * scale, 1.0);
    
    var out: VertexOutput;
    out.position = params.proj * params.view * world_pos;
    out.uv = vec3<f32>(base_uv.x, base_uv.y, slice_normalized);
    out.z_depth = slice_normalized;
    return out;
}

@fragment
fn fragment_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Sample the 3D Holographic Volume
    // To map Cartesian UVs to Polar (Torus Grid) Space:
    let cx = in.uv.x * 2.0 - 1.0;
    let cy = in.uv.y * 2.0 - 1.0;
    
    let rad = sqrt(cx * cx + cy * cy); // 0.0 to 1.0 corresponds to r
    let ang = atan2(cy, cx) + 3.14159265359; // 0.0 to PI*2
    let ang_norm = ang / 6.283185307; // 0.0 to 1.0 corresponds to sectors
    
    if (rad > 1.0 || rad < 0.01) {
        discard;
    }
    
    let polar_uv = vec3<f32>(ang_norm, rad, in.uv.z);
    
    let holo_sample = textureSample(holo_volume, holo_sampler, polar_uv);
    
    // Render continuous wave interference
    // Holographic resonance color scaling
    let density = holo_sample.a;
    if (density < 0.02) {
        discard;
    }

    // Color mixing based on historical interference
    let r = holo_sample.r;
    let g = holo_sample.g;
    let b = holo_sample.b;
    
    // Amplify color for additive blending superposition
    return vec4<f32>(r * 2.0, g * 1.5, b * 3.0, density * 0.25);
}
