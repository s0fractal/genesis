// Era 1190: Resilience Snapshot cross-language tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    PARTITION_DIFF_THRESHOLD_Q16,
    SNAPSHOT_BYTES,
    SNAPSHOT_MAGIC,
    SNAPSHOT_VERSION_V1,
    isPartitionDetected,
    rateAsPercent,
    redundancyRateDiffQ16,
    snapshotFromBytes,
    snapshotFromCounts,
    snapshotFromDetector,
    snapshotToBytes,
} from "../src/network/resilience_snapshot.ts";
import { ConvergenceDetector } from "../src/network/convergence_detector.ts";
import { buildWarrantVote } from "../src/network/spore_frame.ts";

Deno.test("snapshot: round-trips bit-for-bit", async () => {
    const s = snapshotFromCounts(100, 30, 60, 10, 25);
    const bytes = snapshotToBytes(s);
    assertEquals(bytes.length, SNAPSHOT_BYTES);
    const parsed = snapshotFromBytes(bytes);
    assert(parsed !== null);
    assertEquals(parsed!, s);
});

Deno.test("snapshot: redundancy rate Q16 matches Rust math", async () => {
    const s = snapshotFromCounts(100, 30, 60, 10, 0);
    // 60/100 × 65536 = 39321.6 → round-half-up → 39322
    assertEquals(s.redundancyRateQ16, 39322);
});

Deno.test("snapshot: zero total → zero rate", async () => {
    const s = snapshotFromCounts(0, 0, 0, 0, 0);
    assertEquals(s.redundancyRateQ16, 0);
});

Deno.test("snapshot: full redundancy → 65536", async () => {
    const s = snapshotFromCounts(100, 0, 100, 0, 50);
    assertEquals(s.redundancyRateQ16, 65536);
});

Deno.test("snapshot: corrupted CRC rejected", async () => {
    const s = snapshotFromCounts(100, 30, 60, 10, 25);
    const bytes = snapshotToBytes(s);
    bytes[31] ^= 0x55;
    assertEquals(snapshotFromBytes(bytes), null);
});

Deno.test("snapshot: wrong magic rejected", async () => {
    const s = snapshotFromCounts(100, 30, 60, 10, 25);
    const bytes = snapshotToBytes(s);
    bytes[0] = 0xAA;
    assertEquals(snapshotFromBytes(bytes), null);
});

Deno.test("snapshot: wrong version rejected", async () => {
    const s = snapshotFromCounts(100, 30, 60, 10, 25);
    const bytes = snapshotToBytes(s);
    bytes[2] = 99;
    assertEquals(snapshotFromBytes(bytes), null);
});

Deno.test("snapshot: short buffer rejected", async () => {
    assertEquals(snapshotFromBytes(new Uint8Array(10)), null);
});

Deno.test("snapshot: cross-language CRC anchor", async () => {
    // Mirror of omega_v2/src/resilience_snapshot.rs::cross_lang_anchor_snapshot_crc.
    const s = snapshotFromCounts(100, 30, 60, 10, 25);
    assertEquals(s.crc32, 0x98E5_768B);
});

Deno.test("snapshot: from ConvergenceDetector aggregates stats", async () => {
    const cd = new ConvergenceDetector();
    const wv1 = buildWarrantVote(0xAA00 >>> 0, 0, true, 1);
    cd.observe(wv1, "spore-A", 1000);
    cd.observe(wv1, "spore-B", 1100); // double-witness
    cd.observe(buildWarrantVote(0xBB00 >>> 0, 0, true, 1), "spore-C", 2000);
    const s = snapshotFromDetector(cd);
    assertEquals(s.totalIntents, 2);
    assertEquals(s.doubleWitness, 1);
    assertEquals(s.singleWitness, 1);
});

Deno.test("snapshot: redundancyRateDiffQ16 is symmetric", async () => {
    const a = snapshotFromCounts(100, 30, 60, 10, 0);
    const b = snapshotFromCounts(100, 70, 20, 10, 0);
    const d1 = redundancyRateDiffQ16(a, b);
    const d2 = redundancyRateDiffQ16(b, a);
    assertEquals(d1, d2);
    assert(d1 > 0);
});

Deno.test("snapshot: partition detection triggers above threshold", async () => {
    const a = snapshotFromCounts(100, 50, 50, 0, 0);
    const b = snapshotFromCounts(100, 40, 60, 0, 0);
    assertEquals(isPartitionDetected(a, b), true);
});

Deno.test("snapshot: no partition when measurements agree", async () => {
    const a = snapshotFromCounts(100, 30, 60, 10, 0);
    const b = snapshotFromCounts(100, 30, 60, 10, 0);
    assertEquals(isPartitionDetected(a, b), false);
});

Deno.test("snapshot: rateAsPercent formats Q16 correctly", async () => {
    assertEquals(rateAsPercent(0), "0.00%");
    assertEquals(rateAsPercent(65536), "100.00%");
    assertEquals(rateAsPercent(32768), "50.00%");
});

Deno.test("snapshot: SNAPSHOT_MAGIC is 'RS'", async () => {
    assertEquals(SNAPSHOT_MAGIC, 0x5253);
    assertEquals(String.fromCharCode(0x52, 0x53), "RS");
});

Deno.test("snapshot: version constant is v1.0", async () => {
    assertEquals(SNAPSHOT_VERSION_V1, 1);
});
