import { ZKProverBridge } from "../src/network/zk_prover_bridge.ts";

async function run() {
    console.log("🌌 [TEST] Testing ZK Physics Rollup Generation");

    // Create a mock agent array (2 agents)
    const activeCount = 2;
    const agentBytes = new Uint8Array(activeCount * 32);
    const agentView = new DataView(agentBytes.buffer);

    // Agent 0
    agentView.setUint32(0, 100, true); // phase
    agentView.setUint32(4, 2000, true); // energy
    agentView.setInt32(8, 10, true); // base_freq
    agentView.setUint32(12, 0, true); // state_flags
    agentView.setUint32(16, 0x1111_1111, true); // genome

    // Agent 1
    agentView.setUint32(32 + 0, 200, true); // phase
    agentView.setUint32(32 + 4, 3000, true); // energy
    agentView.setInt32(32 + 8, -5, true); // base_freq
    agentView.setUint32(32 + 12, 0, true); // state_flags
    agentView.setUint32(32 + 16, 0x2222_2222, true); // genome

    // Create a mock attractor array (1 attractor)
    const attractorBytes = new Uint8Array(16 + 16);
    const attractorView = new DataView(attractorBytes.buffer);
    attractorView.setUint32(0, 1, true); // count

    attractorView.setUint32(16, 0xAAAA_BBBB, true); // matrix
    attractorView.setUint32(20, (~0xAAAA_BBBB) >>> 0, true); // inverse
    attractorView.setUint32(24, 10, true); // pulse_freq
    attractorView.setUint32(28, 256, true); // pulse_amp

    const prover = new ZKProverBridge();

    console.log("[TEST] Generating Tick Rollup STARK...");
    const bundle = await prover.generateTickRollup(agentBytes, attractorBytes, activeCount, 8);

    if (bundle) {
        console.log(`[TEST] ✅ Rollup STARK generated successfully!`);
        console.log(`[TEST] publicValues:`, bundle.publicValues);

        console.log("[TEST] Verifying STARK locally...");
        const valid = await prover.verifyExternalProof(bundle);
        if (valid) {
            console.log(`[TEST] ✅ STARK verified successfully!`);
        } else {
            console.error(`[TEST] ❌ STARK verification failed!`);
            Deno.exit(1);
        }
    } else {
        console.error(`[TEST] ❌ Rollup STARK generation failed!`);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    run();
}
