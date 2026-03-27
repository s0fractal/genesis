import { OmegaV2Engine } from "../src/environment/v2_bridge.ts";

async function runTest() {
    // Mock the WebGPU Adapter
    const mockAdapter = {
        limits: { maxStorageBufferBindingSize: 134_217_728 }
    } as any;

    const engine = new OmegaV2Engine();
    
    // Simulate browser boot
    await engine.boot(mockAdapter);

    // Simulate first tick
    engine.tick();

    // Fetch memory pointers
    const ptrs = engine.getMemoryPointers();

    // Extract active agent count the exact same way v2_renderer.ts does
    const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
    
    console.log("TS Wrapper Extracted activeCount:", activeCount);
}

runTest();
