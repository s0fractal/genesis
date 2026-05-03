import { bootstrapV2 } from "./bootstrap/v2.ts";

export const START_MS = performance.now();

const mode = new URLSearchParams(globalThis.location.search).get("mode") || "v2";
const replayStack = new URLSearchParams(globalThis.location.search).get("stack") || "phase";

console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

async function boot() {
    try {
        if (mode === "classic") {
            const { bootstrapPhase } = await import("./bootstrap/phase.ts");
            await bootstrapPhase();
        } else if (mode === "replay") {
            const { bootstrapReplay } = await import("./bootstrap/replay.ts");
            await bootstrapReplay(replayStack);
        } else {
            await bootstrapV2();
        }
    } catch (e) {
        console.error("[Genesis] Master routing collapse:", e);
    }
}

boot();
