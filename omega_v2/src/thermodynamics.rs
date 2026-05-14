//! Thermodynamics: Staked Resonance and Entropy Accounting
//!
//! Implements "Skin-in-the-Game" staking for Oracles. Energy is not created;
//! it is staked, and if consensus diverges, it is slashed into compost (reusable)
//! and heat/entropy (Landauer burn).

#[derive(Clone, Copy, Debug, Default)]
#[repr(C)]
pub struct ThermodynamicDelta {
    pub returned_energy: u32,
    pub slashed_compost: u32,
    pub slashed_entropy: u32,
}

impl ThermodynamicDelta {
    pub const fn empty() -> Self {
        Self {
            returned_energy: 0,
            slashed_compost: 0,
            slashed_entropy: 0,
        }
    }

    /// Accumulate another delta into this one.
    pub fn accumulate(&mut self, other: Self) {
        self.returned_energy = self.returned_energy.wrapping_add(other.returned_energy);
        self.slashed_compost = self.slashed_compost.wrapping_add(other.slashed_compost);
        self.slashed_entropy = self.slashed_entropy.wrapping_add(other.slashed_entropy);
    }
}

/// Slashes a given stake based on how badly it failed (0.0 to 1.0 represented by `severity_q16`).
/// `severity_q16` = 65536 means full slash.
pub fn resolve_stake(stake: u32, severity_q16: u32) -> ThermodynamicDelta {
    let severity = severity_q16.min(65536) as u64;
    let slashed = ((stake as u64 * severity) >> 16) as u32;
    let returned = stake.saturating_sub(slashed);

    // 70% goes to compost (reusable for new agents), 30% goes to heat (Landauer burn).
    // 0.7 in Q16 is ~45875.
    let compost = ((slashed as u64 * 45875) >> 16) as u32;
    let entropy = slashed.saturating_sub(compost);

    ThermodynamicDelta {
        returned_energy: returned,
        slashed_compost: compost,
        slashed_entropy: entropy,
    }
}
