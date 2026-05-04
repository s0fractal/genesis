use omega_v2::crypto::sha256_u32;
use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::{AttractorArray, AttractorMatrix};
use omega_v2::mitosis_proof::derive_mitosis_child;

fn anchor_parent() -> PhaseAgentMinimal {
    PhaseAgentMinimal {
        phase: 64,
        energy: 3000,
        base_freq: 7,
        state_flags: 0,
        genome: 0xCAFE_BABE,
        memory: [0xDEAD_BEEF, 1, 2],
    }
}

fn child_receipt_hash_u32(child: &PhaseAgentMinimal) -> u32 {
    let mut buf = [0u8; 32];
    buf[0..4].copy_from_slice(&child.phase.to_le_bytes());
    buf[4..8].copy_from_slice(&child.energy.to_le_bytes());
    buf[8..12].copy_from_slice(&child.base_freq.to_le_bytes());
    buf[12..16].copy_from_slice(&child.state_flags.to_le_bytes());
    buf[16..20].copy_from_slice(&child.genome.to_le_bytes());
    buf[20..24].copy_from_slice(&child.memory[0].to_le_bytes());
    buf[24..28].copy_from_slice(&child.memory[1].to_le_bytes());
    buf[28..32].copy_from_slice(&child.memory[2].to_le_bytes());
    sha256_u32(&buf)
}

fn main() {
    let senate_hash_empty = sha256_u32(&[0u8; 64]);
    
    let mut short = [0u8; 64];
    let msg = b"Era 1040 ZK";
    short[..msg.len()].copy_from_slice(msg);
    let senate_hash_short = sha256_u32(&short);
    
    let mut prop = [0u8; 64];
    let pmsg = b"Task 0090: Era 1040 - ZK-Notarized Mutations";
    prop[..pmsg.len()].copy_from_slice(pmsg);
    let first_proposal_hash = sha256_u32(&prop);
    
    let p = anchor_parent();
    let c1 = derive_mitosis_child(&p, &AttractorArray::new(), 7);
    let mitosis_receipt_no_attr = child_receipt_hash_u32(&c1);
    
    let mut arr = AttractorArray::new();
    let matrix: u32 = 0xABCD_0000 | p.phase;
    arr.set(0, AttractorMatrix::new(matrix, !matrix, 256, 512));
    let c2 = derive_mitosis_child(&p, &arr, 7);
    let mitosis_receipt_attr = child_receipt_hash_u32(&c2);
    
    println!("senate_hash_empty:       0x{:08X}", senate_hash_empty);
    println!("senate_hash_short:       0x{:08X}", senate_hash_short);
    println!("first_proposal_hash:     0x{:08X}", first_proposal_hash);
    println!("mitosis_receipt_no_attr: 0x{:08X}", mitosis_receipt_no_attr);
    println!("mitosis_receipt_attr:    0x{:08X}", mitosis_receipt_attr);
}
