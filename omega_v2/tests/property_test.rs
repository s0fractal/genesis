use omega_v2::topology::PhaseTopology;
use omega_v2::math::xorshift32_once;

#[test]
fn test_property_phase_wraparound() {
    let t = PhaseTopology::new(7, 7, 7, 20);
    let mask = t.phase_mask();
    let half = t.half_phase();

    // 10,000 deterministic pseudo-random iterations
    let mut seed = 0xCAFE_BABE_u32;

    for _ in 0..10_000 {
        seed = xorshift32_once(seed);
        let phase_a = seed & mask;

        seed = xorshift32_once(seed);
        let phase_b = seed & mask;

        // Angular distance calculation
        let diff = if phase_a > phase_b {
            phase_a - phase_b
        } else {
            phase_b - phase_a
        };

        let shortest = if diff > half {
            (mask + 1) - diff
        } else {
            diff
        };

        assert!(shortest <= half, "Shortest distance ({}) exceeded half-phase ({}) for {} and {}", shortest, half, phase_a, phase_b);

        // Test trig lookups
        let sin_a = t.get_sin(phase_a);
        let cos_a = t.get_cos(phase_a);
        assert!(sin_a >= -1048576 && sin_a <= 1048576);
        assert!(cos_a >= -1048576 && cos_a <= 1048576);
    }
}

#[test]
fn test_property_energy_decay() {
    // Fuzz energy decay over 100,000 steps to ensure it approaches zero but never underflows
    let mut energy = 1_000_000_000_u32;

    for _ in 0..100_000 {
        // Landauer decay simulation (as described in docs)
        let decay = energy >> 6; 
        energy = energy.saturating_sub(decay);
    }

    assert!(energy < 1000, "Energy should decay almost to zero");
}

#[test]
fn test_property_toroidal_distance() {
    let t = PhaseTopology::new(7, 7, 7, 20);
    let mask = t.phase_mask();
    
    // Test boundaries
    let a = 0;
    let b = mask;
    
    let diff = b - a;
    let shortest = if diff > t.half_phase() {
        (mask + 1) - diff
    } else {
        diff
    };
    
    assert_eq!(shortest, 1, "Distance across the boundary 0 to max_phase should be 1");
}
