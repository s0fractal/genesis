struct CullParams {
    total_cells: u32,
    sectors: u32,
    radial_bins: u32,
    harmonics: u32,
    num_quad_nodes: u32,
    pad1: u32,
    pad2: u32,
    pad3: u32,
}

struct IndirectArgs {
    vertexCount: u32,
    instanceCount: atomic<u32>,
    firstVertex: u32,
    firstInstance: u32,
}

@group(0) @binding(0) var<uniform> params: CullParams;
@group(0) @binding(1) var<storage, read_write> indirect_args: IndirectArgs;
@group(0) @binding(2) var<storage, read_write> visible_instances: array<u32>;
@group(0) @binding(3) var<storage, read> visible_quad_nodes: array<vec4<u32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.total_cells) {
        return;
    }

    let layer_size = params.harmonics * params.radial_bins * params.sectors;
    let rem_tau = idx % layer_size;
    let rem = rem_tau % (params.radial_bins * params.sectors);
    let rho = rem / params.sectors;
    let sector = rem % params.sectors;

    var is_visible = false;
    for (var i = 0u; i < params.num_quad_nodes; i++) {
        let node = visible_quad_nodes[i];
        // node.x = minSector, node.y = maxSector, node.z = minRho, node.w = maxRho
        if (sector >= node.x && sector < node.y && rho >= node.z && rho < node.w) {
            is_visible = true;
            break;
        }
    }

    if (is_visible) {
        let write_idx = atomicAdd(&indirect_args.instanceCount, 1u);
        visible_instances[write_idx] = idx;
    }
}
