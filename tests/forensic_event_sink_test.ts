// Era 1380: Forensic event sink tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    EVENT_SINK_SCHEMA,
    ForensicEventSink,
    computeChainHash,
    diffEventSinks,
} from "../src/network/forensic_event_sink.ts";
import {
    convergenceAlarmEvent,
} from "../src/network/convergence_auto_sync.ts";
import { computeConvergenceHealth } from "../src/network/convergence_health.ts";

const T0 = 1_000_000;

Deno.test("sink: empty has size 0 + zero anchor", async () => {
    const s = new ForensicEventSink();
    assertEquals(s.size(), 0);
    assertEquals(s.eventChainAnchor(), 0x811C_9DC5); // FNV-1a empty
    assertEquals(s.verifyChain(), null);
});

Deno.test("sink: append assigns monotonic sequence numbers", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xAA, {}, T0);
    s.append("test", 0xBB, {}, T0 + 1);
    s.append("test", 0xCC, {}, T0 + 2);
    const list = s.list();
    assertEquals(list.map(e => e.sequence), [0, 1, 2]);
});

Deno.test("sink: chain links each entry to its predecessor", async () => {
    const s = new ForensicEventSink();
    const a = s.append("test", 0xAA, {}, T0);
    const b = s.append("test", 0xBB, {}, T0 + 1);
    const c = s.append("test", 0xCC, {}, T0 + 2);
    assertEquals(a.prev_chain_hash, 0);
    assertEquals(b.prev_chain_hash, a.chain_hash);
    assertEquals(c.prev_chain_hash, b.chain_hash);
});

Deno.test("sink: chain_hash is deterministic for identical inputs", async () => {
    const s1 = new ForensicEventSink();
    const s2 = new ForensicEventSink();
    const a1 = s1.append("alarm", 0xDEADBEEF, {}, T0);
    const a2 = s2.append("alarm", 0xDEADBEEF, {}, T0);
    assertEquals(a1.chain_hash, a2.chain_hash);
});

Deno.test("sink: chain_hash differs across distinct events", async () => {
    const s = new ForensicEventSink();
    const a = s.append("test", 0xAA, {}, T0);
    const b = s.append("test", 0xBB, {}, T0);
    assert(a.chain_hash !== b.chain_hash);
});

Deno.test("sink: verifyChain returns null on intact log", async () => {
    const s = new ForensicEventSink();
    for (let i = 0; i < 10; i++) {
        s.append("test", 0xA0 + i, {}, T0 + i);
    }
    assertEquals(s.verifyChain(), null);
});

Deno.test("sink: verifyChain detects tampered chain_hash", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xAA, {}, T0);
    s.append("test", 0xBB, {}, T0 + 1);
    s.append("test", 0xCC, {}, T0 + 2);
    // Corrupt the second entry's chain_hash directly.
    const list = s.list() as any[];
    list[1].chain_hash = 0xFFFFFFFF;
    assertEquals(s.verifyChain(), 1);
});

Deno.test("sink: verifyChain detects tampered prev_chain_hash", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xAA, {}, T0);
    s.append("test", 0xBB, {}, T0 + 1);
    const list = s.list() as any[];
    list[1].prev_chain_hash ^= 0xFFFFFFFF;
    assertEquals(s.verifyChain(), 1);
});

Deno.test("sink: capacity enforces FIFO eviction", async () => {
    const s = new ForensicEventSink(3);
    s.append("test", 0x01, {}, T0);
    s.append("test", 0x02, {}, T0 + 1);
    s.append("test", 0x03, {}, T0 + 2);
    s.append("test", 0x04, {}, T0 + 3); // evicts 0x01
    assertEquals(s.size(), 3);
    assertEquals(s.list().map(e => e.event_hash), [0x02, 0x03, 0x04]);
});

Deno.test("sink: sequence numbers persist across eviction", async () => {
    const s = new ForensicEventSink(2);
    s.append("test", 0x01, {}, T0);
    s.append("test", 0x02, {}, T0 + 1);
    s.append("test", 0x03, {}, T0 + 2); // evicts seq 0
    s.append("test", 0x04, {}, T0 + 3); // evicts seq 1
    assertEquals(s.list().map(e => e.sequence), [2, 3]);
});

Deno.test("sink: chain remains valid for surviving prefix after eviction", async () => {
    const s = new ForensicEventSink(3);
    for (let i = 0; i < 7; i++) {
        s.append("test", 0xA0 + i, {}, T0 + i);
    }
    // Only the last 3 survive; chain still verifies.
    assertEquals(s.size(), 3);
    assertEquals(s.verifyChain(), null);
});

Deno.test("sink: tail returns most recent N entries", async () => {
    const s = new ForensicEventSink();
    for (let i = 0; i < 5; i++) s.append("test", 0xA0 + i, {}, T0 + i);
    const tail = s.tail(3);
    assertEquals(tail.map(e => e.event_hash), [0xA2, 0xA3, 0xA4]);
});

Deno.test("sink: tail with n=0 returns empty", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xAA, {}, T0);
    assertEquals(s.tail(0), []);
});

Deno.test("sink: byKind filters live entries", async () => {
    const s = new ForensicEventSink();
    s.append("alarm", 0x01, {}, T0);
    s.append("verdict", 0x02, {}, T0 + 1);
    s.append("alarm", 0x03, {}, T0 + 2);
    assertEquals(s.byKind("alarm").map(e => e.event_hash), [0x01, 0x03]);
    assertEquals(s.byKind("verdict").map(e => e.event_hash), [0x02]);
    assertEquals(s.byKind("missing"), []);
});

Deno.test("sink: findByEventHash returns matching entry", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xDEAD, {}, T0);
    s.append("test", 0xBEEF, {}, T0 + 1);
    const found = s.findByEventHash(0xBEEF);
    assert(found !== null);
    assertEquals(found!.event_hash, 0xBEEF);
});

Deno.test("sink: findByEventHash returns null when missing", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xAA, {}, T0);
    assertEquals(s.findByEventHash(0xBB), null);
});

Deno.test("sink: eventChainAnchor is order-independent across sinks", async () => {
    const s1 = new ForensicEventSink();
    const s2 = new ForensicEventSink();
    s1.append("test", 0x01, {}, T0);
    s1.append("test", 0x02, {}, T0 + 1);
    s2.append("test", 0x02, {}, T0 + 5);
    s2.append("test", 0x01, {}, T0 + 6);
    assertEquals(s1.eventChainAnchor(), s2.eventChainAnchor());
});

Deno.test("sink: summary includes per-kind counts", async () => {
    const s = new ForensicEventSink(100);
    s.append("alarm", 0x01, {}, T0);
    s.append("alarm", 0x02, {}, T0 + 1);
    s.append("verdict", 0x03, {}, T0 + 2);
    const sum = s.summary();
    assertEquals(sum.size, 3);
    assertEquals(sum.capacity, 100);
    assertEquals(sum.next_sequence, 3);
    assertEquals(sum.kinds, { alarm: 2, verdict: 1 });
});

Deno.test("sink: clear resets state including sequence counter", async () => {
    const s = new ForensicEventSink();
    s.append("test", 0xAA, {}, T0);
    s.append("test", 0xBB, {}, T0 + 1);
    s.clear();
    assertEquals(s.size(), 0);
    const fresh = s.append("test", 0xCC, {}, T0 + 2);
    assertEquals(fresh.sequence, 0);
    assertEquals(fresh.prev_chain_hash, 0);
});

Deno.test("sink: invalid capacity throws", async () => {
    assertThrows(() => new ForensicEventSink(0));
    assertThrows(() => new ForensicEventSink(-5));
});

Deno.test("computeChainHash: matches sink's internal computation", async () => {
    const s = new ForensicEventSink();
    const e = s.append("alarm", 0xDEADBEEF, {}, T0);
    const recomputed = computeChainHash("alarm", 0xDEADBEEF, T0, 0, 0);
    assertEquals(e.chain_hash, recomputed);
});

Deno.test("diffEventSinks: identifies disjoint and shared event hashes", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    a.append("test", 0x01, {}, T0);
    a.append("test", 0x02, {}, T0 + 1);
    a.append("test", 0x03, {}, T0 + 2);
    b.append("test", 0x02, {}, T0 + 5);
    b.append("test", 0x03, {}, T0 + 6);
    b.append("test", 0x04, {}, T0 + 7);
    const diff = diffEventSinks(a, b);
    assertEquals(diff.only_in_a, [0x01]);
    assertEquals(diff.only_in_b, [0x04]);
    assertEquals(diff.shared, [0x02, 0x03]);
});

Deno.test("end-to-end: convergence alarm flows into sink with chain integrity", async () => {
    const s = new ForensicEventSink();
    const sig = computeConvergenceHealth([0x10], [0x10, 0x20, 0x30, 0x40, 0x50]);
    const alarm = convergenceAlarmEvent(sig, [
        { peer_id: 0xAA, novel_count: 4, total_offered: 5 },
    ], T0);
    const entry = s.append("convergence-alarm", alarm.event_hash, alarm, T0);
    assertEquals(entry.kind, "convergence-alarm");
    assertEquals(entry.event_hash, alarm.event_hash);
    assertEquals(s.verifyChain(), null);
    const found = s.findByEventHash(alarm.event_hash);
    assert(found !== null);
    assertEquals((found!.payload as any).band, "stranded");
});

Deno.test("schema constant", async () => {
    assertEquals(EVENT_SINK_SCHEMA, "OMEGA-1380/v1");
});
