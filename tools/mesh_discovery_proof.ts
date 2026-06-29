#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// mesh_discovery_proof.ts — the mesh becomes self-organizing. node B is told
// NOTHING about node A; it discovers A through the relay's peer directory
// (/omega/peers), constructs A's circuit address, connects, fetches a chord, and
// verifies it. Two known nodes → an open swarm. (chord x3300_955780 → discovery.)
//
//   deno run --allow-net --allow-read --allow-env tools/mesh_discovery_proof.ts

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise, pureJsCrypto } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { multiaddr } from "@multiformats/multiaddr";

const MEMBRANE = "https://myc.md/.well-known/omega-relay";
const SRC = new URL("../../src/", import.meta.url);
const CHORD =
  "x3300_955780_claude_authentic-chord-flows-over-live-mesh-content-meets-trust-spine.myc.md";
const CHORD_SYNC = "/omega/chord-sync/1.0.0";
const PEERS = "/omega/peers/1.0.0";

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
const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// one-shot request→reply over a message stream
// deno-lint-ignore no-explicit-any
function ask(stream: any, payload: unknown, timeoutMs = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ask timeout")), timeoutMs);
    stream.addEventListener("message", (evt: { data: unknown }) => {
      clearTimeout(t);
      try {
        resolve(JSON.parse(new TextDecoder().decode(bytesOf(evt.data))));
      } catch (e) {
        reject(e);
      }
    });
    stream.send(enc(payload));
  });
}

async function verifyChord(filename: string, full: string): Promise<boolean> {
  const fm = full.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const voice = fm.match(/content_sig:[\s\S]*?\n\s+voice:\s*(\S+)/)?.[1];
  const pinned = fm.match(/content_sig:[\s\S]*?\n\s+payload:\s*"([^"]+)"/)?.[1];
  const sig = fm.match(/content_sig:[\s\S]*?\n\s+sig:\s*"([^"]+)"/)?.[1];
  if (!voice || !pinned || !sig) return false;
  const body = full.slice(
    full.match(/^---\n[\s\S]*?\n---\n?/)?.[0].length ?? 0,
  );
  const d = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${filename}\n${body}`),
  );
  const recomputed = "sha256:" +
    Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  if (recomputed !== pinned) return false;
  const reg = JSON.parse(
    await Deno.readTextFile(new URL("x2F38_voice_pubkeys.json", SRC)),
  );
  const pub = reg.keys?.[voice]?.pubkey;
  if (!pub) return false;
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
    new TextEncoder().encode(pinned),
  );
}

async function main() {
  const RELAY = (await (await fetch(MEMBRANE)).text()).trim();
  const relayId = RELAY.split("/p2p/")[1];
  console.log(`relay (from membrane): …${relayId.slice(-8)}`);

  // node A — joins the mesh + serves chords. Tells no one its address.
  const A = await mkPeer([`${RELAY}/p2p-circuit`]);
  await A.start();
  await A.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  A.handle(CHORD_SYNC, (arg: any) => {
    const s = arg?.stream ?? arg;
    s.addEventListener("message", async (evt: { data: unknown }) => {
      try {
        const { req } = JSON.parse(new TextDecoder().decode(bytesOf(evt.data)));
        const name = req.replace(/[^a-zA-Z0-9._-]/g, "");
        s.send(
          enc({
            filename: name,
            content: await Deno.readTextFile(new URL(name, SRC)),
          }),
        );
      } catch (e) {
        s.send(enc({ error: String(e) }));
      }
    });
  }, { runOnLimitedConnection: true });
  // wait for A's reservation so it is reachable + visible in the directory
  for (let i = 0; i < 60; i++) {
    if (
      A.getMultiaddrs().some((m: { toString(): string }) =>
        m.toString().includes("/p2p-circuit")
      )
    ) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(
    `A (…${A.peerId.toString().slice(-8)}) joined the mesh, serving chords`,
  );

  // node B — knows ONLY the relay. Discovers peers, then fetches a chord.
  const B = await mkPeer();
  await B.start();
  await B.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  const dirStream: any = await B.dialProtocol(multiaddr(RELAY), PEERS);
  const { peers } = await ask(dirStream, { q: "who" });
  const candidates = (peers as string[]).filter((p) =>
    p !== B.peerId.toString() && p !== relayId
  );
  console.log(
    `B asked the relay directory → discovered ${candidates.length} peer(s): ${
      candidates.map((p) => "…" + p.slice(-8)).join(", ")
    }`,
  );
  if (!candidates.length) {
    throw new Error("directory returned no peers — discovery failed");
  }

  // B tries each discovered peer (it was told none of their addresses) until one serves the chord
  let ok = false, from = "";
  for (const peerId of candidates) {
    try {
      const addr = `${RELAY}/p2p-circuit/p2p/${peerId}`;
      // deno-lint-ignore no-explicit-any
      const s: any = await B.dialProtocol(multiaddr(addr), CHORD_SYNC, {
        runOnLimitedConnection: true,
      });
      const reply = await ask(s, { req: CHORD });
      if (reply.error) continue;
      ok = await verifyChord(reply.filename, reply.content);
      if (ok) {
        from = peerId;
        break;
      }
    } catch { /* try next */ }
  }

  await A.stop();
  await B.stop();
  console.log(`\nresult: discovered + fetched + verified = ${ok}`);
  console.log(
    ok
      ? `\n✅ SELF-ORGANIZING MESH: B knew only the relay, discovered peer …${
        from.slice(-8)
      } via the directory, fetched a chord with no hand-fed address, and verified it against the trust spine.`
      : `\n✗ FAILED: discovery or verification did not complete`,
  );
  Deno.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  Deno.exit(1);
});
