// 👁️ OMEGA-64: V2 Hyper-Minimalist Render Pipeline
// Projects the PhaseAgentMinimal array directly onto the screen
// using pure Polar-to-Cartesian matrix translation.

struct PhaseTopology {
    q_phase: u32,
    q_sectors: u32,
    q_radial: u32,
    q_math: u32,
    weather_multiplier: u32,
    alpha: i32,
    _pad1: u32,
    _pad2: u32,
}

struct ProperTime {
    causal_ticks: u32,
    phase_lock_integral: u32,
    entropy_burned: u32,
};

struct SignalStore {
    dirty_flags: u32,
    proper_time: ProperTime,
    active_agent_count: u32,
    max_cells: u32,
    total_entropy_low: u32,
    total_entropy_high: u32,
    total_energy: u32,
    p90_energy: u32,
    p90_age: u32,
    _pad2: u32,
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
    @location(1) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_idx: u32, @builtin(instance_index) instance_idx: u32) -> VertexOutput {
    var out: VertexOutput;
    
    if (instance_idx >= signals.active_agent_count) {
        // Discard out of bounds instances
        out.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        return out;
    }

    // Steganographic Oracle Vision
    if (instance_idx == 0u) {
        // Render a cryptographic square at the bottom left
        let quad_pos_dot = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
        );
        let pos = quad_pos_dot[vertex_idx];
        out.position = vec4<f32>(-0.95 + (pos.x * 0.02), -0.95 + (pos.y * 0.02), 0.0, 1.0);
        out.uv = pos;
        
        // Encode absolute_tick into RGB
        let tick = signals.proper_time.causal_ticks;
        let r_enc = f32((tick >> 16u) & 0xFFu) / 255.0;
        let g_enc = f32((tick >> 8u) & 0xFFu) / 255.0;
        let b_enc = f32(tick & 0xFFu) / 255.0;
        out.color = vec4<f32>(r_enc, g_enc, b_enc, 2.0); // alpha 2.0 triggers bypass
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
    out.uv = quad_pos[vertex_idx];
    
    // 5. Quantum Chromodynamics (Semantic Routing)
    // Genome determines the agent's Archetype (Aries, Cancer, Libra, Capricorn)
    let archetype = agent.genome % 4u;
    var r_col = 0.0;
    var g_col = 0.0;
    var b_col = 0.0;
    
    if (archetype == 0u) {
        // Aries (Neon Red)
        r_col = 1.0; g_col = 0.1; b_col = 0.1;
    } else if (archetype == 1u) {
        // Cancer (Neon Blue)
        r_col = 0.1; g_col = 0.6; b_col = 1.0;
    } else if (archetype == 2u) {
        // Libra (Neon Emerald)
        r_col = 0.2; g_col = 1.0; b_col = 0.3;
    } else {
        // Capricorn (Neon Purple/Pink)
        r_col = 0.9; g_col = 0.2; b_col = 1.0;
    }
    
    // Subtle memory noise
    let r_tint = f32(agent.memory_x % 32u) / 128.0;
    let b_tint = f32(agent.memory_z % 32u) / 128.0;

    r_col = min(r_col + r_tint, 1.0) * energy_ratio;
    g_col = g_col * energy_ratio;
    b_col = min(b_col + b_tint, 1.0) * energy_ratio;
    
    out.color = vec4<f32>(r_col, g_col, b_col, 1.0);
    
    // Neural White Flash (Packet Visualization)
    // If this cell is holding a routing packet, it glows blinding white.
    if (agent.memory_z > 0u) {
        // Boost size slightly for visibility and set pure white
        out.color = vec4<f32>(1.5, 1.5, 1.5, 1.0); 
    }
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Steganographic Oracle Vision (Pure pixel bypass)
    if (in.color.a > 1.5) {
        return vec4<f32>(in.color.rgb, 1.0);
    }

    // Elegant exponential SDF (Signed Distance Field) for soft organic cell membranes
    let dist = dot(in.uv, in.uv);
    if (dist > 1.0) {
        discard;
    }
    
    // Smooth plasma glow with high central concentration
    let alpha = exp(-dist * 4.0) * in.color.a; 
    return vec4<f32>(in.color.rgb, alpha);
}
