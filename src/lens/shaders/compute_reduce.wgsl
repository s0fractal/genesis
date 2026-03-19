struct Pair {
  score: i32,
  index: i32,
};

@group(0) @binding(0) var<storage, read> scores: array<i32>;
@group(0) @binding(1) var<storage, read_write> out: array<Pair>;

var<workgroup> shared_arr: array<Pair, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>
) {
  let i = gid.x;
  shared_arr[lid.x] = Pair(scores[i], i32(i));

  workgroupBarrier();

  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    
    if (lid.x < stride) {
      let a = shared_arr[lid.x];
      let b = shared_arr[lid.x + stride];
      
      // Evolutionary survival selection metric: Global topological Minimum
      if (b.score < a.score) {
        shared_arr[lid.x] = b;
      }
    }
    
    workgroupBarrier();
    stride = stride >> 1u;
  }

  // The local minimum candidate collapses into the root output node
  if (lid.x == 0u) {
    out[wid.x] = shared_arr[0];
  }
}
