import { bootstrapPhase } from "./bootstrap/phase.ts";
import { bootstrapReplay } from "./bootstrap/replay.ts";
import { bootstrapV2 } from "./bootstrap/v2.ts";

export const START_MS = performance.now();

const mode = new URLSearchParams(globalThis.location.search).get("mode") || "classic";
const replayStack = new URLSearchParams(globalThis.location.search).get("stack") || "phase";

console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

async function boot() {
    try {
        await bootstrapV2(); // Hardcoded for Era 3000 Autonomous Testing
    } catch (e) {
        console.error("[Genesis] Master routing collapse:", e);
    }
}

boot();
