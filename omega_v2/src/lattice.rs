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
    pub intent: OntologicalIntent,
    
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
            intent: OntologicalIntent::empty(),
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
                
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                // Frequency mapped to Q20 (-2.0 to 2.0 rads per tick)
                let base_freq = ((seed % 4000) as i32 - 2000) * 1024;
                
                let agent_ptr = self.minimal_agents_ptr.add(i as usize);
                *agent_ptr = crate::agent::PhaseAgentMinimal {
                    phase,
                    energy,
                    base_freq,
                    state_flags: 1, // ALIVE flag
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
}
