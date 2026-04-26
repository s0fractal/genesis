// Era 1470: Hash-list request/response frame tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    HASH_LIST_WIRE_SCHEMA,
    buildHashRequestFrame,
    chunkHashListResponse,
    computeMissingFromPeer,
    reassembleHashListResponse,
} from "../src/network/event_hash_list_wire.ts";
import {
    FRAME_TYPE_EVENT_HASH_REQUEST,
    FRAME_TYPE_EVENT_HASH_RESPONSE,
    frameFromBytes,
    frameToBytes,
} from "../src/network/spore_frame.ts";

Deno.test("buildHashRequestFrame: round-trips through bytes", () => {
    const f = buildHashRequestFrame(0xCAFE_BABE, 42);
    const decoded = frameFromBytes(frameToBytes(f));
    assert(decoded !== null);
    assertEquals(decoded!.frameType, FRAME_TYPE_EVENT_HASH_REQUEST);
    assertEquals(decoded!.proposalOrTarget >>> 0, 0xCAFE_BABE);
    assertEquals(decoded!.tick >>> 0, 42);
});

Deno.test("chunkHashListResponse: 1 chunk for ≤4 hashes", () => {
    const frames = chunkHashListResponse([0x10, 0x20, 0x30], 99);
    assertEquals(frames.length, 1);
    assertEquals((frames[0].reserved >>> 24) & 0xFF, 1); // seq
    assertEquals((frames[0].reserved >>> 16) & 0xFF, 1); // total
    assertEquals((frames[0].reserved >>> 8) & 0xFF, 3);  // valid
    assertEquals(frames[0].proposalOrTarget, 0x10);
    assertEquals(frames[0].payloadA, 0x20);
    assertEquals(frames[0].payloadB, 0x30);
    assertEquals(frames[0].payloadC, 0); // unused slot zeroed
});

Deno.test("chunkHashListResponse: spans multiple chunks for >4 hashes", () => {
    const frames = chunkHashListResponse([0x10, 0x20, 0x30, 0x40, 0x50, 0x60], 7);
    assertEquals(frames.length, 2);
    assertEquals((frames[0].reserved >>> 16) & 0xFF, 2); // total
    assertEquals((frames[1].reserved >>> 24) & 0xFF, 2); // seq
    assertEquals((frames[1].reserved >>> 8) & 0xFF, 2);  // valid (only 2 hashes in second chunk)
});

Deno.test("chunkHashListResponse: empty list still produces one chunk", () => {
    const frames = chunkHashListResponse([], 1);
    assertEquals(frames.length, 1);
    assertEquals((frames[0].reserved >>> 8) & 0xFF, 0); // valid = 0
});

Deno.test("chunkHashListResponse: deterministic ordering (sorts input)", () => {
    const a = chunkHashListResponse([0x30, 0x10, 0x20], 0);
    const b = chunkHashListResponse([0x10, 0x20, 0x30], 0);
    assertEquals(a[0].crc32, b[0].crc32);
});

Deno.test("chunkHashListResponse: rejects oversized lists", () => {
    const tooMany = new Array(1024).fill(0).map((_, i) => i + 1);
    assertThrows(() => chunkHashListResponse(tooMany, 0));
});

Deno.test("chunkHashListResponse: each frame's CRC validates", () => {
    const frames = chunkHashListResponse([0x10, 0x20, 0x30, 0x40, 0x50], 1);
    for (const f of frames) {
        const decoded = frameFromBytes(frameToBytes(f));
        assert(decoded !== null);
        assertEquals(decoded!.frameType, FRAME_TYPE_EVENT_HASH_RESPONSE);
    }
});

Deno.test("reassembleHashListResponse: roundtrip over all frames", () => {
    const original = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70];
    const frames = chunkHashListResponse(original, 99);
    const result = reassembleHashListResponse(frames);
    assert(result.ok, result.error);
    assertEquals(result.hashes, original);
});

Deno.test("reassembleHashListResponse: empty roundtrip", () => {
    const frames = chunkHashListResponse([], 1);
    const result = reassembleHashListResponse(frames);
    assert(result.ok);
    assertEquals(result.hashes, []);
});

Deno.test("reassembleHashListResponse: out-of-order chunks reassemble", () => {
    const frames = chunkHashListResponse([0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70], 1);
    const reversed = [...frames].reverse();
    const result = reassembleHashListResponse(reversed);
    assert(result.ok);
    assertEquals(result.hashes, [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70]);
});

Deno.test("reassembleHashListResponse: missing chunk detected", () => {
    const frames = chunkHashListResponse([0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90], 1);
    // Drop the second chunk.
    const dropped = frames.filter((f, i) => i !== 1);
    const result = reassembleHashListResponse(dropped);
    assertEquals(result.ok, false);
    assertEquals(result.missing_chunks, [2]);
});

Deno.test("reassembleHashListResponse: idempotent on duplicates", () => {
    const frames = chunkHashListResponse([0x10, 0x20, 0x30], 1);
    const doubled = [...frames, ...frames];
    const result = reassembleHashListResponse(doubled);
    assert(result.ok);
    assertEquals(result.hashes, [0x10, 0x20, 0x30]);
});

Deno.test("reassembleHashListResponse: rejects conflicting chunk at same seq", () => {
    const frames = chunkHashListResponse([0x10, 0x20], 1);
    const tampered = { ...frames[0], proposalOrTarget: 0xDEAD };
    const result = reassembleHashListResponse([...frames, tampered]);
    assertEquals(result.ok, false);
    assert(result.error!.includes("conflicting"));
});

Deno.test("reassembleHashListResponse: expected_request_id filters foreign chunks", () => {
    const a = chunkHashListResponse([0x10, 0x20], 100);
    const b = chunkHashListResponse([0xAA, 0xBB], 200);
    const result = reassembleHashListResponse([...a, ...b], 100);
    assert(result.ok);
    assertEquals(result.hashes, [0x10, 0x20]);
});

Deno.test("reassembleHashListResponse: cross-request rejected without filter", () => {
    const a = chunkHashListResponse([0x10], 100);
    const b = chunkHashListResponse([0xAA], 200);
    const result = reassembleHashListResponse([...a, ...b]);
    assertEquals(result.ok, false);
    assert(result.error!.includes("cross-request"));
});

// --- Set-difference helper ---

Deno.test("computeMissingFromPeer: returns entries the peer lacks", () => {
    const local = [
        { event_hash: 0x10 },
        { event_hash: 0x20 },
        { event_hash: 0x30 },
    ];
    const peer = [0x10, 0x40];
    const missing = computeMissingFromPeer(local, peer);
    assertEquals(missing.map((e) => e.event_hash), [0x20, 0x30]);
});

Deno.test("computeMissingFromPeer: peer superset → empty result", () => {
    const local = [{ event_hash: 0x10 }];
    const peer = [0x10, 0x20, 0x30];
    assertEquals(computeMissingFromPeer(local, peer).length, 0);
});

// --- Frame type registry ---

Deno.test("frame types: HASH_REQUEST=11, HASH_RESPONSE=12", () => {
    assertEquals(FRAME_TYPE_EVENT_HASH_REQUEST, 11);
    assertEquals(FRAME_TYPE_EVENT_HASH_RESPONSE, 12);
});

Deno.test("schema constant", () => {
    assertEquals(HASH_LIST_WIRE_SCHEMA, "OMEGA-1470/v1");
});
