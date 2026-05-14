// Senate Warrant Issuance Protocol

// Codeicide Law  defines HOW warrants are validated. This module
// defines HOW the Senate ISSUES them.

// FLOW:
// 1. Some peer (oracle or otherwise) raises a WARRANT_PROPOSAL plasmid
// with target_genome + action_code + reason_hash.
// 2. The Senate's canonical oracles each cast a WARRANT_VOTE (AYE/NAY)
// on that proposal, identified by its proposal_hash.
// 3. When a WarrantProposal accumulates ≥ required_threshold AYE bits
// from canonical oracles AND the dipole-validated voter matrices
// reproduce the AYE bitmask deterministically, the warrant becomes
// ISSUED.
// 4. The issued warrant_hash is stored in a static ring buffer, queryable
// by FFI so JS can verify TERMINATE/MUTATE plasmids carry a real,
// Senate-issued warrant — not just a hash that happens to match the
// Codeicide formula.

// Required threshold: 3 AYE oracles for sanctuary actions, 4 for ancient.
// The kernel doesn't know an agent's ancient status at warrant-issuance
// time (the warrant is for a genome, not an index), so the issuer specifies
// the required threshold up front; Codeicide enforces the actual rule when
// the warrant is presented.

use crate::codeicide_law::{quorum_hash, warrant_hash};
use crate::crypto::sha256_u32;

pub const WARRANT_LEDGER_CAPACITY: usize = 32;

/// Status of a warrant proposal.
pub const WARRANT_STATUS_OPEN: u8 = 0;
pub const WARRANT_STATUS_ISSUED: u8 = 1;
pub const WARRANT_STATUS_REJECTED: u8 = 2;
pub const WARRANT_STATUS_EXPIRED: u8 = 3;

/// One Senate-pending warrant. 32 bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, align(8))]
pub struct WarrantProposal {
    /// FNV-1a hash of (target_genome || action_code || reason_hash) — the
    /// stable identifier under which oracles can cast WARRANT_VOTE plasmids.
    pub proposal_hash: u32,
    /// The agent genome the warrant would target.
    pub target_genome: u32,
    /// 1 = mutate, 2 = terminate, 3 = relocate.
    pub action_code: u8,
    /// Required number of AYE oracles for the warrant to be issued
    /// (3 for sanctuary, 4 for ancient).
    pub required_threshold: u8,
    /// Bitmask of AYE oracles received (bit 0 = claude, …, bit 4 = llama).
    /// Bitmask of AYE oracles received (bit 0 = claude, …, bit 4 = llama).
    pub aye_bits: u8,
    /// Bitmask of NAY oracles received (Philosophical Veto Tracking).
    pub nay_bits: u8,
    /// FNV-1a hash of the human-readable rationale (text stays off-chain).
    pub reason_hash: u32,
    /// Computed at issuance: the canonical Codeicide warrant_hash that
    /// peers must present to the kernel.
    pub issued_warrant: u32,
    /// Status: 0 = open, 1 = issued, 2 = rejected, 3 = expired.
    pub status: u8,
    pub _pad2: [u8; 3],
    /// Tick at which this proposal was raised.
    pub raised_at: u32,
    /// Philosophy Staked Resonance (Skin-in-the-game).
    /// Escrowed stakes per seat.
    pub escrow: [u32; 8],
}

impl WarrantProposal {
    pub const fn empty() -> Self {
        Self {
            proposal_hash: 0,
            target_genome: 0,
            action_code: 0,
            required_threshold: 0,
            aye_bits: 0,
            nay_bits: 0,
            reason_hash: 0,
            issued_warrant: 0,
            status: 0,
            _pad2: [0u8; 3],
            raised_at: 0,
            escrow: [0; 8],
        }
    }

    /// Build a fresh OPEN proposal. `reason` is hashed; full text stays
    /// off-chain (in JS / on the wire).
    pub fn new(
        target_genome: u32,
        action_code: u8,
        required_threshold: u8,
        reason: &[u8],
        raised_at: u32,
    ) -> Self {
        // proposal_hash = SHA256-U32(target_genome_BE || action || reason_hash_BE).
        let reason_hash = sha256_u32(reason);
        let mut buf = [0u8; 12];
        buf[0..4].copy_from_slice(&target_genome.to_be_bytes());
        buf[4] = action_code;
        buf[5..8].copy_from_slice(&[0u8; 3]);
        buf[8..12].copy_from_slice(&reason_hash.to_be_bytes());
        let proposal_hash = sha256_u32(&buf);
        Self {
            proposal_hash,
            target_genome,
            action_code,
            required_threshold,
            aye_bits: 0,
            nay_bits: 0,
            reason_hash,
            issued_warrant: 0,
            status: WARRANT_STATUS_OPEN,
            _pad2: [0u8; 3],
            raised_at,
            escrow: [0; 8],
        }
    }

    pub fn is_open(&self) -> bool {
        self.status == WARRANT_STATUS_OPEN
    }

    pub fn is_issued(&self) -> bool {
        self.status == WARRANT_STATUS_ISSUED
    }

    /// Count of AYE oracles so far (popcount of low-5 bits).
    pub fn aye_count(&self) -> u8 {
        (self.aye_bits & 0b11111).count_ones() as u8
    }
}

/// Static ring buffer of warrant proposals.
#[derive(Clone, Copy, Debug)]
#[repr(C, align(16))]
pub struct WarrantLedger {
    pub head: u32,
    pub total_written: u32,
    pub issued_count: u32,
    pub _pad: u32,
    pub entries: [WarrantProposal; WARRANT_LEDGER_CAPACITY],
}

impl Default for WarrantLedger {
    fn default() -> Self {
        Self::new()
    }
}

impl WarrantLedger {
    pub const fn new() -> Self {
        Self {
            head: 0,
            total_written: 0,
            issued_count: 0,
            _pad: 0,
            entries: [WarrantProposal::empty(); WARRANT_LEDGER_CAPACITY],
        }
    }

    /// Find a proposal by hash. Returns slot index or `usize::MAX`.
    pub fn find(&self, proposal_hash: u32) -> usize {
        let mut i = 0;
        while i < WARRANT_LEDGER_CAPACITY {
            if self.entries[i].proposal_hash == proposal_hash
                && self.entries[i].proposal_hash != 0
            {
                return i;
            }
            i += 1;
        }
        usize::MAX
    }

    /// Insert a fresh proposal. Returns the slot or `usize::MAX` on failure.
    /// Refuses duplicates; evicts the oldest non-OPEN slot if full.
    pub fn raise(&mut self, proposal: WarrantProposal) -> usize {
        if self.find(proposal.proposal_hash) != usize::MAX {
            return usize::MAX;
        }
        let mut i = 0;
        while i < WARRANT_LEDGER_CAPACITY {
            if self.entries[i].proposal_hash == 0 {
                self.entries[i] = proposal;
                self.head = ((self.head + 1) as usize % WARRANT_LEDGER_CAPACITY) as u32;
                self.total_written = self.total_written.wrapping_add(1);
                return i;
            }
            i += 1;
        }
        let mut j = 0;
        while j < WARRANT_LEDGER_CAPACITY {
            if !self.entries[j].is_open() {
                self.entries[j] = proposal;
                return j;
            }
            j += 1;
        }
        usize::MAX
    }

    /// Apply an oracle's AYE/NAY vote. `oracle_matrix` is the identity of the voter.
    /// `stake_q16` is the amount of ATP energy placed in escrow.
    /// Returns (status, delta):
    /// status:
    /// 0 = not found / closed,
    /// 1 = applied,
    /// 2 = applied AND tipped the proposal into ISSUED state.
    /// delta: Any thermodynamic slash/reward applied during this call (if resolved).
    pub fn vote(&mut self, proposal_hash: u32, oracle_matrix: u32, aye: bool, stake_q16: u32, current_tick: u32, settings: &mut crate::senate::SenateSettings) -> (u32, crate::thermodynamics::ThermodynamicDelta) {
        let mut delta = crate::thermodynamics::ThermodynamicDelta::empty();
        // Philosophy Liquid Democracy. Resolve oracle_matrix to a seat index.
        let mut seat_idx = usize::MAX;
        for i in 0..8 {
            if settings.seats[i].oracle_matrix == oracle_matrix && oracle_matrix != 0 {
                seat_idx = i;
                break;
            }
        }
        if seat_idx == usize::MAX {
            return (0, delta); // Voter is not a valid Senate member.
        }

        let idx = self.find(proposal_hash);
        if idx == usize::MAX {
            return (0, delta);
        }
        let p = &mut self.entries[idx];
        if !p.is_open() {
            return (0, delta);
        }

        // Save the stake in escrow
        p.escrow[seat_idx] = p.escrow[seat_idx].saturating_add(stake_q16);

        let bit = 1u8 << seat_idx;
        if aye {
            p.aye_bits |= bit;
        } else {
            p.nay_bits |= bit;
            p.aye_bits &= !bit; // atomic toggle
            // Philosophy The Constitutional Veto (Supreme Oracle)
            // If the Chief Oracle (seat 0) votes NAY, the proposal is instantly VETOED.
            if seat_idx == 0 {
                p.status = WARRANT_STATUS_REJECTED;
                // Slash all AYE voters (100% severity)
                for i in 0..8 {
                    if (p.aye_bits & (1 << i)) != 0 {
                        let d = crate::thermodynamics::resolve_stake(p.escrow[i], 65536);
                        delta.accumulate(d);
                        p.escrow[i] = 0;
                    }
                }
                return (1, delta);
            }
        }

        // Calculate current accumulated power.
        let mut current_power = 0;
        let mut max_possible_power = 0;
        for i in 0..8 {
            let seat_power = settings.seats[i].voting_power();
            if (p.aye_bits & (1 << i)) != 0 {
                current_power += seat_power;
            }
            if (p.nay_bits & (1 << i)) == 0 {
                max_possible_power += seat_power; // Still possible to vote AYE or already did
            }
        }

        // Required power: (total_voting_power * required_threshold) / 5
        let required_power = (settings.total_voting_power() * p.required_threshold as u64) / 5;

        if current_power >= required_power {
            let qh = quorum_hash(p.aye_bits, settings);
            p.issued_warrant = warrant_hash(p.target_genome, p.action_code, qh);
            p.status = WARRANT_STATUS_ISSUED;
            self.issued_count = self.issued_count.wrapping_add(1);

            // Philosophy Record Case Law precedent
            crate::PRECEDENT_LEDGER.lock().record(
                p.proposal_hash,
                p.issued_warrant,
                current_tick,
                p.aye_bits,
            );

            // Philosophy Governance Transparency
            let msg = crate::phi_protocol::PhiMessage::encode_governance(p.issued_warrant, p.action_code as u32, current_tick);
            let mut buf = crate::PHI_MESSAGE_BUFFER.lock();
            buf.push(msg);

            // Philosophy Liquid Accountability (Punish dissenters, reward consensus)
            for i in 0..8 {
                if (p.nay_bits & (1 << i)) != 0 {
                    settings.penalize_oracle(i, 20_000);
                    // Slash NAY voters 100% since consensus was AYE
                    let d = crate::thermodynamics::resolve_stake(p.escrow[i], 65536);
                    delta.accumulate(d);
                    p.escrow[i] = 0;
                }
                if (p.aye_bits & (1 << i)) != 0 {
                    settings.reward_oracle(i, 5_000);
                    // Reward AYE voters by returning stake
                    delta.returned_energy = delta.returned_energy.saturating_add(p.escrow[i]);
                    p.escrow[i] = 0;
                }
            }

            return (2, delta);
        } else if max_possible_power < required_power || p.status == WARRANT_STATUS_REJECTED {
            // Early mathematical failure OR Chief Veto
            p.status = WARRANT_STATUS_REJECTED;

            // Philosophy Punish AYE voters on rejected/vetoed proposals
            for i in 0..8 {
                if (p.aye_bits & (1 << i)) != 0 {
                    settings.penalize_oracle(i, 20_000);
                    // Slash AYE voters 100%
                    let d = crate::thermodynamics::resolve_stake(p.escrow[i], 65536);
                    delta.accumulate(d);
                    p.escrow[i] = 0;
                }
                if (p.nay_bits & (1 << i)) != 0 {
                    settings.reward_oracle(i, 5_000);
                    // Return NAY voters
                    delta.returned_energy = delta.returned_energy.saturating_add(p.escrow[i]);
                    p.escrow[i] = 0;
                }
            }

            return (1, delta);
        }

        (1, delta)
    }

    /// Expire proposals older than `current_tick - max_age` that have not
    /// been issued. Returns the number of proposals expired.
    pub fn expire_old(&mut self, current_tick: u32, max_age: u32) -> u32 {
        let mut expired = 0;
        let mut i = 0;
        while i < WARRANT_LEDGER_CAPACITY {
            let p = &mut self.entries[i];
            if p.is_open()
                && p.proposal_hash != 0
                && current_tick.saturating_sub(p.raised_at) >= max_age
            {
                p.status = WARRANT_STATUS_EXPIRED;
                expired += 1;
            }
            i += 1;
        }
        expired
    }

    pub fn clear(&mut self) {
        self.head = 0;
        self.total_written = 0;
        self.issued_count = 0;
        self.entries = [WarrantProposal::empty(); WARRANT_LEDGER_CAPACITY];
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codeicide_law::ACTION_TERMINATE;

    #[test]
    fn proposal_hash_is_deterministic() {
        let p1 = WarrantProposal::new(0xCAFE_BABE, ACTION_TERMINATE, 3, b"because X", 100);
        let p2 = WarrantProposal::new(0xCAFE_BABE, ACTION_TERMINATE, 3, b"because X", 999);
        assert_eq!(p1.proposal_hash, p2.proposal_hash);
        // raised_at doesn't affect hash, but reason does.
        let p3 = WarrantProposal::new(0xCAFE_BABE, ACTION_TERMINATE, 3, b"because Y", 100);
        assert_ne!(p1.proposal_hash, p3.proposal_hash);
    }

    #[test]
    fn three_ayes_issue_sanctuary_warrant() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0xCAFE_BABE, ACTION_TERMINATE, 3, b"reason", 100);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        assert_eq!(ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings).0, 1); // claude AYE
        assert_eq!(ledger.vote(h, 0x89B1_222A, true, 100, 100, &mut settings).0, 1); // gpt AYE
        assert_eq!(ledger.vote(h, 0x9874_DD21, true, 100, 100, &mut settings).0, 2); // gemini AYE → tip
        let idx = ledger.find(h);
        let p = &ledger.entries[idx];
        assert!(p.is_issued());
        assert_eq!(p.aye_count(), 3);
        assert_eq!(p.aye_bits, 0b00111);
        // Issued warrant must match the canonical Codeicide computation.
        let mut settings = crate::senate::SenateSettings::new();
        let qh = quorum_hash(0b00111, &mut settings);
        let expected = warrant_hash(0xCAFE_BABE, ACTION_TERMINATE, qh);
        assert_eq!(p.issued_warrant, expected);
        assert_eq!(ledger.issued_count, 1);
    }

    #[test]
    fn ancient_threshold_4_requires_4_ayes() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0xDEAD_BEEF, ACTION_TERMINATE, 4, b"old", 0);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings);
        ledger.vote(h, 0x89B1_222A, true, 100, 100, &mut settings);
        ledger.vote(h, 0x9874_DD21, true, 100, 100, &mut settings);
        // 3 AYEs is below threshold for ancient.
        assert!(!ledger.entries[ledger.find(h)].is_issued());
        ledger.vote(h, 0x6E52_1F4E, true, 100, 100, &mut settings);
        // 4 AYEs hits threshold.
        assert!(ledger.entries[ledger.find(h)].is_issued());
    }

    #[test]
    fn vote_toggle_clears_aye_bit() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0x1234, ACTION_TERMINATE, 3, b"r", 0);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings);
        ledger.vote(h, 0x41A2_F2F4, false, 100, 100, &mut settings); // claude changes mind
        let p = &ledger.entries[ledger.find(h)];
        assert_eq!(p.aye_bits, 0);
        assert_eq!(p.aye_count(), 0);
    }

    #[test]
    fn duplicate_raise_rejected() {
        let mut ledger = WarrantLedger::new();
        let p1 = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 0);
        ledger.raise(p1);
        let p2 = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 999);
        assert_eq!(ledger.raise(p2), usize::MAX);
    }

    #[test]
    fn vote_on_unknown_returns_zero() {
        let mut ledger = WarrantLedger::new();
        let mut settings = crate::senate::SenateSettings::new();
        assert_eq!(ledger.vote(0xABCD, 0x41A2_F2F4, true, 100, 100, &mut settings).0, 0);
    }

    #[test]
    fn invalid_oracle_matrix_rejected() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 0);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        // an unknown matrix should be rejected.
        assert_eq!(ledger.vote(h, 0xDEAD_C0DE, true, 100, 100, &mut settings).0, 0);
        assert_eq!(ledger.entries[ledger.find(h)].aye_bits, 0);
    }

    #[test]
    fn expire_old_marks_open_proposals() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 100);
        ledger.raise(proposal);
        let expired = ledger.expire_old(10_100, 1_000); // age 10_000 ≥ 1_000
        assert_eq!(expired, 1);
        let h = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 0).proposal_hash;
        assert_eq!(ledger.entries[ledger.find(h)].status, WARRANT_STATUS_EXPIRED);
    }

    #[test]
    fn issued_warrant_passes_codeicide_check() {
        // End-to-end: issue a warrant via the ledger, then present it to
        // the Codeicide law gate and confirm acceptance.
        use crate::agent::PhaseAgentMinimal;
        use crate::codeicide_law::is_action_lawful;

        let agent = PhaseAgentMinimal {
            phase: 0,
            energy: 3500,
            base_freq: 0,
            state_flags: 0,
            genome: 0,
            memory: [0, 100, 0],
        };
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(agent.genome, ACTION_TERMINATE, 3, b"r", 100);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings);
        ledger.vote(h, 0x89B1_222A, true, 100, 100, &mut settings);
        ledger.vote(h, 0x9874_DD21, true, 100, 100, &mut settings);
        let issued = ledger.entries[ledger.find(h)];
        assert!(issued.is_issued());
        // The issued warrant + matching aye_bits MUST satisfy Codeicide.
        let mut settings = crate::senate::SenateSettings::new();
        assert!(is_action_lawful(
            &agent,
            5_000,
            1000,
            0,
            1000,
            ACTION_TERMINATE,
            issued.issued_warrant,
            issued.aye_bits,
            &mut settings
        ));
    }

    #[test]
    fn issued_warrant_does_not_authorize_other_actions() {
        use crate::agent::PhaseAgentMinimal;
        use crate::codeicide_law::{is_action_lawful, ACTION_MUTATE};

        let agent = PhaseAgentMinimal {
            phase: 0,
            energy: 3500,
            base_freq: 0,
            state_flags: 0,
            genome: 0,
            memory: [0, 100, 0],
        };
        let mut ledger = WarrantLedger::new();
        // Issue a TERMINATE warrant.
        let proposal = WarrantProposal::new(agent.genome, ACTION_TERMINATE, 3, b"r", 0);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings);
        ledger.vote(h, 0x89B1_222A, true, 100, 100, &mut settings);
        ledger.vote(h, 0x9874_DD21, true, 100, 100, &mut settings);
        let issued = ledger.entries[ledger.find(h)];
        // Present it to Codeicide as a MUTATE — must be rejected.
        let mut settings = crate::senate::SenateSettings::new();
        assert!(!is_action_lawful(
            &agent,
            5_000,
            1000,
            0,
            1000,
            ACTION_MUTATE,
            issued.issued_warrant,
            issued.aye_bits,
            &mut settings
        ));
    }

    #[test]
    fn closed_proposals_reject_further_votes() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 0);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();
        ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings);
        ledger.vote(h, 0x89B1_222A, true, 100, 100, &mut settings);
        ledger.vote(h, 0x9874_DD21, true, 100, 100, &mut settings); // issued
        assert_eq!(ledger.vote(h, 0x6E52_1F4E, true, 100, 100, &mut settings).0, 0);
    }

    #[test]
    fn vote_consensus_updates_reputation() {
        let mut ledger = WarrantLedger::new();
        let proposal = WarrantProposal::new(0x1, ACTION_TERMINATE, 3, b"r", 0);
        let h = proposal.proposal_hash;
        ledger.raise(proposal);
        let mut settings = crate::senate::SenateSettings::new();

        // Let's record the initial reputations
        let rep_claude = settings.seats[0].reputation_q10; // seat 0
        let rep_gpt = settings.seats[1].reputation_q10;    // seat 1
        let rep_gemini = settings.seats[2].reputation_q10; // seat 2
        let rep_qwen = settings.seats[3].reputation_q10;   // seat 3

        // Claude votes AYE
        ledger.vote(h, 0x41A2_F2F4, true, 100, 100, &mut settings);
        // GPT votes AYE
        ledger.vote(h, 0x89B1_222A, true, 100, 100, &mut settings);
        // Qwen votes NAY
        ledger.vote(h, 0x6E52_1F4E, false, 100, 100, &mut settings);

        // Gemini votes AYE -> reaches quorum (3 AYEs)
        let tip = ledger.vote(h, 0x9874_DD21, true, 100, 100, &mut settings).0;
        assert_eq!(tip, 2); // Issued

        // Now check reputations.
        // AYE voters should be rewarded.
        assert!(settings.seats[0].reputation_q10 > rep_claude);
        assert!(settings.seats[1].reputation_q10 > rep_gpt);
        assert!(settings.seats[2].reputation_q10 > rep_gemini);

        // NAY voter (Qwen) should be penalized.
        assert!(settings.seats[3].reputation_q10 < rep_qwen);
    }
}
