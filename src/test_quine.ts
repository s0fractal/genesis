import { unpackTissueFromBinary, parseTissueFromMarkdown, executeNeuron, Dispatcher } from "./quine.ts";
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
      
      // O-25: Kuramoto Phase Alignment
      // Advance Phase physics. Only allow evolutionary execution if Theta wraps (completes an orbit).
      if (!targetNode.physics.temporal) {
          const freq = targetNode.physics.energy_cost < 20 ? 64 : 1;
          targetNode.physics.temporal = { frequency: freq, phase: 0 };
      }
      targetNode.physics.temporal.phase += targetNode.physics.temporal.frequency;
      console.log(`⏱️ Kuramoto Clock: ${targetAlias} phase advanced to ${targetNode.physics.temporal.phase}/256`);
      
      if (targetNode.physics.temporal.phase < 256) {
          console.log(`💤 Ribosome Dormant. Node '${targetAlias}' has not reached zenith (Theta=0). Skipping epoch...`);
          epoch++;
          await new Promise(r => setTimeout(r, 200)); // Fast-forward time
          continue;
      }
      
      // Node has fired! Wrap phase and extract energy.
      targetNode.physics.temporal.phase %= 256;
      console.log(`⚡ RIBOSOME IGNITION: Node '${targetAlias}' crossed Theta=0 Resonance! Initiating evolutionary pulse...`);
      
      const mutation = generateGeneticDrift(targetAlias, targetNode);
      if (!mutation) {
          console.log(`❌ Organism is perfectly sterilized (No mutable paths found).`);
          break;
      }
      
      console.log(`🔬 Genetic Drift Detected for '${mutation.alias}': mutating IR path [${mutation.path.join(".")}] to ${mutation.newValue}`);
      
      // O-25: NOMOS Energy Tax
      // Nodes must surrender mathematical volume (Torus Energy) to power compiling routines.
      const MUTATION_COST = 50;
      if (targetNode.physics.energy_cost < MUTATION_COST) {
          console.log(`\n💀 METABOLIC STARVATION: Node '${targetAlias}' lacks the geometric energy (${targetNode.physics.energy_cost}/${MUTATION_COST}) to invoke atomic_pulse. Skipping pulse...`);
          // Recover energy marginally representing photosynthesis/rest
          targetNode.physics.energy_cost += 5; 
          epoch++;
          await new Promise(r => setTimeout(r, 1000));
          continue;
      }
      
      // Deduct the energy natively
      targetNode.physics.energy_cost -= MUTATION_COST;
      console.log(`🔥 NOMOS: Extracted ${MUTATION_COST} energy from '${targetAlias}'. Remaining Bank: ${targetNode.physics.energy_cost}`);
      
      const operations = [
        {
          alias: "mutate_ir", 
          args: {
            targetAlias: mutation.alias,
            path: mutation.path,
            newValue: mutation.newValue
          }
        }
      ];

      const beforeStr = JSON.stringify(Tissue[targetAlias].ir);
      
      const snapshot = structuredClone(Tissue);
      
      // Dispatch the atomic transaction -> Mutate JS memory
      const res = await executeNeuron(Tissue, "atomic_pulse", { operations, state: Tissue, executeNeuron });
      
      if (!res.success) {
          console.log(`\n🟥 LETHAL MUTATION REJECTED IN EPOCH ${epoch}`);
          console.log(`Reason: ${res.error}`);
          console.log(`⏪ System rolled back to last stable phylogenetic snapshot.`);
          Tissue = snapshot;
      } else {
          Tissue = res.next;
          
          console.log(`🧪 Soft Matter Evaluation Phase: Testing TS Interpretation for 1000 ticks...`);
          let stable = true;
          for (let tick = 0; tick < 1000; tick++) {
             try {
                 const testArg = Math.floor(Math.random() * 255);
                 const out = Dispatcher.executeInTs(Tissue[targetAlias], { v: testArg });
                 if (Number.isNaN(out) || !Number.isFinite(out)) {
                     stable = false; break;
                 }
             } catch(e) {
                 stable = false; break;
             }
          }

          if (!stable) {
              console.log(`🧬 HYBRID JIT REJECTED (Kinematic Collapse): TS emulation mathematically destabilized. Discarding mutation.`);
              Tissue = snapshot;
          } else {
              console.log(`🛡️ Soft Matter Stable! OSSIFYING -> Initiating Native Rust Compiler Bridge...`);
              try {
                  const bridgeRes = await executeNeuron(Tissue, "rust_compiler_bridge", { nodeAlias: targetAlias, state: Tissue });
                  Tissue = bridgeRes.next;

                  console.log(`\n🟩 MUTATION SURVIVED. ORGANISM EVOLVED SUCCESSFULLY.`);
                  
                  // O-25 NOMOS: Reward successful mutations (Evolutionary Darwinism)
                  const ENERGY_REWARD = 60;
                  Tissue[targetAlias].physics.energy_cost += ENERGY_REWARD;
                  console.log(`🏆 NOMOS Reward: Granted ${ENERGY_REWARD} energy. Bank: ${Tissue[targetAlias].physics.energy_cost}`);
                  
                  const afterStr = JSON.stringify(Tissue[targetAlias].ir);
                  console.log(`\nEvolution Log:\nBefore: ${beforeStr}\nAfter: ${afterStr}`);

                  console.log(`\nActivating meta_fn: flush_state_to_disk...`);
                  // Dump the surviving tissue to Binary RAM 
                  await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./seed.bin" });
                  // Dump it to Human Readable Read-Only MD
                  await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./I.md" });
                  
                  console.log(`✨ Organism successfully rewritten and hardened into seed.bin!`);
              } catch (bridgeErr: any) {
                  console.log(`\n🟥 FATAL RUST COMPILATION REJECTION IN EPOCH ${epoch}`);
                  console.log(`Reason: ${bridgeErr.message}`);
                  console.log(`⏪ System rolled back to last stable phylogenetic snapshot.`);
                  Tissue = snapshot;
              }
          }
      }
      
      epoch++;
      // Wait a fraction of a second before the next geometric frame
      await new Promise(r => setTimeout(r, 1000));
  }
}

if (import.meta.main) {
  main();
}
