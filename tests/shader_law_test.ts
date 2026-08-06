// Drift lock: the shader's physical constants against the kernel's.
//
// `tools/build_ssot.ts` emits `constants.rs` and `generated_constants.ts` and
// stopped emitting WGSL — "shaders receive LUTs via WASM storage buffers",
// which is true of the LUTs and not of the scalars. Eleven physical constants
// are hand-copied into `compute_toroidal.wgsl`, and until now nothing compared
// them to anything. They were correct by coincidence.
//
// The golden-trace parity test would eventually catch a value divergence, but
// only on a machine with WebGPU: it self-disables headless and under
// ANTIGRAVITY_AGENT, and CI is headless. So on CI the shader constants had no
// guard at all. This one runs anywhere — it reads two files.

import { assert, assertEquals } from "jsr:@std/assert";
import {
  KERNEL_SHARED_VALUES,
  kernelSharedLawHash,
  parseWgslConstants,
  shaderLawHash,
  SHARED_PHYSICS_CONSTANTS,
} from "../src/shared/shader_law.ts";

const SHADER = await Deno.readTextFile(
  new URL("../src/lens/shaders/compute_toroidal.wgsl", import.meta.url),
);

Deno.test("the shader and the kernel declare the same physics", async () => {
  const shader = await shaderLawHash(SHADER);
  const kernel = await kernelSharedLawHash();
  if (shader !== kernel) {
    // Name the offenders rather than printing two hashes and leaving the
    // reader to diff eleven values by hand.
    const declared = parseWgslConstants(SHADER);
    const diffs = SHARED_PHYSICS_CONSTANTS
      .filter((n) => declared.get(n) !== KERNEL_SHARED_VALUES[n])
      .map((n) =>
        `${n}: shader ${declared.get(n)} vs kernel ${KERNEL_SHARED_VALUES[n]}`
      );
    throw new Error(
      `shader law 0x${(shader >>> 0).toString(16)} != kernel law ` +
        `0x${(kernel >>> 0).toString(16)}\n  ${diffs.join("\n  ")}\n` +
        `Regenerate with tools/build_ssot.ts, then copy the values into the ` +
        `shader's const block by hand — WGSL is not a generated target.`,
    );
  }
  assertEquals(shader, kernel);
});

Deno.test("every constant the shader declares is under the lock", () => {
  // The original ten went unguarded because nothing enumerated them. A twelfth
  // added to the shader and not to SHARED_PHYSICS_CONSTANTS would repeat that
  // exactly, so the set has to be closed from both ends.
  const declared = [...parseWgslConstants(SHADER).keys()];
  const guarded = new Set<string>(SHARED_PHYSICS_CONSTANTS);
  // Q10_SCALE is a second local name for the same 1024 the kernel calls
  // MATH_Q_SCALE; it is a shader-local alias, not an independent law term.
  const exempt = new Set(["Q10_SCALE"]);
  const unguarded = declared.filter((n) => !guarded.has(n) && !exempt.has(n));
  assertEquals(
    unguarded,
    [],
    `the shader declares constants no lock compares: ${unguarded.join(", ")}`,
  );
});

Deno.test("the lock is actually looking at something", async () => {
  const declared = parseWgslConstants(SHADER);
  assert(
    declared.size >= SHARED_PHYSICS_CONSTANTS.length,
    `parsed only ${declared.size} constants from the shader — the regex has ` +
      `stopped matching and every assertion above is vacuous`,
  );
  // And the hash must actually depend on the values, not just their names.
  const perturbed = SHADER.replace(
    /const MAX_ATP: u32 = \d+u;/,
    "const MAX_ATP: u32 = 4095u;",
  );
  assert(perturbed !== SHADER, "failed to perturb the fixture");
  const before = await shaderLawHash(SHADER);
  const after = await shaderLawHash(perturbed);
  assert(before !== after, "one changed constant left the shader law unmoved");
});
