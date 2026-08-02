// Wire-format regression test for the Mode 3 rollup path.
//
// History: `run_rollup` wrote the mode selector as u32 (4 bytes) while the
// guest reads u8 (1 byte), desynchronising the whole stdin stream by 3
// bytes. The `--rollup-test` path wrote u8 correctly, so checked-in proofs
// kept passing while the production `--rollup` path was broken. This test
// exercises the production path end-to-end under the fast (unsound) mock
// prover, so a desync fails CI in seconds instead of lurking.
//
// Run: cargo test -p omega_zk_host --test wire_rollup

use std::io::Write;
use std::process::{Command, Stdio};

const ROLLUP_JSON: &str = r#"{
  "q_phase": 7,
  "q_sectors": 1,
  "q_radial": 1,
  "q_math": 0,
  "weather_multiplier": 1024,
  "active_count": 2,
  "agents": [
    {"phase": 10,  "energy": 1000, "base_freq": 5, "state_flags": 0, "genome": 2864434394, "memory": [0,0,0]},
    {"phase": 200, "energy": 1000, "base_freq": 3, "state_flags": 0, "genome": 2864434394, "memory": [0,0,0]}
  ],
  "attractors": []
}"#;

#[test]
fn rollup_stdin_wire_format_roundtrips() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_omega_zk_host"))
        .arg("--rollup")
        .env("SP1_PROVER", "mock") // fast, unsound — wire format is what we test
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn omega_zk_host");

    child
        .stdin
        .as_mut()
        .expect("stdin pipe missing")
        .write_all(ROLLUP_JSON.as_bytes())
        .expect("failed to write rollup JSON");

    let output = child.wait_with_output().expect("failed to wait on zk_host");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(
        output.status.success(),
        "--rollup exited non-zero (wire desync?).\nstderr:\n{stderr}"
    );
    assert!(
        stdout.contains("\"kind\": \"stark-mock-rollup\""),
        "unexpected bundle kind; bundle was:\n{stdout}"
    );
    assert!(
        stdout.contains("\"verified\": true"),
        "rollup proof did not verify locally; bundle was:\n{stdout}"
    );
    // alpha omitted in the JSON → serde default must inject the canonical 64.
    assert!(
        stdout.contains("alpha=64"),
        "canonical alpha default not applied; bundle was:\n{stdout}"
    );
}
