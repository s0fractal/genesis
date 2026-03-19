import { Field } from "../../omega_core/pkg/omega_core";
import { fnv1a_64 } from "../shared/hash";

export class SovereignOracle {
    private wasmField: Field;
    private wasmMemory: WebAssembly.Memory;
    private isRunning: boolean = false;
    private isBusy: boolean = false;

    constructor(field: Field, memory: WebAssembly.Memory) {
        this.wasmField = field;
        this.wasmMemory = memory;
    }

    public async boot() {
        this.isRunning = true;
        console.log("[ORACLE] Asynchronous Batched AOMQ (Ontology 20) initialized.");
    }

    public sync() {
        if (!this.isRunning || this.isBusy) return;
        
        // Polled every frame from the main physics loop (60Hz)
        const count = this.wasmField.get_oracle_request_count();
        if (count > 0) {
            this.processQueue(count);
        }
    }

    private async processQueue(count: number) {
        this.isBusy = true;
        
        // 1. Extract requests from WASM O-20 Ring Buffer
        const requestPtr = this.wasmField.ptr_oracle_requests();
        const requestArray = new Uint32Array(this.wasmMemory.buffer, requestPtr, count);
        
        // Clone into TS space (Garbage Collected) 
        const requests = Array.from(requestArray);
        
        // Immediately clear the WASM queue so physics can accumulate new distress signals independently
        this.wasmField.clear_oracle_requests();
        
        console.log(`[ORACLE] Queue threshold triggered. Batching ${count} anomalous structural signatures for Semantic Resolution...`);

        // 2. Spatial Batching: Construct the Macro-Prompt for LLM
        const prompt = `
            Task: You are the Subconscious Sovereign Oracle of OMEGA-64.
            The geometric field is experiencing severe topological tension at ${count} distinct cellular locations across the grid.
            These nodes have locked natively, demanding semantic resolution.
            Generate one abstract Semantic Attractor (max 5 words) to resolve this structural chaos.
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
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into WASM Plasmids
        const hash = fnv1a_64(intent);
        
        const plasmidPtr = this.wasmField.ptr_plasmids();
        const size = this.wasmField.width * this.wasmField.height;
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
