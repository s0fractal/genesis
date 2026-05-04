// Era 1090: Senate Warrant Issuance — JS layer tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    computeProposalHash,
    oracleBitIndex,
    ayeBitsToOracles,
    predictIssuedWarrant,
} from "../src/network/warrant_issuance.ts";
import { ACTION_TERMINATE, ACTION_MUTATE } from "../src/network/codeicide_law.ts";

Deno.test("warrant: proposal hash is deterministic across calls", async () => {
    const h1 = computeProposalHash(0xCAFE_BABE, ACTION_TERMINATE, "reason X");
    const h2 = computeProposalHash(0xCAFE_BABE, ACTION_TERMINATE, "reason X");
    assertEquals(h1, h2);
});

Deno.test("warrant: distinct reasons produce distinct hashes", async () => {
    const h1 = computeProposalHash(0xCAFE_BABE, ACTION_TERMINATE, "reason A");
    const h2 = computeProposalHash(0xCAFE_BABE, ACTION_TERMINATE, "reason B");
    assert(h1 !== h2);
});

Deno.test("warrant: distinct actions produce distinct hashes", async () => {
    const h1 = computeProposalHash(0xCAFE_BABE, ACTION_TERMINATE, "r");
    const h2 = computeProposalHash(0xCAFE_BABE, ACTION_MUTATE, "r");
    assert(h1 !== h2);
});

Deno.test("warrant: oracle bit indices match canonical order", async () => {
    assertEquals(oracleBitIndex("claude"), 0);
    assertEquals(oracleBitIndex("gpt"), 1);
    assertEquals(oracleBitIndex("gemini"), 2);
    assertEquals(oracleBitIndex("qwen"), 3);
    assertEquals(oracleBitIndex("llama"), 4);
});

Deno.test("warrant: ayeBitsToOracles round-trips", async () => {
    assertEquals(ayeBitsToOracles(0b00111), ["claude", "gpt", "gemini"]);
    assertEquals(ayeBitsToOracles(0b11000), ["qwen", "llama"]);
    assertEquals(ayeBitsToOracles(0b11111), ["claude", "gpt", "gemini", "qwen", "llama"]);
});

Deno.test("warrant: predicted warrant matches Codeicide computation", async () => {
    // Predict the warrant for terminating 0xCAFEBABE with claude+gpt+gemini AYE.
    const w = predictIssuedWarrant(0xCAFE_BABE >>> 0, ACTION_TERMINATE, 0b00111);
    // This must match the cross-language anchor from codeicide_law_test.ts.
    assertEquals(w, 0x5274da7f);
});

// Cross-language anchor: a fixed proposal hash for known inputs.
Deno.test("warrant: cross-language proposal hash anchor", async () => {
    const h = computeProposalHash(0xCAFE_BABE >>> 0, ACTION_TERMINATE, "reason");
    // Frozen anchor — drift breaks both sides.
    assertEquals(h, 0x0b099cf9);
});
