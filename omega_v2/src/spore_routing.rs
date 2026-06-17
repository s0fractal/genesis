// Federated Spore-to-Spore Routing

// When no relay node is reachable, spores forward each other's frames
// peer-to-peer along a known-good topology. This module defines the
// minimal forwarding rules that fit in microcontroller RAM:

// - TTL decrements at every hop; frames at TTL=0 are dropped.
// - The frame's `payload_b` slot is repurposed as a "trail digest" —
// a rolling FNV-1a hash of the spore IDs that have already touched
// the frame. Loops are detected when a spore sees its own ID
// contribution back in the trail.
// - The forwarding rule: a healthy spore relays any HEARTBEAT or
// WARRANT_VOTE frame it receives, after decrementing TTL and
// mixing its own spore_id into the trail digest. Forked / stalled
// spores DO NOT forward (the aggregator on the eventual relay
// never trusted them anyway).

// This is intentionally NOT a fully-routed mesh. It's a flooding
// protocol with TTL + loop detection — appropriate for daisy-chained
// UART or BLE-mesh topologies, where the alternative is no
// communication at all.

use crate::crypto::sha256_u32;
use crate::spore_frame::{SporeFrame, FRAME_TYPE_HEARTBEAT, FRAME_TYPE_WARRANT_VOTE};

/// Default TTL on a freshly-emitted frame. 4 hops covers a small ring
/// of spores; relays normally short-circuit after 1 hop.
pub const DEFAULT_TTL: u8 = 4;

/// Frames carry their TTL in the high byte of `payload_c`.
const TTL_SHIFT: u32 = 24;
const TTL_MASK: u32 = 0xFF00_0000;

/// Trail digest lives in `payload_b`; mixing rule is FNV-1a over
/// (existing_digest_BE || spore_id_be) reduced to 32 bits.
pub fn mix_trail(existing: u32, spore_id: u32) -> u32 {
    let mut buf = [0u8; 8];
    buf[0..4].copy_from_slice(&existing.to_be_bytes());
    buf[4..8].copy_from_slice(&spore_id.to_be_bytes());
    sha256_u32(&buf)
}

/// Returns the TTL byte from a frame.
pub fn frame_ttl(f: &SporeFrame) -> u8 {
    ((f.payload_c & TTL_MASK) >> TTL_SHIFT) as u8
}

/// Returns the trail digest from a frame.
pub fn frame_trail(f: &SporeFrame) -> u32 {
    f.payload_b
}

/// Stamps a fresh frame with TTL + zero trail. Returns the new frame
/// (CRC must be recomputed by the caller before transmission).
pub fn stamp_origin(mut f: SporeFrame, ttl: u8) -> SporeFrame {
    f.payload_b = 0;
    f.payload_c = (f.payload_c & !TTL_MASK) | ((ttl as u32) << TTL_SHIFT);
    f
}

/// Routing decision codes returned by `decide_forward`.
pub const FWD_DROP_TTL_ZERO: u8 = 0; // TTL exhausted
pub const FWD_DROP_LOOP: u8 = 1; // we already touched this frame
pub const FWD_DROP_NOT_FORWARDABLE: u8 = 2; // frame_type isn't relayable
pub const FWD_FORWARD: u8 = 3; // forward, with TTL-1 + new trail
pub const FWD_DELIVER_LOCAL: u8 = 4; // forward AND consume locally

/// A spore-routing decision plus the frame to retransmit (if any).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RoutingDecision {
    pub code: u8,
    pub forwarded_frame: SporeFrame,
}

/// Decide what to do with an incoming frame at this spore.
///
/// `our_spore_id` is the spore's own dipole-derived stable ID
/// (typically `oracle_matrix(name, ORACLE_SALT_V1)` for canonical
/// oracles, or any stable u32 for non-oracle peers).
///
/// `our_genesis_for_local_consume` is normally `GENESIS_HASH_V1_0`;
/// if the frame's claimed genesis differs (FORKED at the wire),
/// we drop without forwarding to keep drift contained.
pub fn decide_forward(
    incoming: &SporeFrame,
    our_spore_id: u32,
    our_genesis_for_local_consume: u32,
) -> RoutingDecision {
    let mut out = *incoming;

    // (1) Frame type gate.
    let ft = incoming.frame_type;
    if ft != FRAME_TYPE_HEARTBEAT && ft != FRAME_TYPE_WARRANT_VOTE {
        return RoutingDecision {
            code: FWD_DROP_NOT_FORWARDABLE,
            forwarded_frame: out,
        };
    }

    // (2) Drop forked HEARTBEATs at the wire — don't propagate drift.
    if ft == FRAME_TYPE_HEARTBEAT && incoming.proposal_or_target != our_genesis_for_local_consume {
        return RoutingDecision {
            code: FWD_DROP_NOT_FORWARDABLE,
            forwarded_frame: out,
        };
    }

    // (3) TTL check.
    let ttl = frame_ttl(incoming);
    if ttl == 0 {
        return RoutingDecision {
            code: FWD_DROP_TTL_ZERO,
            forwarded_frame: out,
        };
    }

    // (4) Loop detection: if mixing our_spore_id into the trail produces
    // a digest matching one we've already seen on this frame, the frame
    // has come back to us.
    let new_trail = mix_trail(incoming.payload_b, our_spore_id);
    if new_trail == incoming.payload_b {
        // Pathological case (zero-id mix into zero — unlikely but cover).
        return RoutingDecision {
            code: FWD_DROP_LOOP,
            forwarded_frame: out,
        };
    }
    // Heuristic loop: if the existing trail digest equals what mixing
    // our_spore_id again would produce, we are downstream of ourselves.
    let twice_mixed = mix_trail(new_trail, our_spore_id);
    if twice_mixed == incoming.payload_b {
        return RoutingDecision {
            code: FWD_DROP_LOOP,
            forwarded_frame: out,
        };
    }

    // (5) Build the forwarded frame: decrement TTL, update trail.
    out.payload_b = new_trail;
    let new_ttl = ttl - 1;
    out.payload_c = (out.payload_c & !TTL_MASK) | ((new_ttl as u32) << TTL_SHIFT);
    // The caller must recompute CRC after returning.
    out.crc32 = out.compute_crc();

    // (6) For WARRANT_VOTE frames the local spore also CONSUMES the
    // vote (applies it to its own warrant ledger). HEARTBEATs don't
    // need local consumption — they're informational for relays.
    let code = if ft == FRAME_TYPE_WARRANT_VOTE {
        FWD_DELIVER_LOCAL
    } else {
        FWD_FORWARD
    };

    RoutingDecision {
        code,
        forwarded_frame: out,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_warrant(genome: u32, oracle_bit: u8, tick: u32) -> SporeFrame {
        let mut f = SporeFrame::warrant_vote(genome, oracle_bit, true, tick);
        f = stamp_origin(f, DEFAULT_TTL);
        f.crc32 = f.compute_crc();
        f
    }

    fn fresh_heartbeat(genesis: u32, tick: u32) -> SporeFrame {
        let mut f = SporeFrame::heartbeat(genesis, tick);
        f = stamp_origin(f, DEFAULT_TTL);
        f.crc32 = f.compute_crc();
        f
    }

    #[test]
    fn ttl_round_trips() {
        let f = stamp_origin(SporeFrame::empty(), 7);
        assert_eq!(frame_ttl(&f), 7);
    }

    #[test]
    fn warrant_vote_forwards_and_decrements_ttl() {
        let f = fresh_warrant(0xCAFE_BABE, 0, 100);
        let d = decide_forward(&f, 0xAAAA_AAAA, 0x549A_6307);
        assert_eq!(d.code, FWD_DELIVER_LOCAL);
        assert_eq!(frame_ttl(&d.forwarded_frame), DEFAULT_TTL - 1);
        assert!(d.forwarded_frame.is_valid());
        assert_ne!(d.forwarded_frame.payload_b, 0); // trail mutated
    }

    #[test]
    fn heartbeat_forwards_when_genesis_matches() {
        let f = fresh_heartbeat(0x549A_6307, 1);
        let d = decide_forward(&f, 0x1234_5678, 0x549A_6307);
        assert_eq!(d.code, FWD_FORWARD);
    }

    #[test]
    fn heartbeat_dropped_when_genesis_drifted() {
        let f = fresh_heartbeat(0xDEAD_BEEF, 1);
        let d = decide_forward(&f, 0x1234_5678, 0x549A_6307);
        assert_eq!(d.code, FWD_DROP_NOT_FORWARDABLE);
    }

    #[test]
    fn ttl_zero_drops() {
        let mut f = fresh_warrant(0xCAFE_BABE, 0, 0);
        f = stamp_origin(f, 0);
        f.crc32 = f.compute_crc();
        let d = decide_forward(&f, 0xAAAA, 0x549A_6307);
        assert_eq!(d.code, FWD_DROP_TTL_ZERO);
    }

    #[test]
    fn unknown_frame_type_dropped() {
        let mut f = SporeFrame::empty();
        f.frame_type = 99;
        f = stamp_origin(f, DEFAULT_TTL);
        f.crc32 = f.compute_crc();
        let d = decide_forward(&f, 0xAAAA, 0x549A_6307);
        assert_eq!(d.code, FWD_DROP_NOT_FORWARDABLE);
    }

    #[test]
    fn trail_mix_is_deterministic() {
        let m1 = mix_trail(0x1234_5678, 0xDEAD_BEEF);
        let m2 = mix_trail(0x1234_5678, 0xDEAD_BEEF);
        assert_eq!(m1, m2);
    }

    #[test]
    fn trail_mix_differs_on_different_inputs() {
        let m1 = mix_trail(0x1234_5678, 0xDEAD_BEEF);
        let m2 = mix_trail(0x1234_5678, 0xCAFE_BABE);
        assert_ne!(m1, m2);
    }

    #[test]
    fn three_hop_chain_decrements_ttl() {
        let mut f = fresh_warrant(0xCAFE_BABE, 0, 0);
        let spores = [0x1111_1111u32, 0x2222_2222, 0x3333_3333];
        for s in spores {
            let d = decide_forward(&f, s, 0x549A_6307);
            assert_eq!(d.code, FWD_DELIVER_LOCAL);
            f = d.forwarded_frame;
        }
        // Started at TTL=4 (DEFAULT_TTL), three hops, so TTL should be 1.
        assert_eq!(frame_ttl(&f), 1);
    }

    #[test]
    fn ttl_eventually_reaches_zero() {
        let mut f = fresh_warrant(0xCAFE_BABE, 0, 0);
        let mut hops = 0;
        loop {
            let d = decide_forward(&f, 0x1000_0000 + hops as u32, 0x549A_6307);
            if d.code == FWD_DROP_TTL_ZERO {
                break;
            }
            assert!(matches!(d.code, FWD_FORWARD | FWD_DELIVER_LOCAL));
            f = d.forwarded_frame;
            hops += 1;
            assert!(hops < 10, "should have hit TTL=0 within 10 hops");
        }
        assert_eq!(hops, DEFAULT_TTL as usize);
    }

    #[test]
    fn forwarded_frame_carries_valid_crc() {
        let f = fresh_warrant(0xCAFE_BABE, 1, 50);
        let d = decide_forward(&f, 0xBBBB_BBBB, 0x549A_6307);
        // Must be parseable from bytes (CRC checks out).
        let bytes = d.forwarded_frame.as_bytes();
        let parsed = SporeFrame::from_bytes(&bytes);
        assert!(
            parsed.is_some(),
            "forwarded frame must round-trip through CRC"
        );
    }

    #[test]
    fn cross_lang_anchor_trail_mix() {
        // Frozen for the JS port.
        let h = mix_trail(0, 0x6B70_A8AB); // claude is the first hop
        eprintln!("rust trail = 0x{:08x}", h);
        assert_eq!(h, 0x0c10_5977);
    }
}
