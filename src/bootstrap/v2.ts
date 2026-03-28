import { configureCanvas, DOM, setInputMode, tickFps, setHudStat } from "./dom.ts";
import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { WebRTCV2Mesh } from "../network/webrtc_v2.ts";
import { PhaseV2Renderer } from "../lens/v2_renderer.ts";

export async function bootstrapV2() {
    console.log("🌌 [V2] Bootstrapping Zero-Copy Minimalist Engine...");

    const canvas = configureCanvas();
    let device: GPUDevice | null = null;
    let format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
    
    try {
        if (!navigator.gpu) throw new Error("WebGPU API missing");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("WebGPU adapter unavailable");
        device = await adapter.requestDevice();
        
        device.onuncapturederror = (event) => {
            console.error("🛑 [WGSL VALIDATION ERROR]:", event.error.message);
        };
        
        const context = canvas.getContext("webgpu") as GPUCanvasContext;
        context.configure({
            device,
            format,
            alphaMode: "premultiplied",
        });
        
        DOM.hudTitle?.replaceChildren("Φ OMEGA-V2 KERNEL");
        DOM.statusLabel?.replaceChildren("BARE-METAL NO_STD");
        setHudStat("b", "FPS", "0");
        setHudStat("c", "SIGNATURE", "v2-zero-copy");
        setInputMode("semantic");

        // 1. Boot up the bare-metal Engine (WASM fetch & init)
        const engine = new OmegaV2Engine();
        await engine.boot(adapter);
        
        // Boot V2 Mesh Network for Golden Trace syncing
        const mesh = new WebRTCV2Mesh(engine, (snapshot) => {
            renderer.overwriteGPUState(snapshot);
        });
        // Expose via global for renderer to push local intent
        (window as any)._v2Mesh = mesh;

        const max_agents = 1_000_000;
        console.log("✅ [V2] WASM Kernel Loaded (0.86 KB)");

        // 2. Initialize the WebGPU Hardware Pipeline
        const renderer = new PhaseV2Renderer(context, device, format, engine);
        await renderer.initialize();

        // 3. The Holy Tick Loop
        let frameCount = 0;
        let isReadingGPU = false;

        const loop = () => {
            tickFps();
            
            // Halt Local Thermodynamics if reconstructing from a peer Snapshot
            if (!mesh.isSyncFrozen) {
                renderer.tick();
            }
            
            // UI Telemetry extraction (Phase 4 of Plan: Zero-cost HUD)
            const ptrs = engine.getMemoryPointers();
            const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
            setHudStat("a", "AGENTS", activeCount.toString());

            // Asynchronous 1Hz GPU State Extraction via Staging Buffers
            if (frameCount % 60 === 0 && !isReadingGPU) {
                isReadingGPU = true;
                renderer.readStateFromGPUAndHash().then(({ goldenTrace, snapshot }) => {
                    setHudStat("c", "GOLDEN TRACE", goldenTrace);
                    mesh.setLatestState(goldenTrace, snapshot);
                    isReadingGPU = false;
                }).catch(err => {
                    console.error("[V2] GPU Read Error:", err);
                    isReadingGPU = false;
                });
            }

            frameCount++;
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);

    } catch (err: any) {
        console.error("🛑 [V2 FATAL] Initialization Failed!", err.toString(), err.message);
    }
}
