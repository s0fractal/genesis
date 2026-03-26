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
let ringBuffer: SharedArrayBuffer;
let ringSlotSize = 0;
let telemetryBuffer: SharedArrayBuffer;

let isInitialized = false;
let isPhysicsRunning = false;
let tickCount = 0;
let currentGridResonance = 0;

const connections: MessagePort[] = [];

// Vector III: Meta-Compilation Physics Bridge
globalThis.addEventListener("substratePhysicsDelta", (e: any) => {
    const detail = e.detail;
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
        
        // Era 800: Write Telemetry to SAB for 144FPS Rendering
        if (telemetryBuffer) {
            const tView = new Float32Array(telemetryBuffer);
            tView[0] = entropy;
            tView[1] = currentGridResonance;
        }

        if (!oracle.isBusy) {
            if (engine && engine.device) {
                // Wait for the async WebGPU pipeline to finish the dispatch and map back to SharedArrayBuffer
                await engine.tick();
                
                // Vector II: Periodic Spatial Halo Extraction (2 FPS)
                if (tickCount % 30 === 0 && network) {
                    const halos = await engine.extractLocalHalosAsync();
                    if (halos) {
                        network.broadcastHalos(new Float32Array(halos.left.buffer), new Float32Array(halos.right.buffer));
                    }
                }
            } else {
                // CPU Fallback (WASM)
                execute_phase_lattice_tick(field);
            }
        }

        oracle.sync();

        tickCount++;

            // Era 800: Atomics.wait Ring Buffer (Zero-Copy)
            const memBuf = sharedMemory.buffer;
            const agentsSize = field.cell_count() * 16;
            const agentsOffset = field.ptr_agents();
            const thetaOffset = field.ptr_spatial_memory_theta();
            const strengthOffset = field.ptr_spatial_memory_strength();
            const spatialSize = field.sectors * field.radial_bins * field.harmonics;
            const alignedSpatialSize = Math.ceil(spatialSize / 4) * 4;

            const header = new Int32Array(ringBuffer, 0, 4);
            let flag = Atomics.load(header, 0);
            flag++;
            const slotIdx = flag % 3;
            const offset = 16 + slotIdx * ringSlotSize;
            
            const view = new Uint8Array(ringBuffer, offset, ringSlotSize);
            const memView = new Uint8Array(memBuf);

            view.set(memView.subarray(agentsOffset, agentsOffset + agentsSize), 0);
            view.set(memView.subarray(thetaOffset, thetaOffset + spatialSize), agentsSize);
            view.set(memView.subarray(strengthOffset, strengthOffset + spatialSize), agentsSize + alignedSpatialSize);

            header[3] = field.get_current_tau();
            Atomics.store(header, 0, flag);
            Atomics.notify(header, 0);
            
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
    network = new PhaseNetwork((p) => {
        // Placeholder for remote plasmid ingestion
    }, (packet) => {
        for (const port of connections) {
            port.postMessage(packet);
        }
    });

    network.onHaloReceived = (left: Uint8Array, right: Uint8Array) => {
        if (engine) engine.ingestRemoteHalos(left, right);
    };

    // The Oracle acts natively against either the WebGPU map or CPU mapping
    oracle = new SovereignOracle(field, sharedMemory, engine);
    oracle.boot();

    // Era 800: Allocate Ring Buffer for Render Interop
    const agentsSize = field.cell_count() * 16;
    const spatialSize = field.sectors * field.radial_bins * field.harmonics;
    const alignedSpatialSize = Math.ceil(spatialSize / 4) * 4;
    ringSlotSize = agentsSize + (alignedSpatialSize * 2);
    ringBuffer = new SharedArrayBuffer(16 + ringSlotSize * 3);
    telemetryBuffer = new SharedArrayBuffer(32);

    isInitialized = true;
    isPhysicsRunning = true;
    
    console.log("[LatticeWorker] Architecture Ready. Engaging Physics.");
    physicsLoop();
}

// deno-lint-ignore no-explicit-any
(self as any).onconnect = (e: MessageEvent) => {
    const port = e.ports[0];
    connections.push(port);

    port.addEventListener("message", async (msg) => {
        if (msg.data.type === 'HELO') {
            try {
                await initEnvironment();
                
                port.postMessage({
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
                        ring_buffer: ringBuffer,
                        slot_size: ringSlotSize,
                        telemetry_buffer: telemetryBuffer
                    }
                });
            } catch (err: any) {
                console.error("[LatticeWorker] FATAL BOOT ERROR:", err);
                port.postMessage({ type: 'INIT_ERR', error: err.message || err.toString(), stack: err.stack });
            }
        }
        
        else if (msg.data.type === 'GOD_HAND_ENERGY') {
            // Implement simple WASM memory injection or add to queue
        } else if (msg.data.type === 'FOREIGN_PLASMID' || msg.data.type === 'HALO_SYNC') {
            if (network) network.handleIncomingPacket(msg.data);
        }
    });

    port.start();
};
