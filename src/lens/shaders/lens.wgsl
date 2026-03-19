struct Params {
  width: u32,
  height: u32,
};

@group(0) @binding(0) var<storage, read> field: array<u32>; 
@group(0) @binding(1) var<uniform> params: Params;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

fn extract_byte(u32_val: u32, byte_idx: u32) -> f32 {
    let shift = byte_idx * 8u;
    let b = (u32_val >> shift) & 0xFFu;
    return f32(b) / 255.0;
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

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let x = u32(pos.x);
  let y = u32(pos.y);
  let cell_idx = y * params.width + x; 
  
  // Extract theta_now (byte offset 262144 -> u32 offset 65536)
  let t_u32_idx = 65536u + (cell_idx / 4u);
  let byte_offset = cell_idx % 4u;
  let theta_val = extract_byte(field[t_u32_idx], byte_offset);

  // Extract energy (byte offset 589824 -> u32 offset 147456)
  let e_u32_idx = 147456u + (cell_idx / 4u);
  let e_val = extract_byte(field[e_u32_idx], byte_offset);
  
  // Extract plasmids (byte offset 655360 -> u32 offset 163840)
  // A plasmid is u64 (8 bytes), stored as two consecutive u32s. We only need the lower 32 bits for color hashing.
  let p_u32_idx = 163840u + (cell_idx * 2u);
  let plasmid_low = field[p_u32_idx];

  // Base aesthetic from mathematical phase and kinetic energy
  let hue = fract(theta_val + 0.5);
  let value = pow(e_val, 0.7);
  var base_color = hsv2rgb(hue, 1.0, value);

  // --- Ontology 13 WebGPU Semantic Coloring ---
  // If a Plasmid Attractor exists, explicitly overwrite the organic hue with the Idea's hash signature
  if (plasmid_low != 0u) {
      let p_hue = f32(plasmid_low & 0xFFu) / 255.0;
      let p_sat = 0.6 + (f32((plasmid_low >> 8u) & 0xFFu) / 637.5);
      let p_val = 0.8 + (f32((plasmid_low >> 16u) & 0xFFu) / 1275.0);
      
      let p_color = hsv2rgb(p_hue, p_sat, p_val);
      // Vivid mixture prioritizing the plasmid's unique topological color signature
      base_color = mix(base_color, p_color, 0.90);
  }

  // Energy pulse
  let glow = smoothstep(0.7, 1.0, e_val);
  let final_color = base_color + vec3<f32>(glow * 0.4);

  return vec4<f32>(final_color, 1.0);
}
