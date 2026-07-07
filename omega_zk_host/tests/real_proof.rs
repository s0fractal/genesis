// Real cpu STARK proof validation — the completion of the "без моків" work.
// SP1 cpu proving needs ~16 GB+ RAM and OOMs on an 8 GB box, so this is
// `#[ignore]`d — a normal `cargo test` skips it and never OOMs. On adequate
// hardware, run:
//
//   SP1_PROVER=cpu cargo test -p omega_zk_host --test real_proof -- --ignored --nocapture
//
// A green run is the proof — not the claim — that omega generates a REAL STARK
// (kind == "stark-cpu", verified) and has NOT silently regressed back to mock.
//
// Run green on a 48 GB machine on 2026-07-07 (~43 min in a debug build); the
// resulting bundle is checked in at omega_zk_host/proofs/selftest_cpu.json and
// re-verifies via `omega_zk_host --verify-only`. See omega_zk_host/README.md.

use std::process::Command;

#[test]
#[ignore = "real cpu STARK proof: needs ~16 GB+ RAM and runs for minutes; invoke with --ignored on adequate hardware"]
fn self_test_produces_a_real_verified_cpu_proof() {
    let output = Command::new(env!("CARGO_BIN_EXE_omega_zk_host"))
        .arg("--self-test")
        .env("SP1_PROVER", "cpu") // force the real prover; never mock in this test
        .output()
        .expect("failed to spawn omega_zk_host");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "zk_host exited non-zero.\nstderr:\n{stderr}"
    );

    // The bundle must report a real cpu proof that verified — and must NOT be mock.
    assert!(
        stdout.contains("\"kind\": \"stark-cpu\""),
        "expected a stark-cpu proof; bundle was:\n{stdout}"
    );
    assert!(
        stdout.contains("\"verified\": true"),
        "the proof did not verify; bundle was:\n{stdout}"
    );
    assert!(
        !stdout.contains("stark-mock"),
        "regressed to the mock prover; bundle was:\n{stdout}"
    );
}
