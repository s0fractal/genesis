#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// mesh_live_proof.ts — prove the omega mesh works against LIVE production infra.
//
// Unlike mesh_relay_proof.ts (a local relay), this:
//   1. DISCOVERS the relay from the membrane (myc.md/.well-known/omega-relay) —
//      the resonance in action: SEE-membrane → CONNECT-mesh.
//   2. stands up two fresh nodes, neither directly reachable, that BOTH connect
//      to the live relay.myc.md over wss through Cloudflare.
//   3. node B reaches node A THROUGH the live relay and exchanges a verified
//      Ed25519-signed frame.
// If this passes, the full path — discovery + NAT-traversed transport — is real
// end to end, not just locally. (Peer discovery here is bootstrapped by passing
// A's circuit addr to B; in the app that comes from the DHT/rendezvous — the
// next wiring step.)

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { multiaddr } from "@multiformats/multiaddr";

const PROTOCOL = "/omega/live-proof/1.0.0";
const MEMBRANE = "https://myc.md/.well-known/omega-relay";

// deno-lint-ignore no-explicit-any
async function mkPeer(listen: string[] = []): Promise<any> {
  return await createLibp2p(
    {
      addresses: { listen },
      transports: [webSockets(), circuitRelayTransport()],
      connectionEncrypters: [noise()],
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
  // 1. discover the relay from the membrane
  const RELAY = (await (await fetch(MEMBRANE)).text()).trim();
  console.log(`discovered relay from membrane: ${RELAY}`);
  if (!RELAY.includes("/p2p/")) {
    throw new Error("membrane did not return a relay multiaddr");
  }

  const kp = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]) as CryptoKeyPair;
  const pub = new Uint8Array(
    await crypto.subtle.exportKey("raw", kp.publicKey),
  );

  // 2a. node A: reserve a slot on the LIVE relay → reachable via a circuit addr
  const A = await mkPeer([`${RELAY}/p2p-circuit`]);
  await A.start();
  await A.dial(multiaddr(RELAY));
  console.log(
    `A (${A.peerId.toString()}) connected to the live relay, reserving…`,
  );
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
  console.log(`✓ A reachable through the live relay at:\n  ${aCircuit}`);

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
    }, { runOnLimitedConnection: true });
  });

  // 2b. node B: dial A THROUGH the live relay
  const B = await mkPeer();
  await B.start();
  await B.dial(multiaddr(RELAY)); // warm a path to the relay first
  // deno-lint-ignore no-explicit-any
  const stream: any = await B.dialProtocol(multiaddr(aCircuit), PROTOCOL, {
    runOnLimitedConnection: true,
  });
  console.log(`✓ B (${B.peerId.toString()}) reached A THROUGH the live relay`);

  const claim = `omega-live-proof:${A.peerId.toString()}:via:relay.myc.md`;
  const sig = await crypto.subtle.sign(
    "Ed25519",
    kp.privateKey,
    new TextEncoder().encode(claim),
  );
  await stream.send(
    new TextEncoder().encode(JSON.stringify({ claim, sig: b64(sig) })),
  );
  console.log(
    `✓ B sent a signed frame over the relayed (production) connection`,
  );

  await Promise.race([
    got,
    new Promise<void>((_, rej) =>
      setTimeout(
        () =>
          rej(new Error("timeout: frame never arrived through the live relay")),
        25000,
      )
    ),
  ]);

  console.log(`\nresult:`);
  console.log(`  received through live relay : ${received.ok}`);
  console.log(`  signature verified         : ${received.verified}`);
  await A.stop();
  await B.stop();
  const pass = received.ok && received.verified;
  console.log(
    pass
      ? `\n✅ LIVE MESH PROVEN: relay discovered from the membrane; two NAT-bound peers exchanged a verified frame through relay.myc.md in production.`
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
