// Era 1040: cross-language anchor — JS deriveMitosisChild must produce the
// same child as the Rust source-of-truth in omega_v2::mitosis_proof.
import { assertEquals } from "jsr:@std/assert";
import {
    deriveMitosisChild,
    childReceiptHash,
    BIRTH_NEAR_ATTRACTOR_FLAG,
    CHILD_ENERGY_SEED,
    AgentMinimal,
    AttractorEntry,
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

Deno.test("mitosis proof: deterministic without attractors", () => {
    const p = parent();
    const c1 = deriveMitosisChild(p, [], 7);
    const c2 = deriveMitosisChild(p, [], 7);
    assertEquals(c1, c2);
});

Deno.test("mitosis proof: child phase = parent + half", () => {
    const p = parent();
    const c = deriveMitosisChild(p, [], 7);
    assertEquals(c.phase, (p.phase + 64) >>> 0);
});

Deno.test("mitosis proof: child energy = CHILD_ENERGY_SEED", () => {
    const p = parent();
    const c = deriveMitosisChild(p, [], 7);
    assertEquals(c.energy, CHILD_ENERGY_SEED);
});

Deno.test("mitosis proof: dominant attractor sets birth flag", () => {
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

Deno.test("mitosis proof: dormant attractor (pulse_amp=0) is ignored", () => {
    const p = parent();
    const matrix = (0xABCD_0000 | p.phase) >>> 0;
    const attractors: AttractorEntry[] = [
        { matrix, inverse: (~matrix) >>> 0, pulse_freq: 256, pulse_amp: 0 },
    ];
    const c = deriveMitosisChild(p, attractors, 7);
    assertEquals((c.state_flags & BIRTH_NEAR_ATTRACTOR_FLAG) === 0, true);
});

Deno.test("mitosis proof: receipt hash determinism", () => {
    const p = parent();
    const c = deriveMitosisChild(p, [], 7);
    const h1 = childReceiptHash(c);
    const h2 = childReceiptHash(c);
    assertEquals(h1, h2);
});

Deno.test("mitosis proof: receipt hash sensitivity", () => {
    const p = parent();
    const c = deriveMitosisChild(p, [], 7);
    const h1 = childReceiptHash(c);
    const c2 = { ...c, genome: (c.genome ^ 1) >>> 0 };
    const h2 = childReceiptHash(c2);
    assertEquals(h1 !== h2, true);
});

// Cross-language anchors: these MUST match Rust constants in
// omega_v2/tests/mitosis_anchor.rs. Drift fails CI on both sides.
Deno.test("mitosis proof: cross-language anchor (no attractors)", () => {
    const p = parent();
    const c = deriveMitosisChild(p, [], 7);
    assertEquals(c.phase, 128);
    assertEquals(c.energy, 1000);
    assertEquals(c.base_freq, 7);
    assertEquals(c.state_flags, 180); // Era 0219 Epigenetic
    assertEquals(c.genome, 3549459802);
    assertEquals(c.memory, [0xDEAD_BEEF >>> 0, 1, 2]);
    assertEquals(childReceiptHash(c), 1040843550);
});

Deno.test("mitosis proof: cross-language anchor (dominant attractor)", () => {
    const p = parent();
    const matrix = (0xABCD_0000 | p.phase) >>> 0;
    const attractors: AttractorEntry[] = [
        { matrix, inverse: (~matrix) >>> 0, pulse_freq: 256, pulse_amp: 512 },
    ];
    const c = deriveMitosisChild(p, attractors, 7);
    assertEquals(c.state_flags, 16777468);
    assertEquals(c.genome, (p.genome ^ matrix) >>> 0);
    assertEquals(c.memory[0], matrix);
    assertEquals(childReceiptHash(c), 3088952691);
});
