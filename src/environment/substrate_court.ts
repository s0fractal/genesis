// Substrate Court

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
export type ProofKind = "mock" | "sp1-stark" | "groth16";

export interface StateWitness {
    substrate: WitnessSubstrate;
    source: WitnessSource;
    proofKind?: ProofKind;
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
    public transitionReceipts = new Set<string>(); // Store transitions into isolation

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

    /** Trigger SP1 to arbitrate the divergent tick. */
    private requestArbitration(tick: number, gpu: StateWitness, wasm: StateWitness): void {
        // Dispatch block to SP1 prover (simulated here for tests unless hooked).
        // A real SP1 backend will respond asynchronously with a proofKind: "sp1-stark"
        console.warn(`[SubstrateCourt] Drift detected at tick ${tick}. Requesting SP1 STARK arbitration.`);
    }

    private handleArbitrationTimeout(tick: number): void {
        if (this.pendingArbitrations.has(tick)) {
            clearTimeout(this.pendingArbitrations.get(tick));
            console.error(`[SubstrateCourt] Arbitration timeout for tick ${tick}. Quarantining involved substrates.`);

            const records = this.testimonies.get(tick);
            if (records) {
                // If SP1 testimony did not arrive, we cannot decide who is right. Isolate both fast substrates.
                if (records.has("webgpu")) this.isolatedSubstrates.add("webgpu");
                if (records.has("wasm")) this.isolatedSubstrates.add("wasm");

                const receipt = `timeout_quarantine_tick_${tick}`;
                this.quarantineReceipts.add(receipt);
                this.transitionReceipts.add(receipt);
            }
            this.pendingArbitrations.delete(tick);
        }
    }

    /** Process the definitive STARK proof testimony and punish the drifting substrate. */
    public resolveArbitration(arbiterTestimony: StateWitness): void {
        if (arbiterTestimony.substrate !== "sp1") return;

        // Ensure mock vs real proofs are tracked in the receipt
        const proofKind = arbiterTestimony.proofKind || "mock";

        const tick = arbiterTestimony.tick;
        if (!this.pendingArbitrations.has(tick)) return;

        clearTimeout(this.pendingArbitrations.get(tick));

        const records = this.testimonies.get(tick);
        if (!records) return;

        const gpu = records.get("webgpu");
        const wasm = records.get("wasm");

        if (gpu && (gpu.postStateHash !== arbiterTestimony.postStateHash || gpu.lawHash !== arbiterTestimony.lawHash)) {
            console.error(`[SubstrateCourt] WebGPU drift convicted at tick ${tick} by ${proofKind}. Isolating substrate.`);
            this.isolatedSubstrates.add("webgpu");
            const receipt = `convicted_webgpu_tick_${tick}_proof_${proofKind}`;
            this.quarantineReceipts.add(receipt);
            this.transitionReceipts.add(receipt);
        }

        if (wasm && (wasm.postStateHash !== arbiterTestimony.postStateHash || wasm.lawHash !== arbiterTestimony.lawHash)) {
            console.error(`[SubstrateCourt] WASM drift convicted at tick ${tick} by ${proofKind}. Isolating substrate.`);
            this.isolatedSubstrates.add("wasm");
            const receipt = `convicted_wasm_tick_${tick}_proof_${proofKind}`;
            this.quarantineReceipts.add(receipt);
            this.transitionReceipts.add(receipt);
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
