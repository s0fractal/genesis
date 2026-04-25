#![cfg_attr(not(any(test, debug_assertions)), no_std)]

// Era 1100: Bare-Metal Substrate
// This crate operates entirely without the standard library, enabling direct execution
// inside RISC-V ZK-VMs (SP1), Microcontrollers, or WebAssembly sandbox without WASI.

pub mod constants;
pub mod topology;
pub mod math;
pub mod agent;
pub mod lattice;
pub mod pouw;
pub mod epigenetics;
pub mod anchor;
pub mod phi_protocol;
pub mod resonance;
pub mod halo;
pub mod routing;
pub mod attractor;

use lattice::{PhaseLattice, SignalStore};
use topology::PhaseTopology;
use agent::PhaseAgentMinimal;
use epigenetics::EpigeneticMemory;
use anchor::PhiAnchorChain;
use phi_protocol::{PhiMessageBuffer, PhiMessage};
use resonance::ResonanceField;
use halo::HaloState;



// Primitive panic handler for no_std WASM/Bare metal environments
#[cfg(not(any(test, debug_assertions)))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

/// Static Memory Pre-Allocation for Bare-Metal Environment.
/// 16MB of contiguous RAM allocated exactly at compile time.
pub const MAX_MINIMAL_AGENTS: usize = 1_000_000;
static mut AGENTS_MEMORY: [PhaseAgentMinimal; MAX_MINIMAL_AGENTS] = [PhaseAgentMinimal {
    phase: 0,
    energy: 0,  // MUST BE 0 to place this 32MB block in the .bss section instead of .data!!
    base_freq: 0,
    state_flags: 0,
    genome: 0,
    memory: [0; 3],
}; MAX_MINIMAL_AGENTS];

// ERA 6000: 32MB Shadow Memory + Differential Output Buffer
static mut LAST_SNAPSHOT_MEMORY: [PhaseAgentMinimal; MAX_MINIMAL_AGENTS] = [PhaseAgentMinimal {
    phase: 0,
    energy: 0,
    base_freq: 0,
    state_flags: 0,
    genome: 0,
    memory: [0; 3],
}; MAX_MINIMAL_AGENTS];

pub const MAX_DELTA_ITEMS: usize = 6400; // Limits extreme mutations to ~100KB per UDP packet
static mut DELTA_BUFFER: [crate::lattice::DeltaItem; MAX_DELTA_ITEMS] = [crate::lattice::DeltaItem {
    index: 0,
    phase: 0,
    energy: 0,
    genome: 0,
}; MAX_DELTA_ITEMS];

/// Global Epigenetic Memory — accumulates survival wisdom across Big Bang cycles.
static mut EPIGENETIC_MEMORY: EpigeneticMemory = EpigeneticMemory::new();

/// The Global Engine Singleton for #![no_std] execution.
static mut OMEGA_LATTICE: PhaseLattice = PhaseLattice {
    topology: PhaseTopology {
        q_phase: 7, // 128 elements the Sacred Seven!
        q_sectors: 7,
        q_radial: 6,
        q_math: 20,
    },
    signals: SignalStore {
        dirty_flags: 0,
        absolute_tick: 0,
        active_agent_count: 0,
        max_cells: 0,
    },
    intents: [crate::topology::OntologicalIntent {
        focus_x: 0,
        focus_y: 0,
        mass: 0,
        radius: 0,
        semantic_genome: 0,
        op_mode: 0,
        _pad1: 0,
        _pad2: 0,
    }; 4],
    smart_agents_ptr: core::ptr::null_mut(),
    minimal_agents_ptr: core::ptr::null_mut(), // Will be linked on boot
    active_agent_count: 0,
};

/// Φ-Маніфест: Bitcoin φ-Anchor Chain.
/// Глобальний якір для всіх φ-дериватів у мережі.
static mut PHI_ANCHOR_CHAIN: PhiAnchorChain = PhiAnchorChain::new();

/// Φ-Маніфест: Phi Protocol Message Buffer.
/// Lock-free ring buffer для повідомлень між OMEGA і зовнішніми спостерігачами.
static mut PHI_MESSAGE_BUFFER: PhiMessageBuffer = PhiMessageBuffer::new();

/// EpicyclicSoul: Global Resonance Field (Kuramoto order parameter + phase).
/// Updated by v2_resonance_scan() and read by v2_resonance_r_q10() / v2_resonance_sum_cos/sin().
static mut RESONANCE_FIELD: ResonanceField = ResonanceField::zero();

/// Distributed Federation: Halo boundary state for cross-node sync.
/// Exchanged via WebRTC between adjacent nodes in the toroidal chain.
static mut HALO_STATE: HaloState = HaloState::empty();

/// Era 1010: Global Attractor Array for GPU uniform buffer.
static mut ATTRACTOR_ARRAY: AttractorArray = AttractorArray::new();

// -----------------------------------------------------------------------------
// NAKED FFI EXPORTS (Called directly from v2_bridge.ts without wasm-bindgen)
// -----------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn v2_lattice_ptr() -> *const u8 {
    core::ptr::addr_of!(OMEGA_LATTICE) as *const u8
}

#[no_mangle]
pub extern "C" fn v2_agents_ptr() -> *const u8 {
    core::ptr::addr_of!(AGENTS_MEMORY) as *const u8
}

#[no_mangle]
pub extern "C" fn v2_sine_lut_ptr() -> *const u8 {
    crate::math::SINE_LUT_128.as_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_boot_engine() {
    unsafe {
        // Link the static buffer into the Lattice Engine
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        let agents = core::ptr::addr_of_mut!(AGENTS_MEMORY) as *mut PhaseAgentMinimal;
        (*lattice).minimal_agents_ptr = agents;
    }
}

#[no_mangle]
pub extern "C" fn v2_set_environment(q_sectors: u32, q_radial: u32, _q_harmonics: u32) {
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        (*lattice).set_environment(q_sectors, q_radial, _q_harmonics);
    }
}

#[no_mangle]
pub extern "C" fn v2_ignite_big_bang(seed: u32, agent_count: u32) {
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        (*lattice).ignite_big_bang(seed, agent_count);
    }
}

#[no_mangle]
pub extern "C" fn v2_ignite_epigenetic_big_bang(seed: u32, agent_count: u32) {
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        let mem = core::ptr::addr_of!(EPIGENETIC_MEMORY);
        (*lattice).ignite_epigenetic_big_bang(seed, agent_count, &*mem);
    }
}

#[no_mangle]
pub extern "C" fn v2_tick() {
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        (*lattice).tick_physics();
    }
}

#[no_mangle]
pub extern "C" fn v2_set_intent(index: u32, focus_x: i32, focus_y: i32, mass: i32, radius: i32, semantic_genome: u32, op_mode: u32) {
    if index >= 4 { return; }
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        (*lattice).intents[index as usize].focus_x = focus_x;
        (*lattice).intents[index as usize].focus_y = focus_y;
        (*lattice).intents[index as usize].mass = mass;
        (*lattice).intents[index as usize].radius = radius;
        (*lattice).intents[index as usize].semantic_genome = semantic_genome;
        (*lattice).intents[index as usize].op_mode = op_mode;
    }
}

#[no_mangle]
pub extern "C" fn v2_get_golden_trace() -> u32 {
    unsafe {
        let lattice = core::ptr::addr_of!(OMEGA_LATTICE);
        (*lattice).get_golden_trace()
    }
}

#[no_mangle]
pub extern "C" fn v2_mitosis_sweep() -> u32 {
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        (*lattice).darwinian_mitosis()
    }
}

// ERA 6000 FFI
#[no_mangle]
pub extern "C" fn v2_delta_buffer_ptr() -> *const u8 {
    core::ptr::addr_of!(DELTA_BUFFER) as *const u8
}

#[no_mangle]
pub extern "C" fn v2_generate_delta_snapshot() -> u32 {
    unsafe {
        let lattice = core::ptr::addr_of_mut!(OMEGA_LATTICE);
        let agents = core::ptr::addr_of!(AGENTS_MEMORY) as *const PhaseAgentMinimal;
        let snapshot = core::ptr::addr_of_mut!(LAST_SNAPSHOT_MEMORY) as *mut PhaseAgentMinimal;
        let delta = core::ptr::addr_of_mut!(DELTA_BUFFER) as *mut crate::lattice::DeltaItem;
        (*lattice).generate_delta_snapshot(agents, snapshot, delta, MAX_DELTA_ITEMS)
    }
}

// -------------------------------------------------------------------------
// ERA 950: Epigenetic FFI (Observer → Memory → Evolution)
// -------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn v2_record_epigenetic(genome: u32) {
    unsafe {
        let mem = core::ptr::addr_of_mut!(EPIGENETIC_MEMORY);
        (*mem).record(genome);
    }
}

#[no_mangle]
pub extern "C" fn v2_get_epigenetic_bias(bit_index: u32) -> u32 {
    if bit_index >= 32 { return 0; }
    unsafe {
        let mem = core::ptr::addr_of!(EPIGENETIC_MEMORY);
        (*mem).bit_frequencies[bit_index as usize]
    }
}

#[no_mangle]
pub extern "C" fn v2_get_epigenetic_total() -> u32 {
    unsafe {
        let mem = core::ptr::addr_of!(EPIGENETIC_MEMORY);
        (*mem).total_recorded
    }
}

#[no_mangle]
pub extern "C" fn v2_set_mutation_rate(rate: u32) {
    unsafe {
        let mem = core::ptr::addr_of_mut!(EPIGENETIC_MEMORY);
        (*mem).mutation_rate = rate.min(100);
    }
}

#[no_mangle]
pub extern "C" fn v2_clear_epigenetic() {
    unsafe {
        let mem = core::ptr::addr_of_mut!(EPIGENETIC_MEMORY);
        (*mem).clear();
    }
}

// -------------------------------------------------------------------------
// Φ-Маніфест: Bitcoin φ-Anchor Chain FFI
// -------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn v2_anchor_init(h0: u64, h1: u64, h2: u64, h3: u64, h4: u64, h5: u64) {
    unsafe {
        let anchor = core::ptr::addr_of_mut!(PHI_ANCHOR_CHAIN);
        (*anchor).init([h0, h1, h2, h3, h4, h5]);
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_ingest_block(hash: u64) {
    unsafe {
        let anchor = core::ptr::addr_of_mut!(PHI_ANCHOR_CHAIN);
        (*anchor).ingest_block(hash);
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_global_phi() -> u32 {
    unsafe {
        let anchor = core::ptr::addr_of!(PHI_ANCHOR_CHAIN);
        (*anchor).global_phi()
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_derive_phi(parent_phi: u32, child_id: u64, q_phase: u32) -> u32 {
    unsafe {
        let anchor = core::ptr::addr_of!(PHI_ANCHOR_CHAIN);
        (*anchor).derive_phi(parent_phi, child_id, q_phase)
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_verify_coherence(
    claimed_phi: u32,
    parent_phi: u32,
    child_id: u64,
    q_phase: u32,
    tolerance: u32,
) -> u32 {
    unsafe {
        let anchor = core::ptr::addr_of!(PHI_ANCHOR_CHAIN);
        if (*anchor).verify_coherence(claimed_phi, parent_phi, child_id, q_phase, tolerance) {
            1
        } else {
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_total_blocks() -> u64 {
    unsafe {
        let anchor = core::ptr::addr_of!(PHI_ANCHOR_CHAIN);
        (*anchor).total_blocks
    }
}

// -------------------------------------------------------------------------
// Φ-Маніфест: Phi Protocol FFI (OMEGA ↔ Liquid Bridge)
// -------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn v2_phi_buffer_ptr() -> *const u8 {
    core::ptr::addr_of!(PHI_MESSAGE_BUFFER) as *const u8
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_push(msg_type: u8, q_phase: u8, phi: u32, energy: u32, payload_lo: u32, payload_hi: u32) {
    unsafe {
        let buf = core::ptr::addr_of_mut!(PHI_MESSAGE_BUFFER);
        let payload = ((payload_hi as u64) << 32) | (payload_lo as u64);
        let msg = PhiMessage::new(msg_type, q_phase, phi, energy, payload);
        (*buf).push(msg);
    }
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_len() -> u32 {
    unsafe {
        let buf = core::ptr::addr_of!(PHI_MESSAGE_BUFFER);
        (*buf).len()
    }
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_is_empty() -> u32 {
    unsafe {
        let buf = core::ptr::addr_of!(PHI_MESSAGE_BUFFER);
        if (*buf).is_empty() { 1 } else { 0 }
    }
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_drops() -> u32 {
    unsafe {
        let buf = core::ptr::addr_of!(PHI_MESSAGE_BUFFER);
        (*buf).drops
    }
}

/// # Safety
/// `msg_out` must be a valid, non-null, aligned pointer to a `PhiMessage`.
#[no_mangle]
pub unsafe extern "C" fn v2_phi_buffer_peek_latest(msg_out: *mut PhiMessage) -> u32 {
    if msg_out.is_null() { return 0; }
    unsafe {
        let buf = core::ptr::addr_of!(PHI_MESSAGE_BUFFER);
        match (*buf).peek_latest() {
            Some(msg) => {
                core::ptr::write(msg_out, msg);
                1
            }
            None => 0,
        }
    }
}

// ------------------------------------------------------------------------------
// Era 1010: Attractor Matrix FFI
// ------------------------------------------------------------------------------

/// Validate that matrix and inverse form a perfect dipole (bitwise complements).
/// Returns 1 if valid, 0 if invalid.
#[no_mangle]
pub extern "C" fn v2_validate_dipole(matrix: u32, inverse: u32) -> u32 {
    let m = AttractorMatrix::new(matrix, inverse, 0, 0);
    if m.is_valid_dipole() { 1 } else { 0 }
}

/// Set an attractor at `index` (0..3). Replaces existing or extends count.
#[no_mangle]
pub extern "C" fn v2_set_attractor(index: u32, matrix: u32, inverse: u32, pulse_freq: u32, pulse_amp: u32) {
    if index >= 4 { return; }
    unsafe {
        let arr = core::ptr::addr_of_mut!(ATTRACTOR_ARRAY);
        let m = AttractorMatrix::new(matrix, inverse, pulse_freq, pulse_amp);
        (*arr).set(index as usize, m);
    }
}

/// Clear all attractors.
#[no_mangle]
pub extern "C" fn v2_clear_attractors() {
    unsafe {
        let arr = core::ptr::addr_of_mut!(ATTRACTOR_ARRAY);
        (*arr).clear();
    }
}

/// Returns pointer to the global AttractorArray (80 bytes, 16-byte aligned).
#[no_mangle]
pub extern "C" fn v2_attractor_array_ptr() -> *const u8 {
    core::ptr::addr_of!(ATTRACTOR_ARRAY) as *const u8
}

// --- EpicyclicSoul: Resonance Tensor FFI ---

/// Scan all living agents and update the global ResonanceField.
#[no_mangle]
pub extern "C" fn v2_resonance_scan() {
    unsafe {
        let lattice = core::ptr::addr_of!(OMEGA_LATTICE);
        let active = (*lattice).signals.active_agent_count as usize;
        if (*lattice).minimal_agents_ptr.is_null() || active == 0 {
            RESONANCE_FIELD = ResonanceField::zero();
            return;
        }
        let agents = core::slice::from_raw_parts((*lattice).minimal_agents_ptr, active);
        let mut field = ResonanceField::zero();
        for agent in agents {
            field.ingest_agent(agent);
        }
        RESONANCE_FIELD = field;
    }
}

/// Returns the Kuramoto order parameter r as Q10 (0..1024).
/// Call v2_resonance_scan() first to refresh.
#[no_mangle]
pub extern "C" fn v2_resonance_r_q10() -> u32 {
    unsafe {
        let field = core::ptr::addr_of!(RESONANCE_FIELD);
        (*field).order_parameter_r_q10()
    }
}

/// Returns Σ ρ_i · cos(φ_i) as i64 (truncated from internal i128).
/// Safe: actual magnitude never exceeds i64 range for realistic populations.
#[no_mangle]
pub extern "C" fn v2_resonance_sum_cos() -> i64 {
    unsafe {
        let field = core::ptr::addr_of!(RESONANCE_FIELD);
        (*field).sum_cos as i64
    }
}

/// Returns Σ ρ_i · sin(φ_i) as i64 (truncated from internal i128).
#[no_mangle]
pub extern "C" fn v2_resonance_sum_sin() -> i64 {
    unsafe {
        let field = core::ptr::addr_of!(RESONANCE_FIELD);
        (*field).sum_sin as i64
    }
}

/// Returns total energy Σ ρ_i of the scanned population.
#[no_mangle]
pub extern "C" fn v2_resonance_total_energy() -> u64 {
    unsafe {
        let field = core::ptr::addr_of!(RESONANCE_FIELD);
        (*field).total_energy
    }
}

/// Returns number of living agents in the scanned population.
#[no_mangle]
pub extern "C" fn v2_resonance_active_count() -> u32 {
    unsafe {
        let field = core::ptr::addr_of!(RESONANCE_FIELD);
        (*field).active_count
    }
}

// --- Era 400: Distributed Federation Halo Sync ---

/// Extract boundary agents from the local lattice into HALO_STATE.
#[no_mangle]
pub extern "C" fn v2_halo_extract() {
    unsafe {
        let lattice = core::ptr::addr_of!(OMEGA_LATTICE);
        let active = (*lattice).signals.active_agent_count as usize;
        if (*lattice).minimal_agents_ptr.is_null() || active == 0 {
            return;
        }
        let agents = core::slice::from_raw_parts((*lattice).minimal_agents_ptr, active);
        let state = core::ptr::addr_of_mut!(HALO_STATE);
        (*state).extract(agents, active);
    }
}

/// Returns pointer to the left halo agent (owned by previous node).
/// # Safety
/// Pointer is valid until next v2_halo_extract() call.
#[no_mangle]
pub extern "C" fn v2_halo_left_ptr() -> *const PhaseAgentMinimal {
    unsafe {
        let state = core::ptr::addr_of!(HALO_STATE);
        core::ptr::addr_of!((*state).left_halo[0])
    }
}

/// Returns pointer to the right halo agent (owned by next node).
/// # Safety
/// Pointer is valid until next v2_halo_extract() call.
#[no_mangle]
pub extern "C" fn v2_halo_right_ptr() -> *const PhaseAgentMinimal {
    unsafe {
        let state = core::ptr::addr_of!(HALO_STATE);
        core::ptr::addr_of!((*state).right_halo[0])
    }
}

/// Returns the halo sequence number (monotonically incremented per extract).
#[no_mangle]
pub extern "C" fn v2_halo_sequence() -> u64 {
    unsafe {
        let state = core::ptr::addr_of!(HALO_STATE);
        (*state).sequence
    }
}

/// Returns 1 if both halos contain living agents (connected federation).
#[no_mangle]
pub extern "C" fn v2_halo_is_connected() -> u32 {
    unsafe {
        let state = core::ptr::addr_of!(HALO_STATE);
        if (*state).is_connected() { 1 } else { 0 }
    }
}

/// Inject a halo received from a neighbor node.
/// `from_left`: 1 if this is the left neighbor's right boundary, 0 if right neighbor's left boundary.
/// `agent_ptr`: pointer to the received PhaseAgentMinimal (must be valid, 32 bytes).
///
/// # Safety
/// `agent_ptr` must be a valid, non-null, aligned pointer to a `PhaseAgentMinimal`.
#[no_mangle]
pub unsafe extern "C" fn v2_halo_inject(from_left: u32, agent_ptr: *const PhaseAgentMinimal) {
    if agent_ptr.is_null() { return; }
    unsafe {
        let state = core::ptr::addr_of_mut!(HALO_STATE);
        let agent = core::ptr::read(agent_ptr);
        if from_left != 0 {
            (*state).left_halo[0] = agent;
        } else {
            (*state).right_halo[0] = agent;
        }
    }
}

// ------------------------------------------------------------------------------
// Era 1000: Taylor Series Phase Routing FFI
// ------------------------------------------------------------------------------

use routing::PhaseAddress;
use attractor::{AttractorMatrix, AttractorArray};

/// Derive a PhaseAddress from the agent at `index`.
/// Returns 0 if the index is out of bounds or the lattice is not booted.
#[no_mangle]
pub extern "C" fn v2_route_address_from_agent(index: u32) -> u32 {
    unsafe {
        let lattice = core::ptr::addr_of!(OMEGA_LATTICE);
        let active = (*lattice).signals.active_agent_count;
        if (*lattice).minimal_agents_ptr.is_null() || index >= active {
            return 0;
        }
        let agent = &*((*lattice).minimal_agents_ptr.add(index as usize));
        PhaseAddress::from_agent(agent, (*lattice).topology.q_phase).raw
    }
}

/// Hyperbolic distance between two PhaseAddresses (scaled ×8).
/// Divide by 8 to get the true distance.
#[no_mangle]
pub extern "C" fn v2_route_hyperbolic_distance(a_raw: u32, b_raw: u32) -> u32 {
    let a = PhaseAddress::from_raw(a_raw);
    let b = PhaseAddress::from_raw(b_raw);
    a.hyperbolic_distance_scaled(b)
}

/// Toroidal hyperbolic distance (consensus wraps at 256). Scaled ×8.
#[no_mangle]
pub extern "C" fn v2_route_hyperbolic_distance_toroidal(a_raw: u32, b_raw: u32) -> u32 {
    let a = PhaseAddress::from_raw(a_raw);
    let b = PhaseAddress::from_raw(b_raw);
    a.hyperbolic_distance_toroidal_scaled(b)
}

/// First-order Taylor step from `src_raw` toward `dst_raw`, clamped to `max_step` per level.
#[no_mangle]
pub extern "C" fn v2_route_taylor_step(src_raw: u32, dst_raw: u32, max_step: u8) -> u32 {
    let src = PhaseAddress::from_raw(src_raw);
    let dst = PhaseAddress::from_raw(dst_raw);
    src.taylor_step_toward(dst, max_step).raw
}

/// Second-order Taylor step with curvature vector `curv_raw` (Q7 signed per byte).
#[no_mangle]
pub extern "C" fn v2_route_taylor_step_curvature(
    src_raw: u32,
    dst_raw: u32,
    max_step: u8,
    curv_raw: u32,
) -> u32 {
    let src = PhaseAddress::from_raw(src_raw);
    let dst = PhaseAddress::from_raw(dst_raw);
    let curv = PhaseAddress::from_raw(curv_raw);
    src.taylor_step_with_curvature(dst, max_step, curv).raw
}
