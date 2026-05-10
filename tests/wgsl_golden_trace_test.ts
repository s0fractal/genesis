// Era 0204: Multi-tick WGSL Automated Test Harness
// Verifies that compute_toroidal.wgsl produces bit-for-bit identical
// output to Rust tick_physics() across multiple ticks, topologies, and attractors.

import { assertEquals } from "jsr:@std/assert";
const DEBUG_WGSL_PARITY = Deno.env.get("DEBUG_WGSL_PARITY") === "1";
const computeToroidalSrc = await Deno.readTextFile("src/lens/shaders/compute_toroidal.wgsl");

// Skip if WebGPU is unavailable (CI/headless environments).
const gpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

async function instantiateWasm(): Promise<WebAssembly.Instance> {
    const bytes = await Deno.readFile("public/v2/omega_v2_core.wasm");
    const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
    return instance;
}

const CONFIGS = [
    { topology: 2, attractors: 0, ticks: 1 },
    { topology: 5, attractors: 1, ticks: 2 },
    { topology: 7, attractors: 4, ticks: 8 },
    { topology: 7, attractors: 0, ticks: 4 }, // DEBUG: no-attractor baseline
    { topology: 7, attractors: 4, ticks: 3 }, // DEBUG: attractor 3-tick check
    { topology: 7, attractors: 4, ticks: 1 },
    { topology: 7, attractors: 4, ticks: 8 },
    { topology: 7, attractors: 4, ticks: 16 },
    { topology: 7, attractors: 4, ticks: 32 },
];

if (gpuAvailable) {
    // Top-level await for GPU and WASM initialization to save overhead between tests
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("WebGPU adapter unavailable");
    const device = await adapter.requestDevice();
    device.pushErrorScope("validation");
    const shaderModule = device.createShaderModule({ code: computeToroidalSrc });
    const pipeline = await device.createComputePipelineAsync({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: "compute_main" },
    });
    const initErr = await device.popErrorScope();
    if (initErr) {
        console.error("[PIPELINE CREATION ERROR]", initErr.message);
    }

    const wasm = await instantiateWasm();
    const exports = wasm.exports;
    const memory = exports.memory as WebAssembly.Memory;

    // We only need to boot engine once to link memory pointers
    (exports.v2_boot_engine as CallableFunction)();

    const AGENT_COUNT = 8; // DEBUG: reduced to isolate tick-4 attractor drift
    const SEED = 0x64_4D_53_45;

    for (const conf of CONFIGS) {
        Deno.test({
            name: `wgsl: toroidal parity [q_phase=${conf.topology}, attr=${conf.attractors}, ticks=${conf.ticks}]`,
            async fn() {
                // --- 1. Reset Runtime State ---
                (exports.v2_reset_runtime_state as CallableFunction)();
                (exports.v2_set_environment as CallableFunction)(conf.topology, 3, 2, 1024);
                (exports.v2_ignite_big_bang as CallableFunction)(SEED, AGENT_COUNT);

                if (conf.attractors > 0) {
                    (exports.v2_set_attractor as CallableFunction)(0, 0xABCDEF01, 0x543210FE, 220, 512);
                    if (conf.attractors > 1) {
                        (exports.v2_set_attractor as CallableFunction)(1, 0x11111111, 0xEEEEEEEE, 100, 256);
                        (exports.v2_set_attractor as CallableFunction)(2, 0x22222222, 0xDDDDDDDD, 300, 1024);
                        (exports.v2_set_attractor as CallableFunction)(3, 0x33333333, 0xCCCCCCCC, 50, 128);
                    }
                }

                // --- 2. Snapshot initial state from WASM ---
                const latticePtr = (exports.v2_lattice_ptr as CallableFunction)() as number;
                const agentsPtr = (exports.v2_agents_ptr as CallableFunction)() as number;
                const lutQ10Ptr = (exports.v2_sine_lut_q10_ptr as CallableFunction)() as number;
                const attractorPtr = (exports.v2_attractor_array_ptr as CallableFunction)() as number;

                const uniformBytes = new Uint8Array(memory.buffer, latticePtr, 192);
                const agentBytes = new Uint8Array(memory.buffer, agentsPtr, AGENT_COUNT * 32);
                const sineLutBytes = new Int32Array(memory.buffer, lutQ10Ptr, 256);
                const attractorBytes = new Uint8Array(memory.buffer, attractorPtr, 80);

                const gpuAgentBytes = new Uint8Array(agentBytes);

                // --- 3. Buffers ---
                const topologyBuf = device.createBuffer({
                    size: 32,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });
                const signalsBuf = device.createBuffer({
                    size: 48,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });
                const agentsInBuf = device.createBuffer({
                    size: gpuAgentBytes.byteLength,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                });
                const agentsOutBuf = device.createBuffer({
                    size: gpuAgentBytes.byteLength,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                });
                const stagingBuf = device.createBuffer({
                    size: gpuAgentBytes.byteLength,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                const sineLutBuf = device.createBuffer({
                    size: 256 * 4,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                });
                const attractorBuf = device.createBuffer({
                    size: 80,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });

                device.queue.writeBuffer(topologyBuf, 0, uniformBytes.buffer, uniformBytes.byteOffset, 32);
                if (DEBUG_WGSL_PARITY) {
                    let topHex = "";
                    for(let k=0; k<32; k++) topHex += uniformBytes[k].toString(16).padStart(2, "0") + " ";
                    console.log(`[DEBUG] Hex dump of topologyBuf upload: ${topHex}`);
                    console.log(`[DEBUG] SINE_LUT[0]=${sineLutBytes[0]} SINE_LUT[64]=${sineLutBytes[64]}`);
                }
                device.queue.writeBuffer(signalsBuf, 0, uniformBytes.buffer, uniformBytes.byteOffset + 32, 48);
                if (DEBUG_WGSL_PARITY) {
                    let agentHex = "";
                    for(let k=0; k<32; k++) agentHex += gpuAgentBytes[k].toString(16).padStart(2, "0") + " ";
                    console.log(`[DEBUG] Hex dump of gpuAgentBytes upload: ${agentHex}`);
                }
                device.queue.writeBuffer(agentsInBuf, 0, gpuAgentBytes.buffer, gpuAgentBytes.byteOffset, gpuAgentBytes.byteLength);
                device.queue.writeBuffer(sineLutBuf, 0, sineLutBytes.buffer, sineLutBytes.byteOffset, sineLutBytes.byteLength);
                device.queue.writeBuffer(attractorBuf, 0, attractorBytes.buffer, attractorBytes.byteOffset, attractorBytes.byteLength);

                const bindGroupA = device.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: { buffer: topologyBuf } },
                        { binding: 1, resource: { buffer: signalsBuf } },
                        { binding: 2, resource: { buffer: agentsInBuf } },
                        { binding: 3, resource: { buffer: sineLutBuf } },
                        { binding: 7, resource: { buffer: agentsOutBuf } },
                        { binding: 8, resource: { buffer: attractorBuf } },
                    ],
                });

                device.pushErrorScope("validation");
                const bindGroupB = device.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: { buffer: topologyBuf } },
                        { binding: 1, resource: { buffer: signalsBuf } },
                        { binding: 2, resource: { buffer: agentsOutBuf } },
                        { binding: 3, resource: { buffer: sineLutBuf } },
                        { binding: 7, resource: { buffer: agentsInBuf } },
                        { binding: 8, resource: { buffer: attractorBuf } },
                    ],
                });
                const bgErr = await device.popErrorScope();
                if (bgErr) {
                    console.error("[BINDGROUP B ERROR]", bgErr.message);
                }

                for (let i = 0; i < conf.ticks; i++) {
                    const sigDataBefore = new DataView(uniformBytes.buffer, uniformBytes.byteOffset + 32, 48);
                    
                    // 1. Sync uniforms BEFORE CPU modifies them!
                    // Note: Since ProperTime is advanced at the end of the CPU tick, we don't need to predict it.
                    // WGSL and CPU both use the current proper_time.
                    device.queue.writeBuffer(signalsBuf, 0, uniformBytes.buffer, uniformBytes.byteOffset + 32, 48);
                    device.queue.writeBuffer(attractorBuf, 0, attractorBytes.buffer, attractorBytes.byteOffset, attractorBytes.byteLength);

                    let hex = "";
                    for(let k=0; k<16; k++) hex += uniformBytes[32+k].toString(16).padStart(2, "0") + " ";
                    // console.log(`[DEBUG] Hex dump of signalsBuf upload: ${hex}`);
                    // console.log(`[DEBUG] uniform absolute_tick=${sigDataBefore.getUint32(4, true)} active=${sigDataBefore.getUint32(8, true)} total_energy=${sigDataBefore.getUint32(24, true)}`);
                    // Log input state before tick 4
                    if (DEBUG_WGSL_PARITY && i === 3) {
                        const a0 = new DataView(agentBytes.buffer, agentBytes.byteOffset, 32);
                        console.log(`[TICK4 INPUT] Agent 0: phase=${a0.getUint32(0,true)} energy=${a0.getUint32(4,true)} mem=[${a0.getUint32(20,true)},${a0.getUint32(24,true)},${a0.getUint32(28,true)}]`);
                    }
                    
                    // 2. CPU Tick
                    (exports.v2_tick as CallableFunction)();

                    // 3. GPU Tick
                    device.pushErrorScope("validation");
                    const encoder = device.createCommandEncoder();
                    const pass = encoder.beginComputePass();
                    pass.setPipeline(pipeline);
                    pass.setBindGroup(0, i % 2 === 0 ? bindGroupA : bindGroupB);
                    pass.dispatchWorkgroups(Math.ceil(AGENT_COUNT / 64));
                    pass.end();
                    
                    const outBuf = i % 2 === 0 ? agentsOutBuf : agentsInBuf;
                    encoder.copyBufferToBuffer(outBuf, 0, stagingBuf, 0, gpuAgentBytes.byteLength);
                    device.queue.submit([encoder.finish()]);

                    const err = await device.popErrorScope();
                    if (err) {
                        console.error("[WEBGPU ERROR]", err.message);
                    }

                    // Wait and verify IMMEDIATELY
                    await stagingBuf.mapAsync(GPUMapMode.READ);
                    const gpuTickOut = new Uint8Array(stagingBuf.getMappedRange());
                    const cpuTickOut = new Uint8Array(agentBytes);
                    
                    let firstMismatch = -1;
                    for (let j = 0; j < gpuTickOut.length; j++) {
                        if (gpuTickOut[j] !== cpuTickOut[j]) {
                            firstMismatch = j;
                            break;
                        }
                    }
                    
                    if (firstMismatch !== -1) {
                        const agentIdx = Math.floor(firstMismatch / 32);
                        const fieldOffset = firstMismatch % 32;
                        
                        // Count total mismatching agents
                        let mismatchCount = 0;
                        for (let j = 0; j < gpuTickOut.length; j += 32) {
                            for (let k = 0; k < 32; k++) {
                                if (gpuTickOut[j+k] !== cpuTickOut[j+k]) { mismatchCount++; break; }
                            }
                        }
                        
                        const cpuA = new DataView(cpuTickOut.buffer, cpuTickOut.byteOffset + agentIdx * 32, 32);
                        const gpuA = new DataView(gpuTickOut.buffer, gpuTickOut.byteOffset + agentIdx * 32, 32);
                        const sigData = new DataView(uniformBytes.buffer, uniformBytes.byteOffset + 32, 48);
                        console.log(`[DEBUG] abs_tick=${sigData.getUint32(4, true)} active=${sigData.getUint32(8, true)} mismatching_agents=${mismatchCount}`);
                        console.log(`[MISMATCH] Tick ${i+1}: CPU Agent ${agentIdx}: phase=${cpuA.getUint32(0,true)} energy=${cpuA.getUint32(4,true)} mem=[${cpuA.getUint32(20,true)}, ${cpuA.getUint32(24,true)}, ${cpuA.getUint32(28,true)}]`);
                        console.log(`[MISMATCH] Tick ${i+1}: GPU Agent ${agentIdx}: phase=${gpuA.getUint32(0,true)} energy=${gpuA.getUint32(4,true)} mem=[${gpuA.getUint32(20,true)}, ${gpuA.getUint32(24,true)}, ${gpuA.getUint32(28,true)}]`);
                        
                        // Sample a few more mismatching agents to see if delta is consistent
                        let sampleCount = 0;
                        for (let j = 32; j < gpuTickOut.length && sampleCount < 4; j += 32) {
                            let diff = false;
                            for (let k = 0; k < 32; k++) { if (gpuTickOut[j+k] !== cpuTickOut[j+k]) { diff = true; break; } }
                            if (diff) {
                                const ai = j / 32;
                                const cpuS = new DataView(cpuTickOut.buffer, cpuTickOut.byteOffset + j, 32);
                                const gpuS = new DataView(gpuTickOut.buffer, gpuTickOut.byteOffset + j, 32);
                                const dp = cpuS.getUint32(0,true) - gpuS.getUint32(0,true);
                                console.log(`[SAMPLE] Agent ${ai}: cpu_phase=${cpuS.getUint32(0,true)} gpu_phase=${gpuS.getUint32(0,true)} delta=${dp} cpu_energy=${cpuS.getUint32(4,true)} gpu_energy=${gpuS.getUint32(4,true)}`);
                                sampleCount++;
                            }
                        }
                        stagingBuf.unmap();

                        console.log(`[WGSL DEBUG] attractor_drift=${gpuA.getInt32(20, true)} weight_left_packed=${gpuA.getUint32(24,true)} weight_right=${gpuA.getUint32(28,true)}`);
                        throw new Error(`WGSL drift detected at tick ${i+1}, byte ${firstMismatch} (agent ${agentIdx}, field offset ${fieldOffset})`);
                    }
                    
                    stagingBuf.unmap();
                }

                // Cleanup buffers
                topologyBuf.destroy();
                signalsBuf.destroy();
                agentsInBuf.destroy();
                agentsOutBuf.destroy();
                stagingBuf.destroy();
                sineLutBuf.destroy();
                attractorBuf.destroy();
            },
        });
    }

    Deno.test({
        name: "wgsl: cleanup GPU device",
        fn() {
            device.destroy();
        }
    });
} else {
    Deno.test({
        name: "wgsl: toroidal shader bit-exact parity [SKIPPED - NO WEBGPU]",
        ignore: true,
        fn() {}
    });
}
