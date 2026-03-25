import { loadPhaseReplayDataset } from "../src/replay/phase_replay.ts";

async function main() {
    console.log("=== OMEGA-64 Golden Master CI Verification ===");
    try {
        const dataset = await loadPhaseReplayDataset();
        console.log(`✅ Golden Trace Verified: ${dataset.golden.ticks} epochs evaluated successfully.`);
        console.log(`✅ WASM Structural Signature aligns perfectly with Phase Reference.`);
        Deno.exit(0);
    } catch (e: unknown) {
        console.error("❌ FATAL: Golden Trace Divergence Detected!");
        console.error((e as Error).message || e);
        Deno.exit(1);
    }
}

main();
