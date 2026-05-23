import { spawn } from "node:child_process";

console.log("🌌 [OMEGA-64] Bootstrapping Unified Genesis Node...");

const signal = spawn("deno", ["run", "-A", "tools/webrtc_signal.ts"], {
  stdio: "inherit",
});
const vite = spawn("npx", ["vite"], { stdio: "inherit" });

Deno.addSignalListener("SIGINT", () => {
  console.log("\n[OMEGA-64] Graceful shutdown sequence initiated...");
  signal.kill();
  vite.kill();
  Deno.exit(0);
});
