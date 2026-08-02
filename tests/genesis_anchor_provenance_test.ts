// Genesis anchor provenance (TS mirror of omega_v2/tests/genesis_anchor_provenance.rs).
//
// Recomputes all five v1.0 anchors from FROZEN INPUTS — fixed strings and fixed
// child field values — and checks they equal the frozen `ANCHORS_V1_0` and hash
// to the frozen genesis identity 0x716EA2F8. Unlike genesis_cross_lang_lock_test
// (which compares TS literals to Rust literals), this recomputes, so a drift in
// the hash primitive or a typo in a constant is caught on the TS side too.
//
// The mitosis anchors are pinned to the child fields the kernel derived at
// freeze (commit e8b685e); the live kernel now derives a different child
// (physics evolved) — that is expected, see the Rust test's header.

import { assertEquals } from "jsr:@std/assert";
import { sha256_u32 } from "../src/sdk/phi_crypto.ts";
import {
  ANCHORS_V1_0,
  computeGenesisHash,
  GENESIS_HASH_LEGACY_V1_0,
} from "../src/network/genesis_inscription.ts";

function pad64(s: string): Uint8Array {
  const raw = new TextEncoder().encode(s);
  const buf = new Uint8Array(64);
  buf.set(raw.subarray(0, 64));
  return buf;
}

// sha256_u32 over the canonical 32-byte little-endian agent layout.
function receiptU32(
  phase: number,
  energy: number,
  baseFreq: number,
  stateFlags: number,
  genome: number,
  m0: number,
  m1: number,
  m2: number,
): number {
  const b = new Uint8Array(32);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, phase >>> 0, true);
  dv.setUint32(4, energy >>> 0, true);
  dv.setUint32(8, baseFreq >>> 0, true);
  dv.setUint32(12, stateFlags >>> 0, true);
  dv.setUint32(16, genome >>> 0, true);
  dv.setUint32(20, m0 >>> 0, true);
  dv.setUint32(24, m1 >>> 0, true);
  dv.setUint32(28, m2 >>> 0, true);
  return sha256_u32(b) >>> 0;
}

Deno.test("genesis: all five anchors recompute from frozen inputs", () => {
  const senateHashEmpty = sha256_u32(pad64("")) >>> 0;
  const senateHashShort = sha256_u32(pad64("Era 1040 ZK")) >>> 0;
  const firstProposalHash =
    sha256_u32(pad64("Task 0090: Era 1040 - ZK-Notarized Mutations")) >>> 0;
  // Frozen anchor children (fields as derived by the kernel at e8b685e).
  const mitosisReceiptNoAttr = receiptU32(
    128,
    1000,
    7,
    180,
    3549459802,
    0xDEADBEEF,
    1,
    2,
  );
  const mitosisReceiptAttr = receiptU32(
    128,
    1000,
    7,
    16777468,
    1630780158,
    0xABCD0040,
    1,
    2,
  );

  assertEquals(senateHashEmpty, 0xF5A5_FD42);
  assertEquals(senateHashShort, 0x1530_2EC1);
  assertEquals(firstProposalHash, 0x3008_3117);
  assertEquals(mitosisReceiptNoAttr, 0xF73D_B063);
  assertEquals(mitosisReceiptAttr, 0x8C3A_C082);

  // The frozen struct MUST equal what we recomputed.
  assertEquals(ANCHORS_V1_0.senateHashEmpty >>> 0, senateHashEmpty);
  assertEquals(ANCHORS_V1_0.senateHashShort >>> 0, senateHashShort);
  assertEquals(ANCHORS_V1_0.firstProposalHash >>> 0, firstProposalHash);
  assertEquals(ANCHORS_V1_0.mitosisReceiptNoAttr >>> 0, mitosisReceiptNoAttr);
  assertEquals(ANCHORS_V1_0.mitosisReceiptAttr >>> 0, mitosisReceiptAttr);

  // ...and hash to the frozen v1.0 genesis identity.
  assertEquals(computeGenesisHash(ANCHORS_V1_0) >>> 0, 0x716E_A2F8);
  assertEquals(GENESIS_HASH_LEGACY_V1_0 >>> 0, 0x716E_A2F8);
});
