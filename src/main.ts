import { bootstrapPhase } from "./bootstrap/phase.ts";
import { bootstrapReplay } from "./bootstrap/replay.ts";
import { bindNativeConstants } from "./shared/constants.ts";

import initWasm from "../omega_core/pkg/omega_core.js";

export const START_MS = performance.now();

const mode = new URLSearchParams(globalThis.location.search).get("mode") || "classic";
const replayStack = new URLSearchParams(globalThis.location.search).get("stack") || "phase";

console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

async function boot() {
    try {
        if (mode === "replay") {
            await bootstrapReplay(replayStack);
        } else {
            const wasm = await initWasm();
            bindNativeConstants(wasm);
            await bootstrapPhase(wasm.memory as WebAssembly.Memory);
        }
    } catch (e) {
        console.error("[Genesis] Master routing collapse:", e);
    }
}

boot();
