/**
 * OMEGA-64 Era 950: V2 Bridge
 * 
 * Bare-metal WASM Instantiation wrapper.
 * Connects the TypeScript Cyber-Climate (Environmental Vector) directly 
 * into the `no_std` zero-cost Rust kernel using naked FFI calls.
 */

import { measureHardwareEnvironment, QTopology } from "./environmental_vector.ts";

export class OmegaV2Engine {
    private wasmInstance: WebAssembly.Instance | null = null;
    private memory: WebAssembly.Memory | null = null;
    private currentTopology: QTopology | null = null;

    constructor() {}

    /**
     * Initializes the bare-metal WASM kernel.
     */
    async boot(adapter: GPUAdapter) {
        console.log("🌌 [OMEGA-V2] Bootstrapping Bare-Metal Engine...");

        // 1. Fetch Dynamic Derived Constraints from Host Device
        this.currentTopology = await measureHardwareEnvironment(adapter, 16);

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
        const exports = this.wasmInstance.exports;

        // 1. Get raw WASM pointers offset integers

        // 1. Get raw WASM pointers offset integers
        const latticePtr = (exports.v2_lattice_ptr as CallableFunction)() as number;
        const agentsPtr = (exports.v2_agents_ptr as CallableFunction)() as number;
        const lutPtr = (exports.v2_sine_lut_ptr as CallableFunction)() as number;

        // 2. Struct Size known from Rust #[repr(C)] (PhaseTopology=16 + SignalStore=16 + OntologicalIntent=16 = 48 bytes)
        const LATTICE_UNIFORM_SIZE = 48;

        // 3. Gracefully Clamp WASM memory mapping just in case GPU VRAM > WASM .bss allocation
        const requestedBytes = this.currentTopology.maxAllocatedAgents * 16;
        const maxSafeBytes = this.memory.buffer.byteLength - agentsPtr;
        const actualBytes = Math.min(requestedBytes, maxSafeBytes);

        // Update Darwinian limits down to the WASM bottleneck if necessary
        this.currentTopology.maxAllocatedAgents = Math.floor(actualBytes / 16);

        return {
            uniformBytes: new Uint8Array(this.memory.buffer, latticePtr, LATTICE_UNIFORM_SIZE),
            agentBytes: new Uint8Array(this.memory.buffer, agentsPtr, actualBytes),
            sineLutBytes: new Int32Array(this.memory.buffer, lutPtr, 128),
            wasmMemoryBuffer: this.memory.buffer 
        };
    }
}
