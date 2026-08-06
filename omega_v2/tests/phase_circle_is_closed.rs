//! The agents' phase circle and the trigonometry's phase circle must be the
//! same circle.
//!
//! `sin_q10(from, to)` indexes `SINE_LUT` — 256 entries, one full period — with
//! `(to - from) & 0xFF`. Agents wrap their phase at `max_phase = (1 << q_phase)`,
//! which for the canonical topology is 128. So the space the agents live in is
//! HALF the space the trigonometry measures, and the two do not agree about
//! where the circle closes.
//!
//! The consequence is not a scale factor. Two agents at phase 0 and phase 127
//! are ADJACENT on a circle of 128 — one step apart — and the coupling should
//! pull them together. The table reads their difference as 127/256 of a turn,
//! 178.6 degrees, and reports them as very nearly antiphase. The sign of the
//! force between them is inverted.
//!
//! That is a seam: a line on the circle across which the physics pushes
//! neighbours apart instead of together. A Kuramoto lattice with a seam cannot
//! globally synchronise, because there is no phase assignment that satisfies the
//! coupling everywhere — and measured, it does not: the order parameter computed
//! in the agents' own wrap sits at 0.055 after 6000 ticks.
//!
//! This asserts the property, not the remedy: whatever the phase resolution and
//! whatever the table, a difference of one step must read as one step, and a
//! difference of `max_phase` steps must read as one step BACKWARD.

use omega_v2::math::{cos_q10, sin_q10};
use omega_v2::topology::PhaseTopology;

/// The canonical operating topology — the one `OMEGA_LATTICE` runs.
fn canonical_phase_span() -> u32 {
    let t = PhaseTopology::new(8, 7, 6, 20);
    1u32 << t.q_phase
}

#[test]
fn one_step_forward_and_one_step_back_are_mirror_images() {
    let span = canonical_phase_span();
    let last = span - 1;

    // Agent A at 0, agent B one step ahead at 1, and agent C one step BEHIND at
    // `last` — because the circle closes. sin of the difference should be equal
    // and opposite: B pulls one way, C pulls the other, by the same amount.
    let ahead = sin_q10(0, 1);
    let behind = sin_q10(0, last);

    assert_eq!(
        ahead, -behind,
        "\nTHE PHASE CIRCLE HAS A SEAM.\n\
         Phase span is {span}, so phase {last} is ONE STEP BEHIND phase 0, not\n\
         {last} steps ahead of it. sin_q10(0, 1) = {ahead} and\n\
         sin_q10(0, {last}) = {behind}; on a closed circle these are negatives\n\
         of each other.\n\
         The table spans 256 and the agents span {span}, so every phase\n\
         difference is read through a circle that is not theirs, and neighbours\n\
         across the wrap are pushed apart by a coupling that should pull them\n\
         together."
    );
}

#[test]
fn a_neighbour_across_the_wrap_reads_as_a_neighbour() {
    let span = canonical_phase_span();
    let last = span - 1;

    // cos of a one-step difference is very nearly 1 whichever way you step.
    let ahead = cos_q10(0, 1);
    let behind = cos_q10(0, last);

    assert_eq!(
        ahead, behind,
        "\ncos_q10 disagrees about the two neighbours of phase 0.\n\
         One step ahead reads {ahead}, one step back reads {behind}. Phase\n\
         coherence gates energy conduction, so on this reading an agent shares\n\
         freely with the neighbour on one side of it and refuses the one on the\n\
         other, for no reason but which side of the wrap it sits on."
    );
}

#[test]
fn opposite_means_opposite() {
    let span = canonical_phase_span();

    // Half a turn on the agents' circle is `span / 2`. That is the maximally
    // out-of-phase pair, and cosine there must be -1 (Q10: -1024).
    let antiphase = cos_q10(0, span / 2);
    assert_eq!(
        antiphase,
        -1024,
        "\nHalf the phase span ({}) does not read as antiphase: cos = {}.\n\
         The most-opposed pair the lattice can contain is being reported as\n\
         orthogonal, so the coupling never reverses and there is no restoring\n\
         force toward agreement.",
        span / 2,
        antiphase
    );
}
