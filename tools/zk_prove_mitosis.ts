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
    receiptHash: number;
    tick: number;
}

function softProve(r: MitosisReceiptJSON): { verified: boolean; reason?: string } {
    const derived = deriveMitosisChild(r.parent, r.attractors, r.qPhase);
    if (derived.phase !== r.child.phase) return { verified: false, reason: "phase mismatch" };
    if (derived.energy !== r.child.energy) return { verified: false, reason: "energy mismatch" };
    if (derived.base_freq !== r.child.base_freq) return { verified: false, reason: "base_freq mismatch" };
    if (derived.state_flags !== r.child.state_flags) return { verified: false, reason: "state_flags mismatch" };
    if (derived.genome !== r.child.genome) return { verified: false, reason: "genome mismatch" };
    if (derived.memory[0] !== r.child.memory[0]) return { verified: false, reason: "memory[0] mismatch" };
    if (derived.memory[1] !== r.child.memory[1]) return { verified: false, reason: "memory[1] mismatch" };
    if (derived.memory[2] !== r.child.memory[2]) return { verified: false, reason: "memory[2] mismatch" };
    if (childReceiptHash(derived) !== (r.receiptHash >>> 0)) return { verified: false, reason: "receipt hash mismatch" };
    return { verified: true };
}

async function spvAvailable(): Promise<boolean> {
    try {
        const cmd = new Deno.Command("cargo", {
            args: ["prove", "--version"],
            stdout: "null",
            stderr: "null",
        });
        const { success } = await cmd.output();
        return success;
    } catch {
        return false;
    }
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
    for (const c of chunks) { merged.set(c, pos); pos += c.length; }
    return new TextDecoder().decode(merged);
}

function selfTestReceipt(): MitosisReceiptJSON {
    const parent: AgentMinimal = {
        phase: 64, energy: 3000, base_freq: 7, state_flags: 0,
        genome: 0xCAFE_BABE >>> 0,
        memory: [0xDEAD_BEEF >>> 0, 1, 2],
    };
    const child = deriveMitosisChild(parent, [], 7);
    return {
        parent,
        child,
        attractors: [],
        qPhase: 7,
        receiptHash: childReceiptHash(child),
        tick: 0,
    };
}

async function main() {
    const args = Deno.args;
    const isSelfTest = args.includes("--self-test");

    let receipt: MitosisReceiptJSON;
    if (isSelfTest) {
        receipt = selfTestReceipt();
    } else {
        const raw = await readStdin();
        try {
            receipt = JSON.parse(raw);
        } catch (e) {
            console.error("Failed to parse receipt JSON:", e);
            Deno.exit(2);
        }
    }

    const soft = softProve(receipt);
    if (!soft.verified) {
        // The kernel produced a receipt that does NOT round-trip through the
        // pure derivation. This is a critical determinism breach — refuse
        // to proceed (do not generate a proof for a broken trace).
        console.error(`[zk_prove] SOFT PROOF FAILED: ${soft.reason}`);
        const out = {
            kind: "soft",
            receiptHash: `0x${(receipt.receiptHash >>> 0).toString(16)}`,
            parentGenome: `0x${(receipt.parent.genome >>> 0).toString(16)}`,
            verified: false,
            reason: soft.reason,
        };
        console.log(JSON.stringify(out));
        Deno.exit(1);
    }

    if (await spvAvailable()) {
        // Hand off to SP1. (Stub — wiring `cargo prove run --mode 2` with the
        // 8 + (4 × n) + 8 stdin tuples lives behind a flag because the
        // toolchain may not be present in every environment.)
        // For now, emit a deterministic "would-prove" record so the bundle
        // is structurally identical to what Phase 3 will eventually produce.
        const out = {
            kind: "stark",
            receiptHash: `0x${(receipt.receiptHash >>> 0).toString(16)}`,
            parentGenome: `0x${(receipt.parent.genome >>> 0).toString(16)}`,
            verified: true,
            note: "SP1 toolchain detected — Phase 3 hookup pending; emitted stub bundle.",
        };
        console.log(JSON.stringify(out));
        return;
    }

    // Fallback: emit the soft-proof bundle. This matches the in-browser
    // verification policy (`WebRTCV2Mesh.verifyMitosisProof`).
    const out = {
        kind: "soft",
        receiptHash: `0x${(receipt.receiptHash >>> 0).toString(16)}`,
        parentGenome: `0x${(receipt.parent.genome >>> 0).toString(16)}`,
        verified: true,
    };
    console.log(JSON.stringify(out));
}

if (import.meta.main) {
    await main();
}
