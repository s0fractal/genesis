// Era 0201: WGSL Automated Test Harness
// Verifies that compute_toroidal.wgsl produces bit-for-bit identical
// output to Rust tick_physics() for the same initial state.

import { assertEquals } from "jsr:@std/assert";
const computeToroidalSrc = await Deno.readTextFile("src/lens/shaders/compute_toroidal.wgsl");

// Skip if WebGPU is unavailable (CI/headless environments).
const gpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

async function instantiateWasm(): Promise<WebAssembly.Instance> {
    const bytes = await Deno.readFile("dist/v2/omega_v2_core.wasm");
    const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
    return instance;
}

Deno.test({
    name: "wgsl: toroidal shader bit-exact parity with Rust tick_physics",
    ignore: !gpuAvailable,
    async fn() {
        // --- 1. Boot WASM kernel ---
        const wasm = await instantiateWasm();
        const exports = wasm.exports;
        const memory = exports.memory as WebAssembly.Memory;

        (exports.v2_boot_engine as CallableFunction)();
        (exports.v2_set_environment as CallableFunction)(7, 3, 2);

        // Seed = deterministic museum seed
        const SEED = 0x64_4D_53_45;
        const AGENT_COUNT = 1_024; // small but sufficient for parity check
        (exports.v2_ignite_big_bang as CallableFunction)(SEED, AGENT_COUNT);
        (exports.v2_clear_attractors as CallableFunction)();
        (exports.v2_set_attractor as CallableFunction)(0, 0xABCDEF01, 0x543210FE, 220, 512);

        // --- 2. Snapshot initial state from WASM ---
        const latticePtr = (exports.v2_lattice_ptr as CallableFunction)() as number;
        const agentsPtr = (exports.v2_agents_ptr as CallableFunction)() as number;
        const lutPtr = (exports.v2_sine_lut_ptr as CallableFunction)() as number;
        const lutQ10Ptr = (exports.v2_sine_lut_q10_ptr as CallableFunction)() as number;
        const attractorPtr = (exports.v2_attractor_array_ptr as CallableFunction)() as number;

        const uniformBytes = new Uint8Array(memory.buffer, latticePtr, 160);
        const agentBytes = new Uint8Array(memory.buffer, agentsPtr, AGENT_COUNT * 32);
        const sineLutBytes = new Int32Array(memory.buffer, lutQ10Ptr, 256);
        const attractorBytes = new Uint8Array(memory.buffer, attractorPtr, 80);
        console.log(`[WGSL-HARNESS] sine_lut[0]=${sineLutBytes[0]} sine_lut[1]=${sineLutBytes[1]} sine_lut[64]=${sineLutBytes[64]}`);

        // Debug: verify active_agent_count
        const signalsView = new DataView(uniformBytes.buffer, uniformBytes.byteOffset + 16, 16);
        const activeCount = signalsView.getUint32(8, true);
        console.log(`[WGSL-HARNESS] active_agent_count = ${activeCount}`);

        // Save pre-tick snapshot for GPU
        const gpuAgentBytes = new Uint8Array(agentBytes);

        // Debug: topology and pre-tick agents
        const topoView = new DataView(uniformBytes.buffer, uniformBytes.byteOffset, 16);
        console.log(`[WGSL-HARNESS] Topology: q_phase=${topoView.getUint32(0,true)} q_sectors=${topoView.getUint32(4,true)} q_radial=${topoView.getUint32(8,true)} q_math=${topoView.getUint32(12,true)}`);
        for (const idx of [0, 1, 7, 8, 9, 63, 64]) {
            const a = new DataView(agentBytes.buffer, agentBytes.byteOffset + idx*32, 32);
            console.log(`[WGSL-HARNESS] Pre-tick agent[${idx}]: phase=${a.getUint32(0,true)} energy=${a.getUint32(4,true)} freq=${a.getInt32(8,true)} genome=${a.getUint32(16,true).toString(16)}`);
        }

        // --- 3. Run CPU tick via WASM ---
        (exports.v2_tick as CallableFunction)();
        const cpuPostTick = new Uint8Array(agentBytes);
        const postAgent0 = new DataView(agentBytes.buffer, agentBytes.byteOffset, 32);
        console.log(`[WGSL-HARNESS] CPU post-tick agent0: phase=${postAgent0.getUint32(0,true)} energy=${postAgent0.getUint32(4,true)} freq=${postAgent0.getInt32(8,true)}`);

        // --- 4. Run GPU tick via WebGPU ---
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("WebGPU adapter unavailable");
        const device = await adapter.requestDevice();

        // Buffers
        const topologyBuf = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const signalsBuf = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const agentsInBuf = device.createBuffer({
            size: gpuAgentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const agentsOutBuf = device.createBuffer({
            size: gpuAgentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
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

        device.queue.writeBuffer(topologyBuf, 0, uniformBytes, 0, 16);
        device.queue.writeBuffer(signalsBuf, 0, uniformBytes, 16, 16);
        device.queue.writeBuffer(agentsInBuf, 0, gpuAgentBytes);
        device.queue.writeBuffer(sineLutBuf, 0, sineLutBytes);
        device.queue.writeBuffer(attractorBuf, 0, attractorBytes);

        const shaderModule = device.createShaderModule({ code: computeToroidalSrc });
        const compilationInfo = await shaderModule.getCompilationInfo();
        for (const msg of compilationInfo.messages) {
            console.log(`[WGSL-COMPILER] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }
        const pipeline = await device.createComputePipelineAsync({
            layout: "auto",
            compute: { module: shaderModule, entryPoint: "compute_main" },
        });

        // Debug: pre-fill agents_out with 0xAB to detect if shader writes at all
        device.queue.writeBuffer(agentsOutBuf, 0, new Uint8Array(gpuAgentBytes.length).fill(0xAB));

        const bindGroup = device.createBindGroup({
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

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(AGENT_COUNT / 64));
        pass.end();
        encoder.copyBufferToBuffer(agentsOutBuf, 0, stagingBuf, 0, gpuAgentBytes.byteLength);
        device.queue.submit([encoder.finish()]);

        await stagingBuf.mapAsync(GPUMapMode.READ);
        const gpuPostTick = new Uint8Array(stagingBuf.getMappedRange());

        // --- 5. Bit-for-bit comparison ---
        assertEquals(
            gpuPostTick.length,
            cpuPostTick.length,
            "CPU and GPU agent arrays must have identical length",
        );

        // Debug: print agent 8 post-tick
        const cpu8 = new DataView(cpuPostTick.buffer, cpuPostTick.byteOffset + 8*32, 32);
        const gpu8 = new DataView(gpuPostTick.buffer, gpuPostTick.byteOffset + 8*32, 32);
        console.log(`[WGSL-HARNESS] CPU post-tick agent[8]: phase=${cpu8.getUint32(0,true)} energy=${cpu8.getUint32(4,true)} freq=${cpu8.getInt32(8,true)}`);
        console.log(`[WGSL-HARNESS] GPU post-tick agent[8]: phase=${gpu8.getUint32(0,true)} energy=${gpu8.getUint32(4,true)} freq=${gpu8.getInt32(8,true)}`);

        let firstMismatch = -1;
        for (let i = 0; i < gpuPostTick.length; i++) {
            if (gpuPostTick[i] !== cpuPostTick[i]) {
                firstMismatch = i;
                break;
            }
        }

        stagingBuf.unmap();

        if (firstMismatch !== -1) {
            const agentIdx = Math.floor(firstMismatch / 32);
            const fieldOffset = firstMismatch % 32;
            throw new Error(
                `WGSL drift detected at byte ${firstMismatch} (agent ${agentIdx}, field offset ${fieldOffset}). ` +
                `CPU=0x${cpuPostTick[firstMismatch].toString(16).padStart(2, "0")}, ` +
                `GPU=0x${gpuPostTick[firstMismatch].toString(16).padStart(2, "0")}`,
            );
        }

        console.log(
            `[WGSL-HARNESS] ✅ Bit-exact parity confirmed for ${AGENT_COUNT} agents over 1 tick.`,
        );
    },
});
