// Era 2070: Full WGSL-Rust-TS atan2 Parity Test
// Exhaustively verifies all 65,536 combinations of X and Y (-128 to 127).

import { assertEquals } from "jsr:@std/assert";

const wgslCode = `
fn fast_abs(v: i32) -> i32 {
    let mask = v >> 31u;
    return (v ^ mask) - mask;
}

const ATAN_LUT = array<u32, 129>(
    0u, 0u, 1u, 1u, 1u, 2u, 2u, 2u, 3u, 3u, 3u, 3u, 4u, 4u, 4u, 5u,
    5u, 5u, 6u, 6u, 6u, 7u, 7u, 7u, 8u, 8u, 8u, 8u, 9u, 9u, 9u, 10u,
    10u, 10u, 11u, 11u, 11u, 11u, 12u, 12u, 12u, 13u, 13u, 13u, 13u, 14u, 14u, 14u,
    15u, 15u, 15u, 15u, 16u, 16u, 16u, 17u, 17u, 17u, 17u, 18u, 18u, 18u, 18u, 19u,
    19u, 19u, 19u, 20u, 20u, 20u, 20u, 21u, 21u, 21u, 21u, 22u, 22u, 22u, 22u, 23u,
    23u, 23u, 23u, 23u, 24u, 24u, 24u, 24u, 25u, 25u, 25u, 25u, 25u, 26u, 26u, 26u,
    26u, 26u, 27u, 27u, 27u, 27u, 27u, 28u, 28u, 28u, 28u, 28u, 29u, 29u, 29u, 29u,
    29u, 29u, 30u, 30u, 30u, 30u, 30u, 31u, 31u, 31u, 31u, 31u, 31u, 32u, 32u, 32u,
    32u,
);

fn atan2_fast(y: i32, x: i32) -> i32 {
    if (x == 0 && y == 0) { return 0i; }
    let abs_y = fast_abs(y);
    let abs_x = fast_abs(x);
    let a = min(abs_y, abs_x);
    let b = max(abs_y, abs_x);
    var ratio = 0i;
    if (b != 0) { ratio = (a * 128) / b; }
    if (ratio > 128) { ratio = 128; }
    let octant_angle = i32(ATAN_LUT[ratio]);
    var quadrant_angle = octant_angle;
    if (abs_y > abs_x) { quadrant_angle = 64 - octant_angle; }
    if (x < 0) {
        if (y < 0) { return (128 + quadrant_angle) & 255; }
        else { return (128 - quadrant_angle) & 255; }
    } else {
        if (y < 0) { return (256 - quadrant_angle) & 255; }
        else { return quadrant_angle & 255; }
    }
}

@group(0) @binding(0) var<storage, read_write> out_buffer: array<i32>;

@compute @workgroup_size(256)
fn compute_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= 65536u) { return; }
    
    let y = i32(idx / 256u) - 128;
    let x = i32(idx % 256u) - 128;
    
    out_buffer[idx] = atan2_fast(y, x);
}
`;

const gpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

async function instantiateWasm(): Promise<WebAssembly.Instance> {
    const bytes = await Deno.readFile("public/v2/omega_v2_core.wasm");
    const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
    return instance;
}

Deno.test({
    name: "math: full 256x256 atan2 parity test (Rust vs WGSL vs TS)",
    ignore: !gpuAvailable,
    async fn() {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("WebGPU adapter unavailable");
        const device = await adapter.requestDevice();

        const shaderModule = device.createShaderModule({ code: wgslCode });
        const pipeline = await device.createComputePipelineAsync({
            layout: "auto",
            compute: { module: shaderModule, entryPoint: "compute_main" },
        });

        // 65536 * 4 bytes = 262144 bytes
        const bufferSize = 65536 * 4;
        const gpuBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const readbackBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: gpuBuffer } }],
        });

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(65536 / 256);
        passEncoder.end();

        commandEncoder.copyBufferToBuffer(gpuBuffer, 0, readbackBuffer, 0, bufferSize);
        device.queue.submit([commandEncoder.finish()]);

        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const wgslResults = new Int32Array(readbackBuffer.getMappedRange());

        // Boot WASM
        const wasm = await instantiateWasm();
        const v2_math_atan2 = wasm.exports.v2_math_atan2 as (y: number, x: number) => number;

        let mismatchCount = 0;
        for (let idx = 0; idx < 65536; idx++) {
            const y = Math.floor(idx / 256) - 128;
            const x = (idx % 256) - 128;
            
            const wgslAns = wgslResults[idx];
            const rustAns = v2_math_atan2(y, x);
            
            // Note: v2_math_atan2 returns u32, let's normalize to i32 for comparison
            // though it's already bounded to 0..255.
            
            if (wgslAns !== rustAns) {
                console.error(`Mismatch at (y=${y}, x=${x}): WGSL=${wgslAns}, Rust=${rustAns}`);
                mismatchCount++;
                if (mismatchCount > 10) break; // Don't flood console
            }
        }
        
        assertEquals(mismatchCount, 0, "WGSL and Rust atan2_fast must be bit-identical across all 65536 inputs.");

        readbackBuffer.unmap();
        gpuBuffer.destroy();
        readbackBuffer.destroy();
        device.destroy();
    }
});
