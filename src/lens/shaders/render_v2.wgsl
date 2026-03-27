// 👁️ OMEGA-64: V2 Hyper-Minimalist Render Pipeline
// Projects the PhaseAgentMinimal array directly onto the screen
// using pure Polar-to-Cartesian matrix translation.

struct PhaseTopology {
    q_phase: u32,
    q_sectors: u32,
    q_radial: u32,
    q_math: u32,
}

struct SignalStore {
    dirty_flags: u32,
    absolute_tick: u32,
    active_agent_count: u32,
    max_cells: u32,
}

struct PhaseAgentMinimal {
    phase: u32,
    energy: u32,
    base_freq: i32,
    state_flags: u32,
}

@group(0) @binding(0) var<uniform> topology: PhaseTopology;
@group(0) @binding(1) var<uniform> signals: SignalStore;
@group(0) @binding(2) var<storage, read> agents: array<PhaseAgentMinimal>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_idx: u32, @builtin(instance_index) instance_idx: u32) -> VertexOutput {
    var out: VertexOutput;
    
    if (instance_idx >= signals.active_agent_count) {
        // Discard out of bounds instances
        out.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        return out;
    }

    let agent = agents[instance_idx];
    
    // 1. Decode Matrix Topology limits
    let max_sectors = f32(1u << topology.q_sectors);
    let max_radius = f32(1u << topology.q_radial);
    
    // 2. Spatial Mapping (Ring Buffer distribution)
    let radial_idx = f32(instance_idx % (1u << topology.q_radial));
    let sector_idx = f32(instance_idx / (1u << topology.q_radial));
    
    let r = radial_idx / max_radius; 
    let angle = (sector_idx / max_sectors) * 6.28318530718;
    
    // 3. Phase Interference Projection
    // The agent's phase (0 to 127) alters its physical radius, creating pulsing waves
    let phase_norm = f32(agent.phase) / f32((1u << topology.q_phase) - 1u);
    let dynamic_r = r + (phase_norm * 0.05); // Subtle vibration
    
    let x = cos(angle) * dynamic_r;
    let y = sin(angle) * dynamic_r;
    
    // 4. Instanced Quad Generation (6 vertices per instance)
    let quad_pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
    );
    
    // Scale particle size slightly by energy
    let energy_scale = f32(agent.energy) / 1000.0;
    
    // Increased particle_size significantly to fix sub-pixel smearing
    let particle_size = 0.002 + (0.008 * energy_scale); 
    
    // Quick Aspect Ratio Hack for a square matrix on a widescreen
    let aspect_ratio = 1920.0 / 1080.0; 
    let offset = quad_pos[vertex_idx] * particle_size;
    
    // Transform to screen space
    out.position = vec4<f32>((x + offset.x) / aspect_ratio, y + offset.y, 0.0, 1.0);
    
    // 5. Chromatic Phase Mapping
    // 7 Notes, 7 Colors mapping. We use HSV-to-RGB approximation.
    let hue = phase_norm; 
    out.color = vec4<f32>(hue, 0.5 + (energy_scale * 0.5), 1.0 - hue, 1.0);
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Add simple circular glow to the quad
    return in.color;
}
