#!/usr/bin/env -S deno run --allow-read
// omega/src/x6C00_topology_audit.ts — omega topology audit (SUBSTRATE_SELF_ABI slot 6/C)
// position: 6/C → harmony(6) × container-pair(C) = order-check of container state
// hex_dipole: "00 00 00 00 4C 26 6C 33"
//   harmony_emergence+0.85 (PRIMARY: measures dissonance; bucket 6 MATCH)
//   foundation_container+0.60 (examines container state)
//   completion_frontier+0.20 (terminal report)
// placement_policy: axis
// intent: emit omega topology audit — explicitly classify domain subdirs as intentional architecture, not drift
// maturity: active
//
// omega topology audit — slot 6/C of SUBSTRATE_SELF_ABI.v0.1
//
// Per architect 2026-05-23 + codex audit guidance: "x6C00_topology_audit.ts,
// який описує old domain dirs як intentional, не як drift". Omega's
// src/network, src/lens, src/math, etc. are NOT flat-src violations —
// they're intentional domain decomposition for a hybrid Rust+TS+ZK
// substrate.
//
// This organ projects omega's topology in substrate-self-ABI shape,
// classifying each top-level src/ subdir as one of:
//   - intentional_domain — designed namespace (network, lens, math, ontology)
//   - intentional_runtime — runtime/bootstrap (bootstrap, environment, sdk)
//   - flat_src_adapter — universal ABI organs (x2E00, x4A00, x6C00, x8E00)
//   - drift — actual unintentional placement (none currently)

import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const OMEGA_ROOT = dirname(HERE);

type SubdirClass =
  | "intentional_domain"
  | "intentional_runtime"
  | "flat_src_adapter"
  | "drift";

interface SubdirRecord {
  name: string;
  classification: SubdirClass;
  rationale: string;
}

// Explicit substrate-architectural classification. Update this list when
// omega architecture intentionally adds or retires a domain.
const KNOWN_SUBDIRS: Record<string, { class: SubdirClass; rationale: string }> =
  {
    network: {
      class: "intentional_domain",
      rationale: "P2P WebRTC mesh; networking domain",
    },
    lens: {
      class: "intentional_domain",
      rationale: "Visual/ontological lenses (museum, senate, etc)",
    },
    math: {
      class: "intentional_domain",
      rationale: "Deterministic physics math primitives",
    },
    ontology: {
      class: "intentional_domain",
      rationale: "Genesis Ontology 10 — AST evolution rules",
    },
    bootstrap: {
      class: "intentional_runtime",
      rationale: "Master routing (v2.ts); runtime entry",
    },
    environment: {
      class: "intentional_runtime",
      rationale: "Runtime environment configuration",
    },
    sdk: {
      class: "intentional_runtime",
      rationale: "Externally-callable substrate API",
    },
    shared: {
      class: "intentional_runtime",
      rationale: "Shared infrastructure (config, constants, topology_core)",
    },
    workers: {
      class: "intentional_runtime",
      rationale: "Background worker definitions",
    },
    ui: {
      class: "intentional_domain",
      rationale:
        "UI layer (currently empty — placeholder for app.html/museum.html backend)",
    },
  };

async function scanTopLevelSrc(): Promise<
  { subdirs: SubdirRecord[]; loose_files: string[] }
> {
  const srcDir = join(OMEGA_ROOT, "src");
  const subdirs: SubdirRecord[] = [];
  const loose_files: string[] = [];
  try {
    for await (const entry of Deno.readDir(srcDir)) {
      if (entry.isDirectory) {
        const known = KNOWN_SUBDIRS[entry.name];
        if (known) {
          subdirs.push({
            name: entry.name,
            classification: known.class,
            rationale: known.rationale,
          });
        } else {
          subdirs.push({
            name: entry.name,
            classification: "drift",
            rationale:
              "unknown subdir — update x6C00_topology_audit if intentional",
          });
        }
      } else if (entry.isFile) {
        loose_files.push(entry.name);
      }
    }
  } catch { /* missing */ }
  return { subdirs, loose_files };
}

function classifyLooseFile(name: string): SubdirClass {
  if (/^x[0-9A-Fa-f]{4}_/.test(name)) return "flat_src_adapter";
  if (/_projection\.myc\.md$/.test(name)) return "flat_src_adapter";
  if (name === "main.ts" || name === "env.d.ts") return "intentional_runtime";
  if (name.endsWith(".ts")) return "intentional_runtime";
  return "drift";
}

if (import.meta.main) {
  const wantJson = Deno.args.includes("--json");
  const { subdirs, loose_files } = await scanTopLevelSrc();

  const looseClassified = loose_files.map((f) => ({
    name: f,
    classification: classifyLooseFile(f),
  }));

  const allItems = [
    ...subdirs.map((s) => ({ ...s, kind: "subdir" as const })),
    ...looseClassified.map((f) => ({
      name: f.name,
      classification: f.classification,
      rationale: `loose file: ${f.classification}`,
      kind: "file" as const,
    })),
  ];

  const byClass = new Map<SubdirClass, number>();
  for (const i of allItems) {
    byClass.set(i.classification, (byClass.get(i.classification) ?? 0) + 1);
  }

  const driftCount = byClass.get("drift") ?? 0;
  const overall = driftCount === 0 ? "healthy" : "degraded";

  const receipt = {
    type: "audit",
    position: "6/C",
    action: "audit",
    substrate: "omega",
    note:
      "harmony × container-pair — topology audit explicitly classifies omega's src/ subdirs as INTENTIONAL architecture vs drift. Domain dirs (network, lens, math, ontology) are designed namespaces, NOT flat-src violations.",
    summary: {
      overall,
      total_items: allItems.length,
      drift_count: driftCount,
      by_classification: Object.fromEntries(byClass),
    },
    items: allItems,
    design_note:
      "Omega is hybrid Rust+TS+ZK substrate. Universal flat-src convention (xNNNN_handle.ts everything-in-src/-root) would erase the domain decomposition that makes omega navigable. Per architect 2026-05-23: 'omega adapter замість omega rewrite'.",
    synonyms: ["audit", "topology", "drift-check"],
  };

  if (wantJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(`# audit @ 6/C — omega topology classification`);
    console.log(`# ${"─".repeat(70)}`);
    console.log(`# overall:     ${overall}`);
    console.log(`# total items: ${allItems.length}`);
    console.log(`# drift:       ${driftCount}`);
    console.log(`# ${"─".repeat(70)}`);
    for (const i of allItems) {
      const tag = i.classification.padEnd(20);
      console.log(`#   [${tag}] ${i.name}`);
    }
  }
}
