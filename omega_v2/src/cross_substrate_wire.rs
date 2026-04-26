// 🌌 OMEGA-64: Era 1440 — Cross-Substrate Convergence Smoke
//
// Eras 1380-1430 stack up to a complete forensic-event protocol on
// both substrates: chain-anchored sink, wire-format chunked delta,
// reassembly, apply, scheduler. Cross-substrate parity has been
// asserted at the *primitive* level (FNV anchors, frame-type IDs,
// kind-tag packing).
//
// Era 1440 adds the highest-level lock: a complete wire envelope
// produced by the JS chunker MUST parse cleanly through the Rust
// accumulator, yield the same envelope_hash, and produce the same
// applied-anchor when merged into a Rust sink.
//
// The locked byte vector below was produced by:
//
//   const a = new ForensicEventSink();
//   const b = new ForensicEventSink();
//   b.append("alrm", 0x10, 100);
//   b.append("alrm", 0x20, 100);
//   b.append("alrm", 0x30, 100);
//   const list = buildEventHashList(a, 100);
//   const delta = computeEventDelta(list, b.list(), 200);
//   const frames = chunkEventDelta(delta, 0x42);
//
// → 4 frames × 32 bytes = 128 bytes total.
//
// If JS regenerates this byte sequence with any structural change
// (sorted-set iteration, kind packing, sequence/total layout), the
// Rust test fails — and conversely, a Rust regression breaks
// against the JS snapshot.

use crate::event_sync_loop::{
    apply_event_delta, AccumulateOutcome, EventDeltaAccumulator,
};
use crate::forensic_event_sink::ForensicEventSink;
use crate::spore_frame::{SporeFrame, SPORE_FRAME_BYTES};

/// Wire bytes for a 4-frame envelope with `delta_hash = 0x929932B5`,
/// emitted by the JS chunker for a delta carrying entries
/// `[0x10, 0x20, 0x30]` with `kind = "alrm"`.
pub const LOCKED_ENVELOPE_BYTES: [u8; 128] = [
    0x4f, 0x46, 0x0a, 0x42, 0x92, 0x99, 0x32, 0xb5, 0x81, 0x1c, 0x9d, 0xc5, 0x00, 0x00, 0x00, 0xc8,
    0x00, 0x00, 0x00, 0x00, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x00, 0x00, 0x03, 0x87, 0x62, 0xfc, 0x6e,
    0x4f, 0x46, 0x0a, 0x42, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x72, 0x6d,
    0x4f, 0xb7, 0xae, 0x4f, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x01, 0x00, 0x03, 0xa1, 0x63, 0x46, 0x13,
    0x4f, 0x46, 0x0a, 0x42, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x72, 0x6d,
    0x77, 0xff, 0xab, 0x89, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x02, 0x00, 0x03, 0x8e, 0xe3, 0x14, 0x71,
    0x4f, 0x46, 0x0a, 0x42, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x72, 0x6d,
    0x03, 0x4e, 0x30, 0x0b, 0x92, 0x99, 0x32, 0xb5, 0x00, 0x03, 0x00, 0x03, 0x1b, 0x34, 0x07, 0x80,
];

pub const LOCKED_ENVELOPE_HASH: u32 = 0x9299_32B5;

/// Parse a packed byte stream into a sequence of `SporeFrame`s.
/// Returns the count parsed; rejects on bad CRC anywhere or
/// truncated trailing bytes.
pub fn parse_envelope_stream(buf: &[u8], out: &mut [SporeFrame]) -> Option<usize> {
    if buf.len() % SPORE_FRAME_BYTES != 0 { return None; }
    let n = buf.len() / SPORE_FRAME_BYTES;
    if n > out.len() { return None; }
    for i in 0..n {
        let off = i * SPORE_FRAME_BYTES;
        let mut bytes = [0u8; SPORE_FRAME_BYTES];
        bytes.copy_from_slice(&buf[off..off + SPORE_FRAME_BYTES]);
        match SporeFrame::from_bytes(&bytes) {
            Some(f) => out[i] = f,
            None => return None,
        }
    }
    Some(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Locked vector parses on Rust side cleanly.
    #[test]
    fn locked_envelope_parses_via_spore_frame() {
        let mut frames = [SporeFrame::empty(); 4];
        let n = parse_envelope_stream(&LOCKED_ENVELOPE_BYTES, &mut frames).expect("parse ok");
        assert_eq!(n, 4);
        // Every frame's CRC validated by from_bytes; reaching here means
        // they all passed.
    }

    /// Locked JS-emitted envelope reassembles on Rust side and
    /// produces the locked envelope_hash.
    #[test]
    fn locked_envelope_reassembles_through_accumulator() {
        let mut frames = [SporeFrame::empty(); 4];
        parse_envelope_stream(&LOCKED_ENVELOPE_BYTES, &mut frames).unwrap();

        let mut acc: EventDeltaAccumulator<8> = EventDeltaAccumulator::new();
        for f in &frames[..4] {
            let _ = acc.ingest_frame(*f);
        }
        let delta = acc.take_delta().expect("delta complete");
        assert_eq!(delta.envelope_hash, LOCKED_ENVELOPE_HASH);
        assert_eq!(delta.entry_count, 3);
        // Entries arrive sorted by event_hash.
        assert_eq!(delta.entries[0].event_hash, 0x10);
        assert_eq!(delta.entries[1].event_hash, 0x20);
        assert_eq!(delta.entries[2].event_hash, 0x30);
        // Kind tags survived round-trip.
        assert_eq!(delta.entries[0].kind(), b"alrm");
        assert_eq!(delta.entries[1].kind(), b"alrm");
        assert_eq!(delta.entries[2].kind(), b"alrm");
    }

    /// JS-emitted envelope applied to an empty Rust sink produces
    /// the locked anchor `0x9299_32B5` — same value Era 1400's
    /// locked anchor test produced from a different code path.
    /// Cross-substrate convergence proven end-to-end through
    /// wire bytes.
    #[test]
    fn locked_envelope_applied_yields_known_anchor() {
        let mut frames = [SporeFrame::empty(); 4];
        parse_envelope_stream(&LOCKED_ENVELOPE_BYTES, &mut frames).unwrap();
        let mut acc: EventDeltaAccumulator<8> = EventDeltaAccumulator::new();
        for f in &frames[..4] { let _ = acc.ingest_frame(*f); }
        let delta = acc.take_delta().expect("delta");

        let mut sink: ForensicEventSink<8> = ForensicEventSink::new();
        let _ = apply_event_delta(&mut sink, &delta, 999);
        assert_eq!(sink.event_chain_anchor(), LOCKED_ENVELOPE_HASH);
        assert_eq!(sink.len(), 3);
    }

    /// Mid-stream tampering breaks parse (CRC fails).
    #[test]
    fn locked_envelope_tampered_byte_breaks_parse() {
        let mut tampered = LOCKED_ENVELOPE_BYTES;
        // Flip one byte in the second frame's payload.
        tampered[40] ^= 0x55;
        let mut frames = [SporeFrame::empty(); 4];
        let n = parse_envelope_stream(&tampered, &mut frames);
        assert!(n.is_none(), "expected parse to fail on tampered byte");
    }

    /// Truncated wire stream rejected cleanly.
    #[test]
    fn locked_envelope_truncated_rejected() {
        let mut frames = [SporeFrame::empty(); 4];
        let n = parse_envelope_stream(&LOCKED_ENVELOPE_BYTES[..127], &mut frames);
        assert!(n.is_none());
    }
}
