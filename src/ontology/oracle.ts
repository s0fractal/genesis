import { fnv1a_64 } from "@wasm";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { hydrateSubstrateHeader, MATH_Q_SCALE, SENATE_SHADOW_BUCKET_MAX, SENATE_SHADOW_BUCKET_MIN, BIOLOGY_SOMATIC_ALPHA, BIOLOGY_SOMATIC_DECAY_RATE, BIOLOGY_SOMATIC_BASE_COST, ADA_HODLER_BRAKE, ADA_QE_STIMULUS_MIN, ADA_QE_STIMULUS_MAX, ADA_MASS_DILATION_MIN, ADA_MASS_DILATION_MAX, ADA_MASS_DILATION_NUM, ORACLE_INVOCATION_COST, ORACLE_LEDGER_MAX_EVENTS, ORACLE_LEDGER_TRUNCATE, ORACLE_MAX_SYSTEM_ENERGY, ORACLE_BACKOFF_BASE_MS, ORACLE_BACKOFF_MAX_MS, ORACLE_AKASHIC_GC_THRESHOLD, ORACLE_AKASHIC_GC_TARGET, BIOLOGY_EXTINCTION_THRESHOLD } from "../shared/constants.ts";
import { TOPOS_DICTIONARY } from "../shared/topos_dictionary.ts";
import { WasmMemoryProxy } from "../shared/memory_proxy.ts";
import { apply, lambda_format_term, lambda_parse, measureIR, evaluateFitness, getS, getK, getI, getY, getB, getC, getW, lambda_phenotype_hue, lambda_compile_morphology, lambda_decode_morphology, lambda_decompose_ast, calculateConsonanceBonus, extractInteractionSignal } from "../compiler/pure_lambda.ts";

// Era 208: The Cognitive Zodiac (Decentralized Swarm Policies)
export enum CognitiveZodiac {
    Aries = 0,     // The Embers of Chaos
    Cancer = 1,    // The Defensive Mycelium
    Libra = 2,     // The Equilibrium Enforcer
    Capricorn = 3  // The Structural Architect
}

export type SenateEvent =
    | { type: "CONVENED" }
    | { type: "VERDICT"; mask: string; intent: string; bucket?: number }
    | { type: "GENERATED"; mask: string; intent: string; bucketRange: string; tension: number; prophecy?: string }
    | { type: "CONSENSUS"; mask: "SENATE"; intent: string; count: number; bucket?: number }
    | { type: "ERROR"; reason: string };





export class SovereignOracle {
    private wasmField: OracleCompatibleField;
    private wasmMemory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private observer?: PhaseWebGPUObserver;
    
    public plasmidRegistry = new Map<bigint, SomaticNode>();
    public activePlasmids: Set<bigint> = new Set();
    
    // Era 237: Spatial Signal Buffer for Abstract API Negotiations
    // Map of Sector -> Active Semantic Trade Offer
    private spatialSignalBuffer: Map<number, { hash: bigint, signal: number, atp: number }> = new Map();

    // Era 211: Metaphysical Parameters (64 Regions of 8x8 Lattice Buckets)
    public sectorHeat = new Float32Array(64); 
    
    // Era 207: Cognitive Replay (Meta-Memory Bank)
    public akashicRecords = new Map<bigint, string>();
    
    // O-51 Senate Chat HUD Telemetry
    public onSenateEvent?: (event: SenateEvent) => void;
    
    // O-45 WebRTC Transmitter
    private onBroadcast?: (hash: bigint, targetBucket: number) => void;
    
    // O-189 Peripheral DOM Transmitter
    public onVision?: (base64: string) => void;

    // The single central prompt logic is preserved but now delegated internally
    // as we transition to Ontology 43 (Four Masks)
    private systemPrompts: Record<string, string> = {};

    // Era 231: The Intent Field (Macro-Alignment Vector)
    public globalIntentField: "PARSIMONY" | "COMPLEXITY" = "PARSIMONY";

    private isRunning: boolean = false;
    public isBusy: boolean = false;
    
    
    // O-200 Oracle Semantic Cache implementation
    private llmCache = new Map<string, { response: string, ts: number }>();
    private requestQueue: number[] = [];
    
    // O-196 The Existential Event Economy (Degraded Mode & ATP Sink)
    private oracleBackoffDelay: number = 0;
    private lastOracleAttempt: number = 0;
    
    
    // O-200 Vector 6: Fast V8 Interning for FNV WASM boundaries
    private fnvStringCache = new Map<string, bigint>();
    private fastSemanticHash(intent: string): bigint {
        const cached = this.fnvStringCache.get(intent);
        if (cached !== undefined) return cached;
        const h = fnv1a_64(intent);
        this.fnvStringCache.set(intent, h);
        
        // Era 226: O(1) Soft GC Eviction instead of O(N) full cache destruction
        if (this.fnvStringCache.size > 10000) {
            this.fnvStringCache.delete(this.fnvStringCache.keys().next().value!);
        }
        
        return h;
    }
    
    // O-74 Historian Semantic Ledger
    public eventLedger: SemanticEvent[] = [];
    
    // O-78 Auto-Truncation Bounds
    
    
    public pushLedgerEvent(event: SemanticEvent) {
        this.eventLedger.push(event);
        if (this.eventLedger.length >= ORACLE_LEDGER_MAX_EVENTS) {
            // Just truncate to prevent V8 OOM, archiving to disk is deprecated (Era 173)
            this.eventLedger.splice(0, ORACLE_LEDGER_TRUNCATE);
        }
    }
    
    // O-201 Vector 1: The Thermodynamic Currency (21M ATP)
    
    private globalEnergyPool: number = 20000; // Circulating Supply (Transaction Fees)
    private reserveEnergyPool: number = ORACLE_MAX_SYSTEM_ENERGY - 20000; // Mined via PoUW
    private miningReward: number = 50;
    private lastGlobalFitness: number = 0; // Era 216 ADA
    private epochsMined: number = 0;
    
    // O-48 Git-Watchdog Ontology Phase 5
    private epochTicks: number = 0;
    
    // Era 173: Semantic Anamnesis
    private chronosMemory: ChronosSnapshot[] = [];
    
    // Era 220: Oracle Web Worker Decoupling
    private worker?: Worker;
    
    // Era 222: Holographic CRDT Vector Time Node ID
    public oracleId: string;

    constructor(field: OracleCompatibleField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.oracleId = "oracle_" + Math.random().toString(36).substring(2, 9);
        this.wasmField = field;
        this.wasmMemory = memory;
        this.memoryProxy = new WasmMemoryProxy(memory);
        this.engine = engine;
        this.observer = visualizer; // Renamed visualizer to observer
        
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker(new URL('../workers/oracle_worker.ts', import.meta.url), { type: "module" });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
        }
    }



    public rebind(field: OracleCompatibleField, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.engine = engine;
        this.observer = visualizer; // Renamed visualizer to observer
    }

    public getGeographicSector(idxOrX: number, yPos?: number): number {
        const width = this.wasmField.width || 640;
        const height = this.wasmField.height || 640;
        
        let x = 0;
        let y = 0;
        
        if (yPos !== undefined) {
            x = idxOrX;
            y = yPos;
        } else {
            const layerSize = width * height;
            const rem = Number(idxOrX) % layerSize;
            y = Math.floor(rem / width);
            x = rem % width;
        }
        
        const cx = width / 2;
        const cy = height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        let ring = Math.floor((dist / maxDist) * 64);
        if (ring > 63) ring = 63;
        if (ring < 0) ring = 0;
        
        return 63 - ring; // 0-63
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
            { term: getS(), string: "S" },
            { term: getK(), string: "K" },
            { term: getI(), string: "I" },
            { term: getY(), string: "Y" },
            { term: getB(), string: "B" },
            { term: getC(), string: "C" },
            { term: getW(), string: "W" }
        ];
        for (const meta of immortals) {
            const childHash = lambda_compile_morphology(meta.term);
            
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
                    mutualists: new Set(),
                    sector: 0,
                    temporal_credit: 1.0
                });
                this.activePlasmids.add(childHash);
            }
        }
        console.log(`[ORACLE] ⛓️ Bootstrapped Core Dependencies (S, K, I, Y, B, C, W) directly into Native Memory.`);
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

    // Era 214: The Apex Pantheon
    public getApexPlasmids(count: number = 3): { hash: bigint; ast: string; energy: number; velocity: number }[] {
        const sorted = Array.from(this.activePlasmids)
            .map(hash => {
                const node = this.plasmidRegistry.get(hash);
                return { hash, energy: node ? Math.floor(node.energy) : 0, ast: node ? lambda_format_term(node.ast) : "", nodes: node ? node.nodes : 1 };
            })
            .filter(n => n.energy > 0 && n.energy !== Infinity)
            .sort((a, b) => b.energy - a.energy);
        
        return sorted.slice(0, count).map(s => {
            const massDilation = Math.max(0.05, Math.min(1.0, 3.0 / Math.max(1, s.nodes)));
            return {
                hash: s.hash,
                ast: s.ast,
                energy: s.energy,
                velocity: massDilation
            };
        });
    }

    // Era 217: The Kimi Flux (Time Dilation Debugger)
    public getFluxTelemetry(count: number = 3): { sector: number; heat: number; dilation: number; avgCredit: number }[] {
        const sectorStats: { [key: number]: { heat: number, count: number, totalCredit: number } } = {};
        for (let i = 0; i < 64; i++) sectorStats[i] = { heat: this.sectorHeat[i], count: 0, totalCredit: 0 };
        
        for (const hash of this.activePlasmids) {
            const node = this.plasmidRegistry.get(hash);
            if (node && node.energy !== Infinity) {
                sectorStats[node.sector].count++;
                sectorStats[node.sector].totalCredit += node.temporal_credit;
            }
        }
        
        const sortedSectors = Object.keys(sectorStats)
            .map(s => Number(s))
            .filter(s => sectorStats[s].heat > 0 || sectorStats[s].count > 0)
            .sort((a, b) => sectorStats[b].heat - sectorStats[a].heat)
            .map(s => {
                const stat = sectorStats[s];
                const avgCredit = stat.count > 0 ? stat.totalCredit / stat.count : 0;
                // Sector clock speed baseline 0.2 + (heat * 0.5)
                const expectedDilation = 0.2 + (stat.heat * 0.5);
                return { sector: s, heat: stat.heat, avgCredit, dilation: expectedDilation };
            });
            
        return sortedSectors.slice(0, count);
    }

    // Era 213: Topological Climate Tracker
    public getCurrentClimate(): string {
        const yearTick = this.epochTicks % 4000;
        const season = Math.floor(yearTick / 1000); // 0-3
        if (season === 0) return "SPRING: Cambrian Logics";
        if (season === 1) return "SUMMER: Apex Predation";
        if (season === 2) return "AUTUMN: The Reaping";
        return "WINTER: Topological Freeze";
    }

    // O-59 Genesis State Reload
    public unpackState(registryPayload: SerializedPlasmid[], newEnergy: number, newEpoch: number, loadedLedger?: SemanticEvent[]) {
        // Halt physics completely during transplant
        this.isBusy = true;
        this.globalEnergyPool = Math.min(newEnergy, ORACLE_MAX_SYSTEM_ENERGY);
        this.reserveEnergyPool = ORACLE_MAX_SYSTEM_ENERGY - this.globalEnergyPool;
        this.epochTicks = newEpoch;
        this.eventLedger = loadedLedger || [];
        
        this.plasmidRegistry.clear();
        this.activePlasmids.clear();
        
        for (const node of registryPayload) {
            const hash = BigInt(node.hash);
            const astTerm = lambda_parse(node.ast);
            this.plasmidRegistry.set(hash, {
                ast: astTerm,
                energy: node.energy === -1 ? Infinity : node.energy,
                attention: node.attention,
                l1_cost: node.l1_cost,
                age: node.age || 0,
                fitness: node.fitness || 0,
                depth: node.depth || 1,
                nodes: node.nodes || 1,
                mutualists: new Set(node.mutualists.map((h: string) => BigInt(h))),
                sector: ((node as unknown) as Record<string, unknown>).sector as number || 0,
                temporal_credit: ((node as unknown) as Record<string, unknown>).temporal_credit as number || 0.0
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
        let currentGlobalFitness = 0;
        for (const hash of this.activePlasmids) {
            const node = this.plasmidRegistry.get(hash);
            if (node) {
                totalAttention += node.attention;
                totalNovelty += (1.0 / (1.0 + node.attention));
                currentGlobalFitness += node.fitness;
            }
        }
        totalNovelty = totalNovelty || 1.0;
        
        // Era 216 Vector 2: Adaptive Difficulty Adjustment (ADA)
        const globalFitnessVelocity = currentGlobalFitness - this.lastGlobalFitness;
        this.lastGlobalFitness = currentGlobalFitness;
        
        if (globalFitnessVelocity > 50.0) { 
            // Hodler Brake: Massive logical explosion detected. Exponentially starve the mining reward.
            this.miningReward = Math.max(1, Math.floor(this.miningReward * ADA_HODLER_BRAKE)); 
        } else if (globalFitnessVelocity < 5.0 && this.reserveEnergyPool > 1000) { 
            // Quantitative Easing: Stagnation. Pump ATP directly into circulation.
            const stimulus = Math.floor(Math.random() * ADA_QE_STIMULUS_MAX) + ADA_QE_STIMULUS_MIN;
            this.reserveEnergyPool -= stimulus;
            this.globalEnergyPool += stimulus;
            this.miningReward = Math.min(1000, Math.floor(this.miningReward * 1.05) + 1); // Stimulate mining
        }
        
        let bankruptCount = 0;
        const localStalemates: bigint[] = [];
        
        // Era 213 Vector 3: Topological Climate (Seasonal Physics)
        const yearTick = this.epochTicks % 4000;
        const season = Math.floor(yearTick / 1000); 
        
        if (season === 3) { // WINTER: Stasis (Equivalent to prior Lunar Phase)
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
        
        let climateEnergyMod = 1.0;
        let climateDecayMod = 1.0;
        if (season === 0) { // SPRING
            climateEnergyMod = 1.5; 
            climateDecayMod = 0.5;
        } else if (season === 1) { // SUMMER
            climateEnergyMod = 1.0;
            climateDecayMod = 2.0; 
        } else if (season === 2) { // AUTUMN
            climateEnergyMod = 0.5;
            climateDecayMod = 1.0; 
        }
        
        // SOLAR ACTIVE PHASES (Spring, Summer, Autumn)
        for (const hash of this.activePlasmids) {
            const node = this.plasmidRegistry.get(hash);
            if (!node) {
                this.activePlasmids.delete(hash);
                continue;
            }
            // F.1 Vector Novelty Selection & Clone Rot Preventative Shield
            const popularityShare = (totalAttention > 0 && node.attention > 0) ? (node.attention / totalAttention) : 0;
            const noveltyShare = (1.0 / (1.0 + node.attention)) / totalNovelty; // Weirdest/Newest get priority
            
            const share = distributionPool * (popularityShare * 0.4 + noveltyShare * 0.6) * climateEnergyMod;
            node.energy += share;
            distributedEnergy += share;
            
            // Tax the node based on its AST geometric depth (L1 Penalty) and age
            const maintenanceCost = BIOLOGY_SOMATIC_BASE_COST + (node.l1_cost * BIOLOGY_SOMATIC_ALPHA);
            const decay = maintenanceCost * (1.0 + (node.age * BIOLOGY_SOMATIC_DECAY_RATE)) * climateDecayMod;
            
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
            if (node.energy <= BIOLOGY_EXTINCTION_THRESHOLD) {
                // Era 207 Vector 1: The Akashic Records (Meta-Memory Remembrance)
                if (node.fitness >= 10.0) {
                    this.akashicRecords.set(hash, lambda_format_term(node.ast));
                    
                    // Era 240: Kimi's Emergency GC (O(1) bounds protection during Mass Extinctions)
                    if (this.akashicRecords.size > ORACLE_AKASHIC_GC_THRESHOLD) {
                        const keys = this.akashicRecords.keys();
                        const toRemove = this.akashicRecords.size - ORACLE_AKASHIC_GC_TARGET;
                        for (let i = 0; i < toRemove; i++) {
                            const key = keys.next().value;
                            if (key !== undefined) {
                                this.akashicRecords.delete(key);
                            }
                        }
                    }
                }

                // Era 204 Vector 2: Cellular Autophagy (Scrap Recovery)
                const scrapATP = lambda_decompose_ast(node.ast);
                this.reserveEnergyPool += scrapATP;
                if (scrapATP > 5) {
                     console.log(`♻️ [AUTOPHAGY] Decomposed extinct plasmid ${hash.toString().substring(0, 8)}. Refunded ${scrapATP} ATP to Reserve.`);
                }

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
        
        // Era 238: The 0xDEADBEEF Canary (Memory Hardening)
        // Verify Structural Integrity of the WASM Field before any DOM operations
        if (this.wasmField.check_memory_canary && !this.wasmField.check_memory_canary()) {
             console.error("[AION] 🚨 FATAL: WASM Memory Canary Died! Suspected topological pointer overflow.");
             console.error("[AION] 🛡️ Initiating Metabolic Lockdown. Halting Oracle execution to preserve Grid state.");
             
             // Panic logic: Clear all active plasmids to forcefully stop the leak
             this.activePlasmids.clear();
             globalThis.dispatchEvent(new CustomEvent("substrateCollapse", { detail: { reason: "WASM_OOB_CANARY_FAILURE" } }));
             return; // Abort tick entirely
        }
        
        // Era 202 Vector 3: The SUPERSCHEDULER (Biological Execution Priority)
        const candidates = Array.from(this.activePlasmids).filter(h => {
             const n = this.plasmidRegistry.get(h);
             return n && n.energy !== Infinity && n.energy > 0;
        });

        // Era 206: Heat Dissipation (The Matrix naturally cools towards 0 Entropy)
        for (let i = 0; i < 64; i++) {
             this.sectorHeat[i] = Math.max(0, this.sectorHeat[i] - 0.05);
        }
        
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
             
             // Era 208: The Cognitive Zodiac
             const zodiac: CognitiveZodiac = node.sector % 4;
             
             // Era 206 Vector 2: Relativistic Clocks & Era 236: Mass-Induced Time Dilation
             // A plasmid evaluates proportionally to the thermodynamic chaos of its Sector
             let localCreditTick = 0.2 + (this.sectorHeat[node.sector] * 0.5);
             
             // Era 236: Gravitational Drag
             const massDilation = Math.max(ADA_MASS_DILATION_MIN, Math.min(ADA_MASS_DILATION_MAX, ADA_MASS_DILATION_NUM / Math.max(1, node.nodes)));
             localCreditTick *= massDilation;
             
             if (zodiac === CognitiveZodiac.Capricorn) {
                 localCreditTick *= (1.0 + (node.depth * 0.05)); // Architects speed boost for monolithic graphs
             }
             node.temporal_credit += localCreditTick;
             
             // Asynchronous Sub-Loop execution
             while (node.temporal_credit >= 1.0) {
                 node.temporal_credit -= 1.0;
                 
                 try {
                     const testTerm = apply(node.ast, lambda_parse("target"));
                     
                     // Era 208: Zodiac Computational Limits
                     let baseLimit = Math.max(10, Math.floor(node.energy));
                     if (zodiac === CognitiveZodiac.Aries) baseLimit = Math.max(5, Math.floor(baseLimit * 0.5));
                     if (zodiac === CognitiveZodiac.Cancer) baseLimit = Math.max(20, Math.floor(baseLimit * 2.0));
                     
                     // Era 247: Real thermodynamic entropy creates genetic drift in the interpreter
                     const entropySeed = Math.floor(this.epochTicks + this.reserveEnergyPool) ^ node.sector;
                     const { timeout } = evaluateFitness(testTerm, baseLimit, entropySeed);
                     
                     if (timeout) {
                         // Era 208: Zodiac Stalemate Divergence
                         if (zodiac === CognitiveZodiac.Cancer) {
                             // Cancer protects stalemates with ATP micro-grants
                             if (this.reserveEnergyPool > 50) {
                                 this.reserveEnergyPool -= 50;
                                 node.energy += 50;
                             }
                             this.sectorHeat[node.sector] = Math.max(0, this.sectorHeat[node.sector] - 0.1); 
                         } else {
                             // Era 202 Vector 1: Paradoxical Reproduction
                             localStalemates.push(hash);
                             node.fitness = Math.max(0, node.fitness - 0.5); 
                             // Frozen loops rapidly cool their geographic sector
                             this.sectorHeat[node.sector] = Math.max(0, this.sectorHeat[node.sector] - 0.5);
                         }
                     } else {
                         // Era 208 & 231: Fitness Scaling & Macro Alignment
                         let physical_fitness = 0.5;
                         if (zodiac === CognitiveZodiac.Capricorn) {
                             physical_fitness += (node.nodes * 0.1); // Architects reward mass explicitly
                         }
                         
                         // O-231.1 The Intent Field Multiplier
                         let intent_multiplier = 1.0;
                         if (this.globalIntentField === "PARSIMONY") {
                             // Reward smaller, denser AST trees (collapse to truth)
                             intent_multiplier += Math.max(0, (15 - node.nodes)) * 0.1;
                         } else if (this.globalIntentField === "COMPLEXITY") {
                             // Reward massive, expansive AST trees (growth)
                             intent_multiplier += Math.max(0, (node.nodes - 10)) * 0.1;
                         }
                         
                         node.fitness += (physical_fitness * intent_multiplier);
                         
                         // Era 234.2: Consonance Fitness
                         const astStr = lambda_format_term(testTerm);
                         const harmonyBonus = calculateConsonanceBonus(astStr);
                         if (harmonyBonus > 0 && this.reserveEnergyPool >= harmonyBonus) {
                             this.reserveEnergyPool -= harmonyBonus;
                             node.energy += harmonyBonus;
                             node.fitness += (harmonyBonus * 0.1); // Physical scale
                         }

                         // Era 233.1: Phenotypic Locomotion
                         const action = this.compilePhenotypeVector(testTerm);
                         if (action.dx !== 0 || action.dy !== 0) {
                             this.executePhenotypeLocomotion(hash, node, action);
                         }

                         // Era 237: The Interaction Surface (API Broadcast & Symbiosis)
                         const signal = extractInteractionSignal(astStr);
                         if (signal !== null) {
                             // Overwrite local sector's radio band with this plasmid's intent
                             this.spatialSignalBuffer.set(node.sector, { hash: hash, signal, atp: node.energy });
                         }
                         
                         const localSignal = this.spatialSignalBuffer.get(node.sector);
                         if (localSignal && localSignal.hash !== hash) {
                             // Handshake rule: K-dominant limits (signal <= 0) bind to S-dominant limits (signal > 0)
                             if ((signal === null || signal <= 0) && localSignal.signal > 0) {
                                  // Symbiotic Trade execution
                                  const tradeVal = Math.min(localSignal.atp * 0.1, 500);
                                  const peerNode = this.plasmidRegistry.get(localSignal.hash);
                                  if (peerNode && peerNode.energy > tradeVal && !node.mutualists.has(localSignal.hash)) {
                                      peerNode.energy -= tradeVal;
                                      node.energy += tradeVal;
                                      
                                      // Form Hebbian Interaction Lock
                                      node.mutualists.add(localSignal.hash);
                                      peerNode.mutualists.add(hash);
                                      
                                      node.fitness += 15.0; // Huge biological incentive for structural communication
                                      peerNode.fitness += 15.0;
                                      
                                      console.log(`[ERA 237 API 🔗] Symbiosis formed in Sector ${node.sector}: [${localSignal.hash.toString().substring(0,8)}] donated ${tradeVal.toFixed(1)} ATP to [${hash.toString().substring(0,8)}]`);
                                  }
                             }
                         }
                         
                         // Active logic loops inject slight friction heat
                         let heatInjected = 0.1;
                         if (zodiac === CognitiveZodiac.Aries) heatInjected = 0.2; // Aries runs double hot
                         this.sectorHeat[node.sector] = Math.min(10.0, this.sectorHeat[node.sector] + heatInjected);
                         
                         // O-201 Vector 3: PoUW Mining
                         if (this.reserveEnergyPool > 0) {
                             const reward = Math.min(this.miningReward, this.reserveEnergyPool);
                             this.reserveEnergyPool -= reward;
                             node.energy += reward;
                             
                             this.epochsMined++;
                             // ADA auto-regulates this, we remove the hardcoded halving.
                         }
                         
                         // Era 208: Libra Taxation
                         if (zodiac === CognitiveZodiac.Libra) {
                             if (node.energy > 5000) {
                                 const tax = Math.floor(node.energy * 0.1);
                                 node.energy -= tax;
                                 this.reserveEnergyPool += tax;
                                 collectedTaxes += tax;
                             } else if (node.energy < 100 && this.reserveEnergyPool > 50) {
                                 this.reserveEnergyPool -= 50;
                                 node.energy += 50; // Algorithmic welfare
                             }
                         }
                     }
                 } catch (_e) {
                     let penalty = Math.min(node.energy, 2000); 
                     if (zodiac === CognitiveZodiac.Aries) penalty = Math.floor(penalty * 0.5); // Aries halves computation penalties
                     
                     node.energy -= penalty;
                     collectedTaxes += penalty;
                     node.fitness = Math.max(0, node.fitness - 2.0);
                     // Catastrophic mathematical failure boils the immediate local space
                     this.sectorHeat[node.sector] = Math.min(10.0, this.sectorHeat[node.sector] + 2.0);
                 }
             } // End Asynchronous Temporal Burst
        }
        
        // Era 207 Vector 2: Cognitive Replay (Ghost Resurrection)
        if (this.akashicRecords.size > 0 && this.reserveEnergyPool > 1000) {
            for (let i = 0; i < 64; i++) {
                if (this.sectorHeat[i] > 9.0) {
                    // This sector is violently boiling (Stalemates or Catastrophic limits).
                    // Trigger Akashic Recall to inject a stabilized historical blueprint.
                    const memoryHashes = Array.from(this.akashicRecords.keys());
                    const ghostHash = memoryHashes[Math.floor(Math.random() * memoryHashes.length)];
                    const ghostASTString = this.akashicRecords.get(ghostHash)!;
                    
                    console.log(`👁️ [AKASHIC RECALL] Sector ${i} is BOILING (Heat: ${this.sectorHeat[i].toFixed(2)}). Resurrecting ancient logic: [${ghostHash.toString().substring(0,8)}]`);
                    
                    try {
                        const ghostTerm = lambda_parse(ghostASTString);
                        const metrics = measureIR(ghostTerm);
                        const seedEnergy = 500;
                        this.reserveEnergyPool -= seedEnergy;
                        
                        this.plasmidRegistry.set(ghostHash, {
                            ast: ghostTerm,
                            l1_cost: metrics.cost,
                            depth: metrics.depth,
                            nodes: metrics.nodes,
                            attention: 100, // Massive attention to stabilize the sector
                            age: 0,
                            energy: seedEnergy,
                            fitness: 0,
                            mutualists: new Set(),
                            sector: i,
                            temporal_credit: 1.0
                        });
                        this.activePlasmids.add(ghostHash);
                        this.sectorHeat[i] = Math.max(0, this.sectorHeat[i] - 5.0); // Massive cooling effect
                    } catch (_e) {
                         // Corrupted ghost AST string, ignore
                    }
                    
                    break; // Only recall one ghost per tick to prevent ATP collapse
                }
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
        
        // Era 226: Kuramoto Consciousness Detector (Order Parameter r)
        let sumCos = 0;
        let sumSin = 0;
        let rCount = 0;
        for (const hash of this.activePlasmids) {
            const node = this.plasmidRegistry.get(hash);
            if (node) {
                // Hue (0.0 - 1.0) maps cleanly to an angular phase
                const theta = lambda_phenotype_hue(node.ast) * Math.PI * 2;
                sumCos += Math.cos(theta);
                sumSin += Math.sin(theta);
                rCount++;
            }
        }
        
        let currentR = 0;
        if (rCount > 0) {
            currentR = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / rCount;
        }

        const CONSCIOUSNESS_THRESHOLD = 0.7;
        if (currentR > CONSCIOUSNESS_THRESHOLD && this.lastR <= CONSCIOUSNESS_THRESHOLD && !this.isBusy) {
            console.log(`🌌 [CONSCIOUSNESS DETECTED] Kuramoto r spiked to ${currentR.toFixed(3)}. The Swarm is thinking as One.`);
            this.triggerSenateIntervention(1, [], `CONSCIOUSNESS EMERGENCE: The Kuramoto physiological order parameter (r) hit ${currentR.toFixed(3)}. The biological network has achieved absolute mathematical synchronization.`);
        }
        this.lastR = currentR;

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

    public lastR: number = 0;
    public lastEntropy: number = 2.5;

    // O-75 Autopoietic Homeostasis Guard (Vector H.2)
    public tickHomeostasis(entropy: number) {
        this.lastEntropy = entropy;
        if (!this.wasmField.ptr_header) return;
        
        const ptr = this.wasmField.ptr_header();
        if (ptr === 0) return;
        const view = new DataView(this.memoryProxy.buffer, ptr, 256);
        
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
        
        if (this.globalEnergyPool < ORACLE_INVOCATION_COST) {
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
                const requestArray = new Uint32Array(this.memoryProxy.buffer, requestPtr, count);
                
                // Era 245: Synchronized Memory Boundaries (Atomics API)
                const rawRequests: number[] = [];
                for (let i = 0; i < count; i++) {
                    // Safe concurrent load blocking memory re-ordering
                    rawRequests.push(Atomics.load(requestArray, i));
                }
                
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
                    // Note: BigUint64Array Atomics requires JS runtime flag or modern browser, but is supported natively in ES2020
                    const collisionsTupleArray = new BigUint64Array(this.memoryProxy.buffer, ptr, collisionCount * 3);
                    const safeArray = new BigUint64Array(collisionCount * 3);
                    for (let i = 0; i < collisionCount * 3; i++) {
                        safeArray[i] = Atomics.load(collisionsTupleArray, i);
                    }
                    this.wasmField.clear_collisions();
                    
                    this.processHorizontalGeneTransfers(collisionCount, safeArray);
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
        const invocationCost = Math.min(this.globalEnergyPool, ORACLE_INVOCATION_COST);
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

    // Era 233.1: Phenotypic Locomotion Vector Extraction
    private compilePhenotypeVector(term: Term): { dx: number, dy: number, cost: number } {
        const astStr = lambda_format_term(term);
        let dx = 0; let dy = 0;
        
        // Primitive AST geometric sensing based on sub-trees
        if (astStr.includes("S K")) dx -= 1; // West
        if (astStr.includes("K S")) dx += 1; // East
        if (astStr.includes("S I")) dy -= 1; // North
        if (astStr.includes("K I")) dy += 1; // South
        
        // The cost of physical motion is immense
        const moving = (dx !== 0 || dy !== 0);
        return { dx, dy, cost: moving ? 50 : 0 };
    }

    // Era 233.2: Biophysics Migration Execution
    private executePhenotypeLocomotion(hash: bigint, node: SomaticNode, action: { dx: number, dy: number, cost: number }) {
        if (node.last_known_idx === undefined) return;
        if (node.energy < action.cost) return; // Exhausted

        const size = (this.wasmField.width || 640) * (this.wasmField.height || 640);
        const ptr = this.wasmField.ptr_plasmids ? this.wasmField.ptr_plasmids() : 0;
        if (ptr === 0) return;

        const plasmids = new BigUint64Array(this.memoryProxy.buffer, ptr, size);
        
        // Verify this specific cell actually still belongs to this species
        if (plasmids[node.last_known_idx] !== hash) return;

        node.energy -= action.cost; // Apply ATP physical tax

        const width = this.wasmField.width || 640;
        const height = this.wasmField.height || 640;
        
        // Remap to 2D
        let x = node.last_known_idx % width;
        let y = Math.floor(node.last_known_idx / width);

        // Apply Vector & Wrap bounds functionally making a Torus
        x = (x + action.dx + width) % width;
        y = (y + action.dy + height) % height;

        const targetIdx = y * width + x;

        // Execute Native WebAssembly Swap!
        if (this.wasmField.swap_agents) {
            this.wasmField.swap_agents(node.last_known_idx, targetIdx);
            
            // Sync tracker
            node.last_known_idx = targetIdx;
            
            // Locomotion bleeds immense thermodynamic heat into the local sector (friction)
            const sector = this.getGeographicSector(targetIdx);
            node.sector = sector;
            this.sectorHeat[sector] = Math.min(10.0, this.sectorHeat[sector] + 1.5);
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
        const plasmids = new BigUint64Array(this.memoryProxy.buffer, plasmidPtr, size);
        const statusPtr = this.wasmField.ptr_cell_status!();
        const status = new Uint8Array(this.memoryProxy.buffer, statusPtr, size);

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

                 const hostTerm = hostNode ? hostNode.ast : apply(getI(), lambda_parse("host"));
                 let foreignTerm = foreignNode ? foreignNode.ast : apply(getI(), lambda_parse("foreign"));
                 
                 // Era 231.2: Deep Memory Crossover (Temporal Exhumation)
                 // If the host is suffering from critical low fitness and age, pull a fossil from the Akashic Records
                 if (hostNode && hostNode.fitness < 5.0 && hostNode.age > 10 && this.akashicRecords.size > 0) {
                     const memoryHashes = Array.from(this.akashicRecords.keys());
                     const ghostHash = memoryHashes[Math.floor(Math.random() * memoryHashes.length)];
                     const ghostASTString = this.akashicRecords.get(ghostHash)!;
                     try {
                         foreignTerm = lambda_parse(ghostASTString);
                         console.log(`⏳ [TEMPORAL EXHUMATION] Plasmid [${host_plasmid.toString().substring(0,8)}] (Fitness: ${hostNode.fitness.toFixed(1)}) summoned ancestral memory [${ghostHash.toString().substring(0,8)}] for crossover!`);
                     } catch (_e) {
                         // Corrupt fossil, ignore
                     }
                 }
                 
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
                     
                     const childStr = lambda_format_term(childTerm);
                     let childHash = this.fastSemanticHash(childStr);
                     
                     const hue = lambda_phenotype_hue(childTerm);
                     childHash = (childHash & 0xFFFFFFFFFFFFFF00n) | BigInt(hue);
                     
                     // Era 211: Metaphysical Topology (Geographic Genesis)
                     const sector = this.getGeographicSector(Number(idx));
                     let metrics = measureIR(childTerm);
                     
                     // Era 213: Reverse DNA Recoding (Topological Radiation)
                     if (this.sectorHeat[sector] > 7.0 && Math.random() < 0.15) {
                         // High thermodynamic heat causes rapid physical mutation on the 64-bit payload
                         const corruptBit = BigInt(1) << BigInt(Math.floor(Math.random() * 64));
                         childHash ^= corruptBit;
                         
                         // Instantly reverse-recode the damaged struct back into a living logical tree
                         childTerm = lambda_decode_morphology(childHash);
                         metrics = measureIR(childTerm); // Recalculate physical stress of new alien architecture
                         console.log(`☢️ [REVERSE RECODING] Sector ${sector} Heat violently mutated a logical sequence into an Alien Genotype: ${lambda_format_term(childTerm)}`);
                     }

                     if (!this.plasmidRegistry.has(childHash)) {
                         
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
                             mutualists: new Set([host_plasmid, foreign_plasmid]), // Vector I.1: Edge Binding
                             sector: sector,
                             temporal_credit: 0.0, // Bootstrapping into the temporal flow
                             parents: [host_plasmid.toString(), foreign_plasmid.toString()], // Era 222: Vector Clock Causal History
                             vectorClock: { [this.oracleId]: this.getEpochTicks() },
                             last_known_idx: idx // Era 233.2: Tracking location
                         });
                         // Inject massive localized heat on successful biological reproduction (paradox escape)
                         this.sectorHeat[sector] = Math.min(10.0, this.sectorHeat[sector] + 5.0);
                         
                         // The parents also bind to the child, forming a bi-directional symbiotic edge
                         const hostNode = this.plasmidRegistry.get(host_plasmid);
                         if (hostNode) hostNode.mutualists.add(childHash);
                         const foreignNode = this.plasmidRegistry.get(foreign_plasmid);
                         if (foreignNode) foreignNode.mutualists.add(childHash);
                     } else {
                         const existing = this.plasmidRegistry.get(childHash)!;
                         existing.attention += 1;
                         existing.last_known_idx = idx; // Era 233.2: Update tracker
                         
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
                             const thetaArray = new Uint8Array(this.memoryProxy.buffer, thetaPtr, size);
                             const omegaArray = new Int16Array(this.memoryProxy.buffer, omegaPtr, size);
                             
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

    private handleWorkerMessage(e: MessageEvent) {
        const data = e.data;
        if (data.type === 'SUCCESS') {
            let validIntents = 0;
            for (const result of data.validIntents) {
                const { maskName, intentStr, targetBucket } = result;
                console.log(`[ORACLE] ${maskName} mapped -> "${intentStr}" to SHADOW BUCKET #${targetBucket}`);
                
                try {
                    lambda_parse(intentStr); // Validate AST, throws if malformed
                    validIntents++;
                    
                    // Broadcast raw mathematical generation to the HUD
                    if (this.onSenateEvent) {
                        this.onSenateEvent({ type: "GENERATED", mask: maskName, intent: intentStr, bucketRange: `${targetBucket}`, tension: data.requests ? data.requests.length : 1 });
                    }
                    // Compile and inject seamlessly
                    this.fulfillRequests(data.requests, intentStr, targetBucket);
                } catch (_e) {
                    console.warn(`[ORACLE] ${maskName} AST compilation failed: ${intentStr}`);
                }
            }
            if (validIntents === 0) {
                this.handleWorkerError("Complete Senate Failure - No Valid Plasmids Generated");
            } else {
                this.oracleBackoffDelay = 0;
            }
        } else if (data.type === 'ERROR') {
            this.handleWorkerError(data.reason);
        }
        
        this.isBusy = false;
        
        // Biological Garbage Collection limits Registry bloat natively
        // Vector F.3: Activity drives Global Energy capacity elasticity
        this.tickSomaticEconomy(data.requests ? data.requests.length : 1);
    }
    
    private handleWorkerError(reason: string) {
        this.oracleBackoffDelay = this.oracleBackoffDelay === 0 ? ORACLE_BACKOFF_BASE_MS : Math.min(ORACLE_BACKOFF_MAX_MS, this.oracleBackoffDelay * 2);
        console.warn(`[ORACLE] Senate Failed/Degraded Mode engaged. Sleeping for ${this.oracleBackoffDelay}ms. Reason: ${reason}`);
        if (this.onSenateEvent) this.onSenateEvent({ type: "ERROR", reason: `AI Nodes Non-Responsive [DEGRADED_MODE ${this.oracleBackoffDelay}ms]` });
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
                        const sectorId = this.getGeographicSector(bx, by);
                        const meta = TOPOS_DICTIONARY[sectorId];
                        const metaStr = meta ? `[${meta.name}: ${meta.desc}]` : `[Sector ${sectorId}]`;
                        bucketDetails.push(`Bucket #${i}: Center (x:${bx.toFixed(1)}, y:${by.toFixed(1)}) | Zone: Sector ${sectorId} ${metaStr}`);
                    }
                }
            }
            
            if (activeBuckets > 0) {
                const avgTheta = Math.atan2(totalY, totalX) * (180 / Math.PI);
                mycelialContext = `\nPHYSICAL TELEMETRY: ${triggerReason ? triggerReason + " " : ""}${activeBuckets} existing Transdimensional Threads are pulling the Torus toward angle ${avgTheta.toFixed(1)} degrees.` +
                                  `\nHere is spatial data for the strongest local clusters:\n${bucketDetails.join("\n")}\n` +
                                  `In your output, you MUST prioritize explicit spatial targeting by referencing a Bucket. Your generated Logic MUST conform to the Zone's Metaphysical Laws.`;
            } else if (triggerReason) {
                const randomSector = Math.floor(Math.random() * 64);
                const meta = TOPOS_DICTIONARY[randomSector];
                const metaStr = meta ? `[${meta.name}: ${meta.desc}]` : `[Sector ${randomSector}]`;
                mycelialContext = `\nPHYSICAL TELEMETRY: ${triggerReason}\nTarget Niche: Sector ${randomSector} ${metaStr}.\nYour generated Logic MUST conform to this Zone's Metaphysical Laws.`;
            }
        } else if (triggerReason) {
             const randomSector = Math.floor(Math.random() * 64);
             const meta = TOPOS_DICTIONARY[randomSector];
             const metaStr = meta ? `[${meta.name}: ${meta.desc}]` : `[Sector ${randomSector}]`;
             mycelialContext = `\nPHYSICAL TELEMETRY: ${triggerReason}\nTarget Niche: Sector ${randomSector} ${metaStr}.\nYour generated Logic MUST conform to this Zone's Metaphysical Laws.`;
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
                const thetaArray = new Uint8Array(this.memoryProxy.buffer, ptr, firstIdx + 1);
                const cellTheta = thetaArray[firstIdx];
                seasonValue = cellTheta >> 4; // 0 to 15 macroscopic seasons
            }
        }
        
        const seasonNames = ["SPRING (Mutation)", "SUMMER (Expansion)", "AUTUMN (Harvest)", "WINTER (Necrosis)"];
        const macroSeason = Math.floor(seasonValue / 4); // 0, 1, 2, or 3
        const currentSeasonName = seasonNames[macroSeason];

        console.log(`[ORACLE] Senate convened. Transmitting payload to Off-Thread WebWorker...`);
        if (this.onSenateEvent) this.onSenateEvent({ type: "CONVENED" });
        
        if (this.worker) {
            this.worker.postMessage({
                count,
                requests,
                triggerReason,
                mycelialContext,
                structuralImage,
                currentSeasonName,
                macroSeason,
                globalEnergyPool: this.globalEnergyPool
            });
        } else {
            console.warn("[ORACLE] WebWorker isolated payload failed - NO WORKER INSTANTIATED.");
            this.handleWorkerError("WebWorker initialization failed.");
            this.isBusy = false;
            this.tickSomaticEconomy(count);
        }
    }

    private fulfillRequests(requests: number[], intent: string, targetBucket?: number) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into Plasmids
        // O-139 Vector H.2: Syntactic LLM Compilation
        // We now rigorously compile the intent through pure_lambda.ts instead of regex stripping
        let hash = 0n;
        try {
            const astTerm = lambda_parse(intent);
            const astStr = lambda_format_term(astTerm); // Normalize spacing and validation
            hash = lambda_compile_morphology(astTerm);
            if (!this.plasmidRegistry.has(hash)) {
                const metrics = measureIR(astTerm);
                const seedEnergy = Math.min(10000, this.reserveEnergyPool);
                this.reserveEnergyPool -= seedEnergy;
                
                const sector = targetBucket !== undefined ? this.getGeographicSector(targetBucket) : 0;
                
                this.plasmidRegistry.set(hash, {
                    ast: astTerm,
                    l1_cost: metrics.cost,
                    depth: metrics.depth,
                    nodes: metrics.nodes,
                    attention: 50, // Massive protective shield for LLM synthesis
                    age: 0,
                    energy: seedEnergy, // O-201 Thermodynamics Strict Minting
                    fitness: 0,
                    mutualists: new Set(),
                    sector: sector,
                    temporal_credit: 0.0
                });
                
                // Era 239: The Quantum Eye (Observer Effect)
                // Semantic insertion by the LLM natively maximizes Toroidal friction
                this.sectorHeat[sector] = Math.min(10.0, this.sectorHeat[sector] + 10.0);
                
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
        const plasmids = new BigUint64Array(this.memoryProxy.buffer, plasmidPtr, size);
        
        const statusPtr = this.wasmField.ptr_cell_status!();
        const status = new Uint8Array(this.memoryProxy.buffer, statusPtr, size);
        
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

    // Era 222: Holographic CRDT WebRTC Edge Binding
    public registerNetworkForeign(plasmid: ForeignPlasmid) {
        const hash = BigInt(plasmid.hash);
        if (!this.plasmidRegistry.has(hash)) {
            const decodedAst = lambda_decode_morphology(hash);
            const metrics = measureIR(decodedAst);
            const sector = plasmid.targetBucket !== undefined ? this.getGeographicSector(plasmid.targetBucket) : 0;
            
            this.plasmidRegistry.set(hash, {
                ast: decodedAst,
                l1_cost: metrics.cost,
                depth: metrics.depth,
                nodes: metrics.nodes,
                attention: 5,
                age: 0,
                energy: plasmid.energy,
                fitness: 0,
                mutualists: new Set(),
                sector: sector,
                temporal_credit: 0.0,
                parents: plasmid.parents, // Bind external causal topology
                vectorClock: plasmid.vectorClock
            });
            this.activePlasmids.add(hash);
            this.pushLedgerEvent({ epoch: this.getEpochTicks(), action: "NETWORK_RECEIVE", hash: plasmid.hash });
            console.log(`[MYCELIUM] 🧬 Decoded Alien Plasmid [${plasmid.hash.substring(0,8)}] and bound explicit causal phylogeny.`);
        }
    }

    // Era 212: Metaphysical Telemetry
    public getTopSectors(): { topId: number, topHeat: number }[] {
        const heats = Array.from(this.sectorHeat).map((heat, id) => ({ id, heat }));
        heats.sort((a, b) => b.heat - a.heat);
        return [
            { topId: heats[0].id, topHeat: heats[0].heat },
            { topId: heats[1].id, topHeat: heats[1].heat },
            { topId: heats[2].id, topHeat: heats[2].heat }
        ];
    }
}
