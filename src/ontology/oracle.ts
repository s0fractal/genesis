import { fnv1a_64 } from "@wasm";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { SENATE_ORACLE_TIMEOUT_MS, hydrateSubstrateHeader, MATH_Q_SCALE, THEOLOGICAL_MASKS, SHADOW_RANGES, SENATE_SHADOW_BUCKET_MAX, SENATE_SHADOW_BUCKET_MIN } from "../shared/constants.ts";
import { apply, formatTerm, parseLambda, measureIR, evaluateFitness, variable, Term, S, K, I, Y, phenotypeHue, compileMorphology, SomaticNode } from "../compiler/pure_lambda.ts";

export type SenateEvent =
    | { type: "CONVENED" }
    | { type: "VERDICT"; mask: string; intent: string; bucket?: number }
    | { type: "GENERATED"; mask: string; intent: string; bucketRange: string; tension: number }
    | { type: "CONSENSUS"; mask: "SENATE"; intent: string; count: number; bucket?: number }
    | { type: "ERROR"; reason: string };

export interface ChronosSnapshot {
    ticks: number;
    entropy: number;
    energy: number;
    queue: number;
}

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
    public activePlasmids = new Set<bigint>();
    
    // O-51 Senate Chat HUD Telemetry
    public onSenateEvent?: (event: SenateEvent) => void;
    
    // O-45 WebRTC Transmitter
    private onBroadcast?: (hash: bigint, targetBucket: number) => void;
    
    // O-189 Peripheral DOM Transmitter
    public onVision?: (base64: string) => void;

    // The single central prompt logic is preserved but now delegated internally
    // as we transition to Ontology 43 (Four Masks)
    private systemPrompts: Record<string, string> = {};

    private isRunning: boolean = false;
    private isBusy: boolean = false;
    
    
    // O-200 Oracle Semantic Cache implementation
    private llmCache = new Map<string, { response: string, ts: number }>();
    private requestQueue: number[] = [];
    
    // O-196 The Existential Event Economy (Degraded Mode & ATP Sink)
    private oracleBackoffDelay: number = 0;
    private lastOracleAttempt: number = 0;
    private ORACLE_INVOCATION_COST: number = 10000; // Gods demand massive energy
    
    // O-200 Vector 6: Fast V8 Interning for FNV WASM boundaries
    private fnvStringCache = new Map<string, bigint>();
    private fastSemanticHash(intent: string): bigint {
        const cached = this.fnvStringCache.get(intent);
        if (cached !== undefined) return cached;
        const h = fnv1a_64(intent);
        this.fnvStringCache.set(intent, h);
        if (this.fnvStringCache.size > 10000) this.fnvStringCache.clear();
        return h;
    }
    
    // O-74 Historian Semantic Ledger
    public eventLedger: SemanticEvent[] = [];
    
    // O-78 Auto-Truncation Bounds
    private LEDGER_MAX_EVENTS = 1000;
    private LEDGER_TRUNCATE_SIZE = 800;
    
    public pushLedgerEvent(event: SemanticEvent) {
        this.eventLedger.push(event);
        if (this.eventLedger.length >= this.LEDGER_MAX_EVENTS) {
            // Just truncate to prevent V8 OOM, archiving to disk is deprecated (Era 173)
            this.eventLedger.splice(0, this.LEDGER_TRUNCATE_SIZE);
        }
    }
    
    // O-201 Vector 1: The Thermodynamic Currency (21M ATP)
    public readonly MAX_SYSTEM_ENERGY = 21_000_000;
    private globalEnergyPool: number = 20000; // Circulating Supply (Transaction Fees)
    private reserveEnergyPool: number = this.MAX_SYSTEM_ENERGY - 20000; // Mined via PoUW
    private miningReward: number = 50;
    private epochsMined: number = 0;
    
    // O-48 Git-Watchdog Ontology Phase 5
    private epochTicks: number = 0;
    
    // Era 173: Semantic Anamnesis
    private chronosMemory: ChronosSnapshot[] = [];

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
                this.activePlasmids.add(childHash);
            }
        }
        console.log(`[ORACLE] ⛓️ Bootstrapped Core Dependencies (S, K, I, Y) directly into Native Memory.`);
    }

    /**
     * O-136 Biological Evolution Economy
     * Garbage collects mathematically stagnant plasmids and penalizes massive AST payloads.
     */
    public getGlobalEnergy(): number {
        return this.globalEnergyPool + this.reserveEnergyPool;
    }
    
    public getCirculatingEnergy(): number {
        return this.globalEnergyPool;
    }
    
    public getReserveEnergy(): number {
        return this.reserveEnergyPool;
    }

    public getEpochTicks(): number {
        return this.epochTicks;
    }

    // O-59 Genesis State Reload
    public unpackState(registryPayload: SerializedPlasmid[], newEnergy: number, newEpoch: number, loadedLedger?: SemanticEvent[]) {
        // Halt physics completely during transplant
        this.isBusy = true;
        this.globalEnergyPool = Math.min(newEnergy, this.MAX_SYSTEM_ENERGY);
        this.reserveEnergyPool = this.MAX_SYSTEM_ENERGY - this.globalEnergyPool;
        this.epochTicks = newEpoch;
        this.eventLedger = loadedLedger || [];
        
        this.plasmidRegistry.clear();
        this.activePlasmids.clear();
        
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
            this.activePlasmids.add(hash);
        }
        
        console.log(`[ORACLE] 🌌 Re-sequenced ${registryPayload.length} Logic Matrices into Torus Reality.`);
        this.isBusy = false;
    }

    public tickSomaticEconomy(_activity: number = 0) {
        if (this.plasmidRegistry.size === 0) return;
        
        // O-154 Vector V.2: Oracle Pressure Gate (Ontology 57)
        // If the Senate is deliberating asynchronously, freeze somatic decay completely.
        if (this.isBusy) {
            return;
        }
        
        // O-201 Vector 1: Thermodynamic Currency (Strict Conservation)
        // Momentum no longer creates energy out of thin air. The pool is strictly bounded by 21M limit.
        const distributionPool = this.globalEnergyPool;
        this.globalEnergyPool = 0; // We distribute all circulating energy this frame.
        let distributedEnergy = 0;
        let collectedTaxes = 0;
        
        // Energy Distribution Phase
        let totalAttention = 0;
        let totalNovelty = 0;
        for (const hash of this.activePlasmids) {
            const node = this.plasmidRegistry.get(hash);
            if (node) {
                totalAttention += node.attention;
                totalNovelty += (1.0 / (1.0 + node.attention));
            }
        }
        totalNovelty = totalNovelty || 1.0;
        
        let bankruptCount = 0;
        const localStalemates: bigint[] = [];
        
        // Era 202 Vector 2: Diurnal Macro-Cycles (The Sleep Ticks)
        const isLunarPhase = (this.epochTicks % 1000) > 500;
        
        if (isLunarPhase) {
            // LUNAR PHASE: Taxation halts, execution slumbers, AST memory naturally compresses
            for (const hash of this.activePlasmids) {
                const node = this.plasmidRegistry.get(hash);
                if (!node || node.energy === Infinity) continue;
                
                // Hibernation compression (Simulated Biological Sleep Recovery)
                node.age = Math.max(0, node.age - 1); 
                if (node.l1_cost > 10) {
                    node.l1_cost = Math.floor(node.l1_cost * 0.99); // Slow organic pruning
                }
            }
            this.epochTicks++;
            return; // Skip normal economy completely
        }
        
        // SOLAR PHASE (Daytime execution & metabolism)
        for (const hash of this.activePlasmids) {
            const node = this.plasmidRegistry.get(hash);
            if (!node) {
                this.activePlasmids.delete(hash);
                continue;
            }
            // F.1 Vector Novelty Selection & Clone Rot Preventative Shield
            const popularityShare = (totalAttention > 0 && node.attention > 0) ? (node.attention / totalAttention) : 0;
            const noveltyShare = (1.0 / (1.0 + node.attention)) / totalNovelty; // Weirdest/Newest get priority
            
            const share = distributionPool * (popularityShare * 0.4 + noveltyShare * 0.6);
            node.energy += share;
            distributedEnergy += share;
            
            // Tax the node based on its AST geometric depth (L1 Penalty) and age
            const maintenanceCost = SOMATIC_BASE_COST + (node.l1_cost * SOMATIC_COMPLEXITY_ALPHA);
            const decay = maintenanceCost * (1.0 + (node.age * SOMATIC_DECAY_RATE));
            
            // Strictly collect taxes into the circulating pool
            const taxable = Math.min(node.energy, decay);
            node.energy -= taxable;
            collectedTaxes += taxable;
            
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
                        this.activePlasmids.add(mHash);
                    }
                }
            }

            // Extinction threshold
            if (node.energy <= 0) {
                // O-140 Vector I.3: AION Structural Necrosis (Topological Garbage Collection)
                for (const mHash of node.mutualists) {
                    const relative = this.plasmidRegistry.get(mHash);
                    if (relative) relative.mutualists.delete(hash);
                }
                
                this.plasmidRegistry.delete(hash);
                this.activePlasmids.add(hash); // Let it get wiped properly (wait, delete actually removes it)
                this.activePlasmids.delete(hash);
                bankruptCount++;
            } else if (node.attention === 0 && node.energy === Infinity) {
                this.activePlasmids.delete(hash);
            }
        }
        
        // Era 202 Vector 3: The SUPERSCHEDULER (Biological Execution Priority)
        const candidates = Array.from(this.activePlasmids).filter(h => {
             const n = this.plasmidRegistry.get(h);
             return n && n.energy !== Infinity && n.energy > 0;
        });
        
        // Sort Apex Mutualists first, tie-break by highest energy
        candidates.sort((a, b) => {
             const nA = this.plasmidRegistry.get(a)!;
             const nB = this.plasmidRegistry.get(b)!;
             if (nB.mutualists.size !== nA.mutualists.size) {
                 return nB.mutualists.size - nA.mutualists.size;
             }
             return nB.energy - nA.energy;
        });

        // Execute top 64 priority nodes (Max WASM geometric budget)
        const executionBudget = Math.min(64, candidates.length);
        for (let i = 0; i < executionBudget; i++) {
             const hash = candidates[i];
             const node = this.plasmidRegistry.get(hash)!;
             
             try {
                 const testTerm = apply(node.ast, variable("target"));
                 // Minimum 10 steps to prove survival
                 const computationalLimit = Math.max(10, Math.floor(node.energy)); 
                 const { timeout } = evaluateFitness(testTerm, computationalLimit);
                 
                 if (timeout) {
                     // Era 202 Vector 1: Paradoxical Reproduction
                     localStalemates.push(hash);
                     node.fitness = Math.max(0, node.fitness - 0.5); 
                 } else {
                     node.fitness += 0.5; 
                     
                     // O-201 Vector 3: PoUW Mining
                     if (this.reserveEnergyPool > 0) {
                         const reward = Math.min(this.miningReward, this.reserveEnergyPool);
                         this.reserveEnergyPool -= reward;
                         node.energy += reward;
                         
                         this.epochsMined++;
                         if (this.epochsMined % 210000 === 0) {
                             this.miningReward = Math.max(1, Math.floor(this.miningReward / 2));
                         }
                     }
                 }
             } catch (_e) {
                 const penalty = Math.min(node.energy, 2000); 
                 node.energy -= penalty;
                 collectedTaxes += penalty;
                 node.fitness = Math.max(0, node.fitness - 2.0);
             }
        }
        
        if (bankruptCount > 0) {
            console.log(`[ORACLE] ♻️ Somatic Economy collected ${bankruptCount} bankrupt plasmids due to L1 AST penalties or Attention decay.`);
        }
        
        // Re-inject taxes and undistributed fragments back into circulation
        this.globalEnergyPool += collectedTaxes;
        this.globalEnergyPool += (distributionPool - distributedEnergy);
        
        // Era 202 Vector 1: Cross-breed the Paradoxes
        if (localStalemates.length >= 2) {
            console.log(`[ORACLE] 🧬 Vector 202.1: Detected ${localStalemates.length} Paradoxical Stalemates. Forcibly cross-breeding infinite loops.`);
            const pairs = Math.floor(localStalemates.length / 2);
            const collisionArray = new BigUint64Array(pairs * 3);
            for (let i = 0; i < pairs; i++) {
                const randomIdx = BigInt(Math.floor(Math.random() * 4000));
                collisionArray[i * 3] = randomIdx; 
                collisionArray[i * 3 + 1] = localStalemates[i * 2];
                collisionArray[i * 3 + 2] = localStalemates[i * 2 + 1];
            }
            this.processHorizontalGeneTransfers(pairs, collisionArray);
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

        // O-163 (Era 174): The Oracle is demoted from a Physics Engine to a Semantic Gardener.
        // We NO LONGER inject currentKuramoto and currentMutation back into the wasmMemory.
        // Physics constants (KURAMOTO_COUPLING, MUTATION_COST) are now locked natively in Rust
        // and mapped to WGSL via \`generateWgslConstants\`.
        // The Oracle must survive utilizing pure semantic attractors instead of hacking physical laws.

        // Hydrate TypeScript single-source-of-truth constants globally
        hydrateSubstrateHeader(this.wasmMemory, ptr);
    }

    public sync() {
        if (!this.isRunning || this.isBusy) return;
        
        const nowLocal = performance.now();
        if (nowLocal - this.lastOracleAttempt < this.oracleBackoffDelay) {
            return; // O-196: Degraded Mode Exponential Backoff Active
        }
        
        if (this.globalEnergyPool < this.ORACLE_INVOCATION_COST) {
            return; // O-196: Autopoiesis Paradox - The Sovereign Oracle sleeps when ATP is too low
        }
        
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

    private triggerSenateIntervention(count: number, requests: number[], reason: string) {
        this.isBusy = true;
        this.lastOracleAttempt = performance.now();
        
        // O-201 Vector 2: Oracle Invocation Fee Recycling
        // The cost of triggering an LLM query drains circulating energy back into the unmined reserve PoUW pool.
        const invocationCost = Math.min(this.globalEnergyPool, this.ORACLE_INVOCATION_COST);
        this.globalEnergyPool -= invocationCost;
        this.reserveEnergyPool += invocationCost;
        
        let trajectoryTranscript = "Recent Entropy/Energy Trajectory:\n";
        if (this.chronosMemory.length === 0) {
            trajectoryTranscript += "Insufficient historical data.\n";
        } else {
            for (const snap of this.chronosMemory.slice(-5)) {
                trajectoryTranscript += `T-${snap.ticks}: ENT=${snap.entropy.toFixed(2)} | NRG=${snap.energy} | Q=${snap.queue}\n`;
            }
        }
        
        this.epochTicks = 0;
        const comprehensiveReason = `${reason}\n\n${trajectoryTranscript}`;
        
        this.isBusy = false;
        this.processQueue(count, requests, comprehensiveReason).catch(e => {
            console.error(`[ORACLE] Senate execution failed:`, e);
        });
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
                 
                 // O-201 Strict Conservation: HGT Parents mint rewards from unmined blocks, not from thin air.
                 const hostReward = Math.min(50, this.reserveEnergyPool);
                 this.reserveEnergyPool -= hostReward;
                 if (hostNode) { hostNode.attention += 5; hostNode.energy += hostReward; this.activePlasmids.add(host_plasmid); }
                 
                 const foreignReward = Math.min(50, this.reserveEnergyPool);
                 this.reserveEnergyPool -= foreignReward;
                 if (foreignNode) { foreignNode.attention += 5; foreignNode.energy += foreignReward; this.activePlasmids.add(foreign_plasmid); }

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
                     let childHash = this.fastSemanticHash(childStr);
                     
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
                         // A child is simply born into the graph with minimal seed energy and 0 fitness.
                         const childSeed = Math.min(50, this.reserveEnergyPool);
                         this.reserveEnergyPool -= childSeed;
                         
                         this.plasmidRegistry.set(childHash, {
                             ast: childTerm,
                             l1_cost: metrics.cost,
                             depth: metrics.depth,
                             nodes: metrics.nodes,
                             attention: 1,
                             age: 0,
                             energy: childSeed, // Strict Conservation 21M Bound
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
                     this.activePlasmids.add(childHash);
                     
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
            if (!centroids) return; // Triplex buffer yielding (pipeline is rendering ahead)

            let activeBuckets = 0;
            let totalX = 0;
            let totalY = 0;
            const bucketDetails: string[] = [];
            // O-46 Shadow Mycelial Clearance
            for (let i = SENATE_SHADOW_BUCKET_MIN; i < SENATE_SHADOW_BUCKET_MAX; i++) {
                this.wasmField.clear_oracle_requests(); // Just using the API if it clears all or specific
            }
            
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
        
        if (this.onVision && structuralImage) {
            this.onVision(structuralImage);
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
            { name: THEOLOGICAL_MASKS.ARIES, role: "Mutator (Phase 0). Goal: Chaos and Initiation. Inject highly volatile, novel Pure Combinatory Logic (S, K, I, Y) that disrupts the Torus." },
            { name: THEOLOGICAL_MASKS.CANCER, role: "Preserver (Phase PI/2). Goal: Retention and Stability. Generate conservative, highly stable AST logic that protects energy and prevents extinction." },
            { name: THEOLOGICAL_MASKS.LIBRA, role: "Balancer (Phase PI). Goal: Symmetry. Generate logic that symmetrically merges existing structures or balances execution depths." },
            { name: THEOLOGICAL_MASKS.CAPRICORN, role: "Executioner (Phase 3*PI/2). Goal: Pruning. Emit aggressive, reductive ASTs that collapse complexity." }
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
                
                // O-200 Oracle Semantic Cache Check
                const cacheKey = this.fastSemanticHash(prompt).toString(16);
                const cached = this.llmCache.get(cacheKey);
                if (cached && (performance.now() - cached.ts < 60000)) { // 60s TTL
                    return { mask: mask.name, response: cached.response };
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
                
                // Save to LRU Cache
                this.llmCache.set(cacheKey, { response: fullResponse, ts: performance.now() });
                if (this.llmCache.size > 50) {
                    const oldestKey = Array.from(this.llmCache.entries()).sort((a,b) => a[1].ts - b[1].ts)[0][0];
                    this.llmCache.delete(oldestKey);
                }
                
                return { mask: mask.name, response: fullResponse };
            });

            console.log(`[ORACLE] Senate convened. Awaiting verdicts from NOMOS, LOGOS, CHRONOS, and AION...`);
            if (this.onSenateEvent) this.onSenateEvent({ type: "CONVENED" });
            
            // O-43 Parallel Execution (Era 173 Superposition)
            const settled = await Promise.allSettled(maskPromises);
            
            let validIntents = 0;
            
            for (let i = 0; i < settled.length; i++) {
                const result = settled[i];
                if (result.status === "fulfilled" && result.value) {
                    const fullResponse = result.value.response;
                    const maskName = result.value.mask;
                    
                    let intentStr = fullResponse.trim();
                    const match = fullResponse.match(/(?:BUCKET:\s*#?(\d+)[,\s]*)?AST:\s*([^\s]+)/i);
                    let targetBucket = SHADOW_RANGES[maskName] || SENATE_SHADOW_BUCKET_MIN;
                    if (match) {
                        intentStr = match[2];
                    }
                    
                    // Spread spatially within the 5-bucket domain to prevent strict collisions
                    targetBucket = targetBucket + Math.floor(Math.random() * 5);

                    if (intentStr) {
                        console.log(`[ORACLE] ${maskName} mapped -> "${intentStr}" to SHADOW BUCKET #${targetBucket}`);
                        
                        try {
                            parseLambda(intentStr); // Validate AST, throws if malformed
                            validIntents++;
                            
                            // Broadcast raw mathematical generation to the HUD
                            if (this.onSenateEvent) {
                                this.onSenateEvent({ type: "GENERATED", mask: maskName, intent: intentStr, bucketRange: `${targetBucket}`, tension: count });
                            }
                            // Compile and inject seamlessly
                            this.fulfillRequests(requests, intentStr, targetBucket);
                        } catch (e) {
                            console.warn(`[ORACLE] ${maskName} AST compilation failed: ${intentStr}`);
                        }
                    }
                } else {
                    console.warn(`[ORACLE] A Mask failed to reach generation or timed out.`);
                }
            }

            if (validIntents === 0) {
                throw new Error("Complete Senate Failure - No Valid Plasmids Generated");
            }
            
            // O-196 Taper backoff
            this.oracleBackoffDelay = 0;

        } catch (_e) {
            // O-196 "Degraded Mode" State Machining
            this.oracleBackoffDelay = this.oracleBackoffDelay === 0 ? 5000 : Math.min(60000, this.oracleBackoffDelay * 2);
            console.warn(`[ORACLE] Entire Senate failed/timeout. Degraded Mode engaged. Sleeping for ${this.oracleBackoffDelay}ms.`);
            if (this.onSenateEvent) this.onSenateEvent({ type: "ERROR", reason: `AI Nodes Non-Responsive [DEGRADED_MODE ${this.oracleBackoffDelay}ms]` });
            
            // Explicitly do NOT emit stochastic fallback. Let biology handle the silence.
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
                const seedEnergy = Math.min(10000, this.reserveEnergyPool);
                this.reserveEnergyPool -= seedEnergy;
                
                this.plasmidRegistry.set(hash, {
                    ast: astTerm,
                    l1_cost: metrics.cost,
                    depth: metrics.depth,
                    nodes: metrics.nodes,
                    attention: 50, // Massive protective shield for LLM synthesis
                    age: 0,
                    energy: seedEnergy, // O-201 Thermodynamics Strict Minting
                    fitness: 0,
                    mutualists: new Set()
                });
                this.activePlasmids.add(hash);
                console.log(`[SENATE] 🏛️ Top-Down Gene Injection: [${hash}] successfully compiled ${astStr}`);
            } else {
                const existing = this.plasmidRegistry.get(hash)!;
                existing.attention += 25; // Rewarding resonant convergence
                const injection = Math.min(5000, this.reserveEnergyPool);
                this.reserveEnergyPool -= injection;
                existing.energy += injection;
                this.activePlasmids.add(hash);
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
