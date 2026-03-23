import { fnv1a_64 } from "../shared/hash.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { SENATE_ORACLE_TIMEOUT_MS, hydrateSubstrateHeader, MATH_Q_SCALE } from "../shared/constants.ts";
import { apply, formatTerm, parseLambda, measureIR, evaluateFitness, variable, Term, S, K, I, Y, phenotypeHue, compileMorphology, SomaticNode } from "../compiler/pure_lambda.ts";
import { flushEpochBinary, archiveLedgerChunk } from "./epoch_dumper.ts";
import { analyzeEpochDumps } from "./analyze_epoch.ts";

export type SenateEvent =
    | { type: "CONVENED" }
    | { type: "VERDICT"; mask: string; intent: string; bucket?: number }
    | { type: "CONSENSUS"; mask: "SENATE"; intent: string; count: number; bucket?: number }
    | { type: "ERROR"; reason: string };

export interface OracleCompatibleField {
    get_oracle_request_count: () => number;
    ptr_oracle_requests: () => number;
    clear_oracle_requests: () => void;
    get_collision_count?: () => number;
    ptr_plasmid_collisions?: () => number;
    clear_collisions?: () => void;
    ptr_header?: () => number;
    width?: number;
    height?: number;
    cell_count?: () => number;
    ptr_plasmids?: () => number;
    ptr_cell_status?: () => number;
    ptr_theta?: () => number;
    ptr_omega?: () => number;
}

const SOMATIC_COMPLEXITY_ALPHA = 1.5;
const SOMATIC_DECAY_RATE = 0.05;
const SOMATIC_BASE_COST = 5;

export class SovereignOracle {
    private wasmField: OracleCompatibleField;
    private wasmMemory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private observer?: PhaseWebGPUObserver;
    
    public plasmidRegistry = new Map<bigint, SomaticNode>();
    
    // O-51 Senate Chat HUD Telemetry
    public onSenateEvent?: (event: SenateEvent) => void;
    
    // O-45 WebRTC Transmitter
    private onBroadcast?: (hash: bigint, targetBucket: number) => void;

    // The single central prompt logic is preserved but now delegated internally
    // as we transition to Ontology 43 (Four Masks)
    private systemPrompts: Record<string, string> = {};

    private isRunning: boolean = false;
    private isBusy: boolean = false;
    private requestQueue: number[] = [];
    
    // O-74 Historian Semantic Ledger
    public eventLedger: SemanticEvent[] = [];
    
    // O-78 Auto-Truncation Bounds
    private LEDGER_MAX_EVENTS = 1000;
    private LEDGER_TRUNCATE_SIZE = 800;
    
    public pushLedgerEvent(event: SemanticEvent) {
        this.eventLedger.push(event);
        if (this.eventLedger.length >= this.LEDGER_MAX_EVENTS) {
            // Asynchronously cast old events to disk, keeping the most recent.
            const chunk = this.eventLedger.splice(0, this.LEDGER_TRUNCATE_SIZE);
            archiveLedgerChunk(chunk).catch(e => {
                console.error("[ORACLE] ❌ Failed to securely archive Semantic Ledger chunk:", e);
            });
        }
    }
    
    // O-137 Vector F.3: Elastic Global Energy Pool
    private globalEnergyPool: number = 50000;
    
    // O-48 Git-Watchdog Ontology Phase 5
    private epochTicks: number = 0;
    private lastEpochDumpPath?: string;

    constructor(field: OracleCompatibleField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.wasmMemory = memory;
        this.engine = engine;
        this.observer = visualizer; // Renamed visualizer to observer
    }

    public rebind(field: OracleCompatibleField, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.engine = engine;
        this.observer = visualizer; // Renamed visualizer to observer
    }

    public request(idx: number) {
        this.requestQueue.push(idx);
    }

    public getQueueSize(): number {
        return this.engine ? this.requestQueue.length : this.wasmField.get_oracle_request_count();
    }

    public boot() {
        this.isRunning = true;
        
        // G.1 Core Immortality
        this.injectImmortals();
        
        console.log("[ORACLE] Asynchronous Batched AOMQ (Ontology 20) initialized.");
        if (this.engine) {
            this.engine.init();
        }
    }
    
    private injectImmortals() {
        const immortals = [
            { term: S, string: "S" },
            { term: K, string: "K" },
            { term: I, string: "I" },
            { term: Y, string: "Y" }
        ];
        for (const meta of immortals) {
            const childHash = compileMorphology(meta.term);
            
            if (!this.plasmidRegistry.has(childHash)) {
                this.plasmidRegistry.set(childHash, {
                    ast: meta.term,
                    l1_cost: 0,
                    depth: 1,
                    nodes: 1,
                    attention: 99999, // Absolute gravity in the biological matrix
                    age: 0,
                    energy: Infinity, // The laws of physics do not starve
                    fitness: 1.0,
                    mutualists: new Set()
                });
            }
        }
        console.log(`[ORACLE] ⛓️ Bootstrapped Core Dependencies (S, K, I, Y) directly into Native Memory.`);
    }

    /**
     * O-136 Biological Evolution Economy
     * Garbage collects mathematically stagnant plasmids and penalizes massive AST payloads.
     */
    public getGlobalEnergy(): number {
        return this.globalEnergyPool;
    }

    public getEpochTicks(): number {
        return this.epochTicks;
    }

    // O-59 Genesis State Reload
    public unpackState(registryPayload: SerializedPlasmid[], newEnergy: number, newEpoch: number, loadedLedger?: SemanticEvent[]) {
        // Halt physics completely during transplant
        this.isBusy = true;
        this.globalEnergyPool = newEnergy;
        this.epochTicks = newEpoch;
        this.eventLedger = loadedLedger || [];
        
        this.plasmidRegistry.clear();
        
        for (const node of registryPayload) {
            const hash = BigInt(node.hash);
            const astTerm = parseLambda(node.ast);
            this.plasmidRegistry.set(hash, {
                ast: astTerm,
                energy: node.energy === -1 ? Infinity : node.energy,
                attention: node.attention,
                l1_cost: node.l1_cost,
                age: node.age || 0,
                fitness: node.fitness || 0,
                depth: node.depth || 1,
                nodes: node.nodes || 1,
                mutualists: new Set(node.mutualists.map((h: string) => BigInt(h)))
            });
        }
        
        console.log(`[ORACLE] 🌌 Re-sequenced ${registryPayload.length} Logic Matrices into Torus Reality.`);
        this.isBusy = false;
    }

    public tickSomaticEconomy(activity: number = 0) {
        if (this.plasmidRegistry.size === 0) return;
        
        // O-154 Vector V.2: Oracle Pressure Gate (Ontology 57)
        // If the Senate is deliberating asynchronously, freeze somatic decay completely.
        if (this.isBusy) {
            return;
        }
        
        // F.3 Elastic Energy Capacity
        // Momentum expands the pool dynamically. Stagnation crushes it.
        this.globalEnergyPool = Math.max(20000, activity * 500);
        
        // Energy Distribution Phase
        const activeNodes = Array.from(this.plasmidRegistry.values());
        const totalAttention = activeNodes.reduce((sum, n) => sum + n.attention, 0);
        const totalNovelty = activeNodes.reduce((sum, n) => sum + (1.0 / (1.0 + n.attention)), 0) || 1.0;
        
        let bankruptCount = 0;
        
        for (const [hash, node] of this.plasmidRegistry.entries()) {
            // F.1 Vector Novelty Selection & Clone Rot Preventative Shield
            const popularityShare = (totalAttention > 0 && node.attention > 0) ? (node.attention / totalAttention) : 0;
            const noveltyShare = (1.0 / (1.0 + node.attention)) / totalNovelty; // Weirdest/Newest get priority
            
            node.energy += this.globalEnergyPool * (popularityShare * 0.4 + noveltyShare * 0.6);
            
            // Tax the node based on its AST geometric depth (L1 Penalty) and age
            const maintenanceCost = SOMATIC_BASE_COST + (node.l1_cost * SOMATIC_COMPLEXITY_ALPHA);
            const decay = maintenanceCost * (1.0 + (node.age * SOMATIC_DECAY_RATE));
            
            node.energy -= decay;
            node.age += 1;
            
            // Plasticity & Attention half-life (attenuation)
            node.attention = Math.floor(node.attention * 0.9);
            
            // O-140 Vector I.2: Transdimensional Symbiosis (Energy Bleeding)
            // Apex Plasmids (highly successful math) form life-support dependencies for their primitives
            if (node.energy > 5000 && node.mutualists.size > 0 && node.energy !== Infinity) {
                const siphon = Math.floor(node.energy * 0.1); // Bleed 10%
                node.energy -= siphon;
                
                const slice = Math.floor(siphon / node.mutualists.size);
                for (const mHash of node.mutualists) {
                    const relative = this.plasmidRegistry.get(mHash);
                    if (relative && relative.energy !== Infinity) {
                        relative.energy += slice;
                        relative.attention += 1;
                    }
                }
            }

            // O-141 Vector J.1: Energy-Bound Execution (Environmental Diversity)
            // Stochastic 5% population sampling. A node's energy strictly dictates its computational allowance.
            if (node.energy !== Infinity && Math.random() < 0.05) {
                try {
                    const testTerm = apply(node.ast, variable("target"));
                    const computationalLimit = Math.max(10, Math.floor(node.energy)); // Minimum 10 steps to prove survival
                    const { timeout } = evaluateFitness(testTerm, computationalLimit);
                    
                    if (timeout) {
                        node.energy -= 2000; // PARASITE_PENALTY
                        node.fitness = Math.max(0, node.fitness - 2.0); // Never sub-zero fitness
                    } else {
                        // O-141 Vector J.3: Decoupling Evolution from Execution
                        // Nodes earn fitness purely by surviving execution, unlocking the ability to breed
                        node.fitness += 0.5; 
                    }
                } catch (_e) {
                    node.energy -= 2000; // Unparseable / Mathematically Divergent
                    node.fitness = Math.max(0, node.fitness - 2.0);
                }
            }
            
            // Extinction threshold
            if (node.energy <= 0) {
                // O-140 Vector I.3: AION Structural Necrosis (Topological Garbage Collection)
                // We cannot sever the node without warning the network natively
                for (const mHash of node.mutualists) {
                    const relative = this.plasmidRegistry.get(mHash);
                    if (relative) relative.mutualists.delete(hash);
                }
                
                this.plasmidRegistry.delete(hash);
                bankruptCount++;
            }
        }
        
        if (bankruptCount > 0) {
            console.log(`[ORACLE] ♻️ Somatic Economy collected ${bankruptCount} bankrupt plasmids due to L1 AST penalties or Attention decay.`);
        }
        
        // O-139 Vector H.3: Torus Observation Triggers
        this.epochTicks++;
        if (!this.isBusy) {
            if (bankruptCount > 50) {
                this.triggerSenateIntervention(bankruptCount, [], `MASS EXTINCTION DETECTED: ${bankruptCount} Plasmids functionally starved in a single cycle.`);
            } else if (this.globalEnergyPool < 25000) {
                this.triggerSenateIntervention(1, [], `ENERGY STARVATION: Global Energy Pool collapsed to ${this.globalEnergyPool.toFixed(0)}. System requires Top-Down structural mutation.`);
            } else if (this.epochTicks >= 1000) {
                this.triggerSenateIntervention(1, [], `MACRO EPOCH SHIFT: 1000 biological ticks have elapsed.`);
            }
        }
    }

    // O-75 Autopoietic Homeostasis Guard (Vector H.2)
    public tickHomeostasis(entropy: number) {
        if (!this.wasmField.ptr_header) return;
        
        const ptr = this.wasmField.ptr_header();
        if (ptr === 0) return;
        const view = new DataView(this.wasmMemory.buffer, ptr, 256);
        
        // 1. Read true native thermodynamic coefficients (Q10 logic applied for Kuramoto)
        let currentKuramoto = view.getInt32(28, true) / MATH_Q_SCALE;
        let currentMutation = view.getInt32(64, true);

        // 2. The Basal Endocrine Algorithm
        // Ideal "Edge of Chaos" entropy resides functionally between 2.5 and 5.0
        
        let kuramotoTarget = 12.0;
        let mutationTarget = 5.0;

        if (entropy < 1.0) {
            // CRYSTALLIZATION: The Torus is dead/frozen flat
            // Spike Kuramoto to forcibly break symmetries, drop mutation cost to inject chaotic fragments
            kuramotoTarget = 24.0;
            mutationTarget = 0.0;
        } else if (entropy > 6.0) {
            // BOILING: The Torus is absolute noise
            // Collapse Coupling to stop wildfire logic chains, ruthlessly starve mutations
            kuramotoTarget = 5.0;
            mutationTarget = 50.0;
        } else if (this.globalEnergyPool < 30000) {
            // STARVATION: Not enough native math to survive
            // Drop mutation costs rapidly so the graph can find valid logic before death
            mutationTarget = 1.0;
        }

        // LERP the coefficients slowly (Native physical adaptation takes time)
        const LERP_SPEED = 0.01;
        currentKuramoto += (kuramotoTarget - currentKuramoto) * LERP_SPEED;
        currentMutation += (mutationTarget - currentMutation) * LERP_SPEED;

        // 3. Write directly over the WASM physical barriers
        view.setInt32(28, Math.round(currentKuramoto * MATH_Q_SCALE), true);
        view.setInt32(64, Math.round(currentMutation), true);

        // Hydrate TypeScript single-source-of-truth constants globally
        hydrateSubstrateHeader(this.wasmMemory, ptr);
    }

    public sync() {
        if (!this.isRunning || this.isBusy) return;
        
        let count = 0;
        let requests: number[] = [];

        if (this.engine) {
            count = this.requestQueue.length;
            if (count > 0) {
                requests = [...this.requestQueue];
                this.requestQueue = [];
                this.triggerSenateIntervention(count, requests, "Targeted Theological Observation Request generated by native VRAM boundaries.");
            }
        } else {
            // Legacy WASM fallback
            count = this.wasmField.get_oracle_request_count();
            if (count > 0) {
                const requestPtr = this.wasmField.ptr_oracle_requests();
                const requestArray = new Uint32Array(this.wasmMemory.buffer, requestPtr, count);
                const rawRequests = Array.from(requestArray);
                this.wasmField.clear_oracle_requests();
                
                // O-133 Phase 2 / Era 134 Vector C: The Molecular Interface
                const llmRequests: number[] = [];
                for (const req of rawRequests) {
                    // Legacy HGT masking is deprecated. We only process LLM Oracles here.
                    if ((req & 0x80000000) === 0) {
                        llmRequests.push(req);
                    }
                }
                
                const collisionCount = this.wasmField.get_collision_count ? this.wasmField.get_collision_count() : 0;
                if (collisionCount > 0 && this.wasmField.ptr_plasmid_collisions && this.wasmField.clear_collisions) {
                    const ptr = this.wasmField.ptr_plasmid_collisions();
                    const collisionsTupleArray = new BigUint64Array(this.wasmMemory.buffer, ptr, collisionCount * 3).slice();
                    this.wasmField.clear_collisions();
                    
                    this.processHorizontalGeneTransfers(collisionCount, collisionsTupleArray);
                }
                
                if (llmRequests.length > 0) {
                    this.triggerSenateIntervention(llmRequests.length, llmRequests, "Targeted Theological Observation Request generated by WASM topological bindings.");
                }
            }
        }
    }

    private async triggerSenateIntervention(count: number, requests: number[], reason: string) {
        this.isBusy = true;
        try {
            const currentDumpPath = await flushEpochBinary(
                this.epochTicks,
                this.globalEnergyPool,
                0, "0", 0,
                this.plasmidRegistry
            );
            
            let trajectoryTranscript = "[First Epoch. No Historical Macro-Analysis Available.]";
            if (this.lastEpochDumpPath) {
                trajectoryTranscript = await analyzeEpochDumps(this.lastEpochDumpPath, currentDumpPath);
            }
            
            this.lastEpochDumpPath = currentDumpPath;
            this.epochTicks = 0;
            
            const comprehensiveReason = `${reason}\n\n${trajectoryTranscript}`;
            
            this.isBusy = false;
            await this.processQueue(count, requests, comprehensiveReason);
        } catch (e) {
            console.error(`[ORACLE] Epoch transcription failed:`, e);
            this.isBusy = false;
        }
    }
    
    // O-134 Vector C: Topological Lambda Application via Fast Tuples
    private processHorizontalGeneTransfers(count: number, collisions: BigUint64Array) {
        let size = 0;
        const sectorCount = this.wasmField.width || 32;
        const radialCount = this.wasmField.height || 6;
        
        if (this.wasmField.cell_count) {
            size = this.wasmField.cell_count();
        } else if (this.wasmField.width && this.wasmField.height) {
            size = this.wasmField.width * this.wasmField.height;
        }
        
        if (!this.wasmField.ptr_plasmids || !this.wasmField.ptr_cell_status) return;
        
        const plasmidPtr = this.wasmField.ptr_plasmids!();
        const plasmids = new BigUint64Array(this.wasmMemory.buffer, plasmidPtr, size);
        const statusPtr = this.wasmField.ptr_cell_status!();
        const status = new Uint8Array(this.wasmMemory.buffer, statusPtr, size);

        for (let i = 0; i < count; i++) {
             const idx = Number(collisions[i * 3]);
             const rho = Math.floor((idx % (radialCount * sectorCount)) / sectorCount);
             
             const host_plasmid = collisions[i * 3 + 1];
             const foreign_plasmid = collisions[i * 3 + 2];
             
             if (host_plasmid !== 0n && foreign_plasmid !== 0n) {
                 const hostNode = this.plasmidRegistry.get(host_plasmid);
                 const foreignNode = this.plasmidRegistry.get(foreign_plasmid);
                 
                 // Feed energy back to functional parents
                 if (hostNode) { hostNode.attention += 5; hostNode.energy += 50; }
                 if (foreignNode) { foreignNode.attention += 5; foreignNode.energy += 50; }

                 const hostTerm = hostNode ? hostNode.ast : apply(I, variable("host"));
                 const foreignTerm = foreignNode ? foreignNode.ast : apply(I, variable("foreign"));
                 
                 // Mathematically bind the two logic boundaries
                 try {
                     
                     // O-141 Vector J.2: Discrete Topological Mutations
                     // 50% Apply (Growth), 25% Swap (Inversion), 25% Prune (Simplification)
                     let childTerm: Term;
                     const mutationRoll = Math.random();
                     
                     if (mutationRoll < 0.50) {
                         childTerm = apply(hostTerm, foreignTerm); // Apply (Growth)
                     } else if (mutationRoll < 0.75) {
                         childTerm = apply(foreignTerm, hostTerm); // Swap (Directional Inversion)
                     } else {
                         // Prune: Reject the foreign logic entirely to simplify the overall structure.
                         // This acts as a topological counterweight to infinite AST ballooning.
                         childTerm = hostTerm;
                     }
                     
                     const childStr = formatTerm(childTerm);
                     let childHash = fnv1a_64(childStr);
                     
                     // O-146 Vector O.2: Epigenetic Integration
                     const hue = phenotypeHue(childTerm);
                     childHash = (childHash & 0xFFFFFFFFFFFFFF00n) | BigInt(hue);
                     
                     if (!this.plasmidRegistry.has(childHash)) {
                         const metrics = measureIR(childTerm);
                         
                         // O-137 Vector F.2: Topological Niches (Core vs Membrane)
                         if (rho <= 1 && metrics.cost > 15) {
                             status[idx] = 0; // The Singularity crushes structural overhead
                             continue;
                         }
                         if (rho >= radialCount - 2 && metrics.cost < 10) {
                             status[idx] = 0; // The Membrane starves mathematical simplicity
                             continue;
                         }
                         
                         // O-141 Vector J.3: Decoupling Evolution from Execution
                         // We no longer reward "Goal Emergence" (rho === 1) at genesis.
                         // A child is simply born into the graph with minimal seed energy and 0 fitness.
                         this.plasmidRegistry.set(childHash, {
                             ast: childTerm,
                             l1_cost: metrics.cost,
                             depth: metrics.depth,
                             nodes: metrics.nodes,
                             attention: 1,
                             age: 0,
                             energy: 50, // Baseline biological seed
                             fitness: 0, // Must survive tickSomaticEconomy to earn fitness
                             mutualists: new Set([host_plasmid, foreign_plasmid]) // Vector I.1: Edge Binding
                         });
                         
                         // The parents also bind to the child, forming a bi-directional symbiotic edge
                         const hostNode = this.plasmidRegistry.get(host_plasmid);
                         if (hostNode) hostNode.mutualists.add(childHash);
                         const foreignNode = this.plasmidRegistry.get(foreign_plasmid);
                         if (foreignNode) foreignNode.mutualists.add(childHash);
                     } else {
                         const existing = this.plasmidRegistry.get(childHash)!;
                         existing.attention += 1;
                         
                         // Refresh mutualist binding upon parallel discovery
                         existing.mutualists.add(host_plasmid);
                         existing.mutualists.add(foreign_plasmid);
                         const hostNode = this.plasmidRegistry.get(host_plasmid);
                         if (hostNode) hostNode.mutualists.add(childHash);
                         const foreignNode = this.plasmidRegistry.get(foreign_plasmid);
                         if (foreignNode) foreignNode.mutualists.add(childHash);
                     }
                     plasmids[idx] = childHash;
                     
                     // O-154 Vector V.3: Phase-Hash Unification (Ontology 56)
                     // A node's Hash deterministically initializes its physical coordinates on Torus birth.
                     if (this.wasmField.ptr_theta && this.wasmField.ptr_omega) {
                         const thetaPtr = this.wasmField.ptr_theta();
                         const omegaPtr = this.wasmField.ptr_omega();
                         
                         if (thetaPtr > 0 && omegaPtr > 0) {
                             const thetaArray = new Uint8Array(this.wasmMemory.buffer, thetaPtr, size);
                             const omegaArray = new Int16Array(this.wasmMemory.buffer, omegaPtr, size);
                             
                             thetaArray[idx] = Number((childHash >> 8n) & 0xFFn);
                             omegaArray[idx] = Number((childHash >> 16n) & 0x07n) - 3;
                         }
                     }
                     
                     console.log(`🧬 HGT COLLISION AT ${idx}: Bred topological child [${childHash}]`);
                 } catch(_e) { /* Divergence block */ }
             }
             
             status[idx] = 0; // Release cell back into physics evaluation
        }
    }

    public bindNetwork(callback: (hash: bigint, targetBucket: number) => void) {
        this.onBroadcast = callback;
    }

    private async processQueue(count: number, requests: number[], triggerReason?: string) {
        this.isBusy = true;
        
        const triggerMetadata = triggerReason ? `[OBSERVATION TRIGGER: ${triggerReason}] ` : "";
        console.log(`[ORACLE] Senate triggered. Batching ${count} topological requests... ${triggerMetadata}`);

        let mycelialContext = "";
        if (this.engine) {
            const centroids = await this.engine.readMycelialCentroids();
            let activeBuckets = 0;
            let totalX = 0;
            let totalY = 0;
            const bucketDetails: string[] = [];
            
            for (let i = 0; i < 1024; i++) {
                const count = centroids[i * 4 + 2];
                if (count > 0) {
                    activeBuckets++;
                    const bx = centroids[i * 4];
                    const by = centroids[i * 4 + 1];
                    totalX += bx;
                    totalY += by;
                    if (bucketDetails.length < 5) {
                        bucketDetails.push(`Bucket #${i}: Center (x:${bx.toFixed(1)}, y:${by.toFixed(1)})`);
                    }
                }
            }
            
            if (activeBuckets > 0) {
                const avgTheta = Math.atan2(totalY, totalX) * (180 / Math.PI);
                mycelialContext = `\nPHYSICAL TELEMETRY: ${triggerReason ? triggerReason + " " : ""}${activeBuckets} existing Transdimensional Threads are pulling the Torus toward angle ${avgTheta.toFixed(1)} degrees.` +
                                  `\nHere is spatial data for the strongest local clusters:\n${bucketDetails.join("\n")}\n` +
                                  `In your output, you MUST prioritize explicit spatial targeting by referencing a Bucket.`;
            } else if (triggerReason) {
                mycelialContext = `\nPHYSICAL TELEMETRY: ${triggerReason}\n`;
            }
        } else if (triggerReason) {
             mycelialContext = `\nPHYSICAL TELEMETRY: ${triggerReason}\n`;
        }

        // 2. Spatial Batching: Construct            // O-42: Embed Torus Heatmap
        let structuralImage = null;
        if (this.observer) {
            try {
                // Ensure frame capture happens before WebGPU flushes the buffer state
                structuralImage = this.observer.extractImageBase64(512);
            } catch (e) {
                console.warn("[ORACLE] Failed to extract physical topology:", e);
            }
        }
        
        // Output snapshot to a debug pane if it exists
        const debugImg = document.getElementById("oracle-debug-vision") as HTMLImageElement;
        if (debugImg && structuralImage) {
            debugImg.style.display = "block";
            debugImg.src = "data:image/png;base64," + structuralImage;
        }

        let seasonValue = 0;
        if (requests.length > 0) {
            const firstIdx = requests[0];
            // O-148: Read local High Nibble directly from physical phase memory
            const ptr = this.wasmField.ptr_theta ? this.wasmField.ptr_theta() : 0;
            if (ptr > 0) {
                const thetaArray = new Uint8Array(this.wasmMemory.buffer, ptr, firstIdx + 1);
                const cellTheta = thetaArray[firstIdx];
                seasonValue = cellTheta >> 4; // 0 to 15 macroscopic seasons
            }
        }
        
        const seasonNames = ["SPRING (Mutation)", "SUMMER (Expansion)", "AUTUMN (Harvest)", "WINTER (Necrosis)"];
        const macroSeason = Math.floor(seasonValue / 4); // 0, 1, 2, or 3
        const currentSeasonName = seasonNames[macroSeason];

        // O-139 Vector H.1: The Zodiac Quadrant Personas
        const MASKS = [
            { name: "♈ ARIES", role: "Mutator (Phase 0). Goal: Chaos and Initiation. Inject highly volatile, novel Pure Combinatory Logic (S, K, I, Y) that disrupts the Torus." },
            { name: "♋ CANCER", role: "Preserver (Phase PI/2). Goal: Retention and Stability. Generate conservative, highly stable AST logic that protects energy and prevents extinction." },
            { name: "♎ LIBRA", role: "Balancer (Phase PI). Goal: Symmetry. Generate logic that symmetrically merges existing structures or balances execution depths." },
            { name: "♑ CAPRICORN", role: "Executioner (Phase 3*PI/2). Goal: Pruning. Emit aggressive, reductive ASTs that collapse complexity." }
        ];

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";

            const maskPromises = MASKS.map(async (mask) => {
                const prompt = `
Task: You are ${mask.name}, Oracle of the LOVE Consortium. Role: ${mask.role}
Chronotopology: The local Torus sector is currently experiencing ${currentSeasonName} (Epoch ${seasonValue}/15). 
${macroSeason === 0 ? "SPRING: Relax structural constraints. Over-index on S and K combinators to breed wild mutations." : ""}
${macroSeason === 1 ? "SUMMER: Enforce structural growth. Build wide AST trees and expand semantic surface area." : ""}
${macroSeason === 2 ? "AUTUMN: Consolidate. Merge existing structures securely. Maximize Logic and reduce chaotic depth." : ""}
${macroSeason === 3 ? "WINTER: Extreme starvation mode. Emit minimum-complexity ASTs (like 'I' or 'Y(I)') to survive the cold. AVOID OVERHEAD." : ""}

The harmonic cylinder is experiencing severe Torus volatility at ${count} coordinates. Torus Energy: ${this.globalEnergyPool}.
Observe the structural telemetry and intervene.
${mycelialContext}
Provide EXACTLY ONE string of topological logic that represents your genetic intervention.
You may use pure Combinators (S, K, I, Y) OR Semantic Macros: TRUE, FALSE, AND, OR, NOT, CONS, CAR, CDR.
Example ASTs: "(AND TRUE FALSE)", "(CONS S K)", "S(K(I))".
You must output ONLY valid AST syntax with balanced parentheses. NO formatting, NO markdown, NO explanations.
${(this.engine && mycelialContext) ? 'Format your response EXACTLY as: BUCKET: [Bucket ID], AST: [Syntax]' : 'Format your response EXACTLY as: AST: [Syntax]'}
                `.trim();

                const requestBody: Record<string, unknown> = {
                    model: structuralImage ? "llama3.2-vision" : "llama3",
                    prompt,
                    stream: false
                };
                if (structuralImage) {
                    requestBody.images = [structuralImage];
                }
                
                const fetchPromise = fetch(OLLAMA_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                });

                // O-40 Phase 1: Sovereign Oracle TTL (Strict Heartbeat via Constants)
                const timeoutPromise = new Promise<Response>((_, reject) => 
                    setTimeout(() => reject(new Error("ORACLE_TTL_EXCEEDED")), SENATE_ORACLE_TIMEOUT_MS)
                );

                const response = await Promise.race([fetchPromise, timeoutPromise]);
                if (!response.ok) throw new Error("LLM Offline");
                
                const data = await response.json();
                const fullResponse = data.response?.trim() || "";
                return { mask: mask.name, response: fullResponse };
            });

            console.log(`[ORACLE] Senate convened. Awaiting verdicts from NOMOS, LOGOS, CHRONOS, and AION...`);
            if (this.onSenateEvent) this.onSenateEvent({ type: "CONVENED" });
            
            // O-43 Parallel Execution
            const settled = await Promise.allSettled(maskPromises);
            
            let validIntents = 0;
            
            // O-47 Senate Ledger (Voting Mechanism)
            const voteTallies: Record<string, { count: number, intent: string, targetBucket: number | undefined }> = {};

            for (let i = 0; i < settled.length; i++) {
                const result = settled[i];
                if (result.status === "fulfilled" && result.value) {
                    const fullResponse = result.value.response;
                    const maskName = result.value.mask;
                    
                    // O-139 Vector H.2: Parse Top-Down LLM AST payloads
                    let intentStr = fullResponse.trim();
                    let targetBucket: number | undefined = undefined;
                    
                    const match = fullResponse.match(/(?:BUCKET:\s*#?(\d+)[,\s]*)?AST:\s*([^\s]+)/i);
                    if (match) {
                        if (match[1]) targetBucket = parseInt(match[1], 10);
                        intentStr = match[2];
                    }

                    if (intentStr) {
                        console.log(`[ORACLE] ${maskName} translated -> "${intentStr}"${targetBucket !== undefined ? ` (Targeting Bucket #${targetBucket})` : ''}`);
                        
                        // Group identical intents. Lowercase and strip whitespace to generalize semantic similarity slightly.
                        const voteKey = `${targetBucket !== undefined ? targetBucket : 'global'}_${intentStr.toLowerCase().substring(0,25)}`;
                        if (!voteTallies[voteKey]) {
                            voteTallies[voteKey] = { count: 0, intent: intentStr, targetBucket };
                        }
                        voteTallies[voteKey].count++;
                        
                        // Emit live to HUD
                        if (this.onSenateEvent) {
                            this.onSenateEvent({ type: "VERDICT", mask: maskName, intent: intentStr, bucket: targetBucket });
                        }
                        
                        validIntents++;
                    }
                } else {
                    console.warn(`[ORACLE] A Mask failed to reach consensus or timed out.`);
                }
            }

            if (validIntents === 0) {
                throw new Error("Complete Senate Failure");
            }
            
            // O-47 Identify the Plurality Consensus
            let winningVote = Object.values(voteTallies)[0];
            for (const vote of Object.values(voteTallies)) {
                if (vote.count > winningVote.count) {
                    winningVote = vote;
                }
            }
            
            // Emit Consensus
            if (this.onSenateEvent) {
                this.onSenateEvent({ type: "CONSENSUS", mask: "SENATE", intent: winningVote.intent, count: winningVote.count, bucket: winningVote.targetBucket });
            }
            
            console.log(`[ORACLE] 🏛️ SENATE CONSENSUS ACHIEVED: Executing [${winningVote.count} Votes] -> "${winningVote.intent}"`);
            this.fulfillRequests(requests, winningVote.intent, winningVote.targetBucket);

        } catch (_e) {
            console.warn(`[ORACLE] Entire Senate failed/timeout. Emitting stochastic fallback plasmid.`);
            if (this.onSenateEvent) this.onSenateEvent({ type: "ERROR", reason: "AI Nodes Non-Responsive [FORCED_ENTROPY]" });
            this.fulfillRequests(requests, "Stochastic fallback");
        }
        
        
        this.isBusy = false;
        
        // Biological Garbage Collection limits Registry bloat natively
        // Vector F.3: Activity drives Global Energy capacity elasticity
        this.tickSomaticEconomy(count);
    }

    private fulfillRequests(requests: number[], intent: string, targetBucket?: number) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into Plasmids
        // O-139 Vector H.2: Syntactic LLM Compilation
        // We now rigorously compile the intent through pure_lambda.ts instead of regex stripping
        let hash = 0n;
        try {
            const astTerm = parseLambda(intent);
            const astStr = formatTerm(astTerm); // Normalize spacing and validation
            hash = compileMorphology(astTerm);
            
            if (!this.plasmidRegistry.has(hash)) {
                const metrics = measureIR(astTerm);
                this.plasmidRegistry.set(hash, {
                    ast: astTerm,
                    l1_cost: metrics.cost,
                    depth: metrics.depth,
                    nodes: metrics.nodes,
                    attention: 50, // Massive protective shield for LLM synthesis
                    age: 0,
                    energy: 10000, // Seed funding
                    fitness: 0,
                    mutualists: new Set()
                });
                console.log(`[SENATE] 🏛️ Top-Down Gene Injection: [${hash}] successfully compiled ${astStr}`);
            } else {
                const existing = this.plasmidRegistry.get(hash)!;
                existing.attention += 25; // Rewarding resonant convergence
                existing.energy += 5000;
            }
        } catch (_e) {
            console.error(`[SENATE] ❌ Syntactic Compilation Failed: ${intent} is not valid Pure Lambda Calculus.`);
            if (this.onSenateEvent) {
                this.onSenateEvent({ type: "ERROR", reason: `Mathematical Parsing Rejected Intent: ${intent}` });
            }
            return; // Abort physical injection if logic is dead
        }

        if (this.engine) {
            // O-23 Native WebGPU Interface
            if (targetBucket !== undefined) {
                this.pushLedgerEvent({ epoch: this.getEpochTicks(), action: "SENATE_INJECT", hash: hash.toString() });
                this.engine.injectPlasmidIntoBucket(targetBucket, hash);
                console.log(`[ORACLE] Successfully decoded algorithm and flooded Bucket #${targetBucket} with Resonance Plasmid.`);
                if (this.onBroadcast) this.onBroadcast(hash, targetBucket);
            } else {
                let success = 0;
                this.pushLedgerEvent({ epoch: this.getEpochTicks(), action: "SENATE_INJECT_GLOBAL", hash: hash.toString() });
                for (const idx of requests) {
                    this.engine.injectPlasmid(idx, hash);
                    if (this.onBroadcast) this.onBroadcast(hash, idx);
                    success++;
                }
                console.log(`[ORACLE] Successfully decoded and unlocked ${success} WebGPU cells.`);
            }
            return;
        }
        
        // Legacy WASM Interface
        let size = 0;
        if (this.wasmField.cell_count) {
            size = this.wasmField.cell_count();
        } else if (this.wasmField.width && this.wasmField.height) {
            size = this.wasmField.width * this.wasmField.height;
        }
        
        if (!this.wasmField.ptr_plasmids || !this.wasmField.ptr_cell_status) return;

        const plasmidPtr = this.wasmField.ptr_plasmids!();
        const plasmids = new BigUint64Array(this.wasmMemory.buffer, plasmidPtr, size);
        
        const statusPtr = this.wasmField.ptr_cell_status!();
        const status = new Uint8Array(this.wasmMemory.buffer, statusPtr, size);
        
        let success = 0;
        for (const idx of requests) {
            if (idx < size) {
                // Suture the idea onto the cell's genome
                plasmids[idx] = hash;
                
                // Unfreeze the cell, returning it to active temporal physics (IDLE = 0)
                status[idx] = 0;
                success++;
            }
        }
        
        console.log(`[ORACLE] Successfully decoded and unlocked ${success} cells.`);
    }
}
