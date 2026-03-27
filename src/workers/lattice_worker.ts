/// <reference lib="webworker" />
import initWasm, { PhaseLatticeField, phase_lattice_shannon_entropy, execute_phase_lattice_tick } from "@wasm";
import { SovereignOracle } from "../ontology/oracle.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseNetwork } from "../shared/phase_network.ts";

// Global Shared State
let field: PhaseLatticeField;
let oracle: SovereignOracle;
let engine: PhaseComputeEngine | undefined;
let network: PhaseNetwork | undefined;
let sharedMemory: WebAssembly.Memory;
let ringSlotSize = 0;

let isInitialized = false;
let isPhysicsRunning = false;
let tickCount = 0;
let currentGridResonance = 0;

const bufferPool: ArrayBuffer[] = [];
const connections: MessagePort[] = [];

// Vector III: Meta-Compilation Physics Bridge
globalThis.addEventListener("substratePhysicsDelta", (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (field && field.set_physics_parameter) {
         field.set_physics_parameter(detail.key, detail.value);
    }
});

// The Headless Physics Loop
async function physicsLoop() {
    if (!isPhysicsRunning) return;

    try {
        if (tickCount % 15 === 0) {
            const numSpatialCells = field.cell_count();
            const agentsOffset = field.ptr_agents();
            const agentsView = new Uint32Array(sharedMemory.buffer, agentsOffset, numSpatialCells * 6);
            
            let sumU = 0;
            let sumV = 0;
            let sumW = 0;
            
            for (let i = 0; i < numSpatialCells; i += 8) { // Aggressive subsampling for JS perf
                const t3 = agentsView[i * 6 + 3];
                const thetaRaw = t3 & 0xFF;
                const entRaw = (t3 >>> 24) & 0xFF;
                
                // Map to Bloch Sphere angles
                // ent mapping: [0, 255] -> [0, pi]
                const polarAngle = (entRaw / 255.0) * Math.PI;
                // theta mapping: [0, 255] -> [0, 2pi)
                const azimuthAngle = (thetaRaw / 255.0) * Math.PI * 2.0;
                
                sumU += Math.sin(polarAngle) * Math.cos(azimuthAngle);
                sumV += Math.sin(polarAngle) * Math.sin(azimuthAngle);
                sumW += Math.cos(polarAngle);
            }
            const samples = Math.ceil(numSpatialCells / 8);
            currentGridResonance = Math.sqrt(sumU * sumU + sumV * sumV + sumW * sumW) / samples;
        }

        const entropy = phase_lattice_shannon_entropy(field) / 1024.0;
        oracle.tickHomeostasis(entropy, currentGridResonance);
        
        // Era 850: Write Telemetry directly to WASM Memory exported buffer
        if (sharedMemory) {
            const tView = new Float32Array(sharedMemory.buffer, field.ptr_telemetry_buffer(), 8);
            tView[0] = entropy;
            tView[1] = currentGridResonance;
        }

        if (!oracle.isBusy) {
            if (engine && engine.device) {
                // Wait for the async WebGPU pipeline to finish the dispatch and map back to SharedArrayBuffer
                await engine.tick();
                

            } else {
                // CPU Fallback (WASM)
                execute_phase_lattice_tick(field);
            }
        }

        oracle.sync();

        tickCount++;

            // Era 850: Atomics.wait Ring Buffer (Pure WASM Substrate)
            const memBuf = sharedMemory.buffer;
            const AGENT_BYTES = 24;
            const agentsSize = field.cell_count() * AGENT_BYTES;
            const agentsOffset = field.ptr_agents();
            const thetaOffset = field.ptr_spatial_memory_theta();
            const strengthOffset = field.ptr_spatial_memory_strength();
            const spatialSize = field.sectors * field.radial_bins * field.harmonics;
            const alignedSpatialSize = Math.ceil(spatialSize / 4) * 4;

            const ringPtr = field.ptr_ring_buffer();
            const header = new Int32Array(memBuf, ringPtr, 4);
            let flag = Atomics.load(header, 0);
            flag++;
            const slotIdx = flag % 3;
            // Native zero-copy within same buffer:
            const targetOffset = ringPtr + 16 + slotIdx * ringSlotSize;
            
            const view = new Uint8Array(memBuf);
            view.copyWithin(targetOffset, agentsOffset, agentsOffset + agentsSize);
            view.copyWithin(targetOffset + agentsSize, thetaOffset, thetaOffset + spatialSize);
            view.copyWithin(targetOffset + agentsSize + alignedSpatialSize, strengthOffset, strengthOffset + spatialSize);

            header[3] = field.get_current_tau();
            Atomics.store(header, 0, flag);
            Atomics.notify(header, 0);

            if (!(memBuf instanceof SharedArrayBuffer)) {
                // Era 850 Fallback: Simulate zero-copy ring buffer with explicit payload
                let fallbackBuffer = bufferPool.pop();
                if (!fallbackBuffer || fallbackBuffer.byteLength !== ringSlotSize) {
                    fallbackBuffer = new ArrayBuffer(ringSlotSize);
                }
                const fallbackView = new Uint8Array(fallbackBuffer);
                fallbackView.set(view.subarray(targetOffset, targetOffset + ringSlotSize));

                postMessage({
                    type: 'FRAME_FALLBACK',
                    tau: field.get_current_tau(),
                    buffer: fallbackBuffer
                }, [fallbackBuffer]);
            }
            
            // Re-sync metadata sparsely
            if (tickCount % 4 === 0) {
                const payload = {
                    type: 'SYNC_METADATA',
                    current_tau: field.get_current_tau(),
                    entropy: entropy,
                    resonance: currentGridResonance,
                    globalEnergy: oracle.getGlobalEnergy(),
                    climate: oracle.getCurrentClimate(),
                    queueSize: oracle.getQueueSize(),
                    nomosVerified: oracle.nomosProofsVerified,
                    nomosOrphaned: oracle.nomosOrphanedPlasmids,
                    apexPlasmids: oracle.getApexPlasmids(3).map(p => ({
                        hash: p.hash.toString(),
                        astStr: p.ast,
                        energy: p.energy
                    }))
                };
                for (const port of connections) {
                    port.postMessage(payload);
                }
            }
    } catch (e) {
        console.error("[LatticeWorker] Physics loop fault:", e);
    }

    setTimeout(physicsLoop, 16);
}

async function initEnvironment() {
    if (isInitialized) return;
    console.log("[LatticeWorker] Bootstrapping WASM Environment...");

    const wasm = await initWasm();
    // Verify memory is shared
    if (typeof SharedArrayBuffer === "undefined" || !(wasm.memory.buffer instanceof SharedArrayBuffer)) {
        console.warn("[LatticeWorker] WARNING: WASM memory is not a SharedArrayBuffer. Multi-tab federation will fail or cause cloning overhead.");
    }
    
    sharedMemory = wasm.memory as WebAssembly.Memory;
    field = new PhaseLatticeField(256, 256, 3);
    
    // Seed Header manually or via function
    let device: GPUDevice | null = null;
    try {
        if (navigator.gpu) {
            const adapterPromise = navigator.gpu.requestAdapter();
            const timeoutPromise = new Promise<GPUAdapter | null>((_, reject) => setTimeout(() => reject(new Error("WebGPU Adapter Timeout")), 3000));
            const adapter = await Promise.race([adapterPromise, timeoutPromise]) as GPUAdapter | null;
            if (adapter) {
                device = await adapter.requestDevice();
                console.log("[LatticeWorker] WebGPU Context Acquired in Background Thread.");
                engine = new PhaseComputeEngine(device, field, sharedMemory);
                await engine.init();
            }
        }
    } catch (err) {
        console.error("[LatticeWorker] WebGPU initialization failed, defaulting to CPU WASM:", err);
    }

    // Instantiate Macro-Torus Network Mycelium
    network = new PhaseNetwork((_p) => {
        // Placeholder for remote plasmid ingestion
    }, (packet) => {
        self.postMessage(packet);
    });

    network.onImpactReceived = (impact) => {
        // Will be picked up and simulated deterministically by the Oracle
        console.log(`[LatticeWorker] 🌌 Impact Event received at [${impact.x}, ${impact.y}]! Energy: ${impact.energy}`);
    };

    // The Oracle acts natively against either the WebGPU map or CPU mapping
    oracle = new SovereignOracle(field as unknown as OracleCompatibleField, sharedMemory, engine);
    oracle.boot();

    // Era 850: Using WASM Native Ring Buffer bounds
    const agentsSize = field.cell_count() * 24;
    const spatialSize = field.sectors * field.radial_bins * field.harmonics;
    const alignedSpatialSize = Math.ceil(spatialSize / 4) * 4;
    ringSlotSize = agentsSize + (alignedSpatialSize * 2);

    isInitialized = true;
    isPhysicsRunning = true;
    
    console.log("[LatticeWorker] Architecture Ready. Engaging Physics.");
    physicsLoop();
}

// deno-lint-ignore no-explicit-any
(self as any).onmessage = async (msg: MessageEvent) => {
    if (msg.data.type === 'RECYCLE_BUFFER') {
        bufferPool.push(msg.data.buffer);
        return;
    }
    if (msg.data.type === 'HELO') {
        try {
            await initEnvironment();
            
            self.postMessage({
                type: 'INIT_ACK',
                metadata: {
                    sectors: field.sectors,
                    radial_bins: field.radial_bins,
                    harmonics: field.harmonics,
                    tau_depth: field.tau_depth,
                    cell_count: field.cell_count(),
                    ptr_agents: field.ptr_agents(),
                    ptr_header: field.ptr_header(),
                    ptr_spatial_memory_theta: field.ptr_spatial_memory_theta(),
                    ptr_spatial_memory_strength: field.ptr_spatial_memory_strength(),
                    ring_buffer: sharedMemory.buffer,
                    ring_buffer_ptr: field.ptr_ring_buffer(),
                    telemetry_ptr: field.ptr_telemetry_buffer(),
                    slot_size: ringSlotSize
                }
            });
        } catch (err: unknown) {
            console.error("[LatticeWorker] FATAL BOOT ERROR:", err);
            const msg = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            self.postMessage({ type: 'INIT_ERR', error: msg, stack });
        }
    }
    
    else if (msg.data.type === 'GOD_HAND_ENERGY') {
        // Implement simple WASM memory injection or add to queue
    } else if (msg.data.type === 'FOREIGN_PLASMID' || msg.data.type === 'IMPACT_EVENT') {
        if (network) network.handleIncomingPacket(msg.data);
    }
};
