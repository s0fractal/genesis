// Genesis Inscription (Open Protocol Stamping)

// When the mesh accumulates 100+ verified mitosis proofs, the lattice
// reaches the Era 1050 trigger and computes the GENESIS INSCRIPTION:
// a single 32-bit FNV-1a hash that captures EVERY non-negotiable invariant
// of the system in a deterministic, version-frozen order.

// This hash is the cryptographic identity of OMEGA-64 v1.0 — the value
// that gets inscribed into Bitcoin as an OP_RETURN payload, becoming the
// permanent on-chain anchor for the protocol.

// Once inscribed, the wire format is FROZEN. Future amendments require a
// new RFC (v2.0+) and a new Genesis Inscription. The v1.0 anchor remains
// valid forever as long as the constants below are unchanged.

// Determinism contract: this module's output MUST be reproducible
// bit-for-bit from any independent implementation given the same inputs.
// Cross-language anchor lives in `tests/genesis_inscription_test.ts`.

use crate::crypto::fnv1a_32;

/// OMEGA Protocol version identifier — frozen at v1.0.
pub const PROTOCOL_VERSION: &[u8] = b"OMEGA-64/RFC-001/v1.0";

/// The five non-negotiable invariants that any conforming implementation
/// must reproduce. These are the *hashes* of canonical inputs, not the
/// inputs themselves — that way the Genesis Inscription is small (5 × 4 =
/// 20 bytes) yet binds the entire test corpus.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C)]
pub struct GenesisAnchors {
    /// FNV-1a over 64 zero bytes. Validates the senate hash padding rule.
    pub senate_hash_empty: u32,
    /// FNV-1a("Era 1040 ZK" + zero-pad to 64). Cross-language ASCII anchor.
    pub senate_hash_short: u32,
    /// FNV-1a hash of the lattice's first autopoietic proposal description.
    pub first_proposal_hash: u32,
    /// child_receipt_hash for canonical parent + empty attractor field.
    pub mitosis_receipt_no_attr: u32,
    /// child_receipt_hash for canonical parent + dominant attractor.
    pub mitosis_receipt_attr: u32,
}

impl GenesisAnchors {
    /// The values frozen for OMEGA-64 v1.0. Any drift = different protocol.
    pub const V1_0: Self = Self {
        senate_hash_empty:        0xF5A5_FD42,
        senate_hash_short:        0x1530_2EC1,
        first_proposal_hash:      0x3008_3117,
        mitosis_receipt_no_attr:  0xF73D_B063,
        mitosis_receipt_attr:     0x8C3A_C082,
    };

    pub fn as_bytes(&self) -> [u8; 20] {
        let mut out = [0u8; 20];
        out[0..4].copy_from_slice(&self.senate_hash_empty.to_be_bytes());
        out[4..8].copy_from_slice(&self.senate_hash_short.to_be_bytes());
        out[8..12].copy_from_slice(&self.first_proposal_hash.to_be_bytes());
        out[12..16].copy_from_slice(&self.mitosis_receipt_no_attr.to_be_bytes());
        out[16..20].copy_from_slice(&self.mitosis_receipt_attr.to_be_bytes());
        out
    }
}

/// The dipole invariant constant: matrix XOR inverse must equal this value.
pub const DIPOLE_INVARIANT: u32 = 0xFFFF_FFFF;

/// The toroidal consensus modulus — phase byte wraps at 256.
pub const TOROIDAL_MODULUS: u32 = 256;

/// Compute the Genesis Inscription for OMEGA-64 v1.0.
///
/// The hash function is FNV-1a 32-bit over a deterministic byte sequence:
///
/// protocol_version_bytes
/// || anchor_bytes (20 big-endian bytes from GenesisAnchors)
/// || dipole_invariant (4 BE bytes)
/// || toroidal_modulus (4 BE bytes)
///
/// Total input: PROTOCOL_VERSION.len() + 28 bytes.
pub fn compute_genesis_hash(anchors: &GenesisAnchors) -> u32 {
    let anchor_bytes = anchors.as_bytes();
    let mut buf = [0u8; 64];
    let version_len = PROTOCOL_VERSION.len();
    let total_len = version_len + 28;
    assert!(total_len <= 64, "Genesis input must fit in 64 bytes");

    let mut i = 0;
    while i < version_len {
        buf[i] = PROTOCOL_VERSION[i];
        i += 1;
    }
    let mut j = 0;
    while j < 20 {
        buf[version_len + j] = anchor_bytes[j];
        j += 1;
    }
    let dipole_be = DIPOLE_INVARIANT.to_be_bytes();
    let toroidal_be = TOROIDAL_MODULUS.to_be_bytes();
    let mut k = 0;
    while k < 4 {
        buf[version_len + 20 + k] = dipole_be[k];
        buf[version_len + 24 + k] = toroidal_be[k];
        k += 1;
    }
    fnv1a_32(&buf[..total_len])
}

/// Compute the canonical SHA-256 Genesis Inscription for OMEGA-64 v1.0.
pub fn compute_genesis_hash_sha256(anchors: &GenesisAnchors) -> [u8; 32] {
    let anchor_bytes = anchors.as_bytes();
    let mut buf = [0u8; 64];
    let version_len = PROTOCOL_VERSION.len();
    let total_len = version_len + 28;

    let mut i = 0;
    while i < version_len {
        buf[i] = PROTOCOL_VERSION[i];
        i += 1;
    }
    let mut j = 0;
    while j < 20 {
        buf[version_len + j] = anchor_bytes[j];
        j += 1;
    }
    let dipole_be = DIPOLE_INVARIANT.to_be_bytes();
    let toroidal_be = TOROIDAL_MODULUS.to_be_bytes();
    let mut k = 0;
    while k < 4 {
        buf[version_len + 20 + k] = dipole_be[k];
        buf[version_len + 24 + k] = toroidal_be[k];
        k += 1;
    }
    crate::crypto::sha256_hash(&buf[..total_len])
}

/// The legacy FNV-1a Genesis Hash.
pub const GENESIS_HASH_LEGACY_V1_0: u32 = compute_genesis_hash_const();

const fn compute_genesis_hash_const() -> u32 {
    let anchors = GenesisAnchors::V1_0;
    // Reproduce compute_genesis_hash in const-eval friendly form.
    let anchor_bytes = [
        ((anchors.senate_hash_empty >> 24) & 0xFF) as u8,
        ((anchors.senate_hash_empty >> 16) & 0xFF) as u8,
        ((anchors.senate_hash_empty >> 8) & 0xFF) as u8,
        (anchors.senate_hash_empty & 0xFF) as u8,
        ((anchors.senate_hash_short >> 24) & 0xFF) as u8,
        ((anchors.senate_hash_short >> 16) & 0xFF) as u8,
        ((anchors.senate_hash_short >> 8) & 0xFF) as u8,
        (anchors.senate_hash_short & 0xFF) as u8,
        ((anchors.first_proposal_hash >> 24) & 0xFF) as u8,
        ((anchors.first_proposal_hash >> 16) & 0xFF) as u8,
        ((anchors.first_proposal_hash >> 8) & 0xFF) as u8,
        (anchors.first_proposal_hash & 0xFF) as u8,
        ((anchors.mitosis_receipt_no_attr >> 24) & 0xFF) as u8,
        ((anchors.mitosis_receipt_no_attr >> 16) & 0xFF) as u8,
        ((anchors.mitosis_receipt_no_attr >> 8) & 0xFF) as u8,
        (anchors.mitosis_receipt_no_attr & 0xFF) as u8,
        ((anchors.mitosis_receipt_attr >> 24) & 0xFF) as u8,
        ((anchors.mitosis_receipt_attr >> 16) & 0xFF) as u8,
        ((anchors.mitosis_receipt_attr >> 8) & 0xFF) as u8,
        (anchors.mitosis_receipt_attr & 0xFF) as u8,
    ];
    let version_len = PROTOCOL_VERSION.len();
    let total_len = version_len + 28;
    let mut buf = [0u8; 64];
    let mut i = 0;
    while i < version_len { buf[i] = PROTOCOL_VERSION[i]; i += 1; }
    let mut j = 0;
    while j < 20 { buf[version_len + j] = anchor_bytes[j]; j += 1; }
    let dipole_be = [0xFFu8, 0xFF, 0xFF, 0xFF];
    let toroidal_be = [0u8, 0, 1, 0];
    let mut k = 0;
    while k < 4 {
        buf[version_len + 20 + k] = dipole_be[k];
        buf[version_len + 24 + k] = toroidal_be[k];
        k += 1;
    }
    // Inline FNV-1a (const-eval).
    let mut hash: u32 = 0x811C_9DC5;
    let mut idx = 0;
    while idx < total_len {
        hash ^= buf[idx] as u32;
        hash = hash.wrapping_mul(0x0100_0193);
        idx += 1;
    }
    hash
}

/// Format the Genesis Hash as the canonical OP_RETURN payload string.
/// Length: 8 hex chars prefixed by "OMEGA1:" (15 ASCII bytes total).
pub fn format_inscription(hash: u32) -> [u8; 15] {
    let mut out = *b"OMEGA1:00000000";
    let hex = b"0123456789abcdef";
    out[7]  = hex[((hash >> 28) & 0xF) as usize];
    out[8]  = hex[((hash >> 24) & 0xF) as usize];
    out[9]  = hex[((hash >> 20) & 0xF) as usize];
    out[10] = hex[((hash >> 16) & 0xF) as usize];
    out[11] = hex[((hash >> 12) & 0xF) as usize];
    out[12] = hex[((hash >> 8) & 0xF) as usize];
    out[13] = hex[((hash >> 4) & 0xF) as usize];
    out[14] = hex[(hash & 0xF) as usize];
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anchors_v1_0_match_other_modules() {
        let a = GenesisAnchors::V1_0;
        // These values are duplicated by design — they MUST equal the constants
        // anchored in the cross-language tests:
        // omega_v2/tests/cross_lang_hash.rs (senate hashes)
        // omega_v2/tests/mitosis_anchor.rs   (mitosis receipts)
        // The first_proposal_hash matches what bootstrap/v2.ts auto-submits.
        assert_eq!(a.senate_hash_empty, 0xF5A5_FD42);
        assert_eq!(a.senate_hash_short, 0x1530_2EC1);
        assert_eq!(a.first_proposal_hash, 0x3008_3117);
        assert_eq!(a.mitosis_receipt_no_attr, 0xF73D_B063);
        assert_eq!(a.mitosis_receipt_attr, 0x8C3A_C082);
    }

    #[test]
    fn anchor_bytes_are_big_endian() {
        let a = GenesisAnchors {
            senate_hash_empty: 0x1122_3344,
            senate_hash_short: 0,
            first_proposal_hash: 0,
            mitosis_receipt_no_attr: 0,
            mitosis_receipt_attr: 0,
        };
        let bytes = a.as_bytes();
        assert_eq!(&bytes[0..4], &[0x11, 0x22, 0x33, 0x44]);
    }

    #[test]
    fn compute_runtime_and_const_agree() {
        let runtime = compute_genesis_hash(&GenesisAnchors::V1_0);
        assert_eq!(runtime, GENESIS_HASH_LEGACY_V1_0);
    }

    #[test]
    fn genesis_hash_is_stable() {
        // Two calls produce the same result.
        let h1 = compute_genesis_hash(&GenesisAnchors::V1_0);
        let h2 = compute_genesis_hash(&GenesisAnchors::V1_0);
        assert_eq!(h1, h2);
    }

    #[test]
    fn drifted_anchor_changes_hash() {
        let mut drifted = GenesisAnchors::V1_0;
        drifted.first_proposal_hash ^= 1;
        assert_ne!(compute_genesis_hash(&drifted), GENESIS_HASH_LEGACY_V1_0);
    }

    #[test]
    fn inscription_format_is_15_chars() {
        let hash = 0xDEADBEEFu32;
        let s = format_inscription(hash);
        assert_eq!(&s, b"OMEGA1:deadbeef");
    }

    #[test]
    fn inscription_round_trips_through_v1_genesis() {
        let s = format_inscription(GENESIS_HASH_LEGACY_V1_0);
        // Prefix must be present.
        assert_eq!(&s[..7], b"OMEGA1:");
        // Hex hash must round-trip.
        let hex_str = core::str::from_utf8(&s[7..]).unwrap();
        let parsed = u32::from_str_radix(hex_str, 16).unwrap();
        assert_eq!(parsed, GENESIS_HASH_LEGACY_V1_0);
    }

    #[test]
    fn protocol_version_string_is_canonical() {
        assert_eq!(PROTOCOL_VERSION, b"OMEGA-64/RFC-001/v1.0");
        assert_eq!(PROTOCOL_VERSION.len(), 21);
    }
}
