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
@group(0) @binding(5) var<storage, read_write> new_mean_field: array<atomic<i32>>;
@group(0) @binding(6) var<storage, read> old_mean_field: array<i32>;

// ERA 4000: Workgroup Internal Reduction State
var<workgroup> wg_cos: array<i32, 64>;
var<workgroup> wg_sin: array<i32, 64>;

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

// ERA 1000: Phase Distance Function (Circular topology modulo wrapping)
fn phase_dist(p1: u32, p2: u32, max_p: u32) -> u32 {
    let diff = max(p1, p2) - min(p1, p2);
    if (diff > (max_p >> 1u)) { return max_p - diff; }
    return diff;
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
fn compute_main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let index = global_id.x;
    
    // ERA 4000: We must initialize workgroup memory unconditionally to prevent race conditions.
    var my_cos = 0i;
    var my_sin = 0i;
    
    // Darwinian cull: Do not process memory outside the active hardware budget
    if (index < signals.active_agent_count) {
        // 1. Memory Fetch
        var agent = agents[index];
        let max_phase_mask = (1u << topology.q_phase) - 1u;
        
        // ERA 3000: DEAD CELLS DO NOTHING
        // If energy reaches absolute zero, the neural phase structure halts entirely.
        if (agent.energy > 0u) {

            var coupled_phase: u32 = agent.phase;
            var force_x = 0;
            var force_y = 0;
            var intent_energy_bonus: i32 = 0;
            var intent_injected = false;
            
            var new_mem_x = agent.memory_x;
            var new_mem_y = agent.memory_y;
            var new_mem_z = agent.memory_z;
            
            let max_r_cells = 1u << topology.q_radial;
            let n_indices = array<u32, 4>(
                (index + signals.active_agent_count - 1u) % signals.active_agent_count,
                (index + 1u) % signals.active_agent_count,
                (index + max_r_cells) % signals.active_agent_count,
                (index + signals.active_agent_count - max_r_cells) % signals.active_agent_count
            );
    
    // 2. ERA 4000: Compute Target Phase Using Global Order Parameter (Mean Field)
    var swarm_x = old_mean_field[0] / i32(signals.active_agent_count);
    var swarm_y = old_mean_field[1] / i32(signals.active_agent_count);
    
    // Shift back up to Q20 space for integer Kuramoto calculations
    var anchor_x = swarm_x << 10u;
    var anchor_y = swarm_y << 10u;
    
    // Absolute Cold Start or Complete Destructive Interference Fallback
    if (swarm_x == 0 && swarm_y == 0) {
        let global_anchor_phase = signals.absolute_tick & max_phase_mask;
        anchor_x = deterministic_cos(global_anchor_phase, topology.q_phase);
        anchor_y = deterministic_sin(global_anchor_phase, topology.q_phase);
    }
    
    let my_x = deterministic_cos(agent.phase, topology.q_phase);
    let my_y = deterministic_sin(agent.phase, topology.q_phase);
    
    // 3. Integer Kuramoto Coupling + Ontological Gravity (Multi-Intent)
    let k_coupling = min(agent.energy, 1000u); 
    
    force_x = my_x + (((anchor_x - my_x) * i32(k_coupling)) >> 10u);
    force_y = my_y + (((anchor_y - my_y) * i32(k_coupling)) >> 10u);
    
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
        let unsigned_mass = u32(intent.mass);
        let actual_mass = i32(unsigned_mass & 65535u);
        let target_phase = (unsigned_mass >> 16u) & 255u;
        let p_payload = (unsigned_mass >> 24u) & 255u;
        
        if (actual_mass > 0) {
            let dx = intent.focus_x - screen_x;
            let dy = intent.focus_y - screen_y;
            
            // Manhattan distance approximation
            let dist = abs(dx) + abs(dy);
            
            if (dist < intent.radius) {
                // Apply massive local pull
                force_x += (dx * actual_mass) >> 8u;
                force_y += (dy * actual_mass) >> 8u;
                
                // ERA 3000: Intent Feeding
                // Being within the gravitational well grants explosive energy for sudden Mitosis.
                intent_energy_bonus += 200;
                
                // ERA 1000: Injection of Packets into the grid via Intent
                if (actual_mass >= 1000) {
                    new_mem_x = target_phase;
                    new_mem_y = p_payload;
                    new_mem_z = 255u; // Maximum TTL
                    intent_injected = true;
                }
            }
        }
    }
    
    // -------------------------------------------------------------
    // ERA 5000: QUANTUM CHROMODYNAMICS (GENETIC BATTLE ROYALE)
    // -------------------------------------------------------------
    if (signals.active_agent_count > 4u) {
        // Calibrated force: 1200 allows 4-way stable emergent crystallization
        let chr_force = 1200i; 
        
        for (var i = 0u; i < 4u; i++) {
            let n = agents[n_indices[i]];
            if (n.energy > 0u) {
                let dx_n = deterministic_cos(n.phase, topology.q_phase) - my_x;
                let dy_n = deterministic_sin(n.phase, topology.q_phase) - my_y;
                let xor_dist = countOneBits(agent.genome ^ n.genome);
                
                // Attraction bounds (Clannish coherence)
                if (xor_dist <= 10u) {
                    force_x += (dx_n * chr_force) >> 10u;
                    force_y += (dy_n * chr_force) >> 10u;
                } 
                // Xenobiological Repulsion (Lethal territorial exclusion)
                else if (xor_dist >= 22u) {
                    force_x -= (dx_n * (chr_force / 2)) >> 10u; 
                    force_y -= (dy_n * (chr_force / 2)) >> 10u;
                }
            }
        }
    }
    
    // Re-resolve the new aggregate phase using deterministic atan2
    coupled_phase = deterministic_atan2(force_y, force_x, topology.q_phase);
    
    // 4. Mutate Phase directly based on base_freq & coupling
    // (agent.base_freq is Q20, q_math is 20, so shift gives an integer tick jump)
    let new_phase = (coupled_phase + u32(agent.base_freq >> topology.q_math)) & max_phase_mask;
    
    // ERA 3000: ATP METABOLISM
    var metabolic_delta: i32 = -1; // Entropy (Base Burn)
    
    // Cosmic Resonance: Synthesize massive ATP if harmonized with the foundational math structure
    if (new_phase % 64u == 0u) {
        metabolic_delta += 150; 
    }
    
    let new_energy_calc = i32(agent.energy) + metabolic_delta + intent_energy_bonus;
    var new_energy: u32 = 0u;
    if (new_energy_calc > 0) {
        new_energy = u32(new_energy_calc);
        if (new_energy > 4000u) { new_energy = 4000u; } // Maximum ATP Capacity
    }

    // 5. ERA 2000: NEURAL CELLULAR AUTOMATA (NCA) -> ERA 5000: QCD Stability
    // Genome is now structurally deeply stable! Only mutates during Mitosis (Rust CPU side).
    let new_genome = agent.genome;
    
    // -------------------------------------------------------------
    // ERA 1000: HYPERBOLIC DNS (TAYLOR PHASE ROUTING)
    // -------------------------------------------------------------
    if (!intent_injected) {
        if (agent.memory_z > 0u) {
            // Actively Holding a Packet. Determine if it flows DOWN the gradient to a neighbor.
            let target_p = agent.memory_x;
            let my_dist = phase_dist(agent.phase, target_p, max_phase_mask);
            var lose_packet = false;
            
            for (var i = 0u; i < 4u; i++) {
                let n_opt = agents[n_indices[i]];
                if (n_opt.energy > 0u && n_opt.memory_z == 0u) {
                    let n_dist = phase_dist(n_opt.phase, target_p, max_phase_mask);
                    if (n_dist < my_dist) {
                        lose_packet = true; // Flushes towards a steeper gradient
                        break;
                    }
                }
            }
            
            if (lose_packet) {
                new_mem_x = 0u; new_mem_y = 0u; new_mem_z = 0u;
            } else {
                new_mem_z = agent.memory_z - 1u; // Trapped, entropy decays TTL
                if (new_mem_z == 0u) { new_mem_x = 0u; new_mem_y = 0u; }
            }
        } else {
            // Receptive Empty Cell. Poll neighbors for incoming Gradient Pull.
            var best_gradient = 0i;
            for (var i = 0u; i < 4u; i++) {
                let n_opt = agents[n_indices[i]];
                if (n_opt.memory_z > 0u) {
                    let target_p = n_opt.memory_x;
                    let my_dist = phase_dist(agent.phase, target_p, max_phase_mask);
                    let n_dist = phase_dist(n_opt.phase, target_p, max_phase_mask);
                    
                    if (my_dist < n_dist) {
                        let pull_force = i32(n_dist) - i32(my_dist);
                        if (pull_force > best_gradient) {
                            best_gradient = pull_force;
                            new_mem_x = n_opt.memory_x;
                            new_mem_y = n_opt.memory_y;
                            new_mem_z = n_opt.memory_z - 1u; // Hop tax
                        }
                    }
                }
            }
        }
    }
    
            // Save Phase, Genomes, and Life Force (ATP)
            agents[index].phase = new_phase;
            agents[index].energy = new_energy;
            agents[index].base_freq = agent.base_freq;
            agents[index].state_flags = agent.state_flags;
            agents[index].genome = new_genome;
            agents[index].memory_x = new_mem_x;
            agents[index].memory_y = new_mem_y;
            agents[index].memory_z = new_mem_z;
            
            // Output this thread's phase geometry for Mean Field Reduction
            my_cos = deterministic_cos(new_phase, topology.q_phase);
            my_sin = deterministic_sin(new_phase, topology.q_phase);
        }
    }
    
    // -------------------------------------------------------------
    // ERA 4000: MASSIVE PARALLEL WGSL REDUCTION (GLOBAL MEAN FIELD)
    // -------------------------------------------------------------
    let local_index = local_id.x;
    
    // Phase 1: Local Load
    // Downshift by 10 bit logic so 1M sums definitively fit in an accumulative i32 (-1.0B to 1.0B max peak)
    wg_cos[local_index] = my_cos >> 10u; 
    wg_sin[local_index] = my_sin >> 10u;
    
    workgroupBarrier(); // Synchronize the 64-thread sector
    
    // Phase 2: Binary Tree Collapse Factor O(log N)
    for (var stride: u32 = 32u; stride > 0u; stride >>= 1u) {
        if (local_index < stride) {
            wg_cos[local_index] += wg_cos[local_index + stride];
            wg_sin[local_index] += wg_sin[local_index + stride];
        }
        workgroupBarrier();
    }
    
    // Phase 3: Apical Output
    // The Apex thread (0) atomicaly injects the sector sum into the Global State
    if (local_index == 0u) {
        atomicAdd(&new_mean_field[0], wg_cos[0]);
        atomicAdd(&new_mean_field[1], wg_sin[0]);
    }
}
