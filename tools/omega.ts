#!/usr/bin/env -S deno run -A
// 🌌 OMEGA-64: CLI Operator Lens
// This is the primary macro-operator interface for the OMEGA-64 swarm.
// Usage: ./tools/omega.ts [command]

async function runCmd(cmd: string[]) {
  console.log(`\n%c[OMEGA-64] Executing: ${cmd.join(" ")}`, "color: cyan");
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await command.output();
  if (code !== 0) {
    console.error(`%c[OMEGA-64] Command failed with exit code ${code}`, "color: red");
    Deno.exit(code);
  }
}

const args = Deno.args;
if (args.length === 0) {
  console.log(`
🌌 OMEGA-64 Operator CLI 🌌

Commands:
  test      - Run full verification (Rust core tests + Deno/WGSL parity tests)
  export    - Generate a snapshot of the current state via export_omega.ts
  task      - (WIP) Task ontology management
  court     - (WIP) Inspect SubstrateCourt isolation receipts
  fmt       - Run cargo fmt and deno fmt
`);
  Deno.exit(0);
}

const command = args[0];

switch (command) {
  case "test":
    console.log("%c🌌 OMEGA-64 Resonance Verification Sequence...", "color: magenta; font-weight: bold");
    await runCmd(["cargo", "test", "-p", "omega_v2"]);
    await runCmd(["deno", "test", "-A"]);
    console.log("%c✅ All invariants hold. Zero drift.", "color: green; font-weight: bold");
    break;

  case "export":
    await runCmd(["deno", "run", "-A", "tools/export_omega.ts"]);
    break;

  case "fmt":
    await runCmd(["cargo", "fmt"]);
    await runCmd(["deno", "fmt"]);
    break;

  case "task":
    console.log("Task management requires semantic payloads. To be implemented in Era 2110.");
    break;
    
  case "court":
    console.log("SubstrateCourt reading will scan logs/receipts. To be implemented in Era 2110.");
    break;

  default:
    console.error(`%c[ERROR] Unknown command: ${command}`, "color: red");
    Deno.exit(1);
}
