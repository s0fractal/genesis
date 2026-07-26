// Bootstraps the local OMEGA-64 web node (vite dev server).
//
// Historical note: this used to also spawn `tools/webrtc_signal.ts`, a
// standalone WebRTC signalling server. That file was removed in the libp2p
// migration (commit 52116b2) — peer discovery/signalling now goes through the
// libp2p mesh and the relay (relay.myc.md), so no local signalling daemon is
// needed. Spawning it made `deno task start` fail; that is fixed here.
import { spawn } from "node:child_process";

console.log("🌌 [OMEGA-64] Bootstrapping web node (vite)…");

const vite = spawn("npx", ["vite"], { stdio: "inherit" });

Deno.addSignalListener("SIGINT", () => {
  console.log("\n[OMEGA-64] Graceful shutdown sequence initiated…");
  vite.kill();
  Deno.exit(0);
});
