// Spore Frame cross-language tests.
import { assert, assertEquals } from "jsr:@std/assert";
import {
  buildHeartbeat,
  buildLawTelemetry,
  buildWarrantVote,
  findSync,
  FRAME_TYPE_HEARTBEAT,
  FRAME_TYPE_WARRANT_VOTE,
  frameFromBytes,
  frameToBytes,
  SPORE_FRAME_BYTES,
  SPORE_FRAME_MAGIC,
} from "../src/network/spore_frame.ts";

Deno.test("spore frame: round-trips a warrant vote bit-for-bit", async () => {
  const f = buildWarrantVote(0xCAFE_BABE >>> 0, 2, true, 100);
  const bytes = frameToBytes(f);
  assertEquals(bytes.length, SPORE_FRAME_BYTES);
  const parsed = frameFromBytes(bytes);
  assert(parsed !== null);
  assertEquals(parsed!.frameType, FRAME_TYPE_WARRANT_VOTE);
  assertEquals(parsed!.proposalOrTarget, 0xCAFE_BABE >>> 0);
  assertEquals(parsed!.oracleBit, 2);
  assertEquals(parsed!.payloadA, 1);
  assertEquals(parsed!.tick, 100);
});

Deno.test("spore frame: corrupted CRC is rejected", async () => {
  const f = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 0);
  const bytes = frameToBytes(f);
  bytes[31] ^= 0x55;
  assertEquals(frameFromBytes(bytes), null);
});

Deno.test("spore frame: corrupted payload is rejected", async () => {
  const f = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 0);
  const bytes = frameToBytes(f);
  bytes[5] ^= 0x01;
  assertEquals(frameFromBytes(bytes), null);
});

Deno.test("spore frame: wrong magic is rejected", async () => {
  const f = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 0);
  const bytes = frameToBytes(f);
  bytes[0] = 0xAA;
  assertEquals(frameFromBytes(bytes), null);
});

Deno.test("spore frame: heartbeat round-trips", async () => {
  const f = buildHeartbeat(0x716E_A2F8, 12345);
  const bytes = frameToBytes(f);
  const parsed = frameFromBytes(bytes);
  assert(parsed !== null);
  assertEquals(parsed!.frameType, FRAME_TYPE_HEARTBEAT);
  assertEquals(parsed!.proposalOrTarget, 0x716E_A2F8);
  assertEquals(parsed!.tick, 12345);
});

Deno.test("spore frame: findSync locates magic in a stream", async () => {
  const stream = new Uint8Array(50);
  stream.fill(0xAA);
  const f = buildWarrantVote(0xDEAD_BEEF >>> 0, 1, true, 0);
  const bytes = frameToBytes(f);
  stream.set(bytes, 7);
  assertEquals(findSync(stream), 7);
});

Deno.test("spore frame: findSync handles partial magic", async () => {
  assertEquals(findSync(new Uint8Array([0x4F, 0xAA, 0x4F, 0x46])), 2);
});

// Cross-language anchor: same inputs as omega_v2/src/spore_frame.rs's
// `cross_lang_anchor_warrant_vote` test. CRC must match Rust exactly.
Deno.test("spore frame: cross-language CRC anchor", async () => {
  const f = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 100);
  assertEquals(f.crc32, 0xdf382f50);
  // First 4 bytes also fixed.
  const bytes = frameToBytes(f);
  assertEquals(bytes[0], 0x4F);
  assertEquals(bytes[1], 0x46);
  assertEquals(bytes[2], FRAME_TYPE_WARRANT_VOTE);
  assertEquals(bytes[3], 0); // claude
});

Deno.test("spore frame: law telemetry round-trips", async () => {
  // 18 is FRAME_TYPE_LAW_TELEMETRY
  const f = buildLawTelemetry(1, 0xAAAA, 0xBBBB, 0xCCCC, 7, 42);
  const bytes = frameToBytes(f);
  const parsed = frameFromBytes(bytes);
  assert(parsed !== null);
  assertEquals(parsed!.frameType, 18);
  assertEquals(parsed!.oracleBit, 1);
  assertEquals(parsed!.proposalOrTarget, 0xAAAA);
  assertEquals(parsed!.payloadA, 0xBBBB);
  assertEquals(parsed!.payloadB, 0xCCCC);
  assertEquals(parsed!.payloadC, 7);
  assertEquals(parsed!.tick, 42);
});

Deno.test("spore frame: magic constant is 'OF'", async () => {
  assertEquals(SPORE_FRAME_MAGIC, 0x4F46);
  assertEquals(String.fromCharCode(0x4F, 0x46), "OF");
});
