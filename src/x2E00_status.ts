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
import { type CborValue, wrap } from "./shared/envelope.ts";

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
  // Local build artifact (gitignored): present when the guest has been compiled
  // here, absent in a fresh checkout / CI. Informative, environment-dependent —
  // the load-bearing honesty is zk_cpu_proof_executed below.
  const zk_guest_elf_built = await checkFile(
    "target/elf-compilation/riscv64im-succinct-zkvm-elf/release/omega_zk_guest",
  );
  const golden_trace_test_present = await checkFile(
    "tests/wgsl_golden_trace_test.ts",
  );
  const proof_readiness = {
    type: "ProofReadiness",
    zk_guest_present,
    zk_host_present,
    zk_guest_elf_built,
    // honest, static: no completed cpu STARK proof exists. The validating test is
    // #[ignore]d (needs ~16 GB) and CI runs the fast mock prover.
    zk_cpu_proof_executed: false,
    zk_ci_prover: "mock",
    golden_trace_test_present,
    note:
      "ZK is wired (real SP1 guest + host crate deps) but NO completed cpu STARK " +
      "proof exists — the validating test is #[ignore]d (needs ~16 GB) and CI runs " +
      "SP1_PROVER=mock (fast, NOT cryptographically sound). This field keeps that " +
      "proof debt visible at the boundary rather than hiding it.",
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
