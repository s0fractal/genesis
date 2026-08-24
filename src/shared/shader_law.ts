// The law the SHADER declares.
//
// `law_hash.ts` mirrors the kernel's `calculate_law_hash`: it hashes what the
// Rust source says the physics is. But the substrate that actually runs the
// physics in production is `compute_toroidal.wgsl`, and its physical constants
// are HAND-COPIED — `tools/build_ssot.ts` stopped emitting WGSL, so nothing
// binds that block to `constants.rs`. Ten values sat there, correct by
// coincidence and by nobody's check.
//
// That mattered twice over. The audit of 45e85ca flagged it as an unlocked
// seam. And the Substrate Court carried it further: the GPU witness reported
// `lawHash: lawHash` — the WASM value, copied — with a comment saying "WebGPU
// uses the same law for now". So law drift, one of the two things that court
// exists to catch, was structurally undetectable: a shader compiled from a
// different set of constants would testify to the kernel's law.
//
// This computes a law hash from the constants the shader itself declares, over
// the same set and the same order as the kernel's, with the same hash function.
// Equal means the two substrates agree about the physics they are running.
// Different means they do not, and now something can say so — at build time via
// the drift lock in `tests/shader_law_test.ts`, and at runtime because the GPU
// testimony carries this value instead of borrowing the kernel's.
//
// It covers what the shader DECLARES, which is not the whole law: topology
// arrives at runtime in a uniform, and the mitosis constants are CPU-only
// because the shader has no mitosis. Claiming otherwise would be the same
// mistake in a new place — so the set is named explicitly below rather than
// implied.

import {
  CHRONOTOPOLOGY_STRESS_DIVISOR,
  HEBBIAN_DEFAULT_WEIGHT,
  HEBBIAN_MAX_WEIGHT,
  KURAMOTO_COUPLING_BASE,
  LANDAUER_BIT_COST,
  LATITUDE_AMPLITUDE_Q10,
  MAX_ATP,
  MAX_TIME_DILATION,
  PREDATOR_ENERGY_STEAL,
  RESONANCE_PHASE_MODULUS,
  SENESCENCE_TICKS,
  SOLAR_YIELD_Q10,
  STRUCTURAL_MAINTENANCE_DIVISOR,
} from "./generated_constants.ts";

/**
 * The constants both substrates declare, in the order they are hashed.
 *
 * Order is part of the artifact: changing it changes every hash, so it is fixed
 * here once and read from here by both sides. Adding a constant to the shader
 * without adding it here leaves it unguarded — which is exactly how the
 * original ten came to be unguarded — so the lock also asserts that the
 * shader declares nothing outside this set.
 */
export const SHARED_PHYSICS_CONSTANTS = [
  "KURAMOTO_COUPLING_BASE",
  "LANDAUER_BIT_COST",
  "STRUCTURAL_MAINTENANCE_DIVISOR",
  "RESONANCE_PHASE_MODULUS",
  "CHRONOTOPOLOGY_STRESS_DIVISOR",
  "MAX_TIME_DILATION",
  "MAX_ATP",
  "HEBBIAN_DEFAULT_WEIGHT",
  "HEBBIAN_MAX_WEIGHT",
  "PREDATOR_ENERGY_STEAL",
  "SOLAR_YIELD_Q10",
  // Era 969: the senescence clock. It sets how fast upkeep outruns income, so a
  // shader compiled with a different value runs a world with a different
  // lifespan — the difference between an ecology and a photograph.
  "SENESCENCE_TICKS",
  // Era 972: how much sun the poles lose. A shader compiled with a different
  // value lights a different world.
  "LATITUDE_AMPLITUDE_Q10",
] as const;

/** What the kernel says those constants are. */
export const KERNEL_SHARED_VALUES: Record<string, number> = {
  KURAMOTO_COUPLING_BASE,
  LANDAUER_BIT_COST,
  LATITUDE_AMPLITUDE_Q10,
  STRUCTURAL_MAINTENANCE_DIVISOR,
  RESONANCE_PHASE_MODULUS,
  CHRONOTOPOLOGY_STRESS_DIVISOR,
  MAX_TIME_DILATION,
  MAX_ATP,
  HEBBIAN_DEFAULT_WEIGHT,
  HEBBIAN_MAX_WEIGHT,
  PREDATOR_ENERGY_STEAL,
  SOLAR_YIELD_Q10,
  SENESCENCE_TICKS,
};

/**
 * Parse `const NAME: type = value;` declarations out of WGSL source.
 *
 * Deliberately strict about the shape rather than clever: a declaration this
 * cannot read is reported as absent, and the lock fails loudly, which is the
 * right direction to fail in. Comments are stripped first so a constant
 * mentioned in prose is never mistaken for one that is declared.
 */
export function parseWgslConstants(src: string): Map<string, number> {
  const stripped = src.replace(/\/\/[^\n]*/g, "").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const out = new Map<string, number>();
  const re =
    /const\s+([A-Z][A-Z0-9_]*)\s*:\s*[iuf]32\s*=\s*(-?[0-9]+)[uif]?\s*;/g;
  for (const m of stripped.matchAll(re)) {
    out.set(m[1], Number(m[2]));
  }
  return out;
}

/** Little-endian u32 words, in `SHARED_PHYSICS_CONSTANTS` order. */
function words(
  values: Map<string, number> | Record<string, number>,
): Uint8Array {
  const get = (k: string) => values instanceof Map ? values.get(k) : values[k];
  const buf = new Uint8Array(SHARED_PHYSICS_CONSTANTS.length * 4);
  const dv = new DataView(buf.buffer);
  SHARED_PHYSICS_CONSTANTS.forEach((name, i) => {
    const v = get(name);
    if (v === undefined) {
      throw new Error(
        `shader law: ${name} is not declared — a constant in the shared set ` +
          `must exist on both substrates or the comparison is meaningless`,
      );
    }
    dv.setUint32(i * 4, v >>> 0, true);
  });
  return buf;
}

/** SHA-256 of the words, first 4 bytes big-endian — matching Rust `sha256_u32`. */
async function fold(buf: Uint8Array): Promise<number> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", buf as unknown as ArrayBuffer),
  );
  return new DataView(digest.buffer).getUint32(0, false);
}

/** The law hash of the constants the SHADER declares. */
export async function shaderLawHash(wgslSrc: string): Promise<number> {
  return await fold(words(parseWgslConstants(wgslSrc)));
}

/** The law hash of the same constants as the KERNEL declares them. */
export async function kernelSharedLawHash(): Promise<number> {
  return await fold(words(KERNEL_SHARED_VALUES));
}
