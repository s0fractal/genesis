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
    pub fn new_from_host_memory(
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
    pub extern "C" fn set_environment(&mut self, q_sectors: u32, q_radial: u32, _q_harmonics: u32) {
        // CRIT-6 FIX: validate bounds to prevent shift overflow in topology math
        assert!(q_sectors < 32 && q_radial < 32, "q_sectors/q_radial must be < 32");
        self.topology.q_sectors = q_sectors;
        self.topology.q_radial = q_radial;
        
        // Hoist the Topology Changed flag. The actual arrays will not reallocate here!
        // Instead, the next `tick_physics` will read this flag and gracefully Darwnin-kill
        // agents that no longer fit in the newly reduced `topology.max_geometry_cells`.
        self.signals.dirty_flags |= SIGNAL_TOPOLOGY_CHANGED;
    }
    
    /// Triggered by the ATPBridge when a new Bitcoin/Ethereum block arrives.
    /// Φ-Маніфест: кожен новий блок — це пульс глобального часу (R).
    #[no_mangle]
    pub extern "C" fn ingest_cosmic_entropy(&mut self, raw_hash_u64: u64) {
        // Ingest block hash into the φ-anchor chain.
        unsafe {
            let anchor = core::ptr::addr_of_mut!(crate::PHI_ANCHOR_CHAIN);
            (*anchor).ingest_block(raw_hash_u64);
        }
        self.signals.dirty_flags |= SIGNAL_CONSENSUS_SHIFT;
    }

    /// Pre-populates the `.bss` static memory with randomized kinetic energy and base frequencies
    /// using a hyper-minimal Linear Congruential Generator (LCG).
    pub fn ignite_big_bang(&mut self, root_seed: u32, initial_population: u32) {
        if self.minimal_agents_ptr.is_null() { return; }
        
        // Critical: Prevent C-style buffer overflow if JS asks for more than .bss can hold!
        let safe_population = core::cmp::min(initial_population, crate::MAX_MINIMAL_AGENTS as u32);
        
        self.signals.active_agent_count = safe_population;
        let mut rng = crate::math::Xorshift64::new(root_seed);
        let max_phase = (1u32 << self.topology.q_phase) - 1;

        unsafe {
            for i in 0..safe_population {
                let agent_ptr = self.minimal_agents_ptr.add(i as usize);

                let phase = rng.next_u32() & max_phase;
                let energy = (rng.next_u32() % crate::constants::BB_ENERGY_RANGE) + crate::constants::BB_ENERGY_BASE;
                let base_freq = ((rng.next_u32() % crate::constants::BB_FREQ_RANGE) as i32 - crate::constants::BB_FREQ_OFFSET) * crate::constants::BB_FREQ_Q_SCALE;
                let genome = rng.next_u32(); // CRIT-2 FIX: use full 32-bit entropy

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

    /// Era 950+: Big Bang guided by Epigenetic Memory.
    /// Instead of purely random genomes, successful historical traits bias new agents.
    pub fn ignite_epigenetic_big_bang(&mut self, root_seed: u32, initial_population: u32, memory: &crate::epigenetics::EpigeneticMemory) {
        if self.minimal_agents_ptr.is_null() { return; }
        
        let safe_population = core::cmp::min(initial_population, crate::MAX_MINIMAL_AGENTS as u32);
        self.signals.active_agent_count = safe_population;
        let mut rng = crate::math::Xorshift64::new(root_seed);
        let max_phase = (1u32 << self.topology.q_phase) - 1;

        unsafe {
            for i in 0..safe_population {
                let agent_ptr = self.minimal_agents_ptr.add(i as usize);

                let phase = rng.next_u32() & max_phase;
                let energy = (rng.next_u32() % crate::constants::BB_ENERGY_RANGE) + crate::constants::BB_ENERGY_BASE;
                let base_freq = ((rng.next_u32() % crate::constants::BB_FREQ_RANGE) as i32 - crate::constants::BB_FREQ_OFFSET) * crate::constants::BB_FREQ_Q_SCALE;
                let genome = memory.generate_biased_genome(rng.next_u32());

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
    /// Tensor Web: реалізує Kuramoto coupling, metabolic decay та phase drift.
    pub fn tick_physics(&mut self) {
        self.signals.absolute_tick += 1;
        
        // REACTIVE RECONCILIATION: always clear dirty flags, even if no agents
        if (self.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED) != 0 {
            self.signals.dirty_flags &= !SIGNAL_TOPOLOGY_CHANGED;
        }
        if (self.signals.dirty_flags & SIGNAL_CONSENSUS_SHIFT) != 0 {
            self.signals.dirty_flags &= !SIGNAL_CONSENSUS_SHIFT;
        }
        
        if self.minimal_agents_ptr.is_null() || self.signals.active_agent_count == 0 {
            return;
        }

        let active = self.signals.active_agent_count as usize;
        let max_phase = (1u32 << self.topology.q_phase) - 1;
        let kuramoto_k = crate::constants::KURAMOTO_COUPLING_BASE; // Q10 scaled
        let q10_scale = crate::constants::BB_FREQ_Q_SCALE; // 1024

        unsafe {
            // --- Phase 1: Kuramoto Coupling (read-only pass) ---
            // Обчислюємо coupling для кожного агента від сусідів.
            // Сусіди: ±1 індекс (1D тороїдальний ланцюг).
            let mut coupling_buffer = [0i32; 8]; // small stack buffer, processed in chunks
            let chunk_size = coupling_buffer.len();

            for chunk_start in (0..active).step_by(chunk_size) {
                let chunk_end = core::cmp::min(chunk_start + chunk_size, active);
                
                // Compute couplings for this chunk
                for i in chunk_start..chunk_end {
                    let agent = &*self.minimal_agents_ptr.add(i);
                    let left_idx = if i == 0 { active - 1 } else { i - 1 };
                    let right_idx = if i + 1 >= active { 0 } else { i + 1 };
                    
                    let left = &*self.minimal_agents_ptr.add(left_idx);
                    let right = &*self.minimal_agents_ptr.add(right_idx);
                    
                    // Kuramoto coupling: K * (sin(left - agent) + sin(right - agent)) / (2 * Q10)
                    let sin_left = crate::math::sin_q10(left.phase, agent.phase);
                    let sin_right = crate::math::sin_q10(right.phase, agent.phase);
                    let coupling = ((sin_left + sin_right) * kuramoto_k) / (2 * q10_scale);
                    
                    coupling_buffer[i - chunk_start] = coupling;
                }
                
                // Phase 2: Apply updates (write pass)
                for i in chunk_start..chunk_end {
                    let agent = &mut *self.minimal_agents_ptr.add(i);
                    let coupling = coupling_buffer[i - chunk_start];
                    
                    // Metabolic burn: complex genomes burn faster
                    let burn = crate::constants::METABOLIC_BASE_COST
                        + (agent.genome.count_ones() / crate::constants::METABOLIC_BURN_DIVISOR);
                    agent.energy = agent.energy.saturating_sub(burn);
                    
                    // Phase drift: base_freq + coupling
                    let drift = agent.base_freq + coupling;
                    agent.phase = agent.phase.wrapping_add(drift as u32) & max_phase;
                    
                    // Resonance replenish: 1/64 chance if phase aligns to harmonic zero
                    if agent.phase.is_multiple_of(crate::constants::RESONANCE_PHASE_MODULUS) && agent.energy > 0 {
                        agent.energy = (agent.energy as i32 + crate::constants::RESONANCE_ATP_BONUS)
                            .min(crate::constants::MAX_ATP as i32) as u32;
                    }
                    
                    // Compost event: agent died this tick
                    if agent.energy == 0 && agent.state_flags & 0x01 == 0 {
                        agent.state_flags |= 0x01; // Mark as dead
                        let compost = crate::phi_protocol::PhiMessage::encode_compost(agent, i as u64);
                        let buf = core::ptr::addr_of_mut!(crate::PHI_MESSAGE_BUFFER);
                        (*buf).push(compost);
                    }
                }
            }
        }
        
        // REACTIVE RECONCILIATION
        if (self.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED) != 0 {
            // Apply Darwinian culling: agents beyond new capacity are killed
            let new_max = self.topology.max_geometry_cells(
                1, // harmonics (simplified)
                1  // tau_depth (simplified)
            ) as u32;
            if self.signals.active_agent_count > new_max {
                self.signals.active_agent_count = new_max;
            }
            self.signals.dirty_flags &= !SIGNAL_TOPOLOGY_CHANGED;
        }

        if (self.signals.dirty_flags & SIGNAL_CONSENSUS_SHIFT) != 0 {
            // Cosmic entropy: apply global phase shift from Bitcoin anchor
            unsafe {
                let anchor = core::ptr::addr_of!(crate::PHI_ANCHOR_CHAIN);
                let global_phi = (*anchor).global_phi();
                let active = self.signals.active_agent_count as usize;
                for i in 0..active {
                    let agent = &mut *self.minimal_agents_ptr.add(i);
                    agent.phase = agent.phase.wrapping_add(global_phi) & max_phase;
                }
            }
            self.signals.dirty_flags &= !SIGNAL_CONSENSUS_SHIFT;
        }
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
                if parent.energy >= crate::constants::MITOSIS_THRESHOLD {
                    parent.energy -= crate::constants::MITOSIS_COST; // Mitosis friction
                    
                    // Slide the dead pointer forward to find a hollow shell in the matrix
                    while next_dead_idx < active && (*self.minimal_agents_ptr.add(next_dead_idx)).energy > 0 {
                        next_dead_idx += 1;
                    }
                    
                    if next_dead_idx < active {
                        // Resurrect the shell with a cloned genome + mutation
                        let child = &mut *self.minimal_agents_ptr.add(next_dead_idx);
                        child.phase = parent.phase.wrapping_add(self.topology.half_phase()); // Opposite phase harmonic
                        child.energy = crate::constants::CHILD_ENERGY_SEED;
                        child.base_freq = parent.base_freq;
                        child.state_flags = parent.state_flags;
                        // CRIT-2 FIX: stochastic mutation instead of fixed mask
                        let mut_seed = crate::math::xorshift64_once(parent.genome as u64);
                        let mutation_mask = mut_seed as u32; // full 32-bit random mask
                        child.genome = parent.genome ^ mutation_mask;
                        child.memory = parent.memory;
                        
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
        // CRIT-3 FIX: adaptive skip so we always sample ~32 agents even when N < 1024
        let active = self.signals.active_agent_count as usize;
        let skip = if active == 0 { 1 } else { core::cmp::max(1, active / 32) };
        
        unsafe {
            for i in (0..active).step_by(skip) {
                let agent = &*(self.minimal_agents_ptr.add(i));
                hash = hash.wrapping_add(agent.phase).wrapping_mul(31);
                hash ^= agent.energy;
            }
        }

        // Φ-Маніфест: публікуємо heartbeat у phi buffer
        let tick = self.signals.absolute_tick;
        let heartbeat = crate::phi_protocol::PhiMessage::encode_heartbeat(hash, tick, self.topology.q_phase as u8);
        unsafe {
            let buf = core::ptr::addr_of_mut!(crate::PHI_MESSAGE_BUFFER);
            (*buf).push(heartbeat);
        }

        hash
    }

    /// ERA 6000: Continuous Delta Networking
    /// Evaluates `minimal_agents_ptr` against `last_snapshot` and populates `delta_buffer`.
    /// # Safety
    /// All pointers must be valid and properly aligned. `current_agents` and `last_snapshot`
    /// must point to at least `active_agent_count` elements. `delta_buffer` must point to at
    /// least `max_deltas` elements.
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
            let energy_diff = curr.energy.abs_diff(prev.energy);
            let phase_diff = curr.phase.abs_diff(prev.phase);
            let genome_changed = curr.genome != prev.genome;

            // HIGH-2 FIX: Q-derived adaptive thresholds from topology
            let energy_threshold = self.topology.delta_energy_threshold();
            let phase_threshold = self.topology.delta_phase_threshold();
            if energy_diff > energy_threshold || genome_changed || phase_diff > phase_threshold {
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

#[cfg(test)]
#[allow(clippy::needless_range_loop)]
mod tests {
    use super::*;
    use crate::agent::PhaseAgentMinimal;
    use crate::topology::PhaseTopology;
    use std::vec::Vec;
    use std::vec;

    fn make_lattice(agent_count: usize) -> (PhaseLattice, Vec<PhaseAgentMinimal>, Vec<PhaseAgentMinimal>, Vec<DeltaItem>) {
        make_lattice_with_q_phase(agent_count, 7)
    }

    fn make_lattice_with_q_phase(agent_count: usize, q_phase: u32) -> (PhaseLattice, Vec<PhaseAgentMinimal>, Vec<PhaseAgentMinimal>, Vec<DeltaItem>) {
        let mut agents = vec![PhaseAgentMinimal::default(); agent_count];
        let snapshot = vec![PhaseAgentMinimal::default(); agent_count];
        let deltas = vec![DeltaItem { index: 0, phase: 0, energy: 0, genome: 0 }; 100];
        let topology = PhaseTopology::new(q_phase, 7, 6, 20);
        let mut lattice = PhaseLattice::new_from_host_memory(topology, core::ptr::null_mut(), agents.as_mut_ptr());
        lattice.signals.max_cells = agent_count as u32;
        (lattice, agents, snapshot, deltas)
    }

    #[test]
    fn test_ignite_big_bang_populates() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(100);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.ignite_big_bang(12345, 50);
        assert_eq!(lattice.signals.active_agent_count, 50);
        assert!(agents[0].energy > 0);
        assert!(agents[0].genome > 0 || agents[1].genome > 0); // At least some entropy
    }

    #[test]
    fn test_darwinian_mitosis() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        // Parent thrives, child slot is dead
        agents[0].energy = 3000;
        agents[1].energy = 0;
        let reps = lattice.darwinian_mitosis();
        assert_eq!(reps, 1);
        assert_eq!(agents[0].energy, 2000); // Parent lost 1000 ATP
        assert!(agents[1].energy > 0);      // Child resurrected
    }

    #[test]
    fn test_golden_trace_determinism() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(2048);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.ignite_big_bang(42, 2048);
        let trace1 = lattice.get_golden_trace();
        let trace2 = lattice.get_golden_trace();
        assert_eq!(trace1, trace2);
        assert_ne!(trace1, 0);
    }

    #[test]
    fn test_delta_snapshot_detects_changes() {
        let (mut lattice, mut agents, mut snapshot, mut deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        lattice.ignite_big_bang(99, 10);
        let count = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                deltas.len()
            )
        };
        assert!(count > 0, "Initial population should diverge from zeroed snapshot");

        // Second run should yield zero deltas because snapshot was synchronized
        let count2 = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                deltas.len()
            )
        };
        assert_eq!(count2, 0, "No divergence after snapshot sync");
    }

    #[test]
    fn test_tick_physics_increments_absolute_tick() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        assert_eq!(lattice.signals.absolute_tick, 0);
        lattice.tick_physics();
        assert_eq!(lattice.signals.absolute_tick, 1);
        lattice.tick_physics();
        assert_eq!(lattice.signals.absolute_tick, 2);
    }

    #[test]
    fn test_set_environment_sets_dirty_flag() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.set_environment(5, 4, 0);
        assert_eq!(lattice.topology.q_sectors, 5);
        assert_eq!(lattice.topology.q_radial, 4);
        assert!(lattice.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED != 0);
    }

    #[test]
    fn test_ignite_epigenetic_big_bang() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(100);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        let memory = crate::epigenetics::EpigeneticMemory::new();
        lattice.ignite_epigenetic_big_bang(42, 50, &memory);
        assert_eq!(lattice.signals.active_agent_count, 50);
        assert!(agents[0].energy > 0);
        // With empty memory, genomes should still be stochastic (non-zero entropy)
        assert!(agents.iter().any(|a| a.genome != 0));
    }

    #[test]
    fn test_mitosis_child_phase_offset() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        agents[0].energy = 3000;
        agents[0].phase = 50;
        agents[1].energy = 0;
        lattice.darwinian_mitosis();
        let expected_phase = 50u32.wrapping_add(lattice.topology.half_phase());
        assert_eq!(agents[1].phase, expected_phase, "Child should be at opposite phase (π offset)");
    }

    #[test]
    fn test_delta_snapshot_respects_max_deltas() {
        let (mut lattice, mut agents, mut snapshot, mut deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        lattice.ignite_big_bang(99, 10);
        // Limit deltas to 3 — only first 3 changes should be reported
        let count = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                3
            )
        };
        assert_eq!(count, 3, "Should cap at max_deltas even if more agents changed");
        // Snapshot should still be synchronized for ALL changed agents (not just first 3)
        let count2 = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                deltas.len()
            )
        };
        assert_eq!(count2, 0, "All agents should be synced after first call, even those beyond max_deltas");
    }

    #[test]
    fn test_delta_snapshot_zero_on_identical() {
        let (mut lattice, mut agents, mut snapshot, mut deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        // Initialize both arrays identically
        for i in 0..10 {
            agents[i].phase = 100;
            agents[i].energy = 500;
            agents[i].genome = 0xDEADBEEF;
            snapshot[i] = agents[i];
        }
        let count = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                deltas.len()
            )
        };
        assert_eq!(count, 0, "Identical arrays should produce zero deltas");
    }

    #[test]
    fn test_tick_physics_energy_decay() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(1);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 1;
        agents[0].energy = 100;
        agents[0].phase = 1; // avoid resonance bonus (1 % 64 != 0)
        agents[0].base_freq = 0;
        let before = agents[0].energy;
        lattice.tick_physics();
        assert_eq!(agents[0].energy, before - crate::constants::ENERGY_DECAY_PER_TICK, "Energy should decay by ENERGY_DECAY_PER_TICK");
    }

    #[test]
    fn test_tick_physics_phase_drift() {
        // Single agent: no neighbors -> coupling = 0, only drift remains
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(1);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 1;
        agents[0].phase = 100;
        agents[0].base_freq = 1 << 20; // 1.0 in Q20
        agents[0].energy = 1000;
        let before = agents[0].phase;
        lattice.tick_physics();
        // Drift = base_freq + coupling = 1048576 + 0
        let expected = before.wrapping_add((1 << 20) as u32) & lattice.topology.phase_mask();
        assert_eq!(agents[0].phase, expected, "Phase should drift by base_freq (mod phase_mask)");
    }

    #[test]
    fn test_tick_physics_kuramoto_coupling() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(3);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 3;
        // Agent 0 at phase 0, agent 1 at phase 32 (sin(32) ≈ 707 Q10), agent 2 dead
        agents[0].phase = 0;
        agents[0].energy = 1000;
        agents[0].base_freq = 0;
        agents[1].phase = 32;
        agents[1].energy = 1000;
        agents[1].base_freq = 0;
        agents[2].energy = 0; // dead
        
        let phase_before_0 = agents[0].phase;
        let phase_before_1 = agents[1].phase;
        
        lattice.tick_physics();
        
        // With coupling, both agents should shift (coupling for phase 32 is not a multiple of 128)
        assert_ne!(agents[0].phase, phase_before_0, "Agent 0 phase should change due to coupling");
        assert_ne!(agents[1].phase, phase_before_1, "Agent 1 phase should change due to coupling");
        
        // The two agents must shift in opposite modular directions
        // (one's coupling is positive, the other's negative).
        let mask = lattice.topology.phase_mask() as i32 + 1;
        let delta_0 = (agents[0].phase as i32 - phase_before_0 as i32).rem_euclid(mask);
        let delta_1 = (agents[1].phase as i32 - phase_before_1 as i32).rem_euclid(mask);
        assert_ne!(delta_0, delta_1, "Agents should shift in different directions");
    }

    #[test]
    fn test_tick_physics_dirty_flags_cleared() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(1);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.dirty_flags = SIGNAL_TOPOLOGY_CHANGED | SIGNAL_CONSENSUS_SHIFT;
        lattice.tick_physics();
        assert_eq!(lattice.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED, 0, "TOPOLOGY_CHANGED should be cleared");
        assert_eq!(lattice.signals.dirty_flags & SIGNAL_CONSENSUS_SHIFT, 0, "CONSENSUS_SHIFT should be cleared");
    }

    #[test]
    fn test_tick_physics_energy_non_negative() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        // Mix of alive and dead agents
        agents[0].energy = 1; agents[0].phase = 1;
        agents[1].energy = 0; agents[1].phase = 0;
        agents[2].energy = 4000; agents[2].phase = 63; // resonance trigger
        lattice.tick_physics();
        for i in 0..10 {
            assert!(
                agents[i].energy <= crate::constants::MAX_ATP,
                "Agent {} energy {} exceeds MAX_ATP {}", i, agents[i].energy, crate::constants::MAX_ATP
            );
        }
    }

    #[test]
    fn test_tick_physics_phase_in_range_q2() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice_with_q_phase(10, 2);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        lattice.ignite_big_bang(42, 10);
        for _ in 0..20 {
            lattice.tick_physics();
        }
        let mask = lattice.topology.phase_mask();
        for i in 0..10 {
            assert!(agents[i].phase <= mask, "q_phase=2: phase must be in [0, {}]", mask);
        }
    }

    #[test]
    fn test_tick_physics_phase_in_range_q5() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice_with_q_phase(10, 5);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        lattice.ignite_big_bang(42, 10);
        for _ in 0..20 {
            lattice.tick_physics();
        }
        let mask = lattice.topology.phase_mask();
        for i in 0..10 {
            assert!(agents[i].phase <= mask, "q_phase=5: phase must be in [0, {}]", mask);
        }
    }

    #[test]
    fn test_tick_physics_determinism_q5() {
        let (mut lattice1, mut agents1, _snapshot, _deltas) = make_lattice_with_q_phase(20, 5);
        lattice1.minimal_agents_ptr = agents1.as_mut_ptr();
        lattice1.signals.active_agent_count = 20;
        lattice1.ignite_big_bang(77, 20);
        for _ in 0..10 { lattice1.tick_physics(); }

        let (mut lattice2, mut agents2, _snapshot, _deltas) = make_lattice_with_q_phase(20, 5);
        lattice2.minimal_agents_ptr = agents2.as_mut_ptr();
        lattice2.signals.active_agent_count = 20;
        lattice2.ignite_big_bang(77, 20);
        for _ in 0..10 { lattice2.tick_physics(); }

        for i in 0..20 {
            assert_eq!(agents1[i].phase, agents2[i].phase, "Determinism failed at agent {} (phase)", i);
            assert_eq!(agents1[i].energy, agents2[i].energy, "Determinism failed at agent {} (energy)", i);
            assert_eq!(agents1[i].genome, agents2[i].genome, "Determinism failed at agent {} (genome)", i);
        }
    }

    #[test]
    fn test_tick_physics_phase_in_range() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        for i in 0..10 {
            agents[i].phase = (i * 37) as u32; // pseudo-random spread
            agents[i].energy = 500;
            agents[i].base_freq = (i as i32) * 10000; // varied frequencies
        }
        lattice.tick_physics();
        let mask = lattice.topology.phase_mask();
        for i in 0..10 {
            assert!(
                agents[i].phase <= mask,
                "Agent {} phase {} out of range [0, {}]", i, agents[i].phase, mask
            );
        }
    }

    #[test]
    fn test_tick_physics_dead_stay_dead() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(5);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 5;
        for i in 0..5 {
            agents[i].energy = 0;
            agents[i].state_flags = 0;
        }
        lattice.tick_physics();
        for i in 0..5 {
            assert_eq!(agents[i].energy, 0, "Dead agent {} should not resurrect", i);
            assert!(agents[i].state_flags & 0x01 != 0, "Dead agent {} should have death flag set", i);
        }
    }

    #[test]
    fn test_tick_physics_compost_published() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(3);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 3;
        // Agent 0 will die in one tick: burn = 1 + 24/4 = 7 for 0xDEADBEEF genome
        agents[0].energy = 7;
        agents[0].state_flags = 0;
        agents[0].genome = 0xDEADBEEF;
        agents[1].energy = 1000;
        agents[1].state_flags = 0;
        agents[2].energy = 1000;
        agents[2].state_flags = 0;
        
        // Clear phi buffer before test
        unsafe {
            let buf = core::ptr::addr_of_mut!(crate::PHI_MESSAGE_BUFFER);
            (*buf).reset();
        }
        
        lattice.tick_physics();
        
        unsafe {
            let buf = core::ptr::addr_of!(crate::PHI_MESSAGE_BUFFER);
            let len = (*buf).len();
            assert!(len > 0, "At least one compost message should be published");
            
            // Verify the compost message contains correct genome
            let msg = (*buf).peek_latest().unwrap();
            assert_eq!(msg.msg_type, crate::phi_protocol::PHI_MSG_COMPOST);
            let (genome, agent_id) = msg.decode_compost().unwrap();
            assert_eq!(genome, 0xDEADBEEF, "Compost should preserve agent genome");
            assert!(agent_id < 3, "Agent ID should be valid");
        }
    }

    #[test]
    #[ignore = "benchmark — run manually with cargo test -- --ignored"]
    fn bench_tick_physics_100k_10ticks() {
        let agent_count = 100_000;
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(agent_count);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = agent_count as u32;
        for i in 0..agent_count {
            agents[i].phase = (i * 7) as u32;
            agents[i].energy = 500 + ((i * 3) % 3000) as u32;
            agents[i].base_freq = ((i as i32 * 1000) % 4000) - 2000;
        }
        let start = std::time::Instant::now();
        for _ in 0..10 {
            lattice.tick_physics();
        }
        let elapsed = start.elapsed();
        let ns_per_agent = elapsed.as_nanos() / (agent_count as u128 * 10);
        println!("\n[BENCH] tick_physics: {} agents × 10 ticks in {:?}", agent_count, elapsed);
        println!("[BENCH] ~{} ns per agent per tick", ns_per_agent);
        assert!(elapsed.as_secs() < 5, "tick_physics too slow: {:?}", elapsed);
    }

    #[test]
    #[ignore = "benchmark — run manually with cargo test -- --ignored"]
    fn bench_tick_physics_1m_1tick() {
        let agent_count = 1_000_000;
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(agent_count);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = agent_count as u32;
        for i in 0..agent_count {
            agents[i].phase = (i * 7) as u32;
            agents[i].energy = 500 + ((i * 3) % 3000) as u32;
            agents[i].base_freq = ((i as i32 * 1000) % 4000) - 2000;
        }
        let start = std::time::Instant::now();
        lattice.tick_physics();
        let elapsed = start.elapsed();
        let ns_per_agent = elapsed.as_nanos() / agent_count as u128;
        println!("\n[BENCH] tick_physics: {} agents × 1 tick in {:?}", agent_count, elapsed);
        println!("[BENCH] ~{} ns per agent per tick", ns_per_agent);
        assert!(elapsed.as_secs() < 2, "tick_physics too slow for 1M: {:?}", elapsed);
    }

    #[test]
    fn test_tick_physics_determinism() {
        // Run two identical lattices independently — results must match bit-for-bit.
        let mut setups: [(PhaseLattice, Vec<PhaseAgentMinimal>); 2] = {
            let (l1, a1, _, _) = make_lattice(8);
            let (l2, a2, _, _) = make_lattice(8);
            [(l1, a1), (l2, a2)]
        };

        for (ref mut lattice, ref mut agents) in &mut setups {
            lattice.minimal_agents_ptr = agents.as_mut_ptr();
            lattice.signals.active_agent_count = 8;
            for i in 0..8 {
                agents[i].phase = (i * 17) as u32;
                agents[i].energy = 800;
                agents[i].base_freq = (i as i32) * 5000;
            }
            lattice.tick_physics();
        }

        let (_, ref agents1) = setups[0];
        let (_, ref agents2) = setups[1];
        for i in 0..8 {
            assert_eq!(agents1[i].phase, agents2[i].phase, "Phase must be deterministic");
            assert_eq!(agents1[i].energy, agents2[i].energy, "Energy must be deterministic");
            assert_eq!(agents1[i].base_freq, agents2[i].base_freq, "Base freq must be deterministic");
        }
    }
}
