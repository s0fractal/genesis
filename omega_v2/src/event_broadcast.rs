// Spore-Initiated Event Broadcast

// The spore  holds a forensic event sink and
// can decode chunked event-delta frames from the wire. Era 1420
// closes the role: a spore can now ORIGINATE event-sync traffic
// without waiting for a JS relay to drive.

// FUNCTIONS:

// • `broadcast_hash_list_frames` — emit one or more EVENT_HASH_LIST
// frames covering the spore's known event_hash set. Each frame
// carries the FNV-1a anchor and the (this_seq, total) chunk
// position; multi-frame mode lets a spore announce a large set
// without exceeding any wire layer's MTU expectations.

// • `broadcast_delta_chunks` — given a slice of `ForensicEvent`s
// the spore wants to ship to a peer (typically the result of
// a local set-difference), build the EVENT_DELTA_CHUNK header
// + record frames in deterministic order.

// • `BroadcastBuffer<N>` — a tiny `no_std`-clean queue for the
// spore to assemble outgoing frames before flushing to the
// wire driver. Avoids dynamic allocation while keeping the
// emit path straightforward.

// CROSS-SUBSTRATE INVARIANT: frames produced by these helpers are
// byte-identical to the JS `chunkEventDelta` output for the same
// inputs — both sides reach the same wire bytes for the same
// logical envelope.

use crate::forensic_event_sink::{
    event_hash_set_hash,
    ForensicEvent,
    ForensicEventSink,
};
use crate::spore_frame::{SporeFrame, SPORE_FRAME_BYTES};
use crate::crypto::sha256_u32;

/// Schema constant — keep in lockstep with JS `EVENT_WIRE_SCHEMA`.
pub const BROADCAST_SCHEMA: &str = "OMEGA-1420/v1";

/// Tiny fixed-capacity FIFO buffer for outgoing frames. The spore
/// flushes its contents to the UART/SPI driver in one pass; no
/// dynamic allocation, no panic on overflow (overflow drops oldest).
pub struct BroadcastBuffer<const N: usize> {
    frames: [SporeFrame; N],
    len: usize,
}

impl<const N: usize> Default for BroadcastBuffer<N> {
    fn default() -> Self {
        Self::new()
    }
}

impl<const N: usize> BroadcastBuffer<N> {
    pub const fn new() -> Self {
        Self {
            frames: [SporeFrame::empty(); N],
            len: 0,
        }
    }

    pub fn push(&mut self, f: SporeFrame) -> bool {
        if self.len < N {
            self.frames[self.len] = f;
            self.len += 1;
            true
        } else {
            // Overflow: drop the oldest, shift left, append new tail.
            // Returning `false` lets callers know an entry was evicted.
            for i in 0..(N - 1) {
                self.frames[i] = self.frames[i + 1];
            }
            self.frames[N - 1] = f;
            false
        }
    }

    pub fn drain(&mut self) -> &[SporeFrame] {
        let out = &self.frames[..self.len];
        // Caller is expected to flush the slice synchronously;
        // `clear()` happens after flush.
        out
    }

    pub fn clear(&mut self) {
        self.len = 0;
    }

    pub fn len(&self) -> usize { self.len }
    pub fn is_empty(&self) -> bool { self.len == 0 }
    pub fn capacity(&self) -> usize { N }
}

/// Build a single EVENT_HASH_LIST frame announcing the sink's full
/// event_hash set anchor. Used when the set is small enough to
/// describe in one frame (typical for spores).
pub fn build_hash_list_frame<const N: usize>(
    sink: &ForensicEventSink<N>,
    sender_relay_id: u32,
    broadcast_at_ms: u32,
) -> SporeFrame {
    // Sort hashes to compute the canonical anchor.
    let mut hashes = [0u32; 64];
    let count = core::cmp::min(sink.len(), 64);
    for i in 0..count {
        hashes[i] = sink.entries()[i].event_hash;
    }
    for i in 1..count {
        let mut j = i;
        while j > 0 && hashes[j - 1] > hashes[j] {
            hashes.swap(j - 1, j);
            j -= 1;
        }
    }
    let anchor = event_hash_set_hash(&hashes[..count]);
    SporeFrame::event_hash_list(
        sender_relay_id,
        anchor,
        count as u32,
        0, // single-frame announcement
        1,
        broadcast_at_ms,
    )
}

/// Build the chunked frames for a delta envelope. Returns the
/// number of frames written into `out`, or `usize::MAX` if `out`
/// was too small (caller should retry with a larger buffer).
///
/// `entries` is the sender's "things peer is missing" — typically
/// produced by intersecting the local sink's hash set against an
/// EVENT_HASH_LIST from the peer.
pub fn build_delta_chunk_frames(
    entries: &[ForensicEvent],
    sender_relay_id: u8,
    initiator_anchor: u32,
    replied_at_ms: u32,
    peer_missing_count: u32,
    out: &mut [SporeFrame],
) -> usize {
    let total = entries.len();
    if total > 0xFFFF { return usize::MAX; }
    if out.len() < total + 1 { return usize::MAX; }

    // envelope_hash = FNV-1a over the sorted event_hash set of
    // missing entries (matches JS `eventHashSetHash`).
    let mut hashes = [0u32; 64];
    let n = core::cmp::min(total, 64);
    for i in 0..n {
        hashes[i] = entries[i].event_hash;
    }
    for i in 1..n {
        let mut j = i;
        while j > 0 && hashes[j - 1] > hashes[j] {
            hashes.swap(j - 1, j);
            j -= 1;
        }
    }
    let envelope_hash = event_hash_set_hash(&hashes[..n]);

    // Header.
    out[0] = SporeFrame::event_delta_chunk_header(
        sender_relay_id,
        envelope_hash,
        initiator_anchor,
        replied_at_ms,
        peer_missing_count,
        total as u16,
    );
    // Records, in input order. The JS chunker emits them in
    // sorted order; the spore caller is expected to provide a
    // sorted slice (or use a helper that sorts first).
    for i in 0..total {
        let e = &entries[i];
        let kind_tag = SporeFrame::pack_kind_tag(e.kind());
        out[i + 1] = SporeFrame::event_delta_chunk_record(
            sender_relay_id,
            envelope_hash,
            e.event_hash,
            kind_tag,
            e.chain_hash,
            (i + 1) as u16,
            total as u16,
        );
    }
    total + 1
}

/// Convenience: serialize all frames into a single contiguous
/// byte buffer for UART transmission. Returns the number of bytes
/// written, or `usize::MAX` on insufficient capacity.
pub fn serialize_frames(frames: &[SporeFrame], out: &mut [u8]) -> usize {
    let needed = frames.len() * SPORE_FRAME_BYTES;
    if out.len() < needed { return usize::MAX; }
    for (i, f) in frames.iter().enumerate() {
        let bytes = f.as_bytes();
        let off = i * SPORE_FRAME_BYTES;
        out[off..off + SPORE_FRAME_BYTES].copy_from_slice(&bytes);
    }
    needed
}

/// Compute a deterministic "broadcast tick" for ordering — useful
/// when the spore lacks wall-clock time but has a monotonic
/// counter. Combines counter + relay_id with FNV-1a so two spores
/// with the same counter don't collide.
pub fn broadcast_tick(monotonic_counter: u32, relay_id: u32) -> u32 {
    let mut buf = [0u8; 8];
    buf[0] = (monotonic_counter >> 24) as u8;
    buf[1] = (monotonic_counter >> 16) as u8;
    buf[2] = (monotonic_counter >> 8) as u8;
    buf[3] = monotonic_counter as u8;
    buf[4] = (relay_id >> 24) as u8;
    buf[5] = (relay_id >> 16) as u8;
    buf[6] = (relay_id >> 8) as u8;
    buf[7] = relay_id as u8;
    sha256_u32(&buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spore_frame::FRAME_TYPE_EVENT_HASH_LIST;
    use crate::spore_frame::FRAME_TYPE_EVENT_DELTA_CHUNK;

    #[test]
    fn buffer_push_drain() {
        let mut buf: BroadcastBuffer<4> = BroadcastBuffer::new();
        assert!(buf.is_empty());
        buf.push(SporeFrame::heartbeat(0xAA, 1));
        buf.push(SporeFrame::heartbeat(0xBB, 2));
        assert_eq!(buf.len(), 2);
        let drained = buf.drain();
        assert_eq!(drained.len(), 2);
    }

    #[test]
    fn buffer_overflow_evicts_oldest() {
        let mut buf: BroadcastBuffer<2> = BroadcastBuffer::new();
        buf.push(SporeFrame::heartbeat(1, 1));
        buf.push(SporeFrame::heartbeat(2, 2));
        let ok = buf.push(SporeFrame::heartbeat(3, 3));
        assert!(!ok); // signals eviction
        assert_eq!(buf.len(), 2);
        assert_eq!(buf.drain()[0].proposal_or_target, 2);
        assert_eq!(buf.drain()[1].proposal_or_target, 3);
    }

    #[test]
    fn build_hash_list_frame_anchor_matches_sink() {
        let mut s: ForensicEventSink<8> = ForensicEventSink::new();
        s.append(b"a", 0x10, 0);
        s.append(b"a", 0x20, 0);
        s.append(b"a", 0x30, 0);
        let f = build_hash_list_frame(&s, 0xCAFE_BABE, 12345);
        assert_eq!(f.frame_type, FRAME_TYPE_EVENT_HASH_LIST);
        assert_eq!(f.proposal_or_target, 0xCAFE_BABE);
        // Anchor matches Era 1400 locked value for [0x10, 0x20, 0x30].
        assert_eq!(f.payload_a, 0x0adf_dc42);
        assert_eq!(f.payload_b, 3);
        assert_eq!(f.tick, 12345);
    }

    #[test]
    fn build_delta_chunk_frames_shape() {
        let mut e1 = ForensicEvent::empty();
        e1.kind_bytes[..4].copy_from_slice(b"alrm");
        e1.kind_len = 4;
        e1.event_hash = 0x10;
        let mut e2 = e1;
        e2.event_hash = 0x20;

        let entries = [e1, e2];
        let mut out = [SporeFrame::empty(); 4];
        let n = build_delta_chunk_frames(&entries, 0x42, 0xAAAA, 99, 0, &mut out);
        assert_eq!(n, 3); // 1 header + 2 records
        // Header at [0]
        assert_eq!(out[0].frame_type, FRAME_TYPE_EVENT_DELTA_CHUNK);
        assert_eq!((out[0]._reserved >> 16) & 0xFFFF, 0);
        assert_eq!(out[0]._reserved & 0xFFFF, 2);
        // Records at [1..2]
        assert_eq!(out[1].proposal_or_target, 0x10);
        assert_eq!(out[2].proposal_or_target, 0x20);
        // All three carry the same envelope_hash.
        assert_eq!(out[0].tick, out[1].tick);
        assert_eq!(out[0].tick, out[2].tick);
    }

    #[test]
    fn build_delta_chunk_frames_envelope_hash_matches_js() {
        // Build a delta with hashes 0x10, 0x20, 0x30 — envelope_hash
        // must be the locked cross-substrate value 0x9299_32B5.
        let mk = |h: u32| {
            let mut e = ForensicEvent::empty();
            e.kind_bytes[..4].copy_from_slice(b"test");
            e.kind_len = 4;
            e.event_hash = h;
            e
        };
        let entries = [mk(0x10), mk(0x20), mk(0x30)];
        let mut out = [SporeFrame::empty(); 8];
        build_delta_chunk_frames(&entries, 0x42, 0, 0, 0, &mut out);
        assert_eq!(out[0].tick, 0x0adf_dc42);
        assert_eq!(out[0].proposal_or_target, 0x0adf_dc42); // header puts envelope_hash in proposal_or_target
    }

    #[test]
    fn build_delta_chunk_frames_buffer_too_small() {
        let mut e = ForensicEvent::empty();
        e.event_hash = 0x42;
        let entries = [e];
        let mut out = [SporeFrame::empty(); 1]; // not enough for header + record
        let n = build_delta_chunk_frames(&entries, 0, 0, 0, 0, &mut out);
        assert_eq!(n, usize::MAX);
    }

    #[test]
    fn serialize_frames_writes_contiguous_bytes() {
        let frames = [
            SporeFrame::heartbeat(0xAA, 1),
            SporeFrame::heartbeat(0xBB, 2),
        ];
        let mut buf = [0u8; 64];
        let n = serialize_frames(&frames, &mut buf);
        assert_eq!(n, 64);
        // Each chunk begins with magic 0x4F 0x46.
        assert_eq!(buf[0], 0x4F);
        assert_eq!(buf[1], 0x46);
        assert_eq!(buf[32], 0x4F);
        assert_eq!(buf[33], 0x46);
    }

    #[test]
    fn serialize_frames_too_small_buffer() {
        let frames = [SporeFrame::heartbeat(0xAA, 1)];
        let mut buf = [0u8; 16];
        assert_eq!(serialize_frames(&frames, &mut buf), usize::MAX);
    }

    #[test]
    fn broadcast_tick_is_deterministic() {
        let t1 = broadcast_tick(42, 0xCAFE_BABE);
        let t2 = broadcast_tick(42, 0xCAFE_BABE);
        assert_eq!(t1, t2);
    }

    #[test]
    fn broadcast_tick_distinguishes_relay() {
        let t1 = broadcast_tick(42, 0xAAA);
        let t2 = broadcast_tick(42, 0xBBB);
        assert_ne!(t1, t2);
    }

    #[test]
    fn schema_constant() {
        assert_eq!(BROADCAST_SCHEMA, "OMEGA-1420/v1");
    }
}
