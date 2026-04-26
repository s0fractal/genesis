// Era 1270: Cross-Substrate Trace Sync tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    coverageStats,
    mergeMany,
    mergeTraces,
    observationHash,
    recorderFromMerge,
} from "../src/network/trace_sync.ts";
import { FrameRecorder, replayWindow } from "../src/network/frame_recorder.ts";
import {
    buildHeartbeat,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import { ConvergenceDetector } from "../src/network/convergence_detector.ts";

const NOW = 100_000;

function fillRecorder(
    r: FrameRecorder,
    items: ReadonlyArray<{ tick: number; t_offset: number; by: string }>,
) {
    for (const it of items) {
        r.record(buildHeartbeat(GENESIS_HASH_V1_0, it.tick), NOW + it.t_offset, it.by);
    }
}

Deno.test("hash: same observation produces same hash", () => {
    const a = { frame: buildHeartbeat(GENESIS_HASH_V1_0, 1), received_at_ms: NOW, delivered_by: "X" };
    const b = { frame: buildHeartbeat(GENESIS_HASH_V1_0, 1), received_at_ms: NOW, delivered_by: "X" };
    assertEquals(observationHash(a), observationHash(b));
});

Deno.test("hash: different timestamp → different hash", () => {
    const a = { frame: buildHeartbeat(GENESIS_HASH_V1_0, 1), received_at_ms: NOW, delivered_by: "X" };
    const b = { frame: buildHeartbeat(GENESIS_HASH_V1_0, 1), received_at_ms: NOW + 1, delivered_by: "X" };
    assert(observationHash(a) !== observationHash(b));
});

Deno.test("hash: different deliverer → different hash", () => {
    const a = { frame: buildHeartbeat(GENESIS_HASH_V1_0, 1), received_at_ms: NOW, delivered_by: "X" };
    const b = { frame: buildHeartbeat(GENESIS_HASH_V1_0, 1), received_at_ms: NOW, delivered_by: "Y" };
    assert(observationHash(a) !== observationHash(b));
});

Deno.test("merge: two disjoint traces fully concatenate", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "A" }, { tick: 2, t_offset: 100, by: "A" }]);
    fillRecorder(b, [{ tick: 3, t_offset: 50, by: "B" }, { tick: 4, t_offset: 200, by: "B" }]);
    const result = mergeTraces(a.snapshot(), b.snapshot());
    assertEquals(result.merged.length, 4);
    assertEquals(result.shared_hashes.length, 0);
    assertEquals(result.a_only.length, 2);
    assertEquals(result.b_only.length, 2);
});

Deno.test("merge: identical observations dedup to one", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    // Same frame + same delivered_by + same time → identical.
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "X" }]);
    fillRecorder(b, [{ tick: 1, t_offset: 0, by: "X" }]);
    const result = mergeTraces(a.snapshot(), b.snapshot());
    assertEquals(result.merged.length, 1);
    assertEquals(result.shared_hashes.length, 1);
});

Deno.test("merge: same frame seen by different relays at different times = 2 records", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "A" }]);
    fillRecorder(b, [{ tick: 1, t_offset: 100, by: "B" }]);
    const result = mergeTraces(a.snapshot(), b.snapshot());
    // Two distinct observations even though same wire frame.
    assertEquals(result.merged.length, 2);
    assertEquals(result.shared_hashes.length, 0);
});

Deno.test("merge: output sorted by received_at_ms", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 500, by: "A" }, { tick: 2, t_offset: 100, by: "A" }]);
    fillRecorder(b, [{ tick: 3, t_offset: 300, by: "B" }, { tick: 4, t_offset: 0,   by: "B" }]);
    const result = mergeTraces(a.snapshot(), b.snapshot());
    const ts = result.merged.map(r => r.received_at_ms);
    const sorted = [...ts].sort((x, y) => x - y);
    assertEquals(ts, sorted);
});

Deno.test("merge: deterministic across calls", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    fillRecorder(a, [
        { tick: 1, t_offset: 0, by: "A" },
        { tick: 2, t_offset: 100, by: "A" },
        { tick: 3, t_offset: 200, by: "A" },
    ]);
    fillRecorder(b, [
        { tick: 4, t_offset: 50, by: "B" },
        { tick: 5, t_offset: 150, by: "B" },
    ]);
    const r1 = mergeTraces(a.snapshot(), b.snapshot());
    const r2 = mergeTraces(a.snapshot(), b.snapshot());
    // Byte-identical results.
    assertEquals(r1.merged.length, r2.merged.length);
    for (let i = 0; i < r1.merged.length; i++) {
        assertEquals(r1.merged[i].received_at_ms, r2.merged[i].received_at_ms);
        assertEquals(r1.merged[i].delivered_by, r2.merged[i].delivered_by);
    }
});

Deno.test("merge: tie-break by hash when timestamps match", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    // Same timestamp, different content → both kept, sorted by hash.
    fillRecorder(a, [{ tick: 1, t_offset: 100, by: "A" }]);
    fillRecorder(b, [{ tick: 2, t_offset: 100, by: "B" }]);
    const result = mergeTraces(a.snapshot(), b.snapshot());
    assertEquals(result.merged.length, 2);
    assertEquals(result.merged[0].received_at_ms, result.merged[1].received_at_ms);
    // Order is deterministic — re-running must give same order.
    const result2 = mergeTraces(a.snapshot(), b.snapshot());
    assertEquals(result.merged[0].delivered_by, result2.merged[0].delivered_by);
    assertEquals(result.merged[1].delivered_by, result2.merged[1].delivered_by);
});

Deno.test("merge: empty inputs yield empty result", () => {
    const result = mergeTraces([], []);
    assertEquals(result.merged.length, 0);
});

Deno.test("merge: one empty + one populated → populated returned", () => {
    const a = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "A" }, { tick: 2, t_offset: 50, by: "A" }]);
    const result = mergeTraces(a.snapshot(), []);
    assertEquals(result.merged.length, 2);
    assertEquals(result.a_only.length, 2);
    assertEquals(result.b_only.length, 0);
});

Deno.test("mergeMany: aggregates 3 recorders", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    const c = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 0,   by: "A" }]);
    fillRecorder(b, [{ tick: 2, t_offset: 100, by: "B" }]);
    fillRecorder(c, [{ tick: 3, t_offset: 200, by: "C" }]);
    const result = mergeMany([a, b, c]);
    assertEquals(result.merged.length, 3);
});

Deno.test("mergeMany: empty list returns empty", () => {
    const result = mergeMany([]);
    assertEquals(result.merged.length, 0);
});

Deno.test("mergeMany: single recorder returns that recorder's data", () => {
    const a = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "A" }, { tick: 2, t_offset: 100, by: "A" }]);
    const result = mergeMany([a]);
    assertEquals(result.merged.length, 2);
});

Deno.test("recorderFromMerge: builds a recorder ready for replay", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    a.record(wv, NOW, "A");
    b.record(wv, NOW + 100, "B"); // double-witness via merge
    const result = mergeTraces(a.snapshot(), b.snapshot());
    const merged = recorderFromMerge(result);

    const detector = replayWindow(
        merged, 0, Number.MAX_SAFE_INTEGER,
        () => new ConvergenceDetector(),
        (cd, frame, by, t) => cd.observe(frame, by, t),
    );
    const stats = detector.stats();
    assertEquals(stats.total_intents, 1);
    assertEquals(stats.double_witness, 1);
});

Deno.test("recorderFromMerge: respects custom capacity", () => {
    const a = new FrameRecorder();
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "A" }, { tick: 2, t_offset: 100, by: "A" }]);
    const result = mergeTraces(a.snapshot(), []);
    const merged = recorderFromMerge(result, 1);
    // Capacity 1 → only last frame kept (FIFO eviction).
    assertEquals(merged.size(), 1);
});

Deno.test("coverage: stats reflect overlap correctly", () => {
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    // 1 shared, 1 A-only, 2 B-only.
    fillRecorder(a, [{ tick: 1, t_offset: 0, by: "X" }, { tick: 2, t_offset: 100, by: "A" }]);
    fillRecorder(b, [{ tick: 1, t_offset: 0, by: "X" }, { tick: 3, t_offset: 200, by: "B" }, { tick: 4, t_offset: 300, by: "B" }]);
    const result = mergeTraces(a.snapshot(), b.snapshot());
    const stats = coverageStats(result);
    assertEquals(stats.total_unique, 4);
    assertEquals(stats.shared, 1);
    assertEquals(stats.a_only, 1);
    assertEquals(stats.b_only, 2);
    assert(Math.abs(stats.overlap_ratio - 0.25) < 1e-9);
});

Deno.test("coverage: empty merge returns zero shape", () => {
    const result = mergeTraces([], []);
    const stats = coverageStats(result);
    assertEquals(stats.total_unique, 0);
    assertEquals(stats.overlap_ratio, 0);
});

Deno.test("merge: forensic invariant — merged replay ≥ each individual replay", () => {
    // Both relays observe the same partition incident from different
    // viewpoints. Merged replay sees more total intents than either.
    const a = new FrameRecorder();
    const b = new FrameRecorder();
    // A sees intents 1, 2, 3 (3 single-witness).
    for (let i = 1; i <= 3; i++) {
        a.record(buildWarrantVote((0xAA00 + i) >>> 0, 0, true, i), NOW + i * 10, "A");
    }
    // B sees intents 3, 4, 5 (intent 3 doubles up with A's view).
    for (let i = 3; i <= 5; i++) {
        b.record(buildWarrantVote((0xAA00 + i) >>> 0, 0, true, i), NOW + i * 10 + 1, "B");
    }

    const a_only = replayWindow(a, 0, Number.MAX_SAFE_INTEGER,
        () => new ConvergenceDetector(),
        (cd, f, by, t) => cd.observe(f, by, t));
    const b_only = replayWindow(b, 0, Number.MAX_SAFE_INTEGER,
        () => new ConvergenceDetector(),
        (cd, f, by, t) => cd.observe(f, by, t));

    const merged = recorderFromMerge(mergeTraces(a.snapshot(), b.snapshot()));
    const both = replayWindow(merged, 0, Number.MAX_SAFE_INTEGER,
        () => new ConvergenceDetector(),
        (cd, f, by, t) => cd.observe(f, by, t));

    assertEquals(a_only.stats().total_intents, 3);
    assertEquals(b_only.stats().total_intents, 3);
    // Merged sees 5 distinct intents (3 from A, 3 from B, 1 overlapping).
    assertEquals(both.stats().total_intents, 5);
    // Intent 3 became double-witness via merge.
    assertEquals(both.stats().double_witness, 1);
});
