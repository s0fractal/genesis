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

  const receipt = {
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
  };

  console.log(JSON.stringify(receipt, null, 2));
}
