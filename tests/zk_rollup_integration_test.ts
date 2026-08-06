// TS producer ↔ Rust host wire test for the physics tick rollup.
//
// This file used to be wrapped in `if (import.meta.main)`, which is FALSE under
// `deno test` — so it reported "running 0 tests from ./tests/
// zk_rollup_integration_test.ts" and read exactly like a passing suite. It was
// the only thing in the tree that exercised `generateTickRollup`, and while it
// was silent the producer emitted a field named `changed_agents` where
// TickRollupJson (omega_zk_host/src/main.rs) requires `agents` — no serde alias,
// no default — so every rollup from the app died on `missing field 'agents'`.
//
// omega_zk_host/tests/wire_rollup.rs guards the same seam from the Rust side
// with its own hand-written JSON, i.e. Rust against Rust. THIS test is the
// other half: the real TS producer against the real Rust parser. Keep it that
// way — if you find yourself hardcoding the payload here, you have rebuilt
// wire_rollup.rs and lost the only thing this file checks.
import { assertEquals, assertExists } from "jsr:@std/assert";
import { ZKProverBridge } from "../src/network/zk_prover_bridge.ts";

/** Two agents and one attractor, laid out in the 32-byte agent ABI. */
function fixture(): { agents: Uint8Array; attractors: Uint8Array } {
  const activeCount = 2;
  const agents = new Uint8Array(activeCount * 32);
  const av = new DataView(agents.buffer);
  av.setUint32(0, 100, true); // phase
  av.setUint32(4, 2000, true); // energy
  av.setInt32(8, 10, true); // base_freq
  av.setUint32(12, 0, true); // state_flags
  av.setUint32(16, 0x1111_1111, true); // genome
  av.setUint32(32 + 0, 200, true);
  av.setUint32(32 + 4, 3000, true);
  av.setInt32(32 + 8, -5, true);
  av.setUint32(32 + 12, 0, true);
  av.setUint32(32 + 16, 0x2222_2222, true);

  const attractors = new Uint8Array(16 + 16);
  const tv = new DataView(attractors.buffer);
  tv.setUint32(0, 1, true); // count
  tv.setUint32(16, 0xAAAA_BBBB, true); // matrix
  tv.setUint32(20, (~0xAAAA_BBBB) >>> 0, true); // inverse — dipole law
  tv.setUint32(24, 10, true); // pulse_freq
  tv.setUint32(28, 256, true); // pulse_amp
  return { agents, attractors };
}

Deno.test({
  name: "the TS rollup payload is accepted by the Rust host (wire parity)",
  // Needs the SP1 toolchain and a cargo build; same gate the sibling zk tests use.
  ignore: Deno.env.get("CI") === "true",
  async fn() {
    // This test is about the WIRE — whether the host parses what the bridge
    // serialises — not about proving. Left unset, SP1_PROVER defaults to `cpu`
    // and the host correctly reports `stark-cpu-rollup`, so the assertion below
    // failed for whoever ran the suite without the variable already exported,
    // after spending a minute on a real STARK to learn nothing about the wire.
    // The test declares the backend it asserts on rather than inheriting it.
    Deno.env.set("SP1_PROVER", "mock");
    const { agents, attractors } = fixture();
    const bundle = await new ZKProverBridge().generateTickRollup(
      agents,
      attractors,
      2,
      7,
    );

    // A null here is the regression this file exists for: the host rejected
    // the payload (historically `missing field 'agents'`) and the bridge
    // swallowed it as a warning.
    assertExists(
      bundle,
      "host refused the TS-produced rollup — check TickRollupJson field names " +
        "in omega_zk_host/src/main.rs against the object in generateTickRollup",
    );
    assertEquals(bundle.kind, "stark-mock-rollup");
    assertEquals(bundle.verified, true);
    assertExists(bundle.publicValues);
  },
});
