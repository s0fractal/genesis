// Spore Event Sync Loop

// Eras 1400–1420 gave the Cortex-M4F spore everything it needs as
// individual primitives:

// • `ForensicEventSink<N>` storage with chain-anchor.
// • wire frame format for chunked event deltas.
// • frame builders + broadcast queue.

// What was missing: the ingest path. A spore receiving frames over
// the wire couldn't yet reassemble them into a delta, verify
// integrity, and apply it to the local sink — that work still
// happened in JS.

// Era 1430 ports the receive path to Rust. With this module a
// pair of spores connected by UART loopback can converge their
// event sets standalone, no JS relay required.

// PROVIDED:

// • `EventDeltaAccumulator<C>` — `no_std` reassembler. Frames
// dropped in via `ingest_frame`; once a complete envelope is
// present, `try_complete` returns the parsed delta.

// • `apply_event_delta` — pure function that merges a parsed
// delta into a local sink with collision rejection; mirrors
// the JS `applyEventDelta` semantics.

// • `PeerSyncSlot` — per-peer scheduler state (next_attempt_ms,
// consecutive_failures, last_success_ms). Fixed-table version
// of Era 1330's `PeerSyncState` for embedded use.

// CROSS-SUBSTRATE: applying a delta on the spore yields the same
// `event_chain_anchor` as applying the same delta on the JS side
// — both substrates running this code reach byte-identical
// convergence.

use crate::forensic_event_sink::{
    event_hash_set_hash,
    ForensicEvent,
    ForensicEventSink,
};
use crate::spore_frame::{FRAME_TYPE_EVENT_DELTA_CHUNK, SporeFrame};

pub const SYNC_LOOP_SCHEMA: &str = "OMEGA-1430/v1";

/// Maximum chunks a single envelope can carry on the spore. Each
/// chunk is one event entry, so this caps the per-envelope event
/// count. Tunable upward at the cost of SRAM.
pub const MAX_CHUNKS: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccumulateOutcome {
    /// Frame accepted; envelope still incomplete.
    Pending,
    /// Frame ignored (wrong type, mismatched envelope, dup w/o
    /// conflict, etc.). Caller continues feeding frames.
    Ignored,
    /// Detected corruption (conflicting payload at same sequence).
    /// The accumulator self-resets; caller may log the event.
    Corruption,
    /// Envelope complete and verified — call `take_delta` to
    /// retrieve the parsed result.
    Complete,
}

/// Reassembled event-delta envelope, returned by
/// `EventDeltaAccumulator::take_delta`. Mirrors the relevant
/// portion of the JS `EventDelta`.
pub struct ReassembledDelta<const C: usize> {
    pub envelope_hash: u32,
    pub initiator_anchor: u32,
    pub replied_at_ms: u32,
    pub entry_count: usize,
    pub entries: [ForensicEvent; C],
}

/// Fixed-capacity reassembler. Holds at most `C` chunk frames
/// (header + records). Caller is responsible for sizing `C` to
/// the largest envelope they expect.
pub struct EventDeltaAccumulator<const C: usize> {
    /// `frames[i]` holds the chunk for `sequence == i`. `present[i]`
    /// flags whether we've received it.
    frames: [SporeFrame; C],
    present: [bool; C],
    /// First-frame envelope_hash; subsequent frames must match.
    envelope_hash: u32,
    /// Total chunks the envelope claims (from header or first record).
    total: u16,
    /// Whether the accumulator has seen at least one frame.
    armed: bool,
    /// Whether corruption has been observed; further frames ignored
    /// until `reset`.
    corrupted: bool,
}

impl<const C: usize> Default for EventDeltaAccumulator<C> {
    fn default() -> Self {
        Self::new()
    }
}

impl<const C: usize> EventDeltaAccumulator<C> {
    pub const fn new() -> Self {
        Self {
            frames: [SporeFrame::empty(); C],
            present: [false; C],
            envelope_hash: 0,
            total: 0,
            armed: false,
            corrupted: false,
        }
    }

    pub fn reset(&mut self) {
        self.present = [false; C];
        self.envelope_hash = 0;
        self.total = 0;
        self.armed = false;
        self.corrupted = false;
    }

    pub fn is_complete(&self) -> bool {
        if !self.armed || self.corrupted { return false; }
        // Header (seq=0) + records (1..total) all present.
        let need = self.total as usize + 1;
        if need > C { return false; }
        for i in 0..need {
            if !self.present[i] { return false; }
        }
        true
    }

    /// Ingest one wire frame. Returns the outcome — `Pending` if
    /// it advanced state, `Complete` if the envelope just became
    /// whole, `Ignored` for non-applicable frames, `Corruption`
    /// on conflicting-payload-at-same-sequence.
    pub fn ingest_frame(&mut self, f: SporeFrame) -> AccumulateOutcome {
        if self.corrupted { return AccumulateOutcome::Ignored; }
        if f.frame_type != FRAME_TYPE_EVENT_DELTA_CHUNK {
            return AccumulateOutcome::Ignored;
        }
        let seq = ((f._reserved >> 16) & 0xFFFF) as u16;
        let total = (f._reserved & 0xFFFF) as u16;

        if !self.armed {
            self.envelope_hash = f.tick;
            self.total = total;
            self.armed = true;
        } else {
            if f.tick != self.envelope_hash {
                return AccumulateOutcome::Ignored;
            }
            if total != self.total {
                self.corrupted = true;
                return AccumulateOutcome::Corruption;
            }
        }
        let idx = seq as usize;
        if idx >= C { return AccumulateOutcome::Ignored; }
        if self.present[idx] {
            // Duplicate: must be byte-identical.
            let existing = &self.frames[idx];
            if existing.proposal_or_target != f.proposal_or_target
                || existing.payload_a != f.payload_a
                || existing.payload_b != f.payload_b
                || existing.payload_c != f.payload_c
                || existing._reserved != f._reserved
            {
                self.corrupted = true;
                return AccumulateOutcome::Corruption;
            }
            return AccumulateOutcome::Ignored;
        }
        self.frames[idx] = f;
        self.present[idx] = true;

        if self.is_complete() {
            AccumulateOutcome::Complete
        } else {
            AccumulateOutcome::Pending
        }
    }

    /// Move the reassembled delta out of the accumulator. Returns
    /// `None` if not yet complete or self-verification fails.
    /// Self-verification: recomputed envelope_hash from the
    /// reconstructed entries' hash set must equal the claimed
    /// envelope_hash. Drift signals tampering.
    pub fn take_delta(&mut self) -> Option<ReassembledDelta<C>> {
        if !self.is_complete() { return None; }
        let total = self.total as usize;
        let header = &self.frames[0];
        let mut entries = [ForensicEvent::empty(); C];
        let mut hashes = [0u32; C];
        for s in 1..=total {
            let f = &self.frames[s];
            let mut e = ForensicEvent::empty();
            // Decode kind tag from payload_b (4 bytes BE → ASCII).
            let kind_word = f.payload_b;
            for i in 0..4 {
                let b = ((kind_word >> (24 - 8 * i)) & 0xFF) as u8;
                if b == 0 { break; }
                e.kind_bytes[i] = b;
                e.kind_len += 1;
            }
            e.event_hash = f.proposal_or_target;
            e.sunk_at_ms = header.payload_b;
            e.sequence = 0;
            e.prev_chain_hash = 0;
            e.chain_hash = f.payload_c;
            entries[s - 1] = e;
            hashes[s - 1] = f.proposal_or_target;
        }
        // Sort hashes to recompute the envelope hash.
        for i in 1..total {
            let mut j = i;
            while j > 0 && hashes[j - 1] > hashes[j] {
                hashes.swap(j - 1, j);
                j -= 1;
            }
        }
        let recomputed = event_hash_set_hash(&hashes[..total]);
        if recomputed != self.envelope_hash { return None; }

        let result = ReassembledDelta {
            envelope_hash: self.envelope_hash,
            initiator_anchor: header.payload_a,
            replied_at_ms: header.payload_b,
            entry_count: total,
            entries,
        };
        self.reset();
        Some(result)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApplyOutcome {
    Ok { added: u32, skipped: u32, new_anchor: u32 },
    BadSchema,
    Collision,
}

/// Apply a reassembled delta to a local sink. Mirrors the JS
/// `applyEventDelta` semantics:
/// • Same event_hash with different `kind` → Collision.
/// • Same event_hash with same `kind` → idempotent skip.
/// • New event_hash → append to local sink (gets fresh
/// local chain hash + sequence).
///
/// On error the local sink is unchanged (no partial merges).
pub fn apply_event_delta<const C: usize, const N: usize>(
    sink: &mut ForensicEventSink<N>,
    delta: &ReassembledDelta<C>,
    now_ms: u32,
) -> ApplyOutcome {
    // Step 1: verify no collisions before mutating anything.
    for i in 0..delta.entry_count {
        let e = &delta.entries[i];
        for existing in sink.entries() {
            if existing.event_hash == e.event_hash
                && existing.kind() != e.kind() {
                    return ApplyOutcome::Collision;
                }
        }
    }
    // Step 2: count what's new vs idempotent.
    let mut added: u32 = 0;
    let mut skipped: u32 = 0;
    for i in 0..delta.entry_count {
        let e = &delta.entries[i];
        let mut found = false;
        for existing in sink.entries() {
            if existing.event_hash == e.event_hash { found = true; break; }
        }
        if found {
            skipped += 1;
        } else {
            sink.append(e.kind(), e.event_hash, now_ms);
            added += 1;
        }
    }
    ApplyOutcome::Ok {
        added,
        skipped,
        new_anchor: sink.event_chain_anchor(),
    }
}


// SCHEDULER


#[derive(Debug, Clone, Copy)]
pub struct PeerSyncSlot {
    pub peer_id: u32,
    pub last_attempt_ms: u32,
    pub last_success_ms: u32,
    pub consecutive_failures: u32,
    pub next_attempt_ms: u32,
}

impl PeerSyncSlot {
    pub const fn new(peer_id: u32) -> Self {
        Self {
            peer_id,
            last_attempt_ms: 0,
            last_success_ms: 0,
            consecutive_failures: 0,
            next_attempt_ms: 0,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SchedulerOpts {
    pub base_interval_ms: u32,
    pub backoff_multiplier: u32,
    pub max_backoff_ms: u32,
    pub failure_giveup_count: u32,
}

impl SchedulerOpts {
    pub const fn defaults() -> Self {
        Self {
            base_interval_ms: 30_000,
            backoff_multiplier: 2,
            max_backoff_ms: 600_000,
            failure_giveup_count: 6,
        }
    }
}

pub fn should_sync_now(slot: &PeerSyncSlot, now_ms: u32) -> bool {
    now_ms >= slot.next_attempt_ms
}

pub fn record_sync_attempt(slot: &mut PeerSyncSlot, now_ms: u32) {
    slot.last_attempt_ms = now_ms;
}

pub fn record_sync_success(slot: &mut PeerSyncSlot, opts: &SchedulerOpts, now_ms: u32) {
    slot.last_success_ms = now_ms;
    slot.consecutive_failures = 0;
    slot.next_attempt_ms = now_ms.saturating_add(opts.base_interval_ms);
}

pub fn record_sync_failure(slot: &mut PeerSyncSlot, opts: &SchedulerOpts, now_ms: u32) {
    let failures = slot.consecutive_failures + 1;
    slot.consecutive_failures = failures;
    let mut backoff: u64 = opts.base_interval_ms as u64;
    for _ in 0..failures {
        backoff = backoff.saturating_mul(opts.backoff_multiplier as u64);
        if backoff > opts.max_backoff_ms as u64 { backoff = opts.max_backoff_ms as u64; }
    }
    slot.next_attempt_ms = now_ms.saturating_add(backoff as u32);
}

pub fn is_peer_cold(slot: &PeerSyncSlot, opts: &SchedulerOpts) -> bool {
    slot.consecutive_failures >= opts.failure_giveup_count
}


// HASH-LIST RESPONSE ACCUMULATOR


/// Maximum hashes a single response envelope can carry on the
/// spore. At 4 hashes per frame, this caps the per-response
/// hash count.
pub const MAX_RESPONSE_HASHES: usize = 64;

/// Reassembled hash-list response.
pub struct ReassembledHashList {
    pub request_id: u32,
    pub hashes: [u32; MAX_RESPONSE_HASHES],
    pub hash_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HashAccOutcome {
    Pending,
    Ignored,
    Corruption,
    Complete,
}

/// Fixed-capacity reassembler for HASH_RESPONSE chunks. Filters
/// by `request_id` once a non-zero one has been observed.
pub struct HashListAccumulator<const C: usize> {
    chunks: [crate::spore_frame::SporeFrame; C],
    present: [bool; C],
    request_id: u32,
    total: u8,
    armed: bool,
    corrupted: bool,
}

impl<const C: usize> Default for HashListAccumulator<C> {
    fn default() -> Self {
        Self::new()
    }
}

impl<const C: usize> HashListAccumulator<C> {
    pub const fn new() -> Self {
        Self {
            chunks: [crate::spore_frame::SporeFrame::empty(); C],
            present: [false; C],
            request_id: 0,
            total: 0,
            armed: false,
            corrupted: false,
        }
    }

    pub fn reset(&mut self) {
        self.present = [false; C];
        self.request_id = 0;
        self.total = 0;
        self.armed = false;
        self.corrupted = false;
    }

    pub fn current_request_id(&self) -> u32 { self.request_id }

    pub fn ingest_frame(&mut self, f: crate::spore_frame::SporeFrame) -> HashAccOutcome {
        use crate::spore_frame::FRAME_TYPE_EVENT_HASH_RESPONSE;
        if self.corrupted { return HashAccOutcome::Ignored; }
        if f.frame_type != FRAME_TYPE_EVENT_HASH_RESPONSE {
            return HashAccOutcome::Ignored;
        }
        let seq = ((f._reserved >> 24) & 0xFF) as u8;
        let total = ((f._reserved >> 16) & 0xFF) as u8;
        if seq == 0 || seq > total { return HashAccOutcome::Ignored; }
        if !self.armed {
            self.request_id = f.tick;
            self.total = total;
            self.armed = true;
        } else {
            if f.tick != self.request_id { return HashAccOutcome::Ignored; }
            if total != self.total {
                self.corrupted = true;
                return HashAccOutcome::Corruption;
            }
        }
        let idx = (seq - 1) as usize;
        if idx >= C { return HashAccOutcome::Ignored; }
        if self.present[idx] {
            let existing = &self.chunks[idx];
            if existing.proposal_or_target != f.proposal_or_target
                || existing.payload_a != f.payload_a
                || existing.payload_b != f.payload_b
                || existing.payload_c != f.payload_c
                || existing._reserved != f._reserved
            {
                self.corrupted = true;
                return HashAccOutcome::Corruption;
            }
            return HashAccOutcome::Ignored;
        }
        self.chunks[idx] = f;
        self.present[idx] = true;
        if self.is_complete() {
            HashAccOutcome::Complete
        } else {
            HashAccOutcome::Pending
        }
    }

    pub fn is_complete(&self) -> bool {
        if !self.armed || self.corrupted { return false; }
        let need = self.total as usize;
        if need == 0 || need > C { return false; }
        for i in 0..need {
            if !self.present[i] { return false; }
        }
        true
    }

    pub fn take(&mut self) -> Option<ReassembledHashList> {
        if !self.is_complete() { return None; }
        let mut hashes = [0u32; MAX_RESPONSE_HASHES];
        let mut count = 0usize;
        for i in 0..(self.total as usize) {
            let f = &self.chunks[i];
            let valid = ((f._reserved >> 8) & 0xFF) as usize;
            let slots = [f.proposal_or_target, f.payload_a, f.payload_b, f.payload_c];
            let take = if valid > 4 { 4 } else { valid };
            for j in 0..take {
                if count < MAX_RESPONSE_HASHES {
                    hashes[count] = slots[j];
                    count += 1;
                }
            }
        }
        // Sort ascending for deterministic downstream handling.
        for i in 1..count {
            let mut j = i;
            while j > 0 && hashes[j - 1] > hashes[j] {
                hashes.swap(j - 1, j);
                j -= 1;
            }
        }
        let result = ReassembledHashList {
            request_id: self.request_id,
            hashes,
            hash_count: count,
        };
        self.reset();
        Some(result)
    }
}

/// Compute the indices of `local_entries` whose `event_hash` is
/// NOT in `peer_hashes` — i.e. entries the peer is missing.
/// Returns the count written into `out_indices`.
pub fn compute_missing_indices(
    local_entries: &[ForensicEvent],
    peer_hashes: &[u32],
    out_indices: &mut [usize],
) -> usize {
    let mut count = 0usize;
    'outer: for (i, e) in local_entries.iter().enumerate() {
        for &h in peer_hashes {
            if h == e.event_hash { continue 'outer; }
        }
        if count < out_indices.len() {
            out_indices[count] = i;
            count += 1;
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event_broadcast::build_delta_chunk_frames;

    fn mk_event(h: u32, kind: &[u8]) -> ForensicEvent {
        let mut e = ForensicEvent::empty();
        let n = core::cmp::min(kind.len(), 16);
        e.kind_bytes[..n].copy_from_slice(&kind[..n]);
        e.kind_len = n as u8;
        e.event_hash = h;
        e
    }

    #[test]
    fn accumulator_completes_full_envelope() {
        let entries = [mk_event(0x10, b"alrm"), mk_event(0x20, b"alrm")];
        let mut frames = [SporeFrame::empty(); 8];
        let n = build_delta_chunk_frames(&entries, 0x42, 0xAAAA, 100, 0, &mut frames);
        assert_eq!(n, 3);

        let mut acc: EventDeltaAccumulator<8> = EventDeltaAccumulator::new();
        assert_eq!(acc.ingest_frame(frames[0]), AccumulateOutcome::Pending);
        assert_eq!(acc.ingest_frame(frames[1]), AccumulateOutcome::Pending);
        assert_eq!(acc.ingest_frame(frames[2]), AccumulateOutcome::Complete);
        let delta = acc.take_delta().expect("delta");
        assert_eq!(delta.entry_count, 2);
        assert_eq!(delta.entries[0].event_hash, 0x10);
        assert_eq!(delta.entries[1].event_hash, 0x20);
    }

    #[test]
    fn accumulator_handles_out_of_order() {
        let entries = [mk_event(0x10, b"a"), mk_event(0x20, b"a"), mk_event(0x30, b"a")];
        let mut frames = [SporeFrame::empty(); 8];
        build_delta_chunk_frames(&entries, 0x42, 0, 0, 0, &mut frames);

        let mut acc: EventDeltaAccumulator<8> = EventDeltaAccumulator::new();
        // Ingest in reverse order.
        let _ = acc.ingest_frame(frames[3]);
        let _ = acc.ingest_frame(frames[2]);
        let _ = acc.ingest_frame(frames[1]);
        let outcome = acc.ingest_frame(frames[0]);
        assert_eq!(outcome, AccumulateOutcome::Complete);
    }

    #[test]
    fn accumulator_dedups_duplicates() {
        let entries = [mk_event(0x10, b"a")];
        let mut frames = [SporeFrame::empty(); 4];
        build_delta_chunk_frames(&entries, 0x42, 0, 0, 0, &mut frames);

        let mut acc: EventDeltaAccumulator<4> = EventDeltaAccumulator::new();
        let _ = acc.ingest_frame(frames[0]);
        let _ = acc.ingest_frame(frames[1]);
        let _ = acc.ingest_frame(frames[1]); // dup
        let _ = acc.ingest_frame(frames[0]); // dup
        assert!(acc.is_complete());
    }

    #[test]
    fn accumulator_detects_corruption() {
        let entries = [mk_event(0x10, b"a"), mk_event(0x20, b"a")];
        let mut frames = [SporeFrame::empty(); 4];
        build_delta_chunk_frames(&entries, 0x42, 0, 0, 0, &mut frames);

        let mut acc: EventDeltaAccumulator<4> = EventDeltaAccumulator::new();
        let _ = acc.ingest_frame(frames[0]);
        let _ = acc.ingest_frame(frames[1]);
        // Tamper with frame[1] and re-ingest.
        let mut tampered = frames[1];
        tampered.proposal_or_target = 0xDEAD;
        let outcome = acc.ingest_frame(tampered);
        assert_eq!(outcome, AccumulateOutcome::Corruption);
    }

    #[test]
    fn accumulator_drops_cross_envelope_frames() {
        let entries_a = [mk_event(0x10, b"a"), mk_event(0x20, b"a")];
        let entries_b = [mk_event(0x30, b"a"), mk_event(0x40, b"a")];
        let mut frames_a = [SporeFrame::empty(); 4];
        let mut frames_b = [SporeFrame::empty(); 4];
        build_delta_chunk_frames(&entries_a, 0x42, 0, 0, 0, &mut frames_a);
        build_delta_chunk_frames(&entries_b, 0x43, 0, 0, 0, &mut frames_b);

        let mut acc: EventDeltaAccumulator<4> = EventDeltaAccumulator::new();
        let _ = acc.ingest_frame(frames_a[0]);
        // Cross-envelope frame ignored.
        assert_eq!(acc.ingest_frame(frames_b[1]), AccumulateOutcome::Ignored);
        let _ = acc.ingest_frame(frames_a[1]);
        let outcome = acc.ingest_frame(frames_a[2]);
        assert_eq!(outcome, AccumulateOutcome::Complete);
    }

    #[test]
    fn apply_event_delta_imports_with_fresh_chain() {
        let mut sink: ForensicEventSink<8> = ForensicEventSink::new();
        sink.append(b"alrm", 0x10, 100);

        let entries = [mk_event(0x20, b"alrm"), mk_event(0x30, b"alrm")];
        let mut frames = [SporeFrame::empty(); 4];
        build_delta_chunk_frames(&entries, 0x42, 0, 100, 0, &mut frames);

        let mut acc: EventDeltaAccumulator<4> = EventDeltaAccumulator::new();
        for f in &frames[..3] { let _ = acc.ingest_frame(*f); }
        let delta = acc.take_delta().expect("delta");
        let outcome = apply_event_delta(&mut sink, &delta, 200);
        match outcome {
            ApplyOutcome::Ok { added, skipped, .. } => {
                assert_eq!(added, 2);
                assert_eq!(skipped, 0);
            }
            other => panic!("expected Ok, got {:?}", other),
        }
        assert_eq!(sink.len(), 3);
        // Chain still verifies after import.
        assert_eq!(sink.verify_chain(), None);
    }

    #[test]
    fn apply_event_delta_collision_rejected() {
        let mut sink: ForensicEventSink<4> = ForensicEventSink::new();
        sink.append(b"alrm", 0x42, 100);

        let entries = [mk_event(0x42, b"vrdt")]; // same hash, different kind
        let mut frames = [SporeFrame::empty(); 2];
        build_delta_chunk_frames(&entries, 0x42, 0, 100, 0, &mut frames);

        let mut acc: EventDeltaAccumulator<2> = EventDeltaAccumulator::new();
        for f in &frames[..2] { let _ = acc.ingest_frame(*f); }
        let delta = acc.take_delta().expect("delta");
        let outcome = apply_event_delta(&mut sink, &delta, 200);
        assert_eq!(outcome, ApplyOutcome::Collision);
        // Sink unchanged.
        assert_eq!(sink.len(), 1);
    }

    #[test]
    fn apply_event_delta_idempotent_skip() {
        let mut sink: ForensicEventSink<4> = ForensicEventSink::new();
        sink.append(b"alrm", 0x42, 100);

        let entries = [mk_event(0x42, b"alrm")]; // same hash + same kind
        let mut frames = [SporeFrame::empty(); 2];
        build_delta_chunk_frames(&entries, 0x42, 0, 100, 0, &mut frames);

        let mut acc: EventDeltaAccumulator<2> = EventDeltaAccumulator::new();
        for f in &frames[..2] { let _ = acc.ingest_frame(*f); }
        let delta = acc.take_delta().expect("delta");
        let outcome = apply_event_delta(&mut sink, &delta, 200);
        match outcome {
            ApplyOutcome::Ok { added, skipped, .. } => {
                assert_eq!(added, 0);
                assert_eq!(skipped, 1);
            }
            _ => panic!("expected Ok"),
        }
    }

    #[test]
    fn two_spores_converge_via_round_trip() {
        // Spore A has [0x10, 0x20]; Spore B has [0x20, 0x30].
        let mut a: ForensicEventSink<8> = ForensicEventSink::new();
        let mut b: ForensicEventSink<8> = ForensicEventSink::new();
        a.append(b"alrm", 0x10, 0);
        a.append(b"alrm", 0x20, 0);
        b.append(b"alrm", 0x20, 0);
        b.append(b"alrm", 0x30, 0);

        // Simulate "B sends A what A is missing": B's missing-from-A is just 0x30.
        let to_a = [mk_event(0x30, b"alrm")];
        let mut frames = [SporeFrame::empty(); 4];
        build_delta_chunk_frames(&to_a, 0x42, 0, 100, 0, &mut frames);
        let mut acc_a: EventDeltaAccumulator<4> = EventDeltaAccumulator::new();
        for f in &frames[..2] { let _ = acc_a.ingest_frame(*f); }
        let delta_a = acc_a.take_delta().unwrap();
        let _ = apply_event_delta(&mut a, &delta_a, 100);

        // Simulate "A sends B what B is missing": now A has [10,20,30],
        // B's missing-from-A is 0x10.
        let to_b = [mk_event(0x10, b"alrm")];
        let mut frames = [SporeFrame::empty(); 4];
        build_delta_chunk_frames(&to_b, 0x42, 0, 100, 0, &mut frames);
        let mut acc_b: EventDeltaAccumulator<4> = EventDeltaAccumulator::new();
        for f in &frames[..2] { let _ = acc_b.ingest_frame(*f); }
        let delta_b = acc_b.take_delta().unwrap();
        let _ = apply_event_delta(&mut b, &delta_b, 100);

        // Both sinks now hold the same set; anchors must match.
        assert_eq!(a.event_chain_anchor(), b.event_chain_anchor());
        assert_eq!(a.len(), 3);
        assert_eq!(b.len(), 3);
    }

    // --- Scheduler ---

    #[test]
    fn scheduler_fresh_peer_due_immediately() {
        let s = PeerSyncSlot::new(0xAA);
        assert!(should_sync_now(&s, 100));
    }

    #[test]
    fn scheduler_success_defers_next_attempt() {
        let opts = SchedulerOpts::defaults();
        let mut s = PeerSyncSlot::new(0xAA);
        record_sync_attempt(&mut s, 100);
        record_sync_success(&mut s, &opts, 100);
        assert!(!should_sync_now(&s, 1000));
        assert!(should_sync_now(&s, 100 + opts.base_interval_ms));
    }

    #[test]
    fn scheduler_failure_backoff_progresses() {
        let opts = SchedulerOpts {
            base_interval_ms: 1000,
            backoff_multiplier: 2,
            max_backoff_ms: 60_000,
            failure_giveup_count: 6,
        };
        let mut s = PeerSyncSlot::new(0xAA);
        record_sync_failure(&mut s, &opts, 0);
        // First failure → 1000 * 2 = 2000 ms.
        assert_eq!(s.next_attempt_ms, 2000);
        record_sync_failure(&mut s, &opts, 2000);
        // Second failure → 1000 * 2 * 2 = 4000 ms from t=2000.
        assert_eq!(s.next_attempt_ms, 6000);
    }

    #[test]
    fn scheduler_backoff_capped() {
        let opts = SchedulerOpts {
            base_interval_ms: 1000,
            backoff_multiplier: 10,
            max_backoff_ms: 5000,
            failure_giveup_count: 10,
        };
        let mut s = PeerSyncSlot::new(0xAA);
        for i in 0..5 {
            record_sync_failure(&mut s, &opts, i * 5000);
        }
        assert!(s.next_attempt_ms - 5 * 5000 + 5000 <= 5000 * 2);
    }

    #[test]
    fn scheduler_cold_after_threshold() {
        let opts = SchedulerOpts { failure_giveup_count: 3, ..SchedulerOpts::defaults() };
        let mut s = PeerSyncSlot::new(0xAA);
        for i in 0..3 {
            record_sync_failure(&mut s, &opts, i * 100);
        }
        assert!(is_peer_cold(&s, &opts));
    }

    #[test]
    fn schema_constant() {
        assert_eq!(SYNC_LOOP_SCHEMA, "OMEGA-1430/v1");
    }

    // --- Hash-list accumulator tests ---

    use crate::spore_frame::SporeFrame as SF;

    fn build_response_chunk(
        request_id: u32, seq: u8, total: u8, valid: u8, hashes: &[u32; 4],
    ) -> SF {
        SF::event_hash_response(request_id, seq, total, valid, hashes)
    }

    #[test]
    fn hash_acc_single_chunk_completes() {
        let mut acc: HashListAccumulator<8> = HashListAccumulator::new();
        let f = build_response_chunk(99, 1, 1, 3, &[0x10, 0x20, 0x30, 0]);
        let out = acc.ingest_frame(f);
        assert_eq!(out, HashAccOutcome::Complete);
        let r = acc.take().expect("take");
        assert_eq!(r.request_id, 99);
        assert_eq!(r.hash_count, 3);
        assert_eq!(&r.hashes[..3], &[0x10, 0x20, 0x30]);
    }

    #[test]
    fn hash_acc_multi_chunk_out_of_order() {
        let mut acc: HashListAccumulator<8> = HashListAccumulator::new();
        let f1 = build_response_chunk(7, 1, 2, 4, &[0x10, 0x20, 0x30, 0x40]);
        let f2 = build_response_chunk(7, 2, 2, 2, &[0x50, 0x60, 0, 0]);
        // Reverse order.
        let _ = acc.ingest_frame(f2);
        let out = acc.ingest_frame(f1);
        assert_eq!(out, HashAccOutcome::Complete);
        let r = acc.take().expect("take");
        assert_eq!(r.hash_count, 6);
        assert_eq!(&r.hashes[..6], &[0x10, 0x20, 0x30, 0x40, 0x50, 0x60]);
    }

    #[test]
    fn hash_acc_dedup_idempotent() {
        let mut acc: HashListAccumulator<8> = HashListAccumulator::new();
        let f = build_response_chunk(1, 1, 1, 2, &[0x10, 0x20, 0, 0]);
        let _ = acc.ingest_frame(f);
        let out = acc.ingest_frame(f);
        // Re-ingest of identical frame is Ignored, not Corruption.
        assert_eq!(out, HashAccOutcome::Ignored);
        // Accumulator was already complete on first ingest.
        let r = acc.take().expect("take");
        assert_eq!(r.hash_count, 2);
    }

    #[test]
    fn hash_acc_corruption_on_conflict() {
        let mut acc: HashListAccumulator<8> = HashListAccumulator::new();
        let f1 = build_response_chunk(1, 1, 2, 4, &[0x10, 0x20, 0x30, 0x40]);
        let mut f1_tampered = f1;
        f1_tampered.proposal_or_target = 0xDEAD;
        // Recompute CRC so it parses.
        f1_tampered.crc32 = f1_tampered.compute_crc();
        let _ = acc.ingest_frame(f1);
        let out = acc.ingest_frame(f1_tampered);
        assert_eq!(out, HashAccOutcome::Corruption);
    }

    #[test]
    fn hash_acc_filters_cross_request_id() {
        let mut acc: HashListAccumulator<8> = HashListAccumulator::new();
        let f_a = build_response_chunk(1, 1, 1, 1, &[0x10, 0, 0, 0]);
        let f_b = build_response_chunk(2, 1, 1, 1, &[0xAA, 0, 0, 0]);
        let _ = acc.ingest_frame(f_a);
        let out = acc.ingest_frame(f_b);
        // Different request_id → Ignored, not consumed.
        assert_eq!(out, HashAccOutcome::Ignored);
        let r = acc.take().expect("take");
        assert_eq!(r.hashes[0], 0x10);
    }

    #[test]
    fn hash_acc_rejects_seq_zero_or_overflow() {
        let mut acc: HashListAccumulator<8> = HashListAccumulator::new();
        let f0 = build_response_chunk(1, 0, 1, 1, &[0x10, 0, 0, 0]);
        assert_eq!(acc.ingest_frame(f0), HashAccOutcome::Ignored);
        let f_oob = build_response_chunk(1, 5, 2, 1, &[0x10, 0, 0, 0]);
        assert_eq!(acc.ingest_frame(f_oob), HashAccOutcome::Ignored);
    }

    #[test]
    fn compute_missing_indices_basic() {
        let entries = [
            mk_event(0x10, b"a"),
            mk_event(0x20, b"a"),
            mk_event(0x30, b"a"),
        ];
        let peer = [0x10u32, 0x40, 0x50];
        let mut out = [0usize; 4];
        let n = compute_missing_indices(&entries, &peer, &mut out);
        assert_eq!(n, 2);
        // Indices 1 (0x20) and 2 (0x30) are missing from peer.
        assert_eq!(out[0], 1);
        assert_eq!(out[1], 2);
    }

    #[test]
    fn compute_missing_indices_peer_superset() {
        let entries = [mk_event(0x10, b"a")];
        let peer = [0x10u32, 0x20];
        let mut out = [0usize; 4];
        assert_eq!(compute_missing_indices(&entries, &peer, &mut out), 0);
    }

    #[test]
    fn compute_missing_indices_capped_by_out_size() {
        let entries = [
            mk_event(0x10, b"a"),
            mk_event(0x20, b"a"),
            mk_event(0x30, b"a"),
            mk_event(0x40, b"a"),
        ];
        let peer = [0u32; 0];
        let mut out = [0usize; 2];
        let n = compute_missing_indices(&entries, &peer, &mut out);
        assert_eq!(n, 2); // capped at out.len
    }
}
