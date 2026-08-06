use crate::constants::{
    BIG_BANG_SEED_DENSITY_Q10, CHILD_ENERGY_SEED, CHRONOTOPOLOGY_STRESS_DIVISOR,
    DELTA_ENERGY_DIVISOR, DELTA_PHASE_DIVISOR, KURAMOTO_COUPLING_BASE, LANDAUER_BIT_COST, MAX_ATP,
    MAX_TIME_DILATION, MITOSIS_COST, MITOSIS_THRESHOLD, PREDATOR_ENERGY_STEAL, SOLAR_YIELD_Q10,
    STRUCTURAL_MAINTENANCE_DIVISOR,
};
use crate::crypto::sha256_u32;
use crate::topology::PhaseTopology;

/// ERA_ID acts as a version anchor for the mathematical laws of the universe.
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
pub const ERA_ID: u32 = 964; // 964 Local

/// Calculates a unique 32-bit hash representing the exact physical operator
/// (laws of physics) currently in effect. This forms the basis for commutativity proofs.
pub fn calculate_law_hash(topology: &PhaseTopology) -> u32 {
    // 21 words: era + 5 original constants + 9 Era-961 constants + 6 topology.
    let mut buf = [0u8; 96];
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
    calculate_law_hash(&PhaseTopology::new(7, 7, 6, 20))
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
pub const CANONICAL_LAW_HASH: u32 = 0x6CBD_0EAE;

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
