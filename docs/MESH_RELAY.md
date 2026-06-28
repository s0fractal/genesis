# Omega mesh relay — deployment record (LIVE 2026-06-28)

The public libp2p `circuit-relay-v2` relay for the omega mesh. Lets peers behind
NAT (browsers, home machines) reach each other through one well-known node.

## Live endpoint

```
/dns4/relay.myc.md/tcp/443/wss/p2p/12D3KooWRd5JMPNTBfpAAyG4bs3V9VhiM7CvgHotdQx5UNCRLsDN
```

Verify (a fresh libp2p peer dials it over wss through Cloudflare):

```ts
// deno run --allow-net --allow-read --allow-env
import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { multiaddr } from "@multiformats/multiaddr";
const n = await createLibp2p({ transports:[webSockets(), circuitRelayTransport()],
  connectionEncrypters:[noise()], streamMuxers:[yamux()],
  services:{identify:identify()} });
await n.start();
console.log((await n.dial(multiaddr("/dns4/relay.myc.md/tcp/443/wss/p2p/12D3KooWRd5JMPNTBfpAAyG4bs3V9VhiM7CvgHotdQx5UNCRLsDN"))).remotePeer.toString());
```

## Use it (the mesh client)

`tools/mesh.ts` turns the relay into a usable content network — a node knows only
the membrane URL:

```
deno run -A tools/mesh.ts serve          # join, serve your local chords (stay up)
deno run -A tools/mesh.ts peers          # who is on the mesh right now
deno run -A tools/mesh.ts fetch <coord>  # discover a peer, fetch + verify a chord
```

`fetch` discovers a serving peer from the relay directory (no hand-fed address),
pulls the chord through the relay, and **verifies its Ed25519 `content_sig`
against the committed registry `x2F38`** before printing it — trust the
signature, not the host. (One-shot request/response; a standing gossipsub data
plane would want DCUtR hole-punching, not yet wired.)

## How it's wired

- **Relay node:** `omega/tools/mesh_relay_node.ts` (Deno). Persistent libp2p
  identity at `~/.trinity/keys/relay.libp2p.key` (0600, OUTSIDE the repo → stable
  peer id across restarts). Listens `127.0.0.1:9090/ws`.
- **Tunnel:** Cloudflare named tunnel `omega-relay`
  (`6d6dd544-117b-40aa-9450-ffda7d17e524`), config `~/.cloudflared/omega-relay.yml`
  (ingress `relay.myc.md → http://localhost:9090`). DNS: CNAME `relay.myc.md` →
  tunnel.
- **Route carve-out:** a Workers route `relay.myc.md/*` with **no worker** (so
  the membrane's `*.myc.md/*` worker does NOT swallow it; traffic falls through
  to the tunnel). The membrane + FQDN subdomains are untouched.
- **Durability:** two launchd agents (RunAtLoad + KeepAlive):
  `com.s0fractal.omega-relay` (node) and `com.s0fractal.omega-relay-tunnel`.
  Logs: `~/.cloudflared/omega-relay.{node,tunnel}.log`.

## Resonance with the myc.md membrane

Same zone (`myc.md`): the membrane is **SEE** (content), the relay is **CONNECT**
(mesh). The relay multiaddr above is published in the membrane snapshot
(`relay_multiaddr`) so a stranger who pulls `myc.md` discovers where to dial the
mesh — the SEE-membrane is the mesh's bootstrap directory.

## Operate

- restart: `launchctl kickstart -k gui/$(id -u)/com.s0fractal.omega-relay`
- stop/remove: `launchctl unload ~/Library/LaunchAgents/com.s0fractal.omega-relay*.plist`
- delete tunnel: `cloudflared tunnel delete omega-relay`
- the deploy used a short-lived CF API token (Workers Routes edit) — **revoke it**.
