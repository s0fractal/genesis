// anchor_pipeline.ts — sovereign-witness anchoring (model B, Layer 2). PURE +
// offline-safe. The dry-run pipeline codex asked for:
//   chord hashes → Merkle root → quorum-approval digest → anchor-shaped tx.
//
// SECURITY (codex's guards, as executable invariants):
//  - `buildAnchorTx` takes NO recipient parameter. It can produce exactly one
//    shape: `OP_RETURN <OMEGA1:root>` + change back to the wallet's OWN address.
//    Paying anyone else is **unrepresentable**, not merely forbidden.
//  - `assertAnchorShape` is defense-in-depth: it re-derives the shape from a
//    built tx and throws if any non-OP_RETURN output pays a foreign script, if
//    there is not exactly one OMEGA1 OP_RETURN, or if the fee exceeds the cap.
//  - `verifyAnchorQuorum` requires ≥3 DISTINCT keyed voices to have signed the
//    root (same Ed25519 registry as the Senate) before an anchor is eligible.
//  - NO broadcast lives here. Emission is the architect-reserved CLI step.
//
// This module never reads a private key. Signing takes an explicit key the
// caller is entitled to use (the emitter reads ~/.trinity/wallets itself).

import { sha256 } from "npm:@noble/hashes@1.4.0/sha256";
import { hex } from "npm:@scure/base@1.1.6";
import * as btc from "npm:@scure/btc-signer@1.3.2";
import { ORACLE_PUBKEYS } from "./oracle_custody.ts";

export const ANCHOR_DIGEST_V1 = "omega-anchor:v1";
export const OP_RETURN_PREFIX = "OMEGA1:"; // matches verifyGenesisInscription

// ── Merkle root ─────────────────────────────────────────────────────────────

/** Merkle root over 32-byte leaves: `sha256(left || right)`, last leaf
 *  duplicated on an odd level. Deterministic; order-preserving. */
export function merkleRoot(leaves: Uint8Array[]): Uint8Array {
  if (leaves.length === 0) throw new Error("merkleRoot: no leaves");
  let level = leaves.map((l) => {
    if (l.length !== 32) throw new Error("merkleRoot: each leaf must be 32 bytes");
    return l;
  });
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? level[i]; // duplicate last if odd
      next.push(sha256(new Uint8Array([...a, ...b])));
    }
    level = next;
  }
  return level[0];
}

/** Parse a chord content hash (`sha256:<64hex>` or bare `<64hex>`) to a leaf. */
export function leafFromHash(h: string): Uint8Array {
  const raw = h.startsWith("sha256:") ? h.slice("sha256:".length) : h;
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`leafFromHash: expected 64 hex chars, got ${h}`);
  }
  return hex.decode(raw.toLowerCase());
}

// ── quorum approval (same Ed25519 registry as the Senate) ───────────────────

/** The string the Senate signs to approve anchoring this Merkle root. Binds the
 *  approval to THIS exact root — a signature can't be replayed onto another. */
export function anchorApprovalDigest(root: Uint8Array): string {
  if (root.length !== 32) throw new Error("root must be 32 bytes");
  return `${ANCHOR_DIGEST_V1}:0x${hex.encode(root)}`;
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}

export async function signAnchorApproval(
  root: Uint8Array,
  privateKeyPkcs8B64: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    unb64(privateKeyPkcs8B64),
    "Ed25519",
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(anchorApprovalDigest(root)),
  );
  return b64(sig);
}

export async function verifyAnchorApproval(
  voice: string,
  root: Uint8Array,
  sig: string | undefined,
  pubkeys: Record<string, string> = ORACLE_PUBKEYS,
): Promise<boolean> {
  if (!sig) return false;
  const pub = pubkeys[voice];
  if (!pub) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      unb64(pub),
      "Ed25519",
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      unb64(sig),
      new TextEncoder().encode(anchorApprovalDigest(root)),
    );
  } catch {
    return false;
  }
}

export interface AnchorApproval {
  voice: string;
  sig: string;
}

/** ≥`threshold` DISTINCT keyed voices must have validly signed the root. */
export async function verifyAnchorQuorum(
  root: Uint8Array,
  approvals: AnchorApproval[],
  threshold = 3,
  pubkeys: Record<string, string> = ORACLE_PUBKEYS,
): Promise<{ ok: boolean; valid: string[]; distinctKeys: number }> {
  const valid: string[] = [];
  const keys = new Set<string>();
  for (const a of approvals) {
    if (await verifyAnchorApproval(a.voice, root, a.sig, pubkeys)) {
      if (!valid.includes(a.voice)) valid.push(a.voice);
      keys.add(pubkeys[a.voice]);
    }
  }
  return { ok: keys.size >= threshold, valid, distinctKeys: keys.size };
}

// ── anchor-shaped tx (no recipient parameter — arbitrary pay is impossible) ──

export interface AnchorUtxo {
  txid: string;
  index: number;
  amountSats: bigint;
  scriptHex: string; // the utxo's own scriptPubKey (P2WPKH of ownAddress)
}

export interface BuildAnchorTxOpts {
  root: Uint8Array;
  ownAddress: string; // change returns ONLY here
  utxos: AnchorUtxo[];
  feeSats: bigint;
  feeCapSats: bigint;
  network?: typeof btc.NETWORK;
}

/** Build the ONLY tx shape this module can produce: one
 *  `OP_RETURN <OMEGA1:root>` output (0 sats) + change back to `ownAddress`.
 *  There is no parameter by which to pay a different address. */
export function buildAnchorTx(opts: BuildAnchorTxOpts): {
  tx: btc.Transaction;
  inSum: bigint;
  change: bigint;
} {
  if (opts.root.length !== 32) throw new Error("root must be 32 bytes");
  if (opts.feeSats > opts.feeCapSats) {
    throw new Error(`fee ${opts.feeSats} exceeds cap ${opts.feeCapSats}`);
  }
  if (opts.utxos.length === 0) throw new Error("no utxos");
  const net = opts.network ?? btc.NETWORK;
  const tx = new btc.Transaction({ allowUnknownOutputs: true });
  let inSum = 0n;
  for (const u of opts.utxos) {
    tx.addInput({
      txid: u.txid,
      index: u.index,
      witnessUtxo: { script: hex.decode(u.scriptHex), amount: u.amountSats },
    });
    inSum += u.amountSats;
  }
  const payload = new Uint8Array([
    ...new TextEncoder().encode(OP_RETURN_PREFIX),
    ...opts.root,
  ]);
  tx.addOutput({ script: btc.Script.encode(["RETURN", payload]), amount: 0n });
  const change = inSum - opts.feeSats;
  if (change < 0n) throw new Error("insufficient funds for fee");
  if (change > 0n) tx.addOutputAddress(opts.ownAddress, change, net);
  return { tx, inSum, change };
}

/** Defense-in-depth: a built tx is anchor-shaped iff it has exactly one
 *  OMEGA1 OP_RETURN, every other output pays `ownScriptHex`, and the implied
 *  fee is within cap. Throws on any deviation. */
export function assertAnchorShape(
  tx: btc.Transaction,
  ownScriptHex: string,
  inSum: bigint,
  feeCapSats: bigint,
): void {
  let opReturns = 0;
  let outSum = 0n;
  const ownScript = ownScriptHex.toLowerCase();
  const prefix = new TextEncoder().encode(OP_RETURN_PREFIX);
  for (let i = 0; i < tx.outputsLength; i++) {
    const o = tx.getOutput(i)!;
    const amount = o.amount ?? 0n;
    outSum += amount;
    const decoded = btc.Script.decode(o.script!);
    if (decoded[0] === "RETURN") {
      opReturns++;
      const data = decoded[1];
      if (!(data instanceof Uint8Array) || data.length !== prefix.length + 32) {
        throw new Error("OP_RETURN payload is not OMEGA1:<32-byte root>");
      }
      for (let k = 0; k < prefix.length; k++) {
        if (data[k] !== prefix[k]) throw new Error("OP_RETURN prefix is not OMEGA1:");
      }
      if (amount !== 0n) throw new Error("OP_RETURN output must carry 0 sats");
    } else {
      if (hex.encode(o.script!) !== ownScript) {
        throw new Error("anchor tx has an output paying a FOREIGN address");
      }
    }
  }
  if (opReturns !== 1) {
    throw new Error(`anchor tx must have exactly one OP_RETURN (got ${opReturns})`);
  }
  const fee = inSum - outSum;
  if (fee < 0n) throw new Error("outputs exceed inputs");
  if (fee > feeCapSats) throw new Error(`fee ${fee} exceeds cap ${feeCapSats}`);
}
