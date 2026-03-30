#![no_std]

// Era 1100: Bare-Metal Substrate
// This crate operates entirely without the standard library, enabling direct execution
// inside RISC-V ZK-VMs (SP1), Microcontrollers, or WebAssembly sandbox without WASI.

pub mod topology;
pub mod math;
pub mod agent;
pub mod lattice;
pub mod pouw;

use lattice::{PhaseLattice, SignalStore};
use topology::PhaseTopology;
use agent::PhaseAgentMinimal;

// Primitive panic handler for no_std WASM/Bare metal environments
#[cfg(all(not(test), target_arch = "wasm32"))]
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

// -----------------------------------------------------------------------------
// NAKED FFI EXPORTS (Called directly from v2_bridge.ts without wasm-bindgen)
// -----------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn v2_lattice_ptr() -> *const u8 {
    unsafe { &OMEGA_LATTICE as *const PhaseLattice as *const u8 }
}

#[no_mangle]
pub extern "C" fn v2_agents_ptr() -> *const u8 {
    unsafe { AGENTS_MEMORY.as_ptr() as *const u8 }
}

#[no_mangle]
pub extern "C" fn v2_sine_lut_ptr() -> *const u8 {
    crate::math::SINE_LUT_128.as_ptr() as *const u8
}

#[no_mangle]
pub extern "C" fn v2_boot_engine() {
    unsafe {
        // Link the static buffer into the Lattice Engine
        OMEGA_LATTICE.minimal_agents_ptr = AGENTS_MEMORY.as_mut_ptr();
    }
}

#[no_mangle]
pub extern "C" fn v2_set_environment(q_sectors: u32, q_radial: u32, q_harmonics: u32) {
    unsafe {
        OMEGA_LATTICE.set_environment(q_sectors, q_radial, q_harmonics);
    }
}

#[no_mangle]
pub extern "C" fn v2_ignite_big_bang(seed: u32, agent_count: u32) {
    unsafe {
        OMEGA_LATTICE.ignite_big_bang(seed, agent_count);
    }
}

#[no_mangle]
pub extern "C" fn v2_tick() {
    unsafe {
        OMEGA_LATTICE.tick_physics();
    }
}

#[no_mangle]
pub extern "C" fn v2_set_intent(index: u32, focus_x: i32, focus_y: i32, mass: i32, radius: i32, semantic_genome: u32, op_mode: u32) {
    if index >= 4 { return; }
    unsafe {
        OMEGA_LATTICE.intents[index as usize].focus_x = focus_x;
        OMEGA_LATTICE.intents[index as usize].focus_y = focus_y;
        OMEGA_LATTICE.intents[index as usize].mass = mass;
        OMEGA_LATTICE.intents[index as usize].radius = radius;
        OMEGA_LATTICE.intents[index as usize].semantic_genome = semantic_genome;
        OMEGA_LATTICE.intents[index as usize].op_mode = op_mode;
    }
}

#[no_mangle]
pub extern "C" fn v2_get_golden_trace() -> u32 {
    unsafe {
        OMEGA_LATTICE.get_golden_trace()
    }
}

#[no_mangle]
pub extern "C" fn v2_mitosis_sweep() -> u32 {
    unsafe {
        OMEGA_LATTICE.darwinian_mitosis()
    }
}

// ERA 6000 FFI
#[no_mangle]
pub extern "C" fn v2_delta_buffer_ptr() -> *const u8 {
    unsafe { DELTA_BUFFER.as_ptr() as *const u8 }
}

#[no_mangle]
pub extern "C" fn v2_generate_delta_snapshot() -> u32 {
    unsafe {
        OMEGA_LATTICE.generate_delta_snapshot(
            AGENTS_MEMORY.as_ptr(),
            LAST_SNAPSHOT_MEMORY.as_mut_ptr(),
            DELTA_BUFFER.as_mut_ptr(),
            MAX_DELTA_ITEMS
        )
    }
}
