struct Mutation {
  phaseShift: i32,
  amplitude: i32,
};

@group(0) @binding(0) var<storage, read> field: array<i32>; 
@group(0) @binding(1) var<storage, read> lut: array<i32>;
@group(0) @binding(2) var<storage, read> mutations: array<Mutation>;
@group(0) @binding(3) var<storage, read_write> scores: array<atomic<i32>>;

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>
) {
  // Candidate branch matching
  let candidate = wid.x;
  let idx = gid.x;

  let m = mutations[candidate];

  // Map SoA components via static stride offset
  let cell_base = idx * 3u;
  let phase_raw = field[cell_base];
  let energy_raw = field[cell_base + 1u];

  let p_mut = (u32(phase_raw) + u32(m.phaseShift)) & 255u;
  let val = lut[p_mut] + m.amplitude;
  
  // Compute hypothetical next reality state
  let next = energy_raw + val;
  
  // Calculate relative topology semantic drift
  let metric = abs(next);
  
  atomicAdd(&scores[candidate], metric);
}
