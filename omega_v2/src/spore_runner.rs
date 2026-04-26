// 🌌 OMEGA-64: Era 1450 — Spore Main-Loop Glue + Wire-Driver Hook
//
// Era 1430 gave the spore an accumulator + apply path; Era 1420 gave
// it a broadcast queue + frame builders. Era 1450 stitches them into
// a runnable main loop with a clean abstraction for the wire driver.
//
// THE CORE LOOP:
//
//   1. Drain RX bytes from the driver into a small staging buffer.
//   2. As complete 32-byte frames are available, parse them.
//   3. Route each frame by `frame_type`:
//        • EVENT_DELTA_CHUNK → feed the accumulator.
//        • EVENT_HASH_LIST   → record peer's anchor (Era 1460 will
//          drive set-difference computation; for now we only
//          observe).
//        • Other types → ignored at this layer (other Eras handle).
//   4. If the accumulator just completed an envelope, take_delta +
//      apply_event_delta to the local sink.
//   5. Periodically (per `broadcast_interval_ticks`) build a fresh
//      EVENT_HASH_LIST frame announcing our own state and push it
//      onto the broadcast buffer.
//   6. Flush the broadcast buffer to the driver.
//
// WIRE DRIVER ABSTRACTION:
//
// The `WireDriver` trait hides UART/SPI/BLE behind two methods:
//   • `read(&mut self, buf: &mut [u8]) -> usize` — non-blocking,
//     returns bytes copied.
//   • `write(&mut self, buf: &[u8]) -> usize` — non-blocking,
//     returns bytes accepted.
//
// A `LoopbackDriver` implementation lets two `SporeRunner` instances
// converge against each other in-process — the test for end-to-end
// substrate-only convergence over a real byte stream.

use crate::event_broadcast::{
    build_hash_list_frame, build_delta_chunk_frames,
};
use crate::event_sync_loop::{
    apply_event_delta, AccumulateOutcome, ApplyOutcome,
    EventDeltaAccumulator,
};
use crate::forensic_event_sink::{ForensicEvent, ForensicEventSink};
use crate::spore_frame::{
    SporeFrame, FRAME_TYPE_EVENT_DELTA_CHUNK,
    FRAME_TYPE_EVENT_HASH_LIST, SPORE_FRAME_BYTES,
};

pub const RUNNER_SCHEMA: &str = "OMEGA-1450/v1";

/// Wire I/O abstraction. Implementations hide UART/SPI/BLE behind
/// non-blocking read/write returning byte counts.
pub trait WireDriver {
    /// Copy up to `buf.len()` bytes from RX into `buf`. Returns
    /// the number of bytes copied (0 = nothing available).
    fn read(&mut self, buf: &mut [u8]) -> usize;
    /// Try to push `buf` onto TX. Returns the number of bytes
    /// accepted (may be < buf.len() under back-pressure).
    fn write(&mut self, buf: &[u8]) -> usize;
}

/// Tick-driven runner. Generic over sink capacity `N` and
/// accumulator capacity `C`. Caller wires an RX/TX driver
/// in via the trait.
pub struct SporeRunner<const N: usize, const C: usize> {
    pub sink: ForensicEventSink<N>,
    pub accumulator: EventDeltaAccumulator<C>,
    pub self_relay_id: u32,
    /// Most recent peer anchor we observed (informational).
    pub last_peer_anchor: u32,
    /// Tick counter.
    tick: u32,
    /// Tick interval between hash-list broadcasts.
    pub broadcast_interval_ticks: u32,
    /// Tick of the last broadcast emit.
    last_broadcast_tick: u32,
    /// Staging buffer for incoming bytes that haven't yet formed
    /// a complete frame.
    rx_staging: [u8; 64], // up to 2 frames in-flight
    rx_staging_len: usize,
    /// Diagnostics — counters since boot.
    pub frames_received: u32,
    pub frames_applied: u32,
    pub envelopes_completed: u32,
    pub apply_collisions: u32,
}

impl<const N: usize, const C: usize> SporeRunner<N, C> {
    pub const fn new(self_relay_id: u32, broadcast_interval_ticks: u32) -> Self {
        Self {
            sink: ForensicEventSink::new(),
            accumulator: EventDeltaAccumulator::new(),
            self_relay_id,
            last_peer_anchor: 0,
            tick: 0,
            broadcast_interval_ticks,
            last_broadcast_tick: 0,
            rx_staging: [0u8; 64],
            rx_staging_len: 0,
            frames_received: 0,
            frames_applied: 0,
            envelopes_completed: 0,
            apply_collisions: 0,
        }
    }

    /// One iteration of the main loop. Caller invokes this at
    /// whatever cadence the firmware's timer drives.
    pub fn step<D: WireDriver>(&mut self, driver: &mut D, now_ms: u32) {
        self.tick = self.tick.wrapping_add(1);
        self.drain_rx(driver, now_ms);
        self.maybe_broadcast(driver, now_ms);
    }

    /// Manually inject an event into the local sink (e.g. when a
    /// higher-Era subsystem detects a partition or quorum verdict).
    /// The event will participate in subsequent broadcasts.
    pub fn observe_local_event(&mut self, kind: &[u8], event_hash: u32, now_ms: u32) {
        self.sink.append(kind, event_hash, now_ms);
    }

    /// Number of events the local sink currently holds.
    pub fn sink_len(&self) -> usize { self.sink.len() }

    /// Cross-substrate-stable anchor over the current sink.
    pub fn anchor(&self) -> u32 { self.sink.event_chain_anchor() }

    fn drain_rx<D: WireDriver>(&mut self, driver: &mut D, now_ms: u32) {
        loop {
            let space = self.rx_staging.len() - self.rx_staging_len;
            if space == 0 { break; }
            let read = driver.read(&mut self.rx_staging[self.rx_staging_len..]);
            if read == 0 { break; }
            self.rx_staging_len += read;
            self.process_staged(now_ms);
        }
    }

    fn process_staged(&mut self, now_ms: u32) {
        // Consume complete 32-byte frames from the head of the buffer.
        // Magic-byte resync: if the first byte isn't 0x4F, drop it.
        while self.rx_staging_len >= SPORE_FRAME_BYTES {
            // Check magic at head; if missing, slide forward.
            if self.rx_staging[0] != 0x4F || self.rx_staging[1] != 0x46 {
                // Find next 0x4F or shift entire buffer.
                let mut found = None;
                for i in 1..self.rx_staging_len {
                    if self.rx_staging[i] == 0x4F {
                        found = Some(i);
                        break;
                    }
                }
                let drop_n = found.unwrap_or(self.rx_staging_len);
                for i in 0..(self.rx_staging_len - drop_n) {
                    self.rx_staging[i] = self.rx_staging[i + drop_n];
                }
                self.rx_staging_len -= drop_n;
                continue;
            }
            // Try parse the head frame.
            let mut frame_buf = [0u8; SPORE_FRAME_BYTES];
            frame_buf.copy_from_slice(&self.rx_staging[..SPORE_FRAME_BYTES]);
            match SporeFrame::from_bytes(&frame_buf) {
                Some(f) => {
                    self.frames_received = self.frames_received.wrapping_add(1);
                    self.handle_frame(f, now_ms);
                    // Slide buffer forward.
                    for i in 0..(self.rx_staging_len - SPORE_FRAME_BYTES) {
                        self.rx_staging[i] = self.rx_staging[i + SPORE_FRAME_BYTES];
                    }
                    self.rx_staging_len -= SPORE_FRAME_BYTES;
                }
                None => {
                    // Bad CRC at the supposed-frame boundary: drop the
                    // first byte and resync.
                    for i in 0..(self.rx_staging_len - 1) {
                        self.rx_staging[i] = self.rx_staging[i + 1];
                    }
                    self.rx_staging_len -= 1;
                }
            }
        }
    }

    fn handle_frame(&mut self, f: SporeFrame, now_ms: u32) {
        match f.frame_type {
            FRAME_TYPE_EVENT_HASH_LIST => {
                // Record peer's anchor; convergence-driver layer (next
                // Era) will use it to decide when set-difference is
                // worth shipping.
                self.last_peer_anchor = f.payload_a;
            }
            FRAME_TYPE_EVENT_DELTA_CHUNK => {
                let outcome = self.accumulator.ingest_frame(f);
                if outcome == AccumulateOutcome::Complete {
                    self.envelopes_completed = self.envelopes_completed.wrapping_add(1);
                    if let Some(delta) = self.accumulator.take_delta() {
                        match apply_event_delta(&mut self.sink, &delta, now_ms) {
                            ApplyOutcome::Ok { added, .. } => {
                                self.frames_applied =
                                    self.frames_applied.wrapping_add(added);
                            }
                            ApplyOutcome::Collision => {
                                self.apply_collisions =
                                    self.apply_collisions.wrapping_add(1);
                            }
                            ApplyOutcome::BadSchema => {}
                        }
                    }
                }
            }
            _ => { /* not our concern at this layer */ }
        }
    }

    fn maybe_broadcast<D: WireDriver>(&mut self, driver: &mut D, now_ms: u32) {
        if self.tick.wrapping_sub(self.last_broadcast_tick) < self.broadcast_interval_ticks {
            return;
        }
        let frame = build_hash_list_frame(&self.sink, self.self_relay_id, now_ms);
        let bytes = frame.as_bytes();
        let _ = driver.write(&bytes);
        self.last_broadcast_tick = self.tick;
    }

    /// Push a delta envelope (header + records) onto the wire. Useful
    /// when a higher-Era driver decides to ship missing entries to a
    /// peer based on observed `last_peer_anchor`.
    pub fn ship_delta<D: WireDriver>(
        &self,
        driver: &mut D,
        entries: &[ForensicEvent],
        peer_anchor: u32,
        now_ms: u32,
    ) -> bool {
        // We need an out-buffer for the chunked frames. Cap at
        // accumulator capacity to mirror what the receiver can handle.
        let mut frames = [SporeFrame::empty(); 16];
        let n = build_delta_chunk_frames(
            entries,
            (self.self_relay_id & 0xFF) as u8,
            peer_anchor,
            now_ms,
            0,
            &mut frames,
        );
        if n == usize::MAX { return false; }
        let mut buf = [0u8; 16 * SPORE_FRAME_BYTES];
        for (i, f) in frames[..n].iter().enumerate() {
            let off = i * SPORE_FRAME_BYTES;
            buf[off..off + SPORE_FRAME_BYTES].copy_from_slice(&f.as_bytes());
        }
        let total_bytes = n * SPORE_FRAME_BYTES;
        let written = driver.write(&buf[..total_bytes]);
        written == total_bytes
    }
}

/// In-process loopback: two `LoopbackDriver`s can be linked so
/// writing on one shows up as a read on the other. Used for tests
/// where two `SporeRunner` instances need to talk.
pub struct LoopbackDriver {
    /// Bytes pending to be read by the local side (written by peer).
    rx_buf: [u8; 256],
    rx_len: usize,
}

impl LoopbackDriver {
    pub const fn new() -> Self {
        Self { rx_buf: [0u8; 256], rx_len: 0 }
    }

    /// Push bytes into this driver's RX buffer (called by the linked
    /// peer's TX path). Returns bytes accepted; drops on overflow.
    pub fn deliver(&mut self, bytes: &[u8]) -> usize {
        let space = self.rx_buf.len() - self.rx_len;
        let n = if bytes.len() < space { bytes.len() } else { space };
        self.rx_buf[self.rx_len..self.rx_len + n].copy_from_slice(&bytes[..n]);
        self.rx_len += n;
        n
    }
}

impl WireDriver for LoopbackDriver {
    fn read(&mut self, buf: &mut [u8]) -> usize {
        let n = if buf.len() < self.rx_len { buf.len() } else { self.rx_len };
        buf[..n].copy_from_slice(&self.rx_buf[..n]);
        // Slide.
        for i in 0..(self.rx_len - n) {
            self.rx_buf[i] = self.rx_buf[i + n];
        }
        self.rx_len -= n;
        n
    }
    fn write(&mut self, _buf: &[u8]) -> usize {
        // A LoopbackDriver's write goes to its peer; that wiring is
        // handled outside via `deliver` (caller is expected to plumb
        // TX → peer.deliver).
        _buf.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A linked pair: writes to A surface as reads on B and vice versa.
    /// This pattern is awkward in a `no_std` setting because of the
    /// borrow checker, so the test does the plumbing manually.
    struct PairedDriver {
        local: LoopbackDriver,
        /// Outgoing bytes captured for delivery to the peer.
        tx_log: [u8; 512],
        tx_len: usize,
    }

    impl PairedDriver {
        const fn new() -> Self {
            Self { local: LoopbackDriver::new(), tx_log: [0u8; 512], tx_len: 0 }
        }
        fn deliver_to_peer(&mut self, peer: &mut PairedDriver) {
            peer.local.deliver(&self.tx_log[..self.tx_len]);
            self.tx_len = 0;
        }
    }

    impl WireDriver for PairedDriver {
        fn read(&mut self, buf: &mut [u8]) -> usize { self.local.read(buf) }
        fn write(&mut self, buf: &[u8]) -> usize {
            let space = self.tx_log.len() - self.tx_len;
            let n = if buf.len() < space { buf.len() } else { space };
            self.tx_log[self.tx_len..self.tx_len + n].copy_from_slice(&buf[..n]);
            self.tx_len += n;
            n
        }
    }

    #[test]
    fn loopback_driver_round_trips() {
        let mut d = LoopbackDriver::new();
        d.deliver(b"hello");
        let mut buf = [0u8; 16];
        let n = d.read(&mut buf);
        assert_eq!(n, 5);
        assert_eq!(&buf[..5], b"hello");
        // Subsequent read returns 0.
        assert_eq!(d.read(&mut buf), 0);
    }

    #[test]
    fn runner_step_advances_tick_and_broadcasts() {
        let mut runner: SporeRunner<8, 4> = SporeRunner::new(0xCC01, 1);
        let mut driver = PairedDriver::new();
        runner.observe_local_event(b"alrm", 0x42, 100);
        runner.step(&mut driver, 100);
        // One frame (32 bytes) emitted: hash-list announcement.
        assert_eq!(driver.tx_len, 32);
    }

    #[test]
    fn runner_handles_inbound_event_delta_chunk() {
        // Build a 2-record envelope and feed it via the loopback.
        let mut runner: SporeRunner<8, 4> = SporeRunner::new(0xCC01, 100);
        let mut driver = PairedDriver::new();

        let entries = [
            mk_event(0x10, b"alrm"),
            mk_event(0x20, b"alrm"),
        ];
        let mut frames = [SporeFrame::empty(); 4];
        let n = build_delta_chunk_frames(&entries, 0x42, 0, 100, 0, &mut frames);
        let mut wire = [0u8; 4 * SPORE_FRAME_BYTES];
        for i in 0..n {
            let off = i * SPORE_FRAME_BYTES;
            wire[off..off + SPORE_FRAME_BYTES].copy_from_slice(&frames[i].as_bytes());
        }
        driver.local.deliver(&wire[..n * SPORE_FRAME_BYTES]);
        runner.step(&mut driver, 200);
        assert_eq!(runner.sink_len(), 2);
        assert_eq!(runner.envelopes_completed, 1);
    }

    #[test]
    fn runner_resyncs_on_garbage_then_valid_frame() {
        let mut runner: SporeRunner<4, 4> = SporeRunner::new(0xCC01, 100);
        let mut driver = PairedDriver::new();
        // Garbage prefix.
        driver.local.deliver(&[0x00, 0xFF, 0x12, 0x34, 0x56]);
        // Then a valid hash-list frame.
        let frame = SporeFrame::heartbeat(0xAA, 1);
        driver.local.deliver(&frame.as_bytes());
        runner.step(&mut driver, 100);
        // Heartbeat is not handled at this layer; we count frame_received.
        assert_eq!(runner.frames_received, 1);
    }

    #[test]
    fn paired_runners_converge_via_driver() {
        // Two runners, both with disjoint events.
        let mut a: SporeRunner<8, 8> = SporeRunner::new(0xAA, 1);
        let mut b: SporeRunner<8, 8> = SporeRunner::new(0xBB, 1);
        a.observe_local_event(b"alrm", 0x10, 0);
        a.observe_local_event(b"alrm", 0x20, 0);
        b.observe_local_event(b"alrm", 0x30, 0);
        b.observe_local_event(b"alrm", 0x40, 0);

        let mut da = PairedDriver::new();
        let mut db = PairedDriver::new();

        // Step 1: each emits its hash-list (broadcast_interval_ticks=1).
        a.step(&mut da, 100);
        b.step(&mut db, 100);
        // Cross-deliver hash-list frames.
        da.deliver_to_peer(&mut db);
        db.deliver_to_peer(&mut da);
        a.step(&mut da, 200); // a observes b's hash-list
        b.step(&mut db, 200); // b observes a's hash-list

        // Each side should know the other's anchor.
        assert!(a.last_peer_anchor != 0);
        assert!(b.last_peer_anchor != 0);

        // Step 2: each ships its full set as a delta to the other.
        // (The convergence driver in a future Era would compute the
        // set-difference, but here we just ship everything.)
        let a_entries = [mk_event(0x10, b"alrm"), mk_event(0x20, b"alrm")];
        let b_entries = [mk_event(0x30, b"alrm"), mk_event(0x40, b"alrm")];
        a.ship_delta(&mut da, &a_entries, b.anchor(), 300);
        b.ship_delta(&mut db, &b_entries, a.anchor(), 300);
        da.deliver_to_peer(&mut db);
        db.deliver_to_peer(&mut da);

        a.step(&mut da, 400);
        b.step(&mut db, 400);

        // Both sinks now hold the full union {10, 20, 30, 40}.
        assert_eq!(a.sink_len(), 4);
        assert_eq!(b.sink_len(), 4);
        assert_eq!(a.anchor(), b.anchor());
    }

    #[test]
    fn schema_constant() {
        assert_eq!(RUNNER_SCHEMA, "OMEGA-1450/v1");
    }

    fn mk_event(h: u32, kind: &[u8]) -> ForensicEvent {
        let mut e = ForensicEvent::empty();
        let n = if kind.len() > 16 { 16 } else { kind.len() };
        e.kind_bytes[..n].copy_from_slice(&kind[..n]);
        e.kind_len = n as u8;
        e.event_hash = h;
        e
    }
}
