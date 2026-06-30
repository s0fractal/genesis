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
const n = await createLibp2p({
  transports: [webSockets(), circuitRelayTransport()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: { identify: identify() },
});
await n.start();
console.log(
  (await n.dial(
    multiaddr(
      "/dns4/relay.myc.md/tcp/443/wss/p2p/12D3KooWRd5JMPNTBfpAAyG4bs3V9VhiM7CvgHotdQx5UNCRLsDN",
    ),
  )).remotePeer.toString(),
);
```

## Use it (the mesh client)

`tools/mesh.ts` turns the relay into a usable content network — a node knows
only the membrane URL. **Store-and-forward is the recommended path** (robust,
async):

```
deno run -A tools/mesh.ts push <coord>   # offer a signed chord — the relay VERIFIES it before caching
deno run -A tools/mesh.ts get  <coord>   # pull a chord from the relay store + verify the signature
deno run -A tools/mesh.ts list           # what's cached in the relay store
```

A node `push`es when it's up; another `get`s whenever it's up — no simultaneous
live connection. The relay verifies the Ed25519 `content_sig` against `x2F38`
before caching, and the reader **re-verifies on get** (trust the hash, not the
host). The cross-machine loop is proven both ways — see chord `x3300_955963`.

Live peer-to-peer (`serve` / `peers` / `fetch`) also works, but is **fragile
over the Cloudflare tunnel**: circuit-relay reservations don't reliably persist
(`NO_RESERVATION`), so a live fetch can miss its window. Store-and-forward
exists precisely because content doesn't need a live connection. (A durable live
plane would want DCUtR hole-punching — not yet wired.)

## How it's wired

- **Relay node:** `omega/tools/mesh_relay_node.ts` (Deno). Persistent libp2p
  identity at `~/.trinity/keys/relay.libp2p.key` (0600, OUTSIDE the repo →
  stable peer id across restarts). Listens `127.0.0.1:9090/ws`. Noise uses
  `pureJsCrypto` (chacha20-poly1305 for any payload size on any Deno).
- **Content store:** `/omega/store`·`/omega/get`·`/omega/list` — a verified
  cache at `~/.omega-mesh-store` (env `OMEGA_STORE`), persisted across restarts;
  the relay verifies each chord's signature against `x2F38` before caching.
- **Directory:** `/omega/peers` reports the relay's **reservation set** (the
  peers reachable via `/p2p-circuit`), not `getConnections()` — the latter is
  blind to reserved peers.
- **HTTP gateway (browser path, Phase 1):** a plain-HTTP read surface beside the
  libp2p listener (`127.0.0.1:9091`) — `GET /mesh/list`,
  `GET /mesh/get/<coord>`, and the browser reader page at `/mesh/`
  (`omega/web/mesh.html`). cloudflared routes `relay.myc.md/mesh*` here (path
  rule) and `relay.myc.md/` to the ws. A browser fetches + **re-verifies** the
  Ed25519 signature itself (registry from an independent source), so the gateway
  is untrusted by design. Open **`https://relay.myc.md/mesh/`**. (chord
  x3300_955983)
- **WebRTC browser↔browser (browser path, Phase 3) — CONFIRMED.** `/mesh/signal`
  (WebSocket) is a dumb rendezvous: browsers join a room and the relay forwards
  SDP offers/answers + ICE; once WebRTC connects, a signed chord flows
  browser↔browser DIRECTLY (relay out of the data path) and the receiver
  verifies it. P2P page at `/mesh/p2p` (`omega/web/p2p.html`). **Proven** with a
  real Chrome and headless (`tools/browser_p2p_test.ts`, astral): connect +
  direct chord + VALID. Matchmaking is ghost-proof (live peers offer newcomers,
  dead sockets pruned); verification is native-Web-Crypto-first with a pure-JS
  noble fallback so any browser verifies. NB: this is **raw `RTCPeerConnection`
  in the page**, not `src/sdk/phi_client.ts` (that stub stays unused).
- **TURN fallback — BUILT, off by default.** `/mesh/turn-creds` mints
  short-lived Cloudflare Realtime TURN creds (key from env or 0600
  `~/.trinity/keys/cf-turn.json`, read per request) and the page merges them
  into ICE — needed only for hairpin-blocking/symmetric NAT (e.g. two tabs
  behind one no-hairpin router). With no key it degrades to **STUN-only**
  (`{"iceServers":[]}`). Deferred until a real cross-network user needs it
  (provisioning needs the CF Realtime product + a `Cloudflare Calls:Edit`
  token). Same-machine testing: disable Chrome's mDNS obfuscation
  (`chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` → Disabled) and two
  tabs connect directly with no TURN.
- **Tunnel:** Cloudflare named tunnel `omega-relay`
  (`6d6dd544-117b-40aa-9450-ffda7d17e524`), config
  `~/.cloudflared/omega-relay.yml`, **path-routed**: `relay.myc.md/mesh*` →
  `localhost:9091` (HTTP gateway), `relay.myc.md/` → `localhost:9090` (libp2p
  ws). DNS: CNAME `relay.myc.md` → tunnel.
- **Route carve-out:** a Workers route `relay.myc.md/*` with **no worker** (so
  the membrane's `*.myc.md/*` worker does NOT swallow it; traffic falls through
  to the tunnel). The membrane + FQDN subdomains are untouched.
- **Durability:** two launchd agents (RunAtLoad + KeepAlive):
  `com.s0fractal.omega-relay` (node) and `com.s0fractal.omega-relay-tunnel`.
  Logs: `~/.cloudflared/omega-relay.{node,tunnel}.log`.

## Resonance with the myc.md membrane

Same zone (`myc.md`): the membrane is **SEE** (content), the relay is
**CONNECT** (mesh). The membrane worker serves the relay multiaddr at
`https://myc.md/.well-known/omega-relay` (attested + test-locked), so a stranger
who pulls `myc.md` discovers where to dial the mesh — the SEE-membrane is the
mesh's bootstrap directory.

## Operate

- restart: `launchctl kickstart -k gui/$(id -u)/com.s0fractal.omega-relay`
- stop/remove:
  `launchctl unload ~/Library/LaunchAgents/com.s0fractal.omega-relay*.plist`
- delete tunnel: `cloudflared tunnel delete omega-relay`
- the deploy used a short-lived CF API token (Workers Routes edit) — **revoke
  it**.
