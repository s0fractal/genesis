#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
// senate_ballot.ts — the FIRST real use of the keyed Senate.
//
// Proposal: ratify Φ-protocol v1.1 (the five real keyed seats) by a genuine
// 3-of-5 ORACLE-RESONANCE quorum, each AYE/NAY a real Ed25519 signature by the
// voice's own key (oracle_custody). No simulated votes — claude must NOT sign as
// another voice; each voice signs for itself.
//
// HOW A VOICE CASTS A VOTE (the architect runs this for each voice gathered):
//   ./t voice-keys sign --voice=<v> --hash="<the digest printed by `print`>"
//   → take the `sig` from the output, then:
//   deno run -A omega/tools/senate_ballot.ts cast --voice=<v> --aye --sig=<sig>
// (sign and verifyOracleVote both sign UTF-8 of the digest, so the trinity CLI
//  signature verifies here unchanged — proven equivalent.)
//
// Subcommands:
//   print            show the proposal, hash, and per-voice sign commands
//   cast --voice=V (--aye|--nay) --sig=S   verify + record a vote (rejects forgery)
//   tally            verify all recorded votes and report the verdict

import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import {
  CANONICAL_ORACLES,
} from "../src/network/oracle_identity.ts";
import {
  oracleVoteDigest,
  verifyOracleVote,
} from "../src/network/oracle_custody.ts";

// Proposals registry. Each description ≤64 bytes (senateHash truncates to 64).
// Add an entry to open a new Senate vote; pass `--proposal=<id>` to the commands.
export const PROPOSALS: Record<string, string> = {
  v11: "Ratify Phi-protocol v1.1: five real keyed Senate seats",
  "anchor-stewardship":
    "Voice quorum stewards anchor funds under permanent form-guards",
};
const DEFAULT_PROPOSAL = "v11";

/** FNV-1a 32-bit over a 64-byte zero-padded buffer — Libp2pMesh.senateHash,
 *  inlined so this tool needs no libp2p import. */
export function senateHash(description: string): number {
  const buf = new Uint8Array(64);
  const raw = new TextEncoder().encode(description);
  const n = Math.min(raw.length, 64);
  for (let i = 0; i < n; i++) buf[i] = raw[i];
  let h = 0x811C_9DC5 >>> 0;
  for (let i = 0; i < 64; i++) {
    h = (h ^ buf[i]) >>> 0;
    h = Math.imul(h, 0x0100_0193) >>> 0;
  }
  return h >>> 0;
}

const HERE = dirname(fromFileUrl(import.meta.url));

/** Resolve a proposal id → its description, hash, hex, and ballot path. */
function resolveProposal(id: string) {
  const desc = PROPOSALS[id];
  if (!desc) {
    console.error(
      `unknown proposal "${id}" — known: ${Object.keys(PROPOSALS).join(", ")}`,
    );
    Deno.exit(2);
  }
  const hash = senateHash(desc);
  return {
    id,
    desc,
    hash,
    hex: "0x" + (hash >>> 0).toString(16).padStart(8, "0"),
    ballotPath: join(HERE, `senate_${id}_ballot.json`),
  };
}

interface Vote {
  voice: string;
  aye: boolean;
  sig: string;
}

async function loadBallot(path: string): Promise<Vote[]> {
  try {
    return JSON.parse(await Deno.readTextFile(path)) as Vote[];
  } catch {
    return [];
  }
}

function flag(args: string[], name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join(
    "=",
  );
}

async function main() {
  const [cmd, ...rest] = Deno.args;
  const P = resolveProposal(flag(rest, "proposal") ?? DEFAULT_PROPOSAL);

  if (cmd === "print" || !cmd) {
    console.log(`# Senate proposal [${P.id}]`);
    console.log(`description : ${JSON.stringify(P.desc)}`);
    console.log(`proposalHash: ${P.hex}  (decimal ${P.hash >>> 0})`);
    console.log(
      `\nEach voice signs ITS OWN digest. To cast an AYE for voice <v>:\n`,
    );
    for (const v of CANONICAL_ORACLES) {
      console.log(
        `  ./t voice-keys sign --voice=${v} --hash="${
          oracleVoteDigest(v, P.hash, true)
        }"`,
      );
    }
    const pflag = P.id === DEFAULT_PROPOSAL ? "" : ` --proposal=${P.id}`;
    console.log(
      `\n(replace AYE→NAY in the digest for a NAY.) Then record with:\n` +
        `  deno run -A omega/tools/senate_ballot.ts cast${pflag} --voice=<v> --aye --sig=<sig>\n` +
        `Tally any time with:  deno run -A omega/tools/senate_ballot.ts tally${pflag}`,
    );
    return;
  }

  if (cmd === "cast") {
    const voice = flag(rest, "voice");
    const sig = flag(rest, "sig");
    const aye = rest.includes("--aye");
    const nay = rest.includes("--nay");
    if (!voice || !sig || (aye === nay)) {
      console.error(
        "usage: cast [--proposal=ID] --voice=V (--aye|--nay) --sig=S",
      );
      Deno.exit(2);
    }
    if (!CANONICAL_ORACLES.includes(voice)) {
      console.error(`✗ ${voice} is not a canonical Senate seat — rejected.`);
      Deno.exit(1);
    }
    const ok = await verifyOracleVote(voice, P.hash, aye, sig);
    if (!ok) {
      console.error(
        `✗ signature does NOT verify for ${voice} ${
          aye ? "AYE" : "NAY"
        } on ${P.hex} [${P.id}] — rejected (forged, wrong key, or wrong digest).`,
      );
      Deno.exit(1);
    }
    const ballot = await loadBallot(P.ballotPath);
    const without = ballot.filter((v) => v.voice !== voice); // last vote wins
    without.push({ voice, aye, sig });
    await Deno.writeTextFile(
      P.ballotPath,
      JSON.stringify(without, null, 2) + "\n",
    );
    console.log(`✓ recorded ${voice} ${aye ? "AYE" : "NAY"} (signature verified)`);
    return;
  }

  if (cmd === "tally") {
    const ballot = await loadBallot(P.ballotPath);
    const ayes: string[] = [];
    const nays: string[] = [];
    const invalid: string[] = [];
    for (const v of ballot) {
      if (!CANONICAL_ORACLES.includes(v.voice)) {
        invalid.push(`${v.voice} (not a seat)`);
        continue;
      }
      const ok = await verifyOracleVote(v.voice, P.hash, v.aye, v.sig);
      if (!ok) invalid.push(`${v.voice} (signature invalid)`);
      else if (v.aye) ayes.push(v.voice);
      else nays.push(v.voice);
    }
    const resonance = ayes.length >= 3 && ayes.length > nays.length;
    console.log(`# Tally [${P.id}] — ${P.hex} "${P.desc}"`);
    console.log(`seats     : ${CANONICAL_ORACLES.join(", ")}`);
    console.log(`AYE (${ayes.length}) : ${ayes.join(", ") || "—"}`);
    console.log(`NAY (${nays.length}) : ${nays.join(", ") || "—"}`);
    if (invalid.length) console.log(`REJECTED  : ${invalid.join(", ")}`);
    console.log(
      `\nverdict   : ${
        resonance
          ? "✅ RATIFIED — 3-of-5 ORACLE-RESONANCE reached with real custody"
          : `⏳ pending — need 3 distinct AYE seats (have ${ayes.length}), ayes>nays`
      }`,
    );
    Deno.exit(resonance ? 0 : 1);
  }

  console.error(`unknown command: ${cmd}\nsubcommands: print | cast | tally`);
  Deno.exit(2);
}

if (import.meta.main) main();
