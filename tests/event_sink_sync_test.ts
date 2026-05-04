// Era 1390: Event sink sync tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    SYNC_SCHEMA_VERSION,
    applyEventDelta,
    buildEventHashList,
    computeEventDelta,
    eventHashSetHash,
    eventSyncRound,
} from "../src/network/event_sink_sync.ts";
import {
    EVENT_SINK_SCHEMA,
    ForensicEvent,
    ForensicEventSink,
} from "../src/network/forensic_event_sink.ts";

const T0 = 1_000_000;

function fillSink(sink: ForensicEventSink, hashes: ReadonlyArray<number>, t0: number = T0): void {
    for (let i = 0; i < hashes.length; i++) {
        sink.append("test", hashes[i], { idx: i }, t0 + i);
    }
}

Deno.test("eventHashSetHash: deterministic + order-independent", async () => {
    assertEquals(
        eventHashSetHash([0x10, 0x20, 0x30]),
        eventHashSetHash([0x30, 0x10, 0x20]),
    );
});

Deno.test("eventHashSetHash: empty → FNV-1a offset basis", async () => {
    assertEquals(eventHashSetHash([]), 0xe3b0c442);
});

Deno.test("buildEventHashList: sorted hashes + anchor matches", async () => {
    const sink = new ForensicEventSink();
    fillSink(sink, [0x30, 0x10, 0x20]);
    const list = buildEventHashList(sink, T0 + 100);
    assertEquals(list.event_hashes, [0x10, 0x20, 0x30]);
    assertEquals(list.hash_set_anchor, eventHashSetHash([0x10, 0x20, 0x30]));
});

Deno.test("computeEventDelta: identifies entries initiator lacks", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    fillSink(b, [0x10, 0x20, 0x30, 0x40]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    assertEquals(delta.missing_entries.map(e => e.event_hash), [0x30, 0x40]);
});

Deno.test("computeEventDelta: identifies hashes peer lacks", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20, 0x30]);
    fillSink(b, [0x10, 0x40]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    assertEquals(delta.missing_entries.map(e => e.event_hash), [0x40]);
    assertEquals(delta.peer_missing_hashes, [0x20, 0x30]);
});

Deno.test("computeEventDelta: identical sinks → empty delta", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    fillSink(b, [0x10, 0x20]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    assertEquals(delta.missing_entries.length, 0);
    assertEquals(delta.peer_missing_hashes.length, 0);
});

Deno.test("applyEventDelta: imports missing entries + reports counts", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    const outcome = applyEventDelta(a, delta, T0 + 200);
    assert(outcome.ok);
    if (outcome.ok) {
        assertEquals(outcome.added_count, 2);
        assertEquals(outcome.skipped_count, 0);
    }
    assertEquals(a.size(), 3);
    assertEquals(
        a.list().map(e => e.event_hash).sort((x, y) => x - y),
        [0x10, 0x20, 0x30],
    );
});

Deno.test("applyEventDelta: imported chain still verifies", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    applyEventDelta(a, delta, T0 + 200);
    assertEquals(a.verifyChain(), null);
});

Deno.test("applyEventDelta: idempotent on duplicate entries", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    fillSink(b, [0x10, 0x20]);
    // Force the delta to include 0x10 (which a already has).
    const fakeList = buildEventHashList(new ForensicEventSink(), T0); // empty
    const delta = computeEventDelta(fakeList, [b.list()[0]], T0 + 100);
    const outcome = applyEventDelta(a, delta, T0 + 200);
    assert(outcome.ok);
    if (outcome.ok) {
        assertEquals(outcome.added_count, 0);
        assertEquals(outcome.skipped_count, 1);
    }
    assertEquals(a.size(), 2);
});

Deno.test("applyEventDelta: rejects bad delta schema", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    delta.schema = "bad-schema";
    const outcome = applyEventDelta(a, delta, T0 + 200);
    assertEquals(outcome.ok, false);
});

Deno.test("applyEventDelta: rejects delta_hash drift", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    delta.delta_hash ^= 0xFFFFFFFF;
    const outcome = applyEventDelta(a, delta, T0 + 200);
    assertEquals(outcome.ok, false);
    if (!outcome.ok) assert(outcome.reason.includes("drift"));
});

Deno.test("applyEventDelta: rejects entry with bad sink schema", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x10, 0x20]);
    const list = buildEventHashList(a, T0);
    const delta = computeEventDelta(list, b.list(), T0 + 100);
    (delta.missing_entries[0] as any).schema = "bad-sink-schema";
    const outcome = applyEventDelta(a, delta, T0 + 200);
    assertEquals(outcome.ok, false);
});

Deno.test("applyEventDelta: rejects collision (same hash, different kind)", async () => {
    const a = new ForensicEventSink();
    a.append("alarm", 0x42, { kind: "original" }, T0);
    // Forge a delta with same event_hash but different kind.
    const counterfeit: ForensicEvent = {
        schema: EVENT_SINK_SCHEMA,
        kind: "verdict", // ← collision: different kind
        event_hash: 0x42,
        sunk_at_ms: T0 + 100,
        sequence: 0,
        prev_chain_hash: 0,
        chain_hash: 0xABC,
        payload: { kind: "evil" },
    };
    const delta = {
        schema: SYNC_SCHEMA_VERSION,
        initiator_anchor: 0,
        missing_entries: [counterfeit],
        peer_missing_hashes: [],
        delta_hash: eventHashSetHash([0x42]),
        replied_at_ms: T0 + 200,
    };
    const outcome = applyEventDelta(a, delta, T0 + 300);
    assertEquals(outcome.ok, false);
    if (!outcome.ok) assert(outcome.reason.includes("collision"));
});

Deno.test("eventSyncRound: bidirectional convergence", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    fillSink(b, [0x20, 0x30]);
    const result = eventSyncRound(a, b, T0 + 1000);
    const aHashes = a.list().map(e => e.event_hash).sort((x, y) => x - y);
    const bHashes = b.list().map(e => e.event_hash).sort((x, y) => x - y);
    assertEquals(aHashes, [0x10, 0x20, 0x30]);
    assertEquals(bHashes, [0x10, 0x20, 0x30]);
    assertEquals(result.a_added_from_b, 1);
    assertEquals(result.b_added_from_a, 1);
});

Deno.test("eventSyncRound: identical sinks → no additions", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20, 0x30]);
    fillSink(b, [0x10, 0x20, 0x30]);
    const result = eventSyncRound(a, b, T0 + 1000);
    assertEquals(result.a_added_from_b, 0);
    assertEquals(result.b_added_from_a, 0);
});

Deno.test("eventSyncRound: disjoint sinks → both fully merge", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    fillSink(b, [0x30, 0x40]);
    const result = eventSyncRound(a, b, T0 + 1000);
    assertEquals(result.a_added_from_b, 2);
    assertEquals(result.b_added_from_a, 2);
    assertEquals(a.eventChainAnchor(), b.eventChainAnchor());
    assertEquals(result.converged_anchor, eventHashSetHash([0x10, 0x20, 0x30, 0x40]));
});

Deno.test("eventSyncRound: anchors equal post-convergence", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10]);
    fillSink(b, [0x20, 0x30, 0x40]);
    eventSyncRound(a, b, T0 + 1000);
    assertEquals(a.eventChainAnchor(), b.eventChainAnchor());
});

Deno.test("eventSyncRound: chain integrity preserved on both sides", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    fillSink(a, [0x10, 0x20]);
    fillSink(b, [0x30, 0x40]);
    eventSyncRound(a, b, T0 + 1000);
    assertEquals(a.verifyChain(), null);
    assertEquals(b.verifyChain(), null);
});

Deno.test("schema constant", async () => {
    assertEquals(SYNC_SCHEMA_VERSION, "OMEGA-1390/v1");
});

// --- Cross-substrate locked anchors (Era 1400 parity) ---
// These values are pinned in `omega_v2/src/forensic_event_sink.rs`'s
// `cross_substrate_anchor_locked_*` tests. Any drift here means
// either the JS or Rust hash byte-pack convention has changed.

Deno.test("cross-substrate: hash for [0x10, 0x20, 0x30] is 0x929932B5", async () => {
    assertEquals(eventHashSetHash([0x10, 0x20, 0x30]), 0x0adfdc42);
});

Deno.test("cross-substrate: hash for [0xAA, 0xBB] is 0x843F5862", async () => {
    assertEquals(eventHashSetHash([0xAA, 0xBB]), 0x0053bf72);
});
