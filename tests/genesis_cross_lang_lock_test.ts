// Cross-language drift lock for the Genesis Inscription.
//
// This test exists because of a real incident: on 2026-05-04 commit e8b685e
// ("Refactor Translation Policy recursion") changed the five frozen anchors
// in `omega_v2/src/genesis_inscription.rs`, silently moving the Rust-computed
// genesis hash from 0x549a6307 to 0x716ea2f8 — while the TS mirror kept the
// old anchors and the old hash. Every test stayed green on both sides for
// ~3 months because each suite only compared a language against ITSELF.
//
// The lock: parse the frozen V1_0 anchor constants directly out of the Rust
// source and assert the TS mirror matches them, and that both agree on the
// computed hash. If you are changing the anchors, you are changing the
// protocol identity — this test is supposed to fail LOUDLY. Update it only
// as a deliberate, documented act (see the history note in
// src/network/genesis_inscription.ts).
import { assertEquals } from "jsr:@std/assert";
import {
  ANCHORS_V1_0,
  computeGenesisHash,
  GENESIS_HASH_LEGACY_V1_0,
} from "../src/network/genesis_inscription.ts";

const RUST_SOURCE_URL = new URL(
  "../omega_v2/src/genesis_inscription.rs",
  import.meta.url,
);

/** Extract `field: 0xXXXX_XXXX,` values from the `pub const V1_0` block. */
async function readRustAnchors(): Promise<Record<string, number>> {
  const src = await Deno.readTextFile(RUST_SOURCE_URL);
  const block = src.match(/pub const V1_0: Self = Self \{([\s\S]*?)\};/);
  assertEquals(
    block !== null,
    true,
    "V1_0 anchor block not found in Rust source",
  );
  const out: Record<string, number> = {};
  const re = /(\w+):\s*0x([0-9A-Fa-f]{4})_([0-9A-Fa-f]{4})/g;
  let m;
  while ((m = re.exec(block![1])) !== null) {
    out[m[1]] = parseInt(m[2] + m[3], 16);
  }
  return out;
}

Deno.test("genesis lock: TS anchors match the Rust V1_0 constants byte-for-byte", async () => {
  const rust = await readRustAnchors();
  assertEquals(ANCHORS_V1_0.senateHashEmpty, rust.senate_hash_empty);
  assertEquals(ANCHORS_V1_0.senateHashShort, rust.senate_hash_short);
  assertEquals(ANCHORS_V1_0.firstProposalHash, rust.first_proposal_hash);
  assertEquals(ANCHORS_V1_0.mitosisReceiptNoAttr, rust.mitosis_receipt_no_attr);
  assertEquals(ANCHORS_V1_0.mitosisReceiptAttr, rust.mitosis_receipt_attr);
});

Deno.test("genesis lock: both languages agree on the one canonical hash", async () => {
  // The Rust side pins the same anchors in
  // `omega_v2/src/genesis_inscription.rs::tests::anchors_v1_0_match_other_modules`
  // and prints this hash via `cargo test -p omega_v2 --test genesis_print`.
  assertEquals(computeGenesisHash(ANCHORS_V1_0), GENESIS_HASH_LEGACY_V1_0);
  assertEquals(GENESIS_HASH_LEGACY_V1_0, 0x716E_A2F8);
});
