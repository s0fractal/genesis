#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-sys
// mesh_relay_node.ts — the production omega mesh relay (Phase 2).
//
// A long-running libp2p circuit-relay-v2 node with a STABLE identity (so its
// multiaddr is persistent across restarts) listening on ws. Front it with a
// `cloudflared` tunnel to get a public wss endpoint (free, no VPS) — see the
// printed runbook. The relay's multiaddr then goes into the myc.md membrane
// snapshot so peers discover it (chord x3300_955776). The relay only RELAYS —
// it carries no application logic, holds no keys but its own libp2p identity.
//
//   PORT=9090 deno run -A tools/mesh_relay_node.ts
//   cloudflared tunnel --url http://localhost:9090     # free quick tunnel, or a
//                                                        # named tunnel on relay.myc.md

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import {
  generateKeyPair,
  privateKeyFromProtobuf,
  privateKeyToProtobuf,
} from "@libp2p/crypto/keys";
import { dirname, join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { verifyChordFromSrc } from "../src/network/chord_verify.ts";

const PORT = Number(Deno.env.get("PORT") ?? "9090");
const HOME = Deno.env.get("HOME") ?? ".";
const KEY_PATH = join(HOME, ".trinity", "keys", "relay.libp2p.key");
// Verified content cache (store-and-forward). A node PUSHes a signed chord here
// in one short request; another GETs it later — no simultaneous live circuit
// reservations, so it sidesteps the NO_RESERVATION wall that killed live P2P
// fetch over the Cloudflare tunnel. Persists across relay restarts.
const STORE_DIR = Deno.env.get("OMEGA_STORE") ??
  join(HOME, ".omega-mesh-store");
const SRC = new URL("../../src/", import.meta.url); // trinity/src — the x2F38 registry
const safeName = (s: string) => String(s).replace(/[^a-zA-Z0-9._-]/g, "");

/** Load the relay's stable libp2p identity, or mint + persist one (0600). */
async function loadIdentity() {
  try {
    const b64 = (await Deno.readTextFile(KEY_PATH)).trim();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return privateKeyFromProtobuf(bytes);
  } catch {
    const pk = await generateKeyPair("Ed25519");
    const bytes = privateKeyToProtobuf(pk);
    let s = "";
    for (const x of bytes) s += String.fromCharCode(x);
    await Deno.mkdir(dirname(KEY_PATH), { recursive: true });
    await Deno.writeTextFile(KEY_PATH, btoa(s) + "\n", { mode: 0o600 });
    console.error(`# minted a new relay identity → ${KEY_PATH} (0600)`);
    return pk;
  }
}

const privateKey = await loadIdentity();
const node = await createLibp2p(
  {
    privateKey,
    addresses: { listen: [`/ip4/127.0.0.1/tcp/${PORT}/ws`] },
    transports: [webSockets()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      relay: circuitRelayServer({ reservations: { maxReservations: 256 } }),
    },
  } as Parameters<typeof createLibp2p>[0],
);

await node.start();

// Peer directory: any node reachable through this relay is connected to it, so
// the relay's connection list IS the directory. A peer asks "who's here?" and
// gets the current peer ids → constructs their circuit addrs → connects. This
// makes the mesh self-organizing with no hand-fed addresses. (Runs on the direct
// peer→relay connection, so it's not a "limited" relayed stream.)
// deno-lint-ignore no-explicit-any
await node.handle("/omega/peers/1.0.0", (arg: any) => {
  const s = arg?.stream ?? arg;
  s.addEventListener("message", () => {
    // The directory is the relay's RESERVATION set: a peer holding a circuit
    // slot is exactly one reachable via /p2p-circuit. getConnections() does NOT
    // reliably surface reservation-holding peers (it read ~empty even while
    // peers were reserved — the two-node bring-up exposed this), so enumerate
    // the relay service's reservations PeerMap instead.
    // deno-lint-ignore no-explicit-any
    const svc = (node.services as any).relay;
    const reserved: string[] = svc?.reservations
      ? [...svc.reservations.keys()].map((p: { toString(): string }) =>
        p.toString()
      )
      : [];
    const peers = [...new Set(reserved)];
    s.send(new TextEncoder().encode(JSON.stringify({ peers })));
  });
});

// ── store-and-forward content cache ──────────────────────────────────────────
await Deno.mkdir(STORE_DIR, { recursive: true });
// deno-lint-ignore no-explicit-any
const bytesOf = (d: any): Uint8Array =>
  d instanceof Uint8Array
    ? d
    : typeof d?.subarray === "function"
    ? d.subarray()
    : new Uint8Array(d);

// PUSH: a node offers a signed chord. The relay VERIFIES it against x2F38 before
// caching — junk and forgeries never enter the store ("trust the hash, not the
// host" still holds: the reader re-verifies on GET).
// deno-lint-ignore no-explicit-any
await node.handle("/omega/store/1.0.0", (arg: any) => {
  const s = arg?.stream ?? arg;
  s.addEventListener("message", async (evt: { data: unknown }) => {
    try {
      const { filename, content } = JSON.parse(
        new TextDecoder().decode(bytesOf(evt.data)),
      );
      const name = safeName(filename);
      const v = await verifyChordFromSrc(name, content, SRC);
      if (!v.ok) {
        s.send(
          new TextEncoder().encode(
            JSON.stringify({ ok: false, error: `rejected: ${v.reason}` }),
          ),
        );
        return;
      }
      await Deno.writeTextFile(join(STORE_DIR, name), content);
      console.log(
        `# [${new Date().toISOString()}] stored ${name} (signed by ${v.voice})`,
      );
      s.send(
        new TextEncoder().encode(
          JSON.stringify({ ok: true, verified: true, voice: v.voice }),
        ),
      );
    } catch (e) {
      s.send(
        new TextEncoder().encode(
          JSON.stringify({ ok: false, error: String(e) }),
        ),
      );
    }
  });
});

// GET: hand back a cached chord by coordinate (reader verifies the signature).
// deno-lint-ignore no-explicit-any
await node.handle("/omega/get/1.0.0", (arg: any) => {
  const s = arg?.stream ?? arg;
  s.addEventListener("message", async (evt: { data: unknown }) => {
    try {
      const { req } = JSON.parse(new TextDecoder().decode(bytesOf(evt.data)));
      const name = safeName(req);
      const content = await Deno.readTextFile(join(STORE_DIR, name));
      s.send(
        new TextEncoder().encode(JSON.stringify({ filename: name, content })),
      );
    } catch (e) {
      s.send(new TextEncoder().encode(JSON.stringify({ error: String(e) })));
    }
  });
});

// LIST: the coordinates currently cached.
// deno-lint-ignore no-explicit-any
await node.handle("/omega/list/1.0.0", (arg: any) => {
  const s = arg?.stream ?? arg;
  s.addEventListener("message", async () => {
    const coords: string[] = [];
    try {
      for await (const e of Deno.readDir(STORE_DIR)) {
        if (e.isFile) coords.push(e.name);
      }
    } catch { /* empty store */ }
    s.send(new TextEncoder().encode(JSON.stringify({ coords })));
  });
});

const id = node.peerId.toString();
console.log(`# omega mesh relay — LIVE`);
console.log(`peer id: ${id}`);
console.log(`listening:`);
for (const m of node.getMultiaddrs()) console.log(`  ${m.toString()}`);
console.log(`\n# expose publicly (free, no login):`);
console.log(`#   cloudflared tunnel --url http://localhost:${PORT}`);
console.log(`#   → public multiaddr: /dns4/<HOST>/tcp/443/wss/p2p/${id}`);
console.log(`# named (stable relay.myc.md, needs 'cloudflared tunnel login'):`);
console.log(`#   cloudflared tunnel route dns <tunnel> relay.myc.md`);
console.log(`#   → /dns4/relay.myc.md/tcp/443/wss/p2p/${id}`);
console.log(
  `\n# put that multiaddr in the myc.md membrane snapshot (relay_multiaddr).`,
);
console.log(`# relay running — Ctrl-C to stop.`);

// stay up; report reservation count periodically
setInterval(() => {
  // deno-lint-ignore no-explicit-any
  const svc = (node.services as any).relay;
  const n = svc?.reservations?.size ?? svc?.reservations?.length ?? "?";
  console.log(
    `# [${
      new Date().toISOString()
    }] peers=${node.getConnections().length} reservations=${n}`,
  );
}, 60_000);
