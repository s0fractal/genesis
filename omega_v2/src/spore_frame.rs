// Spore Frame (Senate Plasmid Bridge over Serial)

// A 32-byte fixed-width binary frame format for UART/SPI/BLE transport
// between bare-metal spores and their relay nodes. No JSON parsing, no
// allocator, no variable-length fields — just `[u8; 32]` that any
// microcontroller can DMA into a ring buffer and validate with a single
// FNV-1a pass.

// FRAME LAYOUT (32 bytes, big-endian where multi-byte):

// offset  size  field
// ─────────────────────────────────────────────────────────────────
// 0     2  magic        = 0xΩΦ (literally 0x4F46 = 'OF', "OMEGA-Φ")
// 2     1  frame_type   (1=warrant_vote, 2=halo_state,
// 3=heartbeat, 4=quorum_query)
// 3     1  oracle_bit   (0..4 for canonical oracles, or 0xFF for
// non-oracle peer)
// 4     4  proposal_or_target_hash  (BE)
// 8     4  payload_a    (BE; type-specific)
// 12     4  payload_b    (BE; type-specific)
// 16     4  payload_c    (BE; type-specific)
// 20     4  tick         (BE)
// 24     4  reserved     (zero)
// 28     4  crc32        (FNV-1a over bytes 0..28, BE)

// FNV-1a is reused as the CRC because (a) we already have it in `senate.rs`
// (b) it's keyed by domain separators in upper layers, so reusing it here
// just gives us a frame integrity check, not collision resistance.

// Magic is the first 16 bits so a spore that wakes up mid-stream can
// resync by scanning for the bytes 0x4F 0x46.

use crate::crypto::sha256_u32;

pub const SPORE_FRAME_BYTES: usize = 32;
pub const SPORE_FRAME_MAGIC: u16 = 0x4F46; // 'OF'

pub const FRAME_TYPE_WARRANT_VOTE: u8 = 1;
pub const FRAME_TYPE_HALO_STATE: u8 = 2;
pub const FRAME_TYPE_HEARTBEAT: u8 = 3;
pub const FRAME_TYPE_QUORUM_QUERY: u8 = 4;
/// compact resilience digest (relay's headline stats).
/// Layout in SporeFrame payload slots:
/// proposal_or_target = relay_id (FNV-1a of relay name)
/// payload_a          = total_intents
/// payload_b          = double_witness
/// payload_c          = redundancy_rate_q16
/// tick               = relay's tick at emission
pub const FRAME_TYPE_SNAPSHOT_DIGEST: u8 = 5;
/// composite mesh health broadcast.
/// Layout in SporeFrame payload slots:
/// proposal_or_target = relay_id
/// payload_a          = composite_score_q16 (0..65536)
/// payload_b          = (band & 0xFF) | (alarm_count << 8) | (suspect_count << 16) | (quarantine_count << 24)
/// payload_c          = redundancy_contribution_q16
/// tick               = relay's tick at emission
pub const FRAME_TYPE_COMPOSITE_HEALTH: u8 = 6;
/// post-mortem quorum verdict broadcast.
/// Layout in SporeFrame payload slots:
/// proposal_or_target = quorum_digest (FNV-1a over the verdict's input/output set)
/// payload_a          = source_relay_id (originator of the live alarm)
/// payload_b          = (verdict_code & 0xFF) | (relay_count << 8) | (overlap_pct << 16)
/// verdict_code: 0=corroborated, 1=uncorroborated, 2=insufficient-relays, 3=empty-window
/// overlap_pct: rounded 0..100
/// payload_c          = (replayed_q16_clamped_u16 << 16) | (diff_q16_clamped_u16 & 0xFFFF)
/// Lossy summary; primary identifier is the digest.
/// tick               = window_end_ms truncated to low u32
pub const FRAME_TYPE_QUORUM_VERDICT: u8 = 7;
/// Era 1320 (JS-only on this substrate): chunked archive delta envelope.
pub const FRAME_TYPE_DELTA_CHUNK: u8 = 8;
/// forensic-event hash list announcement.
/// Layout in SporeFrame payload slots:
/// proposal_or_target = sender_relay_id
/// payload_a          = hash_set_anchor (FNV-1a over sorted event_hash set)
/// payload_b          = total_hashes (count of event_hashes the sender holds)
/// payload_c          = sequence_total packed (this_seq u16 << 16 | total_chunks u16)
/// tick               = broadcast_at_ms low32
/// reserved           = first event_hash in this chunk (for first chunk only;
/// subsequent chunks pack hashes elsewhere)
pub const FRAME_TYPE_EVENT_HASH_LIST: u8 = 9;
/// forensic-event delta chunk.
/// Layout in SporeFrame payload slots (per record-chunk):
/// proposal_or_target = event_hash (the entry's content address)
/// payload_a          = sender_relay_id
/// payload_b          = packed kind-tag (4 ASCII chars truncated)
/// payload_c          = chain_hash (informational; receiver re-derives on apply)
/// tick               = envelope_hash (= delta_hash, ties chunks)
/// reserved           = sequence u16 << 16 | total u16 (sequence 0 = header)
pub const FRAME_TYPE_EVENT_DELTA_CHUNK: u8 = 10;
/// hash-list request — asks a peer to send its full event_hash set.
/// Layout:
/// proposal_or_target = sender_relay_id
/// tick               = request_id (any nonce; echoed back in response)
/// payload_a/b/c, reserved = 0
pub const FRAME_TYPE_EVENT_HASH_REQUEST: u8 = 11;
/// hash-list response chunk — up to 4 event_hashes per frame.
/// Layout:
/// proposal_or_target = hash[0]
/// payload_a          = hash[1]
/// payload_b          = hash[2]
/// payload_c          = hash[3]
/// tick               = request_id (echoed from REQUEST.tick)
/// reserved           = (seq u8 << 24) | (total u8 << 16) | (valid u8 << 8) | 0
/// seq, total are 1-based; valid is the count of
/// live u32 slots in this frame (1..4).
pub const FRAME_TYPE_EVENT_HASH_RESPONSE: u8 = 12;
pub const FRAME_TYPE_V2_SYNC: u8 = 13;
/// Silicon to Mycelium — BLE Mesh physical broadcast frame.
pub const FRAME_TYPE_BLE_MESH_BROADCAST: u8 = 14;
/// Silicon to Mycelium — LoRa Long Range physical broadcast frame.
pub const FRAME_TYPE_LORA_LONG_RANGE: u8 = 15;
/// Zero-Copy Binary Plasmids
pub const FRAME_TYPE_ATTRACTOR: u8 = 16;
pub const FRAME_TYPE_PROPOSAL: u8 = 17;
/// Commutative LawHash Telemetry.
/// Layout in SporeFrame payload slots:
/// proposal_or_target = law_hash (truncated digest of physical constants)
/// payload_a          = pre_state_hash (FNV-1a or SHA-256 of active agents before tick)
/// payload_b          = post_state_hash (after tick)
/// payload_c          = entropy_delta (total_entropy_released diff)
/// tick               = tick
/// oracle_bit         = witness_kind (0=Rust, 1=WGSL, 2=SP1, 3=Spore)
pub const FRAME_TYPE_LAW_TELEMETRY: u8 = 18;

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

    /// Build a LAW_TELEMETRY frame broadcasting the results of a physical tick.
    pub fn law_telemetry(
        witness_kind: u8,
        law_hash: u32,
        pre_state_hash: u32,
        post_state_hash: u32,
        entropy_delta: u32,
        tick: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_LAW_TELEMETRY;
        f.oracle_bit = witness_kind;
        f.proposal_or_target = law_hash;
        f.payload_a = pre_state_hash;
        f.payload_b = post_state_hash;
        f.payload_c = entropy_delta;
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

    /// Build a SNAPSHOT_DIGEST frame carrying a relay's
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

    /// Build a COMPOSITE_HEALTH frame carrying a relay's
    /// one-glance health composite. Counts are u8-clamped (255 max).
    pub fn composite_health(
        relay_id: u32,
        composite_score_q16: u32,
        band_code: u8,
        alarm_count: u8,
        suspect_count: u8,
        quarantine_count: u8,
        redundancy_contribution_q16: u32,
        tick: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_COMPOSITE_HEALTH;
        f.proposal_or_target = relay_id;
        f.payload_a = composite_score_q16;
        f.payload_b = (band_code as u32)
            | ((alarm_count as u32) << 8)
            | ((suspect_count as u32) << 16)
            | ((quarantine_count as u32) << 24);
        f.payload_c = redundancy_contribution_q16;
        f.tick = tick;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build a QUORUM_VERDICT frame carrying a forensic
    /// adjudication digest. The digest is the primary identifier; the
    /// supplementary fields (verdict_code, relay_count, overlap_pct,
    /// replayed_q16, diff_q16) are operator-readable summary data.
    pub fn quorum_verdict(
        quorum_digest: u32,
        source_relay_id: u32,
        verdict_code: u8,
        relay_count: u8,
        overlap_pct: u8,
        replayed_q16: u32,
        diff_q16: u32,
        window_end_ms_low32: u32,
    ) -> Self {
        let r16 = if replayed_q16 > 0xFFFF { 0xFFFFu32 } else { replayed_q16 };
        let d16 = if diff_q16 > 0xFFFF { 0xFFFFu32 } else { diff_q16 };
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_QUORUM_VERDICT;
        f.proposal_or_target = quorum_digest;
        f.payload_a = source_relay_id;
        f.payload_b = (verdict_code as u32)
            | ((relay_count as u32) << 8)
            | ((overlap_pct as u32) << 16);
        f.payload_c = (r16 << 16) | (d16 & 0xFFFF);
        f.tick = window_end_ms_low32;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build an EVENT_HASH_LIST frame announcing the
    /// spore's known event_hash set anchor. Layout:
    /// proposal_or_target = sender_relay_id
    /// payload_a          = hash_set_anchor (FNV-1a over sorted set)
    /// payload_b          = total_hashes
    /// payload_c          = sequence_total packed (this_seq << 16 | total)
    /// tick               = broadcast_at_ms low32
    pub fn event_hash_list(
        sender_relay_id: u32,
        hash_set_anchor: u32,
        total_hashes: u32,
        seq: u16,
        total: u16,
        broadcast_at_ms: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_EVENT_HASH_LIST;
        f.proposal_or_target = sender_relay_id;
        f.payload_a = hash_set_anchor;
        f.payload_b = total_hashes;
        f.payload_c = ((seq as u32) << 16) | (total as u32);
        f.tick = broadcast_at_ms;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build an EVENT_DELTA_CHUNK header frame
    /// (sequence=0). Layout:
    /// proposal_or_target = envelope_hash (= delta_hash)
    /// payload_a          = initiator_anchor
    /// payload_b          = replied_at_ms low32
    /// payload_c          = peer_missing_count
    /// tick               = envelope_hash
    /// reserved           = (0 << 16) | total
    pub fn event_delta_chunk_header(
        sender_relay_id: u8,
        envelope_hash: u32,
        initiator_anchor: u32,
        replied_at_ms: u32,
        peer_missing_count: u32,
        total: u16,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_EVENT_DELTA_CHUNK;
        f.oracle_bit = sender_relay_id;
        f.proposal_or_target = envelope_hash;
        f.payload_a = initiator_anchor;
        f.payload_b = replied_at_ms;
        f.payload_c = peer_missing_count;
        f.tick = envelope_hash;
        f._reserved = total as u32;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build an EVENT_DELTA_CHUNK record frame
    /// (sequence > 0). Layout:
    /// proposal_or_target = event_hash
    /// payload_a          = 0 (sender shared via header.oracle_bit)
    /// payload_b          = packed kind tag (4 ASCII chars)
    /// payload_c          = chain_hash (informational)
    /// tick               = envelope_hash
    /// reserved           = (seq << 16) | total
    pub fn event_delta_chunk_record(
        sender_relay_id: u8,
        envelope_hash: u32,
        event_hash: u32,
        kind_tag: u32,
        chain_hash: u32,
        seq: u16,
        total: u16,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_EVENT_DELTA_CHUNK;
        f.oracle_bit = sender_relay_id;
        f.proposal_or_target = event_hash;
        f.payload_a = 0;
        f.payload_b = kind_tag;
        f.payload_c = chain_hash;
        f.tick = envelope_hash;
        f._reserved = ((seq as u32) << 16) | (total as u32);
        f.crc32 = f.compute_crc();
        f
    }

    /// Build a HASH_REQUEST frame asking a peer for its
    /// full event_hash list. `request_id` is any nonce the
    /// initiator picks (typically a tick or counter); the peer
    /// echoes it back in the response so concurrent requests
    /// don't collide.
    pub fn event_hash_request(
        sender_relay_id: u32,
        request_id: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_EVENT_HASH_REQUEST;
        f.proposal_or_target = sender_relay_id;
        f.tick = request_id;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build a HASH_RESPONSE chunk carrying up to 4 hashes.
    pub fn event_hash_response(
        request_id: u32,
        seq: u8,
        total: u8,
        valid: u8,
        hashes: &[u32; 4],
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_EVENT_HASH_RESPONSE;
        f.proposal_or_target = hashes[0];
        f.payload_a = hashes[1];
        f.payload_b = hashes[2];
        f.payload_c = hashes[3];
        f.tick = request_id;
        f._reserved =
            ((seq as u32) << 24) | ((total as u32) << 16) | ((valid as u32) << 8);
        f.crc32 = f.compute_crc();
        f
    }

    /// Build a BLE_MESH_BROADCAST frame.
    pub fn ble_mesh_broadcast(
        sender_id: u32,
        target_id: u32,
        payload_hash: u32,
        tick: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_BLE_MESH_BROADCAST;
        f.proposal_or_target = target_id;
        f.payload_a = sender_id;
        f.payload_b = payload_hash;
        f.tick = tick;
        f.crc32 = f.compute_crc();
        f
    }

    /// Build a LORA_LONG_RANGE frame.
    pub fn lora_long_range(
        sender_id: u32,
        target_id: u32,
        payload_hash: u32,
        tick: u32,
    ) -> Self {
        let mut f = Self::empty();
        f.frame_type = FRAME_TYPE_LORA_LONG_RANGE;
        f.proposal_or_target = target_id;
        f.payload_a = sender_id;
        f.payload_b = payload_hash;
        f.tick = tick;
        f.crc32 = f.compute_crc();
        f
    }

    /// Pack a kind string (up to 4 ASCII chars) into a u32.
    /// Mirrors JS `packKindTag` byte-for-byte. Truncates longer
    /// strings; pads shorter ones with zeros (in the LSBs).
    #[allow(clippy::needless_range_loop)]
    pub fn pack_kind_tag(kind: &[u8]) -> u32 {
        let mut v: u32 = 0;
        let n = if kind.len() > 4 { 4 } else { kind.len() };
        for i in 0..4 {
            let byte = if i < n { kind[i] as u32 } else { 0 };
            v = (v << 8) | byte;
        }
        v
    }

    /// Compute the CRC over bytes 0..28 (everything except the CRC slot).
    pub fn compute_crc(&self) -> u32 {
        let bytes = self.as_bytes();
        sha256_u32(&bytes[..28])
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

    /// pack_kind_tag matches JS packKindTag byte-for-byte.
    #[test]
    fn pack_kind_tag_known_values() {
        assert_eq!(SporeFrame::pack_kind_tag(b"test"), 0x7465_7374);
        // "alarm" truncates to "alar".
        assert_eq!(SporeFrame::pack_kind_tag(b"alarm"), 0x616C_6172);
        // "x" pads with zeros: 'x','\0','\0','\0' = 0x78000000.
        assert_eq!(SporeFrame::pack_kind_tag(b"x"), 0x7800_0000);
        // empty: 0x00000000.
        assert_eq!(SporeFrame::pack_kind_tag(b""), 0);
    }

    /// event_hash_list frame round-trips via raw bytes.
    #[test]
    fn event_hash_list_round_trips() {
        let f = SporeFrame::event_hash_list(0xCAFE_BABE, 0x9299_32B5, 3, 0, 1, 12345);
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed.frame_type, FRAME_TYPE_EVENT_HASH_LIST);
        assert_eq!(parsed.proposal_or_target, 0xCAFE_BABE);
        assert_eq!(parsed.payload_a, 0x9299_32B5);
        assert_eq!(parsed.payload_b, 3);
        assert_eq!(parsed.tick, 12345);
    }

    /// event_delta_chunk header frame round-trips.
    #[test]
    fn event_delta_chunk_header_round_trips() {
        let f = SporeFrame::event_delta_chunk_header(
            0x42, 0xDEAD_BEEF, 0xAAAA_BBBB, 99, 7, 5,
        );
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed.frame_type, FRAME_TYPE_EVENT_DELTA_CHUNK);
        assert_eq!(parsed.oracle_bit, 0x42);
        assert_eq!(parsed.proposal_or_target, 0xDEAD_BEEF);
        assert_eq!(parsed.tick, 0xDEAD_BEEF); // envelope_hash
        // sequence = 0, total = 5 in reserved.
        assert_eq!(parsed._reserved & 0xFFFF, 5);
        assert_eq!((parsed._reserved >> 16) & 0xFFFF, 0);
    }

    /// event_delta_chunk record frame round-trips.
    #[test]
    fn event_delta_chunk_record_round_trips() {
        let f = SporeFrame::event_delta_chunk_record(
            0x42, 0xDEAD_BEEF, 0x10, SporeFrame::pack_kind_tag(b"alrm"), 0xCAFE, 1, 3,
        );
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed.frame_type, FRAME_TYPE_EVENT_DELTA_CHUNK);
        assert_eq!(parsed.proposal_or_target, 0x10);
        assert_eq!(parsed.payload_b, 0x616C_726D); // "alrm"
        assert_eq!(parsed.payload_c, 0xCAFE);
        // sequence = 1, total = 3.
        assert_eq!((parsed._reserved >> 16) & 0xFFFF, 1);
        assert_eq!(parsed._reserved & 0xFFFF, 3);
    }

    /// HASH_REQUEST frame round-trips.
    #[test]
    fn hash_request_round_trips() {
        let f = SporeFrame::event_hash_request(0xCAFE_BABE, 42);
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed.frame_type, FRAME_TYPE_EVENT_HASH_REQUEST);
        assert_eq!(parsed.proposal_or_target, 0xCAFE_BABE);
        assert_eq!(parsed.tick, 42);
    }

    /// HASH_RESPONSE chunk round-trips with up to 4 hashes.
    #[test]
    fn hash_response_round_trips() {
        let hashes = [0x10u32, 0x20, 0x30, 0x40];
        let f = SporeFrame::event_hash_response(99, 2, 5, 4, &hashes);
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed.frame_type, FRAME_TYPE_EVENT_HASH_RESPONSE);
        assert_eq!(parsed.proposal_or_target, 0x10);
        assert_eq!(parsed.payload_a, 0x20);
        assert_eq!(parsed.payload_b, 0x30);
        assert_eq!(parsed.payload_c, 0x40);
        assert_eq!(parsed.tick, 99);
        assert_eq!((parsed._reserved >> 24) & 0xFF, 2); // seq
        assert_eq!((parsed._reserved >> 16) & 0xFF, 5); // total
        assert_eq!((parsed._reserved >> 8) & 0xFF, 4);  // valid
    }

    /// HASH_RESPONSE handles partial chunks (valid < 4).
    #[test]
    fn hash_response_partial_chunk() {
        let hashes = [0x10u32, 0x20, 0, 0];
        let f = SporeFrame::event_hash_response(7, 1, 1, 2, &hashes);
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!((parsed._reserved >> 8) & 0xFF, 2); // valid = 2
    }

    /// Era 1410+1470: locked frame-type registry. JS mirror in
    /// `src/network/spore_frame.ts` must match these values byte-for-byte.
    #[test]
    fn frame_type_registry_matches_js() {
        assert_eq!(FRAME_TYPE_WARRANT_VOTE, 1);
        assert_eq!(FRAME_TYPE_HALO_STATE, 2);
        assert_eq!(FRAME_TYPE_HEARTBEAT, 3);
        assert_eq!(FRAME_TYPE_QUORUM_QUERY, 4);
        assert_eq!(FRAME_TYPE_SNAPSHOT_DIGEST, 5);
        assert_eq!(FRAME_TYPE_COMPOSITE_HEALTH, 6);
        assert_eq!(FRAME_TYPE_QUORUM_VERDICT, 7);
        assert_eq!(FRAME_TYPE_DELTA_CHUNK, 8);
        assert_eq!(FRAME_TYPE_EVENT_HASH_LIST, 9);
        assert_eq!(FRAME_TYPE_EVENT_DELTA_CHUNK, 10);
        assert_eq!(FRAME_TYPE_EVENT_HASH_REQUEST, 11);
        assert_eq!(FRAME_TYPE_EVENT_HASH_RESPONSE, 12);
        assert_eq!(FRAME_TYPE_V2_SYNC, 13);
        assert_eq!(FRAME_TYPE_BLE_MESH_BROADCAST, 14);
        assert_eq!(FRAME_TYPE_LORA_LONG_RANGE, 15);
        assert_eq!(FRAME_TYPE_PROPOSAL, 17);
        assert_eq!(FRAME_TYPE_LAW_TELEMETRY, 18);
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
    fn law_telemetry_round_trips() {
        let f = SporeFrame::law_telemetry(0, 0x1111, 0x2222, 0x3333, 42, 100);
        let bytes = f.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed.frame_type, FRAME_TYPE_LAW_TELEMETRY);
        assert_eq!(parsed.oracle_bit, 0);
        assert_eq!(parsed.proposal_or_target, 0x1111);
        assert_eq!(parsed.payload_a, 0x2222);
        assert_eq!(parsed.payload_b, 0x3333);
        assert_eq!(parsed.payload_c, 42);
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
        assert_eq!(f.crc32, 0xdf38_2f50);
    }
}
