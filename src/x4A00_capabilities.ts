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
}

const OMEGA_CAPABILITIES: CapabilityRecord[] = [
  {
    name: "ZK Guest (Rust SP1)",
    source: "zk_proof",
    kind: "STARK proof generation",
    detail: "omega_zk_guest/ generates STARK proofs for mutations",
  },
  {
    name: "ZK Host (mock backend)",
    source: "zk_proof",
    kind: "Proof verification",
    detail: "omega_zk_host/ — mock-only currently per AGENTS.md",
  },
  {
    name: "Deterministic Genesis Bootstrap",
    source: "deterministic_exec",
    kind: "AST evolution",
    detail: "Bitcoin block 0x549A6307 inscribed; reproducible from anchor",
  },
  {
    name: "SPORE apply",
    source: "spore",
    kind: "Receipt validation",
    detail:
      "omega_spore/ — accepts SPORE.v0 apply receipts, byte-identical across substrates",
  },
  {
    name: "Phase-aware Interpreter",
    source: "runtime",
    kind: "AST execution",
    detail:
      "src/phase_aware_interpreter.ts — respects phase coordinates from HEX_DIPOLE",
  },
  {
    name: "Genesis Ontology 10",
    source: "runtime",
    kind: "Bootstrap",
    detail: "src/bootstrap/v2.ts — Master routing for ontology evolution",
  },
  {
    name: "SDK Surface",
    source: "sdk",
    kind: "Public TS API",
    detail: "src/sdk/ — externally-callable substrate methods",
  },
];

if (import.meta.main) {
  const wantJson = Deno.args.includes("--json");

  const bySource = new Map<string, number>();
  for (const c of OMEGA_CAPABILITIES) {
    bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
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
    console.log(`# sources: ${breakdown}`);
    console.log(`# ${"─".repeat(70)}`);
    for (const c of OMEGA_CAPABILITIES) {
      console.log(`#   [${c.source.padEnd(18)}] ${c.name}`);
      console.log(`#     ${c.detail}`);
    }
  }
}
