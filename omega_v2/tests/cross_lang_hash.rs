// Era 1030: Cross-language Senate hash determinism.
//
// These tests anchor the FNV-1a 32-bit hash over a 64-byte zero-padded buffer
// so the Rust source-of-truth and the TypeScript mirror in
// `WebRTCV2Mesh.senateHash` (and tests/senate_test.ts) cannot drift apart.
//
// If you change the hash algorithm or the padding rule, update both sides in
// lockstep AND re-anchor these constants.

use omega_v2::crypto::sha256_u32;
use omega_v2::senate::Proposal;

fn pad_and_hash(s: &str) -> u32 {
    let mut buf = [0u8; 64];
    let bytes = s.as_bytes();
    let n = if bytes.len() < 64 { bytes.len() } else { 64 };
    buf[..n].copy_from_slice(&bytes[..n]);
    sha256_u32(&buf)
}

#[test]
fn cross_lang_hash_empty_64_zero_bytes() {
    // 64 zero bytes hashed with FNV-1a, matching the JS implementation
    // (TextEncoder, 64-byte zero pad, Math.imul 32-bit unsigned multiply).
    let h = pad_and_hash("");
    assert_eq!(h, 0xF5A5_FD42);
}

#[test]
fn cross_lang_hash_short_ascii() {
    // Pure ASCII, well under 64 bytes — no UTF-8 multi-byte ambiguity, no line
    // continuation escapes. This is the canonical cross-language anchor for
    // future regressions.
    let h = pad_and_hash("Era 1040 ZK");
    assert_eq!(h, 0x1530_2EC1);
}

#[test]
fn proposal_carries_hash_correctly() {
    let desc = b"Era 1040 zk";
    let p = Proposal::new(desc, 0xCAFE_BABE);
    let mut buf = [0u8; 64];
    buf[..desc.len()].copy_from_slice(desc);
    assert_eq!(p.hash, omega_v2::senate::sha256_hash(&buf));
}
