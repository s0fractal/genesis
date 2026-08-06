//! What the law hash cannot see.
//!
//! `canonical_law_hash()` is a hash over CONSTANTS: the era, the physical
//! parameters, the topology. It answers "are we configured the same?" and it
//! answers it cheaply, purely, without running anything — which is why the
//! federation compares it.
//!
//! It cannot answer "do we compute the same world". Change the shape of an
//! equation while leaving every constant alone — gate conduction on phase,
//! divide predation by the neighbourhood, stop multiplying burn by the sun,
//! take a ceiling instead of a floor — and the declared hash does not move by a
//! bit. Every one of those landed on 2026-08-06 under an unchanged
//! `0x30A95260`, and the Substrate Court would have declared a node running the
//! old world in agreement with a node running the new one.
//!
//! This file is the other half. It runs the physics on a fixed fixture and
//! hashes the result, so it changes if and only if BEHAVIOUR changes. It cannot
//! be the federation's anchor — it requires execution, and the whole point of
//! the declared hash is that a stranger can compare it without trusting you —
//! but it is what forces the declared hash to be bumped honestly.
//!
//! **If this test fails, the physical operator changed.** That is not a
//! breakage to route around: bump `ERA_ID`, update `CANONICAL_LAW_HASH` and the
//! deno mirror, and record what changed in `docs/PHYSICS_BOUNDARY.md`.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::crypto::sha256_u32;
use omega_v2::lattice::PhaseLattice;
use omega_v2::topology::PhaseTopology;

const AGENTS: usize = 64;
const TICKS: u32 = 24;
const SEED: u32 = 0x0EC0_0107;

/// Ignite a fixed lattice, run a fixed number of ticks, hash the whole state.
fn behavioural_anchor() -> u32 {
    let mut agents = vec![PhaseAgentMinimal::default(); AGENTS];
    let mut snapshot = vec![PhaseAgentMinimal::default(); AGENTS];

    let mut lattice = PhaseLattice::new_from_host_memory(
        PhaseTopology::new(7, 7, 6, 20),
        core::ptr::null_mut(),
        agents.as_mut_ptr(),
    );
    lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
    lattice.ignite_big_bang(SEED, AGENTS as u32);

    // Push the fixture into the tissue regime as well as the ordinary one.
    //
    // Without this the anchor covered only the metabolic path: 24 ticks from
    // Big Bang energies never reaches the crystallisation threshold, so when
    // tissue was made relative and reversible on 2026-08-07 — a change to the
    // physical operator affecting every agent at capacity — this file stayed
    // green. An anchor that misses a whole branch of the law is an anchor for
    // the branches it happens to touch.
    let active = lattice.signals.active_agent_count as usize;
    for (i, a) in agents.iter_mut().take(active).enumerate() {
        if i % 3 == 0 {
            a.energy = omega_v2::constants::MAX_ATP - 8; // eligible to crystallise
            a.memory[1] = 1 << 16; // ortho > 0, the other precondition
        }
    }

    for _ in 0..TICKS {
        lattice.tick_physics();
    }

    // Hash every byte of every agent slot — phase, energy, genome, memory, the
    // lot — so any divergence in any term reaches the digest.
    let bytes = unsafe {
        core::slice::from_raw_parts(agents.as_ptr() as *const u8, AGENTS * 32)
    };
    sha256_u32(bytes)
}

/// Golden: the observed behaviour of Era 962.
///
/// Moved from 0xB8A3A2B4 when the two Q10-against-raw unit errors in the phase
/// dynamics were corrected. This is the anchor doing its job: neither error
/// touched a constant, so the DECLARED law hash would not have moved on its own
/// — this file is what forced the era bump.
const BEHAVIOURAL_LAW_ANCHOR: u32 = 0x55CC_3626;

#[test]
fn the_physical_operator_has_not_changed_silently() {
    let observed = behavioural_anchor();
    assert_eq!(
        observed,
        BEHAVIOURAL_LAW_ANCHOR,
        "\nTHE PHYSICS CHANGED.\n\
         Observed behavioural anchor 0x{observed:08X}, pinned 0x{BEHAVIOURAL_LAW_ANCHOR:08X}.\n\
         The constant-based law hash cannot see a change in the SHAPE of an\n\
         equation, which is why this exists. If the change was intended:\n\
           1. bump ERA_ID in omega_v2/src/law_hash.rs\n\
           2. update CANONICAL_LAW_HASH and src/shared/law_hash.ts together\n\
           3. update this anchor\n\
           4. record what changed in docs/PHYSICS_BOUNDARY.md\n\
         A silent bump of this value alone defeats the purpose of all four.\n"
    );
}

#[test]
fn the_anchor_is_actually_looking_at_something() {
    // Guards against the fixture degenerating into an empty or frozen lattice,
    // which would make the assertion above vacuously stable forever.
    let mut agents = vec![PhaseAgentMinimal::default(); AGENTS];
    let mut snapshot = vec![PhaseAgentMinimal::default(); AGENTS];
    let mut lattice = PhaseLattice::new_from_host_memory(
        PhaseTopology::new(7, 7, 6, 20),
        core::ptr::null_mut(),
        agents.as_mut_ptr(),
    );
    lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
    lattice.ignite_big_bang(SEED, AGENTS as u32);

    let alive = lattice.signals.active_agent_count;
    assert!(alive > 0, "fixture ignited nothing");
    let before: u64 = agents.iter().map(|a| a.energy as u64).sum();
    for _ in 0..TICKS {
        lattice.tick_physics();
    }
    let after: u64 = agents.iter().map(|a| a.energy as u64).sum();
    assert_ne!(before, after, "the fixture ran but nothing moved");
    assert_ne!(behavioural_anchor(), 0, "anchor collapsed to zero");
}
