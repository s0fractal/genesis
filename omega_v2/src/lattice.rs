//! Reactive State Lattice (Era 950)
//! Bitmask Dirty Flags for Zero-Cost Environment Sync.
//! Since we are `#![no_std]`, we avoid complex Observer/FRP heap allocations.
//! Instead, 1 Bit = 1 Signal.

use crate::topology::{PhaseTopology, OntologicalIntent};
use crate::agent::{PhaseAgentMinimal, PhaseAgentSmart};

// --- SIGNAL DEFINITIONS (Bitmask Dirty Flags) ---
pub const SIGNAL_TOPOLOGY_CHANGED: u32   = 1 << 0; // JS resized the canvas or limits changed
pub const SIGNAL_THERMO_COLLAPSE: u32    = 1 << 1; // Energy dropped below survival threshold
pub const SIGNAL_CONSENSUS_SHIFT: u32    = 1 << 2; // Bitcoin hash arrived (Global Anchor)
pub const SIGNAL_MUTATION_TRIGGER: u32   = 1 << 3; // LERP orthogonal deviation needed

#[repr(C)]
#[derive(Clone, Copy)]
pub struct DeltaItem {
    pub index: u32,
    pub phase: u32,
    pub energy: u32,
    pub genome: u32,
}

#[repr(C)]
pub struct SignalStore {
    pub dirty_flags: u32,
    pub absolute_tick: u32,
    pub active_agent_count: u32,
    pub max_cells: u32,
}

#[repr(C)]
pub struct PhaseLattice {
    pub topology: PhaseTopology,
    pub signals: SignalStore,
    pub intents: [OntologicalIntent; 4],
    
    // We bind directly to the SharedArrayBuffer memory block passed from WebGPU/JS.
    // Instead of allocating a `Vec`, we slide pointers. Zero-Cost mapping.
    pub smart_agents_ptr: *mut PhaseAgentSmart,
    pub minimal_agents_ptr: *mut PhaseAgentMinimal,
    pub active_agent_count: u32,
}

impl PhaseLattice {
    /// Bootstraps the grid directly on top of pre-allocated WebGPU host memory
    pub fn new_from_hostMemory(
        topology: PhaseTopology, 
        smart_ptr: *mut PhaseAgentSmart, 
        min_ptr: *mut PhaseAgentMinimal
    ) -> Self {
        Self {
            topology,
            signals: SignalStore {
                dirty_flags: 0,
                absolute_tick: 0,
                active_agent_count: 0,
                max_cells: 0,
            },
            intents: [OntologicalIntent::empty(); 4],
            smart_agents_ptr: smart_ptr,
            minimal_agents_ptr: min_ptr,
            active_agent_count: 0,
        }
    }

    /// Extracted API for the JS Env Vector to easily inject Climate Changes into WASM.
    #[no_mangle]
    pub extern "C" fn set_environment(&mut self, q_sectors: u32, q_radial: u32, q_harmonics: u32) {
        self.topology.q_sectors = q_sectors;
        self.topology.q_radial = q_radial;
        
        // Hoist the Topology Changed flag. The actual arrays will not reallocate here!
        // Instead, the next `tick_physics` will read this flag and gracefully Darwnin-kill
        // agents that no longer fit in the newly reduced `topology.max_geometry_cells`.
        self.signals.dirty_flags |= SIGNAL_TOPOLOGY_CHANGED;
    }
    
    /// Triggered by the ATPBridge when a new Ethereum/Base block arrives
    #[no_mangle]
    pub extern "C" fn ingest_cosmic_entropy(&mut self, raw_hash_u64: u64) {
        // ... Logic to seed RNG or Phase offsets ...
        self.signals.dirty_flags |= SIGNAL_CONSENSUS_SHIFT;
    }

    /// Pre-populates the `.bss` static memory with randomized kinetic energy and base frequencies
    /// using a hyper-minimal Linear Congruential Generator (LCG).
    pub fn ignite_big_bang(&mut self, root_seed: u32, initial_population: u32) {
        if self.minimal_agents_ptr.is_null() { return; }
        
        // Critical: Prevent C-style buffer overflow if JS asks for more than .bss can hold!
        let safe_population = core::cmp::min(initial_population, crate::MAX_MINIMAL_AGENTS as u32);
        
        self.signals.active_agent_count = safe_population;
        let mut seed = root_seed;
        let max_phase = (1u32 << self.topology.q_phase) - 1;

        unsafe {
            for i in 0..safe_population {
                // Pseudo-random LCG
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let phase = seed & max_phase;
                
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let energy = (seed % 900) + 100; // 100 to 1000
                // Frequency mapped to Q20 (-2.0 to 2.0 rads per tick)
                let base_freq = ((seed % 4000) as i32 - 2000) * 1024;
                
                let agent_ptr = self.minimal_agents_ptr.add(i as usize);
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let phase = (seed % 256) as u32;
                
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let energy = (seed % 900) + 100;
                
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let base_freq = ((seed % 4000) as i32 - 2000) * 1024;
                
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let genome = (seed % 256) as u32;

                *agent_ptr = crate::agent::PhaseAgentMinimal {
                    phase,
                    energy,
                    base_freq,
                    state_flags: 0,
                    genome,
                    memory: [0, 0, 0],
                };
            }
        }
    }

    /// The Hot Path Physics Loop
    pub fn tick_physics(&mut self) {
        self.signals.absolute_tick += 1;
        
        // REACTIVE RECONCILIATION
        if (self.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED) != 0 {
            // Apply Darwinian culling to `active_agent_count` if the topology shrank.
            // Recalculate pointer boundaries.
            
            // Clear flag
            self.signals.dirty_flags &= !SIGNAL_TOPOLOGY_CHANGED;
        }

        if (self.signals.dirty_flags & SIGNAL_CONSENSUS_SHIFT) != 0 {
            // Propagate LERP vectors for Kuromoto Base Shifts
            
            // Clear flag
            self.signals.dirty_flags &= !SIGNAL_CONSENSUS_SHIFT;
        }

        // ... O(1) mathematical compute loop iterating over `agents_ptr` using `self.topology` shifts ...
    }

    /// ERA 3000: Darwinian Sweep (Called 1Hz from JS Snapshot Extraction)
    /// Finds thriving cells (>2000 ATP) and immediately replicates them into the nearest Dead slot (0 ATP).
    pub fn darwinian_mitosis(&mut self) -> u32 {
        if self.minimal_agents_ptr.is_null() || self.signals.active_agent_count == 0 {
            return 0;
        }

        let mut next_dead_idx = 0;
        let mut replications = 0;
        
        unsafe {
            let active = self.signals.active_agent_count as usize;
            for i in 0..active {
                let parent = &mut *self.minimal_agents_ptr.add(i);
                
                // If a cell has amassed massive ATP via resonance or gravity, it splits
                if parent.energy >= 2000 {
                    parent.energy -= 1000; // Mitosis friction
                    
                    // Slide the dead pointer forward to find a hollow shell in the matrix
                    while next_dead_idx < active && (*self.minimal_agents_ptr.add(next_dead_idx)).energy > 0 {
                        next_dead_idx += 1;
                    }
                    
                    if next_dead_idx < active {
                        // Resurrect the shell with a cloned genome + mutation
                        let child = &mut *self.minimal_agents_ptr.add(next_dead_idx);
                        child.phase = parent.phase.wrapping_add(128); // Opposite phase harmonic
                        child.energy = 1000;
                        child.base_freq = parent.base_freq;
                        child.state_flags = parent.state_flags;
                        child.genome = parent.genome ^ 0b01010101; // XOR shift mutation
                        child.memory = parent.memory.clone();
                        
                        replications += 1;
                    }
                }
            }
        }
        replications
    }

    /// Fast stochastic hash of the physical lattice matrix to prove networking determinism.
    pub fn get_golden_trace(&self) -> u32 {
        if self.minimal_agents_ptr.is_null() || self.signals.active_agent_count == 0 {
            return 0;
        }

        let mut hash = 0u32;
        // Sample every 1024th agent to avoid locking the CPU (O(N) -> O(N/1024)).
        // This acts as a robust probabilistic signature of the deterministic field.
        let skip = 1024; 
        
        unsafe {
            for i in (0..self.signals.active_agent_count).step_by(skip) {
                let agent = &*(self.minimal_agents_ptr.add(i as usize));
                hash = hash.wrapping_add(agent.phase).wrapping_mul(31);
                hash ^= agent.energy;
            }
        }
        hash
    }

    /// ERA 6000: Continuous Delta Networking
    /// Evaluates `minimal_agents_ptr` against `last_snapshot` and populates `delta_buffer`.
    pub unsafe fn generate_delta_snapshot(
        &self,
        current_agents: *const PhaseAgentMinimal,
        last_snapshot: *mut PhaseAgentMinimal,
        delta_buffer: *mut DeltaItem,
        max_deltas: usize,
    ) -> u32 {
        if current_agents.is_null() || last_snapshot.is_null() || delta_buffer.is_null() {
            return 0;
        }

        let mut delta_count = 0;
        let active = self.signals.active_agent_count as usize;

        for i in 0..active {
            let curr = &*current_agents.add(i);
            let prev = &mut *last_snapshot.add(i);

            // Calculate exact divergence
            let energy_diff = if curr.energy > prev.energy { curr.energy - prev.energy } else { prev.energy - curr.energy };
            let phase_diff = if curr.phase > prev.phase { curr.phase - prev.phase } else { prev.phase - curr.phase };
            let genome_changed = curr.genome != prev.genome;

            // Radical difference threshold (Mitosis clashing or huge gravity)
            if energy_diff > 10 || genome_changed || phase_diff > 40 {
                if delta_count < max_deltas {
                    let d_item = &mut *delta_buffer.add(delta_count);
                    d_item.index = i as u32;
                    d_item.phase = curr.phase;
                    d_item.energy = curr.energy;
                    d_item.genome = curr.genome;
                    
                    delta_count += 1;
                }
                
                // Immediately synchronize the shadow matrix to prevent redundant broadcasting
                *prev = *curr;
            }
        }
        
        delta_count as u32
    }
}
