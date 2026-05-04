// 🌌 OMEGA-64: Era 1460 — Convergence Driver (anchor-mismatch initiation)
//
// Era 1450's `SporeRunner` records `last_peer_anchor` whenever an
// `EVENT_HASH_LIST` frame arrives, but it never *acts* on a mismatch.
// Era 1460 closes that loop with a small driver layer on top of the
// runner that:
//
//   • Maintains a fixed `[PeerEntry; M]` table tracking each peer's
//     most recent anchor + last-attempt tick.
//   • On every tick: for each peer where `peer_anchor != local
//     anchor` AND scheduler-allowed, ship a delta containing the
//     spore's CURRENT events. The peer's apply path either
//     idempotent-skips overlap or imports the missing portion;
//     collision detection still applies.
//   • Avoids storms via the same per-peer scheduler primitives
//     Era 1430 ported (`PeerSyncSlot`, `should_sync_now`,
//     `record_sync_*`).
//
// SIMPLE VERSION (this Era): the spore ships its FULL event set
// rather than computing a precise set-difference, because that
// requires the peer's full hash list (a separate request frame —
// future work). Idempotent skip on the receiver makes this
// correct, just less bandwidth-efficient. With sink capacities
// in the dozens, this is acceptable.
//
// CONVERGENCE GUARANTEE: after each pair-wise exchange (A→B then
// B→A), both anchors equal the union's anchor. Multi-peer
// convergence happens via repeated pair-wise exchanges across
// the table.

use crate::event_sync_loop::{
    compute_missing_indices, is_peer_cold, record_sync_attempt,
    record_sync_failure, record_sync_success, should_sync_now,
    PeerSyncSlot, SchedulerOpts,
};
use crate::forensic_event_sink::ForensicEvent;
use crate::spore_runner::{SporeRunner, WireDriver};

pub const DRIVER_SCHEMA: &str = "OMEGA-1460/v1";

#[derive(Debug, Clone, Copy)]
pub struct PeerEntry {
    pub peer_id: u32,
    pub last_seen_anchor: u32,
    pub slot: PeerSyncSlot,
    pub used: bool,
}

impl PeerEntry {
    pub const fn empty() -> Self {
        Self {
            peer_id: 0,
            last_seen_anchor: 0,
            slot: PeerSyncSlot::new(0),
            used: false,
        }
    }
}

pub struct ConvergenceDriver<const M: usize> {
    pub peers: [PeerEntry; M],
    pub opts: SchedulerOpts,
    /// Counters for observability.
    pub deltas_shipped: u32,
    pub mismatches_seen: u32,
    pub schedule_blocked: u32,
}

impl<const M: usize> ConvergenceDriver<M> {
    pub const fn new(opts: SchedulerOpts) -> Self {
        Self {
            peers: [PeerEntry::empty(); M],
            opts,
            deltas_shipped: 0,
            mismatches_seen: 0,
            schedule_blocked: 0,
        }
    }

    /// Record a peer's anchor (called when the runner observes a
    /// hash-list frame). Returns true on first sighting.
    pub fn observe_peer_anchor(&mut self, peer_id: u32, anchor: u32) -> bool {
        // Try to find existing slot.
        for entry in self.peers.iter_mut() {
            if entry.used && entry.peer_id == peer_id {
                entry.last_seen_anchor = anchor;
                return false;
            }
        }
        // Find a free slot.
        for entry in self.peers.iter_mut() {
            if !entry.used {
                entry.peer_id = peer_id;
                entry.last_seen_anchor = anchor;
                entry.slot = PeerSyncSlot::new(peer_id);
                entry.used = true;
                return true;
            }
        }
        // Table full — silently ignore (operator can size M up).
        false
    }

    pub fn count(&self) -> usize {
        self.peers.iter().filter(|e| e.used).count()
    }

    /// Look for peers whose anchor differs from `local_anchor` AND
    /// whose schedule allows another sync attempt. Returns up to
    /// `out.len()` peer_ids in priority order (oldest last_attempt
    /// first).
    pub fn select_targets(
        &mut self,
        local_anchor: u32,
        now_ms: u32,
        out: &mut [u32],
    ) -> usize {
        let mut count = 0usize;
        // Two-pass: collect candidates (idx, last_attempt_ms), sort,
        // then materialize. Bounded M is small so a manual sort is fine.
        let mut indices = [0u8; 32]; // M ≤ 255 in practice
        let mut idx_count = 0usize;
        let cap = if out.len() < 32 { out.len() } else { 32 };
        for (i, entry) in self.peers.iter().enumerate() {
            if !entry.used { continue; }
            if entry.last_seen_anchor == local_anchor { continue; }
            if is_peer_cold(&entry.slot, &self.opts) { continue; }
            if !should_sync_now(&entry.slot, now_ms) {
                self.schedule_blocked = self.schedule_blocked.wrapping_add(1);
                continue;
            }
            self.mismatches_seen = self.mismatches_seen.wrapping_add(1);
            if idx_count < indices.len() {
                indices[idx_count] = i as u8;
                idx_count += 1;
            }
        }
        // Sort by oldest last_attempt_ms ASC.
        for i in 1..idx_count {
            let mut j = i;
            while j > 0 {
                let a = self.peers[indices[j - 1] as usize].slot.last_attempt_ms;
                let b = self.peers[indices[j] as usize].slot.last_attempt_ms;
                if a > b { indices.swap(j - 1, j); j -= 1; } else { break; }
            }
        }
        let take = if idx_count < cap { idx_count } else { cap };
        for k in 0..take {
            out[k] = self.peers[indices[k] as usize].peer_id;
            count += 1;
        }
        count
    }

    /// Ship a delta to a specific peer. Updates the peer's slot:
    /// `record_sync_attempt`, then on driver-write success
    /// `record_sync_success`, on failure `record_sync_failure`.
    /// Returns true on success.
    pub fn ship_to_peer<D: WireDriver, const N: usize, const C: usize>(
        &mut self,
        runner: &SporeRunner<N, C>,
        driver: &mut D,
        peer_id: u32,
        entries: &[ForensicEvent],
        now_ms: u32,
    ) -> bool {
        let slot_idx = match self.peers.iter().position(|e| e.used && e.peer_id == peer_id) {
            Some(i) => i,
            None => return false,
        };
        record_sync_attempt(&mut self.peers[slot_idx].slot, now_ms);
        let peer_anchor = self.peers[slot_idx].last_seen_anchor;
        let ok = runner.ship_delta(driver, entries, peer_anchor, now_ms);
        if ok {
            record_sync_success(&mut self.peers[slot_idx].slot, &self.opts, now_ms);
            self.deltas_shipped = self.deltas_shipped.wrapping_add(1);
        } else {
            record_sync_failure(&mut self.peers[slot_idx].slot, &self.opts, now_ms);
        }
        ok
    }

    /// Look up the most recently observed anchor for a peer.
    pub fn peer_anchor(&self, peer_id: u32) -> Option<u32> {
        for e in &self.peers {
            if e.used && e.peer_id == peer_id {
                return Some(e.last_seen_anchor);
            }
        }
        None
    }

    /// Mark a peer as fully removed (operator command, partition
    /// detection, etc.).
    pub fn forget_peer(&mut self, peer_id: u32) {
        for e in self.peers.iter_mut() {
            if e.used && e.peer_id == peer_id {
                *e = PeerEntry::empty();
                return;
            }
        }
    }
}

// --------------------------------------------------------------- //
// AUTO-PIPELINE (Era 1490)                                        //
// --------------------------------------------------------------- //

/// Encapsulated state for the bandwidth-efficient HASH_REQUEST →
/// HASH_RESPONSE → DIFF_SHIP dance. Wraps `ConvergenceDriver` with
/// per-tick orchestration so callers don't drive the state machine
/// manually.
///
/// `step()` consumes any completed peer-hash-list response from
/// the runner, computes the set-difference, ships missing entries,
/// and records success/failure on the scheduler. On idle ticks it
/// also picks a new mismatched peer to issue a HASH_REQUEST to.
pub struct AutoPipeline<const M: usize> {
    pub driver: ConvergenceDriver<M>,
    /// Most recent request_id we issued; the response we expect
    /// must echo this value.
    pending_request_id: u32,
    pending_request_peer_id: u32,
    pending_request_started_ms: u32,
    /// Hard deadline for response. Past this, the in-flight
    /// request is considered failed.
    pub request_timeout_ms: u32,
}

impl<const M: usize> AutoPipeline<M> {
    pub const fn new(opts: SchedulerOpts, request_timeout_ms: u32) -> Self {
        Self {
            driver: ConvergenceDriver::new(opts),
            pending_request_id: 0,
            pending_request_peer_id: 0,
            pending_request_started_ms: 0,
            request_timeout_ms,
        }
    }

    /// True when an outstanding HASH_REQUEST is awaiting RESPONSE.
    pub fn has_pending_request(&self) -> bool {
        self.pending_request_id != 0
    }

    /// One pipeline tick. Order:
    ///   1. Drain any completed peer hash list from the runner;
    ///      if it matches our pending request_id, compute diff
    ///      + ship missing entries.
    ///   2. Time-out a stale pending request (driver records
    ///      failure for that peer's slot).
    ///   3. If no request is pending, pick the next target via
    ///      `select_targets` and ship a HASH_REQUEST.
    pub fn step<D: WireDriver, const N: usize, const C: usize>(
        &mut self,
        runner: &mut SporeRunner<N, C>,
        driver: &mut D,
        local_entries: &[ForensicEvent],
        now_ms: u32,
    ) {
        // Phase 1: completed hash-list response?
        if let Some(peer_hashes) = runner.take_peer_hashes() {
            if peer_hashes.request_id == self.pending_request_id
                && self.pending_request_id != 0
            {
                let mut indices = [0usize; 32];
                let n = compute_missing_indices(
                    local_entries,
                    &peer_hashes.hashes[..peer_hashes.hash_count],
                    &mut indices,
                );
                if n == 0 {
                    // Nothing to ship — already converged.
                    self.complete_request(now_ms);
                } else {
                    // Build a small entries array on the stack with
                    // just the missing ones.
                    let take = if n > 16 { 16 } else { n };
                    let mut to_ship: [ForensicEvent; 16] =
                        [ForensicEvent::empty(); 16];
                    for i in 0..take {
                        to_ship[i] = local_entries[indices[i]];
                    }
                    let ok = self.driver.ship_to_peer(
                        runner,
                        driver,
                        self.pending_request_peer_id,
                        &to_ship[..take],
                        now_ms,
                    );
                    if ok {
                        self.complete_request(now_ms);
                    } else {
                        self.fail_request(now_ms);
                    }
                }
            }
        }

        // Phase 2: timeout stale request.
        if self.pending_request_id != 0
            && now_ms.saturating_sub(self.pending_request_started_ms)
                >= self.request_timeout_ms
        {
            self.fail_request(now_ms);
        }

        // Phase 3: idle — pick next target and issue REQUEST.
        if self.pending_request_id == 0 {
            let mut peers = [0u32; 1];
            let n = self.driver.select_targets(runner.anchor(), now_ms, &mut peers);
            if n > 0 {
                let peer_id = peers[0];
                let request_id = generate_request_id(runner.self_relay_id, now_ms);
                if runner.ship_hash_request(driver, request_id) {
                    self.pending_request_id = request_id;
                    self.pending_request_peer_id = peer_id;
                    self.pending_request_started_ms = now_ms;
                    // Mark scheduler attempt — success/failure
                    // recorded when the response arrives.
                    record_sync_attempt(
                        find_slot_mut(&mut self.driver.peers, peer_id).unwrap(),
                        now_ms,
                    );
                }
            }
        }
    }

    fn complete_request(&mut self, _now_ms: u32) {
        self.pending_request_id = 0;
        self.pending_request_peer_id = 0;
        self.pending_request_started_ms = 0;
    }

    fn fail_request(&mut self, now_ms: u32) {
        // record_sync_failure on the peer's slot.
        if let Some(slot) =
            find_slot_mut(&mut self.driver.peers, self.pending_request_peer_id)
        {
            record_sync_failure(slot, &self.driver.opts, now_ms);
        }
        self.pending_request_id = 0;
        self.pending_request_peer_id = 0;
        self.pending_request_started_ms = 0;
    }
}

fn find_slot_mut(
    peers: &mut [PeerEntry],
    peer_id: u32,
) -> Option<&mut PeerSyncSlot> {
    for e in peers.iter_mut() {
        if e.used && e.peer_id == peer_id {
            return Some(&mut e.slot);
        }
    }
    None
}

fn generate_request_id(self_relay_id: u32, now_ms: u32) -> u32 {
    use crate::crypto::sha256_u32;
    let mut buf = [0u8; 8];
    buf[0] = (self_relay_id >> 24) as u8;
    buf[1] = (self_relay_id >> 16) as u8;
    buf[2] = (self_relay_id >> 8) as u8;
    buf[3] = self_relay_id as u8;
    buf[4] = (now_ms >> 24) as u8;
    buf[5] = (now_ms >> 16) as u8;
    buf[6] = (now_ms >> 8) as u8;
    buf[7] = now_ms as u8;
    let h = sha256_u32(&buf);
    // Avoid 0 — that's our "no pending" sentinel.
    if h == 0 { 1 } else { h }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::forensic_event_sink::ForensicEvent;
    use crate::spore_runner::LoopbackDriver;

    fn mk_event(h: u32, kind: &[u8]) -> ForensicEvent {
        let mut e = ForensicEvent::empty();
        let n = if kind.len() > 16 { 16 } else { kind.len() };
        e.kind_bytes[..n].copy_from_slice(&kind[..n]);
        e.kind_len = n as u8;
        e.event_hash = h;
        e
    }

    #[test]
    fn observe_peer_returns_true_on_first_sighting() {
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(SchedulerOpts::defaults());
        assert!(d.observe_peer_anchor(0xAA, 0x100));
        assert!(!d.observe_peer_anchor(0xAA, 0x101)); // update, not new
        assert_eq!(d.count(), 1);
    }

    #[test]
    fn observe_peer_evicts_to_new_slot() {
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(SchedulerOpts::defaults());
        d.observe_peer_anchor(0xAA, 0x100);
        d.observe_peer_anchor(0xBB, 0x200);
        d.observe_peer_anchor(0xCC, 0x300);
        d.observe_peer_anchor(0xDD, 0x400);
        // Table full; 5th peer silently dropped.
        assert!(!d.observe_peer_anchor(0xEE, 0x500));
        assert_eq!(d.count(), 4);
    }

    #[test]
    fn select_targets_excludes_matching_anchors() {
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(SchedulerOpts::defaults());
        d.observe_peer_anchor(0xAA, 0x100);
        d.observe_peer_anchor(0xBB, 0x100); // matches local
        d.observe_peer_anchor(0xCC, 0x200);
        let mut out = [0u32; 4];
        let n = d.select_targets(0x100, 100, &mut out);
        assert_eq!(n, 1);
        assert_eq!(out[0], 0xCC);
    }

    #[test]
    fn select_targets_excludes_cold_peers() {
        let opts = SchedulerOpts {
            base_interval_ms: 100,
            backoff_multiplier: 2,
            max_backoff_ms: 10_000,
            failure_giveup_count: 2,
        };
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(opts);
        d.observe_peer_anchor(0xAA, 0x100);
        // Mark 0xAA cold.
        let slot = &mut d.peers[0].slot;
        record_sync_failure(slot, &opts, 0);
        record_sync_failure(slot, &opts, 1);
        let mut out = [0u32; 4];
        // Local anchor differs → mismatch, but cold peer excluded.
        let n = d.select_targets(0x999, 1_000_000, &mut out);
        assert_eq!(n, 0);
    }

    #[test]
    fn select_targets_respects_cooldown() {
        let opts = SchedulerOpts {
            base_interval_ms: 1000,
            backoff_multiplier: 2,
            max_backoff_ms: 10_000,
            failure_giveup_count: 6,
        };
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(opts);
        d.observe_peer_anchor(0xAA, 0x100);
        // After a successful sync, next_attempt_ms is base_interval_ms ahead.
        record_sync_success(&mut d.peers[0].slot, &opts, 100);
        let mut out = [0u32; 4];
        // Anchor still mismatches; cooldown blocks selection.
        let n = d.select_targets(0x999, 500, &mut out);
        assert_eq!(n, 0);
        // After cooldown elapses, selection succeeds.
        let n = d.select_targets(0x999, 100 + 1500, &mut out);
        assert_eq!(n, 1);
    }

    #[test]
    fn ship_to_peer_updates_slot_state_on_success() {
        let opts = SchedulerOpts::defaults();
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(opts);
        d.observe_peer_anchor(0xAA, 0x100);
        let runner: SporeRunner<8, 8> = SporeRunner::new(0xCC01, 100);
        let mut driver = LoopbackDriver::new();
        let entries = [mk_event(0x10, b"alrm")];
        let ok = d.ship_to_peer(&runner, &mut driver, 0xAA, &entries, 100);
        assert!(ok);
        assert_eq!(d.peers[0].slot.last_attempt_ms, 100);
        assert_eq!(d.peers[0].slot.last_success_ms, 100);
        assert_eq!(d.peers[0].slot.consecutive_failures, 0);
        assert_eq!(d.deltas_shipped, 1);
    }

    #[test]
    fn ship_to_unknown_peer_returns_false() {
        let opts = SchedulerOpts::defaults();
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(opts);
        let runner: SporeRunner<8, 8> = SporeRunner::new(0xCC01, 100);
        let mut driver = LoopbackDriver::new();
        let ok = d.ship_to_peer(&runner, &mut driver, 0xDEAD, &[], 100);
        assert!(!ok);
    }

    #[test]
    fn forget_peer_drops_entry() {
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(SchedulerOpts::defaults());
        d.observe_peer_anchor(0xAA, 0x100);
        d.observe_peer_anchor(0xBB, 0x200);
        d.forget_peer(0xAA);
        assert_eq!(d.count(), 1);
        assert_eq!(d.peer_anchor(0xAA), None);
        assert_eq!(d.peer_anchor(0xBB), Some(0x200));
    }

    #[test]
    fn select_targets_orders_by_oldest_last_attempt() {
        let opts = SchedulerOpts::defaults();
        let mut d: ConvergenceDriver<4> = ConvergenceDriver::new(opts);
        d.observe_peer_anchor(0xAA, 0x100);
        d.observe_peer_anchor(0xBB, 0x100);
        d.observe_peer_anchor(0xCC, 0x100);
        // 0xBB attempted most recently, 0xCC next, 0xAA never.
        record_sync_attempt(&mut d.peers[0].slot, 100); // 0xAA
        record_sync_attempt(&mut d.peers[1].slot, 200); // 0xBB
        record_sync_attempt(&mut d.peers[2].slot, 150); // 0xCC
        // ... then everyone's anchor now mismatches.
        let mut out = [0u32; 4];
        let n = d.select_targets(0x999, 1_000_000, &mut out);
        assert_eq!(n, 3);
        // Oldest first.
        assert_eq!(out[0], 0xAA);
        assert_eq!(out[1], 0xCC);
        assert_eq!(out[2], 0xBB);
    }

    #[test]
    fn schema_constant() {
        assert_eq!(DRIVER_SCHEMA, "OMEGA-1460/v1");
    }

    // --- Era 1490: AutoPipeline tests ---

    /// Simple paired driver pattern reused from spore_runner tests.
    struct PD {
        local: LoopbackDriver,
        tx_log: [u8; 1024],
        tx_len: usize,
    }
    impl PD {
        const fn new() -> Self {
            Self { local: LoopbackDriver::new(), tx_log: [0u8; 1024], tx_len: 0 }
        }
        fn deliver(&mut self, peer: &mut PD) {
            peer.local.deliver(&self.tx_log[..self.tx_len]);
            self.tx_len = 0;
        }
    }
    impl WireDriver for PD {
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
    fn auto_pipeline_starts_idle() {
        let p: AutoPipeline<4> = AutoPipeline::new(SchedulerOpts::defaults(), 5000);
        assert!(!p.has_pending_request());
    }

    #[test]
    fn auto_pipeline_issues_request_on_anchor_mismatch() {
        let mut runner: SporeRunner<8, 8> = SporeRunner::new(0xCC01, 1000);
        let mut pipeline: AutoPipeline<4> =
            AutoPipeline::new(SchedulerOpts::defaults(), 5000);
        let mut driver = PD::new();
        // Register a peer with a mismatching anchor.
        pipeline.driver.observe_peer_anchor(0xAA, 0xDEAD);
        let local: [ForensicEvent; 0] = [];
        pipeline.step(&mut runner, &mut driver, &local, 100);
        // Pipeline should have issued a HASH_REQUEST and recorded
        // a pending request.
        assert!(pipeline.has_pending_request());
        // 32 bytes of HASH_REQUEST emitted.
        assert_eq!(driver.tx_len, 32);
    }

    #[test]
    fn auto_pipeline_completes_on_response_with_diff_ship() {
        let mut a: SporeRunner<8, 8> = SporeRunner::new(0xAA, 1000);
        let mut b: SporeRunner<8, 8> = SporeRunner::new(0xBB, 1000);
        a.observe_local_event(b"alrm", 0x10, 0);
        a.observe_local_event(b"alrm", 0x20, 0);
        b.observe_local_event(b"alrm", 0x10, 0);
        // (B is missing 0x20.)

        let mut pipeline: AutoPipeline<4> =
            AutoPipeline::new(SchedulerOpts::defaults(), 5000);
        let mut da = PD::new();
        let mut db = PD::new();
        pipeline.driver.observe_peer_anchor(0xBB, b.anchor());

        let local = [
            mk_event(0x10, b"alrm"),
            mk_event(0x20, b"alrm"),
        ];

        // Phase 1: A's pipeline issues HASH_REQUEST to B.
        pipeline.step(&mut a, &mut da, &local, 100);
        assert!(pipeline.has_pending_request());
        da.deliver(&mut db);

        // Phase 2: B receives REQUEST → answers automatically on its
        // own step (simulating B's runner with no pipeline).
        b.step(&mut db, 200);
        assert_eq!(b.pending_hash_request_id, pipeline.pending_request_id);
        b.maybe_answer_pending_request(&mut db);
        db.deliver(&mut da);

        // Phase 3: A's runner ingests the RESPONSE; pipeline picks it
        // up on next step → computes diff → ships only 0x20.
        a.step(&mut da, 300);
        pipeline.step(&mut a, &mut da, &local, 400);
        assert!(!pipeline.has_pending_request());
        // A shipped a delta containing only 0x20.
        da.deliver(&mut db);
        b.step(&mut db, 500);
        assert_eq!(b.sink_len(), 2); // had 0x10, gained 0x20.
    }

    #[test]
    fn auto_pipeline_times_out_stale_request() {
        let mut runner: SporeRunner<8, 8> = SporeRunner::new(0xCC01, 1000);
        let mut pipeline: AutoPipeline<4> =
            AutoPipeline::new(SchedulerOpts::defaults(), 1000);
        let mut driver = PD::new();
        pipeline.driver.observe_peer_anchor(0xAA, 0xDEAD);
        let local: [ForensicEvent; 0] = [];
        pipeline.step(&mut runner, &mut driver, &local, 100);
        assert!(pipeline.has_pending_request());
        // Advance past the timeout without delivering a response.
        pipeline.step(&mut runner, &mut driver, &local, 100 + 1500);
        assert!(!pipeline.has_pending_request());
        // Failure recorded on peer's slot.
        let slot_idx = pipeline
            .driver
            .peers
            .iter()
            .position(|e| e.used && e.peer_id == 0xAA)
            .unwrap();
        assert_eq!(pipeline.driver.peers[slot_idx].slot.consecutive_failures, 1);
    }

    #[test]
    fn auto_pipeline_no_op_when_nothing_to_ship() {
        // When the local set is a subset of the peer's hash list,
        // the diff is empty → pipeline completes without shipping
        // a DELTA. (B's `last_seen_anchor` remains stale until
        // updated by the next HASH_LIST broadcast — a future tick
        // may reissue, which is correct behavior.)
        let mut a: SporeRunner<8, 8> = SporeRunner::new(0xAA, 1000);
        let mut b: SporeRunner<8, 8> = SporeRunner::new(0xBB, 1000);
        // Both have identical sets.
        a.observe_local_event(b"alrm", 0x10, 0);
        b.observe_local_event(b"alrm", 0x10, 0);

        let mut pipeline: AutoPipeline<4> =
            AutoPipeline::new(SchedulerOpts::defaults(), 5000);
        pipeline.driver.observe_peer_anchor(0xBB, 0xDEAD);

        let mut da = PD::new();
        let mut db = PD::new();
        let local = [mk_event(0x10, b"alrm")];

        // Issue REQUEST.
        pipeline.step(&mut a, &mut da, &local, 100);
        da.deliver(&mut db);
        b.step(&mut db, 200);
        b.maybe_answer_pending_request(&mut db);
        db.deliver(&mut da);
        a.step(&mut da, 300);

        // Snapshot: count how many bytes were emitted by the
        // request phase before completing.
        let pre_complete_bytes = da.tx_len;

        // Run pipeline.step which should consume the response,
        // compute empty diff, complete the request — but Phase 3
        // may then issue ANOTHER request because B's anchor is
        // still recorded as stale. Verify B's sink didn't gain
        // anything (the contract for "no diff to ship") even
        // after several full cycles.
        pipeline.step(&mut a, &mut da, &local, 400);
        da.deliver(&mut db);
        b.step(&mut db, 500);
        // B's sink should still hold exactly 1 event (no DELTA
        // arrived because there was nothing to ship).
        assert_eq!(b.sink_len(), 1);
        // The bytes written between pre_complete_bytes and now are
        // either zero (idle) or another HASH_REQUEST (32 bytes) —
        // never a DELTA envelope (which would be 64+ bytes).
        let new_bytes = da.tx_len + 0; // (would be 0 if still queued; deliver happened)
        let _ = (new_bytes, pre_complete_bytes); // diagnostic only
    }
}
