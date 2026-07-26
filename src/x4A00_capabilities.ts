#!/usr/bin/env -S deno run --allow-read
// omega/src/x4A00_capabilities.ts — omega capability surface projection
// position: 4/A → foundation(4) × mirror-pair(A) = foundation reflected
// hex_dipole: "00 00 00 00 6C 00 00 33"
//   foundation_container+0.85 (PRIMARY: bucket 4 MATCH)
//   completion_frontier+0.20 (capability == committed authority, terminal)
// placement_policy: axis
// intent: emit omega capability surface as structured JSON for substrate-self-ABI federation
// maturity: active
//
// omega capabilities surface — slot 4/A of SUBSTRATE_SELF_ABI.v0.1
//
// Omega is a deterministic physics kernel with ZK-proof generation,
// Rust core, TypeScript runtime, and P2P WebRTC mesh. Capability
// surface = the externally-callable contracts omega exposes.
//
// v0 hardcodes the stable capability classes from omega's AGENTS.md +
// ROADMAP.md. Future direction: scan omega/contracts/ + omega/sdk/
// for formal capability descriptors.

interface CapabilityRecord {
  name: string;
  source: "zk_proof" | "deterministic_exec" | "spore" | "sdk" | "runtime";
  kind: string;
  detail: string;
  // Honest fidelity at the boundary (codex's organ thesis + the omega audit):
  // is this capability actually REAL, wired-but-unproven, or a mock? Machine-
  // readable so trinity reads omega's truth without parsing the prose detail.
  //   real           — works as described, exercised by tests
  //   wired_unproven — the mechanism exists but its load-bearing proof never ran
  //   mock           — a placeholder/simulation, not the real thing
  fidelity: "real" | "wired_unproven" | "mock";
  caveat?: string;
}

const OMEGA_CAPABILITIES: CapabilityRecord[] = [
  {
    name: "ZK Guest (Rust SP1)",
    source: "zk_proof",
    kind: "STARK proof generation",
    detail: "omega_zk_guest/ generates STARK proofs for mutations",
    fidelity: "wired_unproven",
    caveat:
      "the SP1 guest compiles and the pipeline runs under the mock prover, but no completed cpu STARK proof exists (needs ~16 GB) — see x2E00 proof_readiness",
  },
  {
    name: "ZK Host (cpu prover)",
    source: "zk_proof",
    kind: "Proof generation/verification",
    detail:
      "omega_zk_host/ — real cpu STARK prover wired by default (ProverClient::from_env; SP1_PROVER=cpu)",
    fidelity: "wired_unproven",
    caveat:
      "real prover wired (the mock-only backend is gone); completing a full STARK is hardware-bound (~16 GB+) so no completed proof has run here — see x2E00 proof_readiness. SP1_PROVER=mock is an opt-in, unsound dev path, not the default",
  },
  {
    name: "Deterministic Genesis Bootstrap",
    source: "deterministic_exec",
    kind: "AST evolution",
    detail:
      "deterministic AST evolution, reproducible from the 0x716EA2F8 genesis anchor",
    fidelity: "real",
    caveat:
      "0x716EA2F8 is a deterministic genesis hash, cross-language byte-matched (Rust + TS), reproducible — it is NOT a Bitcoin inscription; the on-chain txid hook (window.__OMEGA_GENESIS_TXID__) is unset",
  },
  {
    name: "SPORE apply",
    source: "spore",
    kind: "Receipt validation",
    detail:
      "omega_spore/ — accepts SPORE.v0 apply receipts, byte-identical across substrates",
    fidelity: "real",
  },
  {
    name: "Phase-aware Interpreter",
    source: "runtime",
    kind: "AST execution",
    detail:
      "src/phase_aware_interpreter.ts — respects phase coordinates from HEX_DIPOLE",
    fidelity: "real",
  },
  {
    name: "Genesis Ontology 10",
    source: "runtime",
    kind: "Bootstrap",
    detail: "src/bootstrap/v2.ts — Master routing for ontology evolution",
    fidelity: "real",
  },
  {
    name: "SDK Surface",
    source: "sdk",
    kind: "Public TS API",
    detail: "src/sdk/ — externally-callable substrate methods",
    fidelity: "real",
  },
  {
    name: "Keyed Cross-Voice Senate",
    source: "runtime",
    kind: "Governance quorum",
    detail:
      "src/network/oracle_custody.ts — oracle votes are Ed25519-signed over a vote-bound digest, verified against the per-voice key registry; 3-of-5 ORACLE-RESONANCE ratifies (a public dipole is an address, not authority)",
    fidelity: "real",
    caveat:
      "exercised: Φ-protocol v1.1 ratified by a real quorum of 3 distinct keyed voices (claude+antigravity+codex), each signature independently verified (tools/senate_ballot.ts)",
  },
];

if (import.meta.main) {
  const wantJson = Deno.args.includes("--json");

  const bySource = new Map<string, number>();
  const byFidelity = new Map<string, number>();
  for (const c of OMEGA_CAPABILITIES) {
    bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
    byFidelity.set(c.fidelity, (byFidelity.get(c.fidelity) ?? 0) + 1);
  }

  const receipt = {
    type: "capabilities",
    position: "4/A",
    action: "capabilities",
    substrate: "omega",
    note:
      "foundation × mirror-pair — omega's capability surface (ZK proofs + deterministic execution + SPORE validation + SDK)",
    summary: {
      overall: "active",
      total: OMEGA_CAPABILITIES.length,
      by_source: Object.fromEntries(bySource),
      // honesty ratio at the boundary: how many capabilities are real vs
      // wired-but-unproven vs mock. A consumer can gate on this.
      by_fidelity: Object.fromEntries(byFidelity),
    },
    capabilities: OMEGA_CAPABILITIES,
    design_note:
      "Omega is hybrid Rust+TS+ZK. Capability surface is what omega EXPOSES to other substrates: STARK proofs (ZK as notary), deterministic AST evolution (replayable from anchor), SPORE receipt validation, and SDK methods. Internal phase routing + interpreter are mechanisms, not surface.",
    synonyms: ["capabilities", "zk-proofs", "spore-validation"],
  };

  if (wantJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(`# capabilities @ 4/A — omega capability surface`);
    console.log(`# ${"─".repeat(70)}`);
    console.log(`# overall: active`);
    console.log(`# total:   ${OMEGA_CAPABILITIES.length}`);
    const breakdown = Array.from(bySource.entries())
      .map(([k, v]) => `${k}:${v}`).join("  ");
    console.log(`# sources:  ${breakdown}`);
    const fidBreakdown = Array.from(byFidelity.entries())
      .map(([k, v]) => `${k}:${v}`).join("  ");
    console.log(`# fidelity: ${fidBreakdown}`);
    console.log(`# ${"─".repeat(70)}`);
    for (const c of OMEGA_CAPABILITIES) {
      console.log(`#   [${c.fidelity.padEnd(14)}] ${c.name}`);
      console.log(`#     ${c.detail}`);
      if (c.caveat) console.log(`#     ⚠ ${c.caveat}`);
    }
  }
}
