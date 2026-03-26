use wasm_bindgen::prelude::*;
use crate::constants::*;
use crate::fixed_point::*;
use crate::utils::*;


#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct WasmPhysicsGenome {
    pub id: u64,
    pub coupling_k: i32,
    pub mutation_rate: i32,
    pub diffusion_rate: i32,
    pub scope_radius: i32,
    pub center_sector: u32,
    pub center_rho: u32,
    pub ttl: u32,
    pub active: u8,
    pub padding: [u8; 3], // 40-byte aligned
}

#[repr(C)]
#[derive(Clone)]
pub struct SubstrateHeader {
    pub magic: [u8; 4],
    pub version: u32,
    pub sectors: u32,
    pub radial_bins: u32,
    pub harmonics: u32,
    pub max_atoms: u32,
    pub damping_base: i32,
    
    // Physics Parameters (Evolutionary Mechanics)
    pub kuramoto_base: i32,
    pub kuramoto_harmonic_peer: i32,
    pub kuramoto_antipode: i32,
    pub kuramoto_threshold_lock: i32,
    pub kuramoto_threshold_high: i32,
    pub kuramoto_adoption_resonance: i32,
    pub kuramoto_antipode_alignment: i32,
    pub kuramoto_plasmid: i32,
    pub kuramoto_diffusion_rate: i32,
    
    // Biological Parameters (Somatic Economy)
    pub mutation_base_cost: i32,
    pub mutation_min_cost: i32,
    pub mutation_max_cost: i32,
    pub mutation_smoothing_factor: i32,
    pub senate_min_locks: i32,
    pub senate_min_energy: i32,
    
    // Adaptive Phase Biology (Phase 12 ESP)
    pub biology_apa_learning_rate: i32,
    pub biology_apa_memory_gain: i32,
    pub biology_apa_decision_cost: i32,
    pub biology_apa_coherence_reward: i32,
    pub biology_apa_memory_decay: i32,
    
    pub padding: [u8; 148], // Adjusted padding to maintain exactly 256 bytes total
}

impl Default for SubstrateHeader {
    fn default() -> Self {
        SubstrateHeader {
            magic: [b'O', b'M', b'G', b'A'],
            version: 71,
            sectors: 0,
            radial_bins: 0,
            harmonics: 0,
            max_atoms: 0,
            damping_base: 0,
            kuramoto_base: 0,
            kuramoto_harmonic_peer: 0,
            kuramoto_antipode: 0,
            kuramoto_threshold_lock: 0,
            kuramoto_threshold_high: 0,
            kuramoto_adoption_resonance: 0,
            kuramoto_antipode_alignment: 0,
            kuramoto_plasmid: 0,
            kuramoto_diffusion_rate: 0,
            mutation_base_cost: 0,
            mutation_min_cost: 0,
            mutation_max_cost: 0,
            mutation_smoothing_factor: 0,
            senate_min_locks: 0,
            senate_min_energy: 0,
            biology_apa_learning_rate: 0,
            biology_apa_memory_gain: 0,
            biology_apa_decision_cost: 0,
            biology_apa_coherence_reward: 0,
            biology_apa_memory_decay: 0,
            padding: [0; 148],
        }
    }
}

#[wasm_bindgen]
#[derive(Clone)]
#[repr(C)]
pub struct PhaseLatticeField {
    pub tau_depth: u32,
    pub current_tau: u32,
    pub sectors: u32,
    pub radial_bins: u32,
    pub harmonics: u32,
    pub(crate) header: SubstrateHeader,
    pub(crate) agents: Vec<crate::granite::PhaseAgent>,
    pub(crate) canary_1: u32,
    pub(crate) oracle_requests: Vec<u32>,
    pub(crate) oracle_request_count: u32,
    pub(crate) canary_2: u32,
    pub(crate) cell_status: Vec<u8>,
    pub(crate) plasmid_collisions: Vec<u64>,
    pub(crate) collision_count: u32,
    pub(crate) active_genomes: [WasmPhysicsGenome; 16],
    pub(crate) spatial_memory_theta: Vec<u8>,
    pub(crate) spatial_memory_strength: Vec<u8>,
    pub(crate) canary_end: u32,
    pub(crate) internal_tick: u64,
}

#[wasm_bindgen]
impl PhaseLatticeField {
    #[wasm_bindgen(constructor)]
    pub fn new(sectors: u32, radial_bins: u32, harmonics: u32) -> PhaseLatticeField {
        #[cfg(target_arch = "wasm32")]
        console_error_panic_hook::set_once();
        let tau_depth = 4;
        let max_elements = (sectors * radial_bins * harmonics * tau_depth) as usize; 
        let mut field = PhaseLatticeField {
            tau_depth,
            current_tau: 0,
            sectors,
            radial_bins,
            harmonics,
            header: SubstrateHeader {
                sectors,
                radial_bins,
                harmonics,
                max_atoms: max_elements as u32,
                damping_base: 1024,
                kuramoto_base: KURAMOTO_COUPLING_BASE,
                kuramoto_harmonic_peer: KURAMOTO_COUPLING_HARMONIC_PEER,
                kuramoto_antipode: KURAMOTO_COUPLING_ANTIPODE,
                kuramoto_threshold_lock: KURAMOTO_COHERENCE_THRESHOLD_LOCK,
                kuramoto_threshold_high: KURAMOTO_COHERENCE_THRESHOLD_HIGH,
                kuramoto_adoption_resonance: KURAMOTO_ADOPTION_RESONANCE_THRESHOLD,
                kuramoto_antipode_alignment: KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD,
                kuramoto_plasmid: KURAMOTO_COUPLING_PLASMID,
                kuramoto_diffusion_rate: KURAMOTO_PLASMID_DIFFUSION_RATE,
                mutation_base_cost: MUTATION_BASE_COST,
                mutation_min_cost: MUTATION_MIN_COST,
                mutation_max_cost: MUTATION_MAX_COST,
                mutation_smoothing_factor: MUTATION_SMOOTHING_FACTOR,
                senate_min_locks: SENATE_MYCELIUM_MIN_LOCKS,
                senate_min_energy: SENATE_MYCELIUM_MIN_ENERGY,
                biology_apa_learning_rate: BIOLOGY_APA_LEARNING_RATE,
                biology_apa_memory_gain: BIOLOGY_APA_MEMORY_GAIN,
                biology_apa_decision_cost: BIOLOGY_APA_DECISION_COST,
                biology_apa_coherence_reward: BIOLOGY_APA_COHERENCE_REWARD,
                biology_apa_memory_decay: BIOLOGY_APA_MEMORY_DECAY,
                ..Default::default()
            },
            agents: vec![crate::granite::PhaseAgent::default(); max_elements],
            canary_1: 0xDEADBEEF,
            oracle_requests: vec![0; 1024],
            oracle_request_count: 0,
            canary_2: 0xDEADBEEF,
            cell_status: vec![0; max_elements],
            plasmid_collisions: vec![0; 1024 * 3],
            collision_count: 0,
            active_genomes: [WasmPhysicsGenome::default(); 16],
            spatial_memory_theta: vec![0; (sectors * radial_bins * harmonics) as usize],
            spatial_memory_strength: vec![0; (sectors * radial_bins * harmonics) as usize],
            canary_end: 0xDEADBEEF,
            internal_tick: 0,
        };
        field.seed_deterministic();
        field
    }

    pub fn cell_count(&self) -> u32 {
        self.sectors * self.radial_bins * self.harmonics
    }

    pub fn set_physics_parameter(&mut self, key: &str, value: i32) -> bool {
        match key {
            "kuramoto_base" => self.header.kuramoto_base = value,
            "kuramoto_harmonic_peer" => self.header.kuramoto_harmonic_peer = value,
            "kuramoto_antipode" => self.header.kuramoto_antipode = value,
            "kuramoto_plasmid" => self.header.kuramoto_plasmid = value,
            "kuramoto_diffusion_rate" => self.header.kuramoto_diffusion_rate = value,
            "biology_apa_learning_rate" => self.header.biology_apa_learning_rate = value,
            "biology_apa_memory_gain" => self.header.biology_apa_memory_gain = value,
            "senate_min_energy" => self.header.senate_min_energy = value,
            _ => return false,
        }
        true
    }

    pub fn get_current_tau(&self) -> u32 {
        self.current_tau
    }

    pub fn pool_capacity(&self) -> u32 {
        self.agents.len() as u32
    }

    pub fn resize_topology(&mut self, sectors: u32, radial_bins: u32, harmonics: u32) {
        self.sectors = sectors;
        self.radial_bins = radial_bins;
        self.harmonics = harmonics;
        
        self.header.sectors = sectors;
        self.header.radial_bins = radial_bins;
        self.header.harmonics = harmonics;

        let required_cap = (sectors * radial_bins * harmonics * self.tau_depth) as usize;
        let spatial_cap = (sectors * radial_bins * harmonics) as usize;
        if required_cap > self.agents.len() {
            self.agents.resize(required_cap, crate::granite::PhaseAgent::default());
            self.cell_status.resize(required_cap, 0);
        }
        if spatial_cap > self.spatial_memory_theta.len() {
            self.spatial_memory_theta.resize(spatial_cap, 0);
            self.spatial_memory_strength.resize(spatial_cap, 0);
        }
    }

    pub fn ptr_header(&self) -> *const u8 {
        &self.header as *const SubstrateHeader as *const u8
    }

    pub fn ptr_agents(&self) -> *const u8 {
        self.agents.as_ptr() as *const u8
    }

    pub fn ptr_active_genomes(&self) -> *const u8 {
        self.active_genomes.as_ptr() as *const u8
    }

    pub fn ptr_spatial_memory_theta(&self) -> *const u8 {
        self.spatial_memory_theta.as_ptr()
    }

    pub fn ptr_spatial_memory_strength(&self) -> *const u8 {
        self.spatial_memory_strength.as_ptr()
    }

    pub fn ptr_oracle_requests(&self) -> *const u32 {
        self.oracle_requests.as_ptr()
    }

    pub fn get_oracle_request_count(&self) -> u32 {
        self.oracle_request_count
    }

    pub fn clear_oracle_requests(&mut self) {
        self.oracle_request_count = 0;
    }

    pub fn ptr_plasmid_collisions(&self) -> *const u64 {
        self.plasmid_collisions.as_ptr()
    }

    pub fn get_collision_count(&self) -> u32 {
        self.collision_count
    }

    pub fn clear_collisions(&mut self) {
        self.collision_count = 0;
    }

    pub fn ptr_cell_status(&self) -> *const u8 {
        self.cell_status.as_ptr()
    }

    pub fn seed_deterministic(&mut self) {
        for tau in 0..self.tau_depth as usize {
            for harmonic in 0..self.harmonics as usize {
                for rho in 0..self.radial_bins as usize {
                    for sector in 0..self.sectors as usize {
                        let idx = self.idx(tau, sector, rho, harmonic);
                        let agent = &mut self.agents[idx];
                        agent.theta = wrap_phase((tau * 3 + sector * 7 + rho * 19 + harmonic * 23) as i16);
                        agent.omega = clamp_i16(((tau + sector + rho + harmonic) % 5) as i16 - 2, PHASE_MIN_OMEGA, PHASE_MAX_OMEGA);
                        agent.energy = clamp_byte((tau * 11 + sector * 13 + rho * 17 + harmonic * 29) as i16);
                        agent.lock = ((tau * 7 + sector * 5 + rho * 11 + harmonic * 3) % 64) as u8;
                        agent.entanglement = 0;
                        agent.time_dilation = 0;
                        agent.plasmid = 0;
                    }
                }
            }
        }
    }

    pub fn rotate_global_phase(&mut self, delta: i16) {
        for agent in &mut self.agents {
            agent.theta = wrap_phase(agent.theta as i16 + delta);
            agent.preferred_theta = wrap_phase(agent.preferred_theta as i16 + delta);
        }
        for mem_theta in &mut self.spatial_memory_theta {
            *mem_theta = wrap_phase(*mem_theta as i16 + delta);
        }
    }

    pub fn rotate_angular_address(&mut self, delta_sector: i32) {
        let agents_clone = self.agents.clone();
        let status_clone = self.cell_status.clone();
        
        let mem_theta_clone = self.spatial_memory_theta.clone();
        let mem_strength_clone = self.spatial_memory_strength.clone();

        for tau in 0..self.tau_depth as usize {
            for harmonic in 0..self.harmonics as usize {
                for rho in 0..self.radial_bins as usize {
                    for sector in 0..self.sectors as usize {
                        let source = self.idx(tau, sector, rho, harmonic);
                        let target_sector = wrap_index_usize(sector as i32 + delta_sector, self.sectors as usize);
                        let target = self.idx(tau, target_sector, rho, harmonic);
                        
                        self.agents[target] = agents_clone[source];
                        self.cell_status[target] = status_clone[source];
                    }
                }
            }
        }
        
        // --- Phase 15: Shift Akashic Field Geometry ---
        for harmonic in 0..self.harmonics as usize {
            for rho in 0..self.radial_bins as usize {
                for sector in 0..self.sectors as usize {
                    let source = sector + (rho * self.sectors as usize) + (harmonic * self.sectors as usize * self.radial_bins as usize);
                    let target_sector = wrap_index_usize(sector as i32 + delta_sector, self.sectors as usize);
                    let target = target_sector + (rho * self.sectors as usize) + (harmonic * self.sectors as usize * self.radial_bins as usize);
                    
                    self.spatial_memory_theta[target] = mem_theta_clone[source];
                    self.spatial_memory_strength[target] = mem_strength_clone[source];
                }
            }
        }
    }

    pub fn swap_agents(&mut self, idx_a: u32, idx_b: u32) {
        let a = idx_a as usize;
        let b = idx_b as usize;
        if a < self.agents.len() && b < self.agents.len() {
            // Era 233.2: Biophysics Migration (Native AST Locomotion)
            self.agents.swap(a, b);
            self.cell_status.swap(a, b);
        }
    }

    pub fn check_memory_canary(&self) -> bool {
        self.canary_1 == 0xDEADBEEF && self.canary_2 == 0xDEADBEEF && self.canary_end == 0xDEADBEEF
    }

    pub fn evaluate_genome_resonance(&self, genome_idx: u32) -> f64 {
        if genome_idx >= 16 { return 0.0; }
        let genome = &self.active_genomes[genome_idx as usize];
        if genome.active == 0 { return 0.0; }

        let sectors = self.sectors as usize;
        let radial_bins = self.radial_bins as usize;
        let tau = self.current_tau as usize;

        let mut total_coherence: i64 = 0;
        let mut count = 0;

        for rho in 0..radial_bins {
            for sector in 0..sectors {
                let sec_dist = fast_abs(sector as i32 - genome.center_sector as i32);
                let sec_dist = if sec_dist > (sectors / 2) as i32 { sectors as i32 - sec_dist } else { sec_dist };
                let rho_dist = fast_abs(rho as i32 - genome.center_rho as i32);

                if genome.scope_radius == 0 || (sec_dist + rho_dist) <= genome.scope_radius {
                    let idx = self.idx(tau, sector, rho, 0); // Primary harmonic
                    
                    let left = self.idx(tau, wrap_index_usize(sector as i32 - 1, sectors), rho, 0);
                    let right = self.idx(tau, wrap_index_usize(sector as i32 + 1, sectors), rho, 0);
                    let inner = self.idx(tau, sector, rho.saturating_sub(1), 0);
                    let outer = self.idx(tau, sector, usize::min(rho + 1, radial_bins - 1), 0);
                    
                    let theta = self.agents[idx].theta;
                    
                    let local_coherence = cos(theta, self.agents[left].theta)
                        + cos(theta, self.agents[right].theta)
                        + cos(theta, self.agents[inner].theta)
                        + cos(theta, self.agents[outer].theta);
                        
                    total_coherence += local_coherence as i64;
                    count += 1;
                }
            }
        }

        if count == 0 { return 0.0; }
        
        let normalized = (total_coherence as f64) / (count as f64 * (4.0 * Q20_SCALE as f64));
        normalized
    }
}

#[wasm_bindgen]
pub fn execute_phase_lattice_tick(field: &mut PhaseLatticeField) {
    // Era 248: SSoT WebAssembly Memory Watchdog
    if field.internal_tick % 100 == 0 && !field.check_memory_canary() {
        panic!("[O-64 FATAL] OMEGA CORE MEMORY CORRUPTION DETECTED AT TICK {}", field.internal_tick);
    }
    field.internal_tick = field.internal_tick.wrapping_add(1);

    // Phase 14: ESP Genome Expiration Lifecycle
    for genome in field.active_genomes.iter_mut() {
        if genome.active == 1 {
            if genome.ttl > 0 {
                genome.ttl -= 1;
            } else {
                genome.active = 0;
            }
        }
    }

    let sectors = field.sectors as usize;
    let radial_bins = field.radial_bins as usize;
    let harmonics = field.harmonics as usize;
    
    let past_tau = field.current_tau as usize;
    field.current_tau = (field.current_tau + 1) % field.tau_depth;
    let next_tau = field.current_tau as usize;

    for harmonic in 0..harmonics {
        if harmonic > 0 {
            // O-64: Fossilized memory layers are explicitly frozen
            for rho in 0..radial_bins {
                for sector in 0..sectors {
                    let past_idx = field.idx(past_tau, sector, rho, harmonic);
                    let next_idx = field.idx(next_tau, sector, rho, harmonic);
                    
                    field.agents[next_idx].theta = field.agents[past_idx].theta;
                    field.agents[next_idx].omega = field.agents[past_idx].omega;
                    field.agents[next_idx].energy = field.agents[past_idx].energy;
                    field.agents[next_idx].lock = field.agents[past_idx].lock;
                    field.agents[next_idx].entanglement = field.agents[past_idx].entanglement;
                    field.cell_status[next_idx] = field.cell_status[past_idx];
                    field.agents[next_idx].plasmid = field.agents[past_idx].plasmid;
                }
            }
            continue;
        }

        for rho in 0..radial_bins {
            for sector in 0..sectors {
                let past_idx = field.idx(past_tau, sector, rho, harmonic);
                let next_idx = field.idx(next_tau, sector, rho, harmonic);

                // O-230.2: Extradimensional Time Dilation (Relativistic Ticks)
                // If the local chronometer is dilated, skip processing entirely to simulate time freezing in high-gravity/high-heat regions.
                let current_dilation = field.agents[past_idx].time_dilation;
                if current_dilation > 0 {
                    field.agents[next_idx] = field.agents[past_idx];
                    field.agents[next_idx].time_dilation = current_dilation - 1;
                    field.cell_status[next_idx] = field.cell_status[past_idx];
                    continue;
                }

                // --- Ontology 27: Async TTL ---
                let mut next_status_val = if field.cell_status[past_idx] > 0 {
                    field.cell_status[past_idx].saturating_sub(1)
                } else {
                    0
                };

                let theta = field.agents[past_idx].theta;
                let omega = field.agents[past_idx].omega;
                let amplitude = field.agents[past_idx].energy as i16;
                let lock = field.agents[past_idx].lock as i16;
                let entanglement = field.agents[past_idx].entanglement;

                let left = field.idx(past_tau, wrap_index_usize(sector as i32 - 1, sectors), rho, harmonic);
                let right = field.idx(past_tau, wrap_index_usize(sector as i32 + 1, sectors), rho, harmonic);
                let inner = field.idx(past_tau, sector, rho.saturating_sub(1), harmonic);
                let outer = field.idx(past_tau, sector, usize::min(rho + 1, radial_bins - 1), harmonic);
                let harmonic_peer = field.idx(past_tau, sector, rho, (harmonic + 1) % harmonics);
                
                // Vector B.1: Chronotopology Kuramoto Temporal Interference
                let historical_tau = (past_tau + field.tau_depth as usize - 1) % field.tau_depth as usize;
                let historical_peer = field.idx(historical_tau, sector, rho, harmonic);

                // --- Phase 14: Evolutionary Sandbox Physics (ESP) Overrides ---
                let mut local_kuramoto_base = field.header.kuramoto_base;
                let mut local_diffusion_rate = field.header.kuramoto_diffusion_rate;
                
                for genome in &field.active_genomes {
                    if genome.active == 1 {
                        let sec_dist = fast_abs(sector as i32 - genome.center_sector as i32);
                        let sec_dist = if sec_dist > (sectors / 2) as i32 { sectors as i32 - sec_dist } else { sec_dist };
                        let rho_dist = fast_abs(rho as i32 - genome.center_rho as i32);
                        
                        if genome.scope_radius == 0 || (sec_dist + rho_dist) <= genome.scope_radius {
                            local_kuramoto_base = genome.coupling_k;
                            local_diffusion_rate = genome.diffusion_rate;
                        }
                    }
                }
                if local_kuramoto_base == 0 { local_kuramoto_base = 1024; }

                let frustration_offset = KURAMOTO_SAKAGUCHI_ALPHA as i16;
                let effective_theta = wrap_phase(theta as i16 + frustration_offset) as u8;

                let mut kuramoto = sin(effective_theta, field.agents[left].theta)
                    + sin(effective_theta, field.agents[right].theta)
                    + sin(effective_theta, field.agents[inner].theta)
                    + sin(effective_theta, field.agents[outer].theta)
                    + ((sin(effective_theta, field.agents[harmonic_peer].theta) as i64 * field.header.kuramoto_harmonic_peer as i64) / local_kuramoto_base as i64) as i32
                    + ((sin(effective_theta, field.agents[historical_peer].theta) as i64 * 3) / 10) as i32;

                let mut coherence = cos(theta, field.agents[left].theta)
                    + cos(theta, field.agents[right].theta)
                    + cos(theta, field.agents[inner].theta)
                    + cos(theta, field.agents[outer].theta)
                    + ((cos(theta, field.agents[harmonic_peer].theta) as i64 * field.header.kuramoto_harmonic_peer as i64) / local_kuramoto_base as i64) as i32
                    + ((cos(theta, field.agents[historical_peer].theta) as i64 * 3) / 10) as i32;

                // --- O-130: Plasmid-Field Bridge ---
                if field.agents[past_idx].plasmid != 0 {
                    let target_theta = (field.agents[past_idx].plasmid & 0xFF) as u8;
                    kuramoto += ((sin(theta, target_theta) as i64 * field.header.kuramoto_plasmid as i64) / local_kuramoto_base as i64) as i32;
                    coherence += ((cos(theta, target_theta) as i64 * field.header.kuramoto_plasmid as i64) / local_kuramoto_base as i64) as i32;
                }

                let mut next_ent_val = entanglement;

                if sectors.is_multiple_of(2) {
                    let antipode_sector = (sector + sectors / 2) % sectors;
                    let antipode = field.idx(past_tau, antipode_sector, rho, harmonic);
                    let sin_anti = sin(theta, field.agents[antipode].theta);
                    let cos_anti = cos(theta, field.agents[antipode].theta);
                    
                    kuramoto += ((sin_anti as i64 * entanglement as i64 * field.header.kuramoto_antipode as i64) / (local_kuramoto_base as i64 * 25)) as i32;
                    coherence += ((cos_anti as i64 * entanglement as i64 * field.header.kuramoto_antipode as i64) / (local_kuramoto_base as i64 * 25)) as i32;

                    let antipode_alignment = cos_anti;
                    next_ent_val = if antipode_alignment > field.header.kuramoto_antipode_alignment && amplitude > 96 { // 0.92 * 1024
                        entanglement.saturating_add(8)
                    } else {
                        entanglement.saturating_sub(3)
                    };
                }

                // --- Phase 12: Adaptive Phase Biology (Ghost Neighbor Memory) ---
                let mut preferred_theta = field.agents[past_idx].preferred_theta;
                let mut memory_strength = field.agents[past_idx].memory_strength;

                let memory_pull = ((sin(effective_theta, preferred_theta) as i64 * memory_strength as i64 * field.header.biology_apa_memory_gain as i64) / (255 * 1024)) as i32;
                kuramoto += memory_pull;

                // --- Phase 15: Akashic Field Pull (Collective Spatial Memory) ---
                let akashic_idx = sector + (rho * field.sectors as usize) + (harmonic * field.sectors as usize * field.radial_bins as usize);
                let akashic_theta = field.spatial_memory_theta[akashic_idx];
                let akashic_strength = field.spatial_memory_strength[akashic_idx];

                let akashic_pull = ((sin(effective_theta, akashic_theta) as i64 * akashic_strength as i64 * field.header.biology_apa_memory_gain as i64) / (255 * 1024)) as i32;
                kuramoto += akashic_pull;

                let omega_delta = (kuramoto / (local_kuramoto_base * 1024)) as i16;
                let next_omega_val = clamp_i16(omega + omega_delta, PHASE_MIN_OMEGA, PHASE_MAX_OMEGA);
                let next_theta_val = wrap_phase(theta as i16 + next_omega_val);
                
                // Metabolic Cost of Adaptation
                let adaptation_cost = (fast_abs(omega_delta as i32) * field.header.biology_apa_decision_cost / 1024) as i16;
                let amplitude_delta = (((coherence as i64 * 6) / (local_kuramoto_base as i64 * 1024)) as i16) - (lock / 64) - adaptation_cost;
                let lock_delta = if coherence >= field.header.kuramoto_threshold_lock { 8 } else { -4 };

                // Phase Memory Learning & Decay
                if coherence >= field.header.biology_apa_coherence_reward {
                    let diff = signed_phase_delta(preferred_theta as i32, next_theta_val as i32);
                    let shift = (diff * field.header.biology_apa_learning_rate) / 1024;
                    preferred_theta = wrap_phase(preferred_theta as i16 + shift as i16);
                    
                    let memory_gain_byte = (field.header.biology_apa_memory_gain * 255) / 1024;
                    memory_strength = clamp_byte(memory_strength as i16 + memory_gain_byte as i16);

                    // --- Phase 15: Akashic Field Seeding ---
                    let ak_diff = signed_phase_delta(akashic_theta as i32, next_theta_val as i32);
                    let ak_shift = (ak_diff * field.header.biology_apa_learning_rate) / 1024;
                    field.spatial_memory_theta[akashic_idx] = wrap_phase(akashic_theta as i16 + ak_shift as i16);
                    field.spatial_memory_strength[akashic_idx] = clamp_byte(akashic_strength as i16 + memory_gain_byte as i16);
                }
                memory_strength = ((memory_strength as u32 * field.header.biology_apa_memory_decay as u32) / 1024) as u8;
                field.spatial_memory_strength[akashic_idx] = ((field.spatial_memory_strength[akashic_idx] as u32 * field.header.biology_apa_memory_decay as u32) / 1024) as u8;

                let next_amplitude_val = clamp_byte(amplitude + amplitude_delta);
                let next_lock_val = clamp_byte(lock + lock_delta);

                let mut adopted = false;
                let mut next_plasmid = field.agents[past_idx].plasmid;
                let mut local_next_theta = next_theta_val;
                let mut local_next_omega = next_omega_val;

                // O-130: Semantic Diffusion (Plasmid Decay)
                if next_amplitude_val < 40 {
                    next_plasmid = 0;
                }

                if next_amplitude_val < 140 {
                    let neighbors = [left, right, inner, outer, harmonic_peer];
                    let mut best_resonance = -2048;
                    let mut donor_plasmid = 0u64;

                    for &neighbor_idx in &neighbors {
                        let candidate_plasmid = field.agents[neighbor_idx].plasmid;
                        if candidate_plasmid == 0 { continue; }
                        // Phase 12: Phase Attraction Gradient Ascent (Resonance * Amplitude)
                        let candidate_resonance = cos(theta, field.agents[neighbor_idx].theta) * field.agents[neighbor_idx].energy as i32;
                        if candidate_resonance > best_resonance {
                            best_resonance = candidate_resonance;
                            donor_plasmid = candidate_plasmid;
                        }
                    }

                    // Since candidate_resonance was multiplied by Amplitude (0-255), we must scale the threshold
                    // Local diffusion rate directly scales the leniency of structural adoption
                    let safe_diffusion_rate = local_diffusion_rate.max(1);
                    let adoption_threshold = (field.header.kuramoto_adoption_resonance * 1024 * 100) / safe_diffusion_rate;
                    if donor_plasmid != 0 && best_resonance > adoption_threshold {
                        local_next_theta = (donor_plasmid & 0xFF) as u8;
                        let donor_omega = ((donor_plasmid >> 8) & 0xFF) as i16 - 128;
                        local_next_omega = clamp_i16(donor_omega, PHASE_MIN_OMEGA, PHASE_MAX_OMEGA);
                        next_plasmid = donor_plasmid;
                        adopted = true;
                    }
                }

                if !adopted && next_amplitude_val < 20 && next_lock_val < 10 && field.oracle_request_count < 1024 {
                    // Only request if completely cooled down
                    if field.cell_status[past_idx] == 0 {
                        let ptr = field.oracle_requests.as_mut_ptr() as *mut core::sync::atomic::AtomicU32;
                        unsafe {
                            (*ptr.add(field.oracle_request_count as usize)).store(past_idx as u32, core::sync::atomic::Ordering::Release);
                        }
                        field.oracle_request_count += 1;
                        next_status_val = 240; // 4 second TTLS Cooldown
                    }
                }

                if next_amplitude_val < 15 && next_plasmid != 0 && local_next_theta.is_multiple_of(4) {
                    next_plasmid = 0;
                }

                // Resolve execution into Native Next Cache
                field.agents[next_idx].theta = local_next_theta;
                field.agents[next_idx].omega = local_next_omega;
                field.agents[next_idx].time_dilation = field.agents[past_idx].time_dilation;
                field.agents[next_idx].preferred_theta = preferred_theta;
                field.agents[next_idx].energy = next_amplitude_val;
                field.agents[next_idx].lock = next_lock_val;
                field.agents[next_idx].entanglement = next_ent_val;
                field.agents[next_idx].memory_strength = memory_strength;
                field.agents[next_idx].plasmid = next_plasmid;
                field.cell_status[next_idx] = next_status_val;
                
                // O-230.2: Local Heat Generation -> Time Dilation
                // Extreme torque friction causes relativistic mass increase, slowing local execution speed
                field.agents[next_idx].time_dilation = if next_amplitude_val > 220 { 3 } else if next_amplitude_val > 180 { 1 } else { 0 };
            }
        }
    }
}

// O-64: The Stratum (Fossilization Layer)
// Mathematics Note (Ontology 80): This functionally acts as a HoTT ∞-groupoid preserving structural "memory of paths".
// Lean 4 / Agda Certificate Direction: Conservation of Flow.
// Theorem: if path p : A = B exists in the phase field, 
// then total_amplitude(A) + total_amplitude(B) = const (minus entropy loss).
#[wasm_bindgen]
pub fn execute_phase_lattice_fossilization(field: &mut PhaseLatticeField) {
    let sectors = field.sectors as usize;
    let radial_bins = field.radial_bins as usize;
    let harmonics = field.harmonics as usize;
    
    if harmonics <= 1 { return; }
    
    let cells_per_harm = sectors * radial_bins;
    let tau_offset = field.current_tau as usize * cells_per_harm * harmonics;
    
    let src_start = tau_offset;
    let src_end = tau_offset + cells_per_harm * (harmonics - 1);
    let dst_start = tau_offset + cells_per_harm;
    
    // Copy the (harmonics-1) deeper strata into upper ranges, maintaining local `current_tau` integrity
    field.agents.copy_within(src_start..src_end, dst_start);
    field.cell_status.copy_within(src_start..src_end, dst_start);
}

#[wasm_bindgen]
pub fn phase_lattice_signature(field: &PhaseLatticeField) -> String {
    let mut hash = crate::constants::FNV64_OFFSET_BASIS;
    let tau = field.current_tau as usize;
    for harmonic in 0..field.harmonics as usize {
        for rho in 0..field.radial_bins as usize {
            for sector in 0..field.sectors as usize {
                let idx = field.idx(tau, sector, rho, harmonic); // Assuming idx is the correct function name, not get_cell_index_internal
                hash = crate::constants::mix_u64(hash, sector as u64);
                hash = crate::constants::mix_u64(hash, rho as u64);
                hash = crate::constants::mix_u64(hash, harmonic as u64);
                hash = crate::constants::mix_u64(hash, field.agents[idx].theta as u64);
                hash = crate::constants::mix_u64(hash, (field.agents[idx].omega as u32) as u64);
                hash = crate::constants::mix_u64(hash, field.agents[idx].energy as u64); // Assuming energy is the correct field name, not amplitude
                hash = crate::constants::mix_u64(hash, field.agents[idx].lock as u64);
                hash = crate::constants::mix_u64(hash, field.agents[idx].entanglement as u64);
                hash = crate::constants::mix_u64(hash, field.cell_status[idx] as u64);
                hash = crate::constants::mix_u64(hash, field.agents[idx].plasmid); // Assuming plasmid is the correct field name, not plasmids
            }
        }
    }
    format!("{hash:016x}")
}

#[wasm_bindgen]
pub fn phase_lattice_total_amplitude(field: &PhaseLatticeField) -> u32 {
    let mut sum = 0;
    let rho = (field.radial_bins as usize).saturating_sub(1);
    let tau = field.current_tau as usize;
    for harmonic in 0..field.harmonics as usize {
        for sector in 0..field.sectors as usize {
            let idx = field.idx(tau, sector, rho, harmonic);
            sum += field.agents[idx].energy as u32;
        }
    }
    sum
}

#[wasm_bindgen]
pub fn phase_lattice_total_entanglement(field: &PhaseLatticeField) -> u32 {
    let mut sum = 0;
    let rho = (field.radial_bins as usize).saturating_sub(1);
    let tau = field.current_tau as usize;
    for harmonic in 0..field.harmonics as usize {
        for sector in 0..field.sectors as usize {
            let idx = field.idx(tau, sector, rho, harmonic);
            sum += field.agents[idx].entanglement as u32;
        }
    }
    sum
}

#[wasm_bindgen]
pub fn phase_lattice_omega_span(field: &PhaseLatticeField) -> String {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    let rho = (field.radial_bins as usize).saturating_sub(1);
    let tau = field.current_tau as usize;
    for harmonic in 0..field.harmonics as usize {
        for sector in 0..field.sectors as usize {
            let idx = field.idx(tau, sector, rho, harmonic);
            min = min.min(field.agents[idx].omega);
            max = max.max(field.agents[idx].omega);
        }
    }
    if min == i16::MAX {
        return "0..0".to_string(); // Empty case
    }
    format!("{min}..{max}")
}


#[wasm_bindgen]
pub fn phase_lattice_shannon_entropy(field: &PhaseLatticeField) -> i32 {
    let mut sum_q10 = 0i32;
    for amp in field.agents.iter().map(|a| a.energy) {
        if amp > 0 {
            sum_q10 += crate::constants::ENTROPY_LUT[amp as usize];
        }
    }
    sum_q10
}

impl PhaseLatticeField {
    #[inline(always)]
    fn idx(&self, tau: usize, sector: usize, rho: usize, harmonic: usize) -> usize {
        let cells = self.harmonics as usize * self.radial_bins as usize * self.sectors as usize;
        let layer_offset = tau * cells;
        let local_idx = harmonic * self.radial_bins as usize * self.sectors as usize
            + rho * self.sectors as usize
            + sector;
        layer_offset + local_idx
    }
}


#[cfg(test)]
mod tests {
    use super::{execute_phase_lattice_tick, PhaseLatticeField};

    fn run_ticks(field: &mut PhaseLatticeField, ticks: usize) {
        for _ in 0..ticks {
            execute_phase_lattice_tick(field);
        }
    }

    fn assert_same_state(left: &PhaseLatticeField, right: &PhaseLatticeField) {
        let tau_l = left.current_tau as usize;
        let tau_r = right.current_tau as usize;
        let cells = (left.harmonics * left.radial_bins * left.sectors) as usize;
        
        let start_l = tau_l * cells;
        let start_r = tau_r * cells;
        let end_l = start_l + cells;
        let end_r = start_r + cells;

        assert_eq!(left.agents[start_l..end_l], right.agents[start_r..end_r], "agents mismatch");
        assert_eq!(left.cell_status[start_l..end_l], right.cell_status[start_r..end_r], "status mismatch");
    }

    #[test]
    fn phase_lattice_is_deterministic() {
        let mut left = PhaseLatticeField::new(32, 6, 3);
        let mut right = PhaseLatticeField::new(32, 6, 3);
        run_ticks(&mut left, 24);
        run_ticks(&mut right, 24);
        assert_same_state(&left, &right);
    }

    #[test]
    fn global_phase_rotation_is_equivariant() {
        let mut rotated_seed = PhaseLatticeField::new(32, 6, 3);
        let mut baseline = PhaseLatticeField::new(32, 6, 3);
        rotated_seed.rotate_global_phase(37);

        run_ticks(&mut rotated_seed, 24);
        run_ticks(&mut baseline, 24);
        baseline.rotate_global_phase(37);

        assert_same_state(&rotated_seed, &baseline);
    }

    #[test]
    fn angular_rotation_is_equivariant() {
        let mut rotated_seed = PhaseLatticeField::new(32, 6, 3);
        let mut baseline = PhaseLatticeField::new(32, 6, 3);
        rotated_seed.rotate_angular_address(5);

        run_ticks(&mut rotated_seed, 24);
        run_ticks(&mut baseline, 24);
        baseline.rotate_angular_address(5);

        assert_same_state(&rotated_seed, &baseline);
    }
}

#[cfg(test)]
mod alloc_tests {
    use super::*;

    #[test]
    fn test_huge_alloc() {
        let field = PhaseLatticeField::new(256, 256, 1);
        assert_eq!(field.cell_count(), 256 * 256 * 1);
    }
}

#[test]
fn extreme_alloc_test() {
    let f = PhaseLatticeField::new(256, 256, 1);
    assert_eq!(f.sectors, 256);
}

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn entropy_never_negative(
            sectors in 10u32..50u32,
            radial_bins in 5u32..20u32,
            harmonics in 1u32..3u32,
        ) {
            let field = PhaseLatticeField::new(sectors, radial_bins, harmonics);
            let entropy = phase_lattice_shannon_entropy(&field);
            prop_assert!(entropy >= 0, "Entropy violated thermodynamic bounds: {}", entropy);
        }
    }
}
