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
    is_peer_cold, record_sync_attempt, record_sync_failure,
    record_sync_success, should_sync_now, PeerSyncSlot, SchedulerOpts,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::forensic_event_sink::{ForensicEvent, ForensicEventSink};
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
}
