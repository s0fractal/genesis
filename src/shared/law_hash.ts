// omega/src/shared/law_hash.ts — deno mirror of omega_v2/src/law_hash.rs.
//
// The law hash is omega's cross-substrate version anchor: a u32 over ERA_ID +
// the frozen physical-law constants + the canonical operating topology. The
// Rust kernel is the source of truth (`calculate_law_hash`); this mirror lets
// the deno status organ surface the same value without an FFI round-trip, and
// is held in lockstep by golden tests on BOTH sides (Rust:
// `test_canonical_law_hash_golden`, deno: `law_hash_test.ts`). Change a law
// constant and both goldens break together — that is the integrity guard.

import {
  BIG_BANG_SEED_DENSITY_Q10,
  CHILD_ENERGY_SEED,
  CHRONOTOPOLOGY_STRESS_DIVISOR,
  DELTA_ENERGY_DIVISOR,
  DELTA_PHASE_DIVISOR,
  KURAMOTO_COUPLING_BASE,
  LANDAUER_BIT_COST,
  MAX_ATP,
  MAX_TIME_DILATION,
  MITOSIS_COST,
  MITOSIS_THRESHOLD,
  PREDATOR_ENERGY_STEAL,
  SOLAR_YIELD_Q10,
  STRUCTURAL_MAINTENANCE_DIVISOR,
} from "./generated_constants.ts";

/** Version anchor for the mathematical laws (mirrors `ERA_ID` in law_hash.rs;
 *  not part of the generated constant set). */
export const ERA_ID = 966;

/** The canonical operating topology — the exact `PhaseTopology` the static
 *  `OMEGA_LATTICE` in lib.rs is built with. Mirrored here (6 ints) and guarded
 *  by the deno↔Rust golden parity test. */
export const CANONICAL_TOPOLOGY = {
  q_phase: 8,
  q_sectors: 7,
  q_radial: 6,
  q_math: 20,
  weather_multiplier: 1024,
  alpha: 64,
} as const;

/** The 21 u32 words hashed, in the exact order `calculate_law_hash` writes
 *  them (little-endian) in omega_v2/src/law_hash.rs.
 *
 *  The nine Era-961 constants were governing physics from OUTSIDE this
 *  preimage, so a node could change what predation, photosynthesis,
 *  reproduction or ignition do and still publish an unchanged law hash. */
function lawWords(): number[] {
  return [
    ERA_ID,
    KURAMOTO_COUPLING_BASE,
    LANDAUER_BIT_COST,
    DELTA_PHASE_DIVISOR,
    DELTA_ENERGY_DIVISOR,
    MAX_ATP,
    SOLAR_YIELD_Q10,
    PREDATOR_ENERGY_STEAL,
    STRUCTURAL_MAINTENANCE_DIVISOR,
    CHRONOTOPOLOGY_STRESS_DIVISOR,
    MAX_TIME_DILATION,
    MITOSIS_THRESHOLD,
    MITOSIS_COST,
    CHILD_ENERGY_SEED,
    BIG_BANG_SEED_DENSITY_Q10,
    CANONICAL_TOPOLOGY.q_phase,
    CANONICAL_TOPOLOGY.q_sectors,
    CANONICAL_TOPOLOGY.q_radial,
    CANONICAL_TOPOLOGY.q_math,
    CANONICAL_TOPOLOGY.weather_multiplier,
    CANONICAL_TOPOLOGY.alpha,
  ];
}

/** Compute the canonical law hash: SHA-256 of the little-endian u32 words, then
 *  the first 4 bytes as a big-endian u32 (matching Rust `sha256_u32`). */
export async function computeLawHash(): Promise<number> {
  const words = lawWords();
  const buf = new Uint8Array(words.length * 4);
  const dv = new DataView(buf.buffer);
  words.forEach((w, i) => dv.setUint32(i * 4, w >>> 0, true)); // little-endian
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) |
    digest[3]) >>> 0;
}

/** `0x` + 8 hex digits, the form trinity status and the Substrate Court compare. */
export function lawHashHex(value: number): string {
  return "0x" + (value >>> 0).toString(16).padStart(8, "0");
}

/** Golden value of [`computeLawHash`] — pinned in lockstep with Rust
 *  `CANONICAL_LAW_HASH` (omega_v2/src/law_hash.rs). */
export const OMEGA_LAW_HASH = 0xca4f4ec9;
