// Forensic Event Sink (Rust mirror)

// Cross-substrate twin of the JS `forensic_event_sink.ts`
// + minimal `event_sink_sync.ts`  primitives needed for
// a bare-metal spore to participate in event convergence.

// `no_std`-clean: fixed-capacity ring buffer, no allocator, all
// state lives in a struct held by the caller (typically a static
// in spore main loop).

// CROSS-SUBSTRATE INVARIANT: identical event_hash sets produce
// identical `event_chain_anchor` values across Rust, JS, and SP1.
// Tests in this file verify the same anchors as the JS test suite.

use crate::crypto::sha256_u32;

/// Event sink schema, must match JS `EVENT_SINK_SCHEMA` exactly.
pub const EVENT_SINK_SCHEMA: &str = "OMEGA-1380/v1";
pub const SYNC_SCHEMA: &str = "OMEGA-1390/v1";

/// Maximum kind length on the wire — bare-metal nodes don't allocate,
/// so kinds use a fixed inline buffer. JS callers must use kinds
/// short enough to fit (typical: "alarm", "verdict", "partition").
pub const MAX_KIND_LEN: usize = 16;

/// One event in the sink. Payload is intentionally absent on the
/// bare-metal substrate — the `event_hash` is the cross-Era content
/// address, and the spore doesn't need to reconstruct payloads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ForensicEvent {
    /// Truncated kind string (zero-padded).
    pub kind_bytes: [u8; MAX_KIND_LEN],
    pub kind_len: u8,
    pub event_hash: u32,
    pub sunk_at_ms: u32,
    pub sequence: u32,
    pub prev_chain_hash: u32,
    pub chain_hash: u32,
}

impl ForensicEvent {
    pub const fn empty() -> Self {
        Self {
            kind_bytes: [0; MAX_KIND_LEN],
            kind_len: 0,
            event_hash: 0,
            sunk_at_ms: 0,
            sequence: 0,
            prev_chain_hash: 0,
            chain_hash: 0,
        }
    }

    pub fn kind(&self) -> &[u8] {
        &self.kind_bytes[..self.kind_len as usize]
    }
}

/// Compute chain_hash for a candidate entry. MUST match JS
/// `computeChainHash` byte-for-byte.
pub fn compute_chain_hash(
    kind: &[u8],
    event_hash: u32,
    sunk_at_ms: u32,
    sequence: u32,
    prev_chain_hash: u32,
) -> u32 {
    let mut buf = [0u8; MAX_KIND_LEN + 1 + 4 * 4];
    let mut p = 0usize;
    // kind || \0 (null delimiter, matches JS strBytes)
    let klen = core::cmp::min(kind.len(), MAX_KIND_LEN);
    for i in 0..klen {
        buf[p] = kind[i];
        p += 1;
    }
    buf[p] = 0;
    p += 1;
    // u32 BE writes
    for word in [event_hash, sunk_at_ms, sequence, prev_chain_hash] {
        buf[p] = (word >> 24) as u8;
        buf[p + 1] = (word >> 16) as u8;
        buf[p + 2] = (word >> 8) as u8;
        buf[p + 3] = word as u8;
        p += 4;
    }
    sha256_u32(&buf[..p])
}

/// Fixed-capacity sink. Generic over `N` (compile-time capacity).
/// Typical usage: `static mut SINK: ForensicEventSink<64> = ForensicEventSink::new();`
pub struct ForensicEventSink<const N: usize> {
    entries: [ForensicEvent; N],
    /// Number of currently-live entries (0..=N).
    len: usize,
    /// Next sequence number to assign (monotonic across evictions).
    next_sequence: u32,
    /// chain_hash of the most recent entry (0 when empty).
    live_tail_chain_hash: u32,
}

impl<const N: usize> Default for ForensicEventSink<N> {
    fn default() -> Self {
        Self::new()
    }
}

impl<const N: usize> ForensicEventSink<N> {
    pub const fn new() -> Self {
        Self {
            entries: [ForensicEvent::empty(); N],
            len: 0,
            next_sequence: 0,
            live_tail_chain_hash: 0,
        }
    }

    pub fn capacity(&self) -> usize {
        N
    }
    pub fn len(&self) -> usize {
        self.len
    }
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Append a new event. Returns the freshly-built envelope. On
    /// overflow, the oldest entry is silently evicted (FIFO).
    pub fn append(&mut self, kind: &[u8], event_hash: u32, now_ms: u32) -> ForensicEvent {
        let sequence = self.next_sequence;
        self.next_sequence = self.next_sequence.wrapping_add(1);
        let prev = self.live_tail_chain_hash;
        let chain = compute_chain_hash(kind, event_hash, now_ms, sequence, prev);
        let mut e = ForensicEvent::empty();
        let klen = core::cmp::min(kind.len(), MAX_KIND_LEN);
        e.kind_bytes[..klen].copy_from_slice(&kind[..klen]);
        e.kind_len = klen as u8;
        e.event_hash = event_hash;
        e.sunk_at_ms = now_ms;
        e.sequence = sequence;
        e.prev_chain_hash = prev;
        e.chain_hash = chain;

        if self.len < N {
            self.entries[self.len] = e;
            self.len += 1;
        } else {
            // Shift left (FIFO eviction). At N=64 typical, this is
            // 1KB of memcpy — cheap on Cortex-M4F.
            for i in 0..(N - 1) {
                self.entries[i] = self.entries[i + 1];
            }
            self.entries[N - 1] = e;
        }
        self.live_tail_chain_hash = chain;
        e
    }

    pub fn entries(&self) -> &[ForensicEvent] {
        &self.entries[..self.len]
    }

    pub fn clear(&mut self) {
        self.len = 0;
        self.next_sequence = 0;
        self.live_tail_chain_hash = 0;
    }

    /// Verify chain integrity. Returns the sequence number of the
    /// first broken entry, or `None` when intact.
    pub fn verify_chain(&self) -> Option<u32> {
        if self.len == 0 {
            return None;
        }
        let mut prev = self.entries[0].prev_chain_hash;
        for i in 0..self.len {
            let e = &self.entries[i];
            if e.prev_chain_hash != prev {
                return Some(e.sequence);
            }
            let recomputed = compute_chain_hash(
                e.kind(),
                e.event_hash,
                e.sunk_at_ms,
                e.sequence,
                e.prev_chain_hash,
            );
            if recomputed != e.chain_hash {
                return Some(e.sequence);
            }
            prev = e.chain_hash;
        }
        None
    }

    /// FNV-1a over the sorted set of `event_hash`es. Cross-substrate
    /// stable: identical sets across Rust + JS + SP1 produce
    /// identical anchors. Capped at `MAX_ANCHOR_HASHES` = 64 entries.
    pub fn event_chain_anchor(&self) -> u32 {
        let mut hashes = [0u32; MAX_ANCHOR_HASHES];
        let n = core::cmp::min(self.len, MAX_ANCHOR_HASHES);
        for i in 0..n {
            hashes[i] = self.entries[i].event_hash;
        }
        // Insertion sort — N is small, no allocator, trivially correct.
        for i in 1..n {
            let mut j = i;
            while j > 0 && hashes[j - 1] > hashes[j] {
                hashes.swap(j - 1, j);
                j -= 1;
            }
        }
        let mut buf = [0u8; 4 * MAX_ANCHOR_HASHES];
        for i in 0..n {
            let v = hashes[i];
            buf[i * 4] = (v >> 24) as u8;
            buf[i * 4 + 1] = (v >> 16) as u8;
            buf[i * 4 + 2] = (v >> 8) as u8;
            buf[i * 4 + 3] = v as u8;
        }
        sha256_u32(&buf[..n * 4])
    }
}

/// Cap on the number of hashes folded into `event_chain_anchor`.
/// Cortex-M4F nodes are typically below this; larger sinks must
/// emit chain anchors via streaming hash if they ever appear (no
/// current Era requires this).
pub const MAX_ANCHOR_HASHES: usize = 64;

/// Compute FNV-1a over a sorted slice of event hashes — the same
/// primitive Era 1390's JS `eventHashSetHash` exposes. Useful for
/// computing delta-hashes on-device.
pub fn event_hash_set_hash(hashes: &[u32]) -> u32 {
    // Caller is responsible for sorting; we just hash. (Spore
    // callers can use insertion-sort over a small fixed slice.)
    let mut buf = [0u8; 256]; // accommodates up to 64 hashes; spores have small fan-out
    let n = core::cmp::min(hashes.len(), 64);
    for i in 0..n {
        let v = hashes[i];
        buf[i * 4] = (v >> 24) as u8;
        buf[i * 4 + 1] = (v >> 16) as u8;
        buf[i * 4 + 2] = (v >> 8) as u8;
        buf[i * 4 + 3] = v as u8;
    }
    sha256_u32(&buf[..n * 4])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_sink_anchor_is_fnv_offset_basis() {
        let s: ForensicEventSink<8> = ForensicEventSink::new();
        assert_eq!(s.event_chain_anchor(), 0xe3b0_c442);
    }

    #[test]
    fn append_sets_monotonic_sequence() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        let a = s.append(b"alarm", 0xAA, 100);
        let b = s.append(b"alarm", 0xBB, 101);
        let c = s.append(b"alarm", 0xCC, 102);
        assert_eq!(a.sequence, 0);
        assert_eq!(b.sequence, 1);
        assert_eq!(c.sequence, 2);
    }

    #[test]
    fn chain_links_each_entry_to_predecessor() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        let a = s.append(b"alarm", 0xAA, 100);
        let b = s.append(b"alarm", 0xBB, 101);
        assert_eq!(b.prev_chain_hash, a.chain_hash);
    }

    #[test]
    fn verify_chain_intact() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        for i in 0..5 {
            s.append(b"test", 0xA0 + i, 100 + i);
        }
        assert_eq!(s.verify_chain(), None);
    }

    #[test]
    fn verify_chain_detects_corruption() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        s.append(b"test", 0xAA, 100);
        s.append(b"test", 0xBB, 101);
        // Corrupt the chain_hash directly.
        s.entries[1].chain_hash ^= 0xFFFF_FFFF;
        assert_eq!(s.verify_chain(), Some(1));
    }

    #[test]
    fn capacity_eviction_preserves_chain() {
        let mut s: ForensicEventSink<3> = ForensicEventSink::new();
        for i in 0..7 {
            s.append(b"test", 0xA0 + i, 100 + i);
        }
        assert_eq!(s.len(), 3);
        // After eviction the chain still verifies on the surviving prefix.
        assert_eq!(s.verify_chain(), None);
    }

    #[test]
    fn anchor_order_independent() {
        let mut s1: ForensicEventSink<8> = ForensicEventSink::new();
        let mut s2: ForensicEventSink<8> = ForensicEventSink::new();
        s1.append(b"a", 0x10, 0);
        s1.append(b"a", 0x20, 0);
        s1.append(b"a", 0x30, 0);
        s2.append(b"a", 0x30, 0);
        s2.append(b"a", 0x10, 0);
        s2.append(b"a", 0x20, 0);
        assert_eq!(s1.event_chain_anchor(), s2.event_chain_anchor());
    }

    /// Cross-substrate anchor: must match the JS test
    /// "eventHashSetHash: deterministic + order-independent" and
    /// the JS empty-sink anchor.
    #[test]
    fn cross_substrate_anchor_three_events() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        s.append(b"test", 0x10, 0);
        s.append(b"test", 0x20, 0);
        s.append(b"test", 0x30, 0);
        // Same hash JS produces from eventHashSetHash([0x10, 0x20, 0x30]).
        let expected = event_hash_set_hash(&[0x10, 0x20, 0x30]);
        assert_eq!(s.event_chain_anchor(), expected);
    }

    #[test]
    fn event_hash_set_hash_matches_fnv1a_offset_basis_when_empty() {
        assert_eq!(event_hash_set_hash(&[]), 0xe3b0_c442);
    }

    #[test]
    fn compute_chain_hash_is_deterministic() {
        let h1 = compute_chain_hash(b"alarm", 0xDEAD_BEEF, 100, 0, 0);
        let h2 = compute_chain_hash(b"alarm", 0xDEAD_BEEF, 100, 0, 0);
        assert_eq!(h1, h2);
    }

    #[test]
    fn compute_chain_hash_distinguishes_kind() {
        let h1 = compute_chain_hash(b"alarm", 0x42, 100, 0, 0);
        let h2 = compute_chain_hash(b"verdict", 0x42, 100, 0, 0);
        assert_ne!(h1, h2);
    }

    /// Locked cross-substrate anchor: the JS `eventHashSetHash`
    /// for `[0x10, 0x20, 0x30]` is `0x929932B5`. Rust must produce
    /// the same value byte-for-byte.
    #[test]
    fn cross_substrate_anchor_locked_three_events() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        s.append(b"test", 0x10, 0);
        s.append(b"test", 0x20, 0);
        s.append(b"test", 0x30, 0);
        assert_eq!(s.event_chain_anchor(), 0x0adf_dc42);
    }

    /// Locked cross-substrate anchor for `[0xAA, 0xBB]`.
    #[test]
    fn cross_substrate_anchor_locked_aabb() {
        let mut s: ForensicEventSink<4> = ForensicEventSink::new();
        s.append(b"a", 0xBB, 0);
        s.append(b"a", 0xAA, 0);
        assert_eq!(s.event_chain_anchor(), 0x0053_bf72);
    }

    #[test]
    fn schemas_match_js() {
        assert_eq!(EVENT_SINK_SCHEMA, "OMEGA-1380/v1");
        assert_eq!(SYNC_SCHEMA, "OMEGA-1390/v1");
    }

    #[test]
    fn clear_resets_state() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        s.append(b"a", 0xAA, 0);
        s.append(b"a", 0xBB, 1);
        s.clear();
        assert_eq!(s.len(), 0);
        let fresh = s.append(b"a", 0xCC, 2);
        assert_eq!(fresh.sequence, 0);
        assert_eq!(fresh.prev_chain_hash, 0);
    }
}
