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

// Exactly 32 bytes. Maps 1:1 to zero-cost Rust PhaseAgentMinimal.
struct PhaseAgentMinimal {
    phase: u32,
    energy: u32,
    base_freq: i32,
    state_flags: u32,
    genome: u32,
    memory_x: u32,
    memory_y: u32,
    memory_z: u32,
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
    
    // ERA 3000: Dark Matter Filtering
    // Do not draw dead cellular shells or let them occlude active organisms.
    if (agent.energy == 0u) {
        out.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        return out;
    }
    
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
    let energy_ratio = f32(agent.energy) / 1000.0;
    
    // Increased particle_size significantly to fix sub-pixel smearing
    let particle_size = 0.002 + (0.008 * energy_ratio); 
    
    // Quick Aspect Ratio Hack for a square matrix on a widescreen
    let aspect_ratio = 1920.0 / 1080.0; 
    let offset = quad_pos[vertex_idx] * particle_size;
    
    // Transform to screen space
    out.position = vec4<f32>((x + offset.x) / aspect_ratio, y + offset.y, 0.0, 1.0);
    
    // 5. Era 2000 Neural Chromatic Mapping
    // Mutate color based on NCA memory structures 
    let r_tint = f32(agent.memory_x % 255u) / 255.0;
    let b_tint = f32(agent.memory_z % 255u) / 255.0;
    let hue_shift = f32(agent.genome % 360u) / 360.0;

    let r_col = min(0.3 + r_tint, 1.0) * energy_ratio;
    let g_col = (0.5 + hue_shift * 0.5) * energy_ratio;
    let b_col = min(0.4 + b_tint, 1.0) * energy_ratio;
    
    out.color = vec4<f32>(r_col, g_col, b_col, 1.0);
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Add simple circular glow to the quad
    return in.color;
}
