// Era 1090: cross-language anchor for the WarrantProposal hash.
use omega_v2::warrant_issuance::WarrantProposal;
use omega_v2::codeicide_law::ACTION_TERMINATE;

#[test]
fn anchor_proposal_hash_cafebabe_terminate_reason() {
    // Same inputs as tests/warrant_issuance_test.ts.
    let p = WarrantProposal::new(0xCAFE_BABE, ACTION_TERMINATE, 3, b"reason", 0);
    let phash = p.proposal_hash;
    eprintln!("rust proposal_hash = 0x{:08x}", phash);
    assert_eq!(phash, 0x0B09_9CF9);
}
