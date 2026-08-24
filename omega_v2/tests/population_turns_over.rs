//! A population that never replaces anyone cannot evolve.
//!
//! Measured before this existed: the lattice fills to capacity by tick 550 and
//! then **nothing is born and nothing dies, forever**. Every birth in a 20000
//! tick run was fill-up — 3072 of them, exactly capacity minus the ignition
//! population — and the deaths counter never left zero. The trait the physics
//! selects on froze at the same moment and was identical to the second decimal
//! ten thousand ticks later.
//!
//! That makes this world a single-generation filter rather than an ecology.
//! Selection runs once, while there are still empty slots, and never again:
//! with every slot occupied mitosis has nowhere to put a child, and nothing
//! dies to make room.
//!
//! Sweeping the metabolic cost does not fix it — `weather_multiplier` from 1024
//! to 7168 moves the freezing point and nothing else. Below ~7000 a few dozen
//! agents die on the approach to equilibrium and then the world freezes; above
//! it, nothing ever reaches the reproduction threshold and the lattice never
//! fills at all. Two regimes, no band between them.
//!
//! So this asserts the property directly, on the horizon where the old
//! behaviour is unambiguous: after the lattice is full and has had time to
//! settle, agents must still be dying. It says nothing about the mechanism —
//! senescence, predation, a finite resource — only that replacement happens.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::lattice::PhaseLattice;
use omega_v2::topology::PhaseTopology;

const AGENTS: usize = 256;
const SEED: u32 = 0x0EC0_0107;
/// Long enough that the fill transient (~550 ticks at capacity 4096, less here)
/// is far behind, so nothing counted below can be mistaken for it.
const SETTLE: u32 = 4000;
const OBSERVE: u32 = 8000;

fn alive(a: &PhaseAgentMinimal) -> bool {
    a.energy > 0 && a.state_flags & 0x01 == 0
}

/// Deaths observed in the OBSERVE window, after SETTLE ticks of warm-up.
fn deaths_after_settling() -> (u32, usize) {
    let mut agents = vec![PhaseAgentMinimal::default(); AGENTS];
    let mut snapshot = vec![PhaseAgentMinimal::default(); AGENTS];

    let mut lattice = PhaseLattice::new_from_host_memory(
        PhaseTopology::new(8, 7, 6, 20),
        core::ptr::null_mut(),
        agents.as_mut_ptr(),
    );
    lattice.tick_snapshot_ptr = snapshot.as_mut_ptr();
    lattice.ignite_big_bang(SEED, AGENTS as u32);
    lattice.signals.max_cells = AGENTS as u32;

    let step = |l: &mut PhaseLattice, t: u32| {
        l.tick_physics();
        if t % 10 == 0 {
            l.darwinian_mitosis();
        }
    };

    for t in 1..=SETTLE {
        step(&mut lattice, t);
    }

    let mut was: Vec<bool> = agents.iter().map(alive).collect();
    let mut deaths = 0u32;
    for t in 1..=OBSERVE {
        step(&mut lattice, SETTLE + t);
        for (i, a) in agents.iter().enumerate() {
            let now = alive(a);
            if was[i] && !now {
                deaths += 1;
            }
            was[i] = now;
        }
    }
    let living = agents.iter().filter(|a| alive(a)).count();
    (deaths, living)
}

#[test]
fn a_settled_population_keeps_replacing_itself() {
    let (deaths, living) = deaths_after_settling();

    // The guard first: a world that died out would trivially stop dying, and
    // that must not read as the same failure — or as a pass.
    assert!(
        living > AGENTS / 4,
        "the population collapsed to {living} of {AGENTS}; turnover is not the \
         question when there is nobody left"
    );

    assert!(
        deaths > 0,
        "\nTHE POPULATION IS FROZEN.\n\
         {living} agents alive and {deaths} deaths across {OBSERVE} ticks, after\n\
         {SETTLE} ticks of settling. Nothing is being replaced, so mitosis has\n\
         nowhere to place a child and the trait under selection cannot move\n\
         again. A world that filters once and then holds still is not an\n\
         environment for organisms; it is a photograph of one."
    );
}

/// The age field spans what its documentation claims.
///
/// It did not, twice. First it was written `0x0001_FF00` — nine bits, saturating
/// at 511 — beside a comment promising seventeen and a ceiling of 131071, so
/// senescence capped a few thousand ticks in and the population died back once
/// and then stabilised: indistinguishable from the frozen world this file
/// exists to detect. Widened to seventeen, it then overlapped
/// BIRTH_NEAR_ATTRACTOR_FLAG on bit 24 and clearing a newborn's age erased the
/// record of where it was born.
///
/// A packed field is a claim about which bits belong to whom, and nothing was
/// checking it.
#[test]
fn the_age_field_is_as_wide_as_it_says_it_is() {
    use omega_v2::agent::{age_of, with_age_incremented, AGE_MASK, AGE_MAX, AGE_SHIFT};

    assert_eq!(AGE_MASK, 0x00FF_FF00, "age occupies state_flags bits 8..23");
    assert_eq!(AGE_MAX, 65_535, "sixteen bits");

    // It must not collide with any flag that shares the word.
    assert_eq!(AGE_MASK & 0x01, 0, "overlaps the dead flag");
    assert_eq!(AGE_MASK & 0xFE, 0, "overlaps the species bits");
    assert_eq!(AGE_MASK & omega_v2::agent::FLAG_TISSUE_LOCKED, 0);
    assert_eq!(AGE_MASK & omega_v2::codeicide_law::FLAG_SANCTUARY_WAIVED, 0);
    // The one it actually collided with. Clearing a newborn's age also cleared
    // the record that it was born near an attractor.
    assert_eq!(
        AGE_MASK & omega_v2::mitosis_proof::BIRTH_NEAR_ATTRACTOR_FLAG,
        0,
        "age overlaps the birth-near-attractor flag"
    );

    // Counting works across the whole range and saturates rather than wrapping.
    let mut f = 0u32;
    for i in 1..=1000u32 {
        f = with_age_incremented(f);
        assert_eq!(age_of(f), i);
    }
    let capped = with_age_incremented((AGE_MAX << AGE_SHIFT) | 0x01);
    assert_eq!(age_of(capped), AGE_MAX, "age wrapped instead of saturating");
    assert_eq!(capped & 0x01, 1, "incrementing age disturbed another flag");
}
