import { configureCanvas, DOM, setInputMode, tickFps, setHudStat } from "./dom.ts";
import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { WebRTCV2Mesh } from "../network/webrtc_v2.ts";
import { PhaseV2Renderer } from "../lens/v2_renderer.ts";
import { EthersATPBridge } from "../network/atp_bridge.ts";
import { PhaseRouter } from "../network/routing_bridge.ts";

let oracleWorker: Worker | null = null;
try {
    oracleWorker = new Worker(new URL('../workers/oracle_worker.ts', import.meta.url), { type: 'module' });
    console.log("🌌 [V2] Oracle LLM Worker invoked.");
} catch (e) {
    console.warn("Could not load Oracle LLM Worker:", e);
}

let isOracleBound = false;

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
        
        (device as any).onuncapturederror = (event: { error: { message: string } }) => {
            console.error("🛑 [WGSL VALIDATION ERROR]:", event.error.message);
        };
        
        const context = canvas.getContext("webgpu") as unknown as GPUCanvasContext;
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
        
        // Era 1000: Initialize Phase Router before mesh so it can be wired into P2P
        const router = new PhaseRouter(engine.wasm);
        const addr0 = router.addressFromAgent(0);
        if (addr0 !== 0) {
            const decoded = PhaseRouter.decode(addr0);
            console.log(`🧭 [ROUTING] Agent 0 PhaseAddress: consensus=${decoded.consensus} social=${decoded.social} personal=${decoded.personal} micro=${decoded.micro}`);
        }

        // Boot V2 Mesh Network for Golden Trace syncing
        const mesh = new WebRTCV2Mesh(engine, (snapshot) => {
            renderer.overwriteGPUState(snapshot);
        }, undefined, router);
        // Expose via global for renderer to push local intent
        (window as any)._v2Mesh = mesh;

        const max_agents = 1_000_000;
        console.log("✅ [V2] WASM Kernel Loaded (0.86 KB)");

        // 2. Initialize the WebGPU Hardware Pipeline
        const renderer = new PhaseV2Renderer(context, device, format, engine);
        await renderer.initialize();

        // 2.5 Era 12000 Integration: EVM ATP Blockchain Link
        const atpBridge = new EthersATPBridge();
        atpBridge.subscribeToCosmicEntropy((entropy) => {
            const hashPrefix = entropy.hash.substring(0, 18);
            try {
                const hexVal = BigInt(hashPrefix);
                engine.injectCosmicEntropy(hexVal);
                setHudStat("c", "COSMIC ENTROPY", `EVM Blk: ${hashPrefix}`);
            } catch (e) {
                console.error("[V2 EVM] Cosmic Payload Error", e);
            }
        });

        // 3. The Holy Tick Loop
        let frameCount = 0;
        let isReadingGPU = false;

        const loop = () => {
            tickFps();
            
            // Halt Local Thermodynamics if reconstructing from a peer Snapshot
            if (!mesh.isSyncFrozen) {
                renderer.tick();
            }
            
            // UI Telemetry extraction (Phase 4 of Plan: Zero-cost HUD)            // Era 11000: Initial Oracle Whisper Hook
            if (oracleWorker && !isOracleBound) {
                isOracleBound = true;
                oracleWorker.onmessage = (e) => {
                    const data = e.data;
                    if (data.type === 'INIT_PROGRESS') {
                        setHudStat("c", "ORACLE", (data.text as string).substring(0, 32) + "...");
                    } else if (data.type === 'SUCCESS') {
                        setHudStat("c", "ORACLE", "LLaMa-3 Synthesized AST.");
                        // Force intent via slot 2 (Oracle Dedicated Slot)
                        if (data.validIntents && data.validIntents.length > 0) {
                            const intent = data.validIntents[0];
                            const setIntent = engine.wasm?.exports.v2_set_intent as CallableFunction;
                            if (setIntent) {
                                const gx = Math.floor(Math.random() * window.innerWidth);
                                const gy = Math.floor(Math.random() * window.innerHeight);
                                let hash = 5381;
                                const word = intent.intentStr;
                                for (let i = 0; i < word.length; i++) hash = ((hash << 5) + hash) + word.charCodeAt(i);
                                
                                setIntent(2, gx, gy, 0, 500, hash >>> 0, 1);
                                setTimeout(() => { if (engine.wasm) setIntent(2, 0, 0, 0, 0, 0, 0); }, 1000);
                                
                                // Broadcast prophecy to DOM
                                if (DOM.hudTitle) {
                                    DOM.hudTitle.innerHTML += `<br/><span style="color: #ff55ff; font-size: 0.6rem; text-shadow: 0 0 10px #ff55ff;">[PROPHECY]: ${intent.prophecy}</span>`;
                                }
                            }
                        }
                    } else if (data.type === 'ERROR') {
                        setHudStat("c", "ORACLE", "ERROR: " + data.reason);
                    }
                };
            }

            const ptrs = engine.getMemoryPointers();
            const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
            setHudStat("a", "AGENTS", activeCount.toString());
            
            // Era 9000: Display Daemon Status
            setHudStat("d", "DAEMON", renderer.daemonState);

            // Asynchronous 1Hz GPU State Extraction via Staging Buffers
            if (frameCount % 60 === 0 && !isReadingGPU) {
                isReadingGPU = true;
                renderer.readStateFromGPUAndHash().then(({ goldenTrace, goldenTraceNum, snapshot }) => {
                    setHudStat("c", "GOLDEN TRACE", goldenTrace);
                    mesh.setLatestState(goldenTraceNum, snapshot);
                    
                    // Era 11000: Synchronize LLM Oracle Telemetry natively
                    if (oracleWorker) {
                        oracleWorker.postMessage({
                            type: 'SYNC_TELEMETRY',
                            globalEnergyPool: 1000000,
                            currentEntropy: 5.0, // Fixed default for V2 metrics
                            count: activeCount,
                            totalPopulation: activeCount,
                            macroSeason: Math.floor(frameCount / 3600) % 4,
                            currentSeasonName: "V2_AWAKENING",
                            mycelialContext: "The bare-metal V2 runtime is operating linearly.",
                        });
                    }

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
