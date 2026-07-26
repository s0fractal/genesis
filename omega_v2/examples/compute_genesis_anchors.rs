// Regenerate the five FROZEN v1.0 genesis anchors and the genesis hash.
//
// The anchors are pinned to FROZEN INPUTS so they reproduce forever, regardless
// of how the live physics evolves:
//   - senate/proposal anchors: SHA-256 (folded to u32) over fixed 64-byte-padded
//     ASCII strings.
//   - mitosis anchors: `child_receipt_hash` over the exact child fields the
//     kernel derived at freeze time (commit e8b685e). The LIVE kernel now
//     derives a different child (physics evolved — thermodynamic-leakage fix,
//     MUTATION_LUT genome, Landauer, organ differentiation); that live value is
//     printed at the bottom for reference but is NOT the frozen anchor.
//
//   cargo run -q --example compute_genesis_anchors

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::AttractorArray;
use omega_v2::crypto::sha256_u32;
use omega_v2::genesis_inscription::{compute_genesis_hash, GenesisAnchors};
use omega_v2::mitosis_proof::{child_receipt_hash, derive_mitosis_child};

fn pad64(msg: &[u8]) -> [u8; 64] {
    let mut buf = [0u8; 64];
    let n = core::cmp::min(msg.len(), 64);
    buf[..n].copy_from_slice(&msg[..n]);
    buf
}

fn receipt_u32(child: &PhaseAgentMinimal) -> u32 {
    let h = child_receipt_hash(child);
    u32::from_be_bytes([h[0], h[1], h[2], h[3]])
}

// The anchor child as derived by the kernel at freeze time (e8b685e).
fn frozen_child_no_attr() -> PhaseAgentMinimal {
    PhaseAgentMinimal {
        phase: 128,
        energy: 1000,
        base_freq: 7,
        state_flags: 180,
        genome: 3_549_459_802,
        memory: [0xDEAD_BEEF, 1, 2],
    }
}
fn frozen_child_attr() -> PhaseAgentMinimal {
    PhaseAgentMinimal {
        phase: 128,
        energy: 1000,
        base_freq: 7,
        state_flags: 16_777_468,
        genome: 1_630_780_158, // 0xCAFEBABE ^ (0xABCD0000 | 64)
        memory: [0xABCD_0040, 1, 2],
    }
}

fn main() {
    let senate_hash_empty = sha256_u32(&pad64(b""));
    let senate_hash_short = sha256_u32(&pad64(b"Era 1040 ZK"));
    let first_proposal_hash = sha256_u32(&pad64(b"Task 0090: Era 1040 - ZK-Notarized Mutations"));
    let mitosis_receipt_no_attr = receipt_u32(&frozen_child_no_attr());
    let mitosis_receipt_attr = receipt_u32(&frozen_child_attr());

    let anchors = GenesisAnchors {
        senate_hash_empty,
        senate_hash_short,
        first_proposal_hash,
        mitosis_receipt_no_attr,
        mitosis_receipt_attr,
    };
    let genesis = compute_genesis_hash(&anchors);

    println!("-- FROZEN v1.0 anchors (from frozen inputs) --");
    println!("senate_hash_empty:       0x{:08X}", senate_hash_empty);
    println!("senate_hash_short:       0x{:08X}", senate_hash_short);
    println!("first_proposal_hash:     0x{:08X}", first_proposal_hash);
    println!("mitosis_receipt_no_attr: 0x{:08X}", mitosis_receipt_no_attr);
    println!("mitosis_receipt_attr:    0x{:08X}", mitosis_receipt_attr);
    println!("genesis_hash:            0x{:08X}", genesis);
    println!("OP_RETURN:               OMEGA1:{:08x}", genesis);

    // Informational: what the LIVE kernel derives for the same anchor parent now.
    // This will drift as the physics evolves; it is NOT the frozen anchor.
    let parent = PhaseAgentMinimal {
        phase: 64,
        energy: 3000,
        base_freq: 7,
        state_flags: 0,
        genome: 0xCAFE_BABE,
        memory: [0xDEAD_BEEF, 1, 2],
    };
    let live_no_attr = receipt_u32(&derive_mitosis_child(&parent, &AttractorArray::new(), 7));
    println!("\n-- informational: LIVE kernel receipt (physics-dependent, not frozen) --");
    println!("live mitosis_receipt_no_attr: 0x{:08X}", live_no_attr);
}
