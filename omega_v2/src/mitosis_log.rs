// Phase 2 — Mitosis Receipt Log

// A static ring buffer that captures every birth event the lattice has
// performed since boot. Each receipt holds enough information for ANY
// downstream observer (peer node, ZK guest, RFC archivist) to independently
// re-derive the child via mitosis_proof::derive_mitosis_child and verify
// the receipt hash bit-for-bit.

// The log lives in static memory (no_std friendly) and is exposed via FFI
// as a zero-copy pointer. JS reads it once per tick, packages the entries
// into DIPOLE plasmids, and broadcasts them across the mesh.

use crate::agent::PhaseAgentMinimal;
use crate::attractor::AttractorArray;

/// Capacity of the receipt ring buffer.
/// Tuned for: at most a handful of mitosis events per `darwinian_mitosis`
/// sweep, JS reads at 1Hz, so 32 slots gives a healthy margin.
pub const MITOSIS_LOG_CAPACITY: usize = 32;

/// A single mitosis receipt — everything needed to verify the birth.
/// 32 + 32 + 80 + 4 + 32 + 4 + 8 = 192 bytes (16-byte aligned).
#[derive(Clone, Copy, Debug)]
#[repr(C, align(16))]
pub struct MitosisReceipt {
    /// Parent agent state at the moment of mitosis (BEFORE the energy debit).
    pub parent: PhaseAgentMinimal,
    /// Child agent as derived by `derive_mitosis_child`.
    pub child: PhaseAgentMinimal,
    /// Snapshot of the attractor field that the lattice saw.
    pub attractors: AttractorArray,
    /// Topology q_phase at the moment of mitosis.
    pub q_phase: u32,
    /// SHA-256 32-byte hash of the child (`mitosis_proof::child_receipt_hash`).
    pub receipt_hash: [u8; 32],
    /// Absolute tick at which the mitosis occurred.
    pub tick: u32,
    /// Shift in Kuramoto order parameter (scaled) or general entropy.
    pub entropy_delta: i32,
    /// Energy burned during birth.
    pub metabolic_cost: u32,
}

impl MitosisReceipt {
    pub const fn empty() -> Self {
        Self {
            parent: PhaseAgentMinimal {
                phase: 0,
                energy: 0,
                base_freq: 0,
                state_flags: 0,
                genome: 0,
                memory: [0; 3],
            },
            child: PhaseAgentMinimal {
                phase: 0,
                energy: 0,
                base_freq: 0,
                state_flags: 0,
                genome: 0,
                memory: [0; 3],
            },
            attractors: AttractorArray::new(),
            q_phase: 0,
            receipt_hash: [0; 32],
            tick: 0,
            entropy_delta: 0,
            metabolic_cost: 0,
        }
    }
}

/// Ring buffer of mitosis receipts.
/// The buffer is monotonic-writer / multi-reader: `head` advances on write,
/// `total_written` is the absolute count of events since boot, JS computes
/// the slice it has not yet drained from `(last_seen, total_written)`.
#[derive(Clone, Copy, Debug)]
#[repr(C, align(16))]
pub struct MitosisLog {
    /// Next slot to write into (modulo CAPACITY).
    pub head: u32,
    /// Absolute number of receipts ever written (overflow at 2^32 is fine —
    /// JS tracks `last_seen` modulo this counter).
    pub total_written: u32,
    pub _pad: [u32; 2],
    pub entries: [MitosisReceipt; MITOSIS_LOG_CAPACITY],
}

impl Default for MitosisLog {
    fn default() -> Self {
        Self::new()
    }
}

impl MitosisLog {
    pub const fn new() -> Self {
        Self {
            head: 0,
            total_written: 0,
            _pad: [0; 2],
            entries: [MitosisReceipt::empty(); MITOSIS_LOG_CAPACITY],
        }
    }

    /// Append a receipt at the current head and advance.
    pub fn push(&mut self, r: MitosisReceipt) {
        let slot = (self.head as usize) % MITOSIS_LOG_CAPACITY;
        self.entries[slot] = r;
        self.head = ((self.head + 1) as usize % MITOSIS_LOG_CAPACITY) as u32;
        self.total_written = self.total_written.wrapping_add(1);
    }

    /// Reset the log (useful for testing and at world rebirth).
    pub fn clear(&mut self) {
        self.head = 0;
        self.total_written = 0;
        self.entries = [MitosisReceipt::empty(); MITOSIS_LOG_CAPACITY];
    }

    /// Returns the entry at logical position `idx` (idx < total_written, must
    /// be within the last CAPACITY entries to be valid).
    pub fn get(&self, idx: u32) -> Option<MitosisReceipt> {
        if idx >= self.total_written {
            return None;
        }
        let lookback = self.total_written - idx;
        if lookback as usize > MITOSIS_LOG_CAPACITY {
            return None;
        }
        // head points to NEXT slot; the most recent entry is at head-1.
        let slot =
            ((self.head as i64 - lookback as i64).rem_euclid(MITOSIS_LOG_CAPACITY as i64)) as usize;
        Some(self.entries[slot])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_receipt(genome: u32) -> MitosisReceipt {
        let mut r = MitosisReceipt::empty();
        r.parent.genome = genome;
        r.child.genome = genome ^ 0xFF;
        r.q_phase = 7;
        let mut h = [0u8; 32];
        h[0] = genome as u8;
        r.receipt_hash = h;
        r
    }

    #[test]
    fn push_advances_head_and_counter() {
        let mut log = MitosisLog::new();
        log.push(dummy_receipt(1));
        log.push(dummy_receipt(2));
        assert_eq!(log.head, 2);
        assert_eq!(log.total_written, 2);
    }

    #[test]
    fn ring_buffer_wraps() {
        let mut log = MitosisLog::new();
        for i in 0..(MITOSIS_LOG_CAPACITY as u32 + 5) {
            log.push(dummy_receipt(i));
        }
        assert_eq!(log.total_written, MITOSIS_LOG_CAPACITY as u32 + 5);
        assert_eq!(log.head as usize, 5);
        // The oldest 5 entries should be lost.
        let latest = log.get(log.total_written - 1).unwrap();
        assert_eq!(latest.parent.genome, MITOSIS_LOG_CAPACITY as u32 + 4);
    }

    #[test]
    fn get_out_of_range_returns_none() {
        let mut log = MitosisLog::new();
        log.push(dummy_receipt(1));
        assert!(log.get(1).is_none()); // idx == total_written is out of range
        assert!(log.get(100).is_none());
    }

    #[test]
    fn get_beyond_capacity_returns_none() {
        let mut log = MitosisLog::new();
        for i in 0..(MITOSIS_LOG_CAPACITY as u32 + 10) {
            log.push(dummy_receipt(i));
        }
        // idx 0 is now beyond the lookback window (overwritten).
        assert!(log.get(0).is_none());
        // But idx 9 (which is the (9 + 1)-from-end position, but only the last 32 entries are kept) should be valid since it's within the last 32.
        // total_written = 42, capacity = 32, so valid range is [10, 41].
        assert!(log.get(9).is_none());
        assert!(log.get(10).is_some());
        assert!(log.get(41).is_some());
    }

    #[test]
    fn clear_resets_state() {
        let mut log = MitosisLog::new();
        log.push(dummy_receipt(1));
        log.push(dummy_receipt(2));
        log.clear();
        assert_eq!(log.head, 0);
        assert_eq!(log.total_written, 0);
        assert!(log.get(0).is_none());
    }

    #[test]
    fn get_returns_correct_chronological_entry() {
        let mut log = MitosisLog::new();
        log.push(dummy_receipt(100));
        log.push(dummy_receipt(200));
        log.push(dummy_receipt(300));
        assert_eq!(log.get(0).unwrap().parent.genome, 100);
        assert_eq!(log.get(1).unwrap().parent.genome, 200);
        assert_eq!(log.get(2).unwrap().parent.genome, 300);
    }
}
