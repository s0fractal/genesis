// cross-language anchor for the Genesis Inscription.
// JS computeGenesisHash MUST produce the same value the Rust kernel
// computes (omega_v2/src/genesis_inscription.rs).
import { assertEquals } from "jsr:@std/assert";
import {
    ANCHORS_V1_0,
    computeGenesisHash,
    formatInscription,
    GENESIS_HASH_LEGACY_V1_0,
    PROTOCOL_VERSION,
    verifyGenesisV1,
} from "../src/network/genesis_inscription.ts";

Deno.test("genesis: v1.0 anchors match the cryptographic constants", async () => {
    assertEquals(ANCHORS_V1_0.senateHashEmpty, 0xDFDE_6AC5);
    assertEquals(ANCHORS_V1_0.senateHashShort, 0x7698_B8EF);
    assertEquals(ANCHORS_V1_0.firstProposalHash, 0xFAA7_FF6E);
    assertEquals(ANCHORS_V1_0.mitosisReceiptNoAttr, 0xD434_E690);
    assertEquals(ANCHORS_V1_0.mitosisReceiptAttr, 0x3B88_1A47);
});

Deno.test("genesis: v1.0 hash matches the Rust source-of-truth", async () => {
    assertEquals(computeGenesisHash(ANCHORS_V1_0), GENESIS_HASH_LEGACY_V1_0);
    assertEquals(GENESIS_HASH_LEGACY_V1_0, 0x549A_6307);
});

Deno.test("genesis: verifyGenesisV1 succeeds in this environment", async () => {
    assertEquals(verifyGenesisV1(), true);
});

Deno.test("genesis: any anchor drift produces a different hash", async () => {
    const drifted = { ...ANCHORS_V1_0, firstProposalHash: 0xFAA7_FF6F };
    const h = computeGenesisHash(drifted);
    assertEquals(h !== GENESIS_HASH_LEGACY_V1_0, true);
});

Deno.test("genesis: OP_RETURN inscription format is canonical", async () => {
    assertEquals(formatInscription(GENESIS_HASH_LEGACY_V1_0), "OMEGA1:549a6307");
    assertEquals(formatInscription(0xDEADBEEF), "OMEGA1:deadbeef");
    assertEquals(formatInscription(0).length, 15);
});

Deno.test("genesis: protocol version string is frozen", async () => {
    assertEquals(PROTOCOL_VERSION, "OMEGA-64/RFC-001/v1.0");
});
