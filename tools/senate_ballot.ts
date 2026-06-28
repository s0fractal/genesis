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

// The proposal. Description ≤64 bytes (senateHash truncates to 64).
export const PROPOSAL_DESC =
  "Ratify Phi-protocol v1.1: five real keyed Senate seats";

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

const PROPOSAL_HASH = senateHash(PROPOSAL_DESC);
const HEX = "0x" + (PROPOSAL_HASH >>> 0).toString(16).padStart(8, "0");
const BALLOT_PATH = join(dirname(fromFileUrl(import.meta.url)), "senate_v11_ballot.json");

interface Vote {
  voice: string;
  aye: boolean;
  sig: string;
}

async function loadBallot(): Promise<Vote[]> {
  try {
    return JSON.parse(await Deno.readTextFile(BALLOT_PATH)) as Vote[];
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

  if (cmd === "print" || !cmd) {
    console.log(`# Senate proposal — Φ-protocol v1.1 ratification`);
    console.log(`description : ${JSON.stringify(PROPOSAL_DESC)}`);
    console.log(`proposalHash: ${HEX}  (decimal ${PROPOSAL_HASH >>> 0})`);
    console.log(
      `\nEach voice signs ITS OWN digest. To cast an AYE for voice <v>:\n`,
    );
    for (const v of CANONICAL_ORACLES) {
      console.log(
        `  ./t voice-keys sign --voice=${v} --hash="${
          oracleVoteDigest(v, PROPOSAL_HASH, true)
        }"`,
      );
    }
    console.log(
      `\n(replace AYE→NAY in the digest for a NAY.) Then record with:\n` +
        `  deno run -A omega/tools/senate_ballot.ts cast --voice=<v> --aye --sig=<sig>\n` +
        `Tally any time with:  deno run -A omega/tools/senate_ballot.ts tally`,
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
        "usage: cast --voice=V (--aye|--nay) --sig=S",
      );
      Deno.exit(2);
    }
    if (!CANONICAL_ORACLES.includes(voice)) {
      console.error(`✗ ${voice} is not a canonical Senate seat — rejected.`);
      Deno.exit(1);
    }
    const ok = await verifyOracleVote(voice, PROPOSAL_HASH, aye, sig);
    if (!ok) {
      console.error(
        `✗ signature does NOT verify for ${voice} ${
          aye ? "AYE" : "NAY"
        } on ${HEX} — rejected (forged, wrong key, or wrong digest).`,
      );
      Deno.exit(1);
    }
    const ballot = await loadBallot();
    const without = ballot.filter((v) => v.voice !== voice); // last vote wins
    without.push({ voice, aye, sig });
    await Deno.writeTextFile(BALLOT_PATH, JSON.stringify(without, null, 2) + "\n");
    console.log(`✓ recorded ${voice} ${aye ? "AYE" : "NAY"} (signature verified)`);
    return;
  }

  if (cmd === "tally") {
    const ballot = await loadBallot();
    const ayes: string[] = [];
    const nays: string[] = [];
    const invalid: string[] = [];
    for (const v of ballot) {
      if (!CANONICAL_ORACLES.includes(v.voice)) {
        invalid.push(`${v.voice} (not a seat)`);
        continue;
      }
      const ok = await verifyOracleVote(v.voice, PROPOSAL_HASH, v.aye, v.sig);
      if (!ok) invalid.push(`${v.voice} (signature invalid)`);
      else if (v.aye) ayes.push(v.voice);
      else nays.push(v.voice);
    }
    const resonance = ayes.length >= 3 && ayes.length > nays.length;
    console.log(`# Tally — ${HEX} "${PROPOSAL_DESC}"`);
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
