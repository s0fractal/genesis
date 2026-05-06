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

export interface Testimony {
    witnessKind: number;
    lawHash: number;
    stateHash: number;
    entropyDelta: number;
    tick: number;
}

export class SubstrateCourt {
    private testimonies = new Map<number, Map<number, Testimony>>(); // tick -> (witnessKind -> Testimony)
    private pendingArbitrations = new Set<number>();
    
    // Substrates that have failed arbitration and are temporarily isolated
    public isolatedSubstrates = new Set<number>();

    constructor() {}

    /** Submit a testimony from a substrate for a specific absolute tick. */
    public submitTestimony(testimony: Testimony): void {
        if (this.isolatedSubstrates.has(testimony.witnessKind)) {
            return; // Ignore testimony from isolated/distrusted substrates
        }

        if (!this.testimonies.has(testimony.tick)) {
            this.testimonies.set(testimony.tick, new Map());
        }

        const tickRecords = this.testimonies.get(testimony.tick)!;
        tickRecords.set(testimony.witnessKind, testimony);

        this.checkConsensus(testimony.tick);
    }

    /** Check if we have drift between the fast substrates (WebGPU vs WASM). */
    private checkConsensus(tick: number): void {
        const records = this.testimonies.get(tick)!;
        
        const gpu = records.get(WITNESS_WEBGPU);
        const wasm = records.get(WITNESS_WASM);
        
        if (gpu && wasm) {
            if (gpu.stateHash !== wasm.stateHash || gpu.lawHash !== wasm.lawHash) {
                // Drift detected! Trigger ZK arbitration if not already pending
                if (!this.pendingArbitrations.has(tick)) {
                    this.pendingArbitrations.add(tick);
                    this.requestArbitration(tick, gpu, wasm);
                }
            } else {
                // Consensus reached, we can garbage collect older ticks
                this.prune(tick - 100);
            }
        }
    }

    /** Mock trigger for SP1 to arbitrate the divergent tick. */
    private requestArbitration(tick: number, gpu: Testimony, wasm: Testimony): void {
        // In a real implementation, this dispatches a block to the SP1 prover
        // For now, we simulate the arrival of an SP1 testimony.
    }

    /** Process the definitive STARK proof testimony and punish the drifting substrate. */
    public resolveArbitration(arbiterTestimony: Testimony): void {
        if (arbiterTestimony.witnessKind !== WITNESS_SP1) return;

        const tick = arbiterTestimony.tick;
        if (!this.pendingArbitrations.has(tick)) return;

        const records = this.testimonies.get(tick);
        if (!records) return;

        const gpu = records.get(WITNESS_WEBGPU);
        const wasm = records.get(WITNESS_WASM);

        if (gpu && (gpu.stateHash !== arbiterTestimony.stateHash || gpu.lawHash !== arbiterTestimony.lawHash)) {
            console.warn(`[SubstrateCourt] WebGPU drift convicted at tick ${tick}. Isolating substrate.`);
            this.isolatedSubstrates.add(WITNESS_WEBGPU);
        }

        if (wasm && (wasm.stateHash !== arbiterTestimony.stateHash || wasm.lawHash !== arbiterTestimony.lawHash)) {
            console.warn(`[SubstrateCourt] WASM drift convicted at tick ${tick}. Isolating substrate.`);
            this.isolatedSubstrates.add(WITNESS_WASM);
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
