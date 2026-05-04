// Era 1500: WebRTC event bridge tests.
//
// The bridge is transport-agnostic; tests use a paired in-process
// loopback `PairedTransport` that delivers messages between two
// bridges synchronously.

import { assertEquals, assert } from "jsr:@std/assert";
import {
    BRIDGE_SCHEMA,
    BridgeMessage,
    BridgeTransport,
    WebRTCEventBridge,
} from "../src/network/webrtc_event_bridge.ts";
import { ForensicEventSink } from "../src/network/forensic_event_sink.ts";

const T0 = 1_000_000;

/** In-process paired transport: transport_a.send(B, msg) calls
 *  bridge_b.handleIncoming(msg). */
class PairedTransport implements BridgeTransport {
    private peer?: WebRTCEventBridge;
    public sent_log: BridgeMessage[] = [];

    bind(peer: WebRTCEventBridge): void {
        this.peer = peer;
    }

    send(_peer_id: number, msg: BridgeMessage): boolean {
        this.sent_log.push(msg);
        if (this.peer) this.peer.handleIncoming(msg, T0);
        return true;
    }
}

function makePair(): {
    a: WebRTCEventBridge;
    b: WebRTCEventBridge;
    sinkA: ForensicEventSink;
    sinkB: ForensicEventSink;
    txA: PairedTransport;
    txB: PairedTransport;
} {
    const sinkA = new ForensicEventSink();
    const sinkB = new ForensicEventSink();
    const txA = new PairedTransport();
    const txB = new PairedTransport();
    const a = new WebRTCEventBridge(0xAA, sinkA, txA);
    const b = new WebRTCEventBridge(0xBB, sinkB, txB);
    txA.bind(b);
    txB.bind(a);
    return { a, b, sinkA, sinkB, txA, txB };
}

Deno.test("bridge: PEER_HELLO marks peer known on receipt", async () => {
    const { a, b } = makePair();
    a.helloPeer(0xBB);
    assert(b.isPeerKnown(0xAA));
});

Deno.test("bridge: rejects schema mismatch on HELLO", async () => {
    const sink = new ForensicEventSink();
    const tx = new PairedTransport();
    const bridge = new WebRTCEventBridge(0xAA, sink, tx);
    const handled = bridge.handleIncoming(
        { kind: "PEER_HELLO", schema: "bad-schema", peer_id: 0xBB },
        T0,
    );
    assertEquals(handled, false);
    assertEquals(bridge.telemetry().schema_mismatches, 1);
    assert(!bridge.isPeerKnown(0xBB));
});

Deno.test("bridge: HASH_LIST receive triggers automatic DELTA back", async () => {
    const { a, b, sinkA, sinkB } = makePair();
    a.helloPeer(0xBB);
    b.helloPeer(0xAA);
    // A has events B doesn't.
    sinkA.append("alrm", 0x10, null, T0);
    sinkA.append("alrm", 0x20, null, T0);
    sinkB.append("alrm", 0x30, null, T0);

    // B broadcasts its hash list to A. A should respond with the
    // entries B is missing.
    b.broadcastHashList(0xAA, T0);
    // After one synchronous round, B should have A's entries.
    assertEquals(sinkB.size(), 3);
    assertEquals(
        sinkB.list().map((e) => e.event_hash).sort((x, y) => x - y),
        [0x10, 0x20, 0x30],
    );
});

Deno.test("bridge: identical sinks → HASH_LIST exchange ships nothing", async () => {
    const { a, b, sinkA, sinkB } = makePair();
    a.helloPeer(0xBB);
    b.helloPeer(0xAA);
    sinkA.append("alrm", 0x10, null, T0);
    sinkB.append("alrm", 0x10, null, T0);
    const baseline = sinkA.size();
    b.broadcastHashList(0xAA, T0);
    assertEquals(sinkA.size(), baseline);
    assertEquals(sinkB.size(), 1);
    // No DELTA was needed.
    assertEquals(a.telemetry().deltas_sent, 0);
});

Deno.test("bridge: sendDelta manually ships entries to peer", async () => {
    const { a, b, sinkA, sinkB } = makePair();
    a.helloPeer(0xBB);
    b.helloPeer(0xAA);
    sinkA.append("alrm", 0x42, null, T0);
    const events = sinkA.list();
    a.sendDelta(0xBB, events, T0);
    assertEquals(sinkB.size(), 1);
    assertEquals(sinkB.list()[0].event_hash, 0x42);
});

Deno.test("bridge: rejects DELTA from unknown schema", async () => {
    const { b } = makePair();
    const bad: BridgeMessage = {
        kind: "DELTA",
        from: 0xAA,
        delta: {
            schema: "bad-schema",
            initiator_anchor: 0,
            missing_entries: [],
            peer_missing_hashes: [],
            delta_hash: 0,
            replied_at_ms: T0,
        },
    };
    assertEquals(b.handleIncoming(bad, T0), false);
    assertEquals(b.telemetry().schema_mismatches, 1);
});

Deno.test("bridge: collision in incoming DELTA increments counter", async () => {
    const { a, b, sinkA, sinkB } = makePair();
    a.helloPeer(0xBB);
    b.helloPeer(0xAA);
    sinkA.append("alrm", 0x42, null, T0);
    sinkB.append("vrdt", 0x42, null, T0); // same hash, different kind
    a.sendDelta(0xBB, sinkA.list(), T0);
    assertEquals(b.telemetry().apply_collisions, 1);
    // Sink unchanged on collision.
    assertEquals(sinkB.size(), 1);
    assertEquals(sinkB.list()[0].kind, "vrdt");
});

Deno.test("bridge: bidirectional convergence after two HASH_LIST rounds", async () => {
    const { a, b, sinkA, sinkB } = makePair();
    a.helloPeer(0xBB);
    b.helloPeer(0xAA);
    sinkA.append("alrm", 0x10, null, T0);
    sinkA.append("alrm", 0x20, null, T0);
    sinkB.append("alrm", 0x30, null, T0);
    sinkB.append("alrm", 0x40, null, T0);

    // First round: B sends list → A ships {10,20} to B.
    b.broadcastHashList(0xAA, T0);
    // Second round: A sends list → B ships {30,40} to A
    // (now A's set is 10,20,30,40 already from B's second-round ship).
    a.broadcastHashList(0xBB, T0 + 100);

    // Both sinks now hold the union.
    assertEquals(
        sinkA.list().map((e) => e.event_hash).sort((x, y) => x - y),
        [0x10, 0x20, 0x30, 0x40],
    );
    assertEquals(
        sinkB.list().map((e) => e.event_hash).sort((x, y) => x - y),
        [0x10, 0x20, 0x30, 0x40],
    );
    // Anchors equal post-convergence.
    assertEquals(a.anchor(), b.anchor());
});

Deno.test("bridge: gates broadcastHashList on peer-known", async () => {
    const sink = new ForensicEventSink();
    const tx = new PairedTransport();
    const bridge = new WebRTCEventBridge(0xAA, sink, tx);
    // Peer 0xBB hasn't said HELLO and hasn't been seen via HASH_LIST.
    const ok = bridge.broadcastHashList(0xBB, T0);
    assertEquals(ok, false);
    assertEquals(tx.sent_log.length, 0);
});

Deno.test("bridge: HASH_LIST without prior HELLO still marks peer known", async () => {
    const sink = new ForensicEventSink();
    const tx = new PairedTransport();
    const bridge = new WebRTCEventBridge(0xAA, sink, tx);
    const list_msg: BridgeMessage = {
        kind: "HASH_LIST",
        from: 0xBB,
        list: {
            schema: "OMEGA-1310/v1",
            digests: [],
            digest_set_hash: 0,
            broadcast_at_ms: T0,
            // EventHashList type — actual field name is event_hashes.
            // Use `any` cast for the test fixture.
        } as any,
    };
    bridge.handleIncoming(list_msg, T0);
    // Schema check fails (event_sink_sync uses OMEGA-1390/v1).
    assertEquals(bridge.telemetry().schema_mismatches, 1);
});

Deno.test("bridge: telemetry counters increment correctly", async () => {
    const { a, b, sinkA, sinkB } = makePair();
    a.helloPeer(0xBB);
    b.helloPeer(0xAA);
    sinkA.append("alrm", 0x10, null, T0);
    b.broadcastHashList(0xAA, T0);
    const stats = b.telemetry();
    assertEquals(stats.hellos_sent, 1);
    assertEquals(stats.hellos_received, 1);
    assertEquals(stats.hash_lists_sent, 1);
    assertEquals(stats.deltas_received, 1);
    assertEquals(stats.deltas_applied, 1);
});

Deno.test("bridge: sendDelta gated on peer-known", async () => {
    const sink = new ForensicEventSink();
    const tx = new PairedTransport();
    const bridge = new WebRTCEventBridge(0xAA, sink, tx);
    sink.append("alrm", 0x42, null, T0);
    const ok = bridge.sendDelta(0xBB, sink.list(), T0);
    assertEquals(ok, false);
    assertEquals(tx.sent_log.length, 0);
});

Deno.test("bridge: anchor matches sink eventChainAnchor", async () => {
    const sink = new ForensicEventSink();
    const tx = new PairedTransport();
    const bridge = new WebRTCEventBridge(0xAA, sink, tx);
    sink.append("alrm", 0x10, null, T0);
    sink.append("alrm", 0x20, null, T0);
    assertEquals(bridge.anchor(), sink.eventChainAnchor());
});

Deno.test("schema constant", async () => {
    assertEquals(BRIDGE_SCHEMA, "OMEGA-1500/v1");
});
