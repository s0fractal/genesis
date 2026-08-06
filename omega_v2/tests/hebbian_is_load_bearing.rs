//! Drift lock: the Hebbian weights actually reach the physics.
//!
//! `tick_physics` reads two learned weights out of `memory[1]`/`memory[2]`,
//! updates them by a Hebbian rule against the left and right neighbours'
//! coherence, clamps them, raises them to `HEBBIAN_MAX_WEIGHT` on
//! crystallisation, and writes them back. The comment above the mean-field sum
//! says "Kuramoto coupling modulated by Hebbian weights".
//!
//! It was not. The sum multiplied every neighbour by the CONSTANT
//! `HEBBIAN_DEFAULT_WEIGHT`, and the normalisation three lines down divided by
//! that same constant, so the two cancelled exactly. The learning rule ran every
//! tick on every agent for four eras and wrote to a location nothing read — a
//! memory with no output, and a synapse that cannot change what the neuron does.
//! `HEBBIAN_MAX_WEIGHT` sat in the law-hash preimage and in the shader's
//! constant lock, guarded from a drift that could not have mattered.
//!
//! So this asserts the property that was missing rather than the mechanism that
//! now provides it: two worlds identical in every respect EXCEPT their stored
//! weights must not compute the same phases. Written against the broken kernel
//! first, where it failed — the two trajectories were bit-identical.
//!
//! It is deliberately blind to how the weights are used. Any future change that
//! keeps them load-bearing keeps this green; only severing them again turns it
//! red.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::constants::{HEBBIAN_DEFAULT_WEIGHT, HEBBIAN_MAX_WEIGHT};
use omega_v2::lattice::PhaseLattice;
use omega_v2::topology::PhaseTopology;

const AGENTS: usize = 64;
const TICKS: u32 = 16;
const SEED: u32 = 0x0EC0_0107;

/// Ignite a fixed world, overwrite every agent's stored synaptic weight with
/// `w`, run `TICKS`, and return the phases.
///
/// Only the low 16 bits of `memory[1]` are touched: bits 16..24 pack the
/// orthogonal coordinate, which is a separate quantity and a precondition for
/// crystallisation. Changing it would make this test about something else.
fn phases_with_weight(w: i32) -> Vec<u32> {
    let mut agents = vec![PhaseAgentMinimal::default(); AGENTS];
    let mut snapshot = vec![PhaseAgentMinimal::default(); AGENTS];

    let mut lattice = PhaseLattice::new_from_host_memory(
        PhaseTopology::new(7, 7, 6, 20),
        core::ptr::null_mut(),
        agents.as_mut_ptr(),
    );
    lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
    lattice.ignite_big_bang(SEED, AGENTS as u32);

    let active = lattice.signals.active_agent_count as usize;
    for a in agents.iter_mut().take(active) {
        a.memory[1] = (a.memory[1] & !0xFFFF) | (w as u32 & 0xFFFF);
        a.memory[2] = (a.memory[2] & !0xFFFF) | (w as u32 & 0xFFFF);
    }

    for _ in 0..TICKS {
        lattice.tick_physics();
    }
    agents.iter().map(|a| a.phase).collect()
}

#[test]
fn stored_synaptic_weights_change_what_the_world_computes() {
    let weak = phases_with_weight(HEBBIAN_DEFAULT_WEIGHT / 4);
    let strong = phases_with_weight(HEBBIAN_MAX_WEIGHT);

    let differing = weak
        .iter()
        .zip(strong.iter())
        .filter(|(a, b)| a != b)
        .count();

    assert!(
        differing > 0,
        "\nTHE HEBBIAN WEIGHTS ARE INERT.\n\
         {AGENTS} agents ran {TICKS} ticks under weights {} and {}, and every\n\
         phase came out identical. The learning rule is still writing to a\n\
         location no term reads — check that the mean-field sum in\n\
         PhaseLattice::tick_physics multiplies each neighbour by its weight and\n\
         normalises by the weights it actually used, not by a constant.",
        HEBBIAN_DEFAULT_WEIGHT / 4,
        HEBBIAN_MAX_WEIGHT,
    );
}

/// The guard against this file passing for a reason that is not the point.
///
/// If ignition ever produced a dead or phase-degenerate population, the
/// comparison above could go green on garbage — or, worse, red for a reason
/// unrelated to synapses. So assert the fixture is a living world with more than
/// one phase in it before believing anything the other test says.
#[test]
fn the_fixture_is_a_live_world() {
    let p = phases_with_weight(HEBBIAN_DEFAULT_WEIGHT);
    let mut distinct: Vec<u32> = p.clone();
    distinct.sort_unstable();
    distinct.dedup();
    assert!(
        distinct.len() > 4,
        "fixture collapsed to {} distinct phases across {AGENTS} agents — the \
         comparison in this file would be meaningless",
        distinct.len()
    );
}
