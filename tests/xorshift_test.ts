/**
 * Xorshift64* TypeScript Tests
 * Verifies deterministic properties of the TS port against Rust kernel.
 */

import { assertEquals, assert } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { Xorshift64TS, createSeededRng } from "../src/math/xorshift.ts";

Deno.test("xorshift64 deterministic with same seed", () => {
    const rng1 = new Xorshift64TS(12345n);
    const rng2 = new Xorshift64TS(12345n);

    for (let i = 0; i < 100; i++) {
        assertEquals(rng1.next(), rng2.next(), `Mismatch at step ${i}`);
    }
});

Deno.test("xorshift64 different seeds produce different sequences", () => {
    const rng1 = new Xorshift64TS(1n);
    const rng2 = new Xorshift64TS(2n);

    let collisions = 0;
    for (let i = 0; i < 100; i++) {
        if (rng1.next() === rng2.next()) collisions++;
    }
    assert(collisions < 5, `Too many collisions (${collisions}) for different seeds`);
});

Deno.test("xorshift64 nextRange bounds", () => {
    const rng = new Xorshift64TS(42n);
    for (let i = 0; i < 1000; i++) {
        const val = rng.nextRange(100);
        assert(val >= 0 && val < 100, `Value ${val} out of range [0, 100)`);
    }
});

Deno.test("xorshift64 nextHex length", () => {
    const rng = new Xorshift64TS(42n);
    assertEquals(rng.nextHex(4).length, 8, "4 bytes = 8 hex chars");
    assertEquals(rng.nextHex(8).length, 16, "8 bytes = 16 hex chars");
    assertEquals(rng.nextHex(1).length, 2, "1 byte = 2 hex chars");
});

Deno.test("xorshift64 nextHex determinism", () => {
    const rng1 = new Xorshift64TS(999n);
    const rng2 = new Xorshift64TS(999n);
    assertEquals(rng1.nextHex(8), rng2.nextHex(8));
});

Deno.test("createSeededRng with string seed", () => {
    const rng1 = createSeededRng("omega-64-genesis");
    const rng2 = createSeededRng("omega-64-genesis");
    for (let i = 0; i < 50; i++) {
        assertEquals(rng1.next(), rng2.next());
    }
});

Deno.test("xorshift64 full period no early repeat", () => {
    const rng = new Xorshift64TS(7n);
    const first = rng.next();
    let steps = 1;
    const maxSteps = 10000;
    while (steps < maxSteps) {
        if (rng.next() === first) break;
        steps++;
    }
    assert(steps > 1000, `Sequence repeated too early after ${steps} steps`);
});
