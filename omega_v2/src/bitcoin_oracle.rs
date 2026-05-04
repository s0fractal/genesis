use sha2::{Digest, Sha256};

pub type BitcoinBlockHash = [u8; 32];

/// The hardcoded historic blocks that provide Temporal Binding for Genesis Era 0206.
pub const HISTORIC_BLOCKS: [(u32, &str); 6] = [
    (800000, "00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054"),
    (810000, "000000000000000000028028ca82b6aa81ce789e4eb9e0321b74c3cbaf405dd1"),
    (820000, "00000000000000000000ba232574c32b4f0cd023e133c05125310625626d6571"),
    (830000, "000000000000000000011d55599ed27d7efca05f5849b755319c89eb2cffbc1f"),
    (840000, "0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5"),
    (850000, "00000000000000000002a0b5db2a7f8d9087464c2586b546be7bce8eb53b8187"),
];

/// Helper to decode hex string into 32-byte array (since `no_std` doesn't have easy hex decoding)
const fn decode_hex_char(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => 0,
    }
}

const fn decode_hex_32(hex: &str) -> [u8; 32] {
    let bytes = hex.as_bytes();
    let mut out = [0u8; 32];
    let mut i = 0;
    while i < 32 {
        out[i] = (decode_hex_char(bytes[i * 2]) << 4) | decode_hex_char(bytes[i * 2 + 1]);
        i += 1;
    }
    out
}

pub struct BitcoinBlockOracle {
    pub block_hashes: [BitcoinBlockHash; 6],
    pub target_heights: [u32; 6],
}

impl BitcoinBlockOracle {
    pub const fn new() -> Self {
        let mut hashes = [[0u8; 32]; 6];
        let mut heights = [0u32; 6];
        let mut i = 0;
        while i < 6 {
            heights[i] = HISTORIC_BLOCKS[i].0;
            hashes[i] = decode_hex_32(HISTORIC_BLOCKS[i].1);
            i += 1;
        }
        Self {
            block_hashes: hashes,
            target_heights: heights,
        }
    }

    /// Obtains the Genesis Entropy by hashing the concatenation of the 6 historic Bitcoin block hashes.
    pub fn compute_genesis_entropy(&self) -> [u8; 32] {
        let mut hasher = Sha256::new();
        for hash in &self.block_hashes {
            hasher.update(hash);
        }
        hasher.finalize().into()
    }
}



/// Since lazy_static requires std or specialized no_std support which might be complex,
/// we can just expose a direct function. Actually, `no_std` lazy_static can be tricky.
/// Let's use a simple function to compute it on demand (it's fast enough for Big Bang).
pub fn get_genesis_entropy() -> [u8; 32] {
    let oracle = BitcoinBlockOracle::new();
    oracle.compute_genesis_entropy()
}
