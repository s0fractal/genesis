import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding/base64";
import {
  buildHeartbeat,
  frameFromBytes,
  frameToBytes,
  SPORE_FRAME_BYTES,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_LEGACY_V1_0 } from "../src/network/genesis_inscription.ts";

Deno.test("SporeBridge: Frame Base64 Serialization Parity", async () => {
  // 1. Generate a raw binary spore frame
  const originalFrame = buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 100);
  const bytes = frameToBytes(originalFrame);

  assertEquals(
    bytes.length,
    SPORE_FRAME_BYTES,
    "Frame must be exactly 32 bytes",
  );

  // 2. Encode to Base64 (this is what tools/spore_bridge.ts does)
  const base64 = encodeBase64(bytes);
  assertNotEquals(base64, "", "Base64 should not be empty");

  // 3. Decode back (this is what the receiving browser peer will do)
  const decodedBytes = decodeBase64(base64);
  assertEquals(decodedBytes.length, SPORE_FRAME_BYTES);

  // 4. Verify structural integrity
  const parsedFrame = frameFromBytes(decodedBytes);

  assertEquals(parsedFrame !== null, true, "Frame must decode successfully");
  if (parsedFrame) {
    assertEquals(parsedFrame.tick, 100, "Tick must survive base64 roundtrip");
    assertEquals(
      parsedFrame.proposalOrTarget,
      GENESIS_HASH_LEGACY_V1_0 >>> 0,
      "Genesis Hash must survive base64 roundtrip",
    );
  }
});
