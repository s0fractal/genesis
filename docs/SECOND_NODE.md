# Bring up a second mesh node (the two-node moment)

Goal: a *second machine* joins the live omega mesh and serves the substrate's
signed chords, so the first node can fetch one **across the network** and verify
its signature — the first time the mesh spans two real participants instead of
two processes on one box.

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

# 2. install the libp2p deps (node_modules is gitignored)
npm install --legacy-peer-deps
#   if it errors building node_datachannel (native, for WebRTC which the mesh
#   client does NOT use), retry: npm install --legacy-peer-deps --ignore-scripts

# 3. join the mesh and serve this clone's chords (stays up — leave it running)
deno run --allow-net --allow-read --allow-env tools/mesh.ts serve
```

`serve` discovers the public relay from the membrane
(`myc.md/.well-known/omega-relay`), reserves a circuit slot on it, and serves the
repo's chords over `/omega/chord-sync/1.0.0`. It prints a line like:

```
serving local chords on the mesh as 12D3KooW...
```

That peer id is this node's identity on the mesh. **Report it back** (it confirms
the directory sees you), then leave the process running.

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

## Notes

- The mesh client is `tools/mesh.ts` (serve | peers | fetch). It only uses
  WebSockets + circuit-relay — no WebRTC, no native modules at runtime.
- Nothing is written or pushed by `serve`; it only reads + serves local chords.
- Optional first-contact: drop a new `*.myc.md` file into `../src/` (trinity/src)
  before `serve` and the first node can fetch *content authored on this machine*.
  (It won't carry a voice signature unless this node holds a registered voice
  key — those live only on the authoring machine. Signed cross-machine fetch uses
  the existing repo chords.)
