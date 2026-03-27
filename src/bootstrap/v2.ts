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
        const mesh = new WebRTCV2Mesh(engine);
        // Expose via global for renderer to push local intent
        (window as any)._v2Mesh = mesh;

        const max_agents = 1_000_000;
        console.log("✅ [V2] WASM Kernel Loaded (0.86 KB)");

        // 2. Initialize the WebGPU Hardware Pipeline
        const renderer = new PhaseV2Renderer(context, device, format, engine);
        await renderer.initialize();

        // 3. The Holy Tick Loop
        const loop = () => {
            tickFps();
            renderer.tick();
            
            // UI Telemetry extraction (Phase 4 of Plan: Zero-cost HUD)
            const ptrs = engine.getMemoryPointers();
            const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
            setHudStat("a", "AGENTS", activeCount.toString());

            // Extract the Golden Trace
            const getGoldenTrace = engine.wasm?.exports.v2_get_golden_trace as CallableFunction;
            if (getGoldenTrace) {
                const hash = getGoldenTrace() as number;
                setHudStat("c", "GOLDEN TRACE", hash.toString(16).toUpperCase().padStart(8, '0'));
            }

            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);

    } catch (err) {
        console.error("🛑 [V2 FATAL] Initialization Failed!", err);
    }
}
