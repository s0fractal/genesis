/**
 * OMEGA-64 Era 950: V2 Bridge
 * 
 * Bare-metal WASM Instantiation wrapper.
 * Connects the TypeScript Cyber-Climate (Environmental Vector) directly 
 * into the `no_std` zero-cost Rust kernel using naked FFI calls.
 */

import { measureHardwareEnvironment, QTopology } from "./environmental_vector.ts";

const PHASE_AGENT_MINIMAL_BYTES = 32;
const LATTICE_UNIFORM_SIZE = 192;
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
    
    // Era 3000: Bitcoin Weather Multiplier (Q10, 1024 = 1.0x)
    public currentWeatherMultiplier: number = 1024;

    constructor() {}

    public get wasm(): WebAssembly.Instance | null {
        return this.wasmInstance;
    }

    /** Era 2085: Expose current memory buffer for stability guards in renderer. */
    public get memoryBuffer(): ArrayBuffer | null {
        return this.memory?.buffer ?? null;
    }

    /** Era 0202: Expose current topology for Witness generation. */
    public getTopology(): QTopology | null {
        return this.currentTopology;
    }

    /** Era 3000: Inject new weather multiplier */
    public setWeather(multiplier: number) {
        if (this.currentWeatherMultiplier === multiplier) return;
        this.currentWeatherMultiplier = multiplier;
        this.injectClimate();
    }

    /** Era 3000 Phase 2: Expose a 32-byte scratchpad pointer at the end of the delta buffer for SHA-256 FFI. */
    public getScratchpadPtr(): number {
        // Uniforms (160) + SineLut (512) + SineLutQ10 (512) + Agents (32 * Max)
        // deltaBuffer is right after agents. We just return a safe pointer at the very end of deltaBuffer.
        if (!this.cachedPointers) return 0;
        return this.cachedPointers.deltaBufferBytes.byteOffset + this.cachedPointers.deltaBufferBytes.byteLength - 32;
    }

    /**
     * Initializes the bare-metal WASM kernel.
     */
    async boot(adapter: GPUAdapter, initialSnapshot?: Uint8Array) {
        console.log("🌌 [OMEGA-V2] Bootstrapping Bare-Metal Engine...");

        // 1. Fetch Dynamic Derived Constraints from Host Device
        this.currentTopology = await measureHardwareEnvironment(adapter, PHASE_AGENT_MINIMAL_BYTES);

        // 2. Fetch the purely compiled 480-byte binary
        const response = await fetch("/v2/omega_v2_core.wasm");
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
        
        // 6. Restore from Snapshot OR Ignite the Big Bang
        if (initialSnapshot && this.currentTopology) {
            const ptrs = this.getMemoryPointers();
            // Validate size
            const agentCount = Math.floor(initialSnapshot.length / PHASE_AGENT_MINIMAL_BYTES);
            const safeCount = Math.min(agentCount, this.currentTopology.maxAllocatedAgents);
            const safeBytes = safeCount * PHASE_AGENT_MINIMAL_BYTES;
            
            // Copy snapshot directly into WebAssembly .bss
            ptrs.agentBytes.set(initialSnapshot.subarray(0, safeBytes));
            
            // Update Active Agent Count in SignalStore
            const signals = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset, 4);
            signals[2] = safeCount; // active_agent_count is at offset 8 (index 2 of u32)
            
            console.log(`🌌 [V2-BRIDGE] Snapshot restored from IPFS: ${safeCount} agents resurrected.`);
        } else {
            const exportBigBang = instance.exports.v2_ignite_big_bang as CallableFunction;
            if (exportBigBang && this.currentTopology) {
                exportBigBang(Math.floor(Math.random() * 1000000), this.currentTopology.maxAllocatedAgents);
                console.log(`🎆 [V2-BRIDGE] The Big Bang was ignited.`);
            }
        }
    }

    /** Era 0205: Fully reset the internal engine state. */
    public reset(): void {
        if (!this.wasmInstance) return;
        const resetFn = this.wasmInstance.exports.v2_reset_runtime_state as CallableFunction;
        if (resetFn) {
            resetFn();
            console.log("🔄 [V2-BRIDGE] Engine runtime state reset to pure vacuum.");
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
            this.currentTopology.q_harmonics,
            this.currentWeatherMultiplier
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

    public getActiveAgentCount(): number {
        const ptrs = this.getMemoryPointers();
        const signals = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset, 4);
        return signals[2]; // active_agent_count is at offset 8 (index 2)
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
    // ERA 1110: Multi-Anchor Temporal Layer (BTC, ETH, SOL)
    // -----------------------------------------------------------------------

    public initNetworkAnchor(networkId: number, hashes: bigint[]) {
        if (!this.wasmInstance) return;
        if (hashes.length < 6) return;
        const fn = this.wasmInstance.exports.v2_anchor_init_network as CallableFunction;
        if (fn) {
            fn(networkId, hashes[0], hashes[1], hashes[2], hashes[3], hashes[4], hashes[5]);
        }
    }

    public ingestNetworkBlock(networkId: number, hash: bigint) {
        if (!this.wasmInstance) return;
        const fn = this.wasmInstance.exports.v2_anchor_ingest_block as CallableFunction;
        if (fn) {
            fn(networkId, hash);
        }
    }

    public getAnchorTotalBlocks(): bigint {
        if (!this.wasmInstance) return 0n;
        const fn = this.wasmInstance.exports.v2_anchor_total_blocks as CallableFunction;
        if (fn) {
            return fn() as bigint;
        }
        return 0n;
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

    // -----------------------------------------------------------------------
    // ERA 0206 Temporal Binding (Bitcoin Genesis Anchor)
    // -----------------------------------------------------------------------

    public getGenesisEntropy(): Uint8Array {
        if (!this.wasmInstance || !this.memory) {
            return new Uint8Array(32);
        }
        
        // Allocate a tiny 32-byte chunk at the end of memory (or just reuse a safe offset if we can, but since WASM memory is static, let's just pass a pointer).
        // Wait, actually `v2_get_genesis_entropy` takes a pointer. 
        // We can use the start of the delta buffer temporarily since we only need to read it once during boot, 
        // or just ask WASM to return a pointer.
        // Actually, let's add `v2_genesis_entropy_ptr()` to lib.rs so we don't need to pass a pointer.
        
        // Ah, in my plan I added `v2_get_genesis_entropy(out_ptr: *mut u8)`.
        // I will use `this.getMemoryPointers().deltaBufferBytes.byteOffset` as the temporary out_ptr.
        const ptrs = this.getMemoryPointers();
        const tempPtr = ptrs.deltaBufferBytes.byteOffset;
        
        const getGeFn = this.wasmInstance.exports.v2_get_genesis_entropy as CallableFunction;
        if (getGeFn) {
            getGeFn(tempPtr);
            // Copy it to a new array so it doesn't get overwritten by delta buffer writes later
            return new Uint8Array(this.memory.buffer.slice(tempPtr, tempPtr + 32));
        }
        return new Uint8Array(32);
    }

    // -----------------------------------------------------------------------
    // ERA 2070: Senate Alignment Feedback
    // -----------------------------------------------------------------------

    public injectIntent(phase: number, energy: number, id: number) {
        if (!this.wasmInstance) return;
        (this.wasmInstance.exports.v2_phi_inject_intent as CallableFunction)(phase, energy, id);
    }

    public applySenateAlignment(score: number) {
        if (!this.wasmInstance || !this.cachedPointers) return;
        const setAttractor = this.wasmInstance.exports.v2_set_attractor as CallableFunction;
        if (!setAttractor) return;

        // Modulate all active attractors' pulse_amp based on alignment score [-5, 5].
        // Base pulse_amp is typically 256. We'll use 256 + (score * 50).
        const newAmp = Math.max(10, 256 + (score * 50));
        
        const view = new DataView(this.cachedPointers.attractorBytes.buffer, this.cachedPointers.attractorBytes.byteOffset, 80);
        const count = view.getUint32(0, true);
        
        for (let i = 0; i < Math.min(count, 4); i++) {
            const offset = 16 + (i * 16);
            const matrix = view.getUint32(offset, true);
            const inverse = view.getUint32(offset + 4, true);
            const pulseFreq = view.getUint32(offset + 8, true);
            
            // Overwrite attractor with new amplitude
            setAttractor(i, matrix, inverse, pulseFreq, newAmp);
        }
    }
}
