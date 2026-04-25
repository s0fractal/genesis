//! Halo Synchronization (Era 400: Distributed Federation)
//!
//! In a distributed toroidal lattice, each node only owns a slice of agents.
//! Boundary agents (the leftmost and rightmost living cells) must be exchanged
//! with adjacent nodes so that Kuramoto coupling remains continuous across
//! the split. Without halo sync, the lattice fractures into isolated islands.
//!
//! # Architecture
//! ```text
//! Node A          Node B          Node C
//! [a0 a1 a2 a3] ↔ [b0 b1 b2 b3] ↔ [c0 c1 c2 c3]
//!       ↑_________↓       ↑_________↓
//!       Halo exchange      Halo exchange
//! ```
//! Node B's `left_halo` = Node A's rightmost agent (a3)
//! Node B's `right_halo` = Node C's leftmost agent (c0)

use crate::agent::PhaseAgentMinimal;

/// Width of the halo region (number of ghost cells per boundary).
/// For Kuramoto 1D coupling only ±1 neighbor is needed, so HALO_WIDTH = 1.
pub const HALO_WIDTH: usize = 1;

/// Boundary snapshot exchanged between adjacent federation nodes.
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct HaloState {
    /// Left boundary agents (owned by the *previous* node in the ring).
    /// Node N uses these as ghost neighbors for its own leftmost agents.
    pub left_halo: [PhaseAgentMinimal; HALO_WIDTH],
    /// Right boundary agents (owned by the *next* node in the ring).
    /// Node N uses these as ghost neighbors for its own rightmost agents.
    pub right_halo: [PhaseAgentMinimal; HALO_WIDTH],
    /// Sequence number to detect stale halos (monotonically incremented).
    pub sequence: u64,
}

impl HaloState {
    pub const fn empty() -> Self {
        Self {
            left_halo: [PhaseAgentMinimal {
                phase: 0,
                energy: 0,
                base_freq: 0,
                state_flags: 0,
                genome: 0,
                memory: [0, 0, 0],
            }; HALO_WIDTH],
            right_halo: [PhaseAgentMinimal {
                phase: 0,
                energy: 0,
                base_freq: 0,
                state_flags: 0,
                genome: 0,
                memory: [0, 0, 0],
            }; HALO_WIDTH],
            sequence: 0,
        }
    }

    /// Extract boundary agents from a local agent slice into this HaloState.
    /// `agents` is the full array; `active` is the number of living agents.
    ///
    /// # Panics
    /// Panics if `active` is 0 (no boundary to extract).
    pub fn extract(&mut self, agents: &[PhaseAgentMinimal], active: usize) {
        assert!(active > 0, "Cannot extract halo from empty lattice");
        // Left boundary = agent 0
        self.left_halo[0] = agents[0];
        // Right boundary = agent active-1
        self.right_halo[0] = agents[active - 1];
        self.sequence = self.sequence.wrapping_add(1);
    }

    /// Returns true if both halos contain at least one living agent.
    pub fn is_connected(&self) -> bool {
        self.left_halo[0].energy > 0 && self.right_halo[0].energy > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_agent(phase: u32, energy: u32) -> PhaseAgentMinimal {
        PhaseAgentMinimal {
            phase,
            energy,
            base_freq: 0,
            state_flags: 0,
            genome: 0,
            memory: [0, 0, 0],
        }
    }

    #[test]
    fn test_halo_extract() {
        let agents = [
            make_agent(10, 100),
            make_agent(20, 200),
            make_agent(30, 300),
        ];
        let mut halo = HaloState::empty();
        halo.extract(&agents, 3);
        assert_eq!(halo.left_halo[0].phase, 10);
        assert_eq!(halo.left_halo[0].energy, 100);
        assert_eq!(halo.right_halo[0].phase, 30);
        assert_eq!(halo.right_halo[0].energy, 300);
        assert_eq!(halo.sequence, 1);
    }

    #[test]
    fn test_halo_empty() {
        let halo = HaloState::empty();
        assert_eq!(halo.left_halo[0].energy, 0);
        assert_eq!(halo.right_halo[0].energy, 0);
        assert!(!halo.is_connected());
    }

    #[test]
    fn test_halo_connected() {
        let mut halo = HaloState::empty();
        halo.left_halo[0].energy = 100;
        halo.right_halo[0].energy = 200;
        assert!(halo.is_connected());
    }

    #[test]
    fn test_halo_sequence_increments() {
        let agents = [make_agent(0, 1); 2];
        let mut h = HaloState::empty();
        h.extract(&agents, 2);
        assert_eq!(h.sequence, 1);
        h.extract(&agents, 2);
        assert_eq!(h.sequence, 2);
        h.extract(&agents, 2);
        assert_eq!(h.sequence, 3);
    }
}
