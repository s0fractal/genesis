//! A force smaller than one quantum must still move something.
//!
//! `coupling` is an `i32` added straight to an integer phase. Measured on Era
//! 967: the mean magnitude is 0.103 phase units and it is **exactly zero for
//! 89.7% of living agents on any given tick**. For nine agents in ten the
//! Kuramoto term does not act at all — it is not weak, it is absent, discarded
//! by truncation before it reaches the phase.
//!
//! That cannot be fixed by scaling. A sweep of `KURAMOTO_COUPLING_BASE` over
//! 1024..524288 found that the first setting large enough to survive truncation
//! is already large enough to overshoot: only the current value converges a
//! zero-spread population, and everything above it destroys order instead of
//! building it. There is no setting between "absent" and "too big", because the
//! next representable value above zero is one whole phase unit.
//!
//! The remedy is resolution, not magnitude: carry the fractional part between
//! ticks so a pull of 0.1 accumulates into a whole unit over ten ticks instead
//! of vanishing ten times.
//!
//! This asserts the property that was missing, not the mechanism. An agent with
//! no natural frequency of its own, feeling only the coupling, must eventually
//! move. Written against the truncating kernel first, where most of the
//! population sat perfectly still for the entire run.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::lattice::PhaseLattice;
use omega_v2::topology::PhaseTopology;

const AGENTS: usize = 256;
const TICKS: u32 = 512;
const SEED: u32 = 0x0EC0_0107;

/// Fraction of the living whose phase is bit-identical to where it started.
fn fraction_never_moved() -> f64 {
    let mut agents = vec![PhaseAgentMinimal::default(); AGENTS];
    let mut snapshot = vec![PhaseAgentMinimal::default(); AGENTS];

    let mut lattice = PhaseLattice::new_from_host_memory(
        PhaseTopology::new(8, 7, 6, 20),
        core::ptr::null_mut(),
        agents.as_mut_ptr(),
    );
    lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
    lattice.ignite_big_bang(SEED, AGENTS as u32);

    let active = lattice.signals.active_agent_count as usize;

    // No natural frequency: the coupling is then the ONLY term that can move a
    // phase, so "did it move" is a direct question about the coupling. Energy
    // is topped up so the run is not measuring starvation.
    for a in agents.iter_mut().take(active) {
        a.base_freq = 0;
        a.energy = omega_v2::constants::MAX_ATP / 2;
    }
    let start: Vec<u32> = agents.iter().take(active).map(|a| a.phase).collect();

    for _ in 0..TICKS {
        lattice.tick_physics();
    }

    let mut living = 0.0;
    let mut still = 0.0;
    for (i, a) in agents.iter().take(active).enumerate() {
        if a.energy == 0 || a.state_flags & 0x01 != 0 {
            continue;
        }
        living += 1.0;
        if a.phase == start[i] {
            still += 1.0;
        }
    }
    assert!(
        living > 32.0,
        "fixture died: only {living} left, nothing to measure"
    );
    still / living
}

#[test]
fn a_sub_quantum_coupling_still_moves_a_phase() {
    let stuck = fraction_never_moved();
    assert!(
        stuck < 0.10,
        "\nTHE COUPLING IS BEING TRUNCATED AWAY.\n\
         {:.1}% of the living population has the same phase after {TICKS} ticks\n\
         as it had at ignition, with base_freq zeroed so the coupling was the\n\
         only term that could have moved it. A force that is discarded every\n\
         tick because it is smaller than one quantum is not a weak force, it is\n\
         no force. Carry the fractional part between ticks.",
        stuck * 100.0
    );
}
