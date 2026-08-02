#!/usr/bin/env -S deno run --allow-read
// omega/src/x2E00_status.ts — omega native status / self-reflection
// position: 2/E → mirror(2) × harmony-pair(E) = state-aware self-reflection
// hex_dipole: "00 00 6C 40 33 26 4C 33"
// placement_policy: axis
// migrated 2026-05-23 from omega/0x2/E.ts as part of SUBSTRATE_SELF_ABI.v0.1
// adoption (slot 2/E). Adapter organ — coexists with omega's domain
// subdirectories (src/network, src/lens, src/math, etc.) which are
// intentional architecture, not drift.

import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { computeLawHash, lawHashHex } from "./shared/law_hash.ts";
import { wrap } from "./shared/envelope.ts";
// CborValue is re-declared (not re-exported) by envelope.ts; import it from the
// canonical source so this organ type-checks under `deno check` (the fast lane).
import type { CborValue } from "./shared/canonical_cbor.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const OMEGA_ROOT = dirname(HERE);

async function checkFile(path: string): Promise<boolean> {
  try {
    await Deno.stat(join(OMEGA_ROOT, path));
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  // Check omega core components
  const components = [
    "Cargo.toml",
    "omega_v2/Cargo.toml",
    "omega_spore/Cargo.toml",
    "omega_zk_host/Cargo.toml",
  ];

  let ok = 0;
  for (const c of components) {
    if (await checkFile(c)) ok++;
  }

  const overall = ok === components.length ? "healthy" : "degraded";

  // The physical-law version anchor (mirrors omega_v2 calculate_law_hash over
  // the canonical topology). Surfaced so trinity status / the Substrate Court
  // can compare that substrates run the same law without an FFI round-trip.
  const law_hash = lawHashHex(await computeLawHash());

  const substrate_health = {
    type: "SubstrateHealth",
    schema: "trinity.substrate-health.v0.1",
    substrate: "omega",
    overall,
    law_hash,
    own_components: {
      ok,
      fail: components.length - ok,
      total: components.length,
    },
  };

  // Proof readiness — the third leg of the boundary projection (codex's organ
  // thesis + the omega audit): make ZK / golden-trace proof DEBT visible AT the
  // boundary instead of buried in the core, so trinity can read omega's proof
  // state without an FFI round-trip into omega internals. Honest by construction.
  const zk_guest_present = await checkFile("omega_zk_guest/Cargo.toml");
  const zk_host_present = await checkFile("omega_zk_host/Cargo.toml");
  // The PROGRAM OF RECORD, checked in since 2026-08-02. An SP1 proof is about one
  // program and its verifying key comes from these bytes, so a proof travels with
  // them: `cargo prove build` is byte-reproducible within a platform and not
  // across one (macOS 167,120 B vs the ubuntu runner's 167,040 B, different vkey).
  const zk_guest_elf_committed = await checkFile(
    "omega_zk_guest/elf/omega_zk_guest",
  );
  // A local rebuild artifact under target/ — present only where the guest has
  // been compiled, and NOT the program anything verifies against. Kept separate
  // so "I built it here" is never read as "this is the program of record".
  const zk_guest_elf_built_locally = await checkFile(
    "target/elf-compilation/riscv64im-succinct-zkvm-elf/release/omega_zk_guest",
  );
  // Counted, not asserted: the claim below must be a fact about the tree.
  const zk_checked_in_proofs = (await Promise.all(
    ["selftest_cpu", "arbitrary_cpu", "rollup_cpu"].map((n) =>
      checkFile(`omega_zk_host/proofs/${n}.json`)
    ),
  )).filter(Boolean).length;
  const golden_trace_test_present = await checkFile(
    "tests/wgsl_golden_trace_test.ts",
  );
  const proof_readiness = {
    type: "ProofReadiness",
    zk_guest_present,
    zk_host_present,
    zk_guest_elf_committed,
    zk_guest_elf_built_locally,
    zk_checked_in_proofs,
    // Completed cpu STARK proofs exist and are checked in. This said `false` from
    // 2026-07-07 (when the proofs landed) to 2026-08-02, because the field was a
    // hardcoded constant and its own instruction — "flip it deliberately, in the
    // same change that lands the proof" — was not followed. An honesty gate that
    // pins a constant outlives the fact it encodes; this one is now derived from
    // the tree, so it cannot claim proofs that are not there or deny ones that are.
    zk_cpu_proof_executed: zk_checked_in_proofs > 0,
    // Two provers, two purposes — one value could only mislead. Host unit tests
    // run under `mock` (fast, NOT sound); the checked-in bundles are re-verified
    // under the real `cpu` prover, which is the part that would catch a forged or
    // stale proof.
    zk_ci_host_tests_prover: "mock",
    zk_ci_verifies_checked_in_proofs: "cpu",
    golden_trace_test_present,
    note:
      `ZK is wired and ${zk_checked_in_proofs} completed cpu STARK proof(s) are ` +
      "checked in under omega_zk_host/proofs/, each re-verified against the " +
      "committed guest ELF by the zk_host CI job on every push (real cpu prover, " +
      "not mock). What remains honestly undone: GPU/network proving is " +
      "hardware-bound, and `real_proof.rs` — which generates a fresh proof rather " +
      "than checking an existing one — stays #[ignore]d as a ~16 GB ritual.",
  };

  const receipt: Record<string, unknown> = {
    type: "status",
    position: "2/E",
    action: "status",
    substrate: "omega",
    note: "OMEGA operational status",
    law_hash,
    summary: {
      overall,
      health: {
        overall,
        ok,
        fail: components.length - ok,
        total: components.length,
      },
    },
    substrate_health,
    proof_readiness,
  };

  // --envelope: omega signs its OWN substrate_health as a ReceiptEnvelope
  // (substrate_tag: omega), carrying its native law_hash. This is the second
  // INDEPENDENT witness the Substrate Court needs — omega computes the law and
  // wraps it itself, no trinity in the loop. See RECEIPT_ENVELOPE.v1.0.
  if (Deno.args.includes("--envelope")) {
    receipt.substrate_health_envelope = await wrap(
      substrate_health as unknown as CborValue,
      "substrate_health",
      "omega",
      { law_hash, created_at_logical: {} },
    );
  }

  console.log(JSON.stringify(receipt, null, 2));
}
