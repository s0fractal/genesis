// Era 1510: Mesh event bridge adapter tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    MESH_BRIDGE_SCHEMA,
    MeshBridgeTransport,
    decodeMeshPayload,
    eventSyncPlasmidFields,
} from "../src/network/mesh_event_bridge.ts";
import { ForensicEventSink } from "../src/network/forensic_event_sink.ts";
import {
    BridgeMessage,
    WebRTCEventBridge,
} from "../src/network/webrtc_event_bridge.ts";

const T0 = 1_000_000;

Deno.test("MeshBridgeTransport: forwards messages to emit callback", () => {
    let captured_target: number | null = null;
    let captured_body: string | null = null;
    const emit = (peer: number, body: string) => {
        captured_target = peer;
        captured_body = body;
        return true;
    };
    const tx = new MeshBridgeTransport(emit);
    const ok = tx.send(0xBB, {
        kind: "PEER_HELLO",
        schema: "OMEGA-1500/v1",
        peer_id: 0xAA,
    });
    assert(ok);
    assertEquals(tx.sent_count, 1);
    assertEquals(captured_target, 0xBB);
    assert(captured_body !== null);
    const decoded = decodeMeshPayload(captured_body!);
    assertEquals(decoded?.kind, "PEER_HELLO");
});

Deno.test("MeshBridgeTransport: emit-failure propagates", () => {
    const tx = new MeshBridgeTransport(() => false);
    const ok = tx.send(0xBB, {
        kind: "PEER_HELLO",
        schema: "OMEGA-1500/v1",
        peer_id: 0xAA,
    });
    assertEquals(ok, false);
    assertEquals(tx.sent_count, 0);
});

Deno.test("decodeMeshPayload: parses HELLO/HASH_LIST/DELTA shapes", () => {
    const hello = JSON.stringify({
        kind: "PEER_HELLO",
        schema: "OMEGA-1500/v1",
        peer_id: 0xCC,
    });
    const list = JSON.stringify({
        kind: "HASH_LIST",
        from: 0xCC,
        list: { schema: "OMEGA-1390/v1", event_hashes: [], hash_set_anchor: 0, broadcast_at_ms: 0 },
    });
    const delta = JSON.stringify({
        kind: "DELTA",
        from: 0xCC,
        delta: {
            schema: "OMEGA-1390/v1",
            initiator_anchor: 0,
            missing_entries: [],
            peer_missing_hashes: [],
            delta_hash: 0,
            replied_at_ms: 0,
        },
    });
    assertEquals(decodeMeshPayload(hello)?.kind, "PEER_HELLO");
    assertEquals(decodeMeshPayload(list)?.kind, "HASH_LIST");
    assertEquals(decodeMeshPayload(delta)?.kind, "DELTA");
});

Deno.test("decodeMeshPayload: rejects unknown kind", () => {
    const bad = JSON.stringify({ kind: "FUTURE", from: 0 });
    assertEquals(decodeMeshPayload(bad), null);
});

Deno.test("decodeMeshPayload: rejects malformed JSON", () => {
    assertEquals(decodeMeshPayload("not json"), null);
    assertEquals(decodeMeshPayload(""), null);
    assertEquals(decodeMeshPayload("[]"), null);
});

Deno.test("decodeMeshPayload: rejects object without kind", () => {
    assertEquals(decodeMeshPayload(JSON.stringify({ from: 0xAA })), null);
});

Deno.test("eventSyncPlasmidFields: produces target + body fields", () => {
    const fields = eventSyncPlasmidFields(0xBB, {
        kind: "PEER_HELLO",
        schema: "OMEGA-1500/v1",
        peer_id: 0xAA,
    });
    assertEquals(fields.eventSyncTarget, 0xBB);
    const decoded = JSON.parse(fields.eventSyncBody);
    assertEquals(decoded.kind, "PEER_HELLO");
    assertEquals(decoded.peer_id, 0xAA);
});

Deno.test("end-to-end: two bridges connected by MeshBridgeTransport", () => {
    // Simulate the mesh: emit on A's transport calls B's
    // bridge.handleIncoming, and vice versa.
    let bridgeB: WebRTCEventBridge;
    const sinkA = new ForensicEventSink();
    const sinkB = new ForensicEventSink();
    const txA = new MeshBridgeTransport((target, body) => {
        if (target !== 0xBB) return false;
        const msg = decodeMeshPayload(body);
        if (msg) bridgeB.handleIncoming(msg, T0);
        return true;
    });
    const bridgeA = new WebRTCEventBridge(0xAA, sinkA, txA);
    const txB = new MeshBridgeTransport((target, body) => {
        if (target !== 0xAA) return false;
        const msg = decodeMeshPayload(body);
        if (msg) bridgeA.handleIncoming(msg, T0);
        return true;
    });
    bridgeB = new WebRTCEventBridge(0xBB, sinkB, txB);

    bridgeA.helloPeer(0xBB);
    bridgeB.helloPeer(0xAA);
    sinkA.append("alrm", 0x10, null, T0);
    sinkA.append("alrm", 0x20, null, T0);
    sinkB.append("alrm", 0x30, null, T0);

    // B announces its hash list → A automatically ships {10, 20}.
    bridgeB.broadcastHashList(0xAA, T0);
    assertEquals(sinkB.size(), 3);

    // Symmetric: A announces → B ships {30}.
    bridgeA.broadcastHashList(0xBB, T0 + 100);
    assertEquals(sinkA.size(), 3);
    assertEquals(bridgeA.anchor(), bridgeB.anchor());
});

Deno.test("schema constant", () => {
    assertEquals(MESH_BRIDGE_SCHEMA, "OMEGA-1510/v1");
});
