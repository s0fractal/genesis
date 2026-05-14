// Reputation-Weighted Routing tests.
import { assertEquals, assert } from "jsr:@std/assert";
import { LivenessAggregator } from "../src/network/liveness_aggregator.ts";
import {
    pickBest,
    pickTopK,
    rankNeighbors,
    scoreOne,
} from "../src/network/reputation_routing.ts";
import { GENESIS_HASH_LEGACY_V1_0 } from "../src/network/genesis_inscription.ts";
import {
    buildHeartbeat,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";

function freshAgg(): LivenessAggregator {
    return new LivenessAggregator({ classifyAfter: 1, maxSilenceMs: 30_000 });
}

const NOW = 100_000;

Deno.test("rep: healthy beats unknown", async () => {
    const agg = freshAgg();
    // Healthy: 3 heartbeats with rising tick.
    agg.ingest("alpha", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 200);
    agg.ingest("alpha", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW - 100);
    agg.ingest("alpha", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 3), NOW);
    // Unknown: only 1 sample.
    const unknownAgg = freshAgg();
    unknownAgg.ingest("beta", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW);
    // (Use same agg for ranking)
    agg.ingest("beta", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW);
    // Override beta's classifyAfter trick: drop into unknown by not
    // sending second heartbeat.
    const ranked = rankNeighbors(agg, NOW);
    assertEquals(ranked[0].spore_id, "alpha");
    assert(ranked[0].score > ranked[1].score);
});

Deno.test("rep: forked spore is excluded entirely", async () => {
    const agg = freshAgg();
    agg.ingest("rogue", buildHeartbeat(0xDEADBEEF >>> 0, 1), NOW);
    const top = pickTopK(agg, NOW, 5);
    assertEquals(top.length, 0);
});

Deno.test("rep: forked + healthy → only healthy is pickable", async () => {
    const agg = freshAgg();
    agg.ingest("good", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 100);
    agg.ingest("good", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW);
    agg.ingest("rogue", buildHeartbeat(0xDEADBEEF >>> 0, 1), NOW);
    const best = pickBest(agg, NOW);
    assert(best !== null);
    assertEquals(best!.spore_id, "good");
});

Deno.test("rep: heartbeat density adds up to cap", async () => {
    const agg = freshAgg();
    // Send 60 heartbeats — but the cap is 50, so only 50 contribute.
    for (let t = 1; t <= 60; t++) {
        agg.ingest("dense", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, t), NOW - (60 - t) * 10);
    }
    const ranked = rankNeighbors(agg, NOW);
    const r = ranked[0];
    // Cap = 50, perCount = 2 → contribution = 100.
    assertEquals(r.breakdown.heartbeat_density, 100);
});

Deno.test("rep: warrant throughput contributes to score", async () => {
    const agg = freshAgg();
    agg.ingest("voter", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 100);
    agg.ingest("voter", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW - 50);
    for (let i = 0; i < 5; i++) {
        agg.ingest("voter", buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 100 + i), NOW - 25 + i);
    }
    const r = scoreOne(agg.snapshot()[0], NOW);
    // 5 votes × 5 = 25.
    assertEquals(r.breakdown.warrant_throughput, 25);
});

Deno.test("rep: stalled gets stall penalty", async () => {
    const agg = freshAgg();
    agg.ingest("stuck", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 5), NOW - 200);
    agg.ingest("stuck", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 5), NOW - 100);
    agg.ingest("stuck", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 5), NOW);
    const ranked = rankNeighbors(agg, NOW);
    const r = ranked[0];
    assertEquals(r.health, "stalled");
    assertEquals(r.breakdown.stall_penalty, -30);
});

Deno.test("rep: lost spore loses score over silence duration", async () => {
    const agg = freshAgg();
    agg.ingest("ghost", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 70_000);
    agg.ingest("ghost", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW - 60_000);
    const ranked = rankNeighbors(agg, NOW);
    const r = ranked[0];
    assertEquals(r.health, "lost");
    // Silence = 60s, cap is 60s, 1 point per sec → -60.
    assertEquals(r.breakdown.silence_penalty, -60);
});

Deno.test("rep: stable tie-break by spore_id ascending", async () => {
    const agg = freshAgg();
    // Two healthy spores with identical metrics.
    for (const id of ["zeta", "alpha"]) {
        agg.ingest(id, buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 100);
        agg.ingest(id, buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW);
    }
    const ranked = rankNeighbors(agg, NOW);
    assertEquals(ranked[0].spore_id, "alpha"); // lex order tie-break
    assertEquals(ranked[1].spore_id, "zeta");
});

Deno.test("rep: pickTopK respects k", async () => {
    const agg = freshAgg();
    for (const id of ["a", "b", "c", "d", "e"]) {
        agg.ingest(id, buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 100);
        agg.ingest(id, buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW);
    }
    assertEquals(pickTopK(agg, NOW, 3).length, 3);
    assertEquals(pickTopK(agg, NOW, 10).length, 5);
});

Deno.test("rep: deterministic across two relays observing the same history", async () => {
    // Same ingest sequence on two independent aggregators must produce
    // identical rankings.
    const events: Array<[string, ReturnType<typeof buildHeartbeat>, number]> = [
        ["a", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 200],
        ["b", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 200],
        ["a", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 2), NOW - 100],
        ["a", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 3), NOW],
        ["b", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW - 100],
        ["b", buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), NOW],
    ];
    const a1 = freshAgg();
    const a2 = freshAgg();
    for (const [id, frame, t] of events) {
        a1.ingest(id, frame, t);
        a2.ingest(id, frame, t);
    }
    const r1 = rankNeighbors(a1, NOW);
    const r2 = rankNeighbors(a2, NOW);
    assertEquals(r1.length, r2.length);
    for (let i = 0; i < r1.length; i++) {
        assertEquals(r1[i].spore_id, r2[i].spore_id);
        assertEquals(r1[i].score, r2[i].score);
    }
});

Deno.test("rep: pickBest returns null when no eligible neighbors", async () => {
    const agg = freshAgg();
    agg.ingest("rogue", buildHeartbeat(0xDEAD_BEEF >>> 0, 1), NOW);
    assertEquals(pickBest(agg, NOW), null);
});
