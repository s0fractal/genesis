//! Is the world still habitable?
//!
//! Every other test in this tree checks that the code does what it says. None
//! of them asks whether the result is a place anything can live, and the answer
//! has been "no" twice this week in two different ways — both while the whole
//! suite was green:
//!
//!   - CLOSED. Predation and diffusion only move ATP; burn only removes it. Total
//!     energy fell monotonically, so no agent could ever reach the reproduction
//!     threshold. 1024 agents, extinct at tick 86, zero births. Measured by
//!     `tools/ecology_probe.ts`, not by anything that would have failed CI.
//!   - STERILE. With the sun lit the population survived indefinitely and still
//!     never reproduced, because mitosis needs a vacancy and the Big Bang filled
//!     every slot.
//!
//! A physics change that quietly restores either would pass all 340 tests. So
//! these three assertions are the gate: the world does not burn out, its books
//! close, and reproduction is reachable. They are deliberately coarse — they do
//! not pin a population curve, which would break on every legitimate tuning —
//! and each one names a failure that actually happened.
//!
//! If one goes red, the question is not "which assertion do I relax". It is
//! "what did I just make uninhabitable".

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::lattice::PhaseLattice;
use omega_v2::topology::PhaseTopology;
use std::sync::Mutex;

/// These drive the one global lattice through the FFI; cargo runs a file's
/// tests in parallel. Without this they interleave and fail together while
/// passing alone.
static WORLD: Mutex<()> = Mutex::new(());

const SEED: u32 = 0x0EC0_0107;

fn census(agents: &[PhaseAgentMinimal], active: usize) -> (usize, u64, u32) {
    let mut alive = 0;
    let mut energy = 0u64;
    let mut richest = 0u32;
    for a in agents.iter().take(active) {
        if a.energy > 0 && a.state_flags & 0x01 == 0 {
            alive += 1;
            energy += a.energy as u64;
            if a.energy > richest {
                richest = a.energy;
            }
        }
    }
    (alive, energy, richest)
}

#[test]
fn the_world_does_not_burn_out() {
    let _w = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(SEED, 2048); // capacity; a quarter is seeded

        let start = omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count as usize;
        assert!(start > 0, "ignition seeded nothing");

        for _ in 0..600 {
            omega_v2::v2_tick();
        }

        let lattice = omega_v2::OMEGA_LATTICE.lock();
        let active = lattice.signals.active_agent_count as usize;
        let agents = core::slice::from_raw_parts(lattice.minimal_agents_ptr, active);
        let (alive, _, _) = census(agents, active);
        drop(lattice);

        // Era 960 reached zero here by tick 86. The bar is deliberately low: a
        // world that has lost most of its population is a different argument,
        // but a world with nobody in it is not a world.
        assert!(
            alive > 0,
            "extinction: {start} agents at ignition, none alive after 600 ticks"
        );
    }
}

#[test]
fn the_books_close_as_an_open_system() {
    let _w = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(SEED, 2048);

        let (before, entropy_before, solar_before) = {
            let l = omega_v2::OMEGA_LATTICE.lock();
            let active = l.signals.active_agent_count as usize;
            let agents = core::slice::from_raw_parts(l.minimal_agents_ptr, active);
            let (_, e, _) = census(agents, active);
            (
                e,
                l.signals.total_entropy_released,
                l.signals.total_solar_input as u64,
            )
        };

        for _ in 0..300 {
            omega_v2::v2_tick();
        }

        let (after, entropy_after, solar_after) = {
            let l = omega_v2::OMEGA_LATTICE.lock();
            let active = l.signals.active_agent_count as usize;
            let agents = core::slice::from_raw_parts(l.minimal_agents_ptr, active);
            let (_, e, _) = census(agents, active);
            (
                e,
                l.signals.total_entropy_released,
                l.signals.total_solar_input as u64,
            )
        };

        let solar = solar_after - solar_before;
        let released = entropy_after - entropy_before;
        let spent = before + solar - after;

        // The trace also carries the Landauer cost of information erased by any
        // deaths, so it sits at or above the pure energy figure. Below it means
        // ATP left the population without reaching the ledger — a leak.
        assert!(
            released >= spent,
            "energy vanished unbooked: {before} held + {solar} solar - {after} \
             held = {spent} spent, {released} booked"
        );
        assert!(solar > 0, "the sun paid nothing — the world is closed again");
    }
}

#[test]
fn reproduction_is_reachable() {
    let _w = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    // Not "does a birth happen from a Big Bang within N ticks" — that took 1650
    // ticks at the current calibration and would make this a slow, brittle
    // proxy for solar yield. The invariant is narrower and more durable: a
    // fertile agent WITH ROOM reproduces. Both halves were broken this week —
    // fertility was unreachable while the world was closed, and room did not
    // exist while the Big Bang filled every slot.
    let mut agents = vec![PhaseAgentMinimal::default(); 16];
    let mut snapshot = vec![PhaseAgentMinimal::default(); 16];
    let mut lattice = PhaseLattice::new_from_host_memory(
        PhaseTopology::new(7, 7, 6, 20),
        core::ptr::null_mut(),
        agents.as_mut_ptr(),
    );
    lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
    lattice.signals.max_cells = 16;
    lattice.signals.active_agent_count = 2;
    for a in agents.iter_mut().take(2) {
        a.energy = omega_v2::constants::MITOSIS_THRESHOLD;
        a.state_flags = 0;
    }
    agents[0].genome = 0x0F0F_0F0F;
    agents[1].genome = 0x3333_3333;

    let born = lattice.darwinian_mitosis();
    assert!(born > 0, "a fertile agent with room did not reproduce");
    assert!(
        lattice.signals.active_agent_count > 2,
        "the population did not grow into the empty space"
    );
}

#[test]
fn the_gate_is_actually_looking_at_something() {
    // Guards against the three above passing over a lattice that never ran:
    // a fixture that ignites nothing, or ticks that do nothing, would make
    // "nobody died" and "the books close" vacuously true forever.
    let _w = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(SEED, 2048);

        let before = omega_v2::v2_calculate_state_hash();
        let entropy_before = omega_v2::OMEGA_LATTICE.lock().signals.total_entropy_released;
        for _ in 0..50 {
            omega_v2::v2_tick();
        }
        let after = omega_v2::v2_calculate_state_hash();
        let entropy_after = omega_v2::OMEGA_LATTICE.lock().signals.total_entropy_released;

        assert_ne!(before, after, "50 ticks changed nothing — the world is frozen");
        assert!(
            entropy_after > entropy_before,
            "50 ticks dissipated nothing — metabolism is not running"
        );
    }
}
