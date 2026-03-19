struct Mutation {
  phaseShift: i32,
  amplitude: i32,
};

struct Best {
  score: i32,
  index: i32,
};

@group(0) @binding(0) var<storage, read> best: Best;
@group(0) @binding(1) var<storage, read> mutations: array<Mutation>;
@group(0) @binding(2) var<storage, read_write> field: array<i32>;
@group(0) @binding(3) var<storage, read> lut: array<i32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let winner = best.index;
  
  let m = mutations[winner];

  let cell_base = idx * 3u;
  let p = field[cell_base];
  let f_energy = field[cell_base + 1u];

  let p_mut = (u32(p) + u32(m.phaseShift)) & 255u;
  let val = lut[p_mut] + m.amplitude;

  // The optimal physical evolution state overwrites the shared array bounds seamlessly
  field[cell_base + 1u] = f_energy + val;
}
