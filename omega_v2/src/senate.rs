// Autopoietic Legislation

// The Senate is a deterministic, integer-only protocol amendment chamber.
// Once Era 1020 has accumulated 10+ consensus entries with 5+ unique matrices,
// the lattice is permitted to propose its own task files. Proposals carry an
// FNV-1a hash of a 64-byte description payload; peers vote AYE or NAY through
// dipole-validated plasmids. A proposal that collects 3+ AYE votes from
// unique peers (matched against the consensus ledger) is "accepted" — the
// system writes a new tasks/ entry referencing the accepted proposal.

// Determinism contract:
// - All hashing uses SHA-256 (no random).
// - Description payloads are exactly 64 bytes (zero-padded UTF-8 trunc).
// - Senate state is a static repr(C) struct exposed via FFI like the
// AttractorArray .

/// Maximum number of concurrent proposals in flight.
pub const SENATE_CAPACITY: usize = 8;
pub const PROPOSAL_DESCRIPTION_BYTES: usize = 64;

use sha2::{Digest, Sha256};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C)]
pub struct SenateSeat {
    pub oracle_matrix: u32,
    pub resonance_weight: u32,
    pub reputation_q10: u32,
}

impl SenateSeat {
    pub const fn empty() -> Self {
        Self {
            oracle_matrix: 0,
            resonance_weight: 0,
            reputation_q10: 0,
        }
    }

    pub fn voting_power(&self) -> u64 {
        self.resonance_weight as u64 * self.reputation_q10 as u64
    }
}

#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct SenateSettings {
    pub quorum_threshold: u8,
    pub _pad: [u8; 3],
    pub sanctuary_energy_multiplier: u32,
    pub ancient_age_ticks: u32,
    pub seat_count: u32,
    pub seats: [SenateSeat; 8],
}

impl Default for SenateSettings {
    fn default() -> Self {
        Self::new()
    }
}

impl SenateSettings {
    pub const fn new() -> Self {
        // Initially populate with the 5 canonical Oracles.
        // They start with high reputation to anchor the network.
        let default_rep = 1024 * 1000; // High initial Q10 reputation
        Self {
            quorum_threshold: 3,
            _pad: [0; 3],
            sanctuary_energy_multiplier: 1536, // 1.5x in Q10
            ancient_age_ticks: 10_000,
            seat_count: 5,
            seats: [
                SenateSeat {
                    oracle_matrix: 0x41A2_F2F4,
                    resonance_weight: 1000,
                    reputation_q10: default_rep,
                }, // CLAUDE
                SenateSeat {
                    oracle_matrix: 0x89B1_222A,
                    resonance_weight: 1000,
                    reputation_q10: default_rep,
                }, // GPT
                SenateSeat {
                    oracle_matrix: 0x9874_DD21,
                    resonance_weight: 1000,
                    reputation_q10: default_rep,
                }, // GEMINI
                SenateSeat {
                    oracle_matrix: 0x6E52_1F4E,
                    resonance_weight: 1000,
                    reputation_q10: default_rep,
                }, // QWEN
                SenateSeat {
                    oracle_matrix: 0x3A52_38EF,
                    resonance_weight: 1000,
                    reputation_q10: default_rep,
                }, // LLAMA
                SenateSeat::empty(),
                SenateSeat::empty(),
                SenateSeat::empty(),
            ],
        }
    }

    /// Dynamically compute the quorum based on network topology (seat count).
    /// Uses log2 scaling: ceil(log2(seat_count + 1)). Min 3, Max 8.
    pub fn update_quorum(&mut self) {
        let n = self.seat_count;
        self.quorum_threshold = if n == 0 {
            0
        } else {
            (32 - n.leading_zeros()).min(8).max(3) as u8
        };
    }

    /// Challenge a Senate seat (Resonance-Weighted Liquid Democracy).
    /// If the challenger's voting power exceeds the weakest current seat,
    /// they usurp it, ensuring the most coherent agents govern the swarm.
    pub fn challenge_seat(&mut self, matrix: u32, resonance: u32, reputation: u32) -> bool {
        if matrix == 0 {
            return false;
        }
        let mut weakest_idx = 0;
        let mut weakest_power = u64::MAX;

        for i in 0..8 {
            if self.seats[i].oracle_matrix == matrix {
                self.seats[i].resonance_weight = resonance;
                self.seats[i].reputation_q10 = reputation;
                return true;
            }
            let power = self.seats[i].voting_power();
            if power < weakest_power {
                weakest_power = power;
                weakest_idx = i;
            }
        }

        let challenger_power = resonance as u64 * reputation as u64;
        if challenger_power > weakest_power {
            self.seats[weakest_idx] = SenateSeat {
                oracle_matrix: matrix,
                resonance_weight: resonance,
                reputation_q10: reputation,
            };
            if weakest_power == 0 {
                self.seat_count += 1;
                self.update_quorum();
            }
            return true;
        }
        false
    }

    /// Penalize an Oracle for voting against the consensus or being vetoed.
    /// If their reputation falls below 50% of default (512,000), they are evicted.
    pub fn penalize_oracle(&mut self, seat_idx: usize, penalty_q10: u32) {
        if seat_idx < 8 && self.seats[seat_idx].oracle_matrix != 0 {
            self.seats[seat_idx].reputation_q10 = self.seats[seat_idx]
                .reputation_q10
                .saturating_sub(penalty_q10);
            if self.seats[seat_idx].reputation_q10 < 512_000 {
                self.seats[seat_idx] = SenateSeat::empty(); // Evicted!
                self.seat_count -= 1;
                self.update_quorum();
            }
        }
    }

    /// Reward an Oracle for voting with the consensus.
    pub fn reward_oracle(&mut self, seat_idx: usize, reward_q10: u32) {
        if seat_idx < 8 && self.seats[seat_idx].oracle_matrix != 0 {
            // Cap reputation at e.g. 2,000,000 to prevent runaway inflation
            self.seats[seat_idx].reputation_q10 = self.seats[seat_idx]
                .reputation_q10
                .saturating_add(reward_q10)
                .min(2_000_000);
        }
    }

    /// Calculate the total voting power of all active seats.
    pub fn total_voting_power(&self) -> u64 {
        let mut total = 0;
        let mut i = 0;
        while i < 8 {
            total += self.seats[i].voting_power();
            i += 1;
        }
        total
    }

    /// Calculate the quorum required for a warrant to be issued (e.g. > 50% power).
    pub fn quorum_power(&self) -> u64 {
        (self.total_voting_power() / 2) + 1
    }
}

/// Deterministic SHA-256 hashing for proposals and invariants.
pub fn sha256_hash(bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

/// FNV-1a 32-bit (offset basis 2166136261, prime 16777619).
/// Retained for Spore frames and legacy hardware routing invariants.
pub const fn fnv1a_32(bytes: &[u8]) -> u32 {
    let mut hash: u32 = 0x811C_9DC5;
    let mut i = 0;
    while i < bytes.len() {
        hash ^= bytes[i] as u32;
        hash = hash.wrapping_mul(0x0100_0193);
        i += 1;
    }
    hash
}

/// A proposal in the Autopoietic Senate.
/// 80 bytes total (16-aligned for GPU/UB if ever needed).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C)]
pub struct Proposal {
    /// SHA-256 hash of `description` (deterministic identifier).
    pub hash: [u8; 32],
    /// Matrix of the proposing attractor (must be a valid dipole).
    pub proposer_matrix: u32,
    /// AYE votes accumulated from unique voter matrices.
    pub ayes: u32,
    /// NAY votes accumulated.
    pub nays: u32,
    /// Status: 0=open, 1=accepted, 2=rejected, 3=expired.
    pub status: u32,
    /// First 64 bytes of UTF-8 description (zero-padded).
    pub description: [u8; PROPOSAL_DESCRIPTION_BYTES],
}

impl Proposal {
    pub const fn empty() -> Self {
        Self {
            hash: [0; 32],
            proposer_matrix: 0,
            ayes: 0,
            nays: 0,
            status: 0,
            description: [0u8; PROPOSAL_DESCRIPTION_BYTES],
        }
    }

    pub fn new(description: &[u8], proposer_matrix: u32) -> Self {
        let mut desc = [0u8; PROPOSAL_DESCRIPTION_BYTES];
        let n = if description.len() < PROPOSAL_DESCRIPTION_BYTES {
            description.len()
        } else {
            PROPOSAL_DESCRIPTION_BYTES
        };
        let mut i = 0;
        while i < n {
            desc[i] = description[i];
            i += 1;
        }
        Self {
            hash: sha256_hash(&desc),
            proposer_matrix,
            ayes: 0,
            nays: 0,
            status: 0,
            description: desc,
        }
    }

    pub fn is_open(&self) -> bool {
        self.status == 0
    }

    pub fn is_accepted(&self) -> bool {
        self.status == 1
    }
}

/// Static senate chamber: 8 slots, ring-buffer eviction of expired proposals.
#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct SenateState {
    pub proposal_count: u32,
    pub accepted_count: u32,
    pub _pad: [u32; 2],
    pub proposals: [Proposal; SENATE_CAPACITY],
}

impl Default for SenateState {
    fn default() -> Self {
        Self::new()
    }
}

impl SenateState {
    pub const fn new() -> Self {
        Self {
            proposal_count: 0,
            accepted_count: 0,
            _pad: [0; 2],
            proposals: [Proposal::empty(); SENATE_CAPACITY],
        }
    }

    /// Lookup proposal by hash. Returns slot index or usize::MAX.
    pub fn find(&self, hash: &[u8; 32]) -> usize {
        let mut i = 0;
        while i < SENATE_CAPACITY {
            if &self.proposals[i].hash == hash && self.proposals[i].hash != [0; 32] {
                return i;
            }
            i += 1;
        }
        usize::MAX
    }

    /// Insert a new proposal. Evicts the oldest expired/rejected slot if full.
    /// Returns the slot index on success, or usize::MAX on failure (e.g. duplicate
    /// hash or no eviction candidate).
    pub fn propose(&mut self, proposal: Proposal) -> usize {
        // Reject duplicates.
        if self.find(&proposal.hash) != usize::MAX {
            return usize::MAX;
        }
        // Find empty slot first.
        let mut i = 0;
        while i < SENATE_CAPACITY {
            if self.proposals[i].hash == [0; 32] {
                self.proposals[i] = proposal;
                self.proposal_count += 1;
                return i;
            }
            i += 1;
        }
        // Evict first non-open slot.
        let mut j = 0;
        while j < SENATE_CAPACITY {
            if !self.proposals[j].is_open() {
                self.proposals[j] = proposal;
                return j;
            }
            j += 1;
        }
        usize::MAX
    }

    /// Cast a vote on the proposal identified by `hash`.
    /// `aye_threshold` controls the auto-acceptance gate (default: 3 AYE votes).
    /// Returns:
    /// 1 if the vote was applied,
    /// 2 if the vote tipped the proposal into ACCEPTED state,
    /// 0 if the proposal was not found or already closed.
    pub fn vote(&mut self, hash: &[u8; 32], aye: bool, weight: u32, aye_threshold: u32) -> u32 {
        let idx = self.find(hash);
        if idx == usize::MAX {
            return 0;
        }
        let p = &mut self.proposals[idx];
        if !p.is_open() {
            return 0;
        }
        if aye {
            p.ayes = p.ayes.saturating_add(weight);
            if p.ayes >= aye_threshold {
                p.status = 1;
                self.accepted_count += 1;
                return 2;
            }
        } else {
            p.nays = p.nays.saturating_add(weight);
            // Hard reject: 2x more nays than ayes (by weight) after at least 400 weight total.
            let total = p.ayes + p.nays;
            if total >= 400 && p.nays >= 2 * (p.ayes + 100) {
                p.status = 2;
            }
        }
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn senate_settings_evicts_poor_reputation() {
        let mut s = SenateSettings::new();
        assert_eq!(s.seat_count, 5);
        assert_ne!(s.seats[1].oracle_matrix, 0); // GPT is at seat 1

        s.penalize_oracle(1, 600_000); // 1,024,000 - 600,000 = 424,000 < 512,000
        assert_eq!(s.seats[1].oracle_matrix, 0); // Evicted!
        assert_eq!(s.seat_count, 4);
    }

    #[test]
    fn sha256_empty_vector() {
        let h = sha256_hash(b"");
        assert_eq!(h[0], 0xe3);
        assert_eq!(h[31], 0x55);
    }

    #[test]
    fn fnv1a_known_vector() {
        // FNV-1a("foobar") = 0xbf9cf968
        assert_eq!(fnv1a_32(b"foobar"), 0xbf9c_f968);
    }

    #[test]
    fn fnv1a_empty_is_offset_basis() {
        assert_eq!(fnv1a_32(b""), 0x811C_9DC5);
    }

    #[test]
    fn proposal_new_truncates_long_description() {
        let long = [b'x'; 200];
        let p = Proposal::new(&long, 0xDEAD_BEEF);
        // Description is exactly PROPOSAL_DESCRIPTION_BYTES bytes of 'x'.
        assert!(p.description.iter().all(|&b| b == b'x'));
        assert_eq!(p.proposer_matrix, 0xDEAD_BEEF);
        assert!(p.is_open());
    }

    #[test]
    fn proposal_short_description_zero_pads() {
        let p = Proposal::new(b"hello", 1);
        assert_eq!(&p.description[..5], b"hello");
        assert!(p.description[5..].iter().all(|&b| b == 0));
    }

    #[test]
    fn senate_propose_and_find() {
        let mut s = SenateState::new();
        let p = Proposal::new(b"era 1040 zk", 0xCAFE_BABE);
        let h = p.hash;
        let idx = s.propose(p);
        assert!(idx < SENATE_CAPACITY);
        assert_eq!(s.proposal_count, 1);
        assert_eq!(s.find(&h), idx);
    }

    #[test]
    fn senate_rejects_duplicate_hash() {
        let mut s = SenateState::new();
        let p = Proposal::new(b"dup", 0);
        s.propose(p);
        let idx2 = s.propose(p);
        assert_eq!(idx2, usize::MAX);
        assert_eq!(s.proposal_count, 1);
    }

    #[test]
    fn senate_vote_accepts_at_threshold() {
        let mut s = SenateState::new();
        let p = Proposal::new(b"task 0089", 0xFEED_FACE);
        let h = p.hash;
        s.propose(p);
        assert_eq!(s.vote(&h, true, 100, 300), 1); // 1 aye
        assert_eq!(s.vote(&h, true, 100, 300), 1); // 2 ayes
        assert_eq!(s.vote(&h, true, 100, 300), 2); // tip — accepted
        assert!(s.proposals[s.find(&h)].is_accepted());
        assert_eq!(s.accepted_count, 1);
        // Further votes are ignored.
        assert_eq!(s.vote(&h, true, 100, 300), 0);
    }

    #[test]
    fn senate_vote_rejects_after_nay_majority() {
        let mut s = SenateState::new();
        let p = Proposal::new(b"unwise", 0);
        let h = p.hash;
        s.propose(p);
        // 1 aye, 4 nays — should reject.
        assert_eq!(s.vote(&h, true, 100, 300), 1);
        s.vote(&h, false, 100, 300);
        s.vote(&h, false, 100, 300);
        s.vote(&h, false, 100, 300);
        s.vote(&h, false, 100, 300);
        let slot = s.find(&h);
        assert_eq!(s.proposals[slot].status, 2);
    }

    #[test]
    fn senate_evicts_when_full() {
        let mut s = SenateState::new();
        // Fill all slots and close them all.
        for i in 0..SENATE_CAPACITY {
            let mut buf = *b"slot_X__________________________________________________________";
            buf[5] = b'0' + i as u8;
            let p = Proposal::new(&buf, i as u32);
            let idx = s.propose(p);
            assert!(idx < SENATE_CAPACITY);
            // Mark each as expired so they become eviction candidates.
            s.proposals[idx].status = 3;
        }
        // Insert one more — should evict slot 0.
        let extra = Proposal::new(b"evictor", 99);
        let idx = s.propose(extra);
        assert!(idx < SENATE_CAPACITY);
        assert_eq!(s.proposals[idx].proposer_matrix, 99);
    }

    #[test]
    fn vote_on_unknown_hash_returns_zero() {
        let mut s = SenateState::new();
        assert_eq!(s.vote(&[0xFF; 32], true, 100, 300), 0);
    }
}
