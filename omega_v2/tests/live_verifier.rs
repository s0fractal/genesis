//! The second witness.
//!
//! The Substrate Court has never had two independent computations of a
//! transition. `renderer.tick()` runs the WGSL operator and writes only GPU
//! buffers; the readback mirrors that state into WASM memory; and everything
//! the court compared was two hashes of that one mirror. It has been honestly
//! reporting `not-assessed` since 2026-08-06 for exactly this reason.
//!
//! `v2_verify_replay` is the missing half: the Rust kernel — the reference law
//! the shader is a port OF — re-executes the same steps from the same starting
//! state, in its own memory, and says where the lattice should be. Agreement
//! is then a real claim about two substrates rather than a tautology about one.
//!
//! What these tests pin is that the verifier is isolated and that it can fail.
//! A verifier that cannot fail is a decoration, and a verifier that mutates
//! what it verifies is worse than none.

use omega_v2::agent::PhaseAgentMinimal;
use std::sync::Mutex;

/// Every test here drives the one global `OMEGA_LATTICE`, and cargo runs the
/// tests in a file on parallel threads. Without this they interleave — one
/// re-igniting the world while another is mid-replay — and the failures look
/// like verifier bugs rather than what they are. They pass individually and
/// fail together, which is the signature.
static WORLD: Mutex<()> = Mutex::new(());

#[test]
fn the_verifier_reproduces_the_kernel_it_verifies() {
    let _world = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(0x0EC0_0107, 1024);

        // Hand the verifier the state the world is in right now...
        let active = omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count;
        core::ptr::copy_nonoverlapping(
            omega_v2::v2_agents_ptr(),
            omega_v2::v2_verify_scratch_ptr(),
            active as usize * 32,
        );
        // ...and ask where four steps land.
        let replayed = omega_v2::v2_verify_replay_scratch(active, 4);

        // Then let the kernel actually take them.
        for _ in 0..4 {
            omega_v2::v2_tick();
        }
        let after_four = omega_v2::v2_calculate_state_hash();

        assert_eq!(
            replayed, after_four,
            "the verifier must compute what the kernel computes, or it is \
             checking a different world"
        );
    }
}

#[test]
fn the_verifier_does_not_touch_the_state_it_reads() {
    let _world = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(0x0EC0_0107, 1024);

        let before = omega_v2::v2_calculate_state_hash();
        let entropy_before = {
            let l = omega_v2::OMEGA_LATTICE.lock();
            l.signals.total_entropy_released
        };

        let active = omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count;
        core::ptr::copy_nonoverlapping(
            omega_v2::v2_agents_ptr(),
            omega_v2::v2_verify_scratch_ptr(),
            active as usize * 32,
        );
        omega_v2::v2_verify_replay_scratch(active, 8);

        assert_eq!(
            omega_v2::v2_calculate_state_hash(),
            before,
            "the verifier advanced the live lattice — it is a participant, not \
             a witness"
        );
        let entropy_after = {
            let l = omega_v2::OMEGA_LATTICE.lock();
            l.signals.total_entropy_released
        };
        assert_eq!(
            entropy_before, entropy_after,
            "the verifier booked its replay into the real ledger"
        );
    }
}

#[test]
fn the_verifier_can_disagree() {
    // A verifier that cannot report a difference proves nothing. Perturb one
    // agent between the two runs and the hashes must part.
    let _world = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(0x0EC0_0107, 1024);
        let active = omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count;
        core::ptr::copy_nonoverlapping(
            omega_v2::v2_agents_ptr(),
            omega_v2::v2_verify_scratch_ptr(),
            active as usize * 32,
        );
        let clean = omega_v2::v2_verify_replay_scratch(active, 4);

        // One flipped bit in the state handed over.
        let scratch = omega_v2::v2_verify_scratch_ptr() as *mut PhaseAgentMinimal;
        core::ptr::copy_nonoverlapping(
            omega_v2::v2_agents_ptr(),
            omega_v2::v2_verify_scratch_ptr(),
            active as usize * 32,
        );
        (*scratch.add(7)).energy ^= 1;
        let perturbed = omega_v2::v2_verify_replay_scratch(active, 4);

        assert_ne!(
            clean, perturbed,
            "one flipped bit in one agent left the verdict unchanged"
        );
    }
}

#[test]
fn the_verifier_declines_rather_than_guesses() {
    let _world = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    omega_v2::v2_boot_engine();
    omega_v2::v2_set_environment(7, 6, 2, 1024);
    // Larger than it can replay. A coupled lattice cannot be checked in
    // part — every agent reads eight neighbours and the torus wraps — so
    // the honest answer is to decline, and the host must ask
    // v2_verify_capacity first rather than read 0 as a verdict.
    omega_v2::v2_ignite_big_bang(0x0EC0_0107, (omega_v2::VERIFY_MAX_AGENTS as u32) * 8);
    assert!(
        omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count
            > omega_v2::VERIFY_MAX_AGENTS as u32,
        "fixture must exceed the verifier's capacity or it proves nothing"
    );
    let active = omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count;
    assert_eq!(omega_v2::v2_verify_replay_scratch(active, 1), 0);
}

#[test]
fn the_verifier_is_silent_on_the_phi_bus() {
    // Its agents die like any others. Those deaths are not events in the
    // world — they are an artifact of asking what would have happened — so
    // they must not publish compost.
    let _world = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        omega_v2::v2_boot_engine();
        omega_v2::v2_set_environment(7, 6, 2, 1024);
        omega_v2::v2_ignite_big_bang(0x0EC0_0107, 1024);
        {
            let mut buf = omega_v2::PHI_MESSAGE_BUFFER.lock();
            buf.reset();
        }
        // Long enough that starvation is certain at these energies.
        let active = omega_v2::OMEGA_LATTICE.lock().signals.active_agent_count;
        core::ptr::copy_nonoverlapping(
            omega_v2::v2_agents_ptr(),
            omega_v2::v2_verify_scratch_ptr(),
            active as usize * 32,
        );
        omega_v2::v2_verify_replay_scratch(active, 64);
        let len = { omega_v2::PHI_MESSAGE_BUFFER.lock().len() };
        assert_eq!(len, 0, "the verifier talked on the bus");
    }
}
