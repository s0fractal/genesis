import { executeNeuron, parseTissueFromMarkdown } from "./quine.ts";

async function main() {
  console.log("=== OMEGA-64 | Σ³ ATOMIC PULSE TEST ===");
  
  const Tissue = await parseTissueFromMarkdown("./I.md");

  console.log("Before atomic pulse:");
  console.log("Expr (fast_abs):", typeof Tissue.fast_abs.expr.body === "string" ? Tissue.fast_abs.expr.body : JSON.stringify(Tissue.fast_abs.expr.body));
  
  console.log("Tissue History Pointer:", Tissue.tissue_history.expr.body);
  
  const operations = [
    {
      alias: "mutate_ir",
      args: {
        targetAlias: "fast_abs",
        path: ["body", "args", 1, "value"],
        newValue: 8
      }
    },
    {
      alias: "mutate_ir",
      args: {
        targetAlias: "fast_abs",
        path: ["body", "args", 1, "value"],
        newValue: 16
      }
    }
  ];

  console.log("\nActivating meta_fn: atomic_pulse...");
  const result: any = await executeNeuron(Tissue, "atomic_pulse", {
    state: Tissue,
    operations,
    executeNeuron
  });

  if (!result.success) {
    console.error("Pulse failed:", result.error);
    return;
  }

  console.log("\nPulse Success:", result.success);
  console.log("Epoch Log size:", result.log.length);
  
  console.log("\nAfter atomic pulse:");
  console.log("Expr (fast_abs):", JSON.stringify(result.next.fast_abs.expr.body));
  
  console.log("Tissue History Pointer:", result.next.tissue_history.expr.body);

  console.log("\nActivating meta_fn: rust_compiler_bridge...");
  await executeNeuron(result.next, "rust_compiler_bridge", {
    nodeAlias: "fast_abs",
    state: result.next
  });

  console.log("\nActivating meta_fn: flush_state_to_disk...");
  await executeNeuron(result.next, "flush_state_to_disk", {
    nextState: result.next,
    targetFile: "./I.md"
  });
  
  console.log("Done! Check I.md.");
}

if (import.meta.main) {
  main();
}
