import { bootstrapPhase } from "./bootstrap/phase.ts";
import { bootstrapReplay } from "./bootstrap/replay.ts";

export const START_MS = performance.now();

const mode = new URLSearchParams(globalThis.location.search).get("mode") || "classic";
const replayStack = new URLSearchParams(globalThis.location.search).get("stack") || "phase";

console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

async function boot() {
    try {
        if (mode === "replay") {
            await bootstrapReplay(replayStack);
        } else {
            // Era 250: WASM Instantiation is now exclusively handled by the SharedWorker
            // The Main Thread acts purely as a Dumb Terminal
            await bootstrapPhase();
        }
    } catch (e) {
        console.error("[Genesis] Master routing collapse:", e);
    }
}

boot();
