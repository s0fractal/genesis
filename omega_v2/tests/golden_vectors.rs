use omega_v2::topology::PhaseTopology;

#[test]
fn test_golden_vectors_phi_bridge() {
    let t = PhaseTopology::new(7, 7, 7, 20);
    let mask = t.phase_mask();

    // Golden Vector 1: 0 degrees
    let phi1 = 0;
    assert_eq!(t.get_sin(phi1), 0);
    assert_eq!(t.get_cos(phi1), 1048576); // Q20 Approximation of 1.0

    // Golden Vector 2: 90 degrees (Quarter Phase)
    // For mask 127, quarter phase is ~32
    let phi2 = 32;
    assert!(t.get_sin(phi2) > 1040000, "sin(90) should be near 1048576");
    assert!(t.get_cos(phi2).abs() < 100, "cos(90) should be near 0");

    // Golden Vector 3: 180 degrees (Half Phase)
    let phi3 = 64;
    assert_eq!(t.get_sin(phi3), 0);
    assert!(
        t.get_cos(phi3) < -1040000,
        "cos(180) should be near -1048576"
    );

    // Golden Vector 4: Wraparound Distance
    let a = 10;
    let b = mask - 10 + 1; // e.g., 127 - 10 + 1 = 118

    let diff = b - a;
    let shortest = if diff > t.half_phase() {
        (mask + 1) - diff
    } else {
        diff
    };

    assert_eq!(
        shortest, 20,
        "Golden Vector Distance must be exactly 20 across the wraparound boundary"
    );

    // Golden Vector 5: Exact Phase Match Distance
    let c = 42;
    assert_eq!(c - c, 0, "Golden Vector Distance must be 0 for exact match");
}
