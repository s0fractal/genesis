// 🌌 OMEGA-64: Era 2100 — Substrate Court
//
// The Substrate Court enforces multi-witness deterministic consensus across
// heterogeneous substrates (WebGPU, Cortex-M4F/WASM, and SP1 ZK-VM).
// Instead of one substrate acting as a passive slave, all compute nodes
// broadcast LawHash and StateHash as "Testimonies".
// If a drift is detected, the SP1 ZK-VM acts as the Supreme Arbiter.

export const WITNESS_WEBGPU = 0;
export const WITNESS_WASM = 1;
export const WITNESS_SP1 = 2;

export type WitnessSubstrate = "webgpu" | "wasm" | "sp1";
export type WitnessSource = "gpu-readback" | "wasm-memory" | "zk-proof";

export interface StateWitness {
    substrate: WitnessSubstrate;
    source: WitnessSource;
    lawHash: number;
    preStateHash: number;
    postStateHash: number;
    entropyDelta: number;
    tick: number;
}

export class SubstrateCourt {
    private testimonies = new Map<number, Map<WitnessSubstrate, StateWitness>>(); // tick -> (substrate -> StateWitness)
    private pendingArbitrations = new Map<number, number>(); // tick -> timeout id
    
    // Substrates that have failed arbitration and are temporarily isolated
    public isolatedSubstrates = new Set<WitnessSubstrate>();
    public quarantineReceipts = new Set<string>(); // Store isolation receipts

    constructor() {}

    /** Submit a testimony from a substrate for a specific absolute tick. */
    public submitTestimony(testimony: StateWitness): void {
        if (this.isolatedSubstrates.has(testimony.substrate)) {
            return; // Ignore testimony from isolated/distrusted substrates
        }

        if (!this.testimonies.has(testimony.tick)) {
            this.testimonies.set(testimony.tick, new Map());
        }

        const tickRecords = this.testimonies.get(testimony.tick)!;
        tickRecords.set(testimony.substrate, testimony);

        this.checkConsensus(testimony.tick);
    }

    /** Check if we have drift between the fast substrates (WebGPU vs WASM). */
    private checkConsensus(tick: number): void {
        const records = this.testimonies.get(tick)!;
        
        const gpu = records.get("webgpu");
        const wasm = records.get("wasm");
        
        if (gpu && wasm) {
            if (gpu.postStateHash !== wasm.postStateHash || gpu.lawHash !== wasm.lawHash) {
                // Drift detected! Trigger ZK arbitration if not already pending
                if (!this.pendingArbitrations.has(tick)) {
                    const timeoutId = setTimeout(() => this.handleArbitrationTimeout(tick), 5000);
                    this.pendingArbitrations.set(tick, timeoutId as unknown as number);
                    this.requestArbitration(tick, gpu, wasm);
                }
            } else {
                // Consensus reached, we can garbage collect older ticks
                this.prune(tick - 100);
            }
        }
    }

    /** Mock trigger for SP1 to arbitrate the divergent tick. */
    private requestArbitration(tick: number, gpu: StateWitness, wasm: StateWitness): void {
        // In a real implementation, this dispatches a block to the SP1 prover
        // For now, we simulate the arrival of an SP1 testimony.
    }

    private handleArbitrationTimeout(tick: number): void {
        if (this.pendingArbitrations.has(tick)) {
            console.warn(`[SubstrateCourt] Arbitration timeout for tick ${tick}.`);
            // Add a quarantine receipt and drop the pending state
            this.quarantineReceipts.add(`timeout_tick_${tick}`);
            this.pendingArbitrations.delete(tick);
        }
    }

    /** Process the definitive STARK proof testimony and punish the drifting substrate. */
    public resolveArbitration(arbiterTestimony: StateWitness): void {
        if (arbiterTestimony.substrate !== "sp1") return;

        const tick = arbiterTestimony.tick;
        if (!this.pendingArbitrations.has(tick)) return;

        clearTimeout(this.pendingArbitrations.get(tick));
        
        const records = this.testimonies.get(tick);
        if (!records) return;

        const gpu = records.get("webgpu");
        const wasm = records.get("wasm");

        if (gpu && (gpu.postStateHash !== arbiterTestimony.postStateHash || gpu.lawHash !== arbiterTestimony.lawHash)) {
            console.warn(`[SubstrateCourt] WebGPU drift convicted at tick ${tick}. Isolating substrate.`);
            this.isolatedSubstrates.add("webgpu");
            this.quarantineReceipts.add(`convicted_webgpu_tick_${tick}`);
        }

        if (wasm && (wasm.postStateHash !== arbiterTestimony.postStateHash || wasm.lawHash !== arbiterTestimony.lawHash)) {
            console.warn(`[SubstrateCourt] WASM drift convicted at tick ${tick}. Isolating substrate.`);
            this.isolatedSubstrates.add("wasm");
            this.quarantineReceipts.add(`convicted_wasm_tick_${tick}`);
        }

        this.pendingArbitrations.delete(tick);
    }

    /** Clean up old testimony records to prevent memory leaks. */
    private prune(beforeTick: number): void {
        for (const tick of this.testimonies.keys()) {
            if (tick < beforeTick && !this.pendingArbitrations.has(tick)) {
                this.testimonies.delete(tick);
            }
        }
    }
}
