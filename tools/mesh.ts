#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// mesh.ts — the omega mesh client. Turns the proven pieces (live relay +
// directory + chord-sync + signature verification) into one usable tool.
//
//   deno run -A tools/mesh.ts serve            # join the mesh, serve local chords (stay up)
//   deno run -A tools/mesh.ts peers            # who is on the mesh right now
//   deno run -A tools/mesh.ts fetch <coord>    # discover a peer, fetch + verify a chord
//
// Relay is discovered from the membrane (myc.md/.well-known/omega-relay), so the
// only thing a node needs to know is the membrane URL. Content is verified
// against the committed voice registry (x2F38) — trust the signature, not the host.

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { multiaddr } from "@multiformats/multiaddr";

const MEMBRANE = Deno.env.get("OMEGA_MEMBRANE") ?? "https://myc.md/.well-known/omega-relay";
const SRC = new URL("../../src/", import.meta.url); // trinity/src — local chords
const CHORD_SYNC = "/omega/chord-sync/1.0.0";
const PEERS = "/omega/peers/1.0.0";

// deno-lint-ignore no-explicit-any
async function mkPeer(listen: string[] = []): Promise<any> {
  return await createLibp2p({
    addresses: { listen },
    transports: [webSockets(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: { identify: identify() },
    connectionGater: { denyDialMultiaddr: () => false },
  } as Parameters<typeof createLibp2p>[0]);
}
// deno-lint-ignore no-explicit-any
const bytesOf = (d: any): Uint8Array =>
  d instanceof Uint8Array ? d : typeof d?.subarray === "function" ? d.subarray() : new Uint8Array(d);
const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// deno-lint-ignore no-explicit-any
function ask(stream: any, payload: unknown, timeoutMs = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
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
async function getRelay(): Promise<string> {
  const r = (await (await fetch(MEMBRANE)).text()).trim();
  if (!r.includes("/p2p/")) throw new Error(`membrane returned no relay: ${r}`);
  return r;
}
/** Verify a chord's Ed25519 content_sig against x2F38 (mirror of src/x2F37). */
export async function verifyChord(filename: string, full: string): Promise<{ ok: boolean; voice?: string }> {
  const fm = full.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const voice = fm.match(/content_sig:[\s\S]*?\n\s+voice:\s*(\S+)/)?.[1];
  const pinned = fm.match(/content_sig:[\s\S]*?\n\s+payload:\s*"([^"]+)"/)?.[1];
  const sig = fm.match(/content_sig:[\s\S]*?\n\s+sig:\s*"([^"]+)"/)?.[1];
  if (!voice || !pinned || !sig) return { ok: false };
  const body = full.slice(full.match(/^---\n[\s\S]*?\n---\n?/)?.[0].length ?? 0);
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${filename}\n${body}`));
  const recomputed = "sha256:" + Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (recomputed !== pinned) return { ok: false, voice };
  const reg = JSON.parse(await Deno.readTextFile(new URL("x2F38_voice_pubkeys.json", SRC)));
  const pub = reg.keys?.[voice]?.pubkey;
  if (!pub) return { ok: false, voice };
  const key = await crypto.subtle.importKey("raw", unb64(pub), "Ed25519", false, ["verify"]);
  const ok = await crypto.subtle.verify("Ed25519", key, unb64(sig), new TextEncoder().encode(pinned));
  return { ok, voice };
}

async function serve() {
  const RELAY = await getRelay();
  const node = await mkPeer([`${RELAY}/p2p-circuit`]);
  await node.start();
  await node.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  node.handle(CHORD_SYNC, (arg: any) => {
    const s = arg?.stream ?? arg;
    s.addEventListener("message", async (evt: { data: unknown }) => {
      try {
        const { req } = JSON.parse(new TextDecoder().decode(bytesOf(evt.data)));
        const name = String(req).replace(/[^a-zA-Z0-9._-]/g, "");
        s.send(enc({ filename: name, content: await Deno.readTextFile(new URL(name, SRC)) }));
      } catch (e) {
        s.send(enc({ error: String(e) }));
      }
    });
  }, { runOnLimitedConnection: true });
  for (let i = 0; i < 60; i++) {
    if (node.getMultiaddrs().some((m: { toString(): string }) => m.toString().includes("/p2p-circuit"))) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`serving local chords on the mesh as ${node.peerId.toString()}`);
  console.log(`(discoverable via the relay directory — Ctrl-C to leave)`);

  // Keepalive: a plain serve loses its relay reservation if the connection
  // blips, and then silently vanishes from the directory. Re-dial the relay
  // whenever we're not connected to it, so the node STAYS discoverable. (The
  // two-node bring-up surfaced exactly this: discovery worked once, then the
  // node dropped off.) Also log presence so an operator can see it's alive.
  const relayId = RELAY.split("/p2p/")[1];
  // deno-lint-ignore no-explicit-any
  const connectedToRelay = () =>
    node.getConnections().some((c: any) => c.remotePeer.toString() === relayId);
  setInterval(async () => {
    if (!connectedToRelay()) {
      try {
        await node.dial(multiaddr(RELAY));
        console.error(`# [${new Date().toISOString()}] re-dialed relay (reservation refreshed)`);
      } catch (e) {
        console.error(`# [${new Date().toISOString()}] relay re-dial failed: ${String(e)}`);
      }
    }
  }, 15000);
}

async function peers() {
  const RELAY = await getRelay();
  const relayId = RELAY.split("/p2p/")[1];
  const node = await mkPeer();
  await node.start();
  await node.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  const s: any = await node.dialProtocol(multiaddr(RELAY), PEERS);
  const { peers } = await ask(s, { q: "who" });
  const others = (peers as string[]).filter((p) => p !== node.peerId.toString() && p !== relayId);
  console.log(`${others.length} peer(s) on the mesh:`);
  for (const p of others) console.log(`  ${p}`);
  await node.stop();
  Deno.exit(0);
}

async function fetchChord(coord: string) {
  const RELAY = await getRelay();
  const relayId = RELAY.split("/p2p/")[1];
  const node = await mkPeer();
  await node.start();
  await node.dial(multiaddr(RELAY));
  // deno-lint-ignore no-explicit-any
  const dir: any = await node.dialProtocol(multiaddr(RELAY), PEERS);
  const { peers } = await ask(dir, { q: "who" });
  const candidates = (peers as string[]).filter((p) => p !== node.peerId.toString() && p !== relayId);
  for (const peerId of candidates) {
    try {
      // deno-lint-ignore no-explicit-any
      const s: any = await node.dialProtocol(
        multiaddr(`${RELAY}/p2p-circuit/p2p/${peerId}`),
        CHORD_SYNC,
        { runOnLimitedConnection: true },
      );
      const reply = await ask(s, { req: coord });
      if (reply.error) continue;
      const v = await verifyChord(reply.filename, reply.content);
      console.error(`# fetched ${reply.filename} from …${peerId.slice(-8)} — signature ${v.ok ? `VALID (${v.voice})` : "INVALID"}`);
      if (v.ok) {
        console.log(reply.content);
        await node.stop();
        Deno.exit(0);
      }
    } catch { /* next peer */ }
  }
  console.error(`# no peer served a verifiable "${coord}" (${candidates.length} peer(s) tried)`);
  await node.stop();
  Deno.exit(1);
}

const [cmd, arg] = Deno.args;
if (cmd === "serve") await serve();
else if (cmd === "peers") await peers();
else if (cmd === "fetch" && arg) await fetchChord(arg);
else {
  console.error("usage: mesh.ts serve | peers | fetch <coordinate>");
  Deno.exit(2);
}
