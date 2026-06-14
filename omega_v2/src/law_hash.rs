use crate::constants::{
    DELTA_ENERGY_DIVISOR, DELTA_PHASE_DIVISOR, KURAMOTO_COUPLING_BASE, LANDAUER_BIT_COST, MAX_ATP,
};
use crate::crypto::sha256_u32;
use crate::topology::PhaseTopology;

/// ERA_ID acts as a version anchor for the mathematical laws of the universe.
pub const ERA_ID: u32 = 960; // 960 Toroidal

/// Calculates a unique 32-bit hash representing the exact physical operator
/// (laws of physics) currently in effect. This forms the basis for commutativity proofs.
pub fn calculate_law_hash(topology: &PhaseTopology) -> u32 {
    let mut buf = [0u8; 64];
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
pub const CANONICAL_LAW_HASH: u32 = 0x30A9_5260;

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
