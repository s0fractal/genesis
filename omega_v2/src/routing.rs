// 🌌 OMEGA-64: Era 1000 — Fourier/Taylor Phase Routing (Hyperbolic DNS)
//
// Replaces flat IP/DHT routing tables with a phase-gradient manifold.
// A PhaseAddress is a vector of angular deviations:
//   [Consensus, Social, Personal, Micro]
// Each level has a smaller "radius of influence" (logarithmic or power-of-2).
// Packets (plasmids) fall toward the nearest phase well along the gradient.

use crate::agent::PhaseAgentMinimal;

/// A 32-bit hierarchical phase address.
/// Layout: [consensus:8 | social:8 | personal:8 | micro:8]
/// Each byte is an angle in the shared q_phase space (default 0..255 for q_phase=8).
/// The "radius of influence" halves at each level (consensus = global,
//  social = cluster, personal = agent, micro = mutation).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PhaseAddress {
    pub raw: u32,
}

impl PhaseAddress {
    /// Build from raw u32.
    pub const fn from_raw(raw: u32) -> Self {
        Self { raw }
    }

    /// Derive address from an agent.
    /// - consensus = agent.phase (global position in torus)
    /// - social    = (agent.genome >> 8) & 0xFF (cluster/archtype)
    /// - personal  = agent.genome & 0xFF (individual identity)
    /// - micro     = agent.memory[0] & 0xFF (recent mutation / intent trace)
    pub fn from_agent(agent: &PhaseAgentMinimal, _q_phase: u32) -> Self {
        let consensus = agent.phase & 0xFF;
        let social = (agent.genome >> 8) & 0xFF;
        let personal = agent.genome & 0xFF;
        let micro = agent.memory[0] & 0xFF;
        Self {
            raw: (consensus << 24) | (social << 16) | (personal << 8) | micro,
        }
    }

    #[inline(always)]
    pub fn consensus(self) -> u8 {
        (self.raw >> 24) as u8
    }

    #[inline(always)]
    pub fn social(self) -> u8 {
        (self.raw >> 16) as u8
    }

    #[inline(always)]
    pub fn personal(self) -> u8 {
        (self.raw >> 8) as u8
    }

    #[inline(always)]
    pub fn micro(self) -> u8 {
        self.raw as u8
    }

    /// Hyperbolic distance between two addresses.
    /// Each level contributes with halving weight:
    ///   d = |Δconsensus| + |Δsocial|/2 + |Δpersonal|/4 + |Δmicro|/8
    /// This is integer-only (Q3 fixed-point, result scaled ×8).
    /// To get the true distance, divide by 8.
    pub fn hyperbolic_distance_scaled(self, other: Self) -> u32 {
        let dc = self.consensus().abs_diff(other.consensus()) as u32;
        let ds = self.social().abs_diff(other.social()) as u32;
        let dp = self.personal().abs_diff(other.personal()) as u32;
        let dm = self.micro().abs_diff(other.micro()) as u32;
        // Weights: 8, 4, 2, 1  →  sum ×8 for integer precision
        dc * 8 + ds * 4 + dp * 2 + dm
    }

    /// Toroidal hyperbolic distance (consensus wraps at 256).
    /// For a phase ring, the shortest path between 0 and 224 is 32 (not 224).
    /// Only consensus is wrapped; social/personal/micro remain linear.
    pub fn hyperbolic_distance_toroidal_scaled(self, other: Self) -> u32 {
        let raw_dc = self.consensus().abs_diff(other.consensus()) as u32;
        let dc = core::cmp::min(raw_dc, 256 - raw_dc);
        let ds = self.social().abs_diff(other.social()) as u32;
        let dp = self.personal().abs_diff(other.personal()) as u32;
        let dm = self.micro().abs_diff(other.micro()) as u32;
        dc * 8 + ds * 4 + dp * 2 + dm
    }

    /// First-order Taylor step toward `target`.
    /// Returns a new PhaseAddress moved by the linear term:
    ///   f(x + Δ) ≈ f(x) + Δ
    /// where Δ is the signed delta per level, clamped to ±max_step.
    /// `max_step` limits how far a single hop may travel (prevents overshoot).
    pub fn taylor_step_toward(self, target: Self, max_step: u8) -> Self {
        let step = |a: u8, b: u8| -> u8 {
            let delta = b as i16 - a as i16;
            let clamped = if delta > max_step as i16 {
                max_step as i16
            } else if delta < -(max_step as i16) {
                -(max_step as i16)
            } else {
                delta
            };
            (a as i16 + clamped) as u8
        };
        let c = step(self.consensus(), target.consensus());
        let s = step(self.social(), target.social());
        let p = step(self.personal(), target.personal());
        let m = step(self.micro(), target.micro());
        Self::from_raw(
            ((c as u32) << 24) | ((s as u32) << 16) | ((p as u32) << 8) | (m as u32),
        )
    }

    /// Second-order Taylor correction using curvature.
    /// `curvature` is a pre-computed second-derivative vector (same layout as PhaseAddress).
    /// Formula: f(x + Δ) ≈ f(x) + Δ + curvature · Δ²/2
    /// For integer-only execution Δ²/2 is approximated as (Δ * Δ) >> 1,
    /// and curvature is treated as a signed 8-bit coefficient.
    pub fn taylor_step_with_curvature(
        self,
        target: Self,
        max_step: u8,
        curvature: Self,
    ) -> Self {
        let step = |a: u8, b: u8, curv: i8| -> u8 {
            let delta = b as i16 - a as i16;
            let clamped = if delta > max_step as i16 {
                max_step as i16
            } else if delta < -(max_step as i16) {
                -(max_step as i16)
            } else {
                delta
            };
            // Second-order term: curvature * (clamped * clamped) / 2
            // Using i32 to prevent overflow, then clamp back to u8.
            let sq = (clamped * clamped) >> 1;
            let second = (curv as i32 * (sq as i32)) >> 7; // curvature is Q7 signed
            let result = (a as i32) + (clamped as i32) + second;
            if result < 0 { 0 } else if result > 255 { 255 } else { result as u8 }
        };
        let c = step(self.consensus(), target.consensus(), curvature.consensus() as i8);
        let s = step(self.social(), target.social(), curvature.social() as i8);
        let p = step(self.personal(), target.personal(), curvature.personal() as i8);
        let m = step(self.micro(), target.micro(), curvature.micro() as i8);
        Self::from_raw(
            ((c as u32) << 24) | ((s as u32) << 16) | ((p as u32) << 8) | (m as u32),
        )
    }

    /// Greedy next-hop selection among a slice of neighbour addresses.
    /// Returns the index of the neighbour with the smallest hyperbolic distance
    /// to `target`. If `neighbours` is empty, returns `None`.
    pub fn greedy_next_hop(self, target: Self, neighbours: &[PhaseAddress]) -> Option<usize> {
        let mut best_idx = 0usize;
        let mut best_dist = u32::MAX;
        let mut found = false;
        for (i, &n) in neighbours.iter().enumerate() {
            let d = n.hyperbolic_distance_scaled(target);
            if d < best_dist {
                best_dist = d;
                best_idx = i;
                found = true;
            }
        }
        if found { Some(best_idx) } else { None }
    }

    /// Encode the address as a 32-bit phi value for the Bitcoin anchor chain.
    /// Uses the consensus byte as the high-order phase, lower bytes as fingerprint.
    pub fn to_phi(self) -> u32 {
        self.raw
    }
}

// ------------------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    fn addr(c: u8, s: u8, p: u8, m: u8) -> PhaseAddress {
        PhaseAddress::from_raw(
            ((c as u32) << 24) | ((s as u32) << 16) | ((p as u32) << 8) | (m as u32),
        )
    }

    #[test]
    fn test_address_from_agent() {
        let agent = PhaseAgentMinimal {
            phase: 0xAB,
            energy: 100,
            base_freq: 0,
            state_flags: 0,
            genome: 0xCDEF_1234,
            memory: [0x55, 0, 0],
        };
        let a = PhaseAddress::from_agent(&agent, 7);
        assert_eq!(a.consensus(), 0xAB);
        // genome = 0xCDEF_1234
        // social    = (genome >> 8)  & 0xFF = 0x12
        // personal  = (genome)       & 0xFF = 0x34
        assert_eq!(a.social(), 0x12);
        assert_eq!(a.personal(), 0x34);
        assert_eq!(a.micro(), 0x55);
    }

    #[test]
    fn test_hyperbolic_distance_identity() {
        let a = addr(10, 20, 30, 40);
        assert_eq!(a.hyperbolic_distance_scaled(a), 0);
    }

    #[test]
    fn test_hyperbolic_distance_symmetry() {
        let a = addr(0, 0, 0, 0);
        let b = addr(1, 2, 4, 8);
        assert_eq!(
            a.hyperbolic_distance_scaled(b),
            b.hyperbolic_distance_scaled(a)
        );
    }

    #[test]
    fn test_hyperbolic_distance_toroidal() {
        // On a 256-element ring, distance between 0 and 224 should be 32 (wrapped)
        let a = addr(0, 0, 0, 0);
        let b = addr(224, 0, 0, 0);
        let linear = a.hyperbolic_distance_scaled(b);
        let toroidal = a.hyperbolic_distance_toroidal_scaled(b);
        assert_eq!(linear, 224 * 8, "Linear distance should be 224*8");
        assert_eq!(toroidal, 32 * 8, "Toroidal distance should be 32*8");

        // Adjacent elements: 0 and 1 — same for both
        let c = addr(1, 0, 0, 0);
        assert_eq!(
            a.hyperbolic_distance_scaled(c),
            a.hyperbolic_distance_toroidal_scaled(c)
        );

        // Exactly opposite: 0 and 128 — same for both (min(128, 128) = 128)
        let d = addr(128, 0, 0, 0);
        assert_eq!(
            a.hyperbolic_distance_scaled(d),
            a.hyperbolic_distance_toroidal_scaled(d)
        );
    }

    #[test]
    fn test_hyperbolic_distance_weights() {
        // consensus has 8× weight, social 4×, personal 2×, micro 1×
        let a = addr(0, 0, 0, 0);
        let b1 = addr(1, 0, 0, 0); // distance = 1*8 = 8
        let b2 = addr(0, 2, 0, 0); // distance = 2*4 = 8
        let b3 = addr(0, 0, 4, 0); // distance = 4*2 = 8
        let b4 = addr(0, 0, 0, 8); // distance = 8*1 = 8
        assert_eq!(a.hyperbolic_distance_scaled(b1), 8);
        assert_eq!(a.hyperbolic_distance_scaled(b2), 8);
        assert_eq!(a.hyperbolic_distance_scaled(b3), 8);
        assert_eq!(a.hyperbolic_distance_scaled(b4), 8);
    }

    #[test]
    fn test_taylor_step_toward() {
        let src = addr(0, 0, 0, 0);
        let dst = addr(100, 50, 25, 10);
        // With max_step = 10, each level moves by at most 10
        let step = src.taylor_step_toward(dst, 10);
        assert_eq!(step.consensus(), 10);
        assert_eq!(step.social(), 10);
        assert_eq!(step.personal(), 10);
        assert_eq!(step.micro(), 10);
    }

    #[test]
    fn test_taylor_step_clamped() {
        let src = addr(200, 200, 200, 200);
        let dst = addr(0, 0, 0, 0);
        // max_step = 50, should move backward by 50 each level
        let step = src.taylor_step_toward(dst, 50);
        assert_eq!(step.consensus(), 150);
        assert_eq!(step.social(), 150);
        assert_eq!(step.personal(), 150);
        assert_eq!(step.micro(), 150);
    }

    #[test]
    fn test_greedy_next_hop() {
        let src = addr(0, 0, 0, 0);
        let target = addr(100, 0, 0, 0);
        let n0 = addr(10, 0, 0, 0);
        let n1 = addr(90, 0, 0, 0); // closer to target
        let n2 = addr(50, 0, 0, 0);
        let neighbours = [n0, n1, n2];
        let idx = src.greedy_next_hop(target, &neighbours);
        assert_eq!(idx, Some(1)); // n1 is closest
    }

    #[test]
    fn test_greedy_next_hop_empty() {
        let src = addr(0, 0, 0, 0);
        let target = addr(100, 0, 0, 0);
        let neighbours: &[PhaseAddress] = &[];
        assert_eq!(src.greedy_next_hop(target, neighbours), None);
    }

    #[test]
    fn test_taylor_curvature_non_negative() {
        // Positive curvature should accelerate toward target
        let src = addr(0, 0, 0, 0);
        let dst = addr(100, 0, 0, 0);
        let flat = src.taylor_step_toward(dst, 10);
        let curved = src.taylor_step_with_curvature(dst, 10, addr(127, 0, 0, 0));
        // Positive curvature on consensus should push further than flat step
        assert!(curved.consensus() >= flat.consensus(),
            "Positive curvature should not reduce step");
    }

    #[test]
    fn test_taylor_curvature_negative() {
        // Negative curvature should decelerate (pull back)
        let src = addr(0, 0, 0, 0);
        let dst = addr(100, 0, 0, 0);
        let flat = src.taylor_step_toward(dst, 10);
        let curved = src.taylor_step_with_curvature(dst, 10, addr(128, 0, 0, 0)); // -128 in i8
        // Negative curvature on consensus should reduce step or stay same
        assert!(curved.consensus() <= flat.consensus(),
            "Negative curvature should not increase step");
    }

    #[test]
    fn test_to_phi_roundtrip() {
        let a = addr(0xDE, 0xAD, 0xBE, 0xEF);
        let phi = a.to_phi();
        let b = PhaseAddress::from_raw(phi);
        assert_eq!(a, b);
    }

    #[test]
    fn test_greedy_route_1d_torus() {
        // Simulate a ring of 8 agents with addresses spaced by 32 in consensus.
        // Social/personal/micro are identical (clustered species).
        let agents: [PhaseAddress; 8] = [
            addr(0, 0, 0, 0),
            addr(32, 0, 0, 0),
            addr(64, 0, 0, 0),
            addr(96, 0, 0, 0),
            addr(128, 0, 0, 0),
            addr(160, 0, 0, 0),
            addr(192, 0, 0, 0),
            addr(224, 0, 0, 0),
        ];

        // Route from agent 0 (consensus=0) to agent 3 (consensus=96).
        // On a 1D torus each agent has 2 neighbours: left and right.
        // Hyperbolic distance is linear (not toroidal), so from 0 the right neighbour
        // (32, distance to 96 = 512) is closer than the left neighbour (224, distance = 1024).
        let src = agents[0];
        let target = agents[3];

        // Simulate greedy forwarding
        let mut current = src;
        let mut path = vec![];
        let max_hops = 8;
        for _ in 0..max_hops {
            if current == target {
                break;
            }
            let current_idx = agents.iter().position(|&a| a == current).unwrap();
            let left_idx = (current_idx + 7) % 8;
            let right_idx = (current_idx + 1) % 8;
            let neighbours = [agents[left_idx], agents[right_idx]];

            let next = current.greedy_next_hop(target, &neighbours);
            match next {
                Some(idx) => {
                    current = neighbours[idx];
                    path.push(current);
                }
                None => break,
            }
        }

        assert_eq!(current, target, "Greedy routing should reach target within {} hops", max_hops);
        // Expected path: 0 → 32 → 64 → 96 (rightward, shortest linear path)
        assert_eq!(path.len(), 3, "Expected 3 hops for 0→96 greedy route");
        assert_eq!(path[0], agents[1]);
        assert_eq!(path[1], agents[2]);
        assert_eq!(path[2], agents[3]);
    }
}
