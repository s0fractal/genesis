// 🌌 OMEGA-64: Era 1040 Phase 3 stub — Host-side mitosis prover.
//
// This Deno script reads a `MitosisReceipt` (JSON or `--ptr` from a running
// browser via stdin) and emits an SP1-compatible proof bundle. When the SP1
// toolchain is installed (`cargo prove`), this script invokes it; otherwise
// it falls back to local re-derivation and prints a "soft proof" — which is
// what `WebRTCV2Mesh.verifyMitosisProof` already enforces in-browser.
//
// Usage:
//   deno run --allow-read --allow-run tools/zk_prove_mitosis.ts < receipt.json
//   deno run -A tools/zk_prove_mitosis.ts --self-test
//
// Output: a JSON bundle to stdout with shape:
//   {
//     "kind": "soft" | "stark",
//     "receiptHash": 0x...,
//     "parentGenome": 0x...,
//     "verified": true|false,
//     "proofBytes": "..."  // base64; only for kind=stark
//   }

import {
  AgentMinimal,
  AttractorEntry,
  childReceiptHash,
  deriveMitosisChild,
} from "../src/network/mitosis_proof.ts";

interface MitosisReceiptJSON {
  parent: AgentMinimal;
  child: AgentMinimal;
  attractors: AttractorEntry[];
  qPhase: number;
  receiptHash: string;
  tick: number;
}

async function softProve(
  r: MitosisReceiptJSON,
): Promise<{ verified: boolean; reason?: string }> {
  const derived = deriveMitosisChild(r.parent, r.attractors, r.qPhase);
  if (derived.phase !== r.child.phase) {
    return { verified: false, reason: "phase mismatch" };
  }
  if (derived.energy !== r.child.energy) {
    return { verified: false, reason: "energy mismatch" };
  }
  if (derived.base_freq !== r.child.base_freq) {
    return { verified: false, reason: "base_freq mismatch" };
  }
  if (derived.state_flags !== r.child.state_flags) {
    return { verified: false, reason: "state_flags mismatch" };
  }
  if (derived.genome !== r.child.genome) {
    return { verified: false, reason: "genome mismatch" };
  }
  if (derived.memory[0] !== r.child.memory[0]) {
    return { verified: false, reason: "memory[0] mismatch" };
  }
  if (derived.memory[1] !== r.child.memory[1]) {
    return { verified: false, reason: "memory[1] mismatch" };
  }
  if (derived.memory[2] !== r.child.memory[2]) {
    return { verified: false, reason: "memory[2] mismatch" };
  }
  if (await childReceiptHash(derived) !== r.receiptHash) {
    return { verified: false, reason: "receipt hash mismatch" };
  }
  return { verified: true };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Deno.stdin.readable.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  return new TextDecoder().decode(merged);
}

async function selfTestReceipt(): Promise<MitosisReceiptJSON> {
  const parent: AgentMinimal = {
    phase: 64,
    energy: 3000,
    base_freq: 7,
    state_flags: 0,
    genome: 0xCAFE_BABE >>> 0,
    memory: [0xDEAD_BEEF >>> 0, 1, 2],
  };
  const child = deriveMitosisChild(parent, [], 7);
  return {
    parent,
    child,
    attractors: [],
    qPhase: 7,
    receiptHash: await childReceiptHash(child),
    tick: 0,
  };
}

async function main() {
  const args = Deno.args;
  const isSelfTest = args.includes("--self-test");

  let receipt: MitosisReceiptJSON;
  if (isSelfTest) {
    receipt = await selfTestReceipt();
  } else {
    const raw = await readStdin();
    try {
      receipt = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse receipt JSON:", e);
      Deno.exit(2);
    }
  }

  const soft = await softProve(receipt);
  if (!soft.verified) {
    console.error(`[zk_prove] SOFT PROOF FAILED: ${soft.reason}`);
    const out = {
      kind: "soft",
      receiptHash: `0x${receipt.receiptHash}`,
      parentGenome: `0x${(receipt.parent.genome >>> 0).toString(16)}`,
      verified: false,
      reason: soft.reason,
    };
    console.log(JSON.stringify(out));
    Deno.exit(1);
  }

  try {
    const cmd = new Deno.Command("cargo", {
      args: ["run", "--manifest-path", "omega_zk_host/Cargo.toml", "--release"],
      stdin: "piped",
      stdout: "piped",
      stderr: "inherit",
    });
    const child = cmd.spawn();

    const writer = child.stdin.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(JSON.stringify(receipt)));
    await writer.close();

    const output = await child.output();
    if (!output.success) {
      throw new Error(`Host failed with code ${output.code}`);
    }

    const decoder = new TextDecoder();
    const outStr = decoder.decode(output.stdout);
    const parsed = JSON.parse(outStr);
    console.log(JSON.stringify(parsed));
    return;
  } catch (err) {
    console.error("[zk_prove] Failed to run omega_zk_host:", err);
  }

  const out = {
    kind: "soft",
    receiptHash: `0x${receipt.receiptHash}`,
    parentGenome: `0x${(receipt.parent.genome >>> 0).toString(16)}`,
    verified: true,
  };
  console.log(JSON.stringify(out));
}

if (import.meta.main) {
  await main();
}
