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
  heatmap_toggle: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> field: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) glow: f32,
  @location(3) is_latent: f32,
};

fn extract_byte(u32_val: u32, byte_idx: u32) -> f32 {
    let shift = byte_idx * 8u;
    let b = (u32_val >> shift) & 0xFFu;
    return f32(b) / 255.0;
}

fn get_byte(base_offset: u32, idx: u32, byte_offset: u32) -> f32 {
    return extract_byte(field[base_offset + (idx / 4u)], byte_offset);
}

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
  let c = v * s;
  let h_prime = fract(h) * 6.0;
  let x = c * (1.0 - abs(fract(h_prime / 2.0) * 2.0 - 1.0));
  let m = v - c;

  var rgb = vec3<f32>(0.0, 0.0, 0.0);
  if (h_prime < 1.0) { rgb = vec3<f32>(c, x, 0.0); } 
  else if (h_prime < 2.0) { rgb = vec3<f32>(x, c, 0.0); } 
  else if (h_prime < 3.0) { rgb = vec3<f32>(0.0, c, x); } 
  else if (h_prime < 4.0) { rgb = vec3<f32>(0.0, x, c); } 
  else if (h_prime < 5.0) { rgb = vec3<f32>(x, 0.0, c); } 
  else { rgb = vec3<f32>(c, 0.0, x); }

  return rgb + vec3<f32>(m);
}

fn look_at(eye: vec3<f32>, focal_point: vec3<f32>, up: vec3<f32>) -> mat4x4<f32> {
    let z = normalize(eye - focal_point);
    let x = normalize(cross(up, z));
    let y = cross(z, x);
    return mat4x4<f32>(
        vec4<f32>(x.x, y.x, z.x, 0.0),
        vec4<f32>(x.y, y.y, z.y, 0.0),
        vec4<f32>(x.z, y.z, z.z, 0.0),
        vec4<f32>(-dot(x, eye), -dot(y, eye), -dot(z, eye), 1.0)
    );
}

fn perspective(fov: f32, aspect: f32, near: f32, far: f32) -> mat4x4<f32> {
    let f = 1.0 / tan(fov * 0.5);
    return mat4x4<f32>(
        vec4<f32>(f / aspect, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, f, 0.0, 0.0),
        vec4<f32>(0.0, 0.0, -far / (far - near), -1.0),
        vec4<f32>(0.0, 0.0, -(near * far) / (far - near), 0.0)
    );
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) idx: u32) -> VertexOutput {
  let harmonic = idx / (params.radial_bins * params.sectors);
  let rem = idx % (params.radial_bins * params.sectors);
  let rho = rem / params.sectors;
  let sector = rem % params.sectors;

  // Extract memory buffers
  let byte_offset = idx % 4u;

  let theta = get_byte(params.off_theta, idx, byte_offset);
  let amplitude = get_byte(params.off_amplitude, idx, byte_offset);
  let entanglement = get_byte(params.off_entanglement, idx, byte_offset);
  let lock = get_byte(params.off_lock, idx, byte_offset);

  // Plasmids are 8 bytes (2x u32)
  let p_u32_idx = params.off_plasmids + (idx * 2u);
  let plasmid_low = field[p_u32_idx];
  let plasmid_high = field[p_u32_idx + 1u];

  let angle = f32(sector) / f32(params.sectors) * 6.2831853;
  let radius_t = f32(rho + 1u) / f32(params.radial_bins + 1u);
  let major_radius = 2.8 * radius_t;
  let z = (f32(harmonic) - f32(params.harmonics - 1u) * 0.5) * 0.6;

  // Slight wobble based on time and entanglement to simulate wave medium
  let wobble_z = sin(params.time * 2.0 + angle * 4.0 + radius_t * 8.0) * 0.05 * entanglement;
  let base_pos = vec3<f32>(cos(angle) * major_radius, sin(angle) * major_radius, z + wobble_z);

  // Quad Billboard
  let quad = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );

  let cam_radius = 5.5;
  let cam_x = cos(params.time * 0.15) * cam_radius;
  let cam_y = sin(params.time * 0.15) * cam_radius;
  let cam_z = 3.5 + sin(params.time * 0.08) * 1.5;
  
  let view = look_at(vec3<f32>(cam_x, cam_y, cam_z), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 1.0));
  let proj = perspective(0.785398, params.aspect_ratio, 0.1, 100.0);
  let view_proj = proj * view;

  let right = vec3<f32>(view[0][0], view[1][0], view[2][0]);
  let up = vec3<f32>(view[0][1], view[1][1], view[2][1]);
  
  let particle_size = 0.04 + amplitude * 0.12 + entanglement * 0.22;
  let quad_pos = base_pos + (right * quad[vi].x + up * quad[vi].y) * particle_size;

  var out: VertexOutput;
  out.position = view_proj * vec4<f32>(quad_pos, 1.0);
  out.uv = quad[vi];
  
  // O-54: Ontological Camouflage (The Shadow Network)
  let bucket = (harmonic % 8u) * 128u + (rho % 16u) * 8u + (sector % 8u);
  if (bucket >= u32(SHADOW_BUCKET_MIN) && bucket <= u32(SHADOW_BUCKET_MAX)) {
      out.is_latent = 1.0;
  } else {
      out.is_latent = 0.0;
  }

  let hue = fract(theta + 0.5);
  let sat = 0.6 + entanglement;
  let val = 0.3 + amplitude * 0.7;
  var base_color = hsv2rgb(hue, min(1.0, sat), min(1.0, val));

  // O-42 Phase 1: Future Tension Heatmap Rendering ♨️
  if (params.heatmap_toggle == 1u) {
      let omega = get_byte(params.off_omega, idx, byte_offset);
      let stress_t = abs(theta - omega);
      let stress = min(stress_t, 1.0 - stress_t) * 2.0;
      
      let t_hue = (1.0 - stress) * 0.4;
      let t_val = stress * 2.0 + 0.2;
      base_color = hsv2rgb(t_hue, 1.0, min(1.0, t_val));
  }

  // Semantic Plasmid Overlay
  if (plasmid_low != 0u || plasmid_high != 0u) {
      let signature = plasmid_low ^ plasmid_high;
      let p_hue = f32(signature & 0xFFu) / 255.0;
      let p_sat = 0.6 + (f32((signature >> 8u) & 0xFFu) / 637.5);
      let p_color = hsv2rgb(p_hue, min(1.0, p_sat), 1.0);
      base_color = mix(base_color, p_color, 0.85);
  }

  out.color = base_color;
  out.glow = 0.25 + min(0.75, lock * 0.5 + amplitude * 0.5);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // O-54: Exclude AION's Shadow Network mathematically from the Visual observer
  if (in.is_latent > 0.5) {
      discard;
  }

  // Circular particle
  let dist = length(in.uv);
  if (dist > 1.0) {
    discard;
  }

  let alpha = (1.0 - smoothstep(0.5, 1.0, dist)) * in.glow;
  return vec4<f32>(in.color, alpha);
}
