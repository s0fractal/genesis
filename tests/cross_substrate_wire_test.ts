// Era 1440: Cross-substrate wire-byte interop tests.
//
// These bytes are pinned in `omega_v2/src/cross_substrate_wire.rs`'s
// `LOCKED_ENVELOPE_BYTES`. Any drift here means either side's wire
// format silently changed.

import { assertEquals, assert } from "jsr:@std/assert";
import { ForensicEventSink } from "../src/network/forensic_event_sink.ts";
import {
    applyEventDelta,
    buildEventHashList,
    computeEventDelta,
} from "../src/network/event_sink_sync.ts";
import {
    chunkEventDelta,
    reassembleEventDelta,
} from "../src/network/event_sink_wire.ts";
import { frameFromBytes, frameToBytes } from "../src/network/spore_frame.ts";

const LOCKED_ENVELOPE_BYTES = new Uint8Array([
    0x4f, 0x46, 0x0a, 0x42, 0x92, 0x99, 0x32, 0xb5, 0x81, 0x1c, 0x9d, 0xc5, 0x00, 0x00, 0x00, 0xc8,
    0x00, 0x00, 0x00, 0x00, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x00, 0x00, 0x03, 0x87, 0x62, 0xfc, 0x6e,
    0x4f, 0x46, 0x0a, 0x42, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x72, 0x6d,
    0x4f, 0xb7, 0xae, 0x4f, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x01, 0x00, 0x03, 0xa1, 0x63, 0x46, 0x13,
    0x4f, 0x46, 0x0a, 0x42, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x72, 0x6d,
    0x77, 0xff, 0xab, 0x89, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x02, 0x00, 0x03, 0x8e, 0xe3, 0x14, 0x71,
    0x4f, 0x46, 0x0a, 0x42, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x72, 0x6d,
    0x03, 0x4e, 0x30, 0x0b, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x03, 0x00, 0x03, 0x1b, 0x34, 0x07, 0x80,
]);

const LOCKED_ENVELOPE_HASH = 0x9299_32B5 >>> 0;

Deno.test("cross-substrate: JS emit produces the locked byte sequence", async () => {
    const a = new ForensicEventSink();
    const b = new ForensicEventSink();
    b.append("alrm", 0x10, null, 100);
    b.append("alrm", 0x20, null, 100);
    b.append("alrm", 0x30, null, 100);
    const list = buildEventHashList(a, 100);
    const delta = computeEventDelta(list, b.list(), 200);
    const frames = chunkEventDelta(delta, 0x42);
    const bytes = new Uint8Array(frames.length * 32);
    for (let i = 0; i < frames.length; i++) {
        bytes.set(frameToBytes(frames[i]), i * 32);
    }
    assertEquals(bytes.length, 128);
    assertEquals(bytes, LOCKED_ENVELOPE_BYTES);
});

Deno.test("cross-substrate: locked bytes reassemble through JS path", async () => {
    const frames = [];
    for (let i = 0; i < LOCKED_ENVELOPE_BYTES.length; i += 32) {
        const f = frameFromBytes(LOCKED_ENVELOPE_BYTES.subarray(i, i + 32));
        assert(f !== null, `frame ${i / 32} parse failed`);
        frames.push(f!);
    }
    const result = reassembleEventDelta(frames);
    assert(result.ok, result.error);
    assertEquals(result.delta!.delta_hash >>> 0, LOCKED_ENVELOPE_HASH);
    assertEquals(result.delta!.missing_entries.length, 3);
});

Deno.test("cross-substrate: applied locked envelope yields locked anchor", async () => {
    const frames = [];
    for (let i = 0; i < LOCKED_ENVELOPE_BYTES.length; i += 32) {
        frames.push(frameFromBytes(LOCKED_ENVELOPE_BYTES.subarray(i, i + 32))!);
    }
    const result = reassembleEventDelta(frames);
    assert(result.ok);
    const sink = new ForensicEventSink();
    const outcome = applyEventDelta(sink, result.delta!, 999);
    assert(outcome.ok);
    assertEquals(sink.eventChainAnchor() >>> 0, LOCKED_ENVELOPE_HASH);
    assertEquals(sink.size(), 3);
});

Deno.test("cross-substrate: tampered byte breaks parse on JS side too", async () => {
    const tampered = new Uint8Array(LOCKED_ENVELOPE_BYTES);
    tampered[40] ^= 0x55; // matches Rust test
    // The frame containing this byte fails CRC; frameFromBytes returns null.
    const f = frameFromBytes(tampered.subarray(32, 64));
    assertEquals(f, null);
});

Deno.test("cross-substrate: locked envelope size + hash constants match Rust", async () => {
    assertEquals(LOCKED_ENVELOPE_BYTES.length, 128); // 4 frames × 32 bytes
    assertEquals(LOCKED_ENVELOPE_HASH, 0x9299_32B5);
});
