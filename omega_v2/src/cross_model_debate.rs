// Cross-Model Debate Ledger

// When the Multi-Oracle Senate  is convened, the natural next
// question is: how do oracles argue WITH each other before they vote?

// This module introduces a DebateRound — a public, append-only ledger
// of (oracle, proposal_hash, stance, reasoning_hash, tick) entries.
// Each oracle can record up to MAX_DEBATE_ENTRIES_PER_ORACLE statements
// per proposal; the reasoning text itself lives in JS / on the wire,
// while the kernel only fingerprints it (FNV-1a) for tamper detection.

// The acceptance rule remains the Era 1060 phase-resonance threshold —
// debate doesn't change votes mechanically, but it makes the *reasoning*
// behind cross-model alignment cryptographically auditable.

use crate::crypto::sha256_u32;

pub const DEBATE_LEDGER_CAPACITY: usize = 64;
pub const ORACLE_NAME_BYTES: usize = 16;

/// One debate entry. 32 bytes total: oracle name (16) + proposal_hash (4)
/// + stance (1) + _pad (3) + reasoning_hash (4) + tick (4).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, align(8))]
pub struct DebateEntry {
    /// ASCII oracle name, zero-padded ("claude" → b"claude\0\0\0\0\0\0\0\0\0\0").
    pub oracle: [u8; ORACLE_NAME_BYTES],
    /// FNV-1a hash of the proposal description (matches senate.rs).
    pub proposal_hash: u32,
    /// Stance: 0 = neutral / opening, 1 = AYE, 2 = NAY, 3 = ABSTAIN.
    pub stance: u8,
    pub _pad: [u8; 3],
    /// FNV-1a hash of the reasoning text (text itself stays off-chain).
    pub reasoning_hash: u32,
    /// Absolute tick at which the entry was recorded.
    pub tick: u32,
}

impl DebateEntry {
    pub const fn empty() -> Self {
        Self {
            oracle: [0u8; ORACLE_NAME_BYTES],
            proposal_hash: 0,
            stance: 0,
            _pad: [0u8; 3],
            reasoning_hash: 0,
            tick: 0,
        }
    }

    pub fn new(oracle: &[u8], proposal_hash: u32, stance: u8, reasoning: &[u8], tick: u32) -> Self {
        let mut name = [0u8; ORACLE_NAME_BYTES];
        let n = if oracle.len() < ORACLE_NAME_BYTES { oracle.len() } else { ORACLE_NAME_BYTES };
        let mut i = 0;
        while i < n {
            name[i] = oracle[i];
            i += 1;
        }
        Self {
            oracle: name,
            proposal_hash,
            stance,
            _pad: [0u8; 3],
            reasoning_hash: sha256_u32(reasoning),
            tick,
        }
    }

    pub fn oracle_str_len(&self) -> usize {
        let mut i = 0;
        while i < ORACLE_NAME_BYTES && self.oracle[i] != 0 {
            i += 1;
        }
        i
    }

    pub fn matches_oracle(&self, name: &[u8]) -> bool {
        let len = self.oracle_str_len();
        if name.len() != len { return false; }
        let mut i = 0;
        while i < len {
            if self.oracle[i] != name[i] { return false; }
            i += 1;
        }
        true
    }
}

/// A monotonic-writer / multi-reader debate ledger.
#[derive(Clone, Copy, Debug)]
#[repr(C, align(16))]
pub struct DebateLedger {
    pub head: u32,
    pub total_written: u32,
    pub _pad: [u32; 2],
    pub entries: [DebateEntry; DEBATE_LEDGER_CAPACITY],
}

impl Default for DebateLedger {
    fn default() -> Self {
        Self::new()
    }
}

impl DebateLedger {
    pub const fn new() -> Self {
        Self {
            head: 0,
            total_written: 0,
            _pad: [0; 2],
            entries: [DebateEntry::empty(); DEBATE_LEDGER_CAPACITY],
        }
    }

    pub fn push(&mut self, entry: DebateEntry) {
        let slot = (self.head as usize) % DEBATE_LEDGER_CAPACITY;
        self.entries[slot] = entry;
        self.head = ((self.head + 1) as usize % DEBATE_LEDGER_CAPACITY) as u32;
        self.total_written = self.total_written.wrapping_add(1);
    }

    pub fn clear(&mut self) {
        self.head = 0;
        self.total_written = 0;
        self.entries = [DebateEntry::empty(); DEBATE_LEDGER_CAPACITY];
    }

    /// Count how many entries an oracle has written for a specific proposal.
    pub fn entries_for(&self, oracle: &[u8], proposal_hash: u32) -> u32 {
        let mut count = 0;
        let mut i = 0;
        let limit = if self.total_written as usize > DEBATE_LEDGER_CAPACITY {
            DEBATE_LEDGER_CAPACITY
        } else {
            self.total_written as usize
        };
        while i < limit {
            let e = &self.entries[i];
            if e.proposal_hash == proposal_hash && e.matches_oracle(oracle) {
                count += 1;
            }
            i += 1;
        }
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debate_entry_round_trip() {
        let e = DebateEntry::new(b"claude", 0xCAFE_BABE, 1, b"because X", 100);
        assert_eq!(e.proposal_hash, 0xCAFE_BABE);
        assert_eq!(e.stance, 1);
        assert_eq!(e.reasoning_hash, sha256_u32(b"because X"));
        assert_eq!(e.tick, 100);
        assert!(e.matches_oracle(b"claude"));
        assert!(!e.matches_oracle(b"gpt"));
    }

    #[test]
    fn long_oracle_name_is_truncated() {
        let long = b"some_super_long_oracle_name_xyz";
        let e = DebateEntry::new(long, 0, 0, b"", 0);
        // Name is truncated to 16 bytes — partial prefix.
        assert_eq!(e.oracle_str_len(), 16);
    }

    #[test]
    fn oracle_str_len_handles_zero_pad() {
        let e = DebateEntry::new(b"gpt", 0, 0, b"", 0);
        assert_eq!(e.oracle_str_len(), 3);
    }

    #[test]
    fn ledger_push_advances_head() {
        let mut l = DebateLedger::new();
        l.push(DebateEntry::new(b"claude", 1, 1, b"a", 0));
        l.push(DebateEntry::new(b"gpt", 1, 2, b"b", 1));
        assert_eq!(l.head, 2);
        assert_eq!(l.total_written, 2);
    }

    #[test]
    fn ledger_entries_for_counts_correctly() {
        let mut l = DebateLedger::new();
        l.push(DebateEntry::new(b"claude", 100, 1, b"argA", 0));
        l.push(DebateEntry::new(b"claude", 100, 0, b"argB", 1));
        l.push(DebateEntry::new(b"gpt",    100, 2, b"argC", 2));
        l.push(DebateEntry::new(b"claude", 200, 1, b"argD", 3));
        assert_eq!(l.entries_for(b"claude", 100), 2);
        assert_eq!(l.entries_for(b"gpt",    100), 1);
        assert_eq!(l.entries_for(b"claude", 200), 1);
        assert_eq!(l.entries_for(b"qwen",   100), 0);
    }

    #[test]
    fn ledger_clear_resets() {
        let mut l = DebateLedger::new();
        l.push(DebateEntry::new(b"claude", 1, 1, b"x", 0));
        l.clear();
        assert_eq!(l.head, 0);
        assert_eq!(l.total_written, 0);
        assert_eq!(l.entries_for(b"claude", 1), 0);
    }

    #[test]
    fn distinct_reasoning_produces_distinct_hashes() {
        let e1 = DebateEntry::new(b"claude", 1, 1, b"reasoning A", 0);
        let e2 = DebateEntry::new(b"claude", 1, 1, b"reasoning B", 0);
        assert_ne!(e1.reasoning_hash, e2.reasoning_hash);
    }
}
