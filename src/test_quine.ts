import { unpackTissueFromBinary, parseTissueFromMarkdown, executeNeuron } from "./quine.ts";
import { generateGeneticDrift } from "./compiler/mutator.ts";

async function main() {
  console.log("=== OMEGA-64 | Σ³ EVOLUTIONARY DREAM LOOP ===");
  
  let Tissue: any = undefined;
  try {
    const binData = await Deno.readFile("./seed.bin");
    Tissue = await unpackTissueFromBinary(binData);
    console.log("🧬 Successfully mounted biological payload from ultra-fast seed.bin.");
  } catch (e) {
    console.log("📜 Loaded organism from legacy markdown I.md.");
    Tissue = await parseTissueFromMarkdown("./I.md");
  }

  let epoch = 1;
  while (true) {
      console.log(`\n\n--- [ EPOCH ${epoch} : MATURATION ] ---`);
      
      const targetAlias = "fast_abs";
      const targetNode = Tissue[targetAlias];
      
      const mutation = generateGeneticDrift(targetAlias, targetNode);
      if (!mutation) {
          console.log(`❌ Organism is perfectly sterilized (No mutable paths found).`);
          break;
      }
      
      console.log(`🔬 Genetic Drift Detected for '${mutation.alias}': mutating IR path [${mutation.path.join(".")}] to ${mutation.newValue}`);
      
      const operations = [
        {
          alias: "mutate_ir", 
          args: {
            targetAlias: mutation.alias,
            path: mutation.path,
            newValue: mutation.newValue
          }
        },
        {
          alias: "rust_compiler_bridge",
          args: {
            nodeAlias: mutation.alias
          }
        }
      ];

      const beforeStr = JSON.stringify(Tissue[targetAlias].expr);
      
      // Dispatch the atomic transaction -> (Mutate JS memory, then Mutate Rust Memory natively!)
      const res = await executeNeuron(Tissue, "atomic_pulse", { operations, state: Tissue, executeNeuron });
      
      if (!res.success) {
          console.log(`\n🟥 LETHAL MUTATION REJECTED IN EPOCH ${epoch}`);
          console.log(`Reason: ${res.error}`);
          console.log(`⏪ System rolled back to last stable phylogenetic snapshot.`);
      } else {
          console.log(`\n🟩 MUTATION SURVIVED. ORGANISM EVOLVED SUCCESSFULLY.`);
          Tissue = res.next;
          
          const afterStr = JSON.stringify(Tissue[targetAlias].expr);
          console.log(`\nEvolution Log:\nBefore: ${beforeStr}\nAfter: ${afterStr}`);

          console.log(`\nActivating meta_fn: flush_state_to_disk...`);
          // Dump the surviving tissue to Binary RAM 
          await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./seed.bin" });
          // Dump it to Human Readable Read-Only MD
          await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./I.md" });
          
          console.log(`✨ Organism successfully rewritten and hardened into seed.bin!`);
      }
      
      epoch++;
      // Give the visual grid a heartbeat baseline to render the shockwave (7 seconds).
      await new Promise(r => setTimeout(r, 7000));
  }
}

if (import.meta.main) {
  main();
}
