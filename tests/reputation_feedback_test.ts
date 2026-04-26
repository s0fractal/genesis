// Era 1230: Reputation feedback from convergence tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    SUSPICION_DEFAULTS,
    applySuspicionPenalties,
    computeSoftPenalty,
    reRankWithSuspicion,
} from "../src/network/reputation_feedback.ts";
import {
    InvestigationConvergenceTracker,
} from "../src/network/investigation_convergence.ts";
import { ReputationScore } from "../src/network/reputation_routing.ts";
import { InvestigationRecord } from "../src/network/auto_investigation.ts";

const NOW = 100_000;

function repScore(id: string, score: number): ReputationScore {
    return {
        spore_id: id,
        score,
        health: "healthy",
        eligible: true,
        breakdown: {},
    };
}

function invRec(
    proposal_hash: number,
    target: number,
    diff = 10_000,
): InvestigationRecord {
    return {
        proposal_hash: proposal_hash >>> 0,
        target_relay_id: target >>> 0,
        reason: "test",
        raised_at_ms: NOW,
        triggering_diff_q16: diff,
        status: "open",
    };
}

Deno.test("feedback: lone alarm produces NO penalty (below trigger floor)", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(invRec(0xAA, 0x100), 0xCC01, NOW);
    const rec = t.get(0xAA);
    assertEquals(computeSoftPenalty(rec), 0);
});

Deno.test("feedback: double corroboration triggers penalty", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(invRec(0xAA, 0x100, 0), 0xCC01, NOW);
    t.recordRaise(invRec(0xAA, 0x100, 0), 0xCC02, NOW);
    const rec = t.get(0xAA);
    // 2 corroborators, trigger_floor=2 → 1 over → 25 penalty.
    // diff=0 → no diff penalty.
    assertEquals(computeSoftPenalty(rec), 25);
});

Deno.test("feedback: triple corroboration penalty grows", () => {
    const t = new InvestigationConvergenceTracker();
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        t.recordRaise(invRec(0xAA, 0x100, 0), src, NOW);
    }
    const rec = t.get(0xAA);
    // 3 - 2 + 1 = 2 over → 50 penalty.
    assertEquals(computeSoftPenalty(rec), 50);
});

Deno.test("feedback: max_penalty caps total", () => {
    const t = new InvestigationConvergenceTracker();
    for (let i = 0; i < 20; i++) {
        t.recordRaise(invRec(0xAA, 0x100, 65_536), (0xCC00 + i) >>> 0, NOW);
    }
    const rec = t.get(0xAA);
    // Even with 20 corroborators × 25 = 500, cap is 100.
    assertEquals(computeSoftPenalty(rec), SUSPICION_DEFAULTS.max_penalty);
});

Deno.test("feedback: diff_penalty contributes to score", () => {
    const t = new InvestigationConvergenceTracker();
    // 2 corroborators (above floor) AND large diff.
    t.recordRaise(invRec(0xAA, 0x100, 5120), 0xCC01, NOW);
    t.recordRaise(invRec(0xAA, 0x100, 10240), 0xCC02, NOW);
    const rec = t.get(0xAA);
    // corroboration penalty: 25
    // diff penalty: max_diff=10240 → 10240/1024 = 10 × 5 = 50, capped at 25.
    // total: 25 + 25 = 50.
    assertEquals(computeSoftPenalty(rec), 50);
});

Deno.test("feedback: diff_penalty respects its own cap", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(invRec(0xAA, 0x100, 65_536), 0xCC01, NOW);
    t.recordRaise(invRec(0xAA, 0x100, 65_536), 0xCC02, NOW);
    const rec = t.get(0xAA);
    // 2 corrob → +25, diff penalty capped at 25 → total 50.
    assertEquals(computeSoftPenalty(rec), 50);
});

Deno.test("feedback: undefined record → 0", () => {
    assertEquals(computeSoftPenalty(undefined), 0);
});

Deno.test("feedback: applySuspicionPenalties reduces affected scores", () => {
    const t = new InvestigationConvergenceTracker();
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        t.recordRaise(invRec(0xAA, 0x100, 0), src, NOW);
    }
    const scores = [repScore("relay-A", 200), repScore("relay-B", 150)];
    const resolver = (id: string) => id === "relay-A" ? 0x100 : undefined;
    const result = applySuspicionPenalties(scores, t, resolver);
    // relay-A: 200 - 50 = 150
    assertEquals(result[0].score, 150);
    assertEquals(result[0].breakdown.suspicion_penalty, -50);
    // relay-B unaffected.
    assertEquals(result[1].score, 150);
    assertEquals(result[1].breakdown.suspicion_penalty, undefined);
});

Deno.test("feedback: applySuspicionPenalties never produces negative scores", () => {
    const t = new InvestigationConvergenceTracker();
    for (let i = 0; i < 20; i++) {
        t.recordRaise(invRec(0xAA, 0x100, 65_536), (0xCC00 + i) >>> 0, NOW);
    }
    const scores = [repScore("relay-A", 50)];
    const resolver = () => 0x100;
    const result = applySuspicionPenalties(scores, t, resolver);
    // 50 - capped 100 = -50 → clamped to 0.
    assertEquals(result[0].score, 0);
});

Deno.test("feedback: reRankWithSuspicion swaps order when suspect drops", () => {
    const t = new InvestigationConvergenceTracker();
    for (const src of [0xCC01, 0xCC02, 0xCC03, 0xCC04]) {
        t.recordRaise(invRec(0xAA, 0x100, 0), src, NOW);
    }
    const scores = [
        repScore("alpha", 200),  // suspect
        repScore("beta",  170),  // unaffected
    ];
    const resolver = (id: string) => id === "alpha" ? 0x100 : undefined;
    const ranked = reRankWithSuspicion(scores, t, resolver);
    // alpha: 200 - 75 = 125. beta: 170. Beta wins.
    assertEquals(ranked[0].spore_id, "beta");
    assertEquals(ranked[1].spore_id, "alpha");
});

Deno.test("feedback: deterministic across two trackers with same history", () => {
    const events = [
        { src: 0xCC01, target: 0x100, diff: 5_000 },
        { src: 0xCC02, target: 0x100, diff: 7_000 },
        { src: 0xCC03, target: 0x100, diff: 10_000 },
    ];
    const t1 = new InvestigationConvergenceTracker();
    const t2 = new InvestigationConvergenceTracker();
    for (const e of events) {
        t1.recordRaise(invRec(0xAA, e.target, e.diff), e.src, NOW);
        t2.recordRaise(invRec(0xAA, e.target, e.diff), e.src, NOW);
    }
    const scores = [repScore("alpha", 200)];
    const r1 = applySuspicionPenalties(scores, t1, () => 0x100);
    const r2 = applySuspicionPenalties(scores, t2, () => 0x100);
    assertEquals(r1[0].score, r2[0].score);
});

Deno.test("feedback: highest-corroboration record wins when multiple target same relay", () => {
    const t = new InvestigationConvergenceTracker();
    // Two distinct proposals targeting same relay.
    t.recordRaise(invRec(0xAA, 0x100, 0), 0xCC01, NOW); // 1 corroborator
    for (const src of [0xDD01, 0xDD02, 0xDD03]) {
        t.recordRaise(invRec(0xBB, 0x100, 0), src, NOW); // 3 corroborators
    }
    const scores = [repScore("alpha", 200)];
    const result = applySuspicionPenalties(scores, t, () => 0x100);
    // Should pick the 3-corroborator record → 3-2+1=2 × 25 = 50 penalty.
    assertEquals(result[0].score, 150);
});

Deno.test("feedback: target_resolver returning undefined skips penalty", () => {
    const t = new InvestigationConvergenceTracker();
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        t.recordRaise(invRec(0xAA, 0x100, 0), src, NOW);
    }
    const scores = [repScore("alpha", 200)];
    const result = applySuspicionPenalties(scores, t, () => undefined);
    assertEquals(result[0].score, 200); // no penalty applied
});

Deno.test("feedback: empty tracker leaves scores untouched", () => {
    const t = new InvestigationConvergenceTracker();
    const scores = [repScore("alpha", 200), repScore("beta", 150)];
    const result = applySuspicionPenalties(scores, t, () => 0x100);
    assertEquals(result[0].score, 200);
    assertEquals(result[1].score, 150);
});

Deno.test("feedback: original scores array is not mutated", () => {
    const t = new InvestigationConvergenceTracker();
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        t.recordRaise(invRec(0xAA, 0x100, 0), src, NOW);
    }
    const scores = [repScore("alpha", 200)];
    const original_score = scores[0].score;
    applySuspicionPenalties(scores, t, () => 0x100);
    assertEquals(scores[0].score, original_score);
});
