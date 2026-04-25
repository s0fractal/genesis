// Era 1070: Cross-model debate ledger tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    CrossModelDebate,
    fnv1a32,
    isCanonicalOracle,
} from "../src/network/cross_model_debate.ts";

Deno.test("debate: record and retrieve arguments by proposal", () => {
    const d = new CrossModelDebate();
    d.record("claude", 0xCAFE, "aye", "I align with this vision", 100);
    d.record("gpt",    0xCAFE, "nay", "I see better alternatives", 101);
    d.record("claude", 0xBEEF, "aye", "different proposal", 102);
    const a = d.forProposal(0xCAFE);
    assertEquals(a.length, 2);
    assertEquals(a[0].oracle, "claude");
    assertEquals(a[1].oracle, "gpt");
});

Deno.test("debate: reasoning hash is deterministic", () => {
    const d = new CrossModelDebate();
    const arg = d.record("claude", 1, "aye", "exact reasoning", 0);
    assertEquals(arg.reasoningHash, fnv1a32(new TextEncoder().encode("exact reasoning")));
});

Deno.test("debate: verifyReasoning rejects tampered text", () => {
    const d = new CrossModelDebate();
    const arg = d.record("claude", 1, "aye", "original argument", 0);
    assertEquals(d.verifyReasoning(arg, "original argument"), true);
    assertEquals(d.verifyReasoning(arg, "tampered argument"), false);
});

Deno.test("debate: alignment score ranges from -N to +N", () => {
    const d = new CrossModelDebate();
    d.record("claude", 0xAAAA, "aye", "yes", 0);
    d.record("gpt",    0xAAAA, "aye", "yes", 1);
    d.record("gemini", 0xAAAA, "nay", "no",  2);
    assertEquals(d.alignmentScore(0xAAAA), 1); // 2 ayes − 1 nay
});

Deno.test("debate: distinct AYE count counts each oracle once", () => {
    const d = new CrossModelDebate();
    // Same oracle voting AYE multiple times only counts once.
    d.record("claude", 0xBBBB, "aye", "1", 0);
    d.record("claude", 0xBBBB, "aye", "2", 1);
    d.record("gpt",    0xBBBB, "aye", "3", 2);
    assertEquals(d.distinctAyeCount(0xBBBB), 2);
});

Deno.test("debate: stance toggling — last AYE/NAY wins per oracle", () => {
    const d = new CrossModelDebate();
    d.record("claude", 0xCCCC, "aye", "first thought", 0);
    d.record("claude", 0xCCCC, "nay", "changed mind", 1);
    // alignmentScore should reflect the latest stance.
    assertEquals(d.alignmentScore(0xCCCC), -1);
});

Deno.test("debate: long reasoning text is truncated to 256 chars", () => {
    const d = new CrossModelDebate();
    const long = "x".repeat(500);
    const arg = d.record("claude", 1, "aye", long, 0);
    assertEquals(arg.reasoning.length, 256);
});

Deno.test("debate: isCanonicalOracle gate", () => {
    assertEquals(isCanonicalOracle("claude"), true);
    assertEquals(isCanonicalOracle("gpt"), true);
    assertEquals(isCanonicalOracle("not-a-real-oracle"), false);
});

Deno.test("debate: forOracle filters correctly", () => {
    const d = new CrossModelDebate();
    d.record("claude", 1, "aye", "a", 0);
    d.record("gpt",    1, "nay", "b", 1);
    d.record("claude", 2, "aye", "c", 2);
    assertEquals(d.forOracle("claude").length, 2);
    assertEquals(d.forOracle("gpt").length, 1);
});
