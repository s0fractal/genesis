// 🌌 OMEGA-64: Era 1110 — Spore Frame (Senate Plasmid Bridge over Serial)
//
// A 32-byte fixed-width binary frame format for UART/SPI/BLE transport
// between bare-metal spores and their relay nodes. No JSON parsing, no
// allocator, no variable-length fields — just `[u8; 32]` that any
// microcontroller can DMA into a ring buffer and validate with a single
// FNV-1a pass.
//
// FRAME LAYOUT (32 bytes, big-endian where multi-byte):
//
//   offset  size  field
//   ─────────────────────────────────────────────────────────────────
//        0     2  magic        = 0xΩΦ (literally 0x4F46 = 'OF', "OMEGA-Φ")
//        2     1  frame_type   (1=warrant_vote, 2=halo_state,
//                               3=heartbeat, 4=quorum_query)
//        3     1  oracle_bit   (0..4 for canonical oracles, or 0xFF for
//                               non-oracle peer)
//        4     4  proposal_or_target_hash  (BE)
//        8     4  payload_a    (BE; type-specific)
//       12     4  payload_b    (BE; type-specific)
//       16     4  payload_c    (BE; type-specific)
//       20     4  tick         (BE)
//       24     4  reserved     (zero)
//       28     4  crc32        (FNV-1a over bytes 0..28, BE)
//
// FNV-1a is reused as the CRC because (a) we already have it in `senate.rs`
// (b) it's keyed by domain separators in upper layers, so reusing it here
// just gives us a frame integrity check, not collision resistance.
//
// Magic is the first 16 bits so a spore that wakes up mid-stream can
// resync by scanning for the bytes 0x4F 0x46.

use crate::senate::fnv1a_32;

pub const SPORE_FRAME_BYTES: usize = 32;
pub const SPORE_FRAME_MAGIC: u16 = 0x4F46; // 'OF'

pub const FRAME_TYPE_WARRANT_VOTE: u8 = 1;
pub const FRAME_TYPE_HALO_STATE: u8 = 2;
pub const FRAME_TYPE_HEARTBEAT: u8 = 3;
pub const FRAME_TYPE_QUORUM_QUERY: u8 = 4;
/// Era 1200: compact resilience digest (relay's headline stats).
/// Layout in SporeFrame payload slots:
///   proposal_or_target = relay_id (FNV-1a of relay name)
///   payload_a          = total_intents
///   payload_b          = double_witness
///   payload_c          = redundancy_rate_q16
///   tick               = relay's tick at emission
pub const FRAME_TYPE_SNAPSHOT_DIGEST: u8 = 5;

/// One UART/SPI/BLE frame. `repr(C)` so we can transmute between bytes
/// and the typed view without copying.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, align(4))]
pub struct SporeFrame {
    pub magic: u16,
    pub frame_type: u8,
    pub oracle_bit: u8,
    pub proposal_or_target: u32,
    pub payload_a: u32,
    pub payload_b: u32,
    pub payload_c: u32,
    pub tick: u32,
    pub _reserved: u32,
    pub crc32: u32,
}

impl SporeFrame {
    pub const fn empty() -> Self {
        Self {
            magic: SPORE_FRAME_MAGIC,
            frame_type: 0,
            oracle_bit: 0xFF,
            proposal_or_target: 0,
            payload_a: 0,
            payload_b: 0,
            payload_c: 0,
            tick: 0,
            _reserved: 0,
            crc32: 0,
        }
    }

    /// Build a WARRANT_VOTE frame. The kernel-side handler will route this
    /// to `warrant_issuance::vote(proposal_hash, oracle_bit, aye)`.
    pub fn warrant_vote(
        proposal_hash: u32,
        oracle_bit: u8,
        aye: bool,
        tick: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_WARRANT_VOTE;
        f.oracle_bit = oracle_bit;
        f.proposal_or_target = proposal_hash;
        f.payload_a = if aye { 1 } else { 0 };
        f.tick = tick;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build a HEARTBEAT frame — periodic liveness signal.
    pub fn heartbeat(genesis_hash: u32, tick: u32) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_HEARTBEAT;
        f.proposal_or_target = genesis_hash;
        f.tick = tick;
        f.crc32 = f.compute_crc();
        f
    }

    /// Era 1200: Build a SNAPSHOT_DIGEST frame carrying a relay's
    /// headline resilience stats. Compact alternative to the
    /// 32-byte ResilienceSnapshot — fits within SporeFrame so it
    /// rides the same transport as warrants/heartbeats.
    pub fn snapshot_digest(
        relay_id: u32,
        total_intents: u32,
        double_witness: u32,
        redundancy_rate_q16: u32,
        tick: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_SNAPSHOT_DIGEST;
        f.proposal_or_target = relay_id;
        f.payload_a = total_intents;
        f.payload_b = double_witness;
        f.payload_c = redundancy_rate_q16;
        f.tick = tick;
        f.crc32 = f.compute_crc();
        f
    }

    /// Compute the CRC over bytes 0..28 (everything except the CRC slot).
    pub fn compute_crc(&self) -> u32 {
        let bytes = self.as_bytes();
        fnv1a_32(&bytes[..28])
    }

    /// Returns true iff `self.crc32` matches the recomputed CRC.
    pub fn is_valid(&self) -> bool {
        self.magic == SPORE_FRAME_MAGIC && self.crc32 == self.compute_crc()
    }

    /// Serialize to 32 bytes in big-endian field order.
    pub fn as_bytes(&self) -> [u8; SPORE_FRAME_BYTES] {
        let mut out = [0u8; SPORE_FRAME_BYTES];
        out[0..2].copy_from_slice(&self.magic.to_be_bytes());
        out[2] = self.frame_type;
        out[3] = self.oracle_bit;
        out[4..8].copy_from_slice(&self.proposal_or_target.to_be_bytes());
        out[8..12].copy_from_slice(&self.payload_a.to_be_bytes());
        out[12..16].copy_from_slice(&self.payload_b.to_be_bytes());
        out[16..20].copy_from_slice(&self.payload_c.to_be_bytes());
        out[20..24].copy_from_slice(&self.tick.to_be_bytes());
        out[24..28].copy_from_slice(&self._reserved.to_be_bytes());
        out[28..32].copy_from_slice(&self.crc32.to_be_bytes());
        out
    }

    /// Parse from 32 bytes. Returns `None` if magic or CRC don't match.
    /// Frame is rejected silently — never panics, even on garbage input.
    pub fn from_bytes(buf: &[u8; SPORE_FRAME_BYTES]) -> Option<Self> {
        let f = Self {
            magic: u16::from_be_bytes([buf[0], buf[1]]),
            frame_type: buf[2],
            oracle_bit: buf[3],
            proposal_or_target: u32::from_be_bytes([buf[4], buf[5], buf[6], buf[7]]),
            payload_a: u32::from_be_bytes([buf[8], buf[9], buf[10], buf[11]]),
            payload_b: u32::from_be_bytes([buf[12], buf[13], buf[14], buf[15]]),
            payload_c: u32::from_be_bytes([buf[16], buf[17], buf[18], buf[19]]),
            tick: u32::from_be_bytes([buf[20], buf[21], buf[22], buf[23]]),
            _reserved: u32::from_be_bytes([buf[24], buf[25], buf[26], buf[27]]),
            crc32: u32::from_be_bytes([buf[28], buf[29], buf[30], buf[31]]),
        };
        if f.is_valid() {
            Some(f)
        } else {
            None
        }
    }

    /// Find the start of a frame in a streaming buffer by scanning for
    /// the magic bytes. Returns the offset where the magic was found, or
    /// `None` if the buffer doesn't contain it.
    pub fn find_sync(buf: &[u8]) -> Option<usize> {
        if buf.len() < 2 {
            return None;
        }
        let mut i = 0;
        while i + 1 < buf.len() {
            if buf[i] == 0x4F && buf[i + 1] == 0x46 {
                return Some(i);
            }
            i += 1;
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_is_exactly_32_bytes() {
        assert_eq!(core::mem::size_of::<SporeFrame>(), SPORE_FRAME_BYTES);
    }

    #[test]
    fn warrant_vote_round_trips() {
        let frame = SporeFrame::warrant_vote(0xCAFE_BABE, 2, true, 100);
        let bytes = frame.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid frame");
        assert_eq!(parsed, frame);
        assert_eq!(parsed.frame_type, FRAME_TYPE_WARRANT_VOTE);
        assert_eq!(parsed.proposal_or_target, 0xCAFE_BABE);
        assert_eq!(parsed.oracle_bit, 2);
        assert_eq!(parsed.payload_a, 1); // aye = true
        assert_eq!(parsed.tick, 100);
    }

    #[test]
    fn corrupted_crc_rejected() {
        let frame = SporeFrame::warrant_vote(0xCAFE_BABE, 0, true, 0);
        let mut bytes = frame.as_bytes();
        bytes[31] ^= 0x55; // flip a bit in the CRC
        assert!(SporeFrame::from_bytes(&bytes).is_none());
    }

    #[test]
    fn corrupted_payload_rejected() {
        let frame = SporeFrame::warrant_vote(0xCAFE_BABE, 0, true, 0);
        let mut bytes = frame.as_bytes();
        bytes[5] ^= 0x01; // flip a bit in proposal_hash
        assert!(SporeFrame::from_bytes(&bytes).is_none());
    }

    #[test]
    fn wrong_magic_rejected() {
        let frame = SporeFrame::warrant_vote(0xCAFE_BABE, 0, true, 0);
        let mut bytes = frame.as_bytes();
        bytes[0] = 0xAA;
        assert!(SporeFrame::from_bytes(&bytes).is_none());
    }

    #[test]
    fn heartbeat_round_trips() {
        let frame = SporeFrame::heartbeat(0x549A_6307, 12345);
        let bytes = frame.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid heartbeat");
        assert_eq!(parsed.frame_type, FRAME_TYPE_HEARTBEAT);
        assert_eq!(parsed.proposal_or_target, 0x549A_6307);
        assert_eq!(parsed.tick, 12345);
    }

    #[test]
    fn find_sync_locates_magic() {
        let mut stream = [0xAAu8; 50];
        // Embed a frame at offset 7.
        let frame = SporeFrame::warrant_vote(0xDEAD_BEEF, 1, true, 0);
        let bytes = frame.as_bytes();
        stream[7..7 + SPORE_FRAME_BYTES].copy_from_slice(&bytes);
        assert_eq!(SporeFrame::find_sync(&stream), Some(7));
    }

    #[test]
    fn find_sync_none_on_empty() {
        assert_eq!(SporeFrame::find_sync(&[]), None);
        assert_eq!(SporeFrame::find_sync(&[0x4F]), None);
    }

    #[test]
    fn find_sync_skips_partial_magic() {
        let buf = [0x4F, 0xAA, 0x4F, 0x46];
        assert_eq!(SporeFrame::find_sync(&buf), Some(2));
    }

    #[test]
    fn cross_lang_anchor_warrant_vote() {
        // Frozen test vector for the JS bridge.
        let f = SporeFrame::warrant_vote(0xCAFE_BABE, 0, true, 100);
        // Anchor: serialized first 4 bytes are magic + type + oracle_bit.
        let bytes = f.as_bytes();
        assert_eq!(bytes[0], 0x4F);
        assert_eq!(bytes[1], 0x46);
        assert_eq!(bytes[2], 1); // FRAME_TYPE_WARRANT_VOTE
        assert_eq!(bytes[3], 0); // claude
        // Anchor on the CRC.
        eprintln!("rust crc = 0x{:08x}", f.crc32);
        assert_eq!(f.crc32, 0x00F2_FEFA);
    }
}
