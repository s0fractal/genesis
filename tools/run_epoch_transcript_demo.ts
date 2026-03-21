import { flushEpochBinary } from "../src/ontology/epoch_dumper.ts";
import { analyzeEpochDumps } from "../src/ontology/analyze_epoch.ts";
import { PlasmidRegistry, parseLambda } from "../src/compiler/pure_lambda.ts";

async function main() {
    console.log("=== OMEGA-64 Epoch Transcript Generator Demo ===\n");
    
    // Seed initial life into the registry
    const t1 = parseLambda("S(K(I))");
    PlasmidRegistry.set(1234n, {
        ast: t1, attention: 100, energy: 50000, age: 50, fitness: 12, l1_cost: 4, mutualists: new Set(), nodes: 3, depth: 3
    });
    
    // Dump Epoch 1
    console.log("Generating Epoch 1 Dump...");
    const dump1 = await flushEpochBinary(1000, 60000, 2.5, "0", 1200);
    
    // Simulate 1000 ticks of evolution: Energy changes + New mutation
    console.log("Simulating 1000 ticks of physical biological decay and mutations...");
    const t1_mutated = PlasmidRegistry.get(1234n)!;
    t1_mutated.energy = 25000; // Starving
    t1_mutated.attention = 150; // Popular but losing energy
    
    const t2 = parseLambda("S(S(K)(I))(K)");
    PlasmidRegistry.set(5678n, {
        ast: t2, attention: 500, energy: 90000, age: 10, fitness: 25, l1_cost: 6, mutualists: new Set(), nodes: 5, depth: 4
    });
    
    // Dump Epoch 2
    console.log("Generating Epoch 2 Dump...");
    // Artificial delay to guarantee distinct timestamps for filenames
    await new Promise(resolve => setTimeout(resolve, 50));
    const dump2 = await flushEpochBinary(2000, 115000, 4.2, "-2..5", 3500);
    
    // Run the transcript analysis!
    console.log("\n=== GENERATIVE METABOLIC TRANSCRIPT ===");
    console.log("This text delta is exactly what the LLM Senate reads before voting:\n");
    
    const transcript = await analyzeEpochDumps(dump1, dump2);
    console.log(transcript);
    
    // Cleanup generated files
    await Deno.remove(dump1);
    await Deno.remove(dump2);
    console.log("\nDemo complete. Test Binaries cleared.");
}

main();
