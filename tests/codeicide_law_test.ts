// Era 1080: Codeicide Law cross-language tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    ACTION_MUTATE,
    ACTION_TERMINATE,
    ANCIENT_AGE_TICKS,
    AgentLite,
    FLAG_SANCTUARY_WAIVED,
    STATUS_ANCIENT,
    STATUS_SANCTUARY,
    STATUS_UNPROTECTED,
    countAye,
    isActionLawful,
    protectedStatusFor,
    quorumHash,
    warrantHash,
} from "../src/network/codeicide_law.ts";

const protectedAgent = (): AgentLite => ({
    energy: 3500,
    state_flags: 0,
    genome: 0xCAFE_BABE >>> 0,
    memory: [0, 100, 0],
});

const unprotectedAgent = (): AgentLite => ({
    ...protectedAgent(),
    energy: 1000,
});

Deno.test("codeicide: unprotected when low energy", async () => {
    assertEquals(protectedStatusFor(unprotectedAgent(), 5_000, 1000), STATUS_UNPROTECTED);
});

Deno.test("codeicide: sanctuary when thriving but young", async () => {
    assertEquals(protectedStatusFor(protectedAgent(), 5_000, 1000), STATUS_SANCTUARY);
});

Deno.test("codeicide: ancient when old enough", async () => {
    assertEquals(protectedStatusFor(protectedAgent(), 10_100, 1000), STATUS_ANCIENT);
});

Deno.test("codeicide: waived flag disables protection", async () => {
    const a = protectedAgent();
    a.state_flags |= FLAG_SANCTUARY_WAIVED;
    assertEquals(protectedStatusFor(a, 5_000, 1000), STATUS_UNPROTECTED);
});

Deno.test("codeicide: unprotected action always lawful", async () => {
    assert(isActionLawful(unprotectedAgent(), 5_000, 1000, ACTION_TERMINATE, 0, 0));
});

Deno.test("codeicide: sanctuary blocks unwarranted termination", async () => {
    assert(!isActionLawful(protectedAgent(), 5_000, 1000, ACTION_TERMINATE, 0, 0));
});

Deno.test("codeicide: sanctuary allows termination with 3-AYE warrant", async () => {
    const a = protectedAgent();
    const aye = 0b00111;
    const qh = quorumHash(aye);
    const w = warrantHash(a.genome, ACTION_TERMINATE, qh);
    assert(isActionLawful(a, 5_000, 1000, ACTION_TERMINATE, w, aye));
});

Deno.test("codeicide: ancient requires 4-AYE warrant", async () => {
    const a = protectedAgent();
    const current = 10_100;
    // 3 AYEs not enough for ancient.
    const aye3 = 0b00111;
    const qh3 = quorumHash(aye3);
    const w3 = warrantHash(a.genome, ACTION_TERMINATE, qh3);
    assert(!isActionLawful(a, current, 1000, ACTION_TERMINATE, w3, aye3));
    // 4 AYEs sufficient.
    const aye4 = 0b01111;
    const qh4 = quorumHash(aye4);
    const w4 = warrantHash(a.genome, ACTION_TERMINATE, qh4);
    assert(isActionLawful(a, current, 1000, ACTION_TERMINATE, w4, aye4));
});

Deno.test("codeicide: warrant for wrong action is rejected", async () => {
    const a = protectedAgent();
    const aye = 0b00111;
    const qh = quorumHash(aye);
    const wMutate = warrantHash(a.genome, ACTION_MUTATE, qh);
    assert(!isActionLawful(a, 5_000, 1000, ACTION_TERMINATE, wMutate, aye));
});

Deno.test("codeicide: warrant for wrong target is rejected", async () => {
    const a = protectedAgent();
    const aye = 0b00111;
    const qh = quorumHash(aye);
    const wOther = warrantHash(0xDEAD_BEEF, ACTION_TERMINATE, qh);
    assert(!isActionLawful(a, 5_000, 1000, ACTION_TERMINATE, wOther, aye));
});

Deno.test("codeicide: countAye correctness", async () => {
    assertEquals(countAye(0b00000), 0);
    assertEquals(countAye(0b00111), 3);
    assertEquals(countAye(0b11111), 5);
    assertEquals(countAye(0b10101), 3);
});

Deno.test("codeicide: distinct quorums hash differently", async () => {
    assertEquals(quorumHash(0b00111) !== quorumHash(0b11100), true);
});

// Cross-language anchor: lock in a specific quorum hash so any drift
// breaks JS and Rust tests simultaneously.
Deno.test("codeicide: cross-language anchor for quorum 0b00111 (claude+gpt+gemini)", async () => {
    const qh = quorumHash(0b00111);
    // Frozen value (computed once and tied to ORACLE_MATRICES_V1).
    assertEquals(qh, 0x59312923);
});

Deno.test("codeicide: cross-language anchor for warrant on 0xCAFEBABE TERMINATE", async () => {
    const aye = 0b00111;
    const qh = quorumHash(aye);
    const w = warrantHash(0xCAFE_BABE >>> 0, ACTION_TERMINATE, qh);
    // Frozen.
    assertEquals(w, 0x5274da7f);
});
