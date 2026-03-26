override SHADOW_BUCKET_MIN: i32;
override SHADOW_BUCKET_MAX: i32;

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

@group(0) @binding(0) var<storage, read> field: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read> akashic_theta: array<u32>;
@group(0) @binding(3) var<storage, read> akashic_strength: array<u32>;
@group(0) @binding(4) var<storage, read> visible_instances: array<u32>;

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

fn get_akashic_theta(idx: u32) -> f32 {
    let word_idx = idx / 4u;
    let byte_shift = (idx % 4u) * 8u;
    return f32((akashic_theta[word_idx] >> byte_shift) & 0xFFu) / 255.0;
}

fn get_akashic_strength(idx: u32) -> f32 {
    let word_idx = idx / 4u;
    let byte_shift = (idx % 4u) * 8u;
    return f32((akashic_strength[word_idx] >> byte_shift) & 0xFFu) / 255.0;
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


@vertex
fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) inst_idx: u32) -> VertexOutput {
  // Era 267: Instanced vertices arrive indirectly compacted from compute_cull.wgsl
  let idx = visible_instances[inst_idx];
  
  let layer_size = params.harmonics * params.radial_bins * params.sectors;
  let tau = idx / layer_size;
  let rem_tau = idx % layer_size;

  let harmonic = rem_tau / (params.radial_bins * params.sectors);
  let rem = rem_tau % (params.radial_bins * params.sectors);
  let rho = rem / params.sectors;
  let sector = rem % params.sectors;

  // Era 176 / 232: Native AoS Parsing (16-byte aligned structs)
  let word_base = idx * 4u;
  let plasmid_low = field[word_base];
  let plasmid_high = field[word_base + 1u];
  let word2 = field[word_base + 2u];
  let word3 = field[word_base + 3u];

  // Word 3 bytes: [0: theta, 1: energy/amplitude, 2: lock, 3: entanglement]
  let theta = extract_byte(word3, 0u);
  let amplitude = extract_byte(word3, 1u);
  let lock = extract_byte(word3, 2u);
  let entanglement = extract_byte(word3, 3u);
  
  // Word 2 bytes: [0-1: omega, 2: time_dilation, 3: pad]
  let time_dilation = f32((word2 >> 16u) & 0xFFu) / 10.0; // Dilate up to threshold

  let angle = f32(sector) / f32(params.sectors) * 6.2831853;
  let radius_t = f32(rho + 1u) / f32(params.radial_bins + 1u);
  let major_radius = 2.8 * radius_t;
  let z = (f32(harmonic) - f32(params.harmonics - 1u) * 0.5) * 0.6;

  // Era 134 Vector B: Chrono-Torus Memory Visualization
  let time_dist = f32((params.current_tau + params.tau_depth - tau) % params.tau_depth);
  let history_fade = exp(-time_dist * 1.5); // Exponential timeline decay
  
  // Era 214 Vectors 1 & 2: Phenotypic Extrusion (AST 3D Render topology)
  let plasmid_amplitude = f32((plasmid_low >> 24u) & 0xFFu);
  let plasmid_entanglement = f32((plasmid_low >> 16u) & 0xFFu);
  let p_amp_norm = select(0.0, clamp((plasmid_amplitude - 40.0) / 215.0, 0.0, 1.0), plasmid_low != 0u || plasmid_high != 0u);
  let p_ent_norm = select(0.0, clamp(plasmid_entanglement / 255.0, 0.0, 1.0), plasmid_low != 0u || plasmid_high != 0u);

  // Z-Depth Extrusion: Dominating algorithms visually extrude toward the glass
  let chrono_z = z - (time_dist * 0.45) + (p_amp_norm * 0.55); 
  
  // Dynamic wobble resonance binding Entanglement DNA
  let wobble_z = sin(params.time * 2.0 + angle * 4.0 + radius_t * 8.0) * 0.05 * (entanglement + (p_ent_norm * 2.5));
  let base_pos = vec3<f32>(cos(angle) * major_radius, sin(angle) * major_radius, chrono_z + wobble_z);

  // Quad Billboard
  let quad = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );

  let view_proj = params.proj * params.view;

  let right = vec3<f32>(params.view[0][0], params.view[1][0], params.view[2][0]);
  let up = vec3<f32>(params.view[0][1], params.view[1][1], params.view[2][1]);
  
  // Phenotypic Cell Magnification  
  let base_size = 0.04 + amplitude * 0.12 + entanglement * 0.22 + (p_amp_norm * 0.18);
  let chronological_compression = max(0.2, 1.0 - (time_dist * 0.25)); // compress geometry into the past
  let particle_size = base_size * chronological_compression;
  
  // Era 217 Vector 1: Kuramoto Vector Instancing (Directional Flux)
  let kuramoto_angle = theta * 6.2831853;
  let stretch_x = 1.0 + (amplitude * 4.0); // High amplitude means long directional streaks
  let stretch_y = 0.2 + (entanglement * 0.8); // Visually thinner to look like arrows/flows
  
  let q_x = quad[vi].x * stretch_x;
  let q_y = quad[vi].y * stretch_y;
  
  // Rotate the stretched quad to align with the oscillator's thermodynamic phase
  let rot_x = q_x * cos(kuramoto_angle) - q_y * sin(kuramoto_angle);
  let rot_y = q_x * sin(kuramoto_angle) + q_y * cos(kuramoto_angle);
  
  let quad_pos = base_pos + (right * rot_x + up * rot_y) * particle_size;

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

  // Era 600: Quantum Bloch Sphere Probability Rendering
  // ent maps to Probability Amplitude |1> (0.0 to 1.0)
  // theta maps to Quantum Phase Phi (0.0 to 1.0)
  
  let prob_excited = sin(entanglement * 1.57079); // sin(theta/2)
  let prob_ground = cos(entanglement * 1.57079); // cos(theta/2)
  
  // Ground states |0> are deep void-blue, Excited states |1> are blinding plasma-white
  let color_ground = vec3<f32>(0.02, 0.05, 0.2);
  let color_excited = hsv2rgb(fract(theta + 0.5), 1.0, 1.0); // Phase dictates the excited energy frequency
  
  var base_color = mix(color_ground, color_excited, prob_excited * prob_excited * amplitude);

  // Era 171: X-Ray Debug Override for the Shadow Network
  if (params.debug_shadow == 1u && out.is_latent > 0.5) {
      base_color = vec3<f32>(1.0, 0.0, 0.8); // Neon Magenta X-Ray Glow
      out.is_latent = 0.0; // Intercept discarding
  }

  // O-42 Phase 1: Future Tension Heatmap Rendering ♨️
  if (params.heatmap_toggle == 1u) {
      let _omega_byte = f32((word2 >> 8u) & 0xFFu) / 255.0; // Extract high byte of i16 omega approximation
      let stress_t = abs(theta - _omega_byte);
      let stress = min(stress_t, 1.0 - stress_t) * 2.0;
      
      let t_hue = (1.0 - stress) * 0.4;
      let t_val = stress * 2.0 + 0.2;
      base_color = hsv2rgb(t_hue, 1.0, min(1.0, t_val));
  }

  // Era 146: Epigenetic Plasmid Overlay
  if (plasmid_low != 0u || plasmid_high != 0u) {
      // The Biological Hue is strictly encoded inside the terminal byte
      let p_hue = f32(plasmid_low & 0xFFu) / 255.0;
      
      let signature = plasmid_low ^ plasmid_high;
      let p_sat = 0.8 + (f32((signature >> 8u) & 0xFFu) / 1275.0);
      let p_color = hsv2rgb(p_hue, min(1.0, p_sat), 1.0);
      base_color = mix(base_color, p_color, 0.85);
  }
  
  // Era 232: Relativistic Time Dilation Rendering (Cryo-Frost)
  if (time_dilation > 0.0) {
      // Intensely brighten and shift toward icy cyan to reflect chronological freezing
      let frost = clamp(time_dilation, 0.0, 1.0);
      let frost_color = vec3<f32>(0.5, 0.9, 1.0);
      base_color = mix(base_color, frost_color, frost * 0.8);
  }  // Era 239.3: The Quantum Eye (Observer Gaze Topology)
  // When the LLM views the Torus or explicitly mutates a sector, thermodynamic heat spikes 
  let heat_vec_idx = sector / 4u;
  let sub_idx = sector % 4u;
  let local_heat = params.sector_heat[heat_vec_idx][sub_idx]; 
  
  var final_glow = (0.25 + min(0.75, lock * 0.5 + amplitude * 0.5)) * history_fade;

  if (local_heat > 0.5) {
      let gaze_intensity = clamp(local_heat / 10.0, 0.0, 1.0);
      let eye_color = vec3<f32>(1.0, 0.0, 0.35); // Neural Magenta "Gaze"
      base_color = mix(base_color, eye_color, gaze_intensity * 0.85);
      
      // Intense Gaze excites particle visual entropy
      final_glow = final_glow * (1.0 + gaze_intensity);
  }

  // Phase 15: The Akashic Field Visualizer Layer
  let akashic_idx = sector + (rho * params.sectors) + (harmonic * params.sectors * params.radial_bins);
  let ak_theta = get_akashic_theta(akashic_idx);
  let ak_strength = get_akashic_strength(akashic_idx);
  
  if (ak_strength > 0.02) {
      let ak_hue = fract(ak_theta + 0.5);
      let ak_color = hsv2rgb(ak_hue, 0.9, 0.5 + (ak_strength * 0.5));
      base_color = mix(base_color, ak_color, ak_strength * 0.45);
      final_glow = final_glow + (ak_strength * 0.25);
  }

  out.color = base_color;
  out.glow = final_glow;
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
