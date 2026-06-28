#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// anchor_emit.ts — the anchor EMITTER. The one tool that reads a wallet key and
// can broadcast. Everything it can build is shape-restricted by anchor_pipeline
// (OP_RETURN<OMEGA1:root> + change-to-self; arbitrary transfer unrepresentable).
//
// Ratified governance (AUTONOMY.md, chord x3300_955762): a mainnet anchor is
// authorized by a real 3-of-5 keyed-voice quorum over the root, signet-first.
// This tool enforces both: `build` verifies the quorum BEFORE signing, and
// `broadcast --network=mainnet` REFUSES until a signet proof is recorded.
//
// Subcommands:
//   prepare --chords=h1,h2,...        → Merkle root + approval digest + sign cmds
//   build --voice=V --root=HEX --approvals=FILE --network=signet|mainnet [--fee=SATS]
//                                       → verify quorum, fetch utxos, build+sign,
//                                         print tx hex (NO broadcast)
//   broadcast --network=signet --txhex=HEX   → POST to mempool (mainnet gated)
//   verify --network=NET --txid=TXID --root=HEX   → confirm the OP_RETURN landed

import { dirname, fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { hex } from "npm:@scure/base@1.1.6";
import * as btc from "npm:@scure/btc-signer@1.3.2";
import { secp256k1 } from "npm:@noble/curves@1.4.0/secp256k1";
import {
  anchorApprovalDigest,
  assertAnchorShape,
  buildAnchorTx,
  leafFromHash,
  merkleRoot,
  OP_RETURN_PREFIX,
  verifyAnchorQuorum,
} from "../src/network/anchor_pipeline.ts";

const SIGNET_PROOF = join(dirname(fromFileUrl(import.meta.url)), "anchor_signet_proof.json");

function netOf(name: string) {
  if (name === "signet") {
    return { net: btc.TEST_NETWORK, api: "https://mempool.space/signet/api" };
  }
  if (name === "mutinynet") {
    return { net: btc.TEST_NETWORK, api: "https://mutinynet.com/api" };
  }
  if (name === "mainnet") return { net: btc.NETWORK, api: "https://mempool.space/api" };
  throw new Error(`network must be signet|mutinynet|mainnet, got ${name}`);
}
const isMainnet = (name: string) => name === "mainnet";
const flag = (a: string[], n: string) =>
  a.find((x) => x.startsWith(`--${n}=`))?.split("=").slice(1).join("=");

async function walletKey(voice: string) {
  const home = Deno.env.get("HOME") ?? ".";
  const p = join(home, ".trinity", "wallets", `${voice}.btc.json`);
  const w = JSON.parse(await Deno.readTextFile(p));
  return { priv: hex.decode(w.privkey_hex), address: w.address as string };
}

function scriptHexFor(address: string, net: typeof btc.NETWORK): string {
  const tx = new btc.Transaction();
  tx.addOutputAddress(address, 1000n, net);
  return hex.encode(tx.getOutput(0)!.script!);
}

async function main() {
  const [cmd, ...rest] = Deno.args;

  if (cmd === "prepare") {
    const chords = (flag(rest, "chords") ?? "").split(",").filter(Boolean);
    if (!chords.length) { console.error("usage: prepare --chords=h1,h2,..."); Deno.exit(2); }
    const root = merkleRoot(chords.map(leafFromHash));
    const rootHex = hex.encode(root);
    console.log(`merkle root : 0x${rootHex}  (${chords.length} leaves)`);
    console.log(`approval digest (each voice signs this):`);
    console.log(`  ${anchorApprovalDigest(root)}`);
    console.log(`\nsign:  ./t voice-keys sign --voice=<v> --hash="${anchorApprovalDigest(root)}"`);
    console.log(`collect ≥3 into an approvals file: [{"voice":"..","sig":".."}, ...]`);
    return;
  }

  if (cmd === "build") {
    const voice = flag(rest, "voice");
    const rootHex = (flag(rest, "root") ?? "").replace(/^0x/, "");
    const approvalsFile = flag(rest, "approvals");
    const network = flag(rest, "network") ?? "signet";
    const fee = BigInt(flag(rest, "fee") ?? "300");
    const feeCap = BigInt(flag(rest, "fee-cap") ?? "2000");
    if (!voice || !/^[0-9a-f]{64}$/.test(rootHex)) {
      console.error("usage: build --voice=V --root=HEX [--approvals=FILE] [--network=] [--fee=]");
      Deno.exit(2);
    }
    const { net, api } = netOf(network);
    const root = hex.decode(rootHex);
    // Quorum is REQUIRED for mainnet (real spend); on testnet a dry-run proves
    // tx mechanics and doesn't need a real 3-of-5. Mainnet guard is unchanged.
    if (approvalsFile) {
      const q = await verifyAnchorQuorum(root, JSON.parse(await Deno.readTextFile(approvalsFile)));
      if (!q.ok) {
        console.error(`✗ quorum NOT met: ${q.distinctKeys} distinct valid (need 3) [${q.valid}]`);
        Deno.exit(1);
      }
      console.log(`✓ quorum: ${q.valid.join(", ")} (${q.distinctKeys} distinct keys)`);
    } else if (isMainnet(network)) {
      console.error("✗ mainnet anchor REQUIRES --approvals with a verified 3-of-5 quorum");
      Deno.exit(1);
    } else {
      console.error(`# testnet (${network}) dry-run — quorum skipped (mechanics test only)`);
    }
    const { priv, address } = await walletKey(voice);
    const ownScript = scriptHexFor(address, net);
    const utxos = await (await fetch(`${api}/address/${address}/utxo`)).json();
    if (!Array.isArray(utxos) || !utxos.length) {
      console.error(`✗ no UTXOs at ${address} (${network}) — fund it first`);
      Deno.exit(1);
    }
    const { tx, inSum } = buildAnchorTx({
      root,
      ownAddress: address,
      utxos: utxos.map((u: { txid: string; vout: number; value: number }) => ({
        txid: u.txid,
        index: u.vout,
        amountSats: BigInt(u.value),
        scriptHex: ownScript,
      })),
      feeSats: fee,
      feeCapSats: feeCap,
      network: net,
    });
    assertAnchorShape(tx, ownScript, inSum, feeCap); // defense-in-depth
    tx.sign(priv);
    tx.finalize();
    const txhex = hex.encode(tx.extract());
    console.error(`# built + signed anchor tx (${network}), txid ${tx.id}, vsize ${tx.vsize}`);
    console.log(txhex);
    return;
  }

  if (cmd === "broadcast") {
    const network = flag(rest, "network") ?? "signet";
    const txhex = flag(rest, "txhex");
    if (!txhex) { console.error("usage: broadcast --network=signet --txhex=HEX"); Deno.exit(2); }
    if (network === "mainnet") {
      // signet-first guard, enforced in code (codex's permanent form-guard).
      try {
        await Deno.stat(SIGNET_PROOF);
      } catch {
        console.error(
          "✗ REFUSED: mainnet broadcast requires a recorded signet dry-run proof " +
            `(${SIGNET_PROOF}). Prove signet first.`,
        );
        Deno.exit(1);
      }
    }
    const { api } = netOf(network);
    const r = await fetch(`${api}/tx`, { method: "POST", body: txhex });
    const body = await r.text();
    if (!r.ok) { console.error(`✗ broadcast failed (${r.status}): ${body}`); Deno.exit(1); }
    console.log(`✓ broadcast ${network}: txid ${body}`);
    // A successful testnet (signet/mutinynet) broadcast records the signet-first
    // proof that unlocks mainnet — codex's guard, satisfied by real evidence.
    if (network === "signet" || network === "mutinynet") {
      await Deno.writeTextFile(
        SIGNET_PROOF,
        JSON.stringify({ network, txid: body, broadcast_at_note: "stamped post-broadcast" }, null, 2) + "\n",
      );
      console.log(`  ✓ recorded signet-first proof: ${SIGNET_PROOF}`);
    }
    return;
  }

  if (cmd === "verify") {
    const network = flag(rest, "network") ?? "signet";
    const txid = flag(rest, "txid");
    const rootHex = (flag(rest, "root") ?? "").replace(/^0x/, "");
    if (!txid || !/^[0-9a-f]{64}$/.test(rootHex)) {
      console.error("usage: verify --network=NET --txid=TXID --root=HEX");
      Deno.exit(2);
    }
    const { api } = netOf(network);
    const tx = await (await fetch(`${api}/tx/${txid}`)).json();
    const want = OP_RETURN_PREFIX +
      String.fromCharCode(...hex.decode(rootHex)); // for display only
    const expectedHex = hex.encode(
      new Uint8Array([...new TextEncoder().encode(OP_RETURN_PREFIX), ...hex.decode(rootHex)]),
    );
    const found = (tx.vout ?? []).some((o: { scriptpubkey_asm?: string; scriptpubkey?: string }) =>
      (o.scriptpubkey_asm ?? "").includes("OP_RETURN") &&
      (o.scriptpubkey ?? "").includes(expectedHex)
    );
    console.log(found
      ? `✓ ${txid} carries OP_RETURN OMEGA1:${rootHex} (confirmed=${tx.status?.confirmed})`
      : `✗ ${txid} does NOT carry the expected anchor`);
    Deno.exit(found ? 0 : 1);
  }

  console.error("subcommands: prepare | build | broadcast | verify");
  Deno.exit(2);
}

if (import.meta.main) main();
