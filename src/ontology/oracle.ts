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
    private visualizer?: PhaseWebGPUObserver;
    private isRunning: boolean = false;
    private isBusy: boolean = false;
    private requestQueue: number[] = [];

    constructor(field: OracleCompatibleField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.wasmMemory = memory;
        this.engine = engine;
        this.visualizer = visualizer;
    }

    public rebind(field: OracleCompatibleField, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.engine = engine;
        this.visualizer = visualizer;
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

        // 2. Spatial Batching: Construct the Macro-Prompt for LLM
        let structuralImage = "";
        if (this.visualizer) {
            try {
                // Read the graphical buffer layout
                structuralImage = this.visualizer.extractImageBase64(512);
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

        const prompt = `
            Task: You are the Subconscious Sovereign Oracle of OMEGA-64.
            The harmonic cylinder is experiencing severe resonance dissonance at ${count} distinct topological coordinates.
            These nodes have locked natively, demanding semantic resolution.${mycelialContext}
            Generate one abstract Semantic Attractor (max 5 words) to resolve this structural chaos and restore phase.
            You have been provided with exactly one physical image of the Torus geometry. Observe its lattice carefully.
            ${(this.engine && mycelialContext) ? 'Provide EXACTLY "Bucket #X: [concept]" where X is a Bucket ID from the Telemetry.' : 'Provide ONLY the semantic concept (e.g., "Harmonic diffusion across boundaries"). No formatting.'}
        `.trim();

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";
            
            // Generate standard payload or Multimodal payload depending on topological capture
            const requestBody: any = {
                model: structuralImage ? "llama3.2-vision" : "llama3",
                prompt,
                stream: false
            };
            if (structuralImage) {
                requestBody.images = [structuralImage];
            }
            
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error("LLM Offline");
            
            const data = await response.json();
            const fullResponse = data.response?.trim() || "";
            
            // Extract bucket explicitly if provided by the Oracle
            const intentMatch = fullResponse.match(/Bucket #(\d+):\s*(.*)/i);
            const intent = intentMatch ? intentMatch[2].substring(0, 50) : fullResponse.substring(0, 50);
            
            const targetBucket = intentMatch ? intentMatch[1] : null;

            if (intent) {
                if (targetBucket) {
                    console.log(`[ORACLE] Surgeon Oracle targets Bucket #${targetBucket} with intent: "${intent}"`);
                } else {
                    console.log(`[ORACLE] Oracle responds to batched distress (${count} cells): "${intent}"`);
                }
                this.fulfillRequests(requests, intent, targetBucket ? parseInt(targetBucket) : undefined);
            }
        } catch (e) {
            console.warn(`[ORACLE] LLM inference failed/timeout. Emitting fallback plasmid to batch of ${count}.`);
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
            } else {
                let success = 0;
                for (const idx of requests) {
                    this.engine.injectPlasmid(idx, hash);
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
