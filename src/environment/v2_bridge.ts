/**
 * OMEGA-64 Era 950: V2 Bridge
 * 
 * Bare-metal WASM Instantiation wrapper.
 * Connects the TypeScript Cyber-Climate (Environmental Vector) directly 
 * into the `no_std` zero-cost Rust kernel using naked FFI calls.
 */

import { measureHardwareEnvironment, QTopology } from "./environmental_vector.ts";

const PHASE_AGENT_MINIMAL_BYTES = 32;
const LATTICE_UNIFORM_SIZE = 160;
const DELTA_BUFFER_BYTES = 6400 * 16;
const ATTRACTOR_ARRAY_BYTES = 80;
const MITOSIS_LOG_HEADER = 16;
const MITOSIS_RECEIPT_SIZE = 160;
const MITOSIS_LOG_CAPACITY = 32;
const MITOSIS_LOG_BYTES = MITOSIS_LOG_HEADER + MITOSIS_RECEIPT_SIZE * MITOSIS_LOG_CAPACITY;

export interface V2MemoryPointers {
    uniformBytes: Uint8Array<ArrayBuffer>;
    agentBytes: Uint8Array<ArrayBuffer>;
    sineLutBytes: Int32Array<ArrayBuffer>;
    sineLutQ10Bytes: Int32Array<ArrayBuffer>;
    deltaBufferBytes: Uint8Array<ArrayBuffer>;
    attractorBytes: Uint8Array<ArrayBuffer>;
    mitosisLogBytes: Uint8Array<ArrayBuffer> | null;
    wasmMemoryBuffer: ArrayBuffer;
}

export class OmegaV2Engine {
    private wasmInstance: WebAssembly.Instance | null = null;
    private memory: WebAssembly.Memory | null = null;
    private currentTopology: QTopology | null = null;
    private cachedPointers: V2MemoryPointers | null = null;

    constructor() {}

    public get wasm(): WebAssembly.Instance | null {
        return this.wasmInstance;
    }

    /** Era 2085: Expose current memory buffer for stability guards in renderer. */
    public get memoryBuffer(): ArrayBuffer | null {
        return this.memory?.buffer ?? null;
    }

    /**
     * Initializes the bare-metal WASM kernel.
     */
    async boot(adapter: GPUAdapter) {
        console.log("🌌 [OMEGA-V2] Bootstrapping Bare-Metal Engine...");

        // 1. Fetch Dynamic Derived Constraints from Host Device
        this.currentTopology = await measureHardwareEnvironment(adapter, PHASE_AGENT_MINIMAL_BYTES);

        // 2. Fetch the purely compiled 480-byte binary
        const response = await fetch("/dist/v2/omega_v2_core.wasm");
        const bytes = await response.arrayBuffer();

        // 3. Instantiate with zero imports (Pure no_std execution)
        const { instance } = await WebAssembly.instantiate(bytes, {
            env: {
                // We export nothing to WASM because it operates strictly within its own
                // deterministic limits. It asks JS for nothing.
            }
        });

        this.wasmInstance = instance;
        this.memory = instance.exports.memory as WebAssembly.Memory;

        console.log(`✅ [OMEGA-V2] Engine Instantiated. Memory Pages: ${this.memory.buffer.byteLength / 65536}`);

        // 4. Initialize the internal Lattice state before calling any physics
        const exportBootEngine = instance.exports.v2_boot_engine as CallableFunction;
        if (exportBootEngine) { exportBootEngine(); }

        // 5. Inject Environmental Constants directly via Fast-FFI
        this.injectClimate();
        
        // 6. Ignite the Big Bang (Populate WASM .bss memory with initial stars)
        const exportBigBang = instance.exports.v2_ignite_big_bang as CallableFunction;
        if (exportBigBang && this.currentTopology) {
            exportBigBang(Math.floor(Math.random() * 1000000), this.currentTopology.maxAllocatedAgents);
            console.log(`🎆 [V2-BRIDGE] The Big Bang was ignited.`);
        }
    }

    /**
     * Pushes the Q-Topology down to Rust via zero-cost exported functions.
     */
    private injectClimate() {
        if (!this.wasmInstance || !this.currentTopology) return;

        const setEnv = this.wasmInstance.exports.v2_set_environment as CallableFunction;
        
        // FFI Call into Rust. This simply flips the `SIGNAL_TOPOLOGY_CHANGED` bit
        // inside the SharedArrayBuffer memory space. Total cost: ~1 CPU Nano-cycle.
        setEnv(
            this.currentTopology.q_sectors,
            this.currentTopology.q_radial,
            this.currentTopology.q_harmonics
        );
        
        console.log(`🌪️ [OMEGA-V2] Climate Topology Injected: Q(${this.currentTopology.q_sectors}, ${this.currentTopology.q_radial}, ${this.currentTopology.q_harmonics})`);
    }

    /**
     * Triggers the internal Rust memory reconciliation cycle.
     */
    tick() {
        if (!this.wasmInstance) return;
        const tickPhysics = this.wasmInstance.exports.v2_tick as CallableFunction;
        tickPhysics();
    }

    /**
     * Exposes the pure untyped memory buffers directly to WebGPU.
     * This avoids ANY object allocation or copying overhead in JavaScript!
     */
    getMemoryPointers() {
        if (!this.wasmInstance || !this.memory || !this.currentTopology) throw new Error("V2 Engine Not Initialized");
        const memoryBuffer = this.memory.buffer as ArrayBuffer;
        if (this.cachedPointers?.wasmMemoryBuffer === memoryBuffer) {
            return this.cachedPointers;
        }
        const exports = this.wasmInstance.exports;

        // 1. Get raw WASM pointers offset integers
        const latticePtr = (exports.v2_lattice_ptr as CallableFunction)() as number;
        const agentsPtr = (exports.v2_agents_ptr as CallableFunction)() as number;
        const lutPtr = (exports.v2_sine_lut_ptr as CallableFunction)() as number;
        const lutQ10Ptr = (exports.v2_sine_lut_q10_ptr as CallableFunction)() as number;
        const deltaPtr = (exports.v2_delta_buffer_ptr as CallableFunction)() as number;
        const attractorPtr = (exports.v2_attractor_array_ptr as CallableFunction)() as number;
        // Era 1040 Phase 2: Mitosis receipt log (16-byte aligned ring buffer).
        const mitosisLogPtrFn = exports.v2_mitosis_log_ptr as CallableFunction | undefined;
        const mitosisLogPtr = mitosisLogPtrFn ? (mitosisLogPtrFn() as number) : 0;

        // 3. Gracefully Clamp WASM memory mapping just in case GPU VRAM > WASM .bss allocation
        const requestedBytes = this.currentTopology.maxAllocatedAgents * PHASE_AGENT_MINIMAL_BYTES;
        const maxSafeBytes = memoryBuffer.byteLength - agentsPtr;
        const actualBytes = Math.min(requestedBytes, maxSafeBytes);

        // Update Darwinian limits down to the WASM bottleneck if necessary
        this.currentTopology.maxAllocatedAgents = Math.floor(actualBytes / PHASE_AGENT_MINIMAL_BYTES);

        this.cachedPointers = {
            uniformBytes: new Uint8Array(memoryBuffer, latticePtr, LATTICE_UNIFORM_SIZE),
            agentBytes: new Uint8Array(memoryBuffer, agentsPtr, actualBytes),
            sineLutBytes: new Int32Array(memoryBuffer, lutPtr, 128),
            sineLutQ10Bytes: new Int32Array(memoryBuffer, lutQ10Ptr, 256),
            deltaBufferBytes: new Uint8Array(memoryBuffer, deltaPtr, DELTA_BUFFER_BYTES),
            attractorBytes: new Uint8Array(memoryBuffer, attractorPtr, ATTRACTOR_ARRAY_BYTES),
            mitosisLogBytes: mitosisLogPtr !== 0
                ? new Uint8Array(memoryBuffer, mitosisLogPtr, MITOSIS_LOG_BYTES)
                : null,
            wasmMemoryBuffer: memoryBuffer
        };
        return this.cachedPointers;
    }

    /** Era 1040 Phase 2: total mitosis receipts written since boot. */
    public getMitosisLogTotal(): number {
        if (!this.wasmInstance) return 0;
        const fn = this.wasmInstance.exports.v2_mitosis_log_total as CallableFunction | undefined;
        if (!fn) return 0;
        return fn() as number;
    }

    public injectCosmicEntropy(rawHashBigInt: bigint) {
        if (!this.wasmInstance) return;
        (this.wasmInstance.exports.v2_ingest_cosmic_entropy as CallableFunction)(rawHashBigInt);
    }

    // -----------------------------------------------------------------------
    // ERA 970+ EpicyclicSoul Resonance Tensor Bridge
    // -----------------------------------------------------------------------

    public scanResonance(): { r_q10: number; sum_cos: bigint; sum_sin: bigint; total_energy: bigint; active_count: number } {
        if (!this.wasmInstance) {
            return { r_q10: 0, sum_cos: 0n, sum_sin: 0n, total_energy: 0n, active_count: 0 };
        }
        (this.wasmInstance.exports.v2_resonance_scan as CallableFunction)();
        return {
            r_q10: (this.wasmInstance.exports.v2_resonance_r_q10 as CallableFunction)() as number,
            sum_cos: (this.wasmInstance.exports.v2_resonance_sum_cos as CallableFunction)() as bigint,
            sum_sin: (this.wasmInstance.exports.v2_resonance_sum_sin as CallableFunction)() as bigint,
            total_energy: (this.wasmInstance.exports.v2_resonance_total_energy as CallableFunction)() as bigint,
            active_count: (this.wasmInstance.exports.v2_resonance_active_count as CallableFunction)() as number,
        };
    }

    // -----------------------------------------------------------------------
    // ERA 970+ Φ-Message Buffer (Compost / Intent / Delta)
    // -----------------------------------------------------------------------

    public getPhiBufferPtr(): number {
        if (!this.wasmInstance) return 0;
        return (this.wasmInstance.exports.v2_phi_buffer_ptr as CallableFunction)() as number;
    }

    public getPhiBufferLen(): number {
        if (!this.wasmInstance) return 0;
        return (this.wasmInstance.exports.v2_phi_buffer_len as CallableFunction)() as number;
    }

    public getPhiBufferDrops(): number {
        if (!this.wasmInstance) return 0;
        return (this.wasmInstance.exports.v2_phi_buffer_drops as CallableFunction)() as number;
    }

    // -----------------------------------------------------------------------
    // ERA 950+ Epigenetic Memory Bridge
    // -----------------------------------------------------------------------

    public recordEpigenetic(genome: number) {
        if (!this.wasmInstance) return;
        (this.wasmInstance.exports.v2_record_epigenetic as CallableFunction)(genome);
    }

    public getEpigeneticBias(bitIndex: number): number {
        if (!this.wasmInstance) return 0;
        return (this.wasmInstance.exports.v2_get_epigenetic_bias as CallableFunction)(bitIndex) as number;
    }

    public getEpigeneticTotal(): number {
        if (!this.wasmInstance) return 0;
        return (this.wasmInstance.exports.v2_get_epigenetic_total as CallableFunction)() as number;
    }

    public setMutationRate(rate: number) {
        if (!this.wasmInstance) return;
        (this.wasmInstance.exports.v2_set_mutation_rate as CallableFunction)(Math.min(100, Math.max(0, rate)));
    }

    public clearEpigenetic() {
        if (!this.wasmInstance) return;
        (this.wasmInstance.exports.v2_clear_epigenetic as CallableFunction)();
    }

    public igniteEpigeneticBigBang(seed: number, count: number) {
        if (!this.wasmInstance) return;
        const exportBigBang = this.wasmInstance.exports.v2_ignite_epigenetic_big_bang as CallableFunction;
        if (exportBigBang) {
            exportBigBang(seed, count);
            console.log(`🧬 [V2-EPIGENETICS] Biased Big Bang ignited with ${count} agents.`);
        }
    }

    /// Harvest thriving agents (energy > threshold) into epigenetic memory.
    public harvestSurvivors(threshold: number = 1500) {
        if (!this.wasmInstance || !this.currentTopology) return;
        const count = this.currentTopology.maxAllocatedAgents;
        const agentView = this.getMemoryPointers().agentBytes;
        const view = new DataView(agentView.buffer, agentView.byteOffset, agentView.byteLength);

        let harvested = 0;
        for (let i = 0; i < count; i++) {
            const offset = i * PHASE_AGENT_MINIMAL_BYTES;
            const energy = view.getUint32(offset + 4, true);
            const genome = view.getUint32(offset + 16, true);
            if (energy > threshold) {
                this.recordEpigenetic(genome);
                harvested++;
            }
        }
        if (harvested > 0) {
            console.log(`🧬 [V2-EPIGENETICS] Harvested ${harvested} survivors into collective memory.`);
        }
    }
}
