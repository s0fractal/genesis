//! Is predatory identity inherited?
//!
//! Predation moves 42% of all the energy this world transfers — 1.21e9 ATP over
//! 20000 ticks against conduction's 1.67e9 — and every neighbour pair has an
//! advantage one way or the other, because `species_advantage` returns 0 only
//! for genomes that are bit-identical.
//!
//! Moving energy is not the same as being selected on. The advantage is derived
//! from `xorshift32_once(genome)`, an avalanche hash: a single flipped bit
//! changes it completely. Mitosis flips several. If a child's predatory
//! relationships bear no resemblance to its parent's, then being good at
//! predation cannot accumulate across generations — the trait is re-rolled every
//! birth, and 42% of the energy budget is a lottery rather than a food web.
//!
//! This measures it against the only baseline that means anything: chance.

use omega_v2::agent::species_advantage;

#[test]
fn a_child_inherits_its_parents_place_in_the_food_web() {
    let mut rng = omega_v2::math::Xorshift64::new(0x0EC0_0107);

    // A fixed panel of "other species" to be scored against.
    let panel: Vec<u32> = (0..256).map(|_| rng.next_u32()).collect();

    let mut agree = 0u32;
    let mut total = 0u32;
    for _ in 0..512 {
        let parent = rng.next_u32();
        // The real mutation: MUTATION_LUT indexed by an epigenetic seed, which
        // is what darwinian_mitosis applies.
        let mask = omega_v2::math::MUTATION_LUT
            [(omega_v2::math::xorshift64_once(parent as u64) & 0xFF) as usize];
        let child = parent ^ mask;
        for &other in &panel {
            if species_advantage(parent, other) == species_advantage(child, other) {
                agree += 1;
            }
            total += 1;
        }
    }

    // THE NULL, MEASURED RATHER THAN ASSUMED. Two unrelated genomes scored
    // against the same panel: whatever they agree on is what agreement is worth
    // before inheritance is involved. Guessing "about half" would have been a
    // number pulled from the shape of the return type, not from this function.
    let mut null_agree = 0u32;
    let mut null_total = 0u32;
    for _ in 0..512 {
        let a = rng.next_u32();
        let b = rng.next_u32();
        for &other in &panel {
            if species_advantage(a, other) == species_advantage(b, other) {
                null_agree += 1;
            }
            null_total += 1;
        }
    }
    let null_rate = null_agree as f64 / null_total as f64;

    let rate = agree as f64 / total as f64;
    // Three outcomes are possible: agreement near 1 means the food web is
    // heritable, near 0 means it inverts on every birth (also heritable, just
    // upside down), and near chance means it is noise. `species_advantage`
    // returns -1, 0 or +1, so blind guessing lands around a third to a half
    // depending on how often 0 comes up — which is almost never here.
    // Scaled between the measured null and perfect inheritance, so the number
    // means "how much of a parent's place in the food web survives one birth"
    // rather than "how often two ternary values happen to match".
    let heritability = (rate - null_rate) / (1.0 - null_rate);

    assert!(
        heritability > 0.25,
        "\nPREDATORY IDENTITY IS NOT INHERITED.\n\
         A child agrees with its parent on {:.1}% of a 256-species panel against\n\
         a measured null of {:.1}% — heritability {:.2}, where 0 is a coin flip.\n\
         `species_advantage` hashes the genome with xorshift32, an avalanche\n\
         function, and mitosis flips several bits at once. Predation moves 42% of\n\
         this world's energy; if none of it survives a birth then an agent that\n\
         feeds well leaves children that do not, and that 42% is a lottery\n\
         rather than a food web.",
        rate * 100.0,
        null_rate * 100.0,
        heritability
    );
    std::eprintln!(
        "  predatory identity: agreement {:.1}%, null {:.1}%, heritability {:.2}",
        rate * 100.0,
        null_rate * 100.0,
        heritability
    );
}

/// Does anyone actually win? No — and by less than chance would allow.
///
/// The relationship is antisymmetric by construction, so every meal has one
/// winner and the books close. That does not settle whether some genomes are
/// better at it. Measured over the SPREAD of win rates against a fixed panel —
/// the mean is 0.5 by antisymmetry and says nothing:
///
/// ```text
/// mean win rate            0.500
/// sd across genomes        0.0124
/// sd of a fair coin        0.0221   (sqrt(0.25/512))
/// ratio                    0.56
/// ```
///
/// The spread is not merely at chance, it is BELOW it. `delta = ha - hb` puts
/// the winner in the lower half of the u32 ring, so a genome beats exactly half
/// of any uniform panel rather than half on average — less variance than
/// independent coin flips can produce.
///
/// So predation moves 42% of this world's energy and, in expectation, moves it
/// nowhere. Being good at predation is not a thing an agent can be: there is no
/// gradient to climb, and 0.44 heritability of an unbiased pattern inherits
/// nothing worth having. It also settles the obvious next mechanism — a
/// similarity threshold making kin neutral would remove a kin's gains and its
/// losses in equal measure, and kin are 4.3% of the flow besides.
///
/// This asserts the fair coin as the MEASURED STATE rather than asserting a
/// spread the world does not have. If predatory advantage is ever made to
/// depend on a trait instead of a hash — which is what would give it a gradient
/// — this test fires, and that is the right moment to notice that 42% of the
/// energy budget has just become selectable.
#[test]
fn predation_is_a_fair_coin_with_no_gradient() {
    let mut rng = omega_v2::math::Xorshift64::new(0xBEEF_0107);
    let panel: Vec<u32> = (0..512).map(|_| rng.next_u32()).collect();

    let mut rates = Vec::new();
    for _ in 0..512 {
        let g = rng.next_u32();
        let wins = panel
            .iter()
            .filter(|&&other| species_advantage(g, other) == 1)
            .count();
        rates.push(wins as f64 / panel.len() as f64);
    }
    let mean = rates.iter().sum::<f64>() / rates.len() as f64;
    let sd = (rates.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / rates.len() as f64).sqrt();
    let chance_sd = (0.25f64 / panel.len() as f64).sqrt();

    std::eprintln!(
        "  win rate: mean {:.3}, sd {:.4}, coin-flip sd {:.4}, ratio {:.2}",
        mean,
        sd,
        chance_sd,
        sd / chance_sd
    );

    assert!(
        (mean - 0.5).abs() < 0.02,
        "predation stopped being antisymmetric: mean win rate {mean:.3}, not 0.5"
    );
    assert!(
        sd < chance_sd,
        "\nPREDATION HAS ACQUIRED A GRADIENT.\n\
         Win rates against a 512-genome panel now have sd {sd:.4}, above the\n\
         {chance_sd:.4} of a fair coin. Some genomes beat more than half of\n\
         everything, which means predatory skill has become selectable — 42% of\n\
         this world's energy budget just started pointing somewhere. That may be\n\
         intended; it is not something to discover later."
    );
}
