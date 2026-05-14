use crate::topology::PhaseTopology;
use crate::constants::{KURAMOTO_COUPLING_BASE, LANDAUER_BIT_COST, DELTA_PHASE_DIVISOR, DELTA_ENERGY_DIVISOR, MAX_ATP};
use crate::crypto::sha256_u32;

/// ERA_ID acts as a version anchor for the mathematical laws of the universe.
pub const ERA_ID: u32 = 960; // 960 Toroidal

/// Calculates a unique 32-bit hash representing the exact physical operator
/// (laws of physics) currently in effect. This forms the basis for commutativity proofs.
pub fn calculate_law_hash(topology: &PhaseTopology) -> u32 {
    let mut buf = [0u8; 64];
    let mut p = 0;

    // 1. ERA ID
    buf[p..p+4].copy_from_slice(&ERA_ID.to_le_bytes()); p += 4;

    // 2. Constants that define metabolic and topological reality
    buf[p..p+4].copy_from_slice(&KURAMOTO_COUPLING_BASE.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&LANDAUER_BIT_COST.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&DELTA_PHASE_DIVISOR.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&DELTA_ENERGY_DIVISOR.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&MAX_ATP.to_le_bytes()); p += 4;

    // 3. Current Phase Topology Constraints
    buf[p..p+4].copy_from_slice(&topology.q_phase.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&topology.q_sectors.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&topology.q_radial.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&topology.q_math.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&topology.weather_multiplier.to_le_bytes()); p += 4;
    buf[p..p+4].copy_from_slice(&topology.alpha.to_le_bytes()); p += 4;

    sha256_u32(&buf[..p])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_law_hash_determinism() {
        let topology1 = PhaseTopology::new(7, 7, 6, 20);
        let topology2 = PhaseTopology::new(7, 7, 6, 20);

        let hash1 = calculate_law_hash(&topology1);
        let hash2 = calculate_law_hash(&topology2);

        assert_eq!(hash1, hash2, "Law hash must be deterministic");

        let topology3 = PhaseTopology::new(6, 7, 6, 20);
        let hash3 = calculate_law_hash(&topology3);
        assert_ne!(hash1, hash3, "Different topology must yield different law hash");
    }
}
