// 🌌 OMEGA-64: Era 950 V2 Compute Shader
// Hardware-Targeted, SIMD-aligned Zero-Cost Memory Mapping.
// This shader is dynamically targeted to the `omega_v2` SharedArrayBuffer.

struct PhaseTopology {
    q_phase: u32,     // Resolves 2^q_phase angles
    q_sectors: u32,   // Resolves 2^q_sectors geographic sectors
    q_radial: u32,
    q_math: u32,
}

struct SignalStore {
    dirty_flags: u32,
    absolute_tick: u32,
    active_agent_count: u32,
    max_cells: u32,
}

struct OntologicalIntent {
    focus_x: i32,
    focus_y: i32,
    mass: i32,
    radius: i32,
}

struct IntentArray {
    intents: array<OntologicalIntent, 4>,
}

// Exactly 32 bytes. Maps 1:1 to zero-cost Rust PhaseAgentMinimal 
// and naturally aligns to vec4<u32> x 2 for maximum GPU coalesced reads.
struct PhaseAgentMinimal {
    phase: u32,
    energy: u32,
    base_freq: i32,     // signed Q20
    state_flags: u32,
    genome: u32,
    memory_x: u32,
    memory_y: u32,
    memory_z: u32,
}

// Standard Uniforms (Written directly by Rust without per-frame JS mapping)
@group(0) @binding(0) var<uniform> topology: PhaseTopology;
@group(0) @binding(1) var<uniform> signals: SignalStore;
@group(0) @binding(4) var<uniform> intent_array: IntentArray;

// The Shared Array Buffer View
@group(0) @binding(2) var<storage, read_write> agents: array<PhaseAgentMinimal>;

// The 128-element Deterministic Lookup Table (Q20 Fixed-Point)
@group(0) @binding(3) var<storage, read> sine_lut: array<i32, 128>;

// O(1) Constant Time Deterministic Trigonometry
fn deterministic_sin(phase: u32, q_phase: u32) -> i32 {
    let index = phase & ((1u << q_phase) - 1u);
    // Since q_phase is 7 (128), we map perfectly to the 128-LUT natively!
    return sine_lut[index]; 
}

fn deterministic_cos(phase: u32, q_phase: u32) -> i32 {
    let offset_phase = phase + (1u << (q_phase - 2u)); // Shift by PI/2 (32 if q_phase=7)
    let index = offset_phase & ((1u << q_phase) - 1u);
    return sine_lut[index];
}

// 🧠 O(Q_PHASE) Deterministic ArcTangent Approximation
// Prevents Apple/Nvidia f32 rounding discrepancies by doing a strict integer dot-product scan.
fn deterministic_atan2(y: i32, x: i32, q_phase: u32) -> u32 {
    if (x == 0 && y == 0) { return 0u; }
    
    var best_phase = 0u;
    var max_dot = -2147483648; // minimum i32
    let steps = 1u << q_phase;
    
    for (var p = 0u; p < steps; p++) {
        let sx = deterministic_cos(p, q_phase);
        let sy = deterministic_sin(p, q_phase);
        
        // Q20 * Q20 overflows i32, so we downshift by 10 before multiplying (Q10 * Q10 -> Q20)
        let dot = (x >> 10) * (sx >> 10) + (y >> 10) * (sy >> 10);
        
        if (dot > max_dot) {
            max_dot = dot;
            best_phase = p;
        }
    }
    return best_phase;
}

@compute @workgroup_size(64)
fn compute_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    // Darwinian cull: Do not process memory outside the active hardware budget
    if (index >= signals.active_agent_count) {
        return;
    }

    // 1. Memory Fetch
    var agent = agents[index];
    let max_phase_mask = (1u << topology.q_phase) - 1u;
    
    // 2. Compute Target Phase (For Era 1000 Phase 1, we sync to a Global Deterministic Anchor)
    // The anchor rotates smoothly based on the absolute tick
    let global_anchor_phase = signals.absolute_tick & max_phase_mask;
    
    // Convert current phase and anchor to Cartesian vectors using our 128-LUT
    let anchor_x = deterministic_cos(global_anchor_phase, topology.q_phase);
    let anchor_y = deterministic_sin(global_anchor_phase, topology.q_phase);
    
    let my_x = deterministic_cos(agent.phase, topology.q_phase);
    let my_y = deterministic_sin(agent.phase, topology.q_phase);
    
    // 3. Integer Kuramoto Coupling + Ontological Gravity (Multi-Intent)
    let k_coupling = min(agent.energy, 1000u); 
    
    var force_x = my_x + (((anchor_x - my_x) * i32(k_coupling)) >> 10u);
    var force_y = my_y + (((anchor_y - my_y) * i32(k_coupling)) >> 10u);
    
    // Convert Agent Space to Interaction Output Screen Space Once
    let radial_idx = f32(index % (1u << topology.q_radial));
    let sector_idx = f32(index / (1u << topology.q_radial));
    let max_r = f32(1u << topology.q_radial);
    let max_s = f32(1u << topology.q_sectors);
    
    let phase_norm = f32(agent.phase) / f32(max_phase_mask);
    let dynamic_r = (radial_idx / max_r) + (phase_norm * 0.05);
    let angle = (sector_idx / max_s) * 6.283185;
    
    let screen_x = i32(cos(angle) * dynamic_r * 1000.0 * 1.777); // Aspect ratio adjusted
    let screen_y = i32(sin(angle) * dynamic_r * 1000.0);

    // Accumulate pull from all 4 Intent Nodes (Remote Peers / Local Mouse)
    for (var i = 0u; i < 4u; i++) {
        let intent = intent_array.intents[i];
        if (intent.mass > 0) {
            let dx = intent.focus_x - screen_x;
            let dy = intent.focus_y - screen_y;
            
            // Manhattan distance approximation
            let dist = abs(dx) + abs(dy);
            
            if (dist < intent.radius) {
                // Apply massive local pull
                force_x += (dx * intent.mass) >> 8u;
                force_y += (dy * intent.mass) >> 8u;
            }
        }
    }
    
    // Re-resolve the new aggregate phase using deterministic atan2
    let coupled_phase = deterministic_atan2(force_y, force_x, topology.q_phase);
    
    // 4. Mutate Phase directly based on base_freq & coupling
    // (agent.base_freq is Q20, q_math is 20, so shift gives an integer tick jump)
    let new_phase = (coupled_phase + u32(agent.base_freq >> topology.q_math)) & max_phase_mask;
    let new_energy = agent.energy; // Assuming energy is not mutated in this snippet

    // 5. ERA 2000: NEURAL CELLULAR AUTOMATA (NCA)
    // Mutate the genome via a basic XR-Shift utilizing the new forces
    var new_genome = agent.genome;
    new_genome ^= u32(abs(force_x)) << 2u;
    new_genome ^= u32(abs(force_y)) >> (agent.energy % 4u);
    new_genome ^= agent.memory_z;
    
    // Trade memory gradient via the coupled interaction using aggregate forces
    var new_mem_x = agent.memory_x + (u32(abs(force_x)) % 255u);
    var new_mem_y = agent.memory_y + (u32(abs(force_y)) % 255u);
    var new_mem_z = (agent.memory_z + new_genome) % 255u;
    
    if (new_mem_x > 255u) { new_mem_x = 0u; }
    if (new_mem_y > 255u) { new_mem_y = 0u; }
    
    // Export the Turing-Complete Neural State Back to 32-Byte VRAM Slice
    agents[index].phase = new_phase;
    agents[index].energy = new_energy;
    agents[index].base_freq = agent.base_freq;
    agents[index].state_flags = agent.state_flags;
    agents[index].genome = new_genome;
    agents[index].memory_x = new_mem_x;
    agents[index].memory_y = new_mem_y;
    agents[index].memory_z = new_mem_z;
}
