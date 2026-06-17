// Era 1040 Phase 2: end-to-end test that a real darwinian_mitosis tick
// captures a parent snapshot whose child can be re-derived bit-for-bit
// from the global MitosisLog.
//
// We drive the world exclusively through the public FFI surface so the
// test exercises the same code path JS uses.

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::mitosis_log::{MitosisLog, MitosisReceipt, MITOSIS_LOG_CAPACITY};
use omega_v2::mitosis_proof::{child_receipt_hash, derive_mitosis_child};

// FFI declarations matching omega_v2/src/lib.rs.
extern "C" {
    fn v2_boot_engine();
    fn v2_ignite_big_bang(seed: u32, agent_count: u32);
    fn v2_mitosis_sweep() -> u32;
    fn v2_mitosis_log_ptr() -> *const u8;
    fn v2_mitosis_log_total() -> u32;
    fn v2_mitosis_log_capacity() -> u32;
    fn v2_mitosis_log_clear();
    fn v2_agents_ptr() -> *const u8;
}

#[test]
fn ffi_capacity_matches_const() {
    unsafe {
        assert_eq!(v2_mitosis_log_capacity(), MITOSIS_LOG_CAPACITY as u32);
    }
}

#[test]
fn darwinian_mitosis_records_verifiable_receipt() {
    unsafe {
        v2_boot_engine();
        v2_mitosis_log_clear();

        // Big bang seeds 1024 random agents (energy in 100..1000).
        v2_ignite_big_bang(0xCAFE_BABE, 1024);

        // Force a handful of thriving cells above MITOSIS_THRESHOLD AND
        // create dead slots for them to populate.
        let agents_ptr = v2_agents_ptr() as *mut PhaseAgentMinimal;
        for i in 0..8 {
            (*agents_ptr.add(i)).energy = 3500;
        }
        // Empty the back half of the population to give the sweep dead slots.
        for i in 512..1024 {
            (*agents_ptr.add(i)).energy = 0;
        }

        let total_before = v2_mitosis_log_total();
        let replications = v2_mitosis_sweep();
        let total_after = v2_mitosis_log_total();

        // Some replications should have occurred at this population.
        assert!(replications > 0, "expected at least one mitosis event");
        assert_eq!(
            total_after - total_before,
            replications,
            "log entries must equal reported replications"
        );

        // Read the log via FFI pointer (zero-copy, just like JS).
        let log_ptr = v2_mitosis_log_ptr() as *const MitosisLog;
        let log = &*log_ptr;
        assert_eq!(log.total_written, total_after);

        // Verify EVERY receipt: re-derive from snapshot, compare to logged child,
        // and check the receipt hash. This is the cryptographic invariant a
        // peer node enforces when it receives a DIPOLE plasmid.
        let mut idx = if log.total_written > MITOSIS_LOG_CAPACITY as u32 {
            log.total_written - MITOSIS_LOG_CAPACITY as u32
        } else {
            0
        };
        let mut verified = 0;
        while idx < log.total_written {
            let r: MitosisReceipt = log.get(idx).expect("entry within window");
            let rederived = derive_mitosis_child(&r.parent, &r.attractors, r.q_phase);
            assert_eq!(
                rederived.phase, r.child.phase,
                "phase mismatch at idx {}",
                idx
            );
            assert_eq!(
                rederived.genome, r.child.genome,
                "genome mismatch at idx {}",
                idx
            );
            assert_eq!(
                rederived.energy, r.child.energy,
                "energy mismatch at idx {}",
                idx
            );
            assert_eq!(
                r.receipt_hash,
                child_receipt_hash(&r.child),
                "receipt hash mismatch at idx {}",
                idx
            );
            verified += 1;
            idx += 1;
        }
        assert_eq!(verified, replications.min(MITOSIS_LOG_CAPACITY as u32));

        // Ensure the agent buffer pointer is alive (sanity check on FFI).
        let agents_ptr = v2_agents_ptr();
        assert!(!agents_ptr.is_null());

        // Cleanup so subsequent tests see a clean log.
        v2_mitosis_log_clear();
    }
}
