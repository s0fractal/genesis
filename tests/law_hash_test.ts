// omega/tests/law_hash_test.ts — deno↔Rust parity for the law hash.
// If this fails alongside Rust `test_canonical_law_hash_golden`, a physical law
// constant or the canonical topology changed and both goldens need a bump. If
// only THIS fails, the deno mirror drifted from the Rust kernel — fix the mirror.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeLawHash,
  lawHashHex,
  OMEGA_LAW_HASH,
} from "../src/shared/law_hash.ts";

Deno.test("law hash — deno computation matches the pinned golden (Rust parity)", async () => {
  assertEquals(await computeLawHash(), OMEGA_LAW_HASH);
});

Deno.test("law hash — golden is the canonical Era-971 value", () => {
  // Moved to Era 964 on 2026-08-07: crystallisation now compares against the
  // mean of an agent's own living neighbours rather than the population-wide
  // p90, removing the only term in the physics computed over the whole lattice.
  // Moved from 0x30a95260 (Era 960) on 2026-08-06. That value was published to
  // the federation and cross-witnessed by trinity's Substrate Court while seven
  // changes to the physical operator had already landed underneath it: the
  // preimage covered five constants and the topology, and none of the laws that
  // actually changed. A node still reporting 0x30a95260 is running the closed
  // world that goes extinct at tick 86 and must not be read as agreeing with
  // this one.
  assertEquals(lawHashHex(OMEGA_LAW_HASH), "0x18eed5a2");
});

Deno.test("lawHashHex — formats as 0x + 8 lowercase hex", () => {
  assertEquals(lawHashHex(0), "0x00000000");
  assertEquals(lawHashHex(0xdeadbeef), "0xdeadbeef");
});
