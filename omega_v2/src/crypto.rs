use sha2::{Sha256, Digest};

/// Computes the full 256-bit SHA-256 hash of the input data.
/// Used for robust off-chain anchors (e.g., Genesis Inscription).
pub fn sha256_hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

/// Computes the SHA-256 hash of the input data and truncates it to the first 4 bytes (u32).
/// Used for derived on-chain / lattice identities that must fit within
/// tight memory constraints (e.g., Oracle Dipoles, Codeicide Warrants).
pub fn sha256_u32(data: &[u8]) -> u32 {
    let full_hash = sha256_hash(data);
    u32::from_be_bytes([full_hash[0], full_hash[1], full_hash[2], full_hash[3]])
}
