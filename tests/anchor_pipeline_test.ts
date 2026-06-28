// anchor_pipeline_test.ts — the dry-run pipeline's guards are executable.
// Locks: Merkle determinism, approval-digest binding, 3-of-5 anchor quorum,
// and the security core — the builder can ONLY make an OP_RETURN+change-to-self
// tx, and assertAnchorShape REJECTS any output paying a foreign address.

import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { hex } from "npm:@scure/base@1.1.6";
import * as btc from "npm:@scure/btc-signer@1.3.2";
import { sha256 } from "npm:@noble/hashes@1.4.0/sha256";
import { secp256k1 } from "npm:@noble/curves@1.4.0/secp256k1";
import {
  anchorApprovalDigest,
  assertAnchorShape,
  buildAnchorTx,
  leafFromHash,
  merkleRoot,
  signAnchorApproval,
  verifyAnchorApproval,
  verifyAnchorQuorum,
} from "../src/network/anchor_pipeline.ts";

const OWN = "bc1qpzq4sdvzet07qfe6757yq8q8f7gc70p4h2qnet"; // claude wallet
const FOREIGN = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"; // BIP173 vector

function scriptHexOf(addr: string): string {
  const tx = new btc.Transaction();
  tx.addOutputAddress(addr, 1000n, btc.NETWORK);
  return hex.encode(tx.getOutput(0)!.script!);
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}
async function mintKeys(names: string[]) {
  const pub: Record<string, string> = {}, priv: Record<string, string> = {};
  for (const n of names) {
    const kp = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]) as CryptoKeyPair;
    pub[n] = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
    priv[n] = b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  }
  return { pub, priv };
}

const leaf = (s: string) => sha256(new TextEncoder().encode(s));

Deno.test("merkle: deterministic, single leaf is its own root", () => {
  const a = leaf("a"), b = leaf("b"), c = leaf("c");
  assertEquals(hex.encode(merkleRoot([a])), hex.encode(a));
  // same inputs → same root
  assertEquals(hex.encode(merkleRoot([a, b, c])), hex.encode(merkleRoot([a, b, c])));
  // order matters
  assert(hex.encode(merkleRoot([a, b])) !== hex.encode(merkleRoot([b, a])));
  // odd level duplicates last (3 leaves != 2 leaves)
  assert(hex.encode(merkleRoot([a, b, c])) !== hex.encode(merkleRoot([a, b])));
});

Deno.test("leafFromHash parses sha256: and bare hex, rejects junk", () => {
  const h = "sha256:" + "ab".repeat(32);
  assertEquals(leafFromHash(h).length, 32);
  assertEquals(leafFromHash("ab".repeat(32)).length, 32);
  assertThrows(() => leafFromHash("not-a-hash"));
});

Deno.test("anchor approval: digest binds the root; sign→verify roundtrip", async () => {
  const { pub, priv } = await mintKeys(["claude"]);
  const root = merkleRoot([leaf("x"), leaf("y")]);
  const other = merkleRoot([leaf("z")]);
  assert(anchorApprovalDigest(root) !== anchorApprovalDigest(other));
  const sig = await signAnchorApproval(root, priv["claude"]);
  assert(await verifyAnchorApproval("claude", root, sig, pub));
  // wrong root / missing sig / unkeyed voice all fail
  assert(!(await verifyAnchorApproval("claude", other, sig, pub)));
  assert(!(await verifyAnchorApproval("claude", root, undefined, pub)));
  assert(!(await verifyAnchorApproval("gpt", root, sig, pub)));
});

Deno.test("anchor quorum: 3 distinct valid → ok; 2 → not; dup/forged don't count", async () => {
  const { pub, priv } = await mintKeys(["claude", "codex", "kimi"]);
  const root = merkleRoot([leaf("ratify")]);
  const sigs = {
    claude: await signAnchorApproval(root, priv["claude"]),
    codex: await signAnchorApproval(root, priv["codex"]),
    kimi: await signAnchorApproval(root, priv["kimi"]),
  };
  const three = await verifyAnchorQuorum(root, [
    { voice: "claude", sig: sigs.claude },
    { voice: "codex", sig: sigs.codex },
    { voice: "kimi", sig: sigs.kimi },
  ], 3, pub);
  assert(three.ok);
  assertEquals(three.distinctKeys, 3);

  // same voice twice + one forged → only 1 distinct key
  const two = await verifyAnchorQuorum(root, [
    { voice: "claude", sig: sigs.claude },
    { voice: "claude", sig: sigs.claude },
    { voice: "codex", sig: "AAAA" }, // forged
  ], 3, pub);
  assert(!two.ok);
  assertEquals(two.distinctKeys, 1);
});

Deno.test("buildAnchorTx: produces exactly OP_RETURN<OMEGA1:root> + change to self", () => {
  const root = merkleRoot([leaf("first")]);
  const own = scriptHexOf(OWN);
  const { tx, inSum, change } = buildAnchorTx({
    root,
    ownAddress: OWN,
    utxos: [{ txid: "aa".repeat(32), index: 0, amountSats: 10000n, scriptHex: own }],
    feeSats: 500n,
    feeCapSats: 2000n,
  });
  assertEquals(tx.outputsLength, 2);
  assertEquals(inSum, 10000n);
  assertEquals(change, 9500n);
  // and it passes its own shape guard
  assertAnchorShape(tx, own, inSum, 2000n);
});

Deno.test("buildAnchorTx: fee over cap is refused", () => {
  const root = merkleRoot([leaf("f")]);
  const own = scriptHexOf(OWN);
  assertThrows(
    () =>
      buildAnchorTx({
        root,
        ownAddress: OWN,
        utxos: [{ txid: "bb".repeat(32), index: 0, amountSats: 10000n, scriptHex: own }],
        feeSats: 5000n,
        feeCapSats: 2000n,
      }),
    Error,
    "exceeds cap",
  );
});

Deno.test("SECURITY: assertAnchorShape REJECTS a tx that pays a foreign address", () => {
  // Hand-build a tx that anchors BUT also pays a foreign address — exactly the
  // attack the design forbids. buildAnchorTx can't express this; a tampered or
  // hand-rolled tx can, and the guard must catch it.
  const root = merkleRoot([leaf("evil")]);
  const own = scriptHexOf(OWN);
  const tx = new btc.Transaction({ allowUnknownOutputs: true });
  tx.addInput({
    txid: "cc".repeat(32),
    index: 0,
    witnessUtxo: { script: hex.decode(own), amount: 10000n },
  });
  const payload = new Uint8Array([
    ...new TextEncoder().encode("OMEGA1:"),
    ...root,
  ]);
  tx.addOutput({ script: btc.Script.encode(["RETURN", payload]), amount: 0n });
  tx.addOutputAddress(FOREIGN, 9000n, btc.NETWORK); // <-- the drain
  assertThrows(
    () => assertAnchorShape(tx, own, 10000n, 2000n),
    Error,
    "FOREIGN address",
  );
});

Deno.test("signing proof: a built anchor tx signs, finalizes, and reparses valid", () => {
  // The one path beyond the pure logic: prove the emitter's tx actually signs
  // into a valid, broadcastable, anchor-shaped transaction (offline — the only
  // thing left for a real signet run is funded UTXOs).
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, true);
  const p2 = btc.p2wpkh(pub, btc.TEST_NETWORK); // signet address
  const root = merkleRoot([leaf("mainnet-someday")]);
  const { tx, inSum } = buildAnchorTx({
    root,
    ownAddress: p2.address!,
    utxos: [{
      txid: "dd".repeat(32),
      index: 0,
      amountSats: 100000n,
      scriptHex: hex.encode(p2.script),
    }],
    feeSats: 300n,
    feeCapSats: 2000n,
    network: btc.TEST_NETWORK,
  });
  assertAnchorShape(tx, hex.encode(p2.script), inSum, 2000n);
  tx.sign(priv);
  tx.finalize();
  const raw = tx.extract();
  const parsed = btc.Transaction.fromRaw(raw, { allowUnknownOutputs: true });
  assertEquals(parsed.inputsLength, 1);
  assertEquals(parsed.outputsLength, 2); // OP_RETURN + change-to-self
  assert(raw.length > 100, "a real signed segwit tx");
});

Deno.test("SECURITY: assertAnchorShape rejects a second OP_RETURN and over-cap fee", () => {
  const own = scriptHexOf(OWN);
  const root = merkleRoot([leaf("z")]);
  const payload = new Uint8Array([...new TextEncoder().encode("OMEGA1:"), ...root]);
  // two OP_RETURNs
  const tx2 = new btc.Transaction({ allowUnknownOutputs: true });
  tx2.addOutput({ script: btc.Script.encode(["RETURN", payload]), amount: 0n });
  tx2.addOutput({ script: btc.Script.encode(["RETURN", payload]), amount: 0n });
  assertThrows(() => assertAnchorShape(tx2, own, 10000n, 2000n), Error, "exactly one OP_RETURN");
  // over-cap fee (no change output → whole input is fee)
  const tx3 = new btc.Transaction({ allowUnknownOutputs: true });
  tx3.addOutput({ script: btc.Script.encode(["RETURN", payload]), amount: 0n });
  assertThrows(() => assertAnchorShape(tx3, own, 10000n, 2000n), Error, "exceeds cap");
});
