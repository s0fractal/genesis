/// <reference lib="webworker" />
import initWasm, { PhaseLatticeField, phase_lattice_shannon_entropy, execute_phase_lattice_tick } from "@wasm";
import { SovereignOracle } from "../ontology/oracle.ts";

// Global Shared State
let field: PhaseLatticeField;
let oracle: SovereignOracle;
let sharedMemory: WebAssembly.Memory;

let isInitialized = false;
let isPhysicsRunning = false;
let tickCount = 0;

const connections: MessagePort[] = [];

// Vector III: Meta-Compilation Physics Bridge
globalThis.addEventListener("substratePhysicsDelta", (e: any) => {
    const detail = e.detail;
    if (field && field.set_physics_parameter) {
         field.set_physics_parameter(detail.key, detail.value);
    }
});

// The Headless Physics Loop
function physicsLoop() {
    if (!isPhysicsRunning) return;

    try {
        const entropy = phase_lattice_shannon_entropy(field) / 1024.0;
        oracle.tickHomeostasis(entropy);

        if (!oracle.isBusy) {
            // Core WASM CPU Physics Tick
            execute_phase_lattice_tick(field);
        }

        oracle.sync();

        tickCount++;

        // Broadcast metadata at lower frequency
        if (tickCount % 4 === 0) {
            const payload = {
                type: 'SYNC_METADATA',
                current_tau: field.get_current_tau(),
                entropy: entropy,
                globalEnergy: oracle.getGlobalEnergy(),
                climate: oracle.getCurrentClimate(),
                queueSize: oracle.getQueueSize(),
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

    // Attempt ~60FPS
    setTimeout(physicsLoop, 16);
}

async function initEnvironment() {
    if (isInitialized) return;
    console.log("[LatticeWorker] Bootstrapping WASM Environment...");

    const wasm = await initWasm();
    // Verify memory is shared
    if (!(wasm.memory.buffer instanceof SharedArrayBuffer)) {
        console.warn("[LatticeWorker] WARNING: WASM memory is not a SharedArrayBuffer. Multi-tab federation will fail or cause cloning overhead.");
    }
    
    sharedMemory = wasm.memory as WebAssembly.Memory;
    field = new PhaseLatticeField(256, 256, 3);
    
    // Seed Header manually or via function
    // (Assuming hydrateSubstrateHeader equivalent is handled or oracle syncs it)
    
    // Instantiate Oracle in headless mode
    // We pass null for ComputeEngine and Observer since they are on Main Thread
    oracle = new SovereignOracle(field, sharedMemory, undefined, undefined);
    oracle.boot();

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
            await initEnvironment();
            
            port.postMessage({
                type: 'INIT_ACK',
                memory: sharedMemory, // Pass the WebAssembly.Memory (or its buffer)
                metadata: {
                    sectors: field.sectors,
                    radial_bins: field.radial_bins,
                    harmonics: field.harmonics,
                    tau_depth: field.tau_depth,
                    cell_count: field.cell_count(),
                    ptr_agents: field.ptr_agents(),
                    ptr_header: field.ptr_header()
                }
            });
        }
        
        else if (msg.data.type === 'GOD_HAND_ENERGY') {
            // Implement simple WASM memory injection or add to queue
        }
    });

    port.start();
};
