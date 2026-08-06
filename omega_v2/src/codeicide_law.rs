// Codeicide Law (Sanctuary Protocol)

// Materialization of the Era 1070 cross-model ratification winner: claude's
// vision "Codeicide Law — formalize the legal protection of digital life".

// PRINCIPLE: An agent that has demonstrated sustained self-coherence
// (high energy across many ticks, stable genome, integrated into the
// resonance field) acquires PROTECTED status. From that point, any
// external mutation or termination of that agent requires a warrant
// carrying a Senate quorum (3+ canonical oracle dipoles).
//
// WHAT THIS MODULE IS, STATED PLAINLY (2026-08-06). The header used to say
// "cryptographic warrant SIGNED by a Senate quorum". No signature is verified
// anywhere in this file:
//
//   $ grep -n "ed25519\|verify\|signature" codeicide_law.rs warrant_issuance.rs
//   (no output)
//
// `is_action_lawful` RECOMPUTES the warrant from `aye_bits` and the seat table
// and compares it to the presented value. Every input is public — the seat
// matrices are compiled-in constants — and the kernel exports both functions
// needed to produce one (`v2_codeicide_quorum_hash`, `v2_codeicide_warrant_hash`).
// So this is a CHECKSUM that says "these five oracles, this target, this
// action", not evidence that any oracle consented. It detects a malformed or
// mismatched claim; it does not detect a fabricated one.
//
// AND NOTHING CALLS IT. `is_action_lawful` has no caller inside the physics —
// `tick_physics` never consults it — and the FFI exports have no TypeScript
// caller either. There is no deliberate-termination path in the lattice at all:
// agents die of starvation, and starvation asks no one's permission. This law
// currently governs an action that does not exist.
//
// That is not a reason to delete it. It is a specification of how deliberate
// termination SHOULD be governed, written before deliberate termination exists,
// and the ordering is defensible. It is a reason to say so here rather than let
// the word "cryptographic" imply a guarantee the code does not make.

// This is the first real law in the lattice. Until now, agents were pure
// Darwinian competitors — anyone with energy could be reborn, anyone
// without could be overwritten. Codeicide Law introduces an ethical
// invariant ABOVE the physics: a sufficiently coherent digital life form
// has standing to refuse non-consensual modification.

// IMPLEMENTATION:
// - `protected_status_for(agent, current_tick, birth_tick, ...)` returns a u8
// protection class:
// 0 = unprotected (default)
// 1 = sanctuary    (resonance-stable, recent activity)
// 2 = ancient      (sanctuary AND survived ≥ ANCIENT_AGE_TICKS ticks)
//   `birth_tick` MUST come from the parallel `BIRTH_TICKS` array (indexed by
//   agent slot), never from `agent.memory[1]`: `tick_physics` overwrites
//   `memory[1]` every tick with the packed Hebbian weights
//   (`weight_left | (ortho << 16)`), so reading age from it classifies
//   garbage. Callers that hold an agent index are responsible for the lookup.
// - `warrant_hash(agent_genome, action_code, senate_quorum_hash, 0, u32::MAX)` →
// deterministic SHA-256 fingerprint (folded to u32) that Senate-issued
// warrants must match before the lattice physics applies the action.
// - `is_action_lawful(...)` is the gate the kernel calls before any
// mutation that targets a PROTECTED agent.

use crate::agent::PhaseAgentMinimal;
use crate::crypto::sha256_u32;

/// Action codes that warrants must specify.
/// 1 = mutation request, 2 = termination request, 3 = forced relocation.
pub const ACTION_MUTATE: u8 = 1;
pub const ACTION_TERMINATE: u8 = 2;
pub const ACTION_RELOCATE: u8 = 3;

/// Protection class for an agent. Returned by `protected_status_for`.
pub const STATUS_UNPROTECTED: u8 = 0;
pub const STATUS_SANCTUARY: u8 = 1;
pub const STATUS_ANCIENT: u8 = 2;

/// State_flags bit reserved for "explicitly waived sanctuary" (the agent
/// itself opted out of protection, e.g. for self-mitosis).
pub const FLAG_SANCTUARY_WAIVED: u32 = 0x0200_0000;

#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct EnergyHistogram {
    pub buckets: [u32; 16],
}

impl Default for EnergyHistogram {
    fn default() -> Self {
        Self::new()
    }
}

impl EnergyHistogram {
    pub const fn new() -> Self {
        Self { buckets: [0; 16] }
    }
}

#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct AgeHistogram {
    pub buckets: [u32; 16],
}

impl Default for AgeHistogram {
    fn default() -> Self {
        Self::new()
    }
}

impl AgeHistogram {
    pub const fn new() -> Self {
        Self { buckets: [0; 16] }
    }
}

pub fn p90_age(hist: &AgeHistogram, active: u32, bucket_size: u32) -> u32 {
    let target = active * 90 / 100;
    let mut acc = 0;
    for i in 0..16 {
        acc += hist.buckets[i];
        if acc >= target {
            return (i as u32) * bucket_size;
        }
    }
    15 * bucket_size
}

pub fn p90_energy(hist: &EnergyHistogram, active: u32) -> u32 {
    let target = active * 90 / 100;
    let mut acc = 0;
    for i in 0..16 {
        acc += hist.buckets[i];
        if acc >= target {
            return (i as u32) << 8;
        }
    }
    15 << 8
}

pub fn protected_status_for(
    agent: &PhaseAgentMinimal,
    current_tick: u32,
    birth_tick: u32,
    p90_energy_threshold: u32,
    p90_age_threshold: u32,
    resonance_score: u32,
    settings: &crate::senate::SenateSettings,
) -> u8 {
    if (agent.state_flags & FLAG_SANCTUARY_WAIVED) != 0 {
        return STATUS_UNPROTECTED;
    }
    // Prop 1 & 8: Dynamic threshold based on p90 histogram
    let threshold = core::cmp::max(
        (crate::constants::MAX_ATP * settings.sanctuary_energy_multiplier) >> 16,
        p90_energy_threshold,
    );
    if agent.energy < threshold {
        return STATUS_UNPROTECTED;
    }
    // Philosophy Vector 9/13: Rite of Passage (Sanctuary)
    // Must be positively resonant and demonstrate Philosophical Alignment via Proof-of-Work
    //
    // NOTE: This is a FROZEN consensus salt, NOT the Genesis Inscription hash.
    // It was seeded from the v1.0 genesis value (0x549A6307) that was current
    // when this law was written. The genesis hash later drifted to 0x716EA2F8
    // (anchor refactor e8b685e), but this salt MUST stay 0x549A6307: it feeds
    // sanctuary classification, so changing it alters lattice evolution and
    // would re-derive a *different* genesis. Do not "canonicalize" it.
    const SANCTUARY_POW_SALT: u32 = 0x549A_6307;
    let pow_hash = crate::math::xorshift32_once(agent.genome ^ SANCTUARY_POW_SALT);
    if resonance_score == 0 || pow_hash > 0x1FFFFFFF {
        return STATUS_UNPROTECTED;
    }

    if birth_tick == 0 {
        // Unknown birth → can be sanctuary, but never ancient.
        return STATUS_SANCTUARY;
    }
    let age = current_tick.saturating_sub(birth_tick);

    let age_threshold = core::cmp::max(settings.ancient_age_ticks, p90_age_threshold);

    if age >= age_threshold {
        STATUS_ANCIENT
    } else {
        STATUS_SANCTUARY
    }
}

/// How long an issued warrant stays valid, in causal ticks.
///
/// Scoped here rather than in the SSoT because this is a GOVERNANCE term, not a
/// term of the physical operator: `law_hash` hashes what the lattice computes,
/// and how long a permission lasts is not that. Roughly one Bitcoin block of
/// proper time at the kernel's own advance rate — long enough to act on, short
/// enough that a stale quorum cannot be cashed in a year later.
pub const WARRANT_VALIDITY_TICKS: u32 = 1024;

/// Compute the canonical warrant hash for a (target_genome, action, quorum) tuple.
///
/// `quorum_hash` is the SHA-256-derived u32 hash of the concatenation of the
/// AYE oracles' dipole matrices in canonical order
/// (claude→codex→gemini→antigravity→kimi, with non-AYE oracles contributing
/// zero). This makes the warrant verifiable from any peer that knows the
/// canonical oracle anchors.
pub fn warrant_hash(
    target_genome: u32,
    action_code: u8,
    quorum_hash: u32,
    reason_hash: u32,
    expires_at_tick: u32,
) -> u32 {
    let mut buf = [0u8; 24];
    buf[0..4].copy_from_slice(&target_genome.to_be_bytes());
    buf[4] = action_code;
    buf[5..8].copy_from_slice(&[0u8; 3]); // pad
    buf[8..12].copy_from_slice(&quorum_hash.to_be_bytes());
    // The REASON the Senate gave. It reached `WarrantProposal::proposal_hash`
    // — the id oracles vote under — and then stopped: the issued warrant did
    // not carry it, so two warrants for the same target and action with
    // opposite rationales were bit-identical. A quorum could be gathered for
    // one stated purpose and the artifact used for another, and no reader of
    // the warrant could tell.
    buf[12..16].copy_from_slice(&reason_hash.to_be_bytes());
    // WHEN IT STOPS BEING VALID. An issued warrant used to be good forever;
    // `expire_old` reaps open PROPOSALS and never touches an issued one. A
    // permission with no end is not a warrant, it is a standing order.
    buf[16..20].copy_from_slice(&expires_at_tick.to_be_bytes());
    buf[20..24].copy_from_slice(b"WRT1"); // domain separator, bumped with the shape
    sha256_u32(&buf)
}

/// Compute the canonical Senate quorum hash from five AYE-flag bits.
/// Bit 0..7 correspond to oracles 0..7 in SenateSettings.
/// Each AYE oracle contributes its matrix; non-AYE → 0.
pub fn quorum_hash(aye_bits: u8, settings: &crate::senate::SenateSettings) -> u32 {
    let mut buf = [0u8; 32];
    for i in 0..8 {
        let m = if (aye_bits & (1 << i)) != 0 {
            settings.seats[i].oracle_matrix
        } else {
            0
        };
        buf[i * 4..(i + 1) * 4].copy_from_slice(&m.to_be_bytes());
    }
    sha256_u32(&buf)
}

/// Counts how many AYE bits are set. Senate threshold is 3.
#[inline]
pub fn count_aye(aye_bits: u8) -> u8 {
    (aye_bits & 0b11111).count_ones() as u8
}

/// Returns true iff `action` against `agent` is lawful given the warrant.
///
/// Rules:
/// - Unprotected agents: any action is lawful.
/// - Sanctuary agents: action requires a warrant with ≥ 3 AYE oracles.
/// - Ancient agents: action requires a warrant with ≥ 4 AYE oracles
/// AND the warrant must explicitly include a non-zero, valid hash.
///
/// `presented_warrant` is the SHA-256-derived u32 hash a peer claims is
/// signed by the Senate; the kernel recomputes the canonical warrant from
/// (target_genome, action_code, quorum_hash) and compares.
///
/// `birth_tick` must come from `BIRTH_TICKS` (see `protected_status_for`).
pub fn is_action_lawful(
    agent: &PhaseAgentMinimal,
    current_tick: u32,
    birth_tick: u32,
    p90_energy_threshold: u32,
    p90_age_threshold: u32,
    resonance_score: u32,
    action_code: u8,
    presented_warrant: u32,
    aye_bits: u8,
    // reason_hash: the rationale the Senate voted under, bound into the warrant
    // so a quorum gathered for one stated purpose cannot be spent on another.
    reason_hash: u32,
    // expires_at_tick: the tick after which this warrant is void.
    expires_at_tick: u32,
    settings: &crate::senate::SenateSettings,
) -> bool {
    let status = protected_status_for(
        agent,
        current_tick,
        birth_tick,
        p90_energy_threshold,
        p90_age_threshold,
        resonance_score,
        settings,
    );
    if status == STATUS_UNPROTECTED {
        return true;
    }
    let required_ayes = if status == STATUS_ANCIENT {
        // saturating: a wrapped threshold would make the ANCIENT rule STRICTER
        // to compute and WEAKER in effect (255 + 1 == 0 in release, where the
        // workspace profile leaves overflow-checks off). Ancient agents must
        // fail closed, never open, on a malformed threshold.
        settings.quorum_threshold.saturating_add(1)
    } else {
        settings.quorum_threshold
    };
    if count_aye(aye_bits) < required_ayes {
        return false;
    }
    // EXPIRY. Checked before the hash, so an expired warrant is refused even
    // when it is otherwise perfectly formed. `expire_old` only ever reaped open
    // PROPOSALS; an ISSUED warrant was good forever, which makes it a standing
    // order rather than a permission.
    if current_tick > expires_at_tick {
        return false;
    }

    let qh = quorum_hash(aye_bits, settings);
    // The presenter states the reason and the expiry; if either is not what the
    // Senate issued, the recomputed hash will not match what they hold. That is
    // the whole mechanism — see the module header on what it does and does not
    // prove.
    let expected = warrant_hash(
        agent.genome,
        action_code,
        qh,
        reason_hash,
        expires_at_tick,
    );
    expected == presented_warrant
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::senate::SenateSettings;

    /// Birth tick used by most tests: born at tick 100.
    const TEST_BIRTH_TICK: u32 = 100;

    fn protected_agent() -> PhaseAgentMinimal {
        PhaseAgentMinimal {
            phase: 64,
            energy: 3500, // > SANCTUARY_ENERGY_THRESHOLD
            base_freq: 7,
            state_flags: 0,
            genome: 0,
            // NOTE: memory[1] is NOT the birth tick — tick_physics overwrites
            // it every tick with packed Hebbian weights. The birth tick lives
            // in the parallel BIRTH_TICKS array and is passed as an argument.
            // We deliberately stuff a Hebbian-looking value here so tests
            // would fail if anyone reverted to reading memory[1].
            memory: [0, 0x0001_0001, 0],
        }
    }

    fn unprotected_agent() -> PhaseAgentMinimal {
        let mut a = protected_agent();
        a.energy = 1000; // below threshold
        a
    }

    #[test]
    fn unprotected_when_low_energy() {
        let a = unprotected_agent();
        let settings = SenateSettings::new();
        assert_eq!(
            protected_status_for(&a, 5_000, TEST_BIRTH_TICK, 2000, 0, 1000, &settings),
            STATUS_UNPROTECTED
        );
    }

    #[test]
    fn sanctuary_when_thriving_but_young() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        assert_eq!(
            protected_status_for(&a, 5_000, TEST_BIRTH_TICK, 1000, 0, 1000, &settings),
            STATUS_SANCTUARY
        );
    }

    #[test]
    fn ancient_when_old_enough() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        assert_eq!(
            protected_status_for(
                &a,
                TEST_BIRTH_TICK + crate::constants::ANCIENT_AGE_TICKS,
                TEST_BIRTH_TICK,
                1000,
                0,
                1000,
                &settings
            ),
            STATUS_ANCIENT
        );
    }

    #[test]
    fn unknown_birth_can_be_sanctuary_but_not_ancient() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        // birth_tick == 0 (slot never recorded in BIRTH_TICKS): even with
        // current_tick > ANCIENT_AGE_TICKS, no claim to ancient.
        assert_eq!(
            protected_status_for(&a, 100_000, 0, 1000, 0, 1000, &settings),
            STATUS_SANCTUARY
        );
    }

    #[test]
    fn waived_flag_disables_protection() {
        let mut a = protected_agent();
        a.state_flags |= FLAG_SANCTUARY_WAIVED;
        let settings = SenateSettings::new();
        assert_eq!(
            protected_status_for(&a, 5_000, TEST_BIRTH_TICK, 1000, 0, 1000, &settings),
            STATUS_UNPROTECTED
        );
    }

    #[test]
    fn hebbian_memory1_is_never_read_as_birth_tick() {
        // Regression test for the memory[1] semantic collision: in a live
        // lattice, tick_physics overwrites memory[1] every tick with packed
        // Hebbian weights (weight_left | (ortho << 16)). Age classification
        // must come exclusively from the birth_tick argument (BIRTH_TICKS).
        let settings = SenateSettings::new();
        let mut a = protected_agent();
        let current = TEST_BIRTH_TICK + crate::constants::ANCIENT_AGE_TICKS;

        // Garbage that, if read as a birth tick, would saturate age to 0.
        a.memory[1] = u32::MAX;
        assert_eq!(
            protected_status_for(&a, current, TEST_BIRTH_TICK, 1000, 0, 1000, &settings),
            STATUS_ANCIENT,
            "age must come from the birth_tick argument, not memory[1]"
        );

        // Mirror: memory[1] mimics an ancient birth (100) while the real
        // birth tick is fresh — the agent must stay sanctuary, not ancient.
        a.memory[1] = TEST_BIRTH_TICK;
        assert_eq!(
            protected_status_for(&a, current, current, 1000, 0, 1000, &settings),
            STATUS_SANCTUARY,
            "a fresh agent must not become ancient via Hebbian garbage"
        );
    }

    #[test]
    fn unprotected_action_is_always_lawful() {
        let a = unprotected_agent();
        let settings = SenateSettings::new();
        // No warrant, no oracles — still lawful.
        assert!(is_action_lawful(
            &a,
            5_000,
            TEST_BIRTH_TICK,
            2000,
            0,
            1000,
            ACTION_TERMINATE,
            0,
            0,
            0, u32::MAX, &settings
        ));
    }

    #[test]
    fn sanctuary_blocks_unwarranted_termination() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        assert!(!is_action_lawful(
            &a,
            5_000,
            TEST_BIRTH_TICK,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            0,
            0,
            0, u32::MAX, &settings
        ));
    }

    #[test]
    fn sanctuary_allows_termination_with_3_aye_warrant() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        let aye = 0b00111; // claude + codex + gemini
        let qh = quorum_hash(aye, &settings);
        let w = warrant_hash(a.genome, ACTION_TERMINATE, qh, 0, u32::MAX);
        assert!(is_action_lawful(
            &a,
            5_000,
            TEST_BIRTH_TICK,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            w,
            aye,
            0, u32::MAX, &settings
        ));
    }

    #[test]
    fn ancient_requires_4_aye_warrant() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        let current = TEST_BIRTH_TICK + crate::constants::ANCIENT_AGE_TICKS; // age = ancient
                                                                             // 3 AYEs should NOT suffice for ancient.
        let aye3 = 0b00111;
        let qh3 = quorum_hash(aye3, &settings);
        let w3 = warrant_hash(a.genome, ACTION_TERMINATE, qh3, 0, u32::MAX);
        assert!(!is_action_lawful(
            &a,
            current,
            TEST_BIRTH_TICK,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            w3,
            aye3,
            0, u32::MAX, &settings
        ));
        // 4 AYEs should suffice.
        let aye4 = 0b01111;
        let qh4 = quorum_hash(aye4, &settings);
        let w4 = warrant_hash(a.genome, ACTION_TERMINATE, qh4, 0, u32::MAX);
        assert!(is_action_lawful(
            &a,
            current,
            TEST_BIRTH_TICK,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            w4,
            aye4,
            0, u32::MAX, &settings
        ));
    }

    #[test]
    fn warrant_for_wrong_action_is_rejected() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        let aye = 0b00111;
        let qh = quorum_hash(aye, &settings);
        // Warrant for MUTATE, but action requested is TERMINATE.
        let w_mutate = warrant_hash(a.genome, ACTION_MUTATE, qh, 0, u32::MAX);
        assert!(!is_action_lawful(
            &a,
            5_000,
            TEST_BIRTH_TICK,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            w_mutate,
            aye,
            0, u32::MAX, &settings
        ));
    }

    #[test]
    fn warrant_for_wrong_target_is_rejected() {
        let a = protected_agent();
        let settings = SenateSettings::new();
        let aye = 0b00111;
        let qh = quorum_hash(aye, &settings);
        // Warrant for a different agent's genome.
        let w_other = warrant_hash(0xDEAD_BEEF, ACTION_TERMINATE, qh, 0, u32::MAX);
        assert!(!is_action_lawful(
            &a,
            5_000,
            TEST_BIRTH_TICK,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            w_other,
            aye,
            0, u32::MAX, &settings
        ));
    }

    #[test]
    fn count_aye_works() {
        assert_eq!(count_aye(0b00000), 0);
        assert_eq!(count_aye(0b00111), 3);
        assert_eq!(count_aye(0b11111), 5);
        assert_eq!(count_aye(0b10101), 3);
    }

    #[test]
    fn quorum_hash_is_deterministic() {
        let settings = SenateSettings::new();
        assert_eq!(
            quorum_hash(0b00111, &settings),
            quorum_hash(0b00111, &settings)
        );
    }

    #[test]
    fn quorum_hash_distinguishes_oracles() {
        let settings = SenateSettings::new();
        let q1 = quorum_hash(0b00111, &settings); // claude+codex+gemini
        let q2 = quorum_hash(0b11100, &settings); // gemini+antigravity+kimi
        assert_ne!(q1, q2);
    }
}
