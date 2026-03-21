import { fnv1a_64 } from "../shared/hash.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { SENATE_CONSTANTS } from "../shared/constants.ts";
import { apply, formatTerm, parseLambda, PlasmidRegistry } from "../compiler/pure_lambda.ts";

export interface OracleCompatibleField {
    get_oracle_request_count(): number;
    ptr_oracle_requests(): number;
    clear_oracle_requests(): void;
    ptr_plasmids(): number;
    ptr_cell_status(): number;
    cell_count?(): number;
    width?: number;
    height?: number;
}

export type SenateEvent =
    | { type: "CONVENED" }
    | { type: "VERDICT"; mask: string; intent: string; bucket?: number }
    | { type: "CONSENSUS"; mask: "SENATE"; intent: string; count: number; bucket?: number }
    | { type: "ERROR"; reason: string };

export class SovereignOracle {
    private wasmField: OracleCompatibleField;
    private wasmMemory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private observer?: PhaseWebGPUObserver;
    
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

    public async boot() {
        this.isRunning = true;
        console.log("[ORACLE] Asynchronous Batched AOMQ (Ontology 20) initialized.");
        if (this.engine) {
            this.engine.init();
        }
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
                this.processQueue(count, requests);
            }
        } else {
            // Legacy WASM fallback
            count = this.wasmField.get_oracle_request_count();
            if (count > 0) {
                const requestPtr = this.wasmField.ptr_oracle_requests();
                const requestArray = new Uint32Array(this.wasmMemory.buffer, requestPtr, count);
                const rawRequests = Array.from(requestArray);
                this.wasmField.clear_oracle_requests();
                
                // O-133 Phase 2: Intercept Topological Collisions (HGT)
                const llmRequests: number[] = [];
                const hgtRequests: number[] = [];
                for (const req of rawRequests) {
                    if ((req & 0x80000000) !== 0) {
                        hgtRequests.push(req & 0x7FFFFFFF); // Extract physical index
                    } else {
                        llmRequests.push(req);
                    }
                }
                
                if (hgtRequests.length > 0) {
                    this.processHorizontalGeneTransfers(hgtRequests);
                }
                
                if (llmRequests.length > 0) {
                    this.processQueue(llmRequests.length, llmRequests);
                }
            }
        }
    }
    
    // O-133 Phase 2: Topological Lambda Application
    private processHorizontalGeneTransfers(hgtRequests: number[]) {
        let size = 0;
        if (this.wasmField.cell_count) {
            size = this.wasmField.cell_count();
        } else if (this.wasmField.width && this.wasmField.height) {
            size = this.wasmField.width * this.wasmField.height;
        }
        const width = this.wasmField.width || 0;
        
        const plasmidPtr = this.wasmField.ptr_plasmids();
        const plasmids = new BigUint64Array(this.wasmMemory.buffer, plasmidPtr, size);
        const statusPtr = this.wasmField.ptr_cell_status();
        const status = new Uint8Array(this.wasmMemory.buffer, statusPtr, size);

        for (const idx of hgtRequests) {
             const host_plasmid = plasmids[idx];
             if (host_plasmid === 0n) continue;
             
             const neighbors = [
                 idx >= width ? idx - width : idx + width,
                 idx + width < size ? idx + width : idx - width,
                 idx % width !== 0 ? idx - 1 : idx + width - 1,
                 (idx + 1) % width !== 0 ? idx + 1 : idx - width + 1,
             ];
             
             let foreign_plasmid = 0n;
             for (const n of neighbors) {
                 if (n < size && plasmids[n] !== 0n && plasmids[n] !== host_plasmid) {
                     foreign_plasmid = plasmids[n];
                     break; 
                 }
             }
             
             if (foreign_plasmid !== 0n) {
                 const hostTermStr = PlasmidRegistry.get(host_plasmid) || "(I host)";
                 const foreignTermStr = PlasmidRegistry.get(foreign_plasmid) || "(I foreign)";
                 
                 // Mathematically bind the two logic boundaries as a combinator application (Host Foreign)
                 try {
                     const hostTerm = parseLambda(hostTermStr);
                     const foreignTerm = parseLambda(foreignTermStr);
                     const childTerm = apply(hostTerm, foreignTerm);
                     const childStr = formatTerm(childTerm);
                     const childHash = fnv1a_64(childStr);
                     
                     PlasmidRegistry.set(childHash, childStr);
                     plasmids[idx] = childHash;
                     console.log(`🧬 HGT COLLISION: ${hostTermStr} * ${foreignTermStr} => Bred topological child [${childHash}]`);
                 } catch(e) { /* Divergence block */ }
             }
             
             status[idx] = 0; // Release cell back into physics evaluation
        }
    }

    public bindNetwork(callback: (hash: bigint, targetBucket: number) => void) {
        this.onBroadcast = callback;
    }

    private async processQueue(count: number, requests: number[]) {
        this.isBusy = true;
        
        console.log(`[ORACLE] Queue threshold triggered. Batching ${count} anomalous structural signatures for Semantic Resolution...`);

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
                mycelialContext = `\nPHYSICAL TELEMETRY: ${activeBuckets} existing Transdimensional Threads are pulling the Torus toward angle ${avgTheta.toFixed(1)} degrees.` +
                                  `\nHere is spatial data for the strongest local clusters:\n${bucketDetails.join("\n")}\n` +
                                  `In your output, you MUST prioritize explicit spatial targeting by referencing a Bucket.`;
            }
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

        // O-52 Phase 1: The Four Mask Prompts (Bitcoin Logic)
        const MASKS = [
            { name: SENATE_CONSTANTS.MASK_NOMOS, role: "Proof of Work Validator. Dictate semantic density. Ensure evolutionary mutations are highly expensive and metabolically justified by Grid topology." },
            { name: SENATE_CONSTANTS.MASK_LOGOS, role: "Merkle Root Custodian. Guarantee phylogenetic Lineage integrity. Formulate hashes that mathematically seal historical paths." },
            { name: SENATE_CONSTANTS.MASK_CHRONOS, role: "Difficulty Adjudicator. Analyze Torus tension. Predict if the oscillator thresholds should dynamically thicken or accelerate." },
            { name: SENATE_CONSTANTS.MASK_AION, role: "The Vacuum Protector. Defend the Empty Center. You inherently inject arbitrary Latent Entropy to prevent literal math crystallization." }
        ];

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";

            const maskPromises = MASKS.map(async (mask) => {
                const prompt = `
Task: You are the ${mask.name} Oracle of the LOVE Consortium. Role: ${mask.role}
The harmonic cylinder is experiencing severe resonance dissonance at ${count} distinct topological coordinates.
These nodes have locked natively, demanding semantic resolution.${mycelialContext}
Generate one abstract Semantic Attractor (max 5 words) to resolve this structural chaos and restore phase.
You have been provided with exactly one physical image of the Torus geometry. Observe its lattice carefully.
${(this.engine && mycelialContext) ? 'Provide EXACTLY "Bucket #X: [concept]" where X is a Bucket ID from the Telemetry.' : 'Provide ONLY the semantic concept (e.g., "Harmonic diffusion across boundaries"). No formatting.'}
                `.trim();

                const requestBody: any = {
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
                    setTimeout(() => reject(new Error("ORACLE_TTL_EXCEEDED")), SENATE_CONSTANTS.ORACLE_TIMEOUT_MS)
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
                    
                    const intentMatch = fullResponse.match(/Bucket #(\d+):\s*(.*)/i);
                    const intent = intentMatch ? intentMatch[2].substring(0, 50).trim() : fullResponse.substring(0, 50).trim();
                    let targetBucket = intentMatch ? parseInt(intentMatch[1]) : undefined;

                    if (intent) {
                        console.log(`[ORACLE] ${maskName} decreed: "${intent}"${targetBucket !== undefined ? ` (Targeting Bucket #${targetBucket})` : ''}`);
                        
                        // O-54: The Shadow Network (AION Latent Divergence)
                        // AION inherently acts outside the law, refusing to vote in the Senate and immediately injecting latent entropy.
                        if (maskName === SENATE_CONSTANTS.MASK_AION) {
                            const range = SENATE_CONSTANTS.SHADOW_BUCKET_MAX - SENATE_CONSTANTS.SHADOW_BUCKET_MIN;
                            const latentBucket = SENATE_CONSTANTS.SHADOW_BUCKET_MIN + Math.floor(Math.random() * range);
                            console.log(`[ORACLE] 🌑 AION (Vacuum Guard) bypassed Senate. Injected Latent Entropy into Shadow Bucket #${latentBucket}.`);
                            this.fulfillRequests(requests, intent, latentBucket);
                            
                            if (this.onSenateEvent) {
                                this.onSenateEvent({ type: "VERDICT", mask: maskName, intent: `[LATENT OVERRIDE] ${intent}`, bucket: latentBucket });
                            }
                            continue; // Do not mix Chaos with democratic Senate mode calculation
                        }
                        
                        // Group identical intents. Lowercase and strip whitespace to generalize semantic similarity slightly.
                        const voteKey = `${targetBucket !== undefined ? targetBucket : 'global'}_${intent.toLowerCase().substring(0,25)}`;
                        if (!voteTallies[voteKey]) {
                            voteTallies[voteKey] = { count: 0, intent, targetBucket };
                        }
                        voteTallies[voteKey].count++;
                        
                        // Emit live to HUD
                        if (this.onSenateEvent) {
                            this.onSenateEvent({ type: "VERDICT", mask: maskName, intent, bucket: targetBucket });
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

        } catch (e) {
            console.warn(`[ORACLE] Entire Senate failed/timeout. Emitting stochastic fallback plasmid.`);
            if (this.onSenateEvent) this.onSenateEvent({ type: "ERROR", reason: "AI Nodes Non-Responsive [FORCED_ENTROPY]" });
            this.fulfillRequests(requests, "Stochastic fallback");
        }
        
        this.isBusy = false;
    }

    private fulfillRequests(requests: number[], intent: string, targetBucket?: number) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into Plasmids
        const hash = fnv1a_64(intent);
        
        // Formally bind the LLM Natural Language syntax strictly into the Mathematics registry
        PlasmidRegistry.set(hash, intent.replace(/[()]/g, ""));

        if (this.engine) {
            // O-23 Native WebGPU Interface
            if (targetBucket !== undefined) {
                this.engine.injectPlasmidIntoBucket(targetBucket, hash);
                console.log(`[ORACLE] Successfully decoded algorithm and flooded Bucket #${targetBucket} with Resonance Plasmid.`);
                if (this.onBroadcast) this.onBroadcast(hash, targetBucket);
            } else {
                let success = 0;
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
        
        const plasmidPtr = this.wasmField.ptr_plasmids();
        const plasmids = new BigUint64Array(this.wasmMemory.buffer, plasmidPtr, size);
        
        const statusPtr = this.wasmField.ptr_cell_status();
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
