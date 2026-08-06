//! Reactive State Lattice
//! Bitmask Dirty Flags for Zero-Cost Environment Sync.
//! Since we are `#![no_std]`, we avoid complex Observer/FRP heap allocations.
//! Instead, 1 Bit = 1 Signal.

use crate::agent::{PhaseAgentMinimal, PhaseAgentSmart};
use crate::topology::{OntologicalIntent, PhaseTopology};

// --- SIGNAL DEFINITIONS (Bitmask Dirty Flags) ---
pub const SIGNAL_TOPOLOGY_CHANGED: u32 = 1 << 0; // JS resized the canvas or limits changed
pub const SIGNAL_THERMO_COLLAPSE: u32 = 1 << 1; // Energy dropped below survival threshold
pub const SIGNAL_CONSENSUS_SHIFT: u32 = 1 << 2; // Bitcoin hash arrived (Global Anchor)
pub const SIGNAL_MUTATION_TRIGGER: u32 = 1 << 3; // LERP orthogonal deviation needed

#[repr(C)]
#[derive(Clone, Copy)]
pub struct DeltaItem {
    pub index: u32,
    pub phase: u32,
    pub energy: u32,
    pub genome: u32,
}

#[derive(Clone, Copy)]
#[repr(C)]
pub struct SignalStore {
    pub dirty_flags: u32,
    pub proper_time: crate::chronotopology::ProperTime,
    pub active_agent_count: u32,
    pub max_cells: u32,
    pub total_entropy_released: u64,
    /// Philosophy Global Energy Audit
    pub total_energy: u32,
    pub p90_energy: u32,
    pub p90_age: u32,
    /// Cumulative ATP the sun has put into the lattice.
    ///
    /// This world is OPEN. Predation and diffusion move energy between agents,
    /// burn removes it — so a closed OMEGA-64 can only run down, and measurement
    /// confirmed it does: 1024 agents, extinct at tick 86, zero births ever,
    /// because no agent can climb to MITOSIS_THRESHOLD when the total only
    /// falls. A closed world cannot host life; that is the second law, not a
    /// bug.
    ///
    /// So income is named rather than hidden. Every ATP that enters from
    /// outside is counted here, which keeps the books honest in the only way
    /// that matters: `start + solar == end + dissipated`. A source that is not
    /// counted is indistinguishable from a leak running backwards.
    ///
    /// Occupies what was `_pad2` — declared padding, same 48-byte layout.
    pub total_solar_input: u32,
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
    pub tick_snapshot_ptr: *mut PhaseAgentMinimal,
    #[cfg(not(feature = "spore"))]
    pub attractors_ptr: *const crate::attractor::AttractorArray,
    pub active_agent_count: u32,
    /// Suppress Φ-bus emission. Set on a lattice that exists only to be
    /// replayed for verification: its agents die like any others, and the
    /// compost messages those deaths would publish are not events in the world
    /// — they are an artifact of asking "what would have happened". A verifier
    /// that talks on the bus is no longer a verifier.
    ///
    /// Appended after every field JS reads, so the 208-byte uniform head that
    /// `ffi_layout.rs` pins is untouched.
    pub quiet: bool,
}

unsafe impl Send for PhaseLattice {}

impl PhaseLattice {
    /// Bootstraps the grid directly on top of pre-allocated WebGPU host memory
    pub fn new_from_host_memory(
        topology: PhaseTopology,
        smart_ptr: *mut PhaseAgentSmart,
        min_ptr: *mut PhaseAgentMinimal,
    ) -> Self {
        Self {
            topology,
            signals: SignalStore {
                dirty_flags: 0,
                proper_time: crate::chronotopology::ProperTime::new(),
                active_agent_count: 0,
                max_cells: 0,
                total_entropy_released: 0,
                total_energy: 0,
                p90_energy: 0,
                p90_age: 0,
                total_solar_input: 0,
            },
            intents: [OntologicalIntent::empty(); 4],
            smart_agents_ptr: smart_ptr,
            minimal_agents_ptr: min_ptr,
            tick_snapshot_ptr: core::ptr::null_mut(),
            #[cfg(not(feature = "spore"))]
            attractors_ptr: core::ptr::null(),
            quiet: false,
            active_agent_count: 0,
        }
    }

    /// Extracted API for the JS Env Vector to easily inject Climate Changes into WASM.
    ///
    /// The JS-callable entry point is the free `v2_set_environment` in lib.rs,
    /// NOT this method. It carried `#[no_mangle] extern "C"` until 2026-08-06,
    /// which exported a second symbol, `set_environment`, whose argument 0 was
    /// `&mut self` — uncallable from JS and memory-unsafe if attempted. Found
    /// by `tests/wasm_abi_lock_test.ts` the first time it ran, alongside the
    /// same mistake in `ingest_cosmic_entropy`, which had a live caller.
    pub fn set_environment(
        &mut self,
        q_sectors: u32,
        q_radial: u32,
        _q_harmonics: u32,
        weather_multiplier: u32,
    ) {
        // CRIT-6 FIX: validate bounds to prevent shift overflow in topology math
        assert!(
            q_sectors < 32 && q_radial < 32,
            "q_sectors/q_radial must be < 32"
        );
        self.topology.q_sectors = q_sectors;
        self.topology.q_radial = q_radial;
        if weather_multiplier > 0 {
            self.topology.weather_multiplier = weather_multiplier;
        }

        // Hoist the Topology Changed flag. The actual arrays will not reallocate here!
        // Instead, the next `tick_physics` will read this flag and gracefully Darwnin-kill
        // agents that no longer fit in the newly reduced `topology.max_geometry_cells`.
        self.signals.dirty_flags |= SIGNAL_TOPOLOGY_CHANGED;
    }

    /// Triggered by the ATPBridge when a new Bitcoin/Ethereum block arrives.
    /// Φ-Маніфест: кожен новий блок — це пульс глобального часу (R).
    ///
    /// A plain inherent method. It carried `#[no_mangle] pub extern "C"` until
    /// 2026-08-06, which exported the symbol `ingest_cosmic_entropy` — with
    /// `&mut self` as its first WASM argument. Nothing could safely call that
    /// from JS: passing anything but a real `PhaseLattice` pointer as arg 0 is
    /// memory corruption. Meanwhile the host called
    /// `exports.v2_ingest_cosmic_entropy`, a name that did not exist, so the
    /// feature threw on every block into a `catch` that logged and continued.
    /// The free wrapper `v2_ingest_cosmic_entropy` in lib.rs is the callable
    /// entry point; `tests/wasm_abi_lock_test.ts` now refuses `self`-taking
    /// exports outright.
    pub fn ingest_cosmic_entropy(&mut self, raw_hash_u64: u64) {
        // Ingest block hash into the φ-anchor chain.
        unsafe {
            let mut anchor = crate::PHI_ANCHOR_CHAIN.lock();
            anchor.ingest_block(raw_hash_u64);
        }
        self.signals.dirty_flags |= SIGNAL_CONSENSUS_SHIFT;
    }

    /// Pre-populates the `.bss` static memory with randomized kinetic energy and base frequencies
    /// using a hyper-minimal Linear Congruential Generator (LCG).
    #[inline(always)]
    fn wrap_index_2d(x: i32, y: i32, w: i32, h: i32) -> usize {
        let wx = x.rem_euclid(w);
        let wy = y.rem_euclid(h);
        (wy * w + wx) as usize
    }

    /// Safe accessor to minimal agents to prevent FFI out-of-bounds UB
    #[inline(always)]
    pub fn get_agent(&self, idx: u32) -> Option<&PhaseAgentMinimal> {
        let active = self.signals.active_agent_count;
        if self.minimal_agents_ptr.is_null()
            || idx >= active
            || (idx as usize) >= crate::MAX_MINIMAL_AGENTS
        {
            None
        } else {
            Some(unsafe { &*(self.minimal_agents_ptr.add(idx as usize)) })
        }
    }

    #[inline(always)]
    pub fn get_agent_mut(&mut self, idx: u32) -> Option<&mut PhaseAgentMinimal> {
        let active = self.signals.active_agent_count;
        if self.minimal_agents_ptr.is_null()
            || idx >= active
            || (idx as usize) >= crate::MAX_MINIMAL_AGENTS
        {
            None
        } else {
            Some(unsafe { &mut *(self.minimal_agents_ptr.add(idx as usize)) })
        }
    }

    pub fn ignite_big_bang(&mut self, root_seed: u32, initial_population: u32) {
        if self.minimal_agents_ptr.is_null() {
            return;
        }

        // Critical: Prevent C-style buffer overflow if JS asks for more than .bss can hold!
        let safe_population = core::cmp::min(initial_population, crate::MAX_MINIMAL_AGENTS as u32);

        // THE BIG BANG DOES NOT FILL THE UNIVERSE.
        //
        // It used to: `initial_population` became both the capacity and the
        // living count, so every slot was occupied at t=0. Mitosis places a
        // child by finding a vacancy, and a vacancy only appears when something
        // dies — so a world that starts full can never grow, and once the sun
        // made starvation rare it could never reproduce either. Measured: 1024
        // alive at tick 1500, richest agent past the fertility threshold, and
        // zero births, because there was nowhere to put a child.
        //
        // So `initial_population` is now the CAPACITY — what the host allocated
        // and what the GPU buffers are sized for — and life is seeded into a
        // fraction of it. The rest is the room the world grows into.
        self.signals.max_cells = safe_population;
        let seeded = core::cmp::max(
            1,
            (safe_population as u64 * crate::constants::BIG_BANG_SEED_DENSITY_Q10 as u64 / 1024)
                as u32,
        );
        let safe_population = core::cmp::min(seeded, safe_population);

        self.signals.active_agent_count = safe_population;
        let mut rng = crate::math::Xorshift64::new(root_seed);
        let max_phase = (1u32 << self.topology.q_phase) - 1;

        #[cfg(test)]
        let _birth_ticks_guard = crate::BIRTH_TICKS_TEST_LOCK.lock();

        unsafe {
            for i in 0..safe_population {
                let agent_ptr = self.minimal_agents_ptr.add(i as usize);

                let phase = rng.next_u32() & max_phase;
                let energy = (rng.next_u32() % crate::constants::BB_ENERGY_RANGE)
                    + crate::constants::BB_ENERGY_BASE;
                let base_freq = ((rng.next_u32() % crate::constants::BB_FREQ_RANGE) as i32
                    - crate::constants::BB_FREQ_OFFSET)
                    * crate::constants::BB_FREQ_Q_SCALE;
                let genome = rng.next_u32(); // CRIT-2 FIX: use full 32-bit entropy

                *agent_ptr = crate::agent::PhaseAgentMinimal {
                    phase,
                    energy,
                    base_freq,
                    state_flags: (genome & 0x7F) << 1,
                    genome,
                    memory: [0, 0, 0],
                };
                let mut ticks = crate::BIRTH_TICKS.lock();
                ticks[i as usize] = self.signals.proper_time.causal_ticks;
            }
        }
    }

    /// Era 950+: Big Bang guided by Epigenetic Memory.
    /// Instead of purely random genomes, successful historical traits bias new agents.
    pub fn ignite_epigenetic_big_bang(
        &mut self,
        root_seed: u32,
        initial_population: u32,
        memory: &crate::epigenetics::EpigeneticMemory,
        trng_entropy: &[u8],
    ) {
        if self.minimal_agents_ptr.is_null() {
            return;
        }

        let safe_population = core::cmp::min(initial_population, crate::MAX_MINIMAL_AGENTS as u32);
        self.signals.active_agent_count = safe_population;

        // Silicon to Mycelium.
        // Hash the TRNG entropy directly into the root_seed.
        let mut final_seed = root_seed;
        for &byte in trng_entropy {
            final_seed ^= byte as u32;
            final_seed = final_seed.wrapping_mul(0x0100_0193);
        }

        let mut rng = crate::math::Xorshift64::new(final_seed);
        let max_phase = (1u32 << self.topology.q_phase) - 1;

        #[cfg(test)]
        let _birth_ticks_guard = crate::BIRTH_TICKS_TEST_LOCK.lock();

        unsafe {
            for i in 0..safe_population {
                let agent_ptr = self.minimal_agents_ptr.add(i as usize);

                let phase = rng.next_u32() & max_phase;
                let energy = (rng.next_u32() % crate::constants::BB_ENERGY_RANGE)
                    + crate::constants::BB_ENERGY_BASE;
                let base_freq = ((rng.next_u32() % crate::constants::BB_FREQ_RANGE) as i32
                    - crate::constants::BB_FREQ_OFFSET)
                    * crate::constants::BB_FREQ_Q_SCALE;
                let genome = memory.generate_biased_genome(rng.next_u32());

                *agent_ptr = crate::agent::PhaseAgentMinimal {
                    phase,
                    energy,
                    base_freq,
                    state_flags: (genome & 0x7F) << 1,
                    genome,
                    memory: [0, 0, 0],
                };
                let mut ticks = crate::BIRTH_TICKS.lock();
                ticks[i as usize] = self.signals.proper_time.causal_ticks;
            }
        }
    }

    /// Calculates the state hash of all active agents' core state
    /// (phase, energy, base_freq, genome, memory). Used for Commutative LawHash Telemetry.
    /// Uses zero-copy memory mapping to avoid allocations.
    pub fn calculate_state_hash(&self) -> u32 {
        if self.minimal_agents_ptr.is_null() || self.signals.active_agent_count == 0 {
            return crate::crypto::sha256_u32(&[]);
        }
        unsafe {
            let active = self.signals.active_agent_count as usize;
            let bytes =
                core::slice::from_raw_parts(self.minimal_agents_ptr as *const u8, active * 32);
            crate::crypto::sha256_u32(bytes)
        }
    }

    /// Rows in the toroidal grid for `active` agents laid out `w` to a row.
    ///
    /// CEILING, not floor. `wrap_index_2d` can only ever return an index in
    /// `[0, h*w)`, so any agent at or past `h*w` is outside the torus: it reads
    /// eight neighbours and is the neighbour of nobody, drawing energy by
    /// conduction and predation from counterparties that never pay it. Flooring
    /// left up to `w-1` such agents whenever the population was not an exact
    /// multiple of the row width.
    ///
    /// That was occasional when the population was fixed at ignition. It is the
    /// normal case now that mitosis grows `active_agent_count` one birth at a
    /// time, which is what made it worth fixing rather than documenting.
    ///
    /// The overhang this creates in the other direction — indices in
    /// `[active, h*w)` that no agent occupies — was already handled: both
    /// substrates skip a neighbour whose index is `>= active_agent_count`, and
    /// they skip it symmetrically, so nothing is created or destroyed there.
    #[inline]
    pub fn grid_rows(active: u32, w: i32) -> i32 {
        let w = w.max(1);
        let rows = (active as i64 + w as i64 - 1) / w as i64;
        core::cmp::max(1, rows as i32)
    }

    /// What one predator may take from a prey holding `prey_energy` this tick.
    ///
    /// LAW (chosen 2026-08-06, see docs/PHYSICS_BOUNDARY.md): a predator's share
    /// is bounded by the prey's per-neighbour capacity. You cannot eat what is
    /// not there.
    ///
    /// The flat `PREDATOR_ENERGY_STEAL` minted ATP at the energy floor. A prey
    /// with 3 ATP loses at most 3 — the debit saturates — while up to eight
    /// predators each credited themselves the full 5. Up to 40 ATP appeared
    /// from 3, every tick, and the closer the ecosystem ran to starvation the
    /// faster it inflated. Selection pressure inverted exactly where it should
    /// have been sharpest.
    ///
    /// Dividing by the Moore neighbourhood makes it conservative by
    /// construction: at most eight predators, each taking at most
    /// `prey_energy / 8`, remove at most `prey_energy` in total (integer
    /// division floors, so the sum can only come in under).
    ///
    /// Above `PREDATOR_ENERGY_STEAL * 8` ATP the prey's capacity exceeds the
    /// flat rate and the share is exactly the old constant — so a healthy
    /// ecosystem behaves precisely as before, and only the starving regime,
    /// which was the broken one, changes.
    #[inline]
    pub fn predation_share(prey_energy: u32) -> u32 {
        // 8 = the Moore neighbourhood, i.e. the length of `n_indices` and the
        // bound of the shader's neighbour loop. If that ever stops being 8,
        // this divisor moves with it or the law stops being conservative.
        let per_neighbour = prey_energy / 8;
        if crate::constants::PREDATOR_ENERGY_STEAL < per_neighbour {
            crate::constants::PREDATOR_ENERGY_STEAL
        } else {
            per_neighbour
        }
    }

    /// Entropy released when an agent dissolves — Landauer's principle over the
    /// information the lattice is about to forget.
    ///
    /// An agent's state is its genome plus three memory words: 128 bits. Erasing
    /// them costs `LANDAUER_BIT_COST` per SET bit, which is how this kernel
    /// already prices information everywhere else — metabolic maintenance uses
    /// `genome.count_ones()` (see the burn path) and mitosis charges
    /// `(parent.genome ^ child.genome).count_ones()` (mitosis_proof.rs).
    ///
    /// Death was the one place that summed the words as NUMBERS instead of
    /// counting their bits, so a single death could release ~1.7e10 "entropy"
    /// into a universe whose entire ATP supply is capped at `MAX_ATP` per agent.
    /// That is not a big number, it is a different unit — and it made the
    /// documented future where compost draws on `total_entropy_released` an
    /// unbounded ATP faucet rather than a conservation law. Bits, like the
    /// other two.
    ///
    /// Bounded by construction: 128 bits × `LANDAUER_BIT_COST`.
    #[inline]
    pub fn death_entropy(agent: &PhaseAgentMinimal) -> u64 {
        let bits = agent.genome.count_ones()
            + agent.memory[0].count_ones()
            + agent.memory[1].count_ones()
            + agent.memory[2].count_ones();
        (bits * crate::constants::LANDAUER_BIT_COST) as u64
    }

    /// Book deaths that happened off-CPU, and refresh the aggregates.
    ///
    /// On the GPU path the compute shader kills agents — `compute_toroidal.wgsl`
    /// sets bit 0 when energy reaches zero — but it can write nothing else:
    /// `signals` is bound `var<uniform>` there, so it is read-only by
    /// construction. Everything `tick_physics` does *around* the kill therefore
    /// never happens: no entropy burst, no compost message, no `total_energy`,
    /// no high-water mark. Death sets a bit and means nothing, and the entropy
    /// trace the thermodynamics rest on stays flat at zero forever.
    ///
    /// `tick_physics`'s own guard cannot recover it: it books on
    /// `energy == 0 && flags & 0x01 == 0`, and the shader has *already* set that
    /// bit, so the condition is false for every agent the GPU killed.
    ///
    /// So book by difference instead. An agent that is dead now and was alive in
    /// the retained snapshot died since the last call, exactly once. The entropy
    /// formula, the compost encoding and the aggregate arithmetic are the same
    /// ones `tick_physics` uses — this is that bookkeeping, lifted out so a
    /// substrate that owns the per-agent step can still hand it back.
    ///
    /// This is the counterpart to [`Self::darwinian_mitosis`]: birth already
    /// crosses back to the kernel on readback, death did not.
    ///
    /// Idempotent — calling it twice with no physics in between books nothing,
    /// because it leaves the snapshot equal to the live array. It is NOT meant
    /// to be combined with `tick_physics` on the same tick; that path books its
    /// own deaths inline.
    ///
    /// Returns the number of deaths booked.
    pub fn reap_off_cpu_deaths(&mut self) -> u32 {
        if self.minimal_agents_ptr.is_null() || self.signals.active_agent_count == 0 {
            return 0;
        }
        let active = core::cmp::min(
            self.signals.active_agent_count as usize,
            crate::MAX_MINIMAL_AGENTS,
        );

        let mut deaths: u32 = 0;
        let mut total_system_energy: u64 = 0;
        let mut prev_system_energy: u64 = 0;
        let mut new_high_water_mark: usize = 0;

        unsafe {
            let mut shadow = crate::SHADOW_LATTICE_MEMORY.lock();
            let snapshot = if self.tick_snapshot_ptr.is_null() {
                shadow.as_mut_ptr()
            } else {
                self.tick_snapshot_ptr
            };

            for i in 0..active {
                let agent = &mut *self.minimal_agents_ptr.add(i);
                let prev = &*snapshot.add(i);
                let was_dead = prev.state_flags & 0x01 != 0;
                let is_dead = agent.state_flags & 0x01 != 0;

                prev_system_energy = prev_system_energy.wrapping_add(prev.energy as u64);

                // Same accumulation predicate as tick_physics, so both paths
                // publish the same signals for the same lattice.
                if agent.energy > 0 && !is_dead {
                    total_system_energy = total_system_energy.wrapping_add(agent.energy as u64);
                    new_high_water_mark = i + 1;
                }

                if is_dead && !was_dead {
                    deaths += 1;

                    // Thermodynamics: Entropy release (Landauer's Principle).
                    let entropy_burst = Self::death_entropy(agent);
                    self.signals.total_entropy_released = self
                        .signals
                        .total_entropy_released
                        .wrapping_add(entropy_burst);

                    if !self.quiet {
                        let compost =
                            crate::phi_protocol::PhiMessage::encode_compost(agent, i as u64);
                        let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
                        buf.push(compost);
                    }
                }
            }

            // DISSIPATION. Everything the step burned, clamped away or let
            // leak shows up as ATP that left the population without arriving
            // anywhere else — transfers between agents are internal and cancel.
            // Booking the whole drop is what makes the ledger true rather than
            // merely non-empty: metabolic burn alone is several ATP per agent
            // per tick and dwarfs both death (≤128) and the mitosis erasure tax
            // (≤32), so a trace carrying only those two was reporting a
            // rounding error and calling it thermodynamics.
            //
            // The shader cannot do this itself — `signals` is `var<uniform>`
            // there — so it is recovered here, at the boundary, from the one
            // thing the substrate cannot hide: the difference between the state
            // it was given and the state it returned.
            //
            // A RISE is not booked. Energy appearing from nowhere is a defect,
            // not negative entropy, and quietly absorbing it here would turn
            // this ledger into the same tautology as the old energy audit —
            // always consistent, never informative. Conservation is asserted by
            // test instead; see `the_reaper_books_dissipation_but_never_a_mint`.
            if prev_system_energy > total_system_energy {
                let dissipated = prev_system_energy - total_system_energy;
                self.signals.total_entropy_released = self
                    .signals
                    .total_entropy_released
                    .wrapping_add(dissipated);
            }

            self.signals.total_energy = total_system_energy as u32;
            self.signals.active_agent_count = new_high_water_mark as u32;

            // Re-arm the diff for the next call. `darwinian_mitosis` re-arms it
            // again at its end, so the reproduction that runs after this sweep
            // is not re-read as unexplained loss on the next one — its own
            // erasure tax is already booked there.
            core::ptr::copy_nonoverlapping(self.minimal_agents_ptr, snapshot, active);
        }

        deaths
    }

    /// The Hot Path Physics Loop
    /// @oct 1.3 Physics tick vector
    /// Tensor Web: реалізує Kuramoto coupling, metabolic decay та phase drift.
    pub fn tick_physics(&mut self) {
        // ProperTime is advanced at the END of the tick, based on thermodynamic stress.

        let mut total_system_energy = 0u64;
        let mut prev_system_energy = 0u64;
        let mut solar_input_this_tick = 0u64;
        let mut _alive_count = 0;
        let mut new_high_water_mark = 0usize;

        // REACTIVE RECONCILIATION
        if (self.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED) != 0 {
            // Apply Darwinian culling: agents beyond new capacity are killed
            let new_max = self.topology.max_geometry_cells(
                1, // harmonics (simplified)
                1, // tau_depth (simplified)
            ) as u32;
            if self.signals.active_agent_count > new_max {
                self.signals.active_agent_count = new_max;
            }
            self.signals.dirty_flags &= !SIGNAL_TOPOLOGY_CHANGED;
        }

        if (self.signals.dirty_flags & SIGNAL_CONSENSUS_SHIFT) != 0 {
            // Cosmic entropy: apply global phase shift from Bitcoin anchor
            unsafe {
                if !self.minimal_agents_ptr.is_null() {
                    let global_phi = crate::PHI_ANCHOR_CHAIN.lock().global_phi();
                    for i in 0..self.signals.active_agent_count as usize {
                        let agent = &mut *self.minimal_agents_ptr.add(i);
                        let max_phase = (1u32 << self.topology.q_phase) - 1;
                        agent.phase = agent.phase.wrapping_add(global_phi) & max_phase;
                    }
                }
            }
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
            // Era 0201 FIX: Use a read-only snapshot for pre-tick neighbor reads
            // to guarantee CPU-GPU bit-exact parity. The old chunk buffer caused
            // read-after-write at chunk boundaries (left neighbor already mutated).
            let snapshot = if self.tick_snapshot_ptr.is_null() {
                crate::SHADOW_LATTICE_MEMORY.as_mut_ptr() as *mut PhaseAgentMinimal
            } else {
                self.tick_snapshot_ptr
            };
            core::ptr::copy_nonoverlapping(self.minimal_agents_ptr, snapshot, active);

            // Era 1080 Prop 2: Homeostatic Metabolism Pressure
            let active_clamped = core::cmp::max(1, self.signals.active_agent_count);
            let avg_energy = self.signals.total_energy / active_clamped;
            let target_energy = 1000;
            let mut metabolic_pressure = (avg_energy * 1024 / target_energy) as i32;
            metabolic_pressure = metabolic_pressure.clamp(512, 2048); // 0.5x to 2.0x

            // Era 1080 Prop 3: Deterministic Day Cycle
            let day_phase = (self.signals.proper_time.causal_ticks % 1024) * 256 / 1024;
            let sun_multiplier = 1024 + crate::math::sin_q10(0, day_phase);

            for i in 0..active {
                let agent = &mut *self.minimal_agents_ptr.add(i);

                if agent.energy > 0 {
                    let w = (1i32 << self.topology.q_radial).max(1);
                    let h = Self::grid_rows(active as u32, w);
                    let cx = (i as i32) % w;
                    let cy = (i as i32) / w;

                    let n_indices = [
                        Self::wrap_index_2d(cx - 1, cy - 1, w, h),
                        Self::wrap_index_2d(cx, cy - 1, w, h),
                        Self::wrap_index_2d(cx + 1, cy - 1, w, h),
                        Self::wrap_index_2d(cx - 1, cy, w, h),
                        Self::wrap_index_2d(cx + 1, cy, w, h),
                        Self::wrap_index_2d(cx - 1, cy + 1, w, h),
                        Self::wrap_index_2d(cx, cy + 1, w, h),
                        Self::wrap_index_2d(cx + 1, cy + 1, w, h),
                    ];

                    // We map left to n_indices[3] and right to n_indices[4] to match WGSL (cx-1, cx+1)
                    let left = &*snapshot.add(if n_indices[3] < active {
                        n_indices[3]
                    } else {
                        0
                    });
                    let right = &*snapshot.add(if n_indices[4] < active {
                        n_indices[4]
                    } else {
                        0
                    });

                    // Phenotypic Expression
                    let phenotype = agent.decode_phenotype();

                    // Hebbian Learning (Active Memory) & Era 2080 Ortho packing
                    let mut weight_left = if (agent.memory[1] & 0xFFFF) == 0 {
                        crate::constants::HEBBIAN_DEFAULT_WEIGHT
                    } else {
                        (agent.memory[1] & 0xFFFF) as i32
                    };
                    let mut weight_right = if (agent.memory[2] & 0xFFFF) == 0 {
                        crate::constants::HEBBIAN_DEFAULT_WEIGHT
                    } else {
                        (agent.memory[2] & 0xFFFF) as i32
                    };
                    let mut ortho_agent = (agent.memory[1] >> 16) & 0xFF;
                    let mut is_tissue = (agent.state_flags & crate::agent::FLAG_TISSUE_LOCKED) != 0;

                    let cos_left = crate::math::cos_q10(left.phase, agent.phase);
                    let cos_right = crate::math::cos_q10(right.phase, agent.phase);

                    let neuroplasticity = (phenotype.radiance as i32) / 4;

                    weight_left = (weight_left + (cos_left * neuroplasticity) / 1024)
                        .clamp(0, crate::constants::HEBBIAN_MAX_WEIGHT);
                    weight_right = (weight_right + (cos_right * neuroplasticity) / 1024)
                        .clamp(0, crate::constants::HEBBIAN_MAX_WEIGHT);

                    // Kuramoto coupling modulated by Hebbian weights
                    // interaction_radius amplifies coupling (making the agent more sensitive/interactive)
                    let k = kuramoto_k + (phenotype.interaction_radius as i32 * 4);

                    // Photonic Substrate Readiness (Light as Compute)
                    // Discrete Fourier Transform (DFT) Mean-Field Approximation
                    let mut sum_cos = 0i32;
                    let mut sum_sin = 0i32;
                    let default_weight = crate::constants::HEBBIAN_DEFAULT_WEIGHT;

                    for &n_idx in &n_indices {
                        if n_idx < active {
                            let n = &*snapshot.add(n_idx);
                            if n.energy > 0 {
                                let n_ortho = (n.memory[1] >> 16) & 0xFF;
                                let d_ortho = ortho_agent.abs_diff(n_ortho);

                                // Topological Parallax Lens: Z-axis distance twists the phase interaction
                                let n_phase = n.phase.wrapping_add(d_ortho * 4) & max_phase;

                                sum_cos += crate::math::cos_q10(0, n_phase) * default_weight;
                                sum_sin += crate::math::sin_q10(0, n_phase) * default_weight;
                            }
                        }
                    }

                    // Agent's own phase components shifted by Sakaguchi-Kuramoto alpha
                    let phase_with_lag =
                        agent.phase.wrapping_add(self.topology.alpha as u32) & max_phase;
                    let agent_cos = crate::math::cos_q10(0, phase_with_lag);
                    let agent_sin = crate::math::sin_q10(0, phase_with_lag);

                    // Wave Interference: sin(Ψ - θ - α) = sin(Ψ)cos(θ+α) - cos(Ψ)sin(θ+α)
                    let total_coupling = ((sum_sin as i64 * agent_cos as i64
                        - sum_cos as i64 * agent_sin as i64)
                        / (q10_scale as i64 * crate::constants::HEBBIAN_DEFAULT_WEIGHT as i64))
                        as i32;
                    let coupling = (total_coupling * k) / (6 * q10_scale * q10_scale);

                    // Metabolic burn: decoded from phenotype
                    // Base is ~5. efficiency (0..255) maps to -2..+2 adjustment.
                    let efficiency_adj = 2i32 - (phenotype.metabolic_efficiency as i32 / 64);

                    // Thermodynamic Epistemology (Landauer's Principle)
                    let set_bits = agent.genome.count_ones();
                    let maintenance_cost = core::cmp::max(
                        1,
                        (set_bits / crate::constants::STRUCTURAL_MAINTENANCE_DIVISOR)
                            * crate::constants::LANDAUER_BIT_COST,
                    );
                    // Apply Bitcoin UTXO Weather (1024 = 1.0x)
                    let base_cost =
                        (maintenance_cost as u64 * self.topology.weather_multiplier as u64) / 1024;
                    let base_burn_raw = (base_cost as i32 + efficiency_adj).max(1);

                    // Apply metabolic pressure only. The sun is a SOURCE, not a
                    // tax: `sun_multiplier` used to scale this burn as well, so
                    // once photosynthesis was lit both sides of the ledger
                    // doubled at noon and halved at midnight and the day cycle
                    // cancelled itself out — no window in which an organism can
                    // store a surplus, which is what a day is FOR. Metabolism
                    // costs what it costs; only income follows the sky.
                    //
                    // The mean is unchanged: dropping one Q10 factor from the
                    // numerator and the divisor together leaves neutral-sun,
                    // neutral-pressure burn exactly where it was. What changes is
                    // that burn is now flat across the day while income
                    // oscillates, so agents charge by day and spend by night.
                    let base_burn =
                        ((base_burn_raw * metabolic_pressure) / 1024).max(1) as u32;

                    // Resilience flat reduction
                    let resilience_reduction = phenotype.resilience as u32 / 128; // 0 or 1
                    let burn = base_burn.saturating_sub(resilience_reduction).max(1);

                    // Species Specialization (Predator-Prey)
                    // PHOTOSYNTHESIS. The one term that enters from outside.
                    //
                    // `sun_multiplier` already existed and only ever multiplied
                    // BURN, so the sun made agents hungrier at noon and fed
                    // nobody — while the shader's comment beside it claimed
                    // "energy is strictly zero-sum except for solar input",
                    // naming a source that was not there. It is now.
                    //
                    // Uniform across agents: the sun does not play favourites.
                    // Selection runs through the burn side, where
                    // metabolic_efficiency and resilience already differ, so an
                    // efficient agent nets a surplus and climbs toward mitosis
                    // while a wasteful one starves under the same sky.
                    let solar = ((crate::constants::SOLAR_YIELD_Q10 as u64
                        * sun_multiplier.max(0) as u64)
                        / (1024 * 1024)) as u32;
                    solar_input_this_tick =
                        solar_input_this_tick.wrapping_add(solar as u64);

                    let mut energy_delta = solar as i32 - (burn as i32);
                    let mut energy_diffusion = 0i32;
                    // Accumulated over the same neighbours the physics already
                    // reads, for the tissue gate below. Costs one add per
                    // neighbour on a loop that is already running.
                    let mut neighbour_energy = 0u64;
                    let mut neighbour_count = 0u32;

                    for &n_idx in &n_indices {
                        if n_idx < active {
                            let n = &*snapshot.add(n_idx);
                            if n.energy > 0 {
                                neighbour_energy += n.energy as u64;
                                neighbour_count += 1;
                                let adv = crate::agent::species_advantage(agent.genome, n.genome);
                                // Both roles price the transfer off the PREY's
                                // pre-tick energy, so the two sides of one
                                // meal agree without talking. See
                                // Self::predation_share for the law.
                                if adv == 1 {
                                    energy_delta += Self::predation_share(n.energy) as i32;
                                } else if adv == -1 {
                                    energy_delta -= Self::predation_share(agent.energy) as i32;
                                }

                                // CONDUCTION IS GATED BY PHASE COHERENCE.
                                //
                                // Ungated, this term moves up to the full energy
                                // gradient every tick and is by far the strongest
                                // transfer in the model — predation moves at most
                                // PREDATOR_ENERGY_STEAL. So the food web existed
                                // and decided nothing: conduction levelled the
                                // population faster than any advantage could
                                // accumulate. Measured: with the sun lit, 6000
                                // ticks, population pinned at 1024, richest agent
                                // stuck at ~600 against a reproduction threshold
                                // of 2048, zero births. A crystal, not an ecology.
                                //
                                // These are Kuramoto oscillators, so let sharing
                                // follow the thing this system actually models:
                                // neighbours in phase pool their energy, neighbours
                                // out of phase do not. Coherent clusters equalise
                                // internally while staying distinct from each
                                // other, which is what makes accumulation — and
                                // therefore selection — possible at all.
                                //
                                // Conservative: cos_q10 is symmetric across the
                                // whole LUT (cos(a,b) == cos(b,a), verified
                                // exhaustively), and truncating division is
                                // odd-symmetric, so the pairwise transfer stays
                                // antisymmetric and no ATP is created.
                                let coherence = crate::math::cos_q10(n.phase, agent.phase).max(0);
                                energy_diffusion +=
                                    ((n.energy as i32 - agent.energy as i32) / 8) * coherence / 1024;
                            }
                        }
                    }
                    energy_delta += energy_diffusion;

                    // Philosophy Relativistic Chronotopology (Time Dilation)
                    let thermodynamic_stress = (coupling.abs() + energy_diffusion.abs()) as u32;
                    let time_dilation_multiplier = 1 + core::cmp::min(
                        thermodynamic_stress / crate::constants::CHRONOTOPOLOGY_STRESS_DIVISOR,
                        crate::constants::MAX_TIME_DILATION - 1,
                    );

                    // Emergent Organ Differentiation (Tissue Crystallization)
                    //
                    // RELATIVE, not absolute. The threshold was
                    // `MAX_ATP - 1000` — a fixed wealth line — so once the
                    // population reached carrying capacity and the sun outpaced
                    // metabolism, EVERY agent crossed it. Measured: 100% tissue
                    // by tick 640, 4091 of 4096 agents advancing zero phase per
                    // tick. That is not differentiation; an organ implies some
                    // structure and some motile cells, and a lattice that is
                    // entirely structure is a fossil.
                    //
                    // LOCAL, not global. The threshold was the population-wide
                    // top decile (`signals.p90_energy`), which fixed the runaway
                    // — the fraction stopped latching at 100% — but produced a
                    // GLOBAL OSCILLATION: every agent read the same number, so
                    // the whole lattice crystallised and dissolved together,
                    // 22% <-> 96% in phase. That is a body with one clock and no
                    // organs. Differentiation means some REGION is structural
                    // while another stays motile, which no population-wide
                    // number can express.
                    //
                    // So the comparison moves down one level: rich relative to
                    // the eight cells you can actually reach.
                    //
                    // THE REASON THIS IS RIGHT is locality, and that argument
                    // stands on its own. `signals.p90_energy` is a
                    // population-wide histogram: an agent's fate depended on a
                    // number computed over every other agent in the lattice,
                    // instantaneously, in a physics where every other term an
                    // agent reads comes from its eight neighbours. That is
                    // action at a distance, and it was the only such term.
                    // Whatever it produced, it should not have been able to.
                    //
                    // THE REASON I EXPECTED MORE was lateral inhibition: a
                    // crystal burns a quarter as much, so it accumulates,
                    // conduction spills into its neighbours, their bar rises,
                    // and a uniform medium resolves into patches. MEASURED, AND
                    // NOT SUPPORTED. Comparing the two laws at matched tissue
                    // fraction (1204 samples each, tools/structure_probe.ts
                    // 6000 4096 5), spatial clustering of the tissue flag goes
                    // one way in one band and the other way in the next: 1.11 vs
                    // 1.95 at 15-30%, 1.27 vs 1.30 at 30-50%, 1.16 vs 1.04 at
                    // 50-70%. The aggregate improvement (1.10 -> 1.33) is almost
                    // entirely the fraction confound — a lattice that is 96%
                    // tissue has clustering 1.0 by arithmetic, not by disorder.
                    // Neither law makes organs. This one is merely local.
                    //
                    // The MAX_ATP/2 floor stays: it is what stops the local king
                    // of a starving neighbourhood from being called structure,
                    // and it covers the degenerate first tick where an agent has
                    // no living neighbours at all.
                    let local_mean = if neighbour_count > 0 {
                        (neighbour_energy / neighbour_count as u64) as u32
                    } else {
                        0
                    };
                    let tissue_threshold =
                        core::cmp::max(local_mean, crate::constants::MAX_ATP / 2);
                    if !is_tissue
                        && ortho_agent > 0
                        && agent.energy > tissue_threshold
                        && thermodynamic_stress < 5
                    {
                        agent.state_flags |= crate::agent::FLAG_TISSUE_LOCKED;
                        is_tissue = true;
                        weight_left = crate::constants::HEBBIAN_MAX_WEIGHT;
                        weight_right = crate::constants::HEBBIAN_MAX_WEIGHT;
                    }

                    // ...AND BACK. Crystallisation used to be a one-way door:
                    // nothing anywhere cleared the flag, so the first agent to
                    // qualify was structure forever regardless of what happened
                    // to it afterwards. A cell that falls out of the top decile,
                    // or that finds itself under stress again, dissolves back
                    // into a motile one — which is what makes the tissue
                    // fraction an equilibrium rather than a ratchet.
                    //
                    // `base_freq` is no longer zeroed on crystallisation (the
                    // drift is gated on `is_tissue` instead), because zeroing it
                    // destroys the natural frequency and leaves nothing to
                    // return to.
                    if is_tissue && (agent.energy <= tissue_threshold || thermodynamic_stress >= 5)
                    {
                        agent.state_flags &= !crate::agent::FLAG_TISSUE_LOCKED;
                        is_tissue = false;
                    }

                    // Dynamic Orthogonal Branching (5D escape)
                    let mut final_burn = burn;
                    if is_tissue {
                        final_burn = final_burn.max(4) / 4; // Highly efficient
                                                            // No orthogonal drift, it is crystallized
                    } else {
                        if thermodynamic_stress
                            > crate::constants::CHRONOTOPOLOGY_STRESS_DIVISOR * 2
                        {
                            ortho_agent = ortho_agent.wrapping_add(1) & 0xFF; // Escape chaotic resonance
                        } else if agent.energy > crate::constants::MAX_ATP - 100 {
                            ortho_agent = ortho_agent.wrapping_sub(1) & 0xFF; // Expand territory
                        }
                    }

                    // Pack Hebbian weight and Ortho deviation back into memory
                    agent.memory[1] = (weight_left as u32) | (ortho_agent << 16);
                    agent.memory[2] = weight_right as u32;

                    // Apply time dilation to the burn penalty
                    let extra_burn = final_burn * (time_dilation_multiplier - 1);
                    energy_delta -= extra_burn as i32;

                    if energy_delta < 0 {
                        agent.energy = agent.energy.saturating_sub(energy_delta.unsigned_abs());
                    } else {
                        agent.energy = agent
                            .energy
                            .saturating_add(energy_delta as u32)
                            .min(crate::constants::MAX_ATP);
                    }

                    agent.memory[0] = coupling as u32;

                    let mut attractor_drift = 0i32;
                    #[cfg(not(feature = "spore"))]
                    if !self.attractors_ptr.is_null() {
                        let arr = &*self.attractors_ptr;
                        let attractor_count = core::cmp::min(arr.count, 4) as usize;
                        for j in 0..attractor_count {
                            attractor_drift += arr.data[j].drift_contribution(
                                agent.phase,
                                self.signals.proper_time.causal_ticks,
                                &self.topology,
                            );
                        }
                    }

                    // Phase drift: base_freq + coupling + attractor field, accelerated by time dilation
                    // Adaptive Time-Stepping: Nyquist clamping for base_freq
                    // Nyquist, in the units base_freq is actually stored in.
                    //
                    // `base_freq` is Q10 — ignition writes
                    // `(rng % BB_FREQ_RANGE - BB_FREQ_OFFSET) * BB_FREQ_Q_SCALE`
                    // — while this clamp was `max_phase / 2`, a bound in RAW
                    // phase units. Measured consequence: 905 distinct natural
                    // frequencies went in and 2 came out, -63 and +63, with
                    // 1024 of 1024 agents pinned to the rail. Every oscillator
                    // rotated half the phase space per tick in two
                    // counter-rotating groups, so the Kuramoto coupling had
                    // nothing to synchronise and the order parameter sat at
                    // 0.02 — the clamp whose comment says "Nyquist" was what
                    // put every oscillator ON the Nyquist limit.
                    let max_freq_q10 = (max_phase / 2) as i32 * crate::constants::MATH_Q_SCALE;
                    let clamped_base_freq =
                        agent.base_freq.clamp(-max_freq_q10, max_freq_q10)
                            / crate::constants::MATH_Q_SCALE;
                    // Structure does not drift. Gated here rather than by
                    // zeroing `base_freq`, so that dissolving back to motile
                    // restores the agent's own frequency instead of leaving it
                    // inert.
                    let drift = if is_tissue {
                        0
                    } else {
                        (clamped_base_freq + coupling + attractor_drift)
                            * (time_dilation_multiplier as i32)
                    };
                    agent.phase = agent.phase.wrapping_add(drift as u32) & max_phase;

                    // Philosophy Vector 10/12: Thermodynamic Conservation
                    // The 'Free Energy' resonance replenish exploit has been removed.
                    // Agents can no longer generate energy out of thin air simply by holding a resonant phase.
                    // Future implementation will draw from ambient ATP (total_entropy_released).
                }

                // The pre-tick value, from the snapshot taken at the top of this
                // tick. Its drop is what the step actually spent — see the
                // dissipation booking after the loop.
                prev_system_energy =
                    prev_system_energy.wrapping_add((*snapshot.add(i)).energy as u64);

                if agent.energy > 0 && agent.state_flags & 0x01 == 0 {
                    total_system_energy = total_system_energy.wrapping_add(agent.energy as u64);
                    _alive_count += 1;
                    new_high_water_mark = i + 1; // Track highest alive index
                }

                // Compost event: agent died this tick
                if agent.energy == 0 && agent.state_flags & 0x01 == 0 {
                    agent.state_flags |= 0x01; // Mark as dead

                    // Thermodynamics: Entropy release (Landauer's Principle)
                    let entropy_burst = Self::death_entropy(agent);
                    self.signals.total_entropy_released = self
                        .signals
                        .total_entropy_released
                        .wrapping_add(entropy_burst);

                    if !self.quiet {
                        let compost =
                            crate::phi_protocol::PhiMessage::encode_compost(agent, i as u64);
                        let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
                        buf.push(compost);
                    }
                }
            }
        }

        // DISSIPATION, same law as the off-CPU boundary ledger
        // (see reap_off_cpu_deaths): ATP that left the live population without
        // arriving anywhere else was spent. Transfers between agents are
        // internal and cancel; what remains is metabolic burn plus whatever the
        // MAX_ATP clamp discarded.
        //
        // Without this the two substrates keep DIFFERENT books for the same
        // world. Measured on 2026-08-06 by tools/ecology_probe.ts: a 1024-agent
        // run over 500 ticks dissipated 609,237 ATP through burn and booked
        // none of it, so the trace showed 47,586 — the Landauer terms alone —
        // while 93% of the universe's energy left unrecorded.
        //
        // A rise is not booked, for the reason given at the other site: energy
        // from nowhere is a defect, not negative entropy.
        // The world is OPEN, so the identity carries the income term:
        //   dissipated = (energy before + solar in) - energy after
        // Without it only the NET drop would be booked, and on any tick where
        // the sun outpaced metabolism the gross burn would vanish from the
        // ledger entirely — the trace would go quiet exactly when the ecosystem
        // was thriving.
        let available = prev_system_energy.wrapping_add(solar_input_this_tick);
        if available > total_system_energy {
            let dissipated = available - total_system_energy;
            self.signals.total_entropy_released = self
                .signals
                .total_entropy_released
                .wrapping_add(dissipated);
        }
        self.signals.total_solar_input = self
            .signals
            .total_solar_input
            .wrapping_add(solar_input_this_tick as u32);

        self.signals.total_energy = total_system_energy as u32;
        self.signals.active_agent_count = new_high_water_mark as u32;

        // --- CHRONOTOPOLOGY ---
        // Advance subjective proper time based on global network stress.
        // We estimate total stress from energy flow vs stable resting state.
        let avg_energy = if new_high_water_mark > 0 {
            total_system_energy as u32 / new_high_water_mark as u32
        } else {
            1000
        };
        let target_energy = 1000;
        let stress = avg_energy.abs_diff(target_energy);
        // Calculate entropy delta this tick
        let prev_entropy = self.signals.proper_time.entropy_burned;
        let entropy_delta =
            (self.signals.total_entropy_released as u32).saturating_sub(prev_entropy);

        self.signals.proper_time.advance(stress, entropy_delta);

        // Philosophy Global Energy Audit (ZK-verifiable)
        // Ensure no energy hyperinflation exists in the system.
        assert!(
            total_system_energy <= crate::constants::MAX_ATP as u64 * _alive_count as u64,
            "Thermodynamic invariant violation: energy > maximum possible"
        );
    }
    /// ERA 3000: Darwinian Sweep (Called 1Hz from JS Snapshot Extraction)
    /// Finds thriving cells (>MITOSIS_THRESHOLD ATP) and immediately replicates them into the nearest Dead slot (0 ATP).
    // Gated off the minimal bare-metal `spore` build: it pulls in codeicide_law
    // (sanctuary histograms / senate settings), which the spore does not carry.
    #[cfg(not(feature = "spore"))]
    pub fn darwinian_mitosis(&mut self) -> u32 {
        if self.minimal_agents_ptr.is_null() || self.signals.active_agent_count == 0 {
            return 0;
        }

        let mut next_dead_idx = 0;
        let mut replications = 0;
        let mut hist = crate::codeicide_law::EnergyHistogram::new();
        let mut age_hist = crate::codeicide_law::AgeHistogram::new();
        let mut sum_energy = 0u64;

        unsafe {
            let active = self.signals.active_agent_count as usize;
            // Pass 1: Build the Histograms and sum energy
            for i in 0..active {
                let parent = &*self.minimal_agents_ptr.add(i);
                if parent.energy > 0 {
                    sum_energy += parent.energy as u64;
                    let bucket = core::cmp::min(parent.energy >> 8, 15) as usize;
                    hist.buckets[bucket] += 1;

                    let birth_ticks = crate::BIRTH_TICKS.lock();
                    let age = self
                        .signals
                        .proper_time
                        .causal_ticks
                        .saturating_sub(birth_ticks[i]);
                    drop(birth_ticks);
                    let bucket_size = core::cmp::max(1, crate::constants::ANCIENT_AGE_TICKS / 10);
                    let age_bucket = (age / bucket_size).min(15) as usize;
                    age_hist.buckets[age_bucket] += 1;
                }
            }

            let p90_threshold =
                crate::codeicide_law::p90_energy(&hist, self.signals.active_agent_count);
            self.signals.p90_energy = p90_threshold;

            let bucket_size = core::cmp::max(1, crate::constants::ANCIENT_AGE_TICKS / 10);
            let p90_age_threshold = crate::codeicide_law::p90_age(
                &age_hist,
                self.signals.active_agent_count,
                bucket_size,
            );
            self.signals.p90_age = p90_age_threshold;
        }

        #[cfg(test)]
        let _birth_ticks_guard = crate::BIRTH_TICKS_TEST_LOCK.lock();

        unsafe {
            let active = self.signals.active_agent_count as usize;
            // Pass 2: Mitosis sweep
            for i in 0..active {
                let parent = &mut *self.minimal_agents_ptr.add(i);

                // If a cell has amassed massive ATP via resonance or gravity, it splits
                if parent.energy >= crate::constants::MITOSIS_THRESHOLD {
                    // Codeicide Law gate. Mitosis is a self-modifying
                    // act: the parent loses energy, and the lattice acquires a
                    // new agent that didn't exist a tick ago. By default,
                    // sanctuary-status parents are PRESUMED to consent to their
                    // own mitosis (it's not termination, it's reproduction). We
                    // express that consent by the absence of FLAG_SANCTUARY_WAIVED:
                    // setting that flag would temporarily refuse mitosis for the
                    // tick. Ancient agents remain free to reproduce — wisdom
                    // wants to propagate.
                    #[cfg(not(feature = "spore"))]
                    {
                        // The only mitosis gate is the explicit opt-out flag.
                        // Protection classification itself is NOT recomputed
                        // here — it lives in v2_codeicide_status /
                        // v2_codeicide_is_lawful, which read the birth tick
                        // from BIRTH_TICKS. (A previous revision computed a
                        // discarded `_status` here, paying two global locks
                        // per candidate for nothing.)
                        if (parent.state_flags & crate::codeicide_law::FLAG_SANCTUARY_WAIVED) != 0 {
                            // Skip — agent has explicitly opted out this tick.
                            continue;
                        }
                    }

                    // Era 1040 Phase 2: snapshot the parent state BEFORE the energy
                    // debit and BEFORE writing the child into the dead slot. This
                    // snapshot is the ground truth that every peer needs to
                    // independently re-derive the child via the pure function.
                    let parent_snapshot = *parent;

                    // Find the vacancy BEFORE charging for it.
                    //
                    // The debit used to happen here, above the search. On a full
                    // lattice the search then failed and the parent had already
                    // paid MITOSIS_COST for a child that was never born — 1024
                    // ATP deleted from the universe, with no receipt, no entropy
                    // record, and no way to tell it apart from metabolism. Worse,
                    // it repeated for EVERY qualifying parent in the sweep, so a
                    // saturated lattice bled proportionally to its own fertility.
                    //
                    // `next_dead_idx` only ever moves forward, so once it reaches
                    // `active` no later parent can find a slot either: stop the
                    // sweep rather than charge the rest of them.
                    while next_dead_idx < active
                        && (*self.minimal_agents_ptr.add(next_dead_idx)).energy > 0
                    {
                        next_dead_idx += 1;
                    }
                    if next_dead_idx >= active {
                        // No vacancy among the living — so grow into the empty
                        // part of the universe, if any is left. This is the
                        // difference between a population that can only replace
                        // its dead and one that can actually increase: without
                        // it, reproduction is gated on mortality, and a world
                        // where the sun keeps everyone alive is sterile.
                        //
                        // Bounded by `max_cells`, the capacity the host
                        // allocated and sized its GPU buffers for, so growth
                        // stops at carrying capacity rather than running off the
                        // end of the array.
                        let frontier = self.signals.active_agent_count as usize;
                        if frontier < self.signals.max_cells as usize
                            && frontier < crate::MAX_MINIMAL_AGENTS
                        {
                            next_dead_idx = frontier;
                            self.signals.active_agent_count += 1;
                        } else {
                            break; // at carrying capacity
                        }
                    }

                    parent.energy -= crate::constants::MITOSIS_COST; // Mitosis friction

                    {
                        #[cfg(not(feature = "spore"))]
                        {
                            let mut arr = crate::ATTRACTOR_ARRAY.lock();
                            let derived = crate::mitosis_proof::derive_mitosis_child(
                                &parent_snapshot,
                                &arr,
                                self.topology.q_phase,
                            );
                            let child = &mut *self.minimal_agents_ptr.add(next_dead_idx);
                            *child = derived;
                            {
                                let mut ticks = crate::BIRTH_TICKS.lock();
                                ticks[next_dead_idx as usize] =
                                    self.signals.proper_time.causal_ticks;
                            }

                            let cost = crate::constants::MITOSIS_COST;
                            let entropy_delta =
                                (derived.phase as i32).wrapping_sub(parent_snapshot.phase as i32);

                            // The parent pays MITOSIS_COST; the child receives
                            // CHILD_ENERGY_SEED minus a Landauer charge for every
                            // genome bit the mutation flipped (mitosis_proof.rs).
                            // Those two constants are equal, so the difference is
                            // exactly the erasure tax — and it used to be deleted
                            // rather than released, which is the same accounting
                            // hole death had. Book it, and reproduction becomes
                            // closed: parent_out == child_in + entropy.
                            let landauer_tax =
                                crate::constants::MITOSIS_COST.saturating_sub(derived.energy);
                            self.signals.total_entropy_released = self
                                .signals
                                .total_entropy_released
                                .wrapping_add(landauer_tax as u64);

                            // Era 1040 Phase 2: append the receipt to the global log
                            // so JS can broadcast a fully-verifiable DIPOLE plasmid.
                            let receipt = crate::mitosis_log::MitosisReceipt {
                                parent: parent_snapshot,
                                child: derived,
                                attractors: *arr,
                                q_phase: self.topology.q_phase,
                                receipt_hash: crate::mitosis_proof::child_receipt_hash(&derived),
                                tick: self.signals.proper_time.causal_ticks,
                                entropy_delta,
                                metabolic_cost: cost,
                            };
                            let mut log = crate::MITOSIS_LOG.lock();
                            log.push(receipt);
                        }
                        #[cfg(feature = "spore")]
                        {
                            let mut derived = parent_snapshot;
                            derived.energy = crate::constants::MITOSIS_COST / 2;
                            derived.phase = derived.phase.wrapping_add(128)
                                & ((1 << self.topology.q_phase) - 1);
                            let seed = crate::math::xorshift32_once(parent_snapshot.genome);
                            let index = (seed & 0xFF) as usize;
                            derived.genome ^= crate::math::MUTATION_LUT[index];
                            let child = &mut *self.minimal_agents_ptr.add(next_dead_idx);
                            *child = derived;
                        }

                        replications += 1;
                    }
                }
            }
            self.signals.total_energy = core::cmp::min(sum_energy, u32::MAX as u64) as u32;

            // Re-arm the reaper's diff to include this reproduction.
            //
            // The reaper books every ATP that left the population between two
            // sweeps as dissipation. Mitosis moves ATP too — parent down,
            // child up, erasure tax to the trace — and it already books its own
            // tax. Leaving the snapshot at its pre-mitosis state would make the
            // next sweep read that tax a second time as unexplained loss, so
            // the ledger would drift upward by exactly the amount it had
            // already recorded correctly.
            let mut shadow = crate::SHADOW_LATTICE_MEMORY.lock();
            let snapshot = if self.tick_snapshot_ptr.is_null() {
                shadow.as_mut_ptr()
            } else {
                self.tick_snapshot_ptr
            };
            core::ptr::copy_nonoverlapping(self.minimal_agents_ptr, snapshot, active);
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
        let skip = if active == 0 {
            1
        } else {
            core::cmp::max(1, active / 32)
        };

        unsafe {
            for i in (0..active).step_by(skip) {
                let agent = &*(self.minimal_agents_ptr.add(i));
                hash = hash.wrapping_add(agent.phase).wrapping_mul(31);
                hash ^= agent.energy;
            }
        }

        // Φ-Маніфест: публікуємо heartbeat у phi buffer
        let tick = self.signals.proper_time.causal_ticks;
        let heartbeat = crate::phi_protocol::PhiMessage::encode_heartbeat(
            hash,
            tick,
            self.topology.q_phase as u8,
        );
        unsafe {
            let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
            buf.push(heartbeat);
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
    use std::vec;
    use std::vec::Vec;

    fn make_lattice(
        agent_count: usize,
    ) -> (
        PhaseLattice,
        Vec<PhaseAgentMinimal>,
        Vec<PhaseAgentMinimal>,
        Vec<DeltaItem>,
    ) {
        make_lattice_with_q_phase(agent_count, 7)
    }

    /// A death booked off-CPU must move the entropy trace exactly once.
    ///
    /// The GPU path's whole failure was silent: the shader flips the dead bit,
    /// nothing else happens, and `total_entropy_released` reads 0 forever while
    /// looking like a working thermodynamic ledger. These tests are the ones
    /// that would have caught it.
    #[test]
    fn reaper_books_an_off_cpu_death_exactly_once() {
        let (mut lattice, mut agents, mut snapshot, _) = make_lattice_with_q_phase(4, 7);
        for a in agents.iter_mut() {
            a.energy = 500;
            a.state_flags = 0;
        }
        snapshot.copy_from_slice(&agents);
        lattice.signals.active_agent_count = 4;

        // An agent starves the way agents actually starve: its energy is nearly
        // spent, the step takes the rest, and the shader flips the dead bit and
        // writes nothing else — exactly what compute_toroidal.wgsl can do.
        agents[2].energy = 5;
        snapshot[2].energy = 5;
        agents[2].energy = 0;
        agents[2].state_flags |= 0x01;
        agents[2].genome = 7;
        agents[2].memory = [1, 2, 3];

        assert_eq!(lattice.signals.total_entropy_released, 0);
        assert_eq!(lattice.reap_off_cpu_deaths(), 1, "one agent died");

        // Two distinct releases land in the same trace, and both belong there:
        //   - 5 ATP of ENERGY that left the population (dissipation), and
        //   - the Landauer cost of the INFORMATION erased with the agent:
        //     set bits of genome + three memory words, not their values —
        //     7 = 0b111 (3), 1 (1), 2 = 0b10 (1), 3 = 0b11 (2) → 7 bits.
        let landauer = 7 * crate::constants::LANDAUER_BIT_COST as u64;
        assert_eq!(
            lattice.signals.total_entropy_released,
            5 + landauer,
            "the trace carries the spent energy AND the erased information"
        );

        // Idempotence: the snapshot is re-armed, so a second sweep with no
        // physics in between must be a no-op rather than a double charge.
        let after_first = lattice.signals.total_entropy_released;
        assert_eq!(lattice.reap_off_cpu_deaths(), 0, "no new deaths");
        assert_eq!(lattice.signals.total_entropy_released, after_first);
    }

    /// Predation must not mint ATP, at any prey energy, for any predator count.
    ///
    /// This is the property the flat rate violated: a prey holding 3 ATP could
    /// only ever lose 3 (the debit saturates), while up to eight predators each
    /// credited themselves 5 — up to 40 ATP conjured from 3, every tick, worst
    /// exactly where the ecosystem was closest to collapse.
    #[test]
    fn predation_cannot_take_more_than_the_prey_holds() {
        // Exhaustive over the whole legal energy range, all neighbour counts.
        for prey_energy in 0..=crate::constants::MAX_ATP {
            let share = PhaseLattice::predation_share(prey_energy);
            for predators in 0..=8u32 {
                assert!(
                    share * predators <= prey_energy,
                    "{predators} predators × {share} exceeds prey energy {prey_energy}"
                );
            }
        }
    }

    #[test]
    fn a_healthy_prey_is_still_worth_the_old_flat_rate() {
        // The law only bites in the starving regime. Above STEAL*8 the prey's
        // per-neighbour capacity clears the flat rate, so a well-fed ecosystem
        // behaves exactly as it did before.
        let steal = crate::constants::PREDATOR_ENERGY_STEAL;
        for prey_energy in (steal * 8)..=crate::constants::MAX_ATP {
            assert_eq!(
                PhaseLattice::predation_share(prey_energy),
                steal,
                "unchanged behaviour expected at {prey_energy} ATP"
            );
        }
        // And a prey with nothing feeds nobody.
        assert_eq!(PhaseLattice::predation_share(0), 0);
    }

    /// Reproduction must not create or destroy ATP.
    ///
    /// This is the closed-balance check the audit said did not exist anywhere in
    /// the tree: the only "energy audit" was `total <= MAX_ATP * alive`, which
    /// cannot fail because every increase site clamps to MAX_ATP and every
    /// decrease saturates — an identity dressed as an invariant.
    #[test]
    fn mitosis_conserves_energy_into_the_child_and_the_entropy_trace() {
        let (mut lattice, mut agents, _snap, _) = make_lattice_with_q_phase(4, 7);
        // One fertile parent, one free slot (index 1 is dead), two bystanders.
        agents[0].energy = crate::constants::MITOSIS_THRESHOLD;
        agents[0].genome = 0x0F0F_0F0F;
        agents[1].energy = 0; // the vacancy
        agents[2].energy = 700;
        agents[3].energy = 800;
        lattice.signals.active_agent_count = 4;

        let before: u64 = agents.iter().map(|a| a.energy as u64).sum();
        let entropy_before = lattice.signals.total_entropy_released;

        assert_eq!(lattice.darwinian_mitosis(), 1, "expected exactly one birth");

        let after: u64 = agents.iter().map(|a| a.energy as u64).sum();
        let released = lattice.signals.total_entropy_released - entropy_before;

        assert_eq!(
            before,
            after + released,
            "every joule the parent spent must land in the child or in the \
             entropy trace — not vanish"
        );
        assert!(released > 0, "a genome mutation always erases some bits");
    }

    /// Reproduction must not be gated on somebody dying first.
    ///
    /// Mitosis places a child in a vacancy. When the Big Bang filled every slot,
    /// the only vacancies were graves — so a world where the sun keeps everyone
    /// alive could never reproduce, and measured at SOLAR_YIELD_Q10 = 18432 it
    /// did not: 1024 alive at tick 1500, the richest agent past the fertility
    /// threshold, zero deaths, zero births.
    #[test]
    fn a_population_grows_into_empty_space_without_anyone_dying() {
        let (mut lattice, mut agents, _s, _d) = make_lattice_with_q_phase(16, 7);
        lattice.signals.max_cells = 16;
        lattice.signals.active_agent_count = 2;
        // Two fertile agents, nobody dead, no vacancy behind them.
        for a in agents.iter_mut().take(2) {
            a.energy = crate::constants::MITOSIS_THRESHOLD;
            a.state_flags = 0;
        }
        agents[0].genome = 0x0F0F_0F0F;
        agents[1].genome = 0x3333_3333;

        let born = lattice.darwinian_mitosis();
        assert_eq!(born, 2, "both fertile parents should reproduce");
        assert_eq!(
            lattice.signals.active_agent_count, 4,
            "the population grew into the empty part of the lattice"
        );
        assert!(agents[2].energy > 0 && agents[3].energy > 0, "children live");
    }

    #[test]
    fn growth_stops_at_carrying_capacity() {
        let (mut lattice, mut agents, _s, _d) = make_lattice_with_q_phase(8, 7);
        // Capacity equals the living count: the world is already as big as the
        // host allocated for, so there is nowhere to put a child and nobody is
        // charged for trying.
        lattice.signals.max_cells = 3;
        lattice.signals.active_agent_count = 3;
        for a in agents.iter_mut().take(3) {
            a.energy = crate::constants::MITOSIS_THRESHOLD;
        }
        let before: u64 = agents.iter().take(3).map(|a| a.energy as u64).sum();

        assert_eq!(lattice.darwinian_mitosis(), 0, "no room, no births");
        assert_eq!(lattice.signals.active_agent_count, 3, "and no growth");
        let after: u64 = agents.iter().take(3).map(|a| a.energy as u64).sum();
        assert_eq!(before, after, "a refused birth is still free");
    }

    /// A full lattice must refuse to reproduce, not charge for a phantom child.
    #[test]
    fn mitosis_on_a_full_lattice_costs_nothing() {
        let (mut lattice, mut agents, _snap, _) = make_lattice_with_q_phase(3, 7);
        // Every slot occupied, and every agent fertile: the old code debited
        // MITOSIS_COST from all three and produced no children at all.
        for a in agents.iter_mut() {
            a.energy = crate::constants::MITOSIS_THRESHOLD;
        }
        lattice.signals.active_agent_count = 3;

        let before: u64 = agents.iter().map(|a| a.energy as u64).sum();
        let entropy_before = lattice.signals.total_entropy_released;

        assert_eq!(lattice.darwinian_mitosis(), 0, "no vacancy, no births");

        let after: u64 = agents.iter().map(|a| a.energy as u64).sum();
        assert_eq!(
            before, after,
            "a refused birth must be free; charging for it deleted 1024 ATP per \
             fertile agent per sweep, silently"
        );
        assert_eq!(lattice.signals.total_entropy_released, entropy_before);
    }

    #[test]
    fn death_entropy_is_bounded_and_priced_in_bits_like_the_rest_of_the_kernel() {
        // The bound is the whole point: an agent is 128 bits of information, so
        // dissolving one can never release more than 128 * LANDAUER_BIT_COST.
        // The old formula summed the words as numbers, so one death could
        // release ~1.7e10 into a universe capped at MAX_ATP per agent — a
        // different unit wearing the same name, and an unbounded faucet for any
        // future that draws ATP back out of the entropy pool.
        let mut a = PhaseAgentMinimal::default();
        a.genome = u32::MAX;
        a.memory = [u32::MAX; 3];
        let max = PhaseLattice::death_entropy(&a);
        assert_eq!(max, 128 * crate::constants::LANDAUER_BIT_COST as u64);
        assert!(
            max <= crate::constants::MAX_ATP as u64,
            "a single death must not out-mass an agent's entire ATP capacity"
        );

        let mut zero = PhaseAgentMinimal::default();
        zero.genome = 0;
        zero.memory = [0; 3];
        assert_eq!(
            PhaseLattice::death_entropy(&zero),
            0,
            "an agent carrying no information erases none"
        );
    }

    /// Every agent must be inside the torus, including the last row.
    ///
    /// `h` used to floor `active / w`, so when the population was not a multiple
    /// of the row width the agents in `[h*w, active)` sat OUTSIDE the grid:
    /// `wrap_index_2d` could never return their indices, so they read eight
    /// neighbours and were the neighbour of nobody. Every joule they drew by
    /// conduction or predation came from a counterparty that never paid it —
    /// energy minted from a rounding error in the geometry.
    ///
    /// Rare once, generic now: growth increments `active_agent_count` by one per
    /// birth, so an exact multiple of the row width is the exception.
    #[test]
    fn every_living_agent_is_reachable_as_somebody_s_neighbour() {
        // NOT an energy assertion. The obvious one — sum before == sum after +
        // released — is vacuous here: the dissipation ledger books exactly that
        // difference, so the identity holds whatever the geometry does. It has
        // to be checked structurally.
        //
        // `wrap_index_2d` returns `wy * w + wx` with wy in [0,h) and wx in
        // [0,w), so the set of indices any agent can ever see is [0, h*w). An
        // agent at an index outside that set reads eight neighbours and is the
        // neighbour of nobody: it draws energy from counterparties that never
        // pay it. Conservation therefore requires h*w >= active.
        for &active in &[1u32, 7, 8, 9, 20, 63, 64, 65, 1000, 4095, 4096] {
            for q_radial in 0u32..8 {
                let w = (1i32 << q_radial).max(1);
                let h = PhaseLattice::grid_rows(active, w);
                assert!(
                    (h as i64) * (w as i64) >= active as i64,
                    "agents past index {} are outside the torus (active={active}, w={w}, h={h})",
                    h * w
                );
            }
        }
    }

    /// The sun is a source, and it is a counted one.
    ///
    /// Before this law `sun_multiplier` only ever multiplied BURN — it made
    /// agents hungrier at noon and fed nobody, while the shader's comment beside
    /// it claimed "energy is strictly zero-sum except for solar input". The
    /// world was closed, and a closed world cannot host life: measured, 1024
    /// agents went extinct at tick 86 with zero births, because total energy can
    /// only fall and no agent can climb to MITOSIS_THRESHOLD.
    #[test]
    fn the_sun_pays_by_day_and_nothing_by_night() {
        // Day: causal_ticks 0 → day_phase 0 → sun_multiplier 1024 (neutral).
        let (mut lattice, mut agents, _s, _d) = make_lattice_with_q_phase(1, 7);
        lattice.signals.active_agent_count = 1;
        agents[0].energy = 100;
        agents[0].genome = 0; // lowest possible maintenance
        lattice.signals.proper_time.causal_ticks = 0;
        lattice.tick_physics();
        let day_income = lattice.signals.total_solar_input;
        assert!(day_income > 0, "a lit agent must be paid");

        // Night: day_phase 192 → sin_q10 = -1024 → sun_multiplier 0.
        let (mut night, mut nagents, _s2, _d2) = make_lattice_with_q_phase(1, 7);
        night.signals.active_agent_count = 1;
        nagents[0].energy = 100;
        nagents[0].genome = 0;
        night.signals.proper_time.causal_ticks = 768;
        night.tick_physics();
        assert_eq!(
            night.signals.total_solar_input, 0,
            "nothing enters the world after dark"
        );
    }

    /// Income must be COUNTED, or it is indistinguishable from a leak running
    /// backwards — and the dissipation ledger silently loses the gross burn on
    /// every tick the sun outpaces metabolism.
    #[test]
    fn an_open_world_still_closes_its_books() {
        let (mut lattice, mut agents, _s, _d) = make_lattice_with_q_phase(8, 7);
        for (i, a) in agents.iter_mut().enumerate() {
            a.energy = 400;
            a.genome = 0x0505_0505u32.wrapping_mul(i as u32 + 1);
            a.state_flags = 0;
        }
        lattice.signals.active_agent_count = 8;
        lattice.signals.total_energy = 3200;

        let before: u64 = agents.iter().map(|a| a.energy as u64).sum();
        for _ in 0..24 {
            lattice.tick_physics();
        }
        let after: u64 = agents.iter().map(|a| a.energy as u64).sum();

        // start + solar == end + spent, and the trace carries at least `spent`
        // (it also holds Landauer terms for anything that died).
        let solar = lattice.signals.total_solar_input as u64;
        let spent = before + solar - after;
        assert!(
            lattice.signals.total_entropy_released >= spent,
            "open-system books do not close: {} in, {} held, {} spent, {} booked",
            solar,
            after,
            spent,
            lattice.signals.total_entropy_released
        );
    }

    /// Both substrates must keep the SAME books, or the trace means whichever
    /// path happened to run.
    ///
    /// `tick_physics` used to book only the Landauer term and let metabolic burn
    /// leave unrecorded. Measured by tools/ecology_probe.ts before the fix: a
    /// 1024-agent run dissipated 609,237 ATP through burn and reported 47,586 —
    /// the information terms alone — so 93% of the universe left the ledger
    /// silently while the number still looked plausible.
    #[test]
    fn tick_physics_books_the_burn_it_spends() {
        let (mut lattice, mut agents, _snap, _) = make_lattice_with_q_phase(8, 7);
        for (i, a) in agents.iter_mut().enumerate() {
            a.energy = 900;
            a.genome = 0x1111_1111u32.wrapping_mul(i as u32 + 1);
            a.state_flags = 0;
        }
        lattice.signals.active_agent_count = 8;
        lattice.signals.total_energy = 7200;
        // MIDNIGHT — the world is open now, and by day photosynthesis outpaces
        // metabolism, so there is no net cost to observe. The gross burn this
        // test is about only shows as a drop when nothing is coming in.
        lattice.signals.proper_time.causal_ticks = 768;

        let before: u64 = agents.iter().map(|a| a.energy as u64).sum();
        lattice.tick_physics();
        let after: u64 = agents.iter().map(|a| a.energy as u64).sum();

        assert!(after < before, "a tick must cost the population something");
        assert!(
            lattice.signals.total_entropy_released >= before - after,
            "energy left the population without reaching the trace: {} spent, \
             {} booked",
            before - after,
            lattice.signals.total_entropy_released
        );
    }

    /// The boundary ledger: what the substrate burned, and never a mint.
    #[test]
    fn the_reaper_books_dissipation_but_never_a_mint() {
        let (mut lattice, mut agents, mut snapshot, _) = make_lattice_with_q_phase(4, 7);
        for a in agents.iter_mut() {
            a.energy = 1000;
            a.state_flags = 0;
        }
        snapshot.copy_from_slice(&agents);
        lattice.signals.active_agent_count = 4;

        // A step happened elsewhere (the GPU): metabolism took some ATP, and a
        // transfer moved some between two agents. Only the burn left the
        // population; the transfer is internal and must not register.
        agents[0].energy = 990; // burned 10
        agents[1].energy = 970; // burned 10, gave 20
        agents[2].energy = 1020; // received 20
        agents[3].energy = 995; // burned 5
        let expected_dissipation = 25u64;

        lattice.reap_off_cpu_deaths();
        assert_eq!(
            lattice.signals.total_entropy_released, expected_dissipation,
            "the trace must carry the burn and ignore the transfer"
        );

        // Idempotence: the diff is re-armed, so a second sweep books nothing.
        lattice.reap_off_cpu_deaths();
        assert_eq!(lattice.signals.total_entropy_released, expected_dissipation);

        // A RISE must not be absorbed. Energy from nowhere is a defect, and a
        // ledger that quietly balanced it would be the tautology this whole
        // exercise replaced.
        for a in agents.iter_mut() {
            a.energy += 500;
        }
        lattice.reap_off_cpu_deaths();
        assert_eq!(
            lattice.signals.total_entropy_released, expected_dissipation,
            "a mint is not negative entropy — the trace must stay put"
        );
    }

    /// Reproduction runs after the reaper, so its own erasure tax must not be
    /// re-read as unexplained loss on the following sweep.
    #[test]
    fn mitosis_does_not_leak_into_the_next_dissipation_sweep() {
        let (mut lattice, mut agents, mut snapshot, _) = make_lattice_with_q_phase(4, 7);
        agents[0].energy = crate::constants::MITOSIS_THRESHOLD;
        agents[0].genome = 0x0F0F_0F0F;
        agents[1].energy = 0;
        agents[2].energy = 700;
        agents[3].energy = 800;
        snapshot.copy_from_slice(&agents);
        lattice.signals.active_agent_count = 4;

        lattice.reap_off_cpu_deaths(); // nothing happened yet
        let baseline = lattice.signals.total_entropy_released;

        assert_eq!(lattice.darwinian_mitosis(), 1);
        let after_birth = lattice.signals.total_entropy_released;
        assert!(after_birth > baseline, "the erasure tax was booked");

        // No physics between: the next sweep must find nothing to book.
        lattice.reap_off_cpu_deaths();
        assert_eq!(
            lattice.signals.total_entropy_released, after_birth,
            "the mitosis tax was counted twice — the snapshot was left stale"
        );
    }

    #[test]
    fn reaper_republishes_the_aggregates_the_shader_cannot_write() {
        let (mut lattice, mut agents, mut snapshot, _) = make_lattice_with_q_phase(4, 7);
        for a in agents.iter_mut() {
            a.energy = 100;
            a.state_flags = 0;
        }
        snapshot.copy_from_slice(&agents);
        lattice.signals.active_agent_count = 4;
        lattice.signals.total_energy = 0; // as it is on the GPU path: never written

        agents[3].energy = 0;
        agents[3].state_flags |= 0x01;

        lattice.reap_off_cpu_deaths();
        assert_eq!(
            lattice.signals.total_energy, 300,
            "three survivors at 100 ATP each"
        );
        assert_eq!(
            lattice.signals.active_agent_count, 3,
            "high-water mark drops to the highest live index + 1"
        );
    }

    #[test]
    fn reaper_is_actually_looking_at_something() {
        // Guard against the sweep silently doing nothing (null ptr, zero count,
        // a predicate that never matches) and reading as a clean run.
        let (mut lattice, mut agents, mut snapshot, _) = make_lattice_with_q_phase(2, 7);
        for a in agents.iter_mut() {
            a.energy = 10;
            a.state_flags = 0;
        }
        snapshot.copy_from_slice(&agents);
        lattice.signals.active_agent_count = 2;
        agents[0].energy = 0;
        agents[0].state_flags |= 0x01;
        agents[0].genome = 0xFF;
        assert!(
            lattice.reap_off_cpu_deaths() > 0,
            "a staged death produced no booking — the sweep is inert"
        );
    }

    fn make_lattice_with_q_phase(
        agent_count: usize,
        q_phase: u32,
    ) -> (
        PhaseLattice,
        Vec<PhaseAgentMinimal>,
        Vec<PhaseAgentMinimal>,
        Vec<DeltaItem>,
    ) {
        let mut agents = vec![PhaseAgentMinimal::default(); agent_count];
        let mut snapshot = vec![PhaseAgentMinimal::default(); agent_count];
        let deltas = vec![
            DeltaItem {
                index: 0,
                phase: 0,
                energy: 0,
                genome: 0
            };
            100
        ];
        let topology = PhaseTopology::new(q_phase, 7, 6, 20);
        let mut lattice = PhaseLattice::new_from_host_memory(
            topology,
            core::ptr::null_mut(),
            agents.as_mut_ptr(),
        );
        lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
        lattice.signals.max_cells = agent_count as u32;
        (lattice, agents, snapshot, deltas)
    }

    #[test]
    fn test_ignite_big_bang_populates() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(100);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.ignite_big_bang(12345, 50);

        // The argument is CAPACITY, not the living count. Ignition seeds a
        // fraction and leaves the rest empty, because mitosis needs somewhere to
        // put a child — a universe that starts full can never grow, and once the
        // sun made starvation rare it could never reproduce either.
        assert_eq!(lattice.signals.max_cells, 50, "capacity is what was asked for");
        assert_eq!(
            lattice.signals.active_agent_count,
            50 * crate::constants::BIG_BANG_SEED_DENSITY_Q10 / 1024,
            "life is seeded into a fraction of the room"
        );
        assert!(
            lattice.signals.active_agent_count < lattice.signals.max_cells,
            "the Big Bang must leave the world somewhere to grow"
        );
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
        assert_eq!(agents[0].energy, 1976); // Parent lost 1024 ATP (MAX_ATP / 4)
        assert!(agents[1].energy > 0); // Child resurrected
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
                deltas.len(),
            )
        };
        assert!(
            count > 0,
            "Initial population should diverge from zeroed snapshot"
        );

        // Second run should yield zero deltas because snapshot was synchronized
        let count2 = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                deltas.len(),
            )
        };
        assert_eq!(count2, 0, "No divergence after snapshot sync");
    }

    #[test]
    fn test_tick_physics_increments_proper_time() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 1;
        agents[0].energy = 1000;
        assert_eq!(lattice.signals.proper_time.causal_ticks, 0);
        lattice.tick_physics();
        assert!(lattice.signals.proper_time.causal_ticks > 0);
        let t1 = lattice.signals.proper_time.causal_ticks;
        lattice.tick_physics();
        assert!(lattice.signals.proper_time.causal_ticks > t1);
    }

    #[test]
    fn test_birth_tick_age_invariant() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        // ignite_big_bang sets birth_tick[i] = causal_ticks for every live agent
        lattice.ignite_big_bang(12345, 5);
        let birth0 = {
            let ticks = crate::BIRTH_TICKS.lock();
            ticks[0]
        };
        let ticks_before = lattice.signals.proper_time.causal_ticks;
        assert_eq!(
            birth0, ticks_before,
            "birth tick must be set to causal_ticks at ignition"
        );

        // Tick physics 7 times → causal_ticks advances (amount depends on chronotopology dilation)
        for _ in 0..7 {
            lattice.tick_physics();
        }
        let birth0_after = {
            let ticks = crate::BIRTH_TICKS.lock();
            ticks[0]
        };
        let age = lattice
            .signals
            .proper_time
            .causal_ticks
            .saturating_sub(birth0_after);
        let elapsed = lattice
            .signals
            .proper_time
            .causal_ticks
            .saturating_sub(ticks_before);
        assert_eq!(
            age, elapsed,
            "age must equal elapsed causal ticks since birth; birth tick must be immutable"
        );

        // Mitosis: child gets fresh birth tick at parent tick
        // Use a minimal lattice so next_dead_idx is guaranteed to be 1
        let (mut lattice2, mut agents2, _snapshot2, _deltas2) = make_lattice(2);
        lattice2.minimal_agents_ptr = agents2.as_mut_ptr();
        lattice2.signals.active_agent_count = 2;
        lattice2.signals.proper_time.causal_ticks = 999;
        agents2[0].energy = crate::constants::MITOSIS_THRESHOLD + 100;
        agents2[1].energy = 0;
        {
            let mut ticks = crate::BIRTH_TICKS.lock();
            ticks[0] = 100;
            ticks[1] = 0;
        }
        let parent_tick = lattice2.signals.proper_time.causal_ticks;
        let reps = lattice2.darwinian_mitosis();
        assert_eq!(reps, 1, "mitosis must occur");
        let child_birth = {
            let ticks = crate::BIRTH_TICKS.lock();
            ticks[1]
        };
        assert_eq!(
            child_birth, parent_tick,
            "child birth tick must be set to causal_ticks at mitosis"
        );
        assert!(agents2[1].energy > 0, "child must be alive");
    }

    #[test]
    fn test_set_environment_sets_dirty_flag() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.set_environment(5, 4, 0, 1024);
        assert_eq!(lattice.topology.q_sectors, 5);
        assert_eq!(lattice.topology.q_radial, 4);
        assert!(lattice.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED != 0);
    }

    #[test]
    fn test_ignite_epigenetic_big_bang() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(100);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        let memory = crate::epigenetics::EpigeneticMemory::new();
        lattice.ignite_epigenetic_big_bang(42, 50, &memory, &[0xAA, 0xBB]);
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
        assert_eq!(
            agents[1].phase, expected_phase,
            "Child should be at opposite phase (π offset)"
        );
    }

    #[test]
    #[cfg(not(feature = "spore"))]
    fn test_mitosis_recursive_birth_near_attractor() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        agents[0].energy = 3000;
        agents[0].phase = 50;
        agents[0].genome = 0xDEADBEEF;
        agents[1].energy = 0;

        // Inject an attractor near the parent's phase
        unsafe {
            let mut arr = crate::ATTRACTOR_ARRAY.lock();
            arr.count = 1;
            arr.data[0] = crate::attractor::AttractorMatrix::new(50, !50, 10, 512);
        }

        lattice.darwinian_mitosis();

        // Child should inherit XOR-mutated genome with attractor.matrix
        let expected_genome = 0xDEADBEEF ^ 50;
        assert_eq!(
            agents[1].genome, expected_genome,
            "Child genome should be XOR-mutated with attractor.matrix"
        );
        assert_eq!(
            agents[1].memory[0], 50,
            "Child memory_x should hold parentHash (attractor.matrix)"
        );
        assert!(
            agents[1].state_flags & 0x0100_0000 != 0,
            "Child state_flags should have birth-near-attractor bit"
        );

        // Cleanup global state for other tests
        unsafe {
            let mut arr = crate::ATTRACTOR_ARRAY.lock();
            arr.clear();
        }
    }

    #[test]
    fn test_delta_snapshot_respects_max_deltas() {
        let (mut lattice, mut agents, mut snapshot, mut deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        // Ignite with capacity 40 so the seeded quarter is the 10 agents this
        // test needs changed; the argument is capacity, not the living count.
        lattice.ignite_big_bang(99, 40);
        assert_eq!(lattice.signals.active_agent_count, 10, "seeded population");
        // Limit deltas to 3 — only first 3 changes should be reported
        let count = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                3,
            )
        };
        assert_eq!(
            count, 3,
            "Should cap at max_deltas even if more agents changed"
        );
        // Snapshot should still be synchronized for ALL changed agents (not just first 3)
        let count2 = unsafe {
            lattice.generate_delta_snapshot(
                agents.as_ptr(),
                snapshot.as_mut_ptr(),
                deltas.as_mut_ptr(),
                deltas.len(),
            )
        };
        assert_eq!(
            count2, 0,
            "All agents should be synced after first call, even those beyond max_deltas"
        );
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
                deltas.len(),
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
        agents[0].genome = 128; // phenotypic efficiency 128 = base burn
        // MIDNIGHT. This world is open now — photosynthesis pays every living
        // agent `SOLAR_YIELD_Q10 * sun_multiplier`, and at the default
        // causal_ticks of 0 the sun sits at neutral, so a low-burn agent GAINS
        // and there is no decay to observe. Decay is a nocturnal fact here.
        // day_phase = causal_ticks / 4, and sin_q10(0, 192) = -1024, so
        // sun_multiplier = 1024 - 1024 = 0: no income, pure metabolism.
        lattice.signals.proper_time.causal_ticks = 768;
        let before = agents[0].energy;
        lattice.tick_physics();
        assert!(
            agents[0].energy < before,
            "energy must still decay when the sun is down"
        );
    }

    #[test]
    fn test_tick_physics_phase_drift() {
        // Single agent: no neighbors -> coupling = 0, only drift remains
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(1);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 1;
        agents[0].phase = 100;
        // base_freq is Q10 — 1024 is one phase unit per tick. It always was:
        // ignition writes `(...) * BB_FREQ_Q_SCALE`. What changed is that the
        // Nyquist clamp now reads it in those units instead of raw ones, so a
        // bare `10` is 10/1024 of a phase unit and correctly moves nothing.
        agents[0].base_freq = 10 * crate::constants::MATH_Q_SCALE;
        agents[0].energy = 1000;
        let before = agents[0].phase;
        lattice.tick_physics();
        // With Vector 11 (alpha = 64), a single agent wraps around and touches itself.
        // The phase lag causes it to self-couple: sin(Ψ - Ψ - α) = sin(-α)
        // This adds a constant deterministic torque to lone agents.
        let expected = agents[0].phase; // we will just assert it drifted deterministically
        assert_ne!(
            before, expected,
            "Phase should drift due to base_freq and self-coupling alpha"
        );
    }

    #[test]
    fn test_tick_physics_kuramoto_coupling() {
        // Kuramoto's actual claim is that a coupled population CONVERGES, so
        // that is what this asserts. It used to assert "agent 0's phase changed
        // after one tick", which passed only because the coupling term carried
        // an extra factor of 1024 and displaced agents by a quarter of the
        // phase space every tick — the very pathology that kept the order
        // parameter at 0.02. Correctly scaled, coupling is a small pull toward
        // the neighbourhood mean: two agents in a three-slot lattice produce a
        // sub-unit mean field that truncates to nothing, and rightly so.
        const N: usize = 256;
        let (mut lattice, mut agents, mut snapshot, _deltas) = make_lattice_with_q_phase(N, 7);
        lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
        lattice.signals.active_agent_count = N as u32;
        lattice.signals.max_cells = N as u32;

        // Ignite rather than hand-seed: the Big Bang gives agents genomes, and
        // genome drives both the coupling gain (p_radius) and the metabolism.
        // A lattice of identical zero genomes is a degenerate fixture that sits
        // at a fixed point and would make this assertion untestable rather than
        // false.
        lattice.ignite_big_bang(0x51ED_2701, N as u32);
        let active = lattice.signals.active_agent_count as usize;
        for a in agents.iter_mut().take(active) {
            a.base_freq = 0; // isolate coupling from natural frequency
        }

        // Order parameter |mean(e^{iθ})|, in the agents' own 128-unit wrap.
        let order = |ags: &[PhaseAgentMinimal]| -> f64 {
            let (mut c, mut s, mut k) = (0.0f64, 0.0f64, 0.0f64);
            for a in ags.iter().take(active) {
                if a.energy == 0 || a.state_flags & 0x01 != 0 {
                    continue;
                }
                let th = (a.phase as f64 / 128.0) * core::f64::consts::TAU;
                c += th.cos();
                s += th.sin();
                k += 1.0;
            }
            if k == 0.0 { 0.0 } else { ((c / k).powi(2) + (s / k).powi(2)).sqrt() }
        };

        let before = order(&agents);
        // Convergence is gradual by design now; 400 ticks is not enough to
        // clear the noise floor, and asserting on a horizon shorter than the
        // process would just be a slow way of testing nothing.
        for _ in 0..2500 {
            lattice.tick_physics();
        }
        let after = order(&agents);

        assert!(
            after > before + 0.1,
            "a coupled population must converge: order {before:.3} -> {after:.3}"
        );
    }

    #[test]
    fn test_tick_physics_dirty_flags_cleared() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(1);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.dirty_flags = SIGNAL_TOPOLOGY_CHANGED | SIGNAL_CONSENSUS_SHIFT;
        lattice.tick_physics();
        assert_eq!(
            lattice.signals.dirty_flags & SIGNAL_TOPOLOGY_CHANGED,
            0,
            "TOPOLOGY_CHANGED should be cleared"
        );
        assert_eq!(
            lattice.signals.dirty_flags & SIGNAL_CONSENSUS_SHIFT,
            0,
            "CONSENSUS_SHIFT should be cleared"
        );
    }

    #[test]
    fn test_tick_physics_energy_non_negative() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(10);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 10;
        // Mix of alive and dead agents
        agents[0].energy = 1;
        agents[0].phase = 1;
        agents[1].energy = 0;
        agents[1].phase = 0;
        agents[2].energy = 4000;
        agents[2].phase = 63; // resonance trigger
        lattice.tick_physics();
        for i in 0..10 {
            assert!(
                agents[i].energy <= crate::constants::MAX_ATP,
                "Agent {} energy {} exceeds MAX_ATP {}",
                i,
                agents[i].energy,
                crate::constants::MAX_ATP
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
            assert!(
                agents[i].phase <= mask,
                "q_phase=2: phase must be in [0, {}]",
                mask
            );
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
            assert!(
                agents[i].phase <= mask,
                "q_phase=5: phase must be in [0, {}]",
                mask
            );
        }
    }

    #[test]
    fn test_tick_physics_determinism_q5() {
        let (mut lattice1, mut agents1, _snapshot, _deltas) = make_lattice_with_q_phase(20, 5);
        lattice1.minimal_agents_ptr = agents1.as_mut_ptr();
        lattice1.signals.active_agent_count = 20;
        lattice1.ignite_big_bang(77, 20);
        for _ in 0..10 {
            lattice1.tick_physics();
        }

        let (mut lattice2, mut agents2, _snapshot, _deltas) = make_lattice_with_q_phase(20, 5);
        lattice2.minimal_agents_ptr = agents2.as_mut_ptr();
        lattice2.signals.active_agent_count = 20;
        lattice2.ignite_big_bang(77, 20);
        for _ in 0..10 {
            lattice2.tick_physics();
        }

        for i in 0..20 {
            assert_eq!(
                agents1[i].phase, agents2[i].phase,
                "Determinism failed at agent {} (phase)",
                i
            );
            assert_eq!(
                agents1[i].energy, agents2[i].energy,
                "Determinism failed at agent {} (energy)",
                i
            );
            assert_eq!(
                agents1[i].genome, agents2[i].genome,
                "Determinism failed at agent {} (genome)",
                i
            );
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
                "Agent {} phase {} out of range [0, {}]",
                i,
                agents[i].phase,
                mask
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
            assert!(
                agents[i].state_flags & 0x01 != 0,
                "Dead agent {} should have death flag set",
                i
            );
        }
    }

    #[test]
    fn test_tick_physics_compost_published() {
        let (mut lattice, mut agents, _snapshot, _deltas) = make_lattice(3);
        lattice.minimal_agents_ptr = agents.as_mut_ptr();
        lattice.signals.active_agent_count = 3;
        // MIDNIGHT — see test_tick_physics_energy_decay. With the sun up, an
        // agent holding 1 ATP is fed rather than composted, so the death this
        // test exists to observe simply does not happen. Starvation needs night.
        lattice.signals.proper_time.causal_ticks = 768;
        // Agent 0 will die in one tick (energy = 1)
        agents[0].energy = 1;
        agents[0].state_flags = 0;
        agents[0].genome = 0xDEADBEEF;
        agents[1].energy = 0;
        agents[1].state_flags = 0;
        agents[2].energy = 0;
        agents[2].state_flags = 0;

        // Clear phi buffer before test
        unsafe {
            let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
            buf.reset();
        }

        lattice.tick_physics();

        unsafe {
            let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
            let len = buf.len();
            assert!(len > 0, "At least one compost message should be published");

            let mut found = false;
            for n in 0..(buf.len() as usize) {
                let msg = buf.peek_nth(n).unwrap();
                if msg.msg_type != crate::phi_protocol::PHI_MSG_COMPOST {
                    continue;
                }
                let (genome, agent_id) = msg.decode_compost().unwrap();
                if genome == 0xDEADBEEF && agent_id < 3 {
                    found = true;
                    break;
                }
            }
            assert!(found, "Compost should preserve agent genome");
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
            agents[i].base_freq = ((i as i32 * crate::constants::BB_FREQ_STEP)
                % crate::constants::BB_FREQ_RANGE as i32)
                - crate::constants::BB_FREQ_OFFSET;
        }
        let start = std::time::Instant::now();
        for _ in 0..10 {
            lattice.tick_physics();
        }
        let elapsed = start.elapsed();
        let ns_per_agent = elapsed.as_nanos() / (agent_count as u128 * 10);
        println!(
            "\n[BENCH] tick_physics: {} agents × 10 ticks in {:?}",
            agent_count, elapsed
        );
        println!("[BENCH] ~{} ns per agent per tick", ns_per_agent);
        assert!(
            elapsed.as_secs() < 5,
            "tick_physics too slow: {:?}",
            elapsed
        );
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
            agents[i].base_freq = ((i as i32 * crate::constants::BB_FREQ_STEP)
                % crate::constants::BB_FREQ_RANGE as i32)
                - crate::constants::BB_FREQ_OFFSET;
        }
        let start = std::time::Instant::now();
        lattice.tick_physics();
        let elapsed = start.elapsed();
        let ns_per_agent = elapsed.as_nanos() / agent_count as u128;
        println!(
            "\n[BENCH] tick_physics: {} agents × 1 tick in {:?}",
            agent_count, elapsed
        );
        println!("[BENCH] ~{} ns per agent per tick", ns_per_agent);
        assert!(
            elapsed.as_secs() < 2,
            "tick_physics too slow for 1M: {:?}",
            elapsed
        );
    }

    #[test]
    fn test_tick_physics_determinism() {
        // Run two identical lattices independently — results must match bit-for-bit.
        // Keep the snapshot + delta buffers IN `setups`: each lattice holds raw
        // pointers into them (tick_snapshot_ptr), so dropping them before
        // tick_physics is a use-after-free. The earlier bare-`_` discard freed
        // them at the binding and aborted on glibc ("unaligned tcache chunk") /
        // under ASAN (heap-use-after-free in tick_physics' copy_nonoverlapping).
        let mut setups: [(
            PhaseLattice,
            Vec<PhaseAgentMinimal>,
            Vec<PhaseAgentMinimal>,
            Vec<DeltaItem>,
        ); 2] = {
            let (l1, a1, s1, d1) = make_lattice(8);
            let (l2, a2, s2, d2) = make_lattice(8);
            [(l1, a1, s1, d1), (l2, a2, s2, d2)]
        };

        for (ref mut lattice, ref mut agents, ref mut _snapshot, ref mut _deltas) in &mut setups {
            lattice.minimal_agents_ptr = agents.as_mut_ptr();
            lattice.signals.active_agent_count = 8;
            for i in 0..8 {
                agents[i].phase = (i * 17) as u32;
                agents[i].energy = 800;
                agents[i].base_freq = (i as i32) * 5000;
            }
            lattice.tick_physics();
        }

        let (_, ref agents1, _, _) = setups[0];
        let (_, ref agents2, _, _) = setups[1];
        for i in 0..8 {
            assert_eq!(
                agents1[i].phase, agents2[i].phase,
                "Phase must be deterministic"
            );
            assert_eq!(
                agents1[i].energy, agents2[i].energy,
                "Energy must be deterministic"
            );
            assert_eq!(
                agents1[i].base_freq, agents2[i].base_freq,
                "Base freq must be deterministic"
            );
        }
    }
}
