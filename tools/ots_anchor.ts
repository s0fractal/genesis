#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
// ots_anchor.ts — Layer-1 anchoring: OpenTimestamps (free Bitcoin anchoring).
//
// No wallet, no spend, no faucet, no quorum needed — this is the free, always-on
// witness layer (model B Layer 1, strategy x3300_955752). It submits a hash to
// the OpenTimestamps calendar servers, which aggregate it into a real Bitcoin
// block; the resulting `.ots` proof shows the hash existed before that block.
//
// Uses the canonical `opentimestamps` client (stamp/upgrade/verify are the
// reference implementation — not hand-rolled), so there is no verification gap.
//
// Subcommands:
//   stamp  --digest=HEX | --chord=PATH   → submit + write omega/ots/<digest>.ots
//   upgrade --proof=FILE                 → pull the Bitcoin attestation (after a
//                                          block; stamps are "pending" until then)
//   verify  --proof=FILE [--digest=HEX]  → confirm + print the Bitcoin block/time
//   info    --proof=FILE                 → human-readable timestamp tree

import OpenTimestamps from "npm:opentimestamps@0.4.9";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const OTS_DIR = join(dirname(dirname(fromFileUrl(import.meta.url))), "ots");
const { DetachedTimestampFile, Ops } = OpenTimestamps;

const flag = (a: string[], n: string) =>
  a.find((x) => x.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const toHex = (u: Uint8Array | number[]) =>
  Array.from(u).map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) =>
  new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

/** Resolve a 32-byte sha256 digest from --digest or a chord's content_sig. */
async function resolveDigest(rest: string[]): Promise<Uint8Array> {
  const d = flag(rest, "digest");
  if (d) {
    const raw = d.replace(/^sha256:/, "");
    if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error("digest must be 64 hex");
    return fromHex(raw.toLowerCase());
  }
  const chord = flag(rest, "chord");
  if (chord) {
    const text = await Deno.readTextFile(chord);
    const m = text.match(/content_sig:[\s\S]*?payload:\s*"sha256:([0-9a-f]{64})"/);
    if (!m) throw new Error(`no content_sig sha256 payload in ${chord}`);
    return fromHex(m[1]);
  }
  throw new Error("need --digest=HEX or --chord=PATH");
}

function detachedFromDigest(digest: Uint8Array) {
  return DetachedTimestampFile.fromHash(new Ops.OpSHA256(), Array.from(digest));
}

async function main() {
  const [cmd, ...rest] = Deno.args;

  if (cmd === "stamp") {
    const digest = await resolveDigest(rest);
    const dHex = toHex(digest);
    const detached = detachedFromDigest(digest);
    await OpenTimestamps.stamp(detached);
    await Deno.mkdir(OTS_DIR, { recursive: true });
    const out = join(OTS_DIR, `${dHex}.ots`);
    await Deno.writeFile(out, new Uint8Array(detached.serializeToBytes()));
    console.log(`✓ stamped ${dHex}`);
    console.log(`  proof: ${out} (PENDING — upgrade after a Bitcoin block confirms)`);
    return;
  }

  if (cmd === "upgrade") {
    const proof = flag(rest, "proof");
    if (!proof) { console.error("usage: upgrade --proof=FILE"); Deno.exit(2); }
    const bytes = await Deno.readFile(proof);
    const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
    const changed = await OpenTimestamps.upgrade(detached);
    if (changed) {
      await Deno.writeFile(proof, new Uint8Array(detached.serializeToBytes()));
      console.log(`✓ upgraded ${proof} — Bitcoin attestation attached`);
    } else {
      console.log(`… ${proof} not yet upgradable (no Bitcoin block aggregated it yet)`);
    }
    return;
  }

  if (cmd === "verify") {
    const proof = flag(rest, "proof");
    if (!proof) { console.error("usage: verify --proof=FILE [--digest=HEX]"); Deno.exit(2); }
    const bytes = await Deno.readFile(proof);
    const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
    // original = the same hash leaf (digest is in the filename or --digest)
    const digestHex = flag(rest, "digest")?.replace(/^sha256:/, "") ??
      proof.split("/").pop()!.replace(/\.ots$/, "");
    const original = detachedFromDigest(fromHex(digestHex));
    const result = await OpenTimestamps.verify(detached, original);
    if (result && result.bitcoin) {
      const ts = result.bitcoin.timestamp;
      console.log(
        `✓ VERIFIED on Bitcoin: block ${result.bitcoin.height}, ` +
          `time ${new Date(ts * 1000).toISOString()}`,
      );
      Deno.exit(0);
    }
    console.log("… PENDING — calendar commitment exists but no Bitcoin attestation yet (run upgrade later)");
    Deno.exit(1);
  }

  if (cmd === "info") {
    const proof = flag(rest, "proof");
    if (!proof) { console.error("usage: info --proof=FILE"); Deno.exit(2); }
    const bytes = await Deno.readFile(proof);
    const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
    console.log(OpenTimestamps.info(detached));
    return;
  }

  console.error("subcommands: stamp | upgrade | verify | info");
  Deno.exit(2);
}

if (import.meta.main) main();
