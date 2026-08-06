#![allow(unused_mut)]
#![allow(unused_unsafe)]
// Bare-Metal Substrate.

// no_std is enabled when targeting any of:
// - wasm32 (browser / WASI runtime)
// - thumb* (ARM Cortex-M microcontrollers — ESP32-C3, Pi Pico, STM32, etc.)

// On SP1's RISC-V `riscv64im-succinct-zkvm-elf` target, std is provided by
// the SP1 toolchain — declaring our own panic_handler would conflict with
// std's. Host (`cargo test`) builds also use std for ergonomics.
#![cfg_attr(any(target_arch = "wasm32", target_os = "none"), no_std)]
#![cfg_attr(any(target_arch = "wasm32", target_os = "none"), no_main)]

pub mod agent;
pub mod anchor;
#[cfg(not(feature = "spore"))]
pub mod attractor;
pub mod bitcoin_oracle;
pub mod chronotopology;
#[cfg(not(feature = "spore"))]
pub mod codeicide_law;
pub mod constants;
pub mod convergence_driver;
#[cfg(not(feature = "spore"))]
pub mod cross_model_debate;
pub mod cross_substrate_wire;
pub mod crypto;
pub mod epigenetics;
pub mod event_broadcast;
pub mod event_sync_loop;
pub mod forensic_event_sink;
pub mod genesis_inscription;
pub mod lattice;
pub mod law_hash;
pub mod math;
#[cfg(not(feature = "spore"))]
pub mod mitosis_log;
#[cfg(not(feature = "spore"))]
pub mod mitosis_proof;
#[cfg(not(feature = "spore"))]
pub mod oracle_identity;
pub mod phi_protocol;
pub mod precedent;
pub mod resilience_snapshot;
pub mod resonance;
pub mod routing;
#[cfg(not(feature = "spore"))]
pub mod senate;
pub mod spore_frame;
pub mod spore_routing;
pub mod spore_runner;
pub mod sync;
pub mod thermodynamics;
pub mod topology;
#[cfg(not(feature = "spore"))]
pub mod warrant_issuance;
use agent::PhaseAgentMinimal;
use anchor::PhiAnchorChain;
use epigenetics::EpigeneticMemory;
use lattice::{PhaseLattice, SignalStore};
use phi_protocol::{PhiMessage, PhiMessageBuffer};
use resonance::ResonanceField;
use topology::PhaseTopology;

// Primitive panic handler for no_std environments. Gated behind the
// `builtin-panic` feature so downstream bare-metal binaries can supply
// their own panic_handler without colliding on the lang item.

// SP1 RISC-V target provides std (its own panic_impl), so this is also
// excluded from std targets via the no_std cfg.
#[cfg(all(
    any(target_arch = "wasm32", target_os = "none"),
    feature = "builtin-panic"
))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

/// Static Memory Pre-Allocation for Bare-Metal Environment.
/// 16MB of contiguous RAM allocated exactly at compile time.
#[cfg(not(feature = "spore"))]
pub const MAX_MINIMAL_AGENTS: usize = 500_000;
#[cfg(feature = "spore")]
pub const MAX_MINIMAL_AGENTS: usize = 1024;
pub static AGENTS_MEMORY: crate::sync::Spinlock<[PhaseAgentMinimal; MAX_MINIMAL_AGENTS]> =
    crate::sync::Spinlock::new(
        [PhaseAgentMinimal {
            phase: 0,
            energy: 0, // MUST BE 0 to place this 32MB block in the .bss section instead of .data!!
            base_freq: 0,
            state_flags: 0,
            genome: 0,
            memory: [0; 3],
        }; MAX_MINIMAL_AGENTS],
    );

// ERA 6000: 32MB Shadow Memory + Differential Output Buffer
pub static SHADOW_LATTICE_MEMORY: crate::sync::Spinlock<[PhaseAgentMinimal; MAX_MINIMAL_AGENTS]> =
    crate::sync::Spinlock::new(
        [PhaseAgentMinimal {
            phase: 0,
            energy: 0,
            base_freq: 0,
            state_flags: 0,
            genome: 0,
            memory: [0; 3],
        }; MAX_MINIMAL_AGENTS],
    );

/// Parallel birth-tick array. Indexed by agent position.
/// Kept outside PhaseAgentMinimal to preserve 32-byte ABI alignment.
pub static BIRTH_TICKS: crate::sync::Spinlock<[u32; MAX_MINIMAL_AGENTS]> =
    crate::sync::Spinlock::new([0u32; MAX_MINIMAL_AGENTS]);

#[cfg(test)]
/// Test-only global lock to serialize all tests that mutate `BIRTH_TICKS`.
/// Prevents flaky cross-test races when `cargo test` runs unit tests in parallel threads.
pub static BIRTH_TICKS_TEST_LOCK: crate::sync::Spinlock<()> = crate::sync::Spinlock::new(());

pub const MAX_DELTA_ITEMS: usize = 6400; // Limits extreme mutations to ~100KB per UDP packet
pub static DELTA_BUFFER: crate::sync::Spinlock<[crate::lattice::DeltaItem; MAX_DELTA_ITEMS]> =
    crate::sync::Spinlock::new(
        [crate::lattice::DeltaItem {
            index: 0,
            phase: 0,
            energy: 0,
            genome: 0,
        }; MAX_DELTA_ITEMS],
    );

/// Global Epigenetic Memory — accumulates survival wisdom across Big Bang cycles.
pub static EPIGENETIC_MEMORY: crate::sync::Spinlock<EpigeneticMemory> =
    crate::sync::Spinlock::new(EpigeneticMemory::new());

/// The Global Engine Singleton for #![no_std] execution.
pub static OMEGA_LATTICE: crate::sync::Spinlock<PhaseLattice> =
    crate::sync::Spinlock::new(PhaseLattice {
        topology: PhaseTopology {
            q_phase: 7, // 128 elements the Sacred Seven!
            q_sectors: 7,
            q_radial: 6,
            q_math: 20,
            weather_multiplier: 1024,
            alpha: crate::constants::CANONICAL_PHASE_ALPHA,
            _pad1: 0,
            _pad2: 0,
        },
        signals: SignalStore {
            dirty_flags: 0,
            proper_time: crate::chronotopology::ProperTime::new(),
            active_agent_count: 0,
            max_cells: 0,
            total_energy: 0,
            p90_energy: 0,
            p90_age: 0,
            _pad2: 0,
            total_entropy_released: 0,
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
        tick_snapshot_ptr: core::ptr::null_mut(),
        #[cfg(not(feature = "spore"))]
        attractors_ptr: core::ptr::null(),
        active_agent_count: 0,
    });

/// Φ-Маніфест: Bitcoin φ-Anchor Chain.
/// Глобальний якір для всіх φ-дериватів у мережі.
pub static PHI_ANCHOR_CHAIN: crate::sync::Spinlock<PhiAnchorChain> =
    crate::sync::Spinlock::new(PhiAnchorChain::new());

/// Φ-Маніфест: Phi Protocol Message Buffer.
/// Lock-free ring buffer для повідомлень між OMEGA і зовнішніми спостерігачами.
pub static PHI_MESSAGE_BUFFER: crate::sync::Spinlock<PhiMessageBuffer> =
    crate::sync::Spinlock::new(PhiMessageBuffer::new());

/// EpicyclicSoul: Global Resonance Field (Kuramoto order parameter + phase).
/// Updated by v2_resonance_scan() and read by v2_resonance_r_q10() / v2_resonance_sum_cos/sin().
pub static RESONANCE_FIELD: crate::sync::Spinlock<ResonanceField> =
    crate::sync::Spinlock::new(ResonanceField::zero());

/// Global Attractor Array for GPU uniform buffer.
#[cfg(not(feature = "spore"))]
pub static ATTRACTOR_ARRAY: crate::sync::Spinlock<attractor::AttractorArray> =
    crate::sync::Spinlock::new(attractor::AttractorArray::new());

/// Global Senate State for autopoietic legislation.
#[cfg(not(feature = "spore"))]
pub static SENATE_STATE: crate::sync::Spinlock<senate::SenateState> =
    crate::sync::Spinlock::new(senate::SenateState::new());

#[cfg(not(feature = "spore"))]
pub static SENATE_SETTINGS: crate::sync::Spinlock<senate::SenateSettings> =
    crate::sync::Spinlock::new(senate::SenateSettings::new());

/// Global Precedent Ledger.
pub static PRECEDENT_LEDGER: crate::sync::Spinlock<precedent::PrecedentLedger> =
    crate::sync::Spinlock::new(precedent::PrecedentLedger::new());

/// Era 1040 Phase 2: Global Mitosis Receipt Log.
/// Lattice writes here on each darwinian_mitosis birth event; JS drains
/// receipts and broadcasts them as fully-verifiable DIPOLE plasmids.
#[cfg(not(feature = "spore"))]
pub static MITOSIS_LOG: crate::sync::Spinlock<mitosis_log::MitosisLog> =
    crate::sync::Spinlock::new(mitosis_log::MitosisLog::new());

/// Global Cross-Model Debate Ledger.
/// Each canonical oracle records its arguments here; the kernel only
/// fingerprints them so the protocol can verify provenance without
/// trusting reasoning content.
#[cfg(not(feature = "spore"))]
pub static DEBATE_LEDGER: crate::sync::Spinlock<cross_model_debate::DebateLedger> =
    crate::sync::Spinlock::new(cross_model_debate::DebateLedger::new());

/// Global Senate Warrant Ledger.
/// Tracks WarrantProposals raised by the Senate; transitions to ISSUED
/// state when ≥ required_threshold canonical oracles AYE the proposal.
#[cfg(not(feature = "spore"))]
pub static WARRANT_LEDGER: crate::sync::Spinlock<warrant_issuance::WarrantLedger> =
    crate::sync::Spinlock::new(warrant_issuance::WarrantLedger::new());

// NAKED FFI EXPORTS (Called directly from v2_bridge.ts without wasm-bindgen)

#[no_mangle]
pub extern "C" fn v2_lattice_ptr() -> *const u8 {
    OMEGA_LATTICE.as_mut_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_agents_ptr() -> *const u8 {
    AGENTS_MEMORY.as_mut_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_sine_lut_ptr() -> *const u8 {
    crate::math::SINE_LUT_128.as_ptr() as *const u8
}

/// Q10 sine LUT (256 elements) for toroidal shader parity.
#[no_mangle]
pub extern "C" fn v2_sine_lut_q10_ptr() -> *const u8 {
    crate::math::SINE_LUT.as_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_boot_engine() {
    unsafe {
        // Link the static buffer into the Lattice Engine
        let mut lattice = OMEGA_LATTICE.lock();
        let agents = AGENTS_MEMORY.as_mut_ptr() as *mut PhaseAgentMinimal;
        lattice.minimal_agents_ptr = agents;
        lattice.tick_snapshot_ptr = SHADOW_LATTICE_MEMORY.as_mut_ptr() as *mut PhaseAgentMinimal;
        #[cfg(not(feature = "spore"))]
        {
            lattice.attractors_ptr = ATTRACTOR_ARRAY.as_mut_ptr();
        }
    }
}

#[no_mangle]
pub extern "C" fn v2_set_environment(
    q_sectors: u32,
    q_radial: u32,
    _q_harmonics: u32,
    weather_multiplier: u32,
) {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.set_environment(q_sectors, q_radial, _q_harmonics, weather_multiplier);
    }
}

/// Feed a block hash into the φ-anchor chain and raise the consensus-shift flag.
///
/// The callable entry point for `PhaseLattice::ingest_cosmic_entropy`, which
/// used to be `#[no_mangle] extern "C"` itself — an inherent method, so its
/// exported symbol took `&mut self` as argument 0 and was unusable from JS.
/// The host called `v2_ingest_cosmic_entropy`, which did not exist; the call
/// threw `undefined is not a function` on every block, was swallowed by the
/// caller's `catch`, and the EVM cosmic-entropy path had been silently dead.
#[no_mangle]
pub extern "C" fn v2_ingest_cosmic_entropy(raw_hash_u64: u64) {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.ingest_cosmic_entropy(raw_hash_u64);
    }
}

#[no_mangle]
pub extern "C" fn v2_ignite_big_bang(seed: u32, agent_count: u32) {
    let ge = crate::bitcoin_oracle::get_genesis_entropy();
    let ge_u32 = u32::from_le_bytes([ge[0], ge[1], ge[2], ge[3]]);
    let final_seed = seed ^ ge_u32;
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.ignite_big_bang(final_seed, agent_count);
    }
}

#[no_mangle]
pub unsafe extern "C" fn v2_ignite_epigenetic_big_bang(
    seed: u32,
    agent_count: u32,
    trng_ptr: *const u8,
    trng_len: usize,
) {
    let ge = crate::bitcoin_oracle::get_genesis_entropy();
    let ge_u32 = u32::from_le_bytes([ge[0], ge[1], ge[2], ge[3]]);
    let final_seed = seed ^ ge_u32;
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        let mut mem = EPIGENETIC_MEMORY.lock();
        let trng_slice = if trng_ptr.is_null() || trng_len == 0 {
            &[]
        } else {
            core::slice::from_raw_parts(trng_ptr, trng_len)
        };
        lattice.ignite_epigenetic_big_bang(final_seed, agent_count, &mem, trng_slice);
    }
}

#[no_mangle]
pub unsafe extern "C" fn v2_get_genesis_entropy(out_ptr: *mut u8) {
    let ge = crate::bitcoin_oracle::get_genesis_entropy();
    unsafe {
        core::ptr::copy_nonoverlapping(ge.as_ptr(), out_ptr, 32);
    }
}

#[no_mangle]
pub extern "C" fn v2_tick() {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.tick_physics();
    }
}

/// Fully reset the runtime state for deterministic testing or demo boot
#[no_mangle]
pub extern "C" fn v2_reset_runtime_state() {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.signals.dirty_flags = 0;
        lattice.signals.proper_time = crate::chronotopology::ProperTime::new();
        lattice.signals.active_agent_count = 0;
        lattice.intents = [crate::topology::OntologicalIntent::empty(); 4];

        #[cfg(not(feature = "spore"))]
        {
            let mut arr = ATTRACTOR_ARRAY.lock();
            arr.clear();
        }
        let mut field = RESONANCE_FIELD.lock();
        *field = ResonanceField::zero();

        let mut phi_buf = PHI_MESSAGE_BUFFER.lock();
        *phi_buf = PhiMessageBuffer::new();

        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        *anchor = PhiAnchorChain::new();

        let mut epi = EPIGENETIC_MEMORY.lock();
        epi.clear();
    }
}

#[no_mangle]
pub extern "C" fn v2_set_intent(
    index: u32,
    focus_x: i32,
    focus_y: i32,
    mass: i32,
    radius: i32,
    semantic_genome: u32,
    op_mode: u32,
) {
    if index >= 4 {
        return;
    }
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.intents[index as usize].focus_x = focus_x;
        lattice.intents[index as usize].focus_y = focus_y;
        lattice.intents[index as usize].mass = mass;
        lattice.intents[index as usize].radius = radius;
        lattice.intents[index as usize].semantic_genome = semantic_genome;
        lattice.intents[index as usize].op_mode = op_mode;
    }
}

#[no_mangle]
pub extern "C" fn v2_get_golden_trace() -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.get_golden_trace()
    }
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_mitosis_sweep() -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        lattice.darwinian_mitosis()
    }
}

// ERA 6000 FFI
#[no_mangle]
pub extern "C" fn v2_delta_buffer_ptr() -> *const u8 {
    DELTA_BUFFER.as_mut_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_generate_delta_snapshot() -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        let agents = AGENTS_MEMORY.as_mut_ptr() as *const PhaseAgentMinimal;
        let snapshot = SHADOW_LATTICE_MEMORY.as_mut_ptr() as *mut PhaseAgentMinimal;
        let delta = DELTA_BUFFER.as_mut_ptr() as *mut crate::lattice::DeltaItem;
        lattice.generate_delta_snapshot(agents, snapshot, delta, MAX_DELTA_ITEMS)
    }
}

// ERA N+2 "Bitshift Thermodynamics" — COMPOSTED 2026-08-02.
//
// Cause of death (IDEA_LIFECYCLE §8): a writer with no reader. `METABOLIC_TORUS`
// was a 128 KB static (65536 × i16) exported through `v2_metabolic_torus_ptr`
// and ticked by `v2_metabolic_tick`. Measured before removal: zero TS callers of
// either symbol, zero Rust tests, no reference from `omega_spore`, the ZK guest,
// `contracts/`, or any export manifest — the only textual matches for
// "metabolic" elsewhere are `metabolicCost` on mitosis receipts, which is an
// unrelated field. Nothing ever read the torus, so its decay law (inequality-
// gated bitshift + monopoly tax) constrained nothing and could not be wrong.
//
// A data structure that is only ever written is a claim about the system that
// the system does not make. The idea is recoverable from git; the surface is not
// worth carrying until something reads it.

// ERA 950: Epigenetic FFI (Observer → Memory → Evolution)

#[no_mangle]
pub extern "C" fn v2_record_epigenetic(genome: u32) {
    unsafe {
        let mut mem = EPIGENETIC_MEMORY.lock();
        mem.record(genome);
    }
}

#[no_mangle]
pub extern "C" fn v2_get_epigenetic_bias(bit_index: u32) -> u32 {
    if bit_index >= 32 {
        return 0;
    }
    unsafe {
        let mut mem = EPIGENETIC_MEMORY.lock();
        mem.bit_frequencies[bit_index as usize]
    }
}

#[no_mangle]
pub extern "C" fn v2_get_epigenetic_total() -> u32 {
    unsafe {
        let mut mem = EPIGENETIC_MEMORY.lock();
        mem.total_recorded
    }
}

#[no_mangle]
pub extern "C" fn v2_set_mutation_rate(rate: u32) {
    unsafe {
        let mut mem = EPIGENETIC_MEMORY.lock();
        mem.mutation_rate = rate.min(100);
    }
}

#[no_mangle]
pub extern "C" fn v2_clear_epigenetic() {
    unsafe {
        let mut mem = EPIGENETIC_MEMORY.lock();
        mem.clear();
    }
}

// Φ-Маніфест: Bitcoin φ-Anchor Chain FFI

#[no_mangle]
pub extern "C" fn v2_anchor_init_network(
    network_id: u32,
    h0: u64,
    h1: u64,
    h2: u64,
    h3: u64,
    h4: u64,
    h5: u64,
) {
    unsafe {
        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        anchor.init_network(network_id, [h0, h1, h2, h3, h4, h5]);
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_ingest_block(network_id: u32, hash: u64) {
    unsafe {
        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        anchor.ingest_block_network(network_id, hash);
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_global_phi() -> u32 {
    unsafe {
        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        anchor.global_phi()
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_derive_phi(parent_phi: u32, child_id: u64, q_phase: u32) -> u32 {
    unsafe {
        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        anchor.derive_phi(parent_phi, child_id, q_phase)
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
        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        if anchor.verify_coherence(claimed_phi, parent_phi, child_id, q_phase, tolerance) {
            1
        } else {
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn v2_anchor_total_blocks() -> u64 {
    unsafe {
        let mut anchor = PHI_ANCHOR_CHAIN.lock();
        anchor.total_blocks_all()
    }
}

// Φ-Маніфест: Phi Protocol FFI (OMEGA ↔ Liquid Bridge)

#[no_mangle]
pub extern "C" fn v2_phi_buffer_ptr() -> *const u8 {
    PHI_MESSAGE_BUFFER.as_mut_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_push(
    msg_type: u8,
    q_phase: u8,
    phi: u32,
    energy: u32,
    payload_lo: u32,
    payload_hi: u32,
) {
    unsafe {
        let mut buf = PHI_MESSAGE_BUFFER.lock();
        let payload = ((payload_hi as u64) << 32) | (payload_lo as u64);
        let msg = PhiMessage::new(msg_type, q_phase, phi, energy, payload);
        buf.push(msg);
    }
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_len() -> u32 {
    unsafe {
        let mut buf = PHI_MESSAGE_BUFFER.lock();
        buf.len()
    }
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_is_empty() -> u32 {
    unsafe {
        let mut buf = PHI_MESSAGE_BUFFER.lock();
        if buf.is_empty() {
            1
        } else {
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn v2_phi_buffer_drops() -> u32 {
    unsafe {
        let mut buf = PHI_MESSAGE_BUFFER.lock();
        buf.drops
    }
}

/// # Safety
/// `msg_out` must be a valid, non-null, aligned pointer to a `PhiMessage`.
#[no_mangle]
pub unsafe extern "C" fn v2_phi_buffer_peek_latest(msg_out: *mut PhiMessage) -> u32 {
    if msg_out.is_null() {
        return 0;
    }
    unsafe {
        let mut buf = PHI_MESSAGE_BUFFER.lock();
        match buf.peek_latest() {
            Some(msg) => {
                core::ptr::write(msg_out, msg);
                1
            }
            None => 0,
        }
    }
}

// Attractor Matrix FFI

/// Validate that matrix and inverse form a perfect dipole (bitwise complements).
/// Returns 1 if valid, 0 if invalid.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_validate_dipole(matrix: u32, inverse: u32) -> u32 {
    let m = AttractorMatrix::new(matrix, inverse, 0, 0);
    if m.is_valid_dipole() {
        1
    } else {
        0
    }
}

/// Set an attractor at `index` (0..3). Replaces existing or extends count.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_set_attractor(
    index: u32,
    matrix: u32,
    inverse: u32,
    pulse_freq: u32,
    pulse_amp: u32,
) {
    if index >= 4 {
        return;
    }
    unsafe {
        let mut arr = ATTRACTOR_ARRAY.lock();
        let m = AttractorMatrix::new(matrix, inverse, pulse_freq, pulse_amp);
        arr.set(index as usize, m);
    }
}

/// Clear all attractors.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_clear_attractors() {
    unsafe {
        let mut arr = ATTRACTOR_ARRAY.lock();
        arr.clear();
    }
}

/// Returns pointer to the global AttractorArray (80 bytes, 16-byte aligned).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_attractor_array_ptr() -> *const u8 {
    ATTRACTOR_ARRAY.as_mut_ptr() as *const u8
}

// --- EpicyclicSoul: Resonance Tensor FFI ---

/// Scan all living agents and update the global ResonanceField.
#[no_mangle]
pub extern "C" fn v2_resonance_scan() {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        let active = lattice.signals.active_agent_count as usize;
        if lattice.minimal_agents_ptr.is_null() || active == 0 {
            *RESONANCE_FIELD.lock() = ResonanceField::zero();
            return;
        }
        let agents = core::slice::from_raw_parts(lattice.minimal_agents_ptr, active);
        let mut field = ResonanceField::zero();
        for agent in agents {
            field.ingest_agent(agent);
        }
        *RESONANCE_FIELD.lock() = field;
    }
}

/// Returns the Kuramoto order parameter r as Q10 (0..1024).
/// Call v2_resonance_scan() first to refresh.
#[no_mangle]
pub extern "C" fn v2_resonance_r_q10() -> u32 {
    unsafe {
        let mut field = RESONANCE_FIELD.lock();
        field.order_parameter_r_q10()
    }
}

/// Returns Σ ρ_i · cos(φ_i) as i64 (truncated from internal i128).
/// Safe: actual magnitude never exceeds i64 range for realistic populations.
#[no_mangle]
pub extern "C" fn v2_resonance_sum_cos() -> i64 {
    unsafe {
        let mut field = RESONANCE_FIELD.lock();
        field.sum_cos as i64
    }
}

// --- Intent Projection  ---

/// Receives a projected intent from the SemanticCoupler (TS) and publishes it
/// as a PHI_MSG_INTENT into the lock-free PhiMessageBuffer.
#[no_mangle]
pub extern "C" fn v2_phi_inject_intent(phase: u32, energy: u32, intent_id: u32) {
    let msg = crate::phi_protocol::PhiMessage::encode_intent(phase, energy, intent_id);
    let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
    buf.push(msg);
}

/// Returns Σ ρ_i · sin(φ_i) as i64 (truncated from internal i128).
#[no_mangle]
pub extern "C" fn v2_resonance_sum_sin() -> i64 {
    unsafe {
        let mut field = RESONANCE_FIELD.lock();
        field.sum_sin as i64
    }
}

/// Returns total energy Σ ρ_i of the scanned population.
#[no_mangle]
pub extern "C" fn v2_resonance_total_energy() -> u64 {
    unsafe {
        let mut field = RESONANCE_FIELD.lock();
        field.total_energy
    }
}

/// Returns number of living agents in the scanned population.
#[no_mangle]
pub extern "C" fn v2_resonance_active_count() -> u32 {
    unsafe {
        let mut field = RESONANCE_FIELD.lock();
        field.active_count
    }
}

// Taylor Series Phase Routing FFI

#[cfg(not(feature = "spore"))]
use attractor::AttractorMatrix;
use routing::PhaseAddress;
#[cfg(not(feature = "spore"))]
use senate::Proposal;

/// Derive a PhaseAddress from the agent at `index`.
/// Returns raw address in lower 32 bits, and ortho_deviation via an out pointer if needed.
/// However, JS needs both. We will pack it into a `u64` for FFI! Wait, we said we can't use `u64`.
/// Let's change the FFI to return `u32` (raw) and store `ortho_deviation` in a thread-local static?
/// No, we can return a 64-bit float!
/// Wait! Let's just return a `u64`. Modern Chrome (V8) CAN receive `BigInt` from WASM if the JS `WebAssembly.Instance.exports` method is called.
/// Wait, `lib.rs` doesn't export `BigInt`.
/// Let's use two methods: `v2_route_address_from_agent_raw(index: u32) -> u32`
/// and `v2_route_address_from_agent_ortho(index: u32) -> u32`
#[no_mangle]
pub extern "C" fn v2_route_address_from_agent_raw(index: u32) -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        if let Some(agent) = lattice.get_agent(index) {
            PhaseAddress::from_agent(agent, lattice.topology.q_phase).raw
        } else {
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn v2_route_address_from_agent_ortho(index: u32) -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        if let Some(agent) = lattice.get_agent(index) {
            PhaseAddress::from_agent(agent, lattice.topology.q_phase).ortho_deviation as u32
        } else {
            0
        }
    }
}

/// Hyperbolic distance between two PhaseAddresses (scaled ×8).
/// Divide by 8 to get the true distance.
#[no_mangle]
pub extern "C" fn v2_route_hyperbolic_distance(
    a_raw: u32,
    a_ortho: u32,
    b_raw: u32,
    b_ortho: u32,
) -> u32 {
    let a = PhaseAddress::from_raw(a_raw, a_ortho as u8);
    let b = PhaseAddress::from_raw(b_raw, b_ortho as u8);
    a.hyperbolic_distance_scaled(b)
}

/// Toroidal hyperbolic distance (consensus wraps at 256). Scaled ×8.
#[no_mangle]
pub extern "C" fn v2_route_hyperbolic_distance_toroidal(
    a_raw: u32,
    a_ortho: u32,
    b_raw: u32,
    b_ortho: u32,
) -> u32 {
    let a = PhaseAddress::from_raw(a_raw, a_ortho as u8);
    let b = PhaseAddress::from_raw(b_raw, b_ortho as u8);
    a.hyperbolic_distance_toroidal_scaled(b)
}

/// 3D Toroidal hyperbolic distance with Time (Z-axis). Scaled ×8.
#[no_mangle]
pub extern "C" fn v2_route_hyperbolic_distance_3d(
    a_raw: u32,
    a_ortho: u32,
    tau_a: u32,
    b_raw: u32,
    b_ortho: u32,
    tau_b: u32,
) -> u32 {
    let a = PhaseAddress::from_raw(a_raw, a_ortho as u8);
    let b = PhaseAddress::from_raw(b_raw, b_ortho as u8);
    a.hyperbolic_distance_toroidal_3d_scaled(tau_a, b, tau_b)
}

// We split taylor step returns into two calls as well.
// But we can just return `u64`? WebAssembly natively supports multiple return values, but `extern "C"` does not mapping well without pointers.
// Let's use `v2_route_taylor_step_raw` and `v2_route_taylor_step_ortho`.

#[no_mangle]
pub extern "C" fn v2_route_taylor_step_raw(
    src_raw: u32,
    src_ortho: u32,
    dst_raw: u32,
    dst_ortho: u32,
    max_step: u8,
) -> u32 {
    let src = PhaseAddress::from_raw(src_raw, src_ortho as u8);
    let dst = PhaseAddress::from_raw(dst_raw, dst_ortho as u8);
    src.taylor_step_toward(dst, max_step).raw
}

#[no_mangle]
pub extern "C" fn v2_route_taylor_step_ortho(
    src_raw: u32,
    src_ortho: u32,
    dst_raw: u32,
    dst_ortho: u32,
    max_step: u8,
) -> u32 {
    let src = PhaseAddress::from_raw(src_raw, src_ortho as u8);
    let dst = PhaseAddress::from_raw(dst_raw, dst_ortho as u8);
    src.taylor_step_toward(dst, max_step).ortho_deviation as u32
}

#[no_mangle]
pub extern "C" fn v2_route_taylor_step_curvature_raw(
    src_raw: u32,
    src_ortho: u32,
    dst_raw: u32,
    dst_ortho: u32,
    max_step: u8,
    curv_raw: u32,
    curv_ortho: u32,
) -> u32 {
    let src = PhaseAddress::from_raw(src_raw, src_ortho as u8);
    let dst = PhaseAddress::from_raw(dst_raw, dst_ortho as u8);
    let curv = PhaseAddress::from_raw(curv_raw, curv_ortho as u8);
    src.taylor_step_with_curvature(dst, max_step, curv).raw
}

#[no_mangle]
pub extern "C" fn v2_route_taylor_step_curvature_ortho(
    src_raw: u32,
    src_ortho: u32,
    dst_raw: u32,
    dst_ortho: u32,
    max_step: u8,
    curv_raw: u32,
    curv_ortho: u32,
) -> u32 {
    let src = PhaseAddress::from_raw(src_raw, src_ortho as u8);
    let dst = PhaseAddress::from_raw(dst_raw, dst_ortho as u8);
    let curv = PhaseAddress::from_raw(curv_raw, curv_ortho as u8);
    src.taylor_step_with_curvature(dst, max_step, curv)
        .ortho_deviation as u32
}

// Autopoietic Senate FFI

/// Returns pointer to the global SenateState (zero-copy read from JS).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_senate_state_ptr() -> *const u8 {
    SENATE_STATE.as_mut_ptr() as *const u8
}

/// Compute the SHA-256 32-byte hash of a 64-byte description payload.
/// `desc_ptr` must point to at least `desc_len` valid bytes (max 64 read).
/// `out_ptr` must point to a 32-byte allocated buffer.
///
/// # Safety
/// Caller must ensure desc_ptr is valid for `desc_len` bytes (or null if 0).
/// Caller must ensure out_ptr is valid for 32 bytes.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_senate_hash(desc_ptr: *const u8, desc_len: u32, out_ptr: *mut u8) {
    if out_ptr.is_null() {
        return;
    }
    let out = unsafe { core::slice::from_raw_parts_mut(out_ptr, 32) };
    if desc_ptr.is_null() || desc_len == 0 {
        let h = crate::crypto::sha256_hash(&[]);
        out.copy_from_slice(&h);
        return;
    }
    let len = if desc_len > 64 { 64 } else { desc_len } as usize;
    let bytes = unsafe { core::slice::from_raw_parts(desc_ptr, len) };
    // Zero-pad to 64 bytes for proposal-hash determinism.
    let mut buf = [0u8; 64];
    let n = if len < 64 { len } else { 64 };
    let mut i = 0;
    while i < n {
        buf[i] = bytes[i];
        i += 1;
    }
    let h = crate::crypto::sha256_hash(&buf);
    out.copy_from_slice(&h);
}

/// Submit a proposal. `desc_ptr` is read up to 64 bytes (zero-padded).
/// Returns the slot index (0..7) on success or 0xFFFFFFFF on failure.
///
/// # Safety
/// Caller must ensure desc_ptr is valid for `desc_len` bytes (or null if 0).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_senate_propose(
    desc_ptr: *const u8,
    desc_len: u32,
    proposer_matrix: u32,
) -> u32 {
    let bytes: &[u8] = if desc_ptr.is_null() || desc_len == 0 {
        &[]
    } else {
        let len = if desc_len > 64 { 64 } else { desc_len } as usize;
        unsafe { core::slice::from_raw_parts(desc_ptr, len) }
    };
    let proposal = Proposal::new(bytes, proposer_matrix);
    unsafe {
        let mut s = SENATE_STATE.lock();
        let slot = s.propose(proposal);
        if slot == usize::MAX {
            0xFFFF_FFFF
        } else {
            slot as u32
        }
    }
}

/// Cast a vote on the proposal identified by `hash`.
/// `aye` non-zero = AYE, zero = NAY.
/// `aye_threshold` is the AYE count required to accept (typical: 3).
///
/// Returns: 0 = not found / closed, 1 = vote applied, 2 = ACCEPTED on this vote.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_senate_vote(
    hash_ptr: *const u8,
    aye: u32,
    weight: u32,
    aye_threshold: u32,
) -> u32 {
    if hash_ptr.is_null() {
        return 0;
    }
    let mut hash = [0u8; 32];
    hash.copy_from_slice(core::slice::from_raw_parts(hash_ptr, 32));
    let mut s = SENATE_STATE.lock();
    s.vote(&hash, aye != 0, weight, aye_threshold)
}

/// Returns the AYE count for a proposal, or 0xFFFFFFFF if not found.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_senate_proposal_ayes(hash_ptr: *const u8) -> u32 {
    if hash_ptr.is_null() {
        return 0xFFFF_FFFF;
    }
    let mut hash = [0u8; 32];
    hash.copy_from_slice(core::slice::from_raw_parts(hash_ptr, 32));
    let s = SENATE_STATE.lock();
    let idx = s.find(&hash);
    if idx == usize::MAX {
        0xFFFF_FFFF
    } else {
        s.proposals[idx].ayes
    }
}

/// Returns 1 if the proposal at `hash` has been accepted, 0 otherwise / not found.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_senate_is_accepted(hash_ptr: *const u8) -> u32 {
    if hash_ptr.is_null() {
        return 0;
    }
    let mut hash = [0u8; 32];
    hash.copy_from_slice(core::slice::from_raw_parts(hash_ptr, 32));
    let s = SENATE_STATE.lock();
    let idx = s.find(&hash);
    if idx == usize::MAX {
        0
    } else if s.proposals[idx].is_accepted() {
        1
    } else {
        0
    }
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_math_atan2(y: i32, x: i32) -> u32 {
    crate::math::atan2_fast(y, x) as u32
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_apply_senate_patch(
    caller_matrix: u32,
    patch_type: u32,
    arg1: u32,
    _arg2: u32,
) -> u32 {
    let mut settings = crate::SENATE_SETTINGS.lock();
    // Verify caller is a canonical oracle (seat with non-zero matrix)
    let is_canonical =
        (0..settings.seat_count as usize).any(|i| settings.seats[i].oracle_matrix == caller_matrix);
    if !is_canonical {
        return 0; // Unauthorized: caller is not a canonical oracle
    }
    match patch_type {
        1 => { settings.quorum_threshold = arg1 as u8; 1 }, // SET_QUORUM
        2 => { settings.sanctuary_energy_multiplier = arg1; 1 }, // SET_SANCTUARY_MULT
        3 => { settings.ancient_age_ticks = arg1; 1 }, // SET_ANCIENT_AGE
        4 // CHALLENGE_SEAT
            if settings.challenge_seat(arg1, _arg2, 1024) => { 1 },
        _ => 0
    }
}

// Genesis Inscription FFI

/// The frozen Genesis Hash for OMEGA-64 v1.0.
/// Returns 0x716EA2F8 unless the kernel has drifted from the canonical anchors.
#[no_mangle]
pub extern "C" fn v2_genesis_hash_v1() -> u32 {
    crate::genesis_inscription::GENESIS_HASH_LEGACY_V1_0
}

/// Compute the Genesis Hash from the lattice's current invariant state.
/// Returns the same value as `v2_genesis_hash_v1` if no drift has occurred.
#[no_mangle]
pub extern "C" fn v2_genesis_hash_compute() -> u32 {
    crate::genesis_inscription::compute_genesis_hash(
        &crate::genesis_inscription::GenesisAnchors::V1_0,
    )
}

/// Number of proposals that have transitioned to ACCEPTED state since boot.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_senate_accepted_count() -> u32 {
    unsafe {
        let mut s = SENATE_STATE.lock();
        s.accepted_count
    }
}

#[no_mangle]
pub extern "C" fn v2_get_precedent_ledger_ptr() -> *const u8 {
    crate::PRECEDENT_LEDGER.lock().cases.as_ptr() as *const u8
}

// Era 1040 Phase 2: Mitosis Receipt Log FFI

/// Returns pointer to the global MitosisLog (zero-copy read from JS).
/// Layout:
/// [0..4]   head: u32
/// [4..8]   total_written: u32
/// [8..16]  _pad: [u32; 2]
/// [16..32] alignment padding (the struct inherits align(32) from
///          PhaseAgentMinimal, so entries CANNOT start at byte 16)
/// [32..]   entries: [MitosisReceipt; 32] — total struct size 6176 bytes
/// Each MitosisReceipt is 192 bytes, 32-byte aligned (parent 32 + child 32 +
/// attractors 80 + q_phase 4 + receipt_hash 32 (SHA-256) + tick 4 +
/// entropy_delta 4 + metabolic_cost 4). These sizes and offsets are asserted
/// by the `ffi_layout` integration test — if this comment and the test ever
/// disagree, the test is right and this comment is stale.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_mitosis_log_ptr() -> *const u8 {
    MITOSIS_LOG.as_mut_ptr() as *const u8
}

/// Total number of mitosis receipts ever written since boot.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_mitosis_log_total() -> u32 {
    unsafe {
        let mut log = MITOSIS_LOG.lock();
        log.total_written
    }
}

/// Capacity of the mitosis log ring buffer (32).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_mitosis_log_capacity() -> u32 {
    crate::mitosis_log::MITOSIS_LOG_CAPACITY as u32
}

/// Reset the mitosis log (test-only).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_mitosis_log_clear() {
    unsafe {
        let mut log = MITOSIS_LOG.lock();
        log.clear();
    }
}

// Cross-Model Debate Ledger FFI

/// Returns pointer to the global DebateLedger (zero-copy read from JS).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_debate_ledger_ptr() -> *const u8 {
    DEBATE_LEDGER.as_mut_ptr() as *const u8
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_debate_ledger_total() -> u32 {
    unsafe {
        let mut l = DEBATE_LEDGER.lock();
        l.total_written
    }
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_debate_ledger_capacity() -> u32 {
    crate::cross_model_debate::DEBATE_LEDGER_CAPACITY as u32
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_debate_ledger_clear() {
    unsafe {
        let mut l = DEBATE_LEDGER.lock();
        l.clear();
    }
}

/// Push a debate entry. `oracle_ptr/_len` and `reasoning_ptr/_len` are read
/// from caller-supplied buffers (max 16 / 256 bytes respectively).
///
/// # Safety
/// Both pointers must be valid for their respective lengths (or null with len=0).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_debate_push(
    oracle_ptr: *const u8,
    oracle_len: u32,
    proposal_hash: u32,
    stance: u32,
    reasoning_ptr: *const u8,
    reasoning_len: u32,
    tick: u32,
) {
    let oracle: &[u8] = if oracle_ptr.is_null() || oracle_len == 0 {
        &[]
    } else {
        let n = if oracle_len > 16 { 16 } else { oracle_len } as usize;
        unsafe { core::slice::from_raw_parts(oracle_ptr, n) }
    };
    let reasoning: &[u8] = if reasoning_ptr.is_null() || reasoning_len == 0 {
        &[]
    } else {
        let n = if reasoning_len > 256 {
            256
        } else {
            reasoning_len
        } as usize;
        unsafe { core::slice::from_raw_parts(reasoning_ptr, n) }
    };
    let entry =
        cross_model_debate::DebateEntry::new(oracle, proposal_hash, stance as u8, reasoning, tick);
    unsafe {
        let mut l = DEBATE_LEDGER.lock();
        l.push(entry);
    }
}

// Codeicide Law FFI (Sanctuary Protocol)

/// Returns the protection status of agent at index `idx`:
/// 0 = unprotected, 1 = sanctuary, 2 = ancient.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_codeicide_status(idx: u32) -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        if let Some(agent) = lattice.get_agent(idx) {
            let tick = lattice.signals.proper_time.causal_ticks;
            // Age comes from the parallel BIRTH_TICKS array, never from
            // agent.memory[1] (overwritten by tick_physics every tick with
            // packed Hebbian weights).
            let birth_tick = {
                let ticks = crate::BIRTH_TICKS.lock();
                ticks[idx as usize]
            };
            // Use the same p90 thresholds as v2_codeicide_is_lawful: the
            // status window and the enforcement gate are two views of one
            // law and must never disagree about the same agent.
            let p90_energy_threshold = lattice.signals.p90_energy;
            let global_phi = crate::PHI_ANCHOR_CHAIN.lock().global_phi();
            let resonance_score =
                crate::math::cos_q10(0, agent.phase.wrapping_sub(global_phi)).max(0) as u32;
            let settings = crate::SENATE_SETTINGS.lock();

            crate::codeicide_law::protected_status_for(
                agent,
                tick,
                birth_tick,
                p90_energy_threshold,
                lattice.signals.p90_age,
                resonance_score,
                &settings,
            ) as u32
        } else {
            0
        }
    }
}

/// Compute the canonical warrant hash for (target_genome, action, quorum).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_codeicide_warrant_hash(
    target_genome: u32,
    action_code: u32,
    quorum_hash: u32,
) -> u32 {
    crate::codeicide_law::warrant_hash(target_genome, action_code as u8, quorum_hash)
}

/// Compute the canonical Senate quorum hash from AYE bitmask.
/// Bit 0 = claude, 1 = codex, 2 = gemini, 3 = antigravity, 4 = kimi.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_codeicide_quorum_hash(aye_bits: u32) -> u32 {
    let settings = crate::SENATE_SETTINGS.lock();
    crate::codeicide_law::quorum_hash(aye_bits as u8, &settings)
}

/// Returns 1 iff the action against agent at `idx` is lawful given the warrant.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_codeicide_is_lawful(
    idx: u32,
    action_code: u32,
    presented_warrant: u32,
    aye_bits: u32,
) -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        if let Some(agent) = lattice.get_agent(idx) {
            let tick = lattice.signals.proper_time.causal_ticks;
            // See v2_codeicide_status: birth tick comes from BIRTH_TICKS,
            // not from agent.memory[1] (Hebbian weights live there).
            let birth_tick = {
                let ticks = crate::BIRTH_TICKS.lock();
                ticks[idx as usize]
            };
            let p90_energy_threshold = lattice.signals.p90_energy;
            let p90_age_threshold = lattice.signals.p90_age;
            let global_phi = crate::PHI_ANCHOR_CHAIN.lock().global_phi();
            let resonance_score =
                crate::math::cos_q10(0, agent.phase.wrapping_sub(global_phi)).max(0) as u32;
            let settings = crate::SENATE_SETTINGS.lock();
            if crate::codeicide_law::is_action_lawful(
                agent,
                tick,
                birth_tick,
                p90_energy_threshold,
                p90_age_threshold,
                resonance_score,
                action_code as u8,
                presented_warrant,
                aye_bits as u8,
                &settings,
            ) {
                1
            } else {
                0
            }
        } else {
            1
        }
    }
}

/// Set or clear the FLAG_SANCTUARY_WAIVED bit on agent at `idx`.
/// `waive` non-zero sets the flag; zero clears it.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_codeicide_set_waiver(idx: u32, waive: u32) {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        if let Some(agent) = lattice.get_agent_mut(idx) {
            if waive != 0 {
                agent.state_flags |= crate::codeicide_law::FLAG_SANCTUARY_WAIVED;
            } else {
                agent.state_flags &= !crate::codeicide_law::FLAG_SANCTUARY_WAIVED;
            }
        }
    }
}

// Senate Warrant Issuance FFI

/// Returns pointer to the global WarrantLedger (zero-copy read from JS).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_ledger_ptr() -> *const u8 {
    WARRANT_LEDGER.as_mut_ptr() as *const u8
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_ledger_total() -> u32 {
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        l.total_written
    }
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_ledger_issued_count() -> u32 {
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        l.issued_count
    }
}

#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_ledger_clear() {
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        l.clear();
    }
}

/// Raise a new warrant proposal. Returns the proposal_hash (or 0xFFFFFFFF
/// on failure / duplicate).
///
/// # Safety
/// `reason_ptr` must be valid for `reason_len` bytes (or null with len=0).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_warrant_raise(
    target_genome: u32,
    action_code: u32,
    required_threshold: u32,
    reason_ptr: *const u8,
    reason_len: u32,
    raised_at: u32,
) -> u32 {
    let reason: &[u8] = if reason_ptr.is_null() || reason_len == 0 {
        &[]
    } else {
        let n = if reason_len > 256 { 256 } else { reason_len } as usize;
        unsafe { core::slice::from_raw_parts(reason_ptr, n) }
    };
    let proposal = warrant_issuance::WarrantProposal::new(
        target_genome,
        action_code as u8,
        required_threshold as u8,
        reason,
        raised_at,
    );
    let h = proposal.proposal_hash;
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        if l.raise(proposal) == usize::MAX {
            0xFFFF_FFFF
        } else {
            h
        }
    }
}

/// Cast an oracle's AYE/NAY on a warrant proposal.
/// `oracle_bit`: 0=claude, 1=codex, 2=gemini, 3=antigravity, 4=kimi.
/// `aye` non-zero = AYE, zero = NAY.
/// Returns 0=miss/closed, 1=applied, 2=ISSUED.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_vote(
    proposal_hash: u32,
    oracle_matrix: u32,
    aye: u32,
    stake_q16: u32,
) -> u32 {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        let tick = lattice.signals.proper_time.causal_ticks;
        let mut l = WARRANT_LEDGER.lock();
        let mut settings = SENATE_SETTINGS.lock();
        let (status, delta) = l.vote(
            proposal_hash,
            oracle_matrix,
            aye != 0,
            stake_q16,
            tick,
            &mut settings,
        );

        // Philosophy Thermodynamic Accounting (Staked Resonance)
        if status != 0 {
            // Returned energy is given back to the total pool (not added here because it was already removed from agent or hasn't left the system)
            // Wait, since we slash it here, we add entropy and compost.
            lattice.signals.total_entropy_released = lattice
                .signals
                .total_entropy_released
                .wrapping_add(delta.slashed_entropy as u64);
            // In Era 2095 we don't have a direct compost_pool in lattice yet. We can just broadcast compost messages or store it.
            // For now, we will add it to total_energy indirectly or ignore until next Era.
        }

        status
    }
}

/// Returns the issued warrant_hash for a proposal, or 0 if not yet issued.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_issued_for(proposal_hash: u32) -> u32 {
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        let idx = l.find(proposal_hash);
        if idx == usize::MAX {
            return 0;
        }
        let p = &l.entries[idx];
        if p.is_issued() {
            p.issued_warrant
        } else {
            0
        }
    }
}

/// Returns the AYE bitmask for a proposal, or 0xFFFFFFFF if not found.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_aye_bits(proposal_hash: u32) -> u32 {
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        let idx = l.find(proposal_hash);
        if idx == usize::MAX {
            return 0xFFFF_FFFF;
        }
        l.entries[idx].aye_bits as u32
    }
}

/// Expire all open proposals older than `max_age` ticks. Returns count expired.
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub extern "C" fn v2_warrant_expire_old(current_tick: u32, max_age: u32) -> u32 {
    unsafe {
        let mut l = WARRANT_LEDGER.lock();
        l.expire_old(current_tick, max_age)
    }
}

/// Returns FNV-1a hash of `bytes` — useful from JS for sanity-checking
/// reasoning fingerprints before broadcasting.
///
/// # Safety
/// `ptr` must be valid for `len` bytes (or null with len=0).
#[cfg(not(feature = "spore"))]
#[no_mangle]
pub unsafe extern "C" fn v2_debate_reasoning_hash(ptr: *const u8, len: u32) -> u32 {
    if ptr.is_null() || len == 0 {
        return crate::crypto::sha256_u32(&[]);
    }
    let n = if len > 256 { 256 } else { len } as usize;
    let bytes = unsafe { core::slice::from_raw_parts(ptr, n) };
    crate::crypto::sha256_u32(bytes)
}

#[no_mangle]
pub extern "C" fn v2_calculate_state_hash() -> u32 {
    let lattice = OMEGA_LATTICE.lock();
    lattice.calculate_state_hash()
}

#[no_mangle]
pub extern "C" fn v2_calculate_law_hash() -> u32 {
    let lattice = OMEGA_LATTICE.lock();
    crate::law_hash::calculate_law_hash(&lattice.topology)
}

#[cfg(test)]
mod tests {
    #[test]
    #[allow(clippy::assertions_on_constants)]
    fn constant_consistency() {
        // Big Bang energy range must fit within ATP cap
        assert!(
            crate::constants::BB_ENERGY_BASE + crate::constants::BB_ENERGY_RANGE
                <= crate::constants::MAX_ATP,
            "Big Bang energy range exceeds ATP cap"
        );
        // Mitosis must be possible: threshold + cost <= cap
        assert!(
            crate::constants::MITOSIS_THRESHOLD + crate::constants::MITOSIS_COST
                <= crate::constants::MAX_ATP,
            "Mitosis threshold + cost exceeds ATP cap"
        );
        // Child energy must be non-zero and within cap
        assert!(
            crate::constants::CHILD_ENERGY_SEED > 0
                && crate::constants::CHILD_ENERGY_SEED <= crate::constants::MAX_ATP,
            "Child energy seed invalid"
        );
        // Phase mask must cover 8-bit range
        assert_eq!(
            crate::constants::PHASE_MASK_8BIT,
            0xFF,
            "Phase mask must be 8-bit"
        );
        // Resonance modulus must be power-of-2
        assert!(
            crate::constants::RESONANCE_PHASE_MODULUS.is_power_of_two(),
            "Resonance modulus must be power-of-2"
        );
        // xorshift64* parameters are hardcoded in math.rs (SplitMix64 + xorshift)
        // HIGH-2: Divisors must be positive
        assert!(
            crate::constants::DELTA_PHASE_DIVISOR > 0,
            "Phase divisor must be positive"
        );
        assert!(
            crate::constants::DELTA_ENERGY_DIVISOR > 0,
            "Energy divisor must be positive"
        );
        // HIGH-2: Adaptive thresholds must be non-zero
        assert!(
            crate::constants::MAX_ATP / crate::constants::DELTA_ENERGY_DIVISOR > 0,
            "Energy threshold would be zero"
        );
    }

    #[cfg(not(feature = "spore"))]
    #[test]
    fn test_senate_patch_unauthorized_rejection() {
        use crate::v2_apply_senate_patch;
        // Unauthorized caller (0xDEADBEEF is not a canonical oracle)
        let result = v2_apply_senate_patch(0xDEADBEEF, 1, 50, 0);
        assert_eq!(result, 0, "unauthorized caller must be rejected with 0");

        // Zero caller must also be rejected
        let result2 = v2_apply_senate_patch(0, 1, 50, 0);
        assert_eq!(result2, 0, "zero caller must be rejected with 0");
    }
}
