import initWasm, { Field, execute_simd_tick } from "../omega_core/pkg/omega_core.js";
import { LensObserver } from "./lens/init";
import { PerturbationInjector } from "./lens/input";
import { SemanticCoupler } from "./ontology/semantic_layer";
import { SovereignOracle } from "./ontology/oracle";

let lastTime = performance.now();
let frames = 0;
const fpsCounter = document.getElementById("fps-counter") as HTMLSpanElement;

async function bootstrap() {
    console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

    // 0. Boot WebAssembly 128-bit SIMD Core
    const wasm = await initWasm();
    const wasmField = new Field();
    const wasmMemory = wasm.memory as WebAssembly.Memory;
    console.log(`[O-64] Rust WASM SIMD Core initialized. Field base pointer allocated at memory offset: ${wasmField.ptr_x()}`);

    // We no longer simulate WASM memory using a detached SharedArrayBuffer.
    // The WASM linear array natively acts as our global sync target.
    const sab = wasmMemory.buffer as unknown as SharedArrayBuffer;

    // 2. Map Visual Lens
    const canvas = document.getElementById("lens-canvas") as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // 3. Mount Substrate Observers
    const observer = new LensObserver(canvas, null);
    observer.setWasmContext(wasmField, wasmMemory);
    await observer.init();
    
    // 4. Initialize GPU Tournament Mutator
    // OBSOLETE: The GPU compute pipeline is deprecated in Ontology 11.
    // Darwinism is now executed natively in Rust WASM via horizontal gene transfer.

    // 5. Connect User Interaction Arrays
    const injector = new PerturbationInjector(canvas, wasmField);
    injector.attach();

    // 6. Bind the Semantic NLP Layer
    const coupler = new SemanticCoupler(injector);

    // Ontology 12: Ignite the Subconscious Oracle
    const oracle = new SovereignOracle(coupler, sab);
    oracle.boot(); // Fire and forget async background telemetry loop

    // Front-End Reactivity
    const input = document.getElementById("semantic-input") as HTMLInputElement;
    const button = document.getElementById("semantic-submit") as HTMLButtonElement;

    const dispatchIntent = () => {
        const val = input.value.trim();
        if (val) {
            coupler.projectIntent(val);
            input.value = "";
        }
    };

    button.addEventListener("click", dispatchIntent);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") dispatchIntent();
    });

    // 7. Master Physics Rhythm
    const loop = () => {
        // Step 1: Execute WASM SIMD Tick natively
        // Provide a dummy LUT pointer (0) since trigonometry LUT isn't bound yet.
        execute_simd_tick(wasmField, 0); 

        // Step 2: Draw mathematical Light
        observer.render();

        // System Telemetry
        frames++;
        const now = performance.now();
        if (now - lastTime > 1000) {
            fpsCounter.innerText = frames.toString();
            frames = 0;
            lastTime = now;
        }

        // Recursively drive the full unified pipeline
        requestAnimationFrame(loop);
    };

    loop();
    console.log("[O-64] System breathing. Evolution pipeline running unconditionally.");
}

bootstrap().catch(console.error);
