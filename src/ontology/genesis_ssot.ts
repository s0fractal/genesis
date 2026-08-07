/**
 * OMEGA-64 | GENESIS SINGLE SOURCE OF TRUTH (SSoT)
 *
 * This file governs all physical limits, memory offsets, and compile-time constants.
 * It strictly adheres to Deterministic Mathematics (Integers only).
 *
 * Any changes here will automatically re-compile into Rust, WGSL, and TypeScript via \`tools/build_ssot.ts\`.
 *
 * ## `note` — the source of MEANING, not just of truth
 *
 * An outside reviewer read this file and reported ~150 unexplained magic
 * numbers. The diagnosis was half right. Most values here are not empirical:
 * they are Q10 fixed-point (`MATH_Q_SCALE` = 1024), and many already say so
 * structurally by using `expr` instead of a literal. The real defect was that
 * the SSoT had **no channel for meaning at all** — so anyone who needed to
 * explain a constant had nowhere to put the explanation.
 *
 * What that cost, concretely: `CANONICAL_PHASE_ALPHA` — the constant created to
 * close the T3 crack, where a ZK rollup proof was generated under `alpha: 0`
 * while the lattice ran at 64 — was never added to this file. It was written
 * DIRECTLY into `omega_v2/src/constants.rs`, a file whose first line says
 * AUTO-GENERATED, DO NOT EDIT, together with the paragraph explaining why it
 * exists. Running `deno run -A tools/build_ssot.ts` deleted both, and with them
 * the compilation of `omega_v2` and `omega_zk_host`, which have four call
 * sites. The anti-drift constant was one regeneration away from vanishing.
 *
 * So: `note` is emitted as a doc comment into BOTH generated languages. Put the
 * reason a value is what it is here, where regeneration preserves it, and never
 * in the generated files.
 *
 * Guidance for notes: state facts that can be checked (the Q-format and its
 * decimal value, the unit, the call site that constrains it), not intent that
 * cannot. "Q10: 102/1024 ≈ 0.0996" is a fact. "tuned for stability" is not.
 */

export const CONSTANTS = {
  // Math & Hashing
  MATH_Q_BITS: { type: "i32", value: 10 },
  MATH_Q_SCALE: { type: "i32", expr: "1 << MATH_Q_BITS" },
  Q20_SCALE: { type: "i32", expr: "1 << 20" },
  Q24_SCALE: { type: "i32", expr: "1 << 24" },
  NATIVE_GRAVITY: {
    type: "i32",
    value: -51,
    note: [
      "Q10 fixed-point: -51/1024 ≈ -0.0498, i.e. ≈ -5% per tick. Negative = an",
      "inward pull toward the torus centre. Reported as an unexplained magic",
      "number; it is not empirical, it is -0.05 rounded down in Q10 — the same",
      "5% that ADA_MASS_DILATION_MIN (+51) expresses with the opposite sign.",
    ],
  },

  FNV64_OFFSET_BASIS: { type: "u64", value: 14695981039346656037n },
  FNV64_PRIME: { type: "u64", value: 1099511628211n },
  FNV64_MASK: { type: "u64", value: 0xFFFFFFFFFFFFFFFFn },

  // Core Lattice and Phase Mathematics
  PHASE_TAU_DEPTH: { type: "i32", value: 4 },
  // PHASE_LUT_SIZE defines the minimum discrete angular unit (360° / 256).
  // By strictly enforcing a power of 2 (2^8 = 256), the polyglot generators can
  // bypass expensive modulo hardware pipelines in favor of zero-branch bitwise masking (& 255)
  // for continuous deterministic phase wrapping (128 = 180°, 64 = 90°).
  PHASE_LUT_SIZE: { type: "i32", value: 256 },
  PHASE_MAX_AMPLITUDE: { type: "u8", value: 255 },
  PHASE_MAX_LOCK: { type: "u8", value: 255 },
  PHASE_MAX_ENTANGLEMENT: { type: "u8", value: 255 },
  PHASE_HALF_PHASE: { type: "i32", value: 128 },
  PHASE_MIN_OMEGA: { type: "i16", value: -16 },
  PHASE_MAX_OMEGA: { type: "i16", value: 16 },
  PHASE_MAX_OMEGA_BRIDGE: { type: "i16", value: 32 },
  PHASE_FOSSILIZATION_PULSE_TICKS: { type: "i32", value: 24 },

  // Kuramoto Thermodynamics (Q10 Format)
  KURAMOTO_COUPLING_BASE: { type: "i32", expr: "MATH_Q_SCALE" },
  KURAMOTO_COUPLING_HARMONIC_PEER: { type: "i32", expr: "MATH_Q_SCALE / 2" },
  KURAMOTO_COUPLING_ANTIPODE: { type: "i32", expr: "(MATH_Q_SCALE * 7) / 20" },
  KURAMOTO_COHERENCE_THRESHOLD_LOCK: { type: "i32", expr: "MATH_Q_SCALE * 3" },
  KURAMOTO_COHERENCE_THRESHOLD_HIGH: {
    type: "i32",
    expr: "(MATH_Q_SCALE * 42) / 10",
  },
  KURAMOTO_ADOPTION_RESONANCE_THRESHOLD: {
    type: "i32",
    expr: "(MATH_Q_SCALE * 6) / 10",
  },
  KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD: {
    type: "i32",
    expr: "(MATH_Q_SCALE * 92) / 100",
  },
  KURAMOTO_COUPLING_PLASMID: { type: "i32", expr: "(MATH_Q_SCALE * 3) / 4" },
  KURAMOTO_PLASMID_DIFFUSION_RATE: { type: "i32", expr: "MATH_Q_SCALE / 20" },

  // Evolutionary Parameters
  MUTATION_BASE_COST: { type: "i32", value: 50 },
  MUTATION_MIN_COST: { type: "i32", value: 5 },
  MUTATION_MAX_COST: { type: "i32", value: 500 },
  MUTATION_SMOOTHING_FACTOR: {
    type: "i32",
    value: 102,
    note: [
      "Q10 fixed-point: 102/1024 ≈ 0.0996, i.e. a ≈10% exponential smoothing",
      "coefficient on mutation cost. Deliberately kept as a literal rather than",
      "`expr: MATH_Q_SCALE / 10` (which truncates to the same 102): 102 is what",
      "the golden traces were recorded against, and the traces are the anchor.",
    ],
  },

  // Senate & Shadow Network Governance
  SENATE_ORACLE_TIMEOUT_MS: { type: "i32", value: 16 },
  SENATE_MYCELIUM_MIN_LOCKS: { type: "i32", value: 1000 },
  SENATE_MYCELIUM_MIN_ENERGY: { type: "i32", value: 220 },
  SENATE_SHADOW_BUCKET_MIN: { type: "i32", value: 1000 },
  SENATE_SHADOW_BUCKET_MAX: { type: "i32", value: 1024 },

  // Tissue and Morphological Hardening
  TISSUE_MORPHOLOGICAL_HYSTERESIS: { type: "i32", value: 5 },
  TISSUE_MORPHOLOGICAL_DELTA_MIN: {
    type: "i32",
    expr: "(MATH_Q_SCALE * 15) / 100",
  },

  CANONICAL_PHASE_ALPHA: {
    type: "i32",
    value: 64,
    note: [
      "Canonical Sakaguchi-Kuramoto phase lag for the production coupling law",
      "(≈ 90°, the golden-angle compromise). Part of the LAW a ZK rollup proof",
      "binds: the guest reads `alpha` from the wire and commits it in the public",
      "values, so a proof states which coupling law it proved rather than being",
      "assumed to have proved this one.",
      "",
      "SSOT because it was not: the value 64 was a bare literal in four places",
      "(`topology.rs`, `lib.rs`, and twice in `omega_zk_host`), which is how a",
      "rollup proof came to be generated under `alpha: 0` while the canonical",
      "lattice ran at 64 — the T3 crack. A literal cannot be kept in agreement",
      "with three other literals.",
      "",
      "This note lived in the GENERATED constants.rs until 2026-08-06, i.e. in a",
      "file marked DO NOT EDIT — as did the constant itself. Regenerating the",
      "SSoT deleted both and broke the build of omega_v2 and omega_zk_host.",
    ],
  },

  // === Biological Economy ===
  BIOLOGY_SOMATIC_ALPHA: { type: "i32", expr: "(MATH_Q_SCALE * 3) / 2" },
  BIOLOGY_SOMATIC_DECAY_RATE: { type: "i32", expr: "MATH_Q_SCALE / 20" },
  BIOLOGY_SOMATIC_BASE_COST: { type: "i32", value: 5 },
  BIOLOGY_EXTINCTION_THRESHOLD: { type: "i32", value: 0 },

  // === Adaptive Phase Biology (Phase 12) ===
  BIOLOGY_APA_LEARNING_RATE: { type: "i32", expr: "MATH_Q_SCALE / 20" }, // 0.05 * MATH_Q_SCALE
  BIOLOGY_APA_MEMORY_GAIN: { type: "i32", expr: "MATH_Q_SCALE / 10" }, // 0.1 * MATH_Q_SCALE
  BIOLOGY_APA_DECISION_COST: { type: "i32", value: 2 },
  BIOLOGY_APA_COHERENCE_REWARD: {
    type: "i32",
    expr: "(MATH_Q_SCALE * 6) / 10",
  }, // 0.6 * MATH_Q_SCALE
  BIOLOGY_APA_MEMORY_DECAY: { type: "i32", expr: "MATH_Q_SCALE - 1" }, // 0.999 * MATH_Q_SCALE

  // === ADA Relativity & Recovery ===
  ADA_HODLER_BRAKE: {
    type: "i32",
    value: 972,
    note: [
      "Q10 fixed-point: 972/1024 ≈ 0.9492, i.e. a ≈95% multiplier.",
      "",
      "UNREFERENCED: as of 2026-08-06 no code in omega_v2, omega_zk_host,",
      "omega_zk_guest, src/, tools/ or tests/ reads this constant — it is",
      "declared truth with no consumer. What behaviour it was meant to brake is",
      "therefore not recoverable from the tree, and is deliberately NOT guessed",
      "at here. Whoever revives it should write down the intent then.",
    ],
  },
  ADA_QE_STIMULUS_MAX: { type: "i32", value: 500 },
  ADA_QE_STIMULUS_MIN: { type: "i32", value: 100 },
  ADA_MASS_DILATION_MIN: { type: "i32", value: 51 },
  ADA_MASS_DILATION_MAX: { type: "i32", value: 1024 },
  ADA_MASS_DILATION_NUM: { type: "i32", value: 3072 },

  // === Cognitive Oracle ===
  ORACLE_INVOCATION_COST: { type: "i32", value: 10000 },
  ORACLE_LEDGER_MAX_EVENTS: { type: "i32", value: 1000 },
  ORACLE_LEDGER_TRUNCATE: { type: "i32", value: 800 },
  ORACLE_MAX_SYSTEM_ENERGY: { type: "i32", value: 21000000 },
  ORACLE_BACKOFF_BASE_MS: { type: "i32", value: 5000 },
  ORACLE_BACKOFF_MAX_MS: { type: "i32", value: 60000 },
  ORACLE_AKASHIC_GC_THRESHOLD: { type: "i32", value: 15000 },
  ORACLE_AKASHIC_GC_TARGET: { type: "i32", value: 8000 },

  // === Mycelial Network (Kademlia) ===
  NETWORK_MYCELIUM_RATE_LIMIT: { type: "i32", value: 50 },
  NETWORK_WEBRTC_RECONNECT_CAP: { type: "i32", value: 30000 },
  NETWORK_MAX_PEERS_BUCKET: { type: "i32", value: 3 },

  // === WGSL Semantic Weights ===
  WGSL_MYCELIAL_COUPLING: { type: "i32", value: 4096 },
  WGSL_STAKING_COUPLING: { type: "i32", value: 3072 },

  // === Evolutionary Sandbox Physics (Phase 14) ===
  ESP_COUPLING_K_MIN: { type: "i32", value: 10 }, // ~0.01 * 1024
  ESP_COUPLING_K_MAX: { type: "i32", value: 2048 }, // 2.0 * 1024
  ESP_MUTATION_RATE_MIN: { type: "i32", value: 1 }, // ~0.001 * 1024
  ESP_MUTATION_RATE_MAX: { type: "i32", value: 102 }, // ~0.1 * 1024
  ESP_DIFFUSION_RATE_MIN: { type: "i32", value: 0 },
  ESP_DIFFUSION_RATE_MAX: { type: "i32", value: 1024 }, // 1.0 * 1024
  ESP_GLOBAL_ENERGY_CONSERVATION_ENFORCED: { type: "i32", value: 1 }, // Boolean flag mapped as integer

  // === Omega V2 Legacy Constants ===
  MAX_ATP: { type: "u32", value: 4096 },
  BB_ENERGY_RANGE: { type: "u32", expr: "MAX_ATP / 4" },
  BB_ENERGY_BASE: { type: "u32", expr: "MAX_ATP / 32" },
  // Era 967. Was 4000/2000 — the Big Bang drew base_freq from +-2000 phase
  // units per tick while the Nyquist clamp caps at +-max_phase/2 = +-128, so 95%
  // of the living population sat exactly AT the clamp: 4000 distinct draws
  // collapsing onto two values, every agent turning half the circle per tick.
  // A quarter of Nyquist leaves the distribution intact — measured, 0% clamped.
  // Senescence. Metabolic maintenance is multiplied by (1 + age/this), so an
  // agent's upkeep doubles every SENESCENCE_TICKS and eventually outruns what
  // photosynthesis pays it. Death here stays an energy outcome rather than a
  // special case, so the conservation books close exactly as before.
  //
  // Without it the lattice fills to capacity by tick 550 and then nothing is
  // born and nothing dies, forever — measured over 20000 ticks, at every
  // weather from 1024 to 7168. Selection ran once during the fill and never
  // again.
  SENESCENCE_TICKS: { type: "u32", value: 512 },
  // Latitude. The sun used to fall on every cell equally, so every agent lived
  // in the same world and the population could only ever have ONE answer — it
  // converged on a single resilience and averaged out. This is the fraction of
  // insolation the poles lose relative to the equator, in Q10: 768 leaves the
  // pole at 25% of equatorial light. Habitable but harsh, which is the only
  // setting under which a second strategy can pay.
  LATITUDE_AMPLITUDE_Q10: { type: "i32", value: 768 },
  BB_FREQ_RANGE: { type: "u32", value: 64 },
  BB_FREQ_OFFSET: { type: "i32", value: 32 },
  BB_FREQ_STEP: { type: "i32", value: 1000 },
  BB_FREQ_Q_SCALE: { type: "i32", value: 1024 },
  Q16_FACTOR_MITOSIS: { type: "u32", value: 32768 },
  MITOSIS_THRESHOLD: {
    type: "u32",
    expr: "(MAX_ATP * Q16_FACTOR_MITOSIS) >> 16",
  },
  MITOSIS_COST: { type: "u32", expr: "MAX_ATP / 4" },
  CHILD_ENERGY_SEED: { type: "u32", expr: "MAX_ATP / 4" },
  PHASE_MASK_8BIT: { type: "u32", value: 255 },
  RESONANCE_PHASE_MODULUS: { type: "u32", value: 64 },
  CHRONOTOPOLOGY_STRESS_DIVISOR: { type: "u32", value: 32 },
  MAX_TIME_DILATION: { type: "u32", value: 8 },
  LANDAUER_BIT_COST: { type: "u32", expr: "MAX_ATP / MAX_ATP" },
  STRUCTURAL_MAINTENANCE_DIVISOR: { type: "u32", value: 8 },
  STRESSOR_MIXER: { type: "u32", value: 17 },
  STRESSOR_MODULUS: { type: "u32", value: 100 },
  HOMEOSTASIS_Q_SHIFT: { type: "u32", value: 10 },
  PHASE_DRIFT_Q_SHIFT: { type: "u32", value: 20 },
  HEBBIAN_DEFAULT_WEIGHT: { type: "i32", expr: "MATH_Q_SCALE" },
  HEBBIAN_MAX_WEIGHT: { type: "i32", expr: "MATH_Q_SCALE * 4" },
  DELTA_PHASE_DIVISOR: { type: "u32", value: 8 },
  Q16_FACTOR_SANCTUARY: { type: "u32", value: 40000 },
  SANCTUARY_ENERGY_THRESHOLD: {
    type: "u32",
    expr: "(MAX_ATP * Q16_FACTOR_SANCTUARY) >> 16",
  },
  Q16_FACTOR_ANCIENT_AGE: { type: "u32", value: 163840 },
  ANCIENT_AGE_TICKS: {
    type: "u32",
    expr: "(MAX_ATP * Q16_FACTOR_ANCIENT_AGE) >> 16",
  },
  PREDATOR_ENERGY_STEAL: { type: "u32", expr: "(MAX_ATP / 1024) + 1" },
  BIG_BANG_SEED_DENSITY_Q10: {
    type: "u32",
    value: 256,
    note:
      "Fraction of the allocated lattice that the Big Bang seeds with life " +
      "(256/1024 = 25%). The rest is the room the world grows into. Ignition " +
      "used to fill every slot, which made reproduction impossible by " +
      "construction: mitosis places a child in a vacancy, a vacancy needs a " +
      "death, and a world that starts full has neither. Empty Center, taken " +
      "literally.",
  },
  SOLAR_YIELD_Q10: {
    type: "u32",
    value: 18432,
    note:
      "Q10 ATP per living agent per tick at neutral sun (18432/1024 = 18); " +
      "zero at midnight, 36 at noon. Calibrated by measurement, not taste " +
      "(tools/ecology_probe.ts): at this yield the FITTEST agents reach the " +
      "2048 reproduction threshold and the rest do not, which is what makes " +
      "an environment selective rather than merely survivable. Below it " +
      "(9216) nobody approaches maturity; well above it every agent clears " +
      "the bar at once and efficiency stops mattering. Note the homeostat " +
      "pushes back: metabolic_pressure scales burn with the population's own " +
      "average wealth, so yield and equilibrium are not proportional.",
  },
  DELTA_ENERGY_DIVISOR: { type: "u32", value: 128 },
  GOLDEN_TRACE_SAMPLES: { type: "u32", value: 32 },
};

export const MACROS = {
  fast_abs: {
    args: [{ name: "v", type: "i32" }],
    returns: "i32",
    wgsl: "let mask = v >> 31u;\nreturn (v ^ mask) - mask;",
    rust: "let mask = v >> 31;\n(v ^ mask) - mask",
    ts: "const mask = v >> 31;\nreturn (v ^ mask) - mask;",
  },
  q20_round: {
    args: [{ name: "x", type: "i32" }],
    returns: "i32",
    wgsl:
      "if (x >= 0) { return (x + 524288) / 1048576; }\nreturn (x - 524288) / 1048576;",
    rust:
      "if x >= 0 { (x + 524288) / 1048576 } else { (x - 524288) / 1048576 }",
    ts:
      "return x >= 0 ? Math.floor((x + 524288) / 1048576) : Math.ceil((x - 524288) / 1048576);",
  },
  sin_q10: {
    args: [{ name: "from_theta", type: "u32" }, {
      name: "to_theta",
      type: "u32",
    }],
    returns: "i32",
    wgsl:
      "let index = (to_theta + 256u - from_theta) % 256u;\nreturn SINE_LUT[index];",
    rust:
      "let index = (to_theta as u32 + 256 - from_theta as u32) % 256;\nSINE_LUT[index as usize]",
    ts:
      "const index = (to_theta + 256 - from_theta) % 256;\nreturn SINE_LUT[index];",
  },
  cos_q10: {
    args: [{ name: "from_theta", type: "u32" }, {
      name: "to_theta",
      type: "u32",
    }],
    returns: "i32",
    wgsl:
      "let index = (to_theta + 256u - from_theta + 64u) % 256u;\nreturn SINE_LUT[index];",
    rust:
      "let index = (to_theta as u32 + 256 - from_theta as u32 + 64) % 256;\nSINE_LUT[index as usize]",
    ts:
      "const index = (to_theta + 256 - from_theta + 64) % 256;\nreturn SINE_LUT[index];",
  },
  mix_u64: {
    args: [{ name: "hash", type: "u64" }, { name: "value", type: "u64" }],
    returns: "u64",
    wgsl: null,
    rust: "let h = hash ^ value;\nh.wrapping_mul(FNV64_PRIME)",
    ts: "const h = hash ^ value;\nreturn BigInt.asUintN(64, h * FNV64_PRIME);",
  },
  wrap_index: {
    args: [{ name: "value", type: "i32" }, { name: "modulo", type: "i32" }],
    returns: "i32",
    wgsl: "return value & (modulo - 1);",
    rust: "value & (modulo - 1)",
    ts: "return value & (modulo - 1);",
  },
  signed_phase_delta: {
    args: [{ name: "from_theta", type: "i32" }, {
      name: "to_theta",
      type: "i32",
    }],
    returns: "i32",
    wgsl:
      "let delta = (to_theta - from_theta) & 255;\nif (delta > 128) { return delta - 256; }\nreturn delta;",
    rust:
      "let delta = (to_theta - from_theta) & 255;\nif delta > 128 { delta - 256 } else { delta }",
    ts:
      "const delta = (to_theta - from_theta) & 255;\nreturn delta > 128 ? delta - 256 : delta;",
  },
  phase_distance: {
    args: [{ name: "a", type: "i32" }, { name: "b", type: "i32" }],
    returns: "i32",
    wgsl:
      "let diff = fast_abs(a - b) & 255;\nif (diff > 128) { return 256 - diff; }\nreturn diff;",
    rust:
      "let diff = fast_abs(a - b) & 255;\nif diff > 128 { 256 - diff } else { diff }",
    ts:
      "const diff = fast_abs(a - b) & 255;\nreturn diff > 128 ? 256 - diff : diff;",
  },
  clamp_i32: {
    args: [{ name: "value", type: "i32" }, { name: "min_val", type: "i32" }, {
      name: "max_val",
      type: "i32",
    }],
    returns: "i32",
    wgsl: "return clamp(value, min_val, max_val);",
    rust: "value.clamp(min_val, max_val)",
    ts: "return Math.min(max_val, Math.max(min_val, value));",
  },
  atan2_u8: {
    args: [{ name: "y", type: "i32" }, { name: "x", type: "i32" }],
    returns: "u8",
    wgsl: `
    if (x == 0 && y == 0) { return 0i; }
    let abs_y = fast_abs(y);
    let abs_x = fast_abs(x);
    let a = min(abs_y, abs_x);
    let b = max(abs_y, abs_x);
    var ratio = 0i;
    if (b != 0) { ratio = (a * 128) / b; }
    if (ratio > 128) { ratio = 128; }
    let octant_angle = i32(ATAN_LUT[ratio]);
    var quadrant_angle = octant_angle;
    if (abs_y > abs_x) { quadrant_angle = 64 - octant_angle; }
    if (x < 0) {
        if (y < 0) { return (128 + quadrant_angle) & 255; }
        else { return (128 - quadrant_angle) & 255; }
    } else {
        if (y < 0) { return (256 - quadrant_angle) & 255; }
        else { return quadrant_angle & 255; }
    }
        `.trim(),
    rust: `
    if x == 0 && y == 0 { return 0; }
    let abs_y = fast_abs(y);
    let abs_x = fast_abs(x);
    let a = abs_y.min(abs_x);
    let b = abs_y.max(abs_x);
    let mut ratio = if b == 0 { 0 } else { (a * 128) / b };
    if ratio > 128 { ratio = 128; }
    let octant_angle = ATAN_LUT[ratio as usize];
    let quadrant_angle = if abs_y > abs_x { 64 - octant_angle } else { octant_angle };
    if x < 0 {
        if y < 0 { 128u8.wrapping_add(quadrant_angle) } else { 128u8.wrapping_sub(quadrant_angle) }
    } else {
        if y < 0 { 256u16.wrapping_sub(quadrant_angle as u16) as u8 } else { quadrant_angle }
    }
        `.trim(),
    ts: `
    if (x === 0 && y === 0) { return 0; }
    const abs_y = fast_abs(y);
    const abs_x = fast_abs(x);
    const a = Math.min(abs_y, abs_x);
    const b = Math.max(abs_y, abs_x);
    let ratio = b === 0 ? 0 : Math.floor((a * 128) / b);
    if (ratio > 128) { ratio = 128; }
    const octant_angle = ATAN_LUT[ratio];
    const quadrant_angle = abs_y > abs_x ? 64 - octant_angle : octant_angle;
    if (x < 0) {
        if (y < 0) { return (128 + quadrant_angle) & 255; }
        else { return (128 - quadrant_angle) & 255; }
    } else {
        if (y < 0) { return (256 - quadrant_angle) & 255; }
        else { return quadrant_angle & 255; }
    }
        `.trim(),
  },
};

// HARDCODED DETERMINISTIC LUTS (0% Transcendent Drift)
export const LUTS = {
  // SINE_LUT: [i32; 256] -> Math.sin(x) in Q10 format (-1024 to +1024)
  SINE_LUT: {
    type: "i32",
    len: 256,
    data: [
      0,
      25,
      50,
      75,
      100,
      125,
      150,
      175,
      200,
      224,
      249,
      273,
      297,
      321,
      345,
      369,
      392,
      415,
      438,
      460,
      483,
      505,
      526,
      548,
      569,
      590,
      610,
      630,
      650,
      669,
      688,
      706,
      724,
      742,
      759,
      775,
      792,
      807,
      822,
      837,
      851,
      865,
      878,
      891,
      903,
      915,
      926,
      936,
      946,
      955,
      964,
      972,
      980,
      987,
      993,
      999,
      1004,
      1009,
      1013,
      1016,
      1019,
      1021,
      1023,
      1024,
      1024,
      1024,
      1023,
      1021,
      1019,
      1016,
      1013,
      1009,
      1004,
      999,
      993,
      987,
      980,
      972,
      964,
      955,
      946,
      936,
      926,
      915,
      903,
      891,
      878,
      865,
      851,
      837,
      822,
      807,
      792,
      775,
      759,
      742,
      724,
      706,
      688,
      669,
      650,
      630,
      610,
      590,
      569,
      548,
      526,
      505,
      483,
      460,
      438,
      415,
      392,
      369,
      345,
      321,
      297,
      273,
      249,
      224,
      200,
      175,
      150,
      125,
      100,
      75,
      50,
      25,
      0,
      -25,
      -50,
      -75,
      -100,
      -125,
      -150,
      -175,
      -200,
      -224,
      -249,
      -273,
      -297,
      -321,
      -345,
      -369,
      -392,
      -415,
      -438,
      -460,
      -483,
      -505,
      -526,
      -548,
      -569,
      -590,
      -610,
      -630,
      -650,
      -669,
      -688,
      -706,
      -724,
      -742,
      -759,
      -775,
      -792,
      -807,
      -822,
      -837,
      -851,
      -865,
      -878,
      -891,
      -903,
      -915,
      -926,
      -936,
      -946,
      -955,
      -964,
      -972,
      -980,
      -987,
      -993,
      -999,
      -1004,
      -1009,
      -1013,
      -1016,
      -1019,
      -1021,
      -1023,
      -1024,
      -1024,
      -1024,
      -1023,
      -1021,
      -1019,
      -1016,
      -1013,
      -1009,
      -1004,
      -999,
      -993,
      -987,
      -980,
      -972,
      -964,
      -955,
      -946,
      -936,
      -926,
      -915,
      -903,
      -891,
      -878,
      -865,
      -851,
      -837,
      -822,
      -807,
      -792,
      -775,
      -759,
      -742,
      -724,
      -706,
      -688,
      -669,
      -650,
      -630,
      -610,
      -590,
      -569,
      -548,
      -526,
      -505,
      -483,
      -460,
      -438,
      -415,
      -392,
      -369,
      -345,
      -321,
      -297,
      -273,
      -249,
      -224,
      -200,
      -175,
      -150,
      -125,
      -100,
      -75,
      -50,
      -25,
    ],
  },
  // ENTROPY_LUT: [i32; 256] -> -P(x) * log2(P(x)) * 1024
  ENTROPY_LUT: {
    type: "i32",
    len: 256,
    data: [
      0,
      32,
      56,
      77,
      96,
      114,
      130,
      145,
      160,
      174,
      187,
      200,
      212,
      224,
      235,
      246,
      256,
      266,
      276,
      285,
      294,
      303,
      312,
      320,
      328,
      336,
      343,
      350,
      358,
      364,
      371,
      378,
      384,
      390,
      396,
      402,
      408,
      413,
      418,
      423,
      428,
      433,
      438,
      443,
      447,
      451,
      456,
      460,
      464,
      468,
      471,
      475,
      478,
      482,
      485,
      488,
      491,
      494,
      497,
      500,
      502,
      505,
      507,
      510,
      512,
      514,
      516,
      518,
      520,
      522,
      524,
      525,
      527,
      529,
      530,
      531,
      533,
      534,
      535,
      536,
      537,
      538,
      539,
      539,
      540,
      541,
      541,
      542,
      542,
      543,
      543,
      543,
      543,
      543,
      543,
      543,
      543,
      543,
      543,
      543,
      542,
      542,
      542,
      541,
      541,
      540,
      539,
      539,
      538,
      537,
      536,
      535,
      534,
      533,
      532,
      531,
      530,
      529,
      527,
      526,
      525,
      523,
      522,
      520,
      519,
      517,
      515,
      514,
      512,
      510,
      508,
      506,
      505,
      503,
      501,
      499,
      496,
      494,
      492,
      490,
      488,
      485,
      483,
      481,
      478,
      476,
      473,
      471,
      468,
      465,
      463,
      460,
      457,
      454,
      452,
      449,
      446,
      443,
      440,
      437,
      434,
      431,
      428,
      425,
      421,
      418,
      415,
      412,
      408,
      405,
      402,
      398,
      395,
      391,
      388,
      384,
      381,
      377,
      373,
      370,
      366,
      362,
      358,
      355,
      351,
      347,
      343,
      339,
      335,
      331,
      327,
      323,
      319,
      315,
      310,
      306,
      302,
      298,
      294,
      289,
      285,
      281,
      276,
      272,
      267,
      263,
      258,
      254,
      249,
      245,
      240,
      235,
      231,
      226,
      221,
      217,
      212,
      207,
      202,
      197,
      192,
      187,
      183,
      178,
      173,
      168,
      163,
      157,
      152,
      147,
      142,
      137,
      132,
      127,
      121,
      116,
      111,
      105,
      100,
      95,
      89,
      84,
      79,
      73,
      68,
      62,
      57,
      51,
      45,
      40,
      34,
      29,
      23,
      17,
      11,
      6,
    ],
  },
  // ATAN_LUT: [u8; 129] -> Octant angles (0..32) for atan2 ratios (0..128)
  ATAN_LUT: {
    type: "u8",
    len: 129,
    data: [
      0,
      0,
      1,
      1,
      1,
      2,
      2,
      2,
      3,
      3,
      3,
      3,
      4,
      4,
      4,
      5,
      5,
      5,
      6,
      6,
      6,
      7,
      7,
      7,
      8,
      8,
      8,
      8,
      9,
      9,
      9,
      10,
      10,
      10,
      11,
      11,
      11,
      11,
      12,
      12,
      12,
      13,
      13,
      13,
      13,
      14,
      14,
      14,
      15,
      15,
      15,
      15,
      16,
      16,
      16,
      17,
      17,
      17,
      17,
      18,
      18,
      18,
      18,
      19,
      19,
      19,
      19,
      20,
      20,
      20,
      20,
      21,
      21,
      21,
      21,
      22,
      22,
      22,
      22,
      23,
      23,
      23,
      23,
      23,
      24,
      24,
      24,
      24,
      25,
      25,
      25,
      25,
      25,
      26,
      26,
      26,
      26,
      26,
      27,
      27,
      27,
      27,
      27,
      28,
      28,
      28,
      28,
      28,
      29,
      29,
      29,
      29,
      29,
      29,
      30,
      30,
      30,
      30,
      30,
      31,
      31,
      31,
      31,
      31,
      31,
      32,
      32,
      32,
      32,
    ],
  },
};
