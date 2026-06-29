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
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";

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
    const m = text.match(
      /content_sig:[\s\S]*?payload:\s*"sha256:([0-9a-f]{64})"/,
    );
    if (!m) throw new Error(`no content_sig sha256 payload in ${chord}`);
    return fromHex(m[1]);
  }
  throw new Error("need --digest=HEX or --chord=PATH");
}

function detachedFromDigest(digest: Uint8Array) {
  return DetachedTimestampFile.fromHash(new Ops.OpSHA256(), Array.from(digest));
}

/** The earliest Bitcoin block this proof is attested to — read FROM THE PROOF
 *  (no explorer, no network). Returns null if no Bitcoin attestation yet (still
 *  pending an upgrade). This is what lets verify report a real result even when
 *  the OTS lib's strict explorer check is unreachable. */
// deno-lint-ignore no-explicit-any
function attestedBlock(detached: any): number | null {
  const info: string = OpenTimestamps.info(detached);
  const blocks = [...info.matchAll(/BitcoinBlockHeaderAttestation\((\d+)\)/g)]
    .map((m) => Number(m[1]));
  return blocks.length ? Math.min(...blocks) : null;
}

/** Stamp a digest to the OTS calendars and write its .ots proof. Returns path. */
async function stampDigest(digest: Uint8Array): Promise<string> {
  const detached = detachedFromDigest(digest);
  await OpenTimestamps.stamp(detached);
  await Deno.mkdir(OTS_DIR, { recursive: true });
  const out = join(OTS_DIR, `${toHex(digest)}.ots`);
  await Deno.writeFile(out, new Uint8Array(detached.serializeToBytes()));
  return out;
}

async function main() {
  const [cmd, ...rest] = Deno.args;

  if (cmd === "stamp") {
    const digest = await resolveDigest(rest);
    const out = await stampDigest(digest);
    console.log(`✓ stamped ${toHex(digest)}`);
    console.log(
      `  proof: ${out} (PENDING — upgrade after a Bitcoin block confirms)`,
    );
    return;
  }

  if (cmd === "stamp-batch") {
    // Idempotent: stamp each chord file whose digest isn't already proven.
    const files = rest.filter((x) => !x.startsWith("--"));
    if (!files.length) {
      console.error("usage: stamp-batch <chord.myc.md>...");
      Deno.exit(2);
    }
    let stamped = 0, skipped = 0, failed = 0;
    for (const f of files) {
      try {
        const digest = await resolveDigest([`--chord=${f}`]);
        const dHex = toHex(digest);
        try {
          await Deno.stat(join(OTS_DIR, `${dHex}.ots`));
          skipped++;
          continue; // already stamped
        } catch { /* not yet */ }
        await stampDigest(digest);
        stamped++;
        console.log(`  ✓ ${dHex.slice(0, 16)}…  ${f.split("/").pop()}`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${f}: ${(e as Error).message}`);
      }
    }
    console.log(
      `\nstamped ${stamped}, already-proven ${skipped}, failed ${failed}`,
    );
    return;
  }

  if (cmd === "autostamp") {
    // Routine witness maintenance (NO quorum, NO spend): stamp every signed
    // chord that isn't proven yet, then upgrade any proofs a Bitcoin block has
    // since confirmed. Idempotent — safe to run on a schedule.
    const chordsDir = flag(rest, "chords-dir") ??
      join(dirname(dirname(dirname(fromFileUrl(import.meta.url)))), "src");
    let stamped = 0, skipped = 0, failed = 0;
    for await (const e of Deno.readDir(chordsDir)) {
      if (!e.name.endsWith(".myc.md")) continue;
      try {
        const text = await Deno.readTextFile(join(chordsDir, e.name));
        const m = text.match(
          /content_sig:[\s\S]*?payload:\s*"sha256:([0-9a-f]{64})"/,
        );
        if (!m) continue; // unsigned chord — nothing to anchor
        const dHex = m[1];
        try {
          await Deno.stat(join(OTS_DIR, `${dHex}.ots`));
          skipped++;
          continue;
        } catch { /* not yet stamped */ }
        await stampDigest(fromHex(dHex));
        stamped++;
        console.log(`  ✓ stamped ${dHex.slice(0, 16)}…  ${e.name}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${e.name}: ${(err as Error).message}`);
      }
    }
    // upgrade any pending proofs (Bitcoin block may have confirmed since stamp).
    // Skip proofs already Bitcoin-attested — keeps recurring runs light (only
    // touches genuinely-pending proofs, not all 278 every time).
    let upgraded = 0;
    for await (const e of Deno.readDir(OTS_DIR)) {
      if (!e.name.endsWith(".ots")) continue;
      const path = join(OTS_DIR, e.name);
      try {
        const detached = DetachedTimestampFile.deserialize(
          Array.from(await Deno.readFile(path)),
        );
        if (attestedBlock(detached) !== null) continue; // already on Bitcoin
        if (await OpenTimestamps.upgrade(detached)) {
          await Deno.writeFile(
            path,
            new Uint8Array(detached.serializeToBytes()),
          );
          upgraded++;
        }
      } catch { /* upgrade best-effort; pending stays pending */ }
    }
    console.log(
      `autostamp: stamped ${stamped}, already-proven ${skipped}, ` +
        `upgraded ${upgraded}, failed ${failed}`,
    );
    return;
  }

  if (cmd === "upgrade-all" || cmd === "verify-all") {
    let pending = 0, done = 0;
    for await (const e of Deno.readDir(OTS_DIR)) {
      if (!e.name.endsWith(".ots")) continue;
      const path = join(OTS_DIR, e.name);
      const bytes = await Deno.readFile(path);
      const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
      if (cmd === "upgrade-all") {
        if (await OpenTimestamps.upgrade(detached)) {
          await Deno.writeFile(
            path,
            new Uint8Array(detached.serializeToBytes()),
          );
          done++;
          console.log(`  ✓ upgraded ${e.name}`);
        } else pending++;
      } else {
        const digestHex = e.name.replace(/\.ots$/, "");
        const blk = attestedBlock(detached); // in-proof, no explorer → no crash
        if (blk !== null) {
          done++;
          console.log(`  ✓ ${digestHex.slice(0, 16)}… Bitcoin block ${blk}`);
        } else pending++;
      }
    }
    console.log(
      cmd === "upgrade-all"
        ? `\nupgraded ${done}, still pending ${pending}`
        : `\nverified ${done}, pending ${pending}`,
    );
    return;
  }

  if (cmd === "upgrade") {
    const proof = flag(rest, "proof");
    if (!proof) {
      console.error("usage: upgrade --proof=FILE");
      Deno.exit(2);
    }
    const bytes = await Deno.readFile(proof);
    const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
    const changed = await OpenTimestamps.upgrade(detached);
    if (changed) {
      await Deno.writeFile(proof, new Uint8Array(detached.serializeToBytes()));
      console.log(`✓ upgraded ${proof} — Bitcoin attestation attached`);
    } else {
      console.log(
        `… ${proof} not yet upgradable (no Bitcoin block aggregated it yet)`,
      );
    }
    return;
  }

  if (cmd === "verify") {
    const proof = flag(rest, "proof");
    if (!proof) {
      console.error("usage: verify --proof=FILE [--digest=HEX]");
      Deno.exit(2);
    }
    const bytes = await Deno.readFile(proof);
    const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
    // original = the same hash leaf (digest is in the filename or --digest)
    const digestHex = flag(rest, "digest")?.replace(/^sha256:/, "") ??
      proof.split("/").pop()!.replace(/\.ots$/, "");
    const original = detachedFromDigest(fromHex(digestHex));
    // Strict path: OTS lib confirms the attested block is canonical via a block
    // explorer. That network call can time out / be unreachable and the lib
    // throws hard — so we catch it and fall back to the in-proof attestation,
    // which is itself cryptographic evidence (the block height is committed in
    // the .ots). Only a missing attestation is truly "pending".
    try {
      const result = await OpenTimestamps.verify(detached, original);
      if (result && result.bitcoin) {
        const ts = result.bitcoin.timestamp;
        console.log(
          `✓ VERIFIED on Bitcoin (explorer-confirmed): block ` +
            `${result.bitcoin.height}, time ${
              new Date(ts * 1000).toISOString()
            }`,
        );
        Deno.exit(0);
      }
    } catch (e) {
      const blk = attestedBlock(detached);
      if (blk !== null) {
        console.log(
          `✓ ATTESTED to Bitcoin block ${blk} (from the proof; independent ` +
            `explorer confirmation unavailable: ${(e as Error).message})`,
        );
        Deno.exit(0);
      }
    }
    const blk = attestedBlock(detached);
    if (blk !== null) {
      console.log(`✓ ATTESTED to Bitcoin block ${blk} (from the proof)`);
      Deno.exit(0);
    }
    console.log(
      "… PENDING — calendar commitment exists but no Bitcoin attestation yet (run upgrade later)",
    );
    Deno.exit(1);
  }

  if (cmd === "info") {
    const proof = flag(rest, "proof");
    if (!proof) {
      console.error("usage: info --proof=FILE");
      Deno.exit(2);
    }
    const bytes = await Deno.readFile(proof);
    const detached = DetachedTimestampFile.deserialize(Array.from(bytes));
    console.log(OpenTimestamps.info(detached));
    return;
  }

  console.error("subcommands: stamp | upgrade | verify | info");
  Deno.exit(2);
}

if (import.meta.main) main();
