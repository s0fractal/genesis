// A proposal's identity IS its description. These lock that relationship so a
// text edit can never silently orphan the code that votes on it.
//
// The bug this prevents: `bootstrap/v2.ts` held the Era-1040 description and
// `libp2p_mesh.ts` held its hash as the literal 0x5507_4120, 900 lines apart.
// Fix a typo in the description and auto-ratification stops finding the
// proposal — no error, no log, just a loop that never closes again.

import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  senateHash,
  ZK_NOTARIZATION_PROPOSAL,
  ZK_NOTARIZATION_PROPOSAL_HASH,
} from "../src/network/senate_proposals.ts";

Deno.test("the Era-1040 key is DERIVED from its text and matches the frozen anchor", () => {
  // If this fails you changed the proposal's TEXT, which changes its IDENTITY.
  // That is a governance act: an already-open proposal keyed by the old hash
  // becomes unreachable. Update ZK_NOTARIZATION_PROPOSAL_HASH deliberately, in the
  // same change, and say so in the commit.
  assertEquals(
    senateHash(ZK_NOTARIZATION_PROPOSAL),
    ZK_NOTARIZATION_PROPOSAL_HASH,
  );
  assertEquals(ZK_NOTARIZATION_PROPOSAL_HASH, 0x5507_4120);
});

Deno.test("senateHash reproduces the genesis senate anchors", () => {
  // Cross-language anchors: Rust omega_v2/tests/cross_lang_hash.rs asserts the
  // same two values. Both must move together or neither moves.
  assertEquals(senateHash(""), 0xF5A5_FD42);
  assertEquals(senateHash("Era 1040 ZK"), 0x1530_2EC1);
});

Deno.test("senateHash zero-pads to 64 bytes and truncates beyond it", () => {
  // Padding: a short description and the same description trailed by NULs are
  // the same proposal, because both occupy the same 64-byte buffer.
  assertEquals(senateHash("abc"), senateHash("abc\0\0"));
  // Truncation: bytes past 64 do not participate, so two proposals sharing a
  // 64-byte prefix collide. Documented rather than fixed — the 64-byte frame is
  // the wire format — but it means proposal texts must differ EARLY.
  const prefix = "x".repeat(64);
  assertEquals(senateHash(prefix + "alpha"), senateHash(prefix + "omega"));
});

Deno.test("distinct short descriptions produce distinct keys", () => {
  assertNotEquals(senateHash("Era 1040 zk"), senateHash("Era 1041 senate"));
  assertNotEquals(senateHash(ZK_NOTARIZATION_PROPOSAL), senateHash(""));
  // And the Era-1040 key is NOT the genesis first_proposal_hash anchor, which
  // hashes a different canonical string.
  assertNotEquals(ZK_NOTARIZATION_PROPOSAL_HASH, 0x3008_3117);
});
