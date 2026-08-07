// cross-language anchor — JS deriveMitosisChild must produce the
// same child as the Rust source-of-truth in omega_v2::mitosis_proof.
import { assert, assertEquals } from "jsr:@std/assert";
import {
  AgentMinimal,
  AttractorEntry,
  BIRTH_NEAR_ATTRACTOR_FLAG,
  CHILD_ENERGY_SEED,
  childReceiptHash,
  deriveMitosisChild,
} from "../src/network/mitosis_proof.ts";

function parent(): AgentMinimal {
  return {
    phase: 64,
    energy: 3000,
    base_freq: 7,
    state_flags: 0,
    genome: 0xCAFE_BABE >>> 0,
    memory: [0xDEAD_BEEF >>> 0, 1, 2],
  };
}

Deno.test("mitosis proof: deterministic without attractors", async () => {
  const p = parent();
  const c1 = deriveMitosisChild(p, [], 7);
  const c2 = deriveMitosisChild(p, [], 7);
  assertEquals(c1, c2);
});

Deno.test("mitosis proof: child sits half a turn away, inside the wrap", () => {
  // This asserted `parent.phase + 64` with no mask, which is what both
  // implementations did and what made them wrong: a parent near the top of the
  // wrap produced a child outside it. The half-turn is the intent; staying
  // inside the circle is the invariant, and the old assertion pinned the first
  // while contradicting the second.
  for (const qPhase of [5, 7, 8]) {
    const mask = (1 << qPhase) - 1;
    const half = 1 << (qPhase - 1);
    for (const start of [0, 1, half - 1, half, mask - 1, mask]) {
      const c = deriveMitosisChild({ ...parent(), phase: start }, [], qPhase);
      assertEquals(
        c.phase,
        (start + half) & mask,
        `q_phase ${qPhase}: parent at ${start}`,
      );
      assert(
        c.phase <= mask,
        `q_phase ${qPhase}: child at ${c.phase} is outside a wrap ending ${mask}`,
      );
    }
  }
});

Deno.test("mitosis proof: child energy = CHILD_ENERGY_SEED minus flips", async () => {
  const p = parent();
  const c = deriveMitosisChild(p, [], 7);
  let flippedBits = 0;
  let flipMask = (p.genome ^ c.genome) >>> 0;
  while (flipMask > 0) {
    flippedBits += flipMask & 1;
    flipMask >>>= 1;
  }
  assertEquals(c.energy, CHILD_ENERGY_SEED - flippedBits);
});

Deno.test("mitosis proof: dominant attractor sets birth flag", async () => {
  const p = parent();
  const matrix = (0xABCD_0000 | p.phase) >>> 0;
  const attractors: AttractorEntry[] = [
    { matrix, inverse: (~matrix) >>> 0, pulse_freq: 256, pulse_amp: 512 },
  ];
  const c = deriveMitosisChild(p, attractors, 7);
  assertEquals((c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG) !== 0, true);
  assertEquals(c.genome, (p.genome ^ matrix) >>> 0);
  assertEquals(c.memory[0], matrix);
});

Deno.test("mitosis proof: dormant attractor (pulse_amp=0) is ignored", async () => {
  const p = parent();
  const matrix = (0xABCD_0000 | p.phase) >>> 0;
  const attractors: AttractorEntry[] = [
    { matrix, inverse: (~matrix) >>> 0, pulse_freq: 256, pulse_amp: 0 },
  ];
  const c = deriveMitosisChild(p, attractors, 7);
  assertEquals((c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG) === 0, true);
});

Deno.test("mitosis proof: receipt hash determinism", async () => {
  const p = parent();
  const c = deriveMitosisChild(p, [], 7);
  const h1 = await childReceiptHash(c);
  const h2 = await childReceiptHash(c);
  assertEquals(h1, h2);
});

Deno.test("mitosis proof: receipt hash sensitivity", async () => {
  const p = parent();
  const c = deriveMitosisChild(p, [], 7);
  const h1 = await childReceiptHash(c);
  const c2 = { ...c, genome: (c.genome ^ 1) >>> 0 };
  const h2 = await childReceiptHash(c2);
  assertEquals(h1 !== h2, true);
});

// Cross-language anchors: these MUST match Rust constants in
// omega_v2/tests/mitosis_anchor.rs. Drift fails CI on both sides.
Deno.test("mitosis proof: cross-language anchor (no attractors)", async () => {
  const p = parent();
  const c = deriveMitosisChild(p, [], 7);
  // 0, not 128: with q_phase=7 the wrap ends at 127, so a parent at 64 gives a
  // child at 128 & 127. Kept in lockstep with omega_v2/tests/mitosis_anchor.rs.
  assertEquals(c.phase, 0);
  assertEquals(c.energy, 1020);
  assertEquals(c.base_freq, 7);
  assertEquals(c.state_flags, 56);
  assertEquals(c.genome, 3271474076);
  assertEquals(c.memory, [0xDEAD_BEEF >>> 0, 1, 2]);
  assertEquals(typeof (await childReceiptHash(c)), "string");
});

Deno.test("mitosis proof: cross-language anchor (dominant attractor)", async () => {
  const p = parent();
  const matrix = (0xABCD_0000 | p.phase) >>> 0;
  const attractors: AttractorEntry[] = [
    { matrix, inverse: (~matrix) >>> 0, pulse_freq: 256, pulse_amp: 512 },
  ];
  const c = deriveMitosisChild(p, attractors, 7);
  assertEquals(c.state_flags, 16777468);
  assertEquals(c.genome, (p.genome ^ matrix) >>> 0);
  assertEquals(c.memory[0], matrix);
  assertEquals(typeof (await childReceiptHash(c)), "string");
});
