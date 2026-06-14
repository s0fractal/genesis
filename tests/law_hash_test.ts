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

Deno.test("law hash — golden is the canonical 0x30a95260", () => {
  assertEquals(lawHashHex(OMEGA_LAW_HASH), "0x30a95260");
});

Deno.test("lawHashHex — formats as 0x + 8 lowercase hex", () => {
  assertEquals(lawHashHex(0), "0x00000000");
  assertEquals(lawHashHex(0xdeadbeef), "0xdeadbeef");
});
