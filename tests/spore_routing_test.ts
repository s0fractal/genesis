// Era 1130: Spore-to-spore routing cross-language tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    DEFAULT_TTL,
    FWD_DELIVER_LOCAL,
    FWD_DROP_NOT_FORWARDABLE,
    FWD_DROP_TTL_ZERO,
    FWD_FORWARD,
    decideForward,
    frameTtl,
    mixTrail,
    stampOrigin,
} from "../src/network/spore_routing.ts";
import {
    buildHeartbeat,
    buildWarrantVote,
    frameFromBytes,
    frameToBytes,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_LEGACY_V1_0 } from "../src/network/genesis_inscription.ts";

Deno.test("routing: ttl round-trip", async () => {
    const f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 0, true, 0), 7);
    assertEquals(frameTtl(f), 7);
});

Deno.test("routing: warrant_vote → DELIVER_LOCAL with TTL-1", async () => {
    const f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 0, true, 100), DEFAULT_TTL);
    const d = decideForward(f, 0xAAAA_AAAA >>> 0, GENESIS_HASH_LEGACY_V1_0);
    assertEquals(d.code, FWD_DELIVER_LOCAL);
    assertEquals(frameTtl(d.forwardedFrame), DEFAULT_TTL - 1);
    assert(d.forwardedFrame.payloadB !== 0);
});

Deno.test("routing: heartbeat forwards when genesis matches", async () => {
    const f = stampOrigin(buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1), DEFAULT_TTL);
    const d = decideForward(f, 0x1234_5678, GENESIS_HASH_LEGACY_V1_0);
    assertEquals(d.code, FWD_FORWARD);
});

Deno.test("routing: heartbeat dropped on genesis drift", async () => {
    const f = stampOrigin(buildHeartbeat(0xDEAD_BEEF >>> 0, 1), DEFAULT_TTL);
    const d = decideForward(f, 0x1234_5678, GENESIS_HASH_LEGACY_V1_0);
    assertEquals(d.code, FWD_DROP_NOT_FORWARDABLE);
});

Deno.test("routing: ttl=0 dropped", async () => {
    const f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 0, true, 0), 0);
    const d = decideForward(f, 0xAAAA, GENESIS_HASH_LEGACY_V1_0);
    assertEquals(d.code, FWD_DROP_TTL_ZERO);
});

Deno.test("routing: three-hop chain decrements TTL", async () => {
    let f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 0, true, 0), DEFAULT_TTL);
    for (const s of [0x1111_1111, 0x2222_2222, 0x3333_3333]) {
        const d = decideForward(f, s >>> 0, GENESIS_HASH_LEGACY_V1_0);
        assertEquals(d.code, FWD_DELIVER_LOCAL);
        f = d.forwardedFrame;
    }
    assertEquals(frameTtl(f), 1);
});

Deno.test("routing: TTL eventually reaches zero", async () => {
    let f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 0, true, 0), DEFAULT_TTL);
    let hops = 0;
    while (true) {
        const d = decideForward(f, (0x1000_0000 + hops) >>> 0, GENESIS_HASH_LEGACY_V1_0);
        if (d.code === FWD_DROP_TTL_ZERO) break;
        f = d.forwardedFrame;
        hops++;
        if (hops > 10) throw new Error("TTL never reached zero");
    }
    assertEquals(hops, DEFAULT_TTL);
});

Deno.test("routing: forwarded frame carries valid CRC", async () => {
    const f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 1, true, 50), DEFAULT_TTL);
    const d = decideForward(f, 0xBBBB_BBBB >>> 0, GENESIS_HASH_LEGACY_V1_0);
    const bytes = frameToBytes(d.forwardedFrame);
    const parsed = frameFromBytes(bytes);
    assert(parsed !== null, "forwarded frame must round-trip through CRC");
});

Deno.test("routing: trail mix is deterministic", async () => {
    assertEquals(
        mixTrail(0x1234_5678, 0xDEAD_BEEF),
        mixTrail(0x1234_5678, 0xDEAD_BEEF),
    );
});

Deno.test("routing: cross-language trail anchor", async () => {
    // Anchored against omega_v2/src/spore_routing.rs cross_lang test.
    assertEquals(mixTrail(0, 0x6B70_A8AB), 0x0c105977);
});

Deno.test("routing: unknown frame type rejected", async () => {
    const f = stampOrigin(buildWarrantVote(0xCAFE_BABE, 0, true, 0), DEFAULT_TTL);
    f.frameType = 99;
    const d = decideForward(f, 0xAAAA, GENESIS_HASH_LEGACY_V1_0);
    assertEquals(d.code, FWD_DROP_NOT_FORWARDABLE);
});
