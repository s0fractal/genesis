// Era 1410: Event sink wire-format tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    EVENT_WIRE_SCHEMA,
    chunkEventDelta,
    packKindTag,
    reassembleEventDelta,
    unpackKindTag,
} from "../src/network/event_sink_wire.ts";
import {
    applyEventDelta,
    buildEventHashList,
    computeEventDelta,
} from "../src/network/event_sink_sync.ts";
import { ForensicEventSink } from "../src/network/forensic_event_sink.ts";
import {
    FRAME_TYPE_EVENT_DELTA_CHUNK,
    FRAME_TYPE_EVENT_HASH_LIST,
    frameFromBytes,
    frameToBytes,
} from "../src/network/spore_frame.ts";

const T0 = 1_000_000;
const SENDER = 0xCC02;

function fillSink(s: ForensicEventSink, hashes: ReadonlyArray<number>, kind = "test"): void {
    for (let i = 0; i < hashes.length; i++) s.append(kind, hashes[i], { idx: i }, T0 + i);
}

// --- Kind tag pack/unpack ---

Deno.test("packKindTag: 4-char strings round-trip", () => {
    for (const s of ["alarm", "vrdt", "test", "ab", "x", ""]) {
        const truncated = s.slice(0, 4);
        assertEquals(unpackKindTag(packKindTag(s)), truncated);
    }
});

Deno.test("packKindTag: produces deterministic u32", () => {
    assertEquals(packKindTag("test"), 0x74657374); // 't','e','s','t'
});

// --- Chunking ---

Deno.test("chunkEventDelta: emits header + one frame per entry", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    assertEquals(frames.length, 3); // 1 header + 2 records
    for (const f of frames) {
        assertEquals(f.frameType, FRAME_TYPE_EVENT_DELTA_CHUNK);
    }
});

Deno.test("chunkEventDelta: empty delta produces header-only envelope", () => {
    const a = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, a.list(), T0);
    const frames = chunkEventDelta(delta, SENDER);
    assertEquals(frames.length, 1);
});

Deno.test("chunkEventDelta: each frame's CRC validates after byte round-trip", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    for (const f of frames) {
        const bytes = frameToBytes(f);
        const decoded = frameFromBytes(bytes);
        assert(decoded !== null);
        assertEquals(decoded!.crc32, f.crc32);
    }
});

// --- Reassembly ---

Deno.test("reassembleEventDelta: roundtrip preserves event_hash set + delta_hash", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    const result = reassembleEventDelta(frames);
    assert(result.ok, result.error);
    assertEquals(
        result.delta!.missing_entries.map(e => e.event_hash).sort((x, y) => x - y),
        [0x20, 0x30],
    );
    assertEquals(result.delta!.delta_hash, delta.delta_hash);
});

Deno.test("reassembleEventDelta: out-of-order arrival reassembles correctly", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30, 0x40]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    const reversed = [...frames].reverse();
    const result = reassembleEventDelta(reversed);
    assert(result.ok, result.error);
    assertEquals(result.delta!.missing_entries.length, 3);
});

Deno.test("reassembleEventDelta: detects missing chunk", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30, 0x40]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    const dropped = frames.filter(f => ((f.reserved >>> 16) & 0xFFFF) !== 2);
    const result = reassembleEventDelta(dropped);
    assertEquals(result.ok, false);
    assertEquals(result.missing_sequences, [2]);
});

Deno.test("reassembleEventDelta: idempotent on duplicates", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    const doubled = [...frames, ...frames];
    const result = reassembleEventDelta(doubled);
    assert(result.ok, result.error);
});

Deno.test("reassembleEventDelta: rejects conflicting payload at same sequence", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    const tampered = { ...frames[1], proposalOrTarget: 0xDEADBEEF };
    const result = reassembleEventDelta([...frames, tampered]);
    assertEquals(result.ok, false);
    assert(result.error!.includes("conflicting"));
});

Deno.test("reassembleEventDelta: cross-envelope filter with expected_envelope_hash", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    const c = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    fillSink(c, [0x10, 0x40, 0x50]);
    const deltaB = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const deltaC = computeEventDelta(buildEventHashList(a, T0), c.list(), T0 + 200);
    const frames = [...chunkEventDelta(deltaB, SENDER), ...chunkEventDelta(deltaC, 0xCC04)];
    const onlyB = reassembleEventDelta(frames, deltaB.delta_hash);
    assert(onlyB.ok, onlyB.error);
    assertEquals(onlyB.delta!.missing_entries.length, 2);
});

// --- End-to-end Era 1390 + 1410 ---

Deno.test("end-to-end: chunked event delta passes Era 1390 applyEventDelta", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    const result = reassembleEventDelta(frames);
    assert(result.ok);
    const outcome = applyEventDelta(a, result.delta!, T0 + 200);
    assert(outcome.ok);
    if (outcome.ok) assertEquals(outcome.added_count, 2);
    assertEquals(a.size(), 3);
});

// --- Era 1420 cross-substrate locked vectors ---
// These bytes mirror the Rust `event_broadcast::tests::*` outputs.
// Drift on either side breaks both suites.

Deno.test("cross-substrate: packKindTag known values match Rust pack_kind_tag", () => {
    assertEquals(packKindTag("test"), 0x74657374);
    assertEquals(packKindTag("alarm"), 0x616C6172); // truncates to "alar"
    assertEquals(packKindTag("x"), 0x78000000);
    assertEquals(packKindTag(""), 0);
});

Deno.test("cross-substrate: chunkEventDelta envelope_hash for [0x10,0x20,0x30] is 0x929932B5", () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(b, [0x10, 0x20, 0x30]);
    const delta = computeEventDelta(buildEventHashList(a, T0), b.list(), T0 + 100);
    const frames = chunkEventDelta(delta, SENDER);
    // Header tick = envelope_hash = locked 0x929932B5.
    assertEquals(frames[0].tick >>> 0, 0x9299_32B5);
    assertEquals(frames[0].proposalOrTarget >>> 0, 0x9299_32B5);
});

// --- Frame type registry ---

Deno.test("frame types: EVENT_HASH_LIST=9, EVENT_DELTA_CHUNK=10", () => {
    assertEquals(FRAME_TYPE_EVENT_HASH_LIST, 9);
    assertEquals(FRAME_TYPE_EVENT_DELTA_CHUNK, 10);
});

Deno.test("schema constant", () => {
    assertEquals(EVENT_WIRE_SCHEMA, "OMEGA-1410/v1");
});
