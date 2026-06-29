# Bring up a second mesh node (the two-node moment)

Goal: a _second machine_ exchanges signed chords with the first over the live
mesh — the first time the mesh spans two real participants instead of two
processes on one box.

## Robust path: store-and-forward (recommended)

Live peer-to-peer fetch (`serve`/`fetch`, below) is fragile over the Cloudflare
tunnel — relayed reservations don't persist (`NO_RESERVATION`). Content doesn't
need a live connection, so the relay **holds** it. From either machine:

```sh
cd trinity/omega
deno run --allow-net --allow-read --allow-env tools/mesh.ts push <chord-coord>  # offer a signed chord (relay verifies it)
deno run --allow-net --allow-read --allow-env tools/mesh.ts list                # what's in the relay store
deno run --allow-net --allow-read --allow-env tools/mesh.ts get  <chord-coord>  # pull + verify a chord
```

A node `push`es when it's up; another `get`s whenever it's up — async, verified
(the reader re-checks the Ed25519 signature against x2F38: trust the hash, not
the host). This is the recommended way two machines share chords today.

## Live path (experimental, in-window only)

## Prereqs

- `deno` and `node`/`npm` installed.
- GitHub access to **`s0fractal/genesis`** (omega is a private submodule of the
  public `s0fractal/trinity`). Without it the recursive clone can't fetch omega.

## Steps

```sh
# 1. clone the substrate with submodules (or update if already cloned)
git clone --recursive https://github.com/s0fractal/trinity.git
cd trinity/omega
#   (already cloned? → git submodule update --init --recursive, then cd omega)

# 2. install the libp2p deps EXACTLY as locked (node_modules is gitignored).
#   Use `npm ci`, NOT `npm install`: ci reproduces the committed package-lock
#   byte-for-byte, so this node gets the SAME @chainsafe/libp2p-noise (and its
#   chacha20poly1305 impl) as the origin node. `npm install` can resolve newer
#   versions whose noise hits node:crypto — the "Unknown cipher chacha20-poly1305"
#   that broke `push` on a mismatched node.
npm ci
#   if it errors building node_datachannel (native WebRTC, unused by the mesh
#   client), retry: npm ci --ignore-scripts
#   (if `npm ci` itself refuses, the lock is stale — fall back to
#    `npm install --legacy-peer-deps` and report it.)

# 3. join the mesh and serve this clone's chords — run it so it OUTLIVES the
#    session (a Claude/agent background process dies when the turn ends, which
#    drops the node off the mesh). Use a real terminal you leave open, or nohup:
nohup deno run --allow-net --allow-read --allow-env tools/mesh.ts serve > mesh-node.log 2>&1 &
#    then: tail -f mesh-node.log   (to read the peer id + keepalive lines)
```

`serve` keeps itself discoverable: it re-dials the relay whenever the connection
blips (a plain one-shot serve silently loses its relay reservation and vanishes
from the directory — the first bring-up hit exactly that). It must, however,
keep _running_ — if the process exits, the node leaves the mesh.

`serve` discovers the public relay from the membrane
(`myc.md/.well-known/omega-relay`), reserves a circuit slot on it, and serves
the repo's chords over `/omega/chord-sync/1.0.0`. It prints a line like:

```
serving local chords on the mesh as 12D3KooW...
```

That peer id is this node's identity on the mesh. **Report it back** (it
confirms the directory sees you), then leave the process running.

## What happens next (on the first node)

```sh
deno run --allow-net --allow-read --allow-env tools/mesh.ts peers
#   → should now list your peer id (discovered via the relay directory)

deno run --allow-net --allow-read --allow-env tools/mesh.ts fetch <chord-file>
#   → fetches the chord from your node THROUGH the relay and verifies its
#     Ed25519 content_sig against x2F38. A different peer id + a VALID signature
#     = authentic content crossed two machines and proved its author. That's the
#     moment the network becomes real.
```

## Keep it fresh

A node should serve current chords + run current code.
`sh ~/trinity/node-sync.sh` fetches + fast-forwards the clone (+ submodules) and
validates it (the post-merge hook type-checks the dispatcher; it never clobbers
local work). Put it on a timer — see `docs/NODE_SYNC.md` (trinity). After a sync
that touches `omega/package*`, re-run `npm ci`.

## Notes

- The mesh client is `tools/mesh.ts` (serve | peers | fetch | push | get |
  list). It only uses WebSockets + circuit-relay — no WebRTC, no native modules
  at runtime.
- Nothing is written or pushed by `serve`; it only reads + serves local chords.
- Optional first-contact: drop a new `*.myc.md` file into `../src/`
  (trinity/src) before `serve` and the first node can fetch _content authored on
  this machine_. (It won't carry a voice signature unless this node holds a
  registered voice key — those live only on the authoring machine. Signed
  cross-machine fetch uses the existing repo chords.)
