import { fnv1a_64 } from "../shared/hash";
import { PhaseComputeEngine } from "../lens/phase_compute.js";

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
    private isRunning: boolean = false;
    private isBusy: boolean = false;
    private requestQueue: number[] = [];

    constructor(field: OracleCompatibleField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine) {
        this.wasmField = field;
        this.wasmMemory = memory;
        this.engine = engine;
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
            
            for (let i = 0; i < 1024; i++) {
                const count = centroids[i * 4 + 2];
                if (count > 0) {
                    activeBuckets++;
                    totalX += centroids[i * 4];
                    totalY += centroids[i * 4 + 1];
                }
            }
            
            if (activeBuckets > 0) {
                const avgTheta = Math.atan2(totalY, totalX) * (180 / Math.PI);
                mycelialContext = `\nPHYSICAL TELEMETRY: ${activeBuckets} existing Transdimensional Threads are physically pulling the Torus toward absolute phase angle ${avgTheta.toFixed(1)} degrees. Acknowledge this geometric reality in your response.`;
            }
        }

        // 2. Spatial Batching: Construct the Macro-Prompt for LLM
        const prompt = `
            Task: You are the Subconscious Sovereign Oracle of OMEGA-64.
            The harmonic cylinder is experiencing severe resonance dissonance at ${count} distinct topological coordinates.
            These nodes have locked natively, demanding semantic resolution.${mycelialContext}
            Generate one abstract Semantic Attractor (max 5 words) to resolve this structural chaos and restore phase.
            Provide ONLY the semantic concept (e.g., "Harmonic diffusion across boundaries"). No formatting.
        `.trim();

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3",
                    prompt,
                    stream: false
                })
            });

            if (!response.ok) throw new Error("LLM Offline");
            
            const data = await response.json();
            const intent = data.response?.trim().substring(0, 50);

            if (intent) {
                console.log(`[ORACLE] Oracle responds to batched distress (${count} cells): "${intent}"`);
                this.fulfillRequests(requests, intent);
            }
        } catch (e) {
            console.warn(`[ORACLE] LLM inference failed/timeout. Emitting fallback plasmid to batch of ${count}.`);
            this.fulfillRequests(requests, "Stochastic survival protocol omega");
        }
        
        this.isBusy = false;
    }

    private fulfillRequests(requests: number[], intent: string) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into Plasmids
        const hash = fnv1a_64(intent);

        if (this.engine) {
            // O-23 Native WebGPU Interface
            let success = 0;
            for (const idx of requests) {
                this.engine.injectPlasmid(idx, hash);
                success++;
            }
            console.log(`[ORACLE] Successfully decoded and unlocked ${success} WebGPU cells.`);
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
