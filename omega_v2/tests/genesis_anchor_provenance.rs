// Genesis anchor provenance — the guardrail that was missing.
//
// The v1.0 Genesis Inscription (0x716EA2F8) is FROZEN. This test proves it is
// eternally reproducible from FROZEN INPUTS — fixed strings and fixed child
// field values — so it can never again drift silently the way the mitosis
// anchors once did. Every anchor is RECOMPUTED here, not compared to a sibling
// literal (the old genesis tests asserted literal == literal, which caught
// nothing).
//
// Why the mitosis anchors are pinned to frozen INPUTS, not the live kernel:
//   At commit e8b685e the anchor child (parent phase=64 / energy=3000 /
//   genome=0xCAFEBABE) derived to energy=1000 / state_flags=180 /
//   genome=3549459802, whose SHA-256 receipt is 0xF73DB063. Afterwards,
//   legitimate physics evolution (thermodynamic-leakage fix, MUTATION_LUT
//   genome, Landauer epistemology, organ differentiation) changed how the LIVE
//   kernel derives that same child (now energy=1020 / state_flags=56 /
//   genome=3271474076 -> receipt 0x1B18EEA0). A genesis inscription is a frozen
//   MOMENT, not a live mirror, so the receipts are pinned to their frozen
//   inputs. The frozen children below reproduce the frozen receipts forever,
//   independent of how the physics keeps evolving.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::crypto::sha256_u32;
use omega_v2::genesis_inscription::{
    compute_genesis_hash, GenesisAnchors, GENESIS_HASH_LEGACY_V1_0,
};
use omega_v2::mitosis_proof::child_receipt_hash;

fn pad64(msg: &[u8]) -> [u8; 64] {
    let mut buf = [0u8; 64];
    let n = core::cmp::min(msg.len(), 64);
    buf[..n].copy_from_slice(&msg[..n]);
    buf
}

// The mitosis anchor is the first 4 big-endian bytes of `child_receipt_hash`,
// i.e. `sha256_u32` over the same canonical 32-byte agent layout.
fn receipt_u32(child: &PhaseAgentMinimal) -> u32 {
    let h = child_receipt_hash(child);
    u32::from_be_bytes([h[0], h[1], h[2], h[3]])
}

// FROZEN anchor children — the exact fields the kernel derived at e8b685e.
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

#[test]
fn genesis_recomputes_from_frozen_inputs() {
    // Layer 1: the five anchors, each recomputed from a frozen input.
    let senate_hash_empty = sha256_u32(&pad64(b""));
    let senate_hash_short = sha256_u32(&pad64(b"Era 1040 ZK"));
    let first_proposal_hash = sha256_u32(&pad64(b"Task 0090: Era 1040 - ZK-Notarized Mutations"));
    let mitosis_receipt_no_attr = receipt_u32(&frozen_child_no_attr());
    let mitosis_receipt_attr = receipt_u32(&frozen_child_attr());

    assert_eq!(senate_hash_empty, 0xF5A5_FD42, "senate_hash_empty");
    assert_eq!(senate_hash_short, 0x1530_2EC1, "senate_hash_short");
    assert_eq!(first_proposal_hash, 0x3008_3117, "first_proposal_hash");
    assert_eq!(
        mitosis_receipt_no_attr, 0xF73D_B063,
        "mitosis_receipt_no_attr"
    );
    assert_eq!(mitosis_receipt_attr, 0x8C3A_C082, "mitosis_receipt_attr");

    // The frozen struct MUST equal what we just recomputed. If a future edit
    // changes an anchor constant, or the hash primitive, or the frozen child
    // fields, this fails — the drift is caught at CI, not three months later.
    let a = GenesisAnchors::V1_0;
    assert_eq!(a.senate_hash_empty, senate_hash_empty);
    assert_eq!(a.senate_hash_short, senate_hash_short);
    assert_eq!(a.first_proposal_hash, first_proposal_hash);
    assert_eq!(a.mitosis_receipt_no_attr, mitosis_receipt_no_attr);
    assert_eq!(a.mitosis_receipt_attr, mitosis_receipt_attr);

    // Layer 2: the anchors hash to the frozen v1.0 genesis identity.
    assert_eq!(compute_genesis_hash(&a), 0x716E_A2F8);
    assert_eq!(GENESIS_HASH_LEGACY_V1_0, 0x716E_A2F8);
}

// INFORMATIONAL: the LIVE kernel derives a different anchor-child receipt than
// the frozen one, and that is expected — the genesis is frozen, the physics
// evolves. We record the current live value in-tree so the divergence stays
// discoverable and tracked rather than hidden. This asserts only determinism,
// so ongoing physics changes never make it flaky.
#[test]
fn live_mitosis_receipt_is_deterministic_and_may_differ_from_frozen() {
    use omega_v2::attractor::AttractorArray;
    use omega_v2::mitosis_proof::derive_mitosis_child;

    let parent = PhaseAgentMinimal {
        phase: 64,
        energy: 3000,
        base_freq: 7,
        state_flags: 0,
        genome: 0xCAFE_BABE,
        memory: [0xDEAD_BEEF, 1, 2],
    };
    let live1 = receipt_u32(&derive_mitosis_child(&parent, &AttractorArray::new(), 7));
    let live2 = receipt_u32(&derive_mitosis_child(&parent, &AttractorArray::new(), 7));
    assert_eq!(live1, live2, "live receipt must be deterministic");
    assert_ne!(live1, 0, "live receipt must be non-trivial");
    // As of this writing the live receipt is 0x1B18EEA0 while the frozen anchor
    // is 0xF73DB063 — see the module header for why they legitimately diverge.
}
