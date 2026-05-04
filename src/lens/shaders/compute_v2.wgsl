// 🌌 OMEGA-64: Era 950 V2 Compute Shader
// Hardware-Targeted, SIMD-aligned Zero-Cost Memory Mapping.
// This shader is dynamically targeted to the `omega_v2` SharedArrayBuffer.

struct PhaseTopology {
    q_phase: u32,     // Resolves 2^q_phase angles
    q_sectors: u32,   // Resolves 2^q_sectors geographic sectors
    q_radial: u32,
    q_math: u32,
    weather_multiplier: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
}

struct SignalStore {
    dirty_flags: u32,
    absolute_tick: u32,
    active_agent_count: u32,
    max_cells: u32,
    total_energy: u32,
    _pad2: u32,
    _pad3: u32,
    _pad4: u32,
}

struct OntologicalIntent {
    focus_x: i32,
    focus_y: i32,
    mass: i32,
    radius: i32,
    semantic_genome: u32,
    op_mode: u32,
    _pad1: u32,
    _pad2: u32,
}

struct IntentArray {
    intents: array<OntologicalIntent, 4>,
}

// Era 1010: Attractor Matrix (16 bytes)
struct AttractorMatrix {
    matrix: u32,
    inverse: u32,
    pulse_freq: u32,
    pulse_amp: u32,
}

// Era 1010: Attractor Array (80 bytes, binding 8)
struct AttractorArray {
    count: u32,
    pad0: u32,
    pad1: u32,
    pad2: u32,
    data: array<AttractorMatrix, 4>,
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
@group(0) @binding(8) var<uniform> attractor_array: AttractorArray;

// ERA 4000: Workgroup Internal Reduction State
var<workgroup> wg_cos: array<i32, 64>;
var<workgroup> wg_sin: array<i32, 64>;

// The Shared Array Buffer View (Ping-Pong: Read from agents_in, Write to agents_out)
@group(0) @binding(2) var<storage, read> agents_in: array<PhaseAgentMinimal>;
@group(0) @binding(7) var<storage, read_write> agents_out: array<PhaseAgentMinimal>;

// The 128-element Deterministic Lookup Table (Q20 Fixed-Point)
@group(0) @binding(3) var<storage, read> sine_lut: array<i32, 128>;

// O(1) Constant Time Deterministic Trigonometry
// Matches Rust topology.get_sin(): shift_up = 7 - q_phase for lower-resolution phases
fn deterministic_sin(phase: u32, q_phase: u32) -> i32 {
    let mask = (1u << q_phase) - 1u;
    let index = phase & mask;
    let shift_up = 7u - q_phase;
    return sine_lut[index << shift_up]; 
}

// ERA 1000: Phase Distance Function (Circular topology modulo wrapping)

// Era 950: 2D Hex Grid Wrap
fn wrap_index_2d(x: i32, y: i32, w: i32, h: i32) -> u32 {
    let wx = (x + w) % w;
    let wy = (y + h) % h;
    return u32(wy * w + wx);
}

fn phase_dist(p1: u32, p2: u32, max_p: u32) -> u32 {
    let diff = max(p1, p2) - min(p1, p2);
    if (diff > (max_p >> 1u)) { return max_p - diff; }
    return diff;
}

fn deterministic_cos(phase: u32, q_phase: u32) -> i32 {
    let quarter_wave = 1u << (q_phase - 2u); // PI/2 offset
    let mask = (1u << q_phase) - 1u;
    let index = (phase + quarter_wave) & mask;
    let shift_up = 7u - q_phase;
    return sine_lut[index << shift_up];
}

// O(1) fast abs for i32 (two's complement, works for all except i32::MIN)
fn fast_abs(v: i32) -> i32 {
    let mask = v >> 31u;
    return (v ^ mask) - mask;
}

// CORDIC-inspired ATAN LUT: ratio -> octant angle (0..32 maps to 0..90 degrees in 256-step circle)
const ATAN_LUT = array<u32, 129>(
    0u, 0u, 1u, 1u, 1u, 2u, 2u, 2u, 3u, 3u, 3u, 3u, 4u, 4u, 4u, 5u,
    5u, 5u, 6u, 6u, 6u, 7u, 7u, 7u, 8u, 8u, 8u, 8u, 9u, 9u, 9u, 10u,
    10u, 10u, 11u, 11u, 11u, 11u, 12u, 12u, 12u, 13u, 13u, 13u, 13u, 14u, 14u, 14u,
    15u, 15u, 15u, 15u, 16u, 16u, 16u, 17u, 17u, 17u, 17u, 18u, 18u, 18u, 18u, 19u,
    19u, 19u, 19u, 20u, 20u, 20u, 20u, 21u, 21u, 21u, 21u, 22u, 22u, 22u, 22u, 23u,
    23u, 23u, 23u, 23u, 24u, 24u, 24u, 24u, 25u, 25u, 25u, 25u, 25u, 26u, 26u, 26u,
    26u, 26u, 27u, 27u, 27u, 27u, 27u, 28u, 28u, 28u, 28u, 28u, 29u, 29u, 29u, 29u,
    29u, 29u, 30u, 30u, 30u, 30u, 30u, 31u, 31u, 31u, 31u, 31u, 31u, 32u, 32u, 32u,
    32u,
);

// O(1) Deterministic ArcTangent via CORDIC-inspired LUT (0..255 full circle)
fn atan2_fast(y: i32, x: i32) -> i32 {
    if (x == 0 && y == 0) { return 0i; }
    let abs_y = fast_abs(y);
    let abs_x = fast_abs(x);
    let a = min(abs_y, abs_x);
    let b = max(abs_y, abs_x);
    var ratio = 0i;
    if (b != 0) { ratio = (a * 128) / b; }
    if (ratio > 128) { ratio = 128; }
    let octant_angle = i32(ATAN_LUT[ratio]);
    var quadrant_angle = octant_angle;
    if (abs_y > abs_x) { quadrant_angle = 64 - octant_angle; }
    if (x < 0) {
        if (y < 0) { return (128 + quadrant_angle) & 255; }
        else { return (128 - quadrant_angle) & 255; }
    } else {
        if (y < 0) { return (256 - quadrant_angle) & 255; }
        else { return quadrant_angle & 255; }
    }
}

// O(1) Deterministic ArcTangent scaled to target q_phase resolution
fn deterministic_atan2(y: i32, x: i32, q_phase: u32) -> u32 {
    if (x == 0 && y == 0) { return 0u; }
    let full_angle = atan2_fast(y, x); // 0..255
    let shift_down = 8u - q_phase;
    return (u32(full_angle) >> shift_down) & ((1u << q_phase) - 1u);
}

// Era 0218: Circular Food Web
fn species_advantage(a: u32, b: u32) -> i32 {
    if (a == b) { return 0i; }
    let diff = (a - b) & 0x7Fu;
    if (diff > 0u && diff <= 8u) {
        return 1i;
    } else if (diff >= 120u && diff <= 127u) {
        return -1i;
    }
    return 0i;
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
        var agent = agents_in[index];
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
            let w = i32(max_r_cells);
            // Height might not be exact if active_agent_count is not a multiple of w
            // but we approximate grid height. Fallback to 1 if active is too small.
            let h = max(1i, i32(signals.active_agent_count) / w);
            let cx = i32(index) % w;
            let cy = i32(index) / w;
            
            // 6-neighbor hex grid (axial-like or shifted)
            let n_indices = array<u32, 6>(
                wrap_index_2d(cx - 1, cy, w, h),
                wrap_index_2d(cx + 1, cy, w, h),
                wrap_index_2d(cx, cy - 1, w, h),
                wrap_index_2d(cx, cy + 1, w, h),
                wrap_index_2d(cx + 1, cy - 1, w, h),
                wrap_index_2d(cx - 1, cy + 1, w, h)
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
    let p_radius = (agent.genome >> 8u) & 0xFFu;
    var k_coupling = min(agent.energy, 1000u); 
    k_coupling = k_coupling + (p_radius * 4u);
    
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
                
                // ERA 7000: God Injection (Text-to-Matrix Override)
                if (intent.op_mode == 1u) {
                    // Force the cell onto the exact new timeline
                    // We modify variables that get written back at the end of compute_main
                    agent.genome = intent.semantic_genome;
                    
                    // Artificially peak energy for exponential blast radiation
                    intent_energy_bonus += 3000;
                    
                    // Lock the cell's physical coordinate trajectory into the Semantic Array
                    // By shifting the intrinsic phase to match the genome's MSB.
                    // This forces immediate spatial clustering after explosion.
                    agent.phase = intent.semantic_genome & max_phase_mask;
                    
                    // Scrub neural packets to prevent inherited trauma
                    new_mem_x = 0u; new_mem_y = 0u; new_mem_z = 0u;
                }
            }
        }
    }
    
    // -------------------------------------------------------------
    // ERA 5000: QUANTUM CHROMODYNAMICS (GENETIC BATTLE ROYALE)
    // -------------------------------------------------------------
    if (signals.active_agent_count > 6u) {
        // Calibrated force: reduced to 800 to account for 6 neighbors instead of 4
        let chr_force = 800i; 
        
        for (var i = 0u; i < 6u; i++) {
            let n_idx = n_indices[i];
            if (n_idx >= signals.active_agent_count) { continue; }
            let n = agents_in[n_idx];
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
    
    // Era 1010: Attractor Field Drift
    var attractor_drift: i32 = 0i;
    for (var i = 0u; i < attractor_array.count; i = i + 1u) {
        let a = attractor_array.data[i];
        let sin_val = deterministic_sin(agent.phase - a.matrix, topology.q_phase);
        attractor_drift = attractor_drift + (sin_val * i32(a.pulse_amp)) / 1024;
    }
    
    // 4. Mutate Phase directly based on base_freq & coupling & attractor drift
    // (agent.base_freq is Q20, q_math is 20, so shift gives an integer tick jump)
    let total_freq = agent.base_freq + attractor_drift;
    let new_phase = (coupled_phase + u32(total_freq >> topology.q_math)) & max_phase_mask;
    
    // --- Era 0215: Phenotypic Expression ---
    let genome = agent.genome;
    let p_efficiency = genome & 0xFFu;
    let p_resilience = (genome >> 16u) & 0xFFu;

    let efficiency_adj = 2i - i32(p_efficiency / 64u);
    var base_burn: u32 = 1u;
    
    let set_bits = countOneBits(agent.genome);
    var maintenance_cost = (set_bits / 8u) * 1u; // STRUCTURAL_MAINTENANCE_DIVISOR=8, LANDAUER_BIT_COST=1
    if (maintenance_cost == 0u) { maintenance_cost = 1u; }
    
    let base_cost = (maintenance_cost * topology.weather_multiplier) / 1024u;
    let raw_base = i32(base_cost) + efficiency_adj;
    if (raw_base > 1i) { base_burn = u32(raw_base); }

    let resilience_reduction = p_resilience / 128u;
    var burn: u32 = 1u;
    if (base_burn > resilience_reduction + 1u) {
        burn = base_burn - resilience_reduction;
    }

    // ERA 3000: ATP METABOLISM
    var metabolic_delta: i32 = -i32(burn); // Entropy (Base Burn)
    
    // Era 0218/1070: Species Specialization & Energy Diffusion
    let agent_species = (agent.state_flags >> 1u) & 0x7Fu;
    let steal = 5i; // PREDATOR_ENERGY_STEAL
    var energy_diffusion: i32 = 0i;
    
    if (signals.active_agent_count > 6u) {
        for (var i = 0u; i < 6u; i++) {
            // Guard against out-of-bounds if topology shrinks suddenly
            let n_idx = n_indices[i];
            if (n_idx < signals.active_agent_count) {
                let n = agents_in[n_idx];
                if (n.energy > 0u) {
                    let n_species = (n.state_flags >> 1u) & 0x7Fu;
                    let adv = species_advantage(agent_species, n_species);
                    if (adv == 1i) { metabolic_delta += steal; }
                    else if (adv == -1i) { metabolic_delta -= steal; }
                    
                    // Local Heat/ATP Diffusion
                    energy_diffusion += (i32(n.energy) - i32(agent.energy)) / 8i;
                }
            }
        }
    }
    metabolic_delta += energy_diffusion;

    // Cosmic Resonance: Synthesize massive ATP if harmonized with the foundational math structure
    if (new_phase % 64u == 0u) {
        metabolic_delta += 128; 
    }
    
    let new_energy_calc = i32(agent.energy) + metabolic_delta + intent_energy_bonus;
    var new_energy: u32 = 0u;
    if (new_energy_calc > 0) {
        new_energy = u32(new_energy_calc);
        if (new_energy > 4096u) { new_energy = 4096u; } // Maximum ATP Capacity
    }

    // 5. ERA 2000: NEURAL CELLULAR AUTOMATA (NCA) -> ERA 5000: QCD Stability
    // Genome is now structurally deeply stable! Only mutates during Mitosis (Rust CPU side).
    var new_genome = agent.genome;
    var new_base_freq = agent.base_freq;
    
    // -------------------------------------------------------------
    // ERA 1000: HYPERBOLIC DNS (TAYLOR PHASE ROUTING)
    // -------------------------------------------------------------
    if (!intent_injected) {
        if (agent.memory_z > 0u) {
            // Actively Holding a Packet. Determine if it flows DOWN the gradient to a neighbor.
            let target_p = agent.memory_x;
            let my_dist = phase_dist(agent.phase, target_p, max_phase_mask);
            var lose_packet = false;
            
            for (var i = 0u; i < 6u; i++) {
                let n_idx = n_indices[i];
                if (n_idx >= signals.active_agent_count) { continue; }
                let n_opt = agents_in[n_idx];
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
                // ERA 8000: BIOLOGICAL RISC (VIRAL OPCODES)
                let opcode = agent.memory_y;
                if (opcode == 1u) {
                    // Opcode 1: Lysogenic Viral Integration (XOR Inversion)
                    let old_genome = new_genome;
                    new_genome = new_genome ^ 0xFFFFFFFFu;
                    let flipped_bits = countOneBits(old_genome ^ new_genome);
                    let flip_cost = flipped_bits * 1u; // LANDAUER_BIT_COST
                    if (new_energy > flip_cost) {
                        new_energy = new_energy - flip_cost;
                    } else {
                        new_energy = 0u;
                    }
                    new_mem_z = 0u; // Consume packet
                } else if (opcode == 2u) {
                    // Opcode 2: Somatic Burst (Forced Mitosis prep)
                    new_energy = 4096u; // Immediate peak ATP
                    new_mem_z = 0u;
                } else if (opcode == 3u) {
                    // Opcode 3: Neural Paralysis (Deep Freeze)
                    new_base_freq = 0i;
                    new_mem_z = 0u;
                } else {
                    // Not a weaponized opcode, just standard data packet
                    new_mem_z = agent.memory_z - 1u; // Trapped, entropy decays TTL
                }
                
                if (new_mem_z == 0u) { 
                    new_mem_x = 0u; new_mem_y = 0u; 
                }
            }
        } else {
            // Receptive Empty Cell. Poll neighbors for incoming Gradient Pull.
            var best_gradient = 0i;
            for (var i = 0u; i < 6u; i++) {
                let n_idx = n_indices[i];
                if (n_idx >= signals.active_agent_count) { continue; }
                let n_opt = agents_in[n_idx];
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
            agents_out[index].phase = new_phase;
            agents_out[index].energy = new_energy;
            agents_out[index].base_freq = new_base_freq;
            if (new_energy == 0u) {
                agents_out[index].state_flags = agent.state_flags | 0x01u;
            } else {
                agents_out[index].state_flags = agent.state_flags;
            }
            agents_out[index].genome = new_genome;
            agents_out[index].memory_x = new_mem_x;
            agents_out[index].memory_y = new_mem_y;
            agents_out[index].memory_z = new_mem_z;
            
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
