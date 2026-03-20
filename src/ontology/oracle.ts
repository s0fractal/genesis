import { fnv1a_64 } from "../shared/hash.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";

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

export class SovereignOracle {
    private wasmField: OracleCompatibleField;
    private wasmMemory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private observer?: PhaseWebGPUObserver;
    
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
                requests = Array.from(requestArray);
                this.wasmField.clear_oracle_requests();
                this.processQueue(count, requests);
            }
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

        const MASKS = [
            { name: "NOMOS", role: "Legalist. You seek fair energy distribution and destroy Energy Vampires." },
            { name: "LOGOS", role: "Structuralist. You enforce DAG integrity and hunt Semantic Cancer schemas." },
            { name: "CHRONOS", role: "Optimizer. You minimize energy_cost and WASM bottlenecks." },
            { name: "AION", role: "The Shadow. You hunt for frozen Stagnation and inject pure Chaos." }
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

                // O-40 Phase 1: Sovereign Oracle TTL (15.0s Strict Heartbeat)
                const timeoutPromise = new Promise<Response>((_, reject) => 
                    setTimeout(() => reject(new Error("ORACLE_TTL_EXCEEDED")), 15000)
                );

                const response = await Promise.race([fetchPromise, timeoutPromise]);
                if (!response.ok) throw new Error("LLM Offline");
                
                const data = await response.json();
                const fullResponse = data.response?.trim() || "";
                return { mask: mask.name, response: fullResponse };
            });

            console.log(`[ORACLE] Senate convened. Awaiting verdicts from NOMOS, LOGOS, CHRONOS, and AION...`);
            
            // O-43 Parallel Execution
            const settled = await Promise.allSettled(maskPromises);
            
            let validIntents = 0;
            for (let i = 0; i < settled.length; i++) {
                const result = settled[i];
                if (result.status === "fulfilled" && result.value) {
                    const fullResponse = result.value.response;
                    const maskName = result.value.mask;
                    
                    const intentMatch = fullResponse.match(/Bucket #(\d+):\s*(.*)/i);
                    const intent = intentMatch ? intentMatch[2].substring(0, 50) : fullResponse.substring(0, 50);
                    const targetBucket = intentMatch ? intentMatch[1] : null;

                    if (intent) {
                        console.log(`[ORACLE] ${maskName} decreed: "${intent}"${targetBucket ? ` (Targeting Bucket #${targetBucket})` : ''}`);
                        
                        // Fulfill requests locally; since multiple requests might overlap identically on the WASM array, 
                        // the last intent wins in WASM, but WebGPU sequentially stacks all 4 buckets physically.
                        this.fulfillRequests(requests, intent, targetBucket ? parseInt(targetBucket) : undefined);
                        validIntents++;
                    }
                } else {
                    console.warn(`[ORACLE] A Mask failed to reach consensus or timed out.`);
                }
            }

            if (validIntents === 0) {
                throw new Error("Complete Senate Failure");
            }

        } catch (e) {
            console.warn(`[ORACLE] Entire Senate failed/timeout. Emitting stochastic fallback plasmid.`);
            this.fulfillRequests(requests, "Stochastic survival protocol omega");
        }
        
        this.isBusy = false;
    }

    private fulfillRequests(requests: number[], intent: string, targetBucket?: number) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into Plasmids
        const hash = fnv1a_64(intent);

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
