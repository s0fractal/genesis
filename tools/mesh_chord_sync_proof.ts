#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// mesh_chord_sync_proof.ts — real CONTENT over the live mesh, verified against
// the trust spine. The mesh stops being plumbing and starts carrying the
// substrate: node A serves trinity chords by coordinate; node B fetches one
// THROUGH the live relay.myc.md and verifies its Ed25519 content_sig against the
// committed voice registry (x2F38). If it passes, an authentic, authored chord
// moved peer-to-peer over production infra — the seed of trinity nodes syncing
// chords over the omega mesh. (chord x3300_955778 path → content flowing.)
//
//   deno run --allow-net --allow-read --allow-env tools/mesh_chord_sync_proof.ts [chord-filename]

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise, pureJsCrypto } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { multiaddr } from "@multiformats/multiaddr";

const PROTOCOL = "/omega/chord-sync/1.0.0";
const MEMBRANE = "https://myc.md/.well-known/omega-relay";
const SRC = new URL("../../src/", import.meta.url); // trinity/src
const DEFAULT_CHORD =
  "x3300_955778_claude_public-mesh-relay-live-on-relaymyc-md-membrane-resonance-complete.myc.md";

// ── trinity's chord-signature scheme (mirror of src/x2F37_voice_keys.ts) ──────
function chordBody(full: string): string | null {
  const m = full.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? full.slice(m[0].length) : null;
}
async function payloadHash(
  filename: string,
  full: string,
): Promise<string | null> {
  const body = chordBody(full);
  if (body === null) return null;
  const d = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${filename}\n${body}`),
  );
  return "sha256:" +
    Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0"))
      .join("");
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function verifyChord(
  filename: string,
  full: string,
): Promise<{ ok: boolean; voice?: string; why: string }> {
  const fm = full.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const voice = fm.match(/content_sig:[\s\S]*?\n\s+voice:\s*(\S+)/)?.[1];
  const pinned = fm.match(/content_sig:[\s\S]*?\n\s+payload:\s*"([^"]+)"/)?.[1];
  const sig = fm.match(/content_sig:[\s\S]*?\n\s+sig:\s*"([^"]+)"/)?.[1];
  if (!voice || !pinned || !sig) {
    return { ok: false, why: "no content_sig block" };
  }
  const recomputed = await payloadHash(filename, full);
  if (recomputed !== pinned) {
    return {
      ok: false,
      voice,
      why: `payload mismatch (tampered): pinned ${pinned}, got ${recomputed}`,
    };
  }
  const reg = JSON.parse(
    await Deno.readTextFile(new URL("x2F38_voice_pubkeys.json", SRC)),
  );
  const pubkey = reg.keys?.[voice]?.pubkey;
  if (!pubkey) {
    return { ok: false, voice, why: `voice ${voice} not in registry` };
  }
  const key = await crypto.subtle.importKey(
    "raw",
    unb64(pubkey),
    "Ed25519",
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "Ed25519",
    key,
    unb64(sig),
    new TextEncoder().encode(pinned),
  );
  return { ok, voice, why: ok ? "valid signature" : "bad signature" };
}

// ── mesh ─────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function mkPeer(listen: string[] = []): Promise<any> {
  return await createLibp2p(
    {
      addresses: { listen },
      transports: [webSockets(), circuitRelayTransport()],
      connectionEncrypters: [noise({ crypto: pureJsCrypto })],
      streamMuxers: [yamux()],
      services: { identify: identify() },
      connectionGater: { denyDialMultiaddr: () => false },
    } as Parameters<typeof createLibp2p>[0],
  );
}
// deno-lint-ignore no-explicit-any
const bytesOf = (d: any): Uint8Array =>
  d instanceof Uint8Array
    ? d
    : typeof d?.subarray === "function"
    ? d.subarray()
    : new Uint8Array(d);

async function main() {
  const want = Deno.args[0] ?? DEFAULT_CHORD;
  const RELAY = (await (await fetch(MEMBRANE)).text()).trim();
  console.log(`relay (from membrane): ${RELAY}`);

  // node A — serves chords by coordinate from trinity/src (basename only, no traversal)
  const A = await mkPeer([`${RELAY}/p2p-circuit`]);
  await A.start();
  await A.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  A.handle(PROTOCOL, (arg: any) => {
    const s = arg?.stream ?? arg;
    s.addEventListener("message", async (evt: { data: unknown }) => {
      try {
        const { req } = JSON.parse(new TextDecoder().decode(bytesOf(evt.data)));
        const name = req.replace(/[^a-zA-Z0-9._-]/g, ""); // basename guard
        const content = await Deno.readTextFile(new URL(name, SRC));
        s.send(
          new TextEncoder().encode(JSON.stringify({ filename: name, content })),
        );
      } catch (e) {
        s.send(new TextEncoder().encode(JSON.stringify({ error: String(e) })));
      }
    });
  }, { runOnLimitedConnection: true });

  let aCircuit: string | undefined;
  for (let i = 0; i < 60; i++) {
    aCircuit = A.getMultiaddrs().map((m: { toString(): string }) =>
      m.toString()
    )
      .find((s: string) => s.includes("/p2p-circuit"));
    if (aCircuit) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!aCircuit) aCircuit = `${RELAY}/p2p-circuit/p2p/${A.peerId.toString()}`;
  console.log(`A serving chords; reachable via relay`);

  // node B — fetches the chord THROUGH the live relay, verifies it
  const B = await mkPeer();
  await B.start();
  await B.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  const stream: any = await B.dialProtocol(multiaddr(aCircuit), PROTOCOL, {
    runOnLimitedConnection: true,
  });

  const got = new Promise<{ filename: string; content: string }>(
    (resolve, reject) => {
      stream.addEventListener("message", (evt: { data: unknown }) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(bytesOf(evt.data)));
          if (msg.error) reject(new Error(msg.error));
          else resolve(msg);
        } catch (e) {
          reject(e);
        }
      });
    },
  );
  stream.send(new TextEncoder().encode(JSON.stringify({ req: want })));
  console.log(`B requested "${want}" over the mesh`);

  const reply = await Promise.race([
    got,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("timeout")), 25000)
    ),
  ]);
  console.log(
    `✓ B received ${reply.content.length} bytes through relay.myc.md`,
  );

  const v = await verifyChord(reply.filename, reply.content);
  console.log(`\nverification (against committed registry x2F38):`);
  console.log(`  voice   : ${v.voice}`);
  console.log(`  verdict : ${v.why}`);

  await A.stop();
  await B.stop();
  console.log(
    v.ok
      ? `\n✅ AUTHENTIC CHORD FLOWED OVER THE MESH: an Ed25519-signed chord by ${v.voice} moved peer-to-peer through production relay.myc.md and verified against the trust spine.`
      : `\n✗ FAILED: ${v.why}`,
  );
  Deno.exit(v.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  Deno.exit(1);
});
