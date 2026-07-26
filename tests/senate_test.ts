// Senate JS-side determinism + Era 1030 trigger logic.
import { assert, assertEquals } from "jsr:@std/assert";
import { sha256_u32 } from "../src/sdk/phi_crypto.ts";

// The canonical senate hash: SHA-256 (first 4 BE bytes) over the UTF-8
// description zero-padded to 64 bytes — byte-identical to Libp2pMesh.senateHash
// and to Rust omega_v2/src/senate.rs / tests/cross_lang_hash.rs. We replicate
// the padding here (importing libp2p_mesh would drag native WebRTC deps into
// the unit tier) but reuse the shared sha256_u32 primitive, exactly like the
// Rust cross-language test does. These constants are the ones baked into the
// v1.0 genesis anchors, so a drift here is a drift in the frozen identity.
function senateHash(description: string): number {
  const buf = new Uint8Array(64);
  buf.set(new TextEncoder().encode(description).subarray(0, 64));
  return sha256_u32(buf) >>> 0;
}

Deno.test("senate hash: empty 64-byte buffer matches the SHA-256 anchor", () => {
  // Cross-language anchor — omega_v2/tests/cross_lang_hash.rs asserts the same.
  assertEquals(senateHash(""), 0xF5A5_FD42);
});

Deno.test("senate hash: 'Era 1040 ZK' cross-language anchor", () => {
  assertEquals(senateHash("Era 1040 ZK"), 0x1530_2EC1);
});

Deno.test("senate hash: distinct descriptions produce distinct hashes", () => {
  const a = senateHash("Era 1040 zk");
  const b = senateHash("Era 1041 senate");
  assert(a !== b);
});

Deno.test("senate hash: descriptions diverging within the first 64 bytes differ", () => {
  const short = "x".repeat(60);
  const long = "x".repeat(60) + "DIFFERENT_TAIL_DROPPED_AFTER_64";
  // Both pad/truncate to a 64-byte buffer; they differ at byte 60.
  assert(senateHash(short) !== senateHash(long));
});

Deno.test("Era 1030 trigger requires 10+ entries AND 5+ unique matrices", () => {
  // Mirror of WebRTCV2Mesh.checkEra1030Trigger condition.
  function shouldUnlock(entries: number, uniqueMatrices: number): boolean {
    return entries >= 10 && uniqueMatrices >= 5;
  }
  assertEquals(shouldUnlock(9, 5), false);
  assertEquals(shouldUnlock(10, 4), false);
  assertEquals(shouldUnlock(10, 5), true);
  assertEquals(shouldUnlock(50, 8), true);
});

Deno.test("senate acceptance rule: 3+ AYE peers AND ayes > nays", () => {
  function shouldAccept(ayes: number, nays: number): boolean {
    return ayes >= 3 && ayes > nays;
  }
  assertEquals(shouldAccept(2, 0), false); // not enough ayes
  assertEquals(shouldAccept(3, 3), false); // tie
  assertEquals(shouldAccept(3, 2), true);
  assertEquals(shouldAccept(5, 4), true);
});
