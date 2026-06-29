#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// mesh_relay_proof.ts — Phase 2 dry-run (chord x3300_955776): prove a libp2p
// circuit-relay-v2 actually relays a connection between two peers, locally, with
// NO deployment. This is the relay's "signet dry-run": if it works here, the
// only thing left for real Phase 2 is hosting the relay (cloudflared) — the code
// is proven. Peer A is reachable ONLY via the relay (no direct listen); B dials
// A through the relay and exchanges a verified Ed25519-signed frame.

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise, pureJsCrypto } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import {
  circuitRelayServer,
  circuitRelayTransport,
} from "@libp2p/circuit-relay-v2";
import { multiaddr } from "@multiformats/multiaddr";

const PROTOCOL = "/omega/relay-proof/1.0.0";
const wsAll = webSockets({ filter: (mas: unknown[]) => mas });

// deno-lint-ignore no-explicit-any
async function mkRelay(listen: string): Promise<any> {
  return await createLibp2p(
    {
      addresses: { listen: [listen] },
      transports: [wsAll],
      connectionEncrypters: [noise({ crypto: pureJsCrypto })],
      streamMuxers: [yamux()],
      services: {
        identify: identify(),
        relay: circuitRelayServer(), // <- the relay server
      },
      connectionGater: { denyDialMultiaddr: () => false },
    } as Parameters<typeof createLibp2p>[0],
  );
}

// deno-lint-ignore no-explicit-any
async function mkPeer(listen: string[] = []): Promise<any> {
  return await createLibp2p(
    {
      addresses: { listen },
      transports: [wsAll, circuitRelayTransport()],
      connectionEncrypters: [noise({ crypto: pureJsCrypto })],
      streamMuxers: [yamux()],
      services: { identify: identify() },
      connectionGater: { denyDialMultiaddr: () => false },
    } as Parameters<typeof createLibp2p>[0],
  );
}

const b64 = (u: ArrayBuffer | Uint8Array) => {
  const a = u instanceof Uint8Array ? u : new Uint8Array(u);
  let s = "";
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
};
// deno-lint-ignore no-explicit-any
const bytesOf = (d: any): Uint8Array =>
  d instanceof Uint8Array
    ? d
    : typeof d?.subarray === "function"
    ? d.subarray()
    : new Uint8Array(d);

async function main() {
  const kp = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]) as CryptoKeyPair;
  const pub = new Uint8Array(
    await crypto.subtle.exportKey("raw", kp.publicKey),
  );

  const R = await mkRelay("/ip4/127.0.0.1/tcp/0/ws");
  await R.start();
  const rAddr = R.getMultiaddrs().map((m: { toString(): string }) =>
    m.toString()
  )
    .find((s: string) => s.includes("/ws"));
  console.log(`relay R: ${R.peerId.toString()}  ${rAddr}`);

  // Peer A: NO direct listen — reachable only by reserving a slot on the relay.
  const A = await mkPeer([`${rAddr}/p2p-circuit`]);
  await A.start();
  await A.dial(multiaddr(rAddr)); // connect to relay → triggers reservation
  console.log(
    `peer  A: ${A.peerId.toString()} (dialed relay, reserving a slot)`,
  );

  // wait for A's circuit reservation to appear in its advertised addresses
  let aCircuit: string | undefined;
  for (let i = 0; i < 40; i++) {
    aCircuit = A.getMultiaddrs().map((m: { toString(): string }) =>
      m.toString()
    )
      .find((s: string) => s.includes("/p2p-circuit"));
    if (aCircuit) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!aCircuit) {
    aCircuit = `${rAddr}/p2p-circuit/p2p/${A.peerId.toString()}`;
    console.log(
      `(no advertised circuit addr; falling back to constructed one)`,
    );
  }
  console.log(`✓ A reachable via relay at: ${aCircuit}`);

  // A handles the protocol; receiver verifies the signed frame
  const received = { ok: false, verified: false };
  const got = new Promise<void>((resolve) => {
    // deno-lint-ignore no-explicit-any
    A.handle(PROTOCOL, (arg: any) => {
      const s = arg?.stream ?? arg;
      s.addEventListener("message", async (evt: { data: unknown }) => {
        received.ok = true;
        try {
          const msg = JSON.parse(new TextDecoder().decode(bytesOf(evt.data)));
          const sig = Uint8Array.from(atob(msg.sig), (c) => c.charCodeAt(0));
          const key = await crypto.subtle.importKey(
            "raw",
            pub,
            "Ed25519",
            false,
            ["verify"],
          );
          received.verified = await crypto.subtle.verify(
            "Ed25519",
            key,
            sig,
            new TextEncoder().encode(msg.claim),
          );
        } catch { /* verified stays false */ }
        resolve();
      });
    }, { runOnLimitedConnection: true }); // relayed conns are "limited" in v2
  });

  // Peer B dials A THROUGH the relay (the whole point)
  const B = await mkPeer();
  await B.start();
  // deno-lint-ignore no-explicit-any
  const stream: any = await B.dialProtocol(multiaddr(aCircuit), PROTOCOL, {
    runOnLimitedConnection: true,
  });
  console.log(`✓ B dialed A THROUGH the relay and opened ${PROTOCOL}`);

  const claim =
    `omega-relay-proof:${A.peerId.toString()}:via:${R.peerId.toString()}`;
  const sig = await crypto.subtle.sign(
    "Ed25519",
    kp.privateKey,
    new TextEncoder().encode(claim),
  );
  await stream.send(
    new TextEncoder().encode(JSON.stringify({ claim, sig: b64(sig) })),
  );
  console.log(`✓ B sent a signed frame to A over the relayed connection`);

  await Promise.race([
    got,
    new Promise<void>((_, rej) =>
      setTimeout(
        () => rej(new Error("timeout: A never received the relayed frame")),
        15000,
      )
    ),
  ]);

  console.log(`\nresult:`);
  console.log(`  A received frame via relay : ${received.ok}`);
  console.log(`  signature verified by A    : ${received.verified}`);
  await A.stop();
  await B.stop();
  await R.stop();
  const pass = received.ok && received.verified;
  console.log(
    pass
      ? `\n✅ RELAY PROVEN: B reached A through a libp2p circuit-relay-v2, signed frame verified. Only hosting (cloudflared) remains for Phase 2.`
      : `\n✗ FAILED: ${
        received.ok ? "received but signature invalid" : "frame not relayed"
      }`,
  );
  Deno.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  Deno.exit(1);
});
