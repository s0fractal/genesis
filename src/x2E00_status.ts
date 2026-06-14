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
