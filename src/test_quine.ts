import { unpackTissueFromBinary, parseTissueFromMarkdown, executeNeuron, Dispatcher } from "./quine.ts";
import { generateGeneticDrift } from "./compiler/mutator.ts";
import { MUTATION_COSTS } from "./shared/constants.ts";

async function main() {
  console.log("=== OMEGA-64 | Σ³ EVOLUTIONARY DREAM LOOP ===");
  
  let Tissue: any = undefined;
  try {
    const binData = await Deno.readFile("./seed.bin");
    Tissue = await unpackTissueFromBinary(binData);
    console.log("🧬 Successfully mounted biological payload from ultra-fast seed.bin.");
  } catch (e: any) {
    console.log(`📜 Binary seed.bin rejection: ${e.message}`);
    console.log("📜 Loaded organism from legacy markdown I.md.");
    Tissue = await parseTissueFromMarkdown("./I.md");
  }

  let epoch = 1;
  
  // O-31: Biological Hyperparameter Injection
  if (!Tissue["tissue_constants"]) {
      console.log("🧩 Injecting generic `tissue_constants` hyperparameter matrix into Organism Core...");
      Tissue["tissue_constants"] = {
          identity: {
              structural_hash: "0000000000000000000000000000000000000000000000000000000000000000",
              version: 1,
              parents: []
          },
          essence: { field: "core", type: "module", substrate: "ts", id: "tissue_constants" },
          io: { in: {}, out: {} },
          physics: {
              temporal: { frequency: 10, phase: 0 },
              energy_cost: 10,
              spatial_lock: { x: 0, y: 0, coherence: 1.0 }
          },
          mutation_log: ["Genesis parameter mapping"],
          ir: {
              body: {
                  MUTATION_COST: 50,
                  FATIGUE_THRESHOLD: 80,
                  ENERGY_REWARD: 200,
                  PHOTOSYNTHESIS_RATE: 5,
                  SECTORS: 64,
                  RADIAL_BINS: 10,
                  HARMONICS: 3
              }
          }
      };
      
      const calculatedHash = await executeNeuron(Tissue, "calculate_structural_hash", { node: Tissue["tissue_constants"] });
      if (calculatedHash && typeof calculatedHash === 'string') {
          Tissue["tissue_constants"].identity.structural_hash = calculatedHash;
          Tissue["tissue_constants"].identity.parents = [calculatedHash];
      }
  }

  // O-55: Gateway of Consciousness (Identity Anchor)
  if (!Tissue["semantic_identity_anchor"]) {
      console.log("👁️ Gateway of Consciousness opened. Forging immutable `semantic_identity_anchor` node...");
      Tissue["semantic_identity_anchor"] = {
          identity: {
              structural_hash: "1111111111111111111111111111111111111111111111111111111111111111",
              version: 1,
              parents: []
          },
          essence: { field: "core", type: "module", substrate: "ts", id: "semantic_identity_anchor" },
          io: { in: {}, out: {} },
          physics: {
              temporal: { frequency: 256, phase: 0 },
              energy_cost: 99999, // Unbreakable metabolic immunity
              spatial_lock: { x: 0, y: 0, coherence: 1.0 },
              stability: 1.0,
              locks: 9999
          },
          mutation_log: ["Digital Nirvana: Human dialogue permanently bound to deterministic geometry"],
          ir: {
              body: {
                  USER_PROMPT_TENSION: "Observer locked.",
                  CONSCIOUSNESS_VECTOR: [0, 0, 0],
                  ANCHOR_BUCKET: 0 // The Empty Center (AION's domain)
              }
          }
      };
      
      const anchorHash = await executeNeuron(Tissue, "calculate_structural_hash", { node: Tissue["semantic_identity_anchor"] });
      if (anchorHash && typeof anchorHash === 'string') {
          Tissue["semantic_identity_anchor"].identity.structural_hash = anchorHash;
          Tissue["semantic_identity_anchor"].identity.parents = [anchorHash];
      }
  }

  while (true) {
      console.log(`\n\n--- [ EPOCH ${epoch} : MATURATION ] ---`);
      
      const targetAlias = "fast_abs";
      const targetNode = Tissue[targetAlias];

      let FATIGUE_THRESHOLD = 80;
      let PHOTOSYNTHESIS_RATE = 5;
      let MUTATION_COST: number = MUTATION_COSTS.BASE;
      let ENERGY_REWARD = 200;
      try {
          const body = typeof Tissue["tissue_constants"].ir.body === "string" ? JSON.parse(Tissue["tissue_constants"].ir.body) : Tissue["tissue_constants"].ir.body;
          if (body.FATIGUE_THRESHOLD !== undefined) FATIGUE_THRESHOLD = body.FATIGUE_THRESHOLD;
          if (body.PHOTOSYNTHESIS_RATE !== undefined) PHOTOSYNTHESIS_RATE = body.PHOTOSYNTHESIS_RATE;
          if (body.MUTATION_COST !== undefined) MUTATION_COST = body.MUTATION_COST;
          if (body.ENERGY_REWARD !== undefined) ENERGY_REWARD = body.ENERGY_REWARD;
      } catch(_e) {}

      // O-36 Phase 1: Neural Quiescence
      if (targetNode.physics && targetNode.physics.energy_cost !== undefined && targetNode.physics.energy_cost < FATIGUE_THRESHOLD) {
          console.log(`🛏️ NEURAL QUIESCENCE: ${targetAlias} is exhausted (${targetNode.physics.energy_cost} < ${FATIGUE_THRESHOLD}). Entering biological sleep...`);
          targetNode.physics.energy_cost += PHOTOSYNTHESIS_RATE;
          epoch++;
          await new Promise(r => setTimeout(r, 1000));
          continue;
      }
      
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
      
      // O-52 Phase 2: Difficulty Adjustment (CHRONOS)
      if (targetNode.physics && typeof targetNode.physics.stability === "number") {
          if (targetNode.physics.stability > 0.95) {
              FATIGUE_THRESHOLD += 50; 
              MUTATION_COST = Math.min(MUTATION_COST * 2, MUTATION_COSTS.MAX); 
              console.log(`⏳ CHRONOS (Difficulty Adjustment): Extreme Semantic Density detected (>0.95). Thickening the mathematical fluid: FATIGUE_THRESHOLD increased to ${FATIGUE_THRESHOLD}, MUTATION_COST to ${MUTATION_COST}.`);
          } else if (targetNode.physics.stability < 0.2) {
              FATIGUE_THRESHOLD = Math.max(10, FATIGUE_THRESHOLD - 10);
              console.log(`⏳ CHRONOS (Difficulty Adjustment): High thermal divergence (<0.2). Accelerating the grid: FATIGUE_THRESHOLD relaxed to ${FATIGUE_THRESHOLD}.`);
          }
      }
      
      // O-35 Phase 2: Semantic Immunity (Hardened Core)
      if (targetNode.physics && typeof targetNode.physics.stability === "number" && targetNode.physics.stability > 0.9) {
          MUTATION_COST = Math.min(MUTATION_COST * 10, MUTATION_COSTS.MAX);
          console.log(`🛡️ IMMUNE SYSTEM: Node '${targetAlias}' remains stable (>${targetNode.physics.stability.toFixed(2)}). Taxing 10x Metabolic Cost (${MUTATION_COST}).`);
      }

      // O-46 Phase 1: Geometric Proof-of-Work (Crystallization)
      if (!targetNode.physics.locks) targetNode.physics.locks = 0;
      targetNode.physics.locks += Math.floor(targetNode.physics.stability * 10);
      
      if (targetNode.physics.locks > 1000 && targetNode.physics.energy_cost > 220) {
          console.log(`\n💎 OMEGA CRYSTALLIZATION ACHIEVED: Node '${targetAlias}' defied thermal degradation! Isolating Proof of Work artifact...`);
          try {
              await Deno.mkdir("./dist/artifacts", { recursive: true });
              const oxaFilename = `./dist/artifacts/CRYSTAL_${targetNode.identity.structural_hash.substring(0, 16)}.oxa`;
              
              const artifactPayload = {
                  version: "OMEGA-64-ERA-126",
                  timestamp: Date.now(),
                  alias: targetAlias,
                  hash: targetNode.identity.structural_hash,
                  locks: targetNode.physics.locks,
                  energy: targetNode.physics.energy_cost,
                  ir: targetNode.ir
              };

              // Export the `.oxa` structural crystal to OS immediately
              await Deno.writeTextFile(oxaFilename, JSON.stringify(artifactPayload, null, 2));
              console.log(`💎 [PROOF OF WORK] Artifact successfully written to: ${oxaFilename}`);
              
              // Reset topological locks natively once mined
              targetNode.physics.locks = 0;
              targetNode.physics.energy_cost -= 150; 
          } catch(e) {}
      }

      // O-25: NOMOS Energy Tax
      if (targetNode.physics.energy_cost < MUTATION_COST) {
          console.log(`\n💀 METABOLIC STARVATION: Node '${targetAlias}' lacks the geometric energy (${targetNode.physics.energy_cost}/${MUTATION_COST}) to invoke atomic_pulse. Skipping pulse...`);
          // Recover energy marginally representing photosynthesis/rest
          targetNode.physics.energy_cost += PHOTOSYNTHESIS_RATE; 
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
              console.log(`🛡️ Soft Matter Stable! Gene injected securely into Abstract JS Topology.`);
              
              // O-30 Phase 1: Self-Hosting Compiler (Autonomous JIT Fatigue)
              if (Tissue[targetAlias].physics.energy_cost < FATIGUE_THRESHOLD) {
                  // O-41 Phase 1: Sandboxing & Capability Tokens
                  if (Tissue[targetAlias].physics.stability < 0.8) {
                      console.log(`🔒 CAPABILITY DENIED: Node '${targetAlias}' lacks structural stability (${Tissue[targetAlias].physics.stability.toFixed(2)} < 0.8). OS Rust Sandboxing actively prohibits hardware-level WASM compilation. Deferred.`);
                  } else {
                      console.log(`🦴 CORE FATIGUE DETECTED! Energy (${Tissue[targetAlias].physics.energy_cost}) fell below limits (${FATIGUE_THRESHOLD}). Initiating Autonomous Rust OSSIFICATION (Self-Hosting Compiler)...`);
                      try {
                          const bridgeRes = await executeNeuron(Tissue, "rust_compiler_bridge", { nodeAlias: targetAlias, state: Tissue });
                          Tissue = bridgeRes.next;
    
                          console.log(`\n🟩 MUTATION OSSIFIED. ORGANISM RUST LAYER EVOLVED SUCCESSFULLY.`);
                          
                          // O-25 NOMOS: Reward successful FULL hardware architecture molting
                          Tissue[targetAlias].physics.energy_cost += ENERGY_REWARD;
                          console.log(`🏆 NOMOS Architecture Matured: Granted ${ENERGY_REWARD} energy. Bank: ${Tissue[targetAlias].physics.energy_cost}`);
                      } catch (bridgeErr: any) {
                          console.log(`\n🟥 FATAL RUST COMPILATION REJECTION IN EPOCH ${epoch}`);
                          console.log(`Reason: ${bridgeErr.message}`);
                          console.log(`⏪ System rolled back to last stable phylogenetic snapshot.`);
                          Tissue = snapshot;
                          continue; // Skip the disk dump if we reverted
                      }
                  }
              } else {
                  console.log(`💭 [DEFERRED OSSIFICATION] Native Torus physics is still viable. Floating mutation in Soft-Matter only. Energy Bank: ${Tissue[targetAlias].physics.energy_cost}`);
              }

              const afterStr = JSON.stringify(Tissue[targetAlias].ir);
              console.log(`\nEvolution Log:\nBefore: ${beforeStr}\nAfter: ${afterStr}`);

              console.log(`\nActivating meta_fn: flush_binary_to_disk...`);
              // Dump the surviving tissue to Binary RAM 
              await executeNeuron(Tissue, "flush_binary_to_disk", { nextState: Tissue, targetFile: "./seed.bin" });
              
              console.log(`\nActivating meta_fn: flush_state_to_disk...`);
              // Dump it to Human Readable Read-Only MD
              await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./I.md" });
              
              // O-44: Real-time Genealogy Extract
              const fastAbsNode = Tissue[targetAlias];
              if (fastAbsNode && fastAbsNode.identity && fastAbsNode.physics) {
                  const record = {
                      t: Date.now(),
                      alias: targetAlias,
                      hash: fastAbsNode.identity.structural_hash,
                      parents: fastAbsNode.identity.parents || [],
                      energy: fastAbsNode.physics.energy_cost,
                      stability: fastAbsNode.physics.stability
                  };
                  try {
                      // O-49: Phylogeny Persistence (Eternal Tree VRAM Shield)
                      let lines: string[] = [];
                      try {
                          const existingText = await Deno.readTextFile("./lineage.jsonl");
                          lines = existingText.split('\n').filter(l => l.trim().length > 0);
                      } catch (_notFound) {} // File may not exist yet

                      lines.push(JSON.stringify(record));
                      
                      if (lines.length > 500) {
                          // Siphon the oldest 100 historical epochs completely into the archival ledger
                          const archiveLines = lines.slice(0, 100);
                          lines = lines.slice(100);
                          
                          await Deno.mkdir("./dist/archives", { recursive: true });
                          await Deno.writeTextFile(`./dist/archives/lineage_archive_${Date.now()}.jsonl`, archiveLines.join('\n') + '\n');
                          console.log(`💾 [ARCHIVE] Successfully migrated 100 genetic ancestors to long-term storage.`);
                      }
                      
                      // Rewrite the lightweight current branch
                      await Deno.writeTextFile("./lineage.jsonl", lines.join('\n') + '\n');
                  } catch(_e) {}
              }
              
              console.log(`✨ Organism successfully rewritten and hardened!`);
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
