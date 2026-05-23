import { bootstrapV2 } from "./bootstrap/v2.ts";

export const START_MS = performance.now();

console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

async function boot() {
  try {
    await bootstrapV2();
  } catch (e) {
    console.error("[Genesis] Master routing collapse:", e);
  }
}

boot();
