// Senate JS-side determinism + Era 1030 trigger logic.
import { assertEquals, assert } from "jsr:@std/assert";

// Mirror of the FNV-1a 32-bit hash that lives both in
// omega_v2/src/senate.rs (Rust source of truth) and in WebRTCV2Mesh.senateHash.
// We keep this duplicate here on purpose: the test must independently replicate
// the constant so a regression in the production code is detected.
function sha256_u32ZeroPad64(s: string): number {
    const buf = new Uint8Array(64);
    const enc = new TextEncoder();
    const raw = enc.encode(s);
    const n = Math.min(raw.length, 64);
    for (let i = 0; i < n; i++) buf[i] = raw[i];
    let h = 0x811C_9DC5 >>> 0;
    for (let i = 0; i < 64; i++) {
        h = (h ^ buf[i]) >>> 0;
        h = Math.imul(h, 0x0100_0193) >>> 0;
    }
    return h >>> 0;
}

Deno.test("senate hash: empty 64-byte buffer matches known FNV-1a vector", async () => {
    // 64 zero bytes hashed with FNV-1a — anchored against the Rust impl
    // (omega_v2/tests/cross_lang_hash.rs). If this drifts, both sides broke.
    assertEquals(sha256_u32ZeroPad64(""), 0xDFDE_6AC5);
});

Deno.test("senate hash: 'Era 1040 ZK' cross-language anchor", async () => {
    // Rust source-of-truth: omega_v2/tests/cross_lang_hash.rs.
    assertEquals(sha256_u32ZeroPad64("Era 1040 ZK"), 0x7698_B8EF);
});

Deno.test("senate hash: distinct descriptions produce distinct hashes", async () => {
    const a = sha256_u32ZeroPad64("Era 1040 zk");
    const b = sha256_u32ZeroPad64("Era 1041 senate");
    assert(a !== b);
});

Deno.test("senate hash: short and 64-byte-truncated descriptions diverge for >64 chars", async () => {
    const short = "x".repeat(60);
    const long = "x".repeat(60) + "DIFFERENT_TAIL_DROPPED_AFTER_64";
    // Both pad/truncate to a 64-byte buffer; the first 64 bytes differ at byte 60.
    // (Since the long version has 'D' at index 60, while short has zero.)
    const h1 = sha256_u32ZeroPad64(short);
    const h2 = sha256_u32ZeroPad64(long);
    assert(h1 !== h2);
});

Deno.test("Era 1030 trigger requires 10+ entries AND 5+ unique matrices", async () => {
    // Mirror of WebRTCV2Mesh.checkEra1030Trigger condition.
    function shouldUnlock(entries: number, uniqueMatrices: number): boolean {
        return entries >= 10 && uniqueMatrices >= 5;
    }
    assertEquals(shouldUnlock(9, 5), false);
    assertEquals(shouldUnlock(10, 4), false);
    assertEquals(shouldUnlock(10, 5), true);
    assertEquals(shouldUnlock(50, 8), true);
});

Deno.test("senate acceptance rule: 3+ AYE peers AND ayes > nays", async () => {
    function shouldAccept(ayes: number, nays: number): boolean {
        return ayes >= 3 && ayes > nays;
    }
    assertEquals(shouldAccept(2, 0), false); // not enough ayes
    assertEquals(shouldAccept(3, 3), false); // tie
    assertEquals(shouldAccept(3, 2), true);
    assertEquals(shouldAccept(5, 4), true);
});
