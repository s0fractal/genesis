use crate::constants::{
    BB_FREQ_OFFSET, BB_FREQ_Q_SCALE, BB_FREQ_RANGE, BIG_BANG_SEED_DENSITY_Q10, CHILD_ENERGY_SEED,
    CHRONOTOPOLOGY_STRESS_DIVISOR, DELTA_ENERGY_DIVISOR, DELTA_PHASE_DIVISOR,
    KURAMOTO_COUPLING_BASE, LANDAUER_BIT_COST, MAX_ATP, MAX_TIME_DILATION, MITOSIS_COST,
    MITOSIS_THRESHOLD, PREDATOR_ENERGY_STEAL, SENESCENCE_TICKS, SOLAR_YIELD_Q10,
    STRUCTURAL_MAINTENANCE_DIVISOR,
};
use crate::crypto::sha256_u32;
use crate::topology::PhaseTopology;

/// ERA_ID acts as a version anchor for the mathematical laws of the universe.
///
/// 969 — Mortal. The population replaces itself for the first time.
///
/// Measured on Era 968: the lattice fills to capacity by tick 550 and then
/// NOTHING IS BORN AND NOTHING DIES, for the rest of the run. All 3072 births
/// were fill-up, exactly capacity minus the ignition population, and the trait
/// the physics selects on froze with them — metabolic efficiency 128.35 -> 133.32
/// by tick 2400 and identical to the second decimal at tick 20000. Sweeping the
/// metabolic cost did not help: weather 1024..7168 moved the freezing point and
/// nothing else, with sterility above ~7000 and no band between. A world that
/// filters once and then holds still is a photograph of an ecology.
///
/// Death was reachable only by energy hitting zero, and at equilibrium every
/// agent's income covered its burn, so nobody was ever marginal. Maintenance
/// now rises with AGE — packed into `state_flags` bits 8..23, which nothing
/// used — until upkeep outruns what photosynthesis pays. Death stays an ENERGY
/// outcome, so `death_entropy` books it and the conservation ledger closes
/// exactly as before.
///
/// THE RATE IS HERITABLE, and it has to be. With one lifespan for everybody the
/// population ages as a single cohort: measured, everything born during the fill
/// died together around tick 20000, the survivors refilled together, and the
/// wave returned larger each time until the world collapsed to 349 agents by
/// tick 60000. Scaling the clock by the `resilience` gene — which is called that
/// and until now only ever subtracted 0 or 1 from the burn — spreads lifespans
/// about fivefold, desynchronises the cohorts and makes longevity something
/// selection can act on. Measured after: the population dips to 2218 and
/// recovers to 4006 at tick 60000, with deaths continuing throughout.
///
/// 968 — Quantised. The phase advance stopped throwing away its fractional
/// part. Every term — natural frequency, Kuramoto coupling, attractor drift —
/// was truncated to a whole phase unit before it reached `agent.phase`.
/// Measured on Era 967: the coupling's mean magnitude was 0.103 units and it was
/// EXACTLY ZERO for 89.7% of living agents every tick. For nine agents in ten
/// the term this kernel is named for did not act — not weakly, at all.
///
/// Scaling could not fix it. A sweep of KURAMOTO_COUPLING_BASE over
/// 1024..524288 found the first value large enough to survive truncation was
/// already large enough to overshoot: only the existing setting converged a
/// zero-spread population, everything above destroyed order instead of building
/// it. There is no setting between "absent" and "too big" when the next
/// representable value above zero is one whole phase unit.
///
/// So the whole drift is summed at Q10 and the remainder banked in the low ten
/// bits of `memory[0]`, euclidean so it never runs backwards. A pull of 0.1
/// becomes one unit after ten ticks instead of vanishing ten times. Tissue banks
/// nothing, so dissolving back to motile resumes clean rather than discharging a
/// debt built up while frozen.
///
/// It did not synchronise the world: global order 0.0147 -> 0.0149, velocity
/// correlation +0.0083 -> +0.0105, local phase order 0.0510 -> 0.0533. Shipped
/// because a force that is discarded nine times in ten is a defect on its own
/// terms, and because resolution is now an axis that can be tuned at all.
///
/// Two things that axis then showed, both left unshipped and recorded:
/// narrowing the frequency spread toward the coupling's scale (BB_FREQ_Q_SCALE
/// 1024 -> 128/32/8) doubles global order to 0.028 but extinguishes tissue
/// entirely and drives velocity correlation to zero; and the Sakaguchi lag still
/// has no measurable effect, 0 to 90 degrees, even now that the coupling acts.
///
/// 967 — Unsaturated. The Big Bang drew natural frequencies from ±2000 phase
/// units per tick while the Nyquist clamp caps them at ±max_phase/2 = ±128.
/// Measured: 95% of the living population pinned exactly AT the clamp, mean
/// effective |base_freq| 124.9 out of 128 — 4000 distinct draws collapsing onto
/// two values, and every agent turning half the circle per tick, which is the
/// rate at which forward and backward stop being distinguishable. That is Era
/// 962's bug in a second place: the clamp was fixed, the distribution feeding it
/// was not. BB_FREQ_RANGE 4000 → 64, BB_FREQ_OFFSET 2000 → 32, so frequencies
/// land at a quarter of Nyquist. Measured after: 0% clamped, mean 16.2.
///
/// It did not synchronise the world. Global order 0.0152 → 0.0144, velocity
/// correlation −0.0016 → +0.0083, both still zero. Coupling is 0.105 phase units
/// per tick against a frequency spread of 16.2, so it is 0.6% of what moves a
/// phase — Kuramoto locking needs those to be comparable. That is a second knob
/// and it stays untouched so this one is measured.
///
/// The three BB_FREQ constants are also now IN the law-hash preimage. They set
/// the phase dynamics of every organism the world creates and sat outside it,
/// which is the defect Era 961 closed for nine others.
///
/// 966 — Closed. The agents' phase circle and the trigonometry's phase circle
/// are the same circle for the first time. `sin_q10` indexes a 256-entry table
/// with `(to - from) & 0xFF` while agents wrapped at `1 << q_phase` = 128, so
/// the space the agents lived in was HALF the space the physics measured. That
/// is not a scale factor, it is a SEAM: phases 0 and 127 are one step apart on a
/// circle of 128, and the table read them as 178.6 degrees apart. Measured,
/// `cos_q10(0, 1) = 1024` and `cos_q10(0, 127) = -1024` — the two neighbours of
/// phase 0, read as perfect agreement and perfect opposition. Conduction is
/// gated on that cosine, so an agent shared freely with the neighbour on one
/// side and refused the mirror-image one on the other. q_phase is now 8.
///
/// The reported order parameter was the same artifact: a UNIFORM distribution on
/// half a circle reads as 2/pi = 0.637 through a table twice as wide, so the
/// 0.41 Era 962 claimed as synchronisation was geometry. Read in the agents' own
/// wrap the world has never synchronised — 0.055 then, 0.015 now.
///
/// It did not create domains. Bias-corrected local order is unchanged, 0.1461
/// before and 0.1454 after; the local-over-global ratio rose only because the
/// denominator shrank. Shipped because adjacent phases reading as antiphase is
/// indefensible on its own, whatever it produces. See
/// `tests/phase_circle_is_closed.rs`.
///
/// 965 — Synaptic. The Hebbian weights reach the physics for the first time.
/// `tick_physics` read two learned weights out of memory, updated them against
/// the left and right neighbours' coherence, clamped them, raised them to
/// HEBBIAN_MAX_WEIGHT on crystallisation and wrote them back — and the mean-field
/// sum multiplied every neighbour by the CONSTANT HEBBIAN_DEFAULT_WEIGHT, which
/// the normalisation three lines down divided out again. Four eras of a learning
/// rule writing to a location no term read, under a comment claiming the coupling
/// was modulated by it, with HEBBIAN_MAX_WEIGHT sitting in this preimage and in
/// the shader's constant lock guarding a drift that could not have mattered.
/// Each neighbour now carries its synapse and the normalisation is the mean of
/// the weights actually used, so strong synapses redirect attention rather than
/// amplifying the pull.
///
/// It did NOT produce domains either: local-over-global order 1.093 -> 1.092
/// across 1204 samples. Shipped because a dead term that claims to be live is a
/// defect on its own, and `tests/hebbian_is_load_bearing.rs` now fails if it is
/// ever severed again. An agent has synapses only along x — two of eight
/// neighbours — because it has three memory words and cannot store more; that
/// asymmetry is a property of the data structure, not a choice.
///
/// 964 — Local. Era 963 made crystallisation relative to the population's own
/// p90, which stopped the latch but handed every agent the SAME number to read:
/// the lattice crystallised and dissolved as one body, 22% <-> 96% in phase.
/// `signals.p90_energy` was also the only term anywhere in the physics computed
/// over the whole lattice — every other quantity an agent reads comes from its
/// eight neighbours — so an agent's fate turned on action at a distance. The
/// threshold is now the mean energy of its own living neighbours. That is the
/// entire justification, and it is enough.
///
/// It is NOT differentiation. I predicted lateral inhibition would resolve the
/// medium into patches, added spatial clustering of the tissue flag to
/// `tools/structure_probe.ts` to see it, and measured both laws at matched
/// tissue fraction over 1204 samples each: the effect reverses sign between
/// adjacent bands and the aggregate gain is the fraction confound. Recorded as
/// refuted, alongside the half-circle phase space and the frequency spread.
/// What did change: the fraction now wanders irregularly in 0-61% instead of
/// square-waving, and no agent needs a global broadcast to know what it is.
///
/// 963 — Differentiated. Era 962's coupling worked, and the world used it to
/// turn to stone: measured 100% tissue by tick 640, 4091 of 4096 agents
/// advancing zero phase per tick. Crystallisation was a one-way door with an
/// ABSOLUTE wealth threshold, so a population at carrying capacity crossed it
/// entirely. It is now relative to the population's own p90 and reversible, and
/// the drift is gated on the flag rather than destroying `base_freq` — so an
/// agent that falls out of the top decile becomes motile again. Measured after:
/// the tissue fraction cycles between 22% and 96% instead of latching at 100%.
///
/// 962 — Coherent. Era 961 lit the sun and closed the books, and its Kuramoto
/// coupling still did nothing: measured order parameter 0.02, no domains, no
/// drift in the selected trait. Two unit errors, both Q10-against-raw. The
/// coupling term carried a factor of 1024 too many and displaced agents by a
/// quarter of the phase space per tick; the Nyquist clamp read `base_freq` —
/// stored in Q10 since ignition — against a raw phase bound, collapsing 905
/// distinct natural frequencies to exactly two. Corrected, order reaches 0.41,
/// the population fills its carrying capacity, and the selected trait moves.
///
/// 961 — Photosynthetic. Era 960 was a closed world: it burned down from any
/// starting state and could never reproduce. This era's laws opened it (the sun
/// pays), gated conduction by phase coherence, bounded predation by what the
/// prey holds, priced death in bits, closed reproduction's books, gave the Big
/// Bang somewhere to grow into, and closed the torus.
///
/// **Bumping this is not bookkeeping.** A node on 960 and a node on 961 compute
/// different universes, and the whole purpose of the law hash is that they must
/// not be able to claim agreement. See `behavioral_law_anchor.rs` for the check
/// that catches a law change this constant list cannot see.
pub const ERA_ID: u32 = 969; // 969 Mortal

/// Calculates a unique 32-bit hash representing the exact physical operator
/// (laws of physics) currently in effect. This forms the basis for commutativity proofs.
pub fn calculate_law_hash(topology: &PhaseTopology) -> u32 {
    // 25 words: era + 5 original + 9 Era-961 + 3 Era-967 + 1 Era-969 + 6
    // topology. The buffer is sized past the current count on purpose — it was
    // exactly 96 bytes for 24 words, so the next law to join the preimage would
    // have panicked on a slice bound rather than failing a test.
    let mut buf = [0u8; 128];
    let mut p = 0;

    // 1. ERA ID
    buf[p..p + 4].copy_from_slice(&ERA_ID.to_le_bytes());
    p += 4;

    // 2. Constants that define metabolic and topological reality
    buf[p..p + 4].copy_from_slice(&KURAMOTO_COUPLING_BASE.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&LANDAUER_BIT_COST.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&DELTA_PHASE_DIVISOR.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&DELTA_ENERGY_DIVISOR.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&MAX_ATP.to_le_bytes());
    p += 4;

    // 2b. The constants the Era-961 laws are written in terms of.
    //
    // These were governing physics while sitting OUTSIDE this preimage, which
    // meant a node could change what predation, photosynthesis, reproduction or
    // ignition do and still publish an unchanged law hash — and the Substrate
    // Court would declare it in agreement with a node running the old world.
    // A version anchor that does not move when the version moves is worse than
    // none, because something is relying on it.
    buf[p..p + 4].copy_from_slice(&SOLAR_YIELD_Q10.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&PREDATOR_ENERGY_STEAL.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&STRUCTURAL_MAINTENANCE_DIVISOR.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&CHRONOTOPOLOGY_STRESS_DIVISOR.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&MAX_TIME_DILATION.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&MITOSIS_THRESHOLD.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&MITOSIS_COST.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&CHILD_ENERGY_SEED.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&BIG_BANG_SEED_DENSITY_Q10.to_le_bytes());
    p += 4;

    // 2c. The constants that set every agent's natural frequency.
    //
    // These governed the phase dynamics of the entire population from outside
    // the preimage. Measured on Era 966: they drew base_freq from ±2000 phase
    // units per tick against a Nyquist limit of ±128, so 95% of the living were
    // pinned AT the clamp — 4000 distinct draws collapsing to two values. A node
    // could change the frequency distribution of every organism it creates and
    // publish an unchanged law hash.
    buf[p..p + 4].copy_from_slice(&BB_FREQ_RANGE.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&BB_FREQ_OFFSET.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&BB_FREQ_Q_SCALE.to_le_bytes());
    p += 4;

    // 2d. The senescence clock.
    //
    // It decides how fast an agent's upkeep outruns its income, which is to say
    // how long anything lives. A node running a different value runs a world
    // where the population turns over at a different rate — or, at the value
    // this era replaced, does not turn over at all.
    buf[p..p + 4].copy_from_slice(&SENESCENCE_TICKS.to_le_bytes());
    p += 4;

    // 3. Current Phase Topology Constraints
    buf[p..p + 4].copy_from_slice(&topology.q_phase.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&topology.q_sectors.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&topology.q_radial.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&topology.q_math.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&topology.weather_multiplier.to_le_bytes());
    p += 4;
    buf[p..p + 4].copy_from_slice(&topology.alpha.to_le_bytes());
    p += 4;

    sha256_u32(&buf[..p])
}

/// The law hash over omega's canonical operating topology — the same
/// `PhaseTopology` the static `OMEGA_LATTICE` (lib.rs) is constructed with
/// (q_phase=7, q_sectors=7, q_radial=6, q_math=20, weather=1024, alpha=64).
/// This is the stable cross-substrate version anchor other substrates compare
/// against (Substrate Court). Exposed as a value so deno-side mirrors and
/// trinity status can pin it without an FFI round-trip.
pub fn canonical_law_hash() -> u32 {
    calculate_law_hash(&PhaseTopology::new(8, 7, 6, 20))
}

/// Golden value of [`canonical_law_hash`]. Pinned so any change to a physical
/// law constant (constants.rs) or the canonical topology breaks the test below
/// and forces a conscious bump — kept in lockstep with the deno mirror
/// `omega/src/shared/law_hash.ts` (`OMEGA_LAW_HASH`).
///
/// Moved again to Era 962 on 2026-08-07 when two Q10-against-raw unit errors
/// in the phase dynamics were corrected — see ERA_ID. Moved from 0x30A95260
/// (Era 960) on 2026-08-06. That value was published to
/// the federation and cross-witnessed by trinity`s Substrate Court while seven
/// changes to the physical operator had already landed underneath it — the
/// preimage did not cover them. Any node still reporting 0x30A95260 is running
/// the closed world that burns down at tick 86, and must NOT be treated as
/// agreeing with this one.
pub const CANONICAL_LAW_HASH: u32 = 0x2DEF_BF77;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_law_hash_golden() {
        assert_eq!(
            canonical_law_hash(),
            CANONICAL_LAW_HASH,
            "canonical law hash drifted: a physical law constant or the canonical \
             topology changed. Update CANONICAL_LAW_HASH AND the deno mirror \
             omega/src/shared/law_hash.ts (OMEGA_LAW_HASH) together."
        );
    }

    #[test]
    fn test_law_hash_determinism() {
        let topology1 = PhaseTopology::new(7, 7, 6, 20);
        let topology2 = PhaseTopology::new(7, 7, 6, 20);

        let hash1 = calculate_law_hash(&topology1);
        let hash2 = calculate_law_hash(&topology2);

        assert_eq!(hash1, hash2, "Law hash must be deterministic");

        let topology3 = PhaseTopology::new(6, 7, 6, 20);
        let hash3 = calculate_law_hash(&topology3);
        assert_ne!(
            hash1, hash3,
            "Different topology must yield different law hash"
        );
    }
}
