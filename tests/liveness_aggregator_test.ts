// Era 1120: LivenessAggregator behavioural tests.
import { assertEquals, assert } from "jsr:@std/assert";
import { LivenessAggregator } from "../src/network/liveness_aggregator.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import {
    buildHeartbeat,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";

Deno.test("aggregator: first heartbeat marks UNKNOWN until classifyAfter", async () => {
    const a = new LivenessAggregator();
    const f = buildHeartbeat(GENESIS_HASH_V1_0, 1);
    const rec = a.ingest("spore-A", f, 1000);
    assertEquals(rec.heartbeat_count, 1);
    assertEquals(rec.health, "unknown");
});

Deno.test("aggregator: two heartbeats with advancing tick → HEALTHY", async () => {
    const a = new LivenessAggregator();
    a.ingest("spore-A", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    const rec = a.ingest("spore-A", buildHeartbeat(GENESIS_HASH_V1_0, 2), 1500);
    assertEquals(rec.health, "healthy");
});

Deno.test("aggregator: wrong genesis hash → FORKED immediately", async () => {
    const a = new LivenessAggregator();
    const wrongGenesis = (GENESIS_HASH_V1_0 ^ 1) >>> 0;
    const rec = a.ingest("rogue", buildHeartbeat(wrongGenesis, 1), 1000);
    assertEquals(rec.health, "forked");
    assertEquals(a.forkedSpores(), ["rogue"]);
});

Deno.test("aggregator: stalled when tick stays the same across heartbeats", async () => {
    const a = new LivenessAggregator({ classifyAfter: 2 });
    a.ingest("slow", buildHeartbeat(GENESIS_HASH_V1_0, 5), 1000);
    a.ingest("slow", buildHeartbeat(GENESIS_HASH_V1_0, 5), 2000);
    const rec = a.ingest("slow", buildHeartbeat(GENESIS_HASH_V1_0, 5), 3000);
    assertEquals(rec.health, "stalled");
});

Deno.test("aggregator: lost when silent past maxSilenceMs", async () => {
    const a = new LivenessAggregator({ maxSilenceMs: 5_000, classifyAfter: 1 });
    a.ingest("ghost", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    a.ingest("ghost", buildHeartbeat(GENESIS_HASH_V1_0, 2), 2000);
    a.sweep(10_000); // 8 seconds of silence
    const snap = a.snapshot();
    assertEquals(snap[0].health, "lost");
});

Deno.test("aggregator: warrant_vote counter increments", async () => {
    const a = new LivenessAggregator();
    a.ingest("voter", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    a.ingest("voter", buildWarrantVote(0xCAFE_BABE, 0, true, 2), 1100);
    a.ingest("voter", buildWarrantVote(0xCAFE_BABE, 0, false, 3), 1200);
    const snap = a.snapshot();
    assertEquals(snap[0].warrant_votes_observed, 2);
    assertEquals(snap[0].last_vote_oracle_bit, 0);
});

Deno.test("aggregator: countByHealth aggregates correctly", async () => {
    const a = new LivenessAggregator({ classifyAfter: 1 });
    // Two healthy.
    a.ingest("h1", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    a.ingest("h1", buildHeartbeat(GENESIS_HASH_V1_0, 2), 1100);
    a.ingest("h2", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    a.ingest("h2", buildHeartbeat(GENESIS_HASH_V1_0, 2), 1100);
    // One forked.
    a.ingest("fk", buildHeartbeat(0xDEAD_BEEF >>> 0, 1), 1000);
    const counts = a.countByHealth();
    assertEquals(counts.healthy, 2);
    assertEquals(counts.forked, 1);
});

Deno.test("aggregator: forget removes a spore", async () => {
    const a = new LivenessAggregator();
    a.ingest("ephemeral", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    assertEquals(a.snapshot().length, 1);
    assert(a.forget("ephemeral"));
    assertEquals(a.snapshot().length, 0);
});

Deno.test("aggregator: forked overrides lost (drift > silence)", async () => {
    const a = new LivenessAggregator({ maxSilenceMs: 1_000, classifyAfter: 1 });
    a.ingest("drift", buildHeartbeat(0xBAD0_BAD0 >>> 0, 1), 1000);
    a.sweep(10_000); // way past silence threshold
    // Even though silent, FORKED dominates.
    assertEquals(a.snapshot()[0].health, "forked");
});

Deno.test("aggregator: snapshot returns a fresh array", async () => {
    const a = new LivenessAggregator();
    a.ingest("s", buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000);
    const snap = a.snapshot();
    snap.pop();
    assertEquals(a.snapshot().length, 1, "internal map unaffected by snapshot mutation");
});
