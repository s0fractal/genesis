// Era 1260: FrameRecorder + Trace Replay tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    FrameRecorder,
    replayThrough,
    replayWindow,
    summarize,
} from "../src/network/frame_recorder.ts";
import {
    FRAME_TYPE_HEARTBEAT,
    FRAME_TYPE_WARRANT_VOTE,
    buildHeartbeat,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import { ConvergenceDetector } from "../src/network/convergence_detector.ts";

const NOW = 100_000;

Deno.test("recorder: records frames in order", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "spore-A");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW + 100, "spore-B");
    assertEquals(r.size(), 2);
    assertEquals(r.snapshot()[0].delivered_by, "spore-A");
    assertEquals(r.snapshot()[1].delivered_by, "spore-B");
});

Deno.test("recorder: capacity bound evicts oldest (FIFO)", () => {
    const r = new FrameRecorder({ capacity: 2 });
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW + 10, "B");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 3), NOW + 20, "C");
    assertEquals(r.size(), 2);
    const ids = r.snapshot().map(s => s.delivered_by);
    assertEquals(ids, ["B", "C"]);
});

Deno.test("recorder: total_recorded counts lifetime ingest", () => {
    const r = new FrameRecorder({ capacity: 2 });
    for (let i = 0; i < 5; i++) {
        r.record(buildHeartbeat(GENESIS_HASH_V1_0, i), NOW + i, `S${i}`);
    }
    assertEquals(r.size(), 2);
    assertEquals(r.total_recorded, 5);
});

Deno.test("recorder: range filters by time window", () => {
    const r = new FrameRecorder();
    for (let t = 0; t < 10; t++) {
        r.record(buildHeartbeat(GENESIS_HASH_V1_0, t), NOW + t * 100, `S${t}`);
    }
    const window = r.range(NOW + 200, NOW + 500);
    assertEquals(window.length, 4); // t=2,3,4,5
});

Deno.test("recorder: byType filters by frame type", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    r.record(buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1), NOW + 10, "A");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW + 20, "A");
    assertEquals(r.byType(FRAME_TYPE_HEARTBEAT).length, 2);
    assertEquals(r.byType(FRAME_TYPE_WARRANT_VOTE).length, 1);
});

Deno.test("recorder: byDeliverer filters by source", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW + 10, "B");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 3), NOW + 20, "A");
    assertEquals(r.byDeliverer("A").length, 2);
    assertEquals(r.byDeliverer("B").length, 1);
});

Deno.test("recorder: filter applies arbitrary predicate", () => {
    const r = new FrameRecorder();
    for (let t = 1; t <= 5; t++) {
        r.record(buildHeartbeat(GENESIS_HASH_V1_0, t), NOW + t, "A");
    }
    const evens = r.filter(rec => rec.frame.tick % 2 === 0);
    assertEquals(evens.length, 2);
});

Deno.test("recorder: serialize / deserialize round-trip", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    r.record(buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 5), NOW + 10, "B");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 7), NOW + 20, "C");
    const blob = r.serialize();
    assertEquals(blob.length, 32 * 3);
    const restored = FrameRecorder.fromSerialized(blob);
    assertEquals(restored.size(), 3);
    assertEquals(restored.snapshot()[1].frame.tick, 5);
    assertEquals(restored.snapshot()[1].delivered_by, "(replay)");
});

Deno.test("recorder: deserialize skips corrupted frames", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    const blob = r.serialize();
    // Corrupt the first frame's CRC.
    blob[31] ^= 0x55;
    const restored = FrameRecorder.fromSerialized(blob);
    assertEquals(restored.size(), 0);
});

Deno.test("recorder: deserialize handles partial trailing bytes", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    const blob = r.serialize();
    // Append 5 garbage bytes (less than a frame).
    const padded = new Uint8Array(blob.length + 5);
    padded.set(blob);
    const restored = FrameRecorder.fromSerialized(padded);
    assertEquals(restored.size(), 1);
});

Deno.test("recorder: clear empties everything", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    r.clear();
    assertEquals(r.size(), 0);
    assertEquals(r.total_recorded, 0);
});

Deno.test("recorder: invalid capacity throws", () => {
    assertThrows(() => new FrameRecorder({ capacity: 0 }));
    assertThrows(() => new FrameRecorder({ capacity: -1 }));
});

Deno.test("recorder: snapshot is detached from internal buffer", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    const snap = r.snapshot();
    snap.push({} as never);
    assertEquals(r.size(), 1); // internal buffer unaffected
});

Deno.test("replay: replayThrough applies observe function in order", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW, "A");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW + 10, "B");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 3), NOW + 20, "C");
    const ids: string[] = [];
    replayThrough(r.snapshot(), (_, by) => { ids.push(by); return by; });
    assertEquals(ids, ["A", "B", "C"]);
});

Deno.test("replay: replayWindow rebuilds detector state from frames", () => {
    const r = new FrameRecorder();
    const wv1 = buildWarrantVote(0xAA00 >>> 0, 0, true, 1);
    const wv2 = buildWarrantVote(0xBB00 >>> 0, 0, true, 2);
    r.record(wv1, NOW, "A");
    r.record(wv1, NOW + 50, "B"); // double-witness
    r.record(wv2, NOW + 100, "A"); // single-witness

    const detector = replayWindow(
        r,
        NOW,
        NOW + 200,
        () => new ConvergenceDetector(),
        (cd, frame, by, t) => cd.observe(frame, by, t),
    );

    const stats = detector.stats();
    assertEquals(stats.total_intents, 2);
    assertEquals(stats.double_witness, 1);
    assertEquals(stats.single_witness, 1);
});

Deno.test("replay: window-bounded replay excludes outside frames", () => {
    const r = new FrameRecorder();
    for (let t = 0; t < 10; t++) {
        r.record(buildHeartbeat(GENESIS_HASH_V1_0, t), NOW + t * 100, "A");
    }
    const inside = r.range(NOW + 300, NOW + 600);
    assertEquals(inside.length, 4);
    // Outside range: t=0,1,2 below + t=7,8,9 above = 6 excluded.
});

Deno.test("summarize: aggregates over a frame slice", () => {
    const r = new FrameRecorder();
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 1), 1000, "A");
    r.record(buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1), 1100, "B");
    r.record(buildHeartbeat(GENESIS_HASH_V1_0, 2), 1200, "A");
    const s = summarize(r.snapshot());
    assertEquals(s.total_frames, 3);
    assertEquals(s.by_type[FRAME_TYPE_HEARTBEAT], 2);
    assertEquals(s.by_type[FRAME_TYPE_WARRANT_VOTE], 1);
    assertEquals(s.by_deliverer.A, 2);
    assertEquals(s.by_deliverer.B, 1);
    assertEquals(s.earliest_at_ms, 1000);
    assertEquals(s.latest_at_ms, 1200);
});

Deno.test("summarize: empty input returns zero-shape", () => {
    const s = summarize([]);
    assertEquals(s.total_frames, 0);
    assertEquals(s.earliest_at_ms, 0);
    assertEquals(s.latest_at_ms, 0);
});

Deno.test("recorder: forensic-replay determinism — replay produces same observer state", () => {
    // Critical invariant: replay(frames) === observe-each-frame-once(frames).
    const r = new FrameRecorder();
    for (let i = 0; i < 5; i++) {
        const wv = buildWarrantVote((0xAA00 + i) >>> 0, 0, true, i);
        r.record(wv, NOW + i * 10, "X");
        if (i % 2 === 0) r.record(wv, NOW + i * 10 + 5, "Y"); // some doubles
    }

    // Live observer.
    const live = new ConvergenceDetector();
    for (const rec of r.snapshot()) {
        live.observe(rec.frame, rec.delivered_by, rec.received_at_ms);
    }

    // Replay observer.
    const replayed = replayWindow(
        r, 0, Number.MAX_SAFE_INTEGER,
        () => new ConvergenceDetector(),
        (cd, f, by, t) => cd.observe(f, by, t),
    );

    const liveStats = live.stats();
    const replayStats = replayed.stats();
    assertEquals(liveStats.total_intents, replayStats.total_intents);
    assertEquals(liveStats.double_witness, replayStats.double_witness);
    assertEquals(liveStats.single_witness, replayStats.single_witness);
});
