import { parseTissueFromMarkdown } from "../src/quine.ts";
import { runEpoch } from "../src/temporal_scheduler.ts";

async function main() {
    console.log("=== OMEGA-64 | Ontology 8.0: Temporal Engine ===");
    console.log("[Boot] Parsing Tissue from I.md...");
    const state = await parseTissueFromMarkdown("./I.md");

    // Manually inject some temporal frequencies for the test if not present
    for (const [id, node] of Object.entries(state)) {
      if (!node.physics.temporal) {
          // Faster nodes have lower energy cost
          const f = Math.max(1, Math.floor(100 / (node.physics.energy_cost || 10)));
          node.physics.temporal = { frequency: f, phase: 0 };
          console.log(`[Init] ${id}: Frequency set to ${f} Hz`);
      }
    }

    const TICKS = 50;
    console.log(`\n[Execution] Starting Chronosphere for ${TICKS} Ticks...\n`);

    // We pass a mock trigger function to observe Firings
    runEpoch(state, TICKS, (nodeId) => {
        console.log(`[FIRE] 🔥 Neuron <${nodeId}> executed!`);
    });

    console.log("\n[Execution] Finished. Final Phase States:");
    for (const [id, node] of Object.entries(state)) {
        console.log(`- ${id}: Phase ${node.physics.temporal!.phase.toFixed(2)}`);
    }
}

if (import.meta.main) {
    main().catch(console.error);
}
