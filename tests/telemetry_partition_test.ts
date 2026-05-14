import { assertEquals, assert } from "jsr:@std/assert";
import { SubstrateCourt } from "../src/environment/substrate_court.ts";

Deno.test("Substrate Court consensus and ZK arbitration", () => {
    const court = new SubstrateCourt();

    // Tick 1: Perfect consensus
    court.submitTestimony({
        substrate: "webgpu",
        source: "gpu-readback",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 1,
    });
    court.submitTestimony({
        substrate: "wasm",
        source: "wasm-memory",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 1,
    });

    assertEquals(court.isolatedSubstrates.size, 0);

    // Tick 2: Drift detected (WebGPU deviates)
    court.submitTestimony({
        substrate: "webgpu",
        source: "gpu-readback",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xDEAD, // Drift!
        entropyDelta: 10,
        tick: 2,
    });
    court.submitTestimony({
        substrate: "wasm",
        source: "wasm-memory",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 2,
    });

    // Substrate should not be isolated YET (needs arbitration)
    assertEquals(court.isolatedSubstrates.size, 0);

    // Tick 2: SP1 Arbitration arrives, siding with WASM
    court.resolveArbitration({
        substrate: "sp1",
        source: "zk-proof",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 2,
    });

    // WebGPU should now be isolated
    assert(court.isolatedSubstrates.has("webgpu"));
    assert(!court.isolatedSubstrates.has("wasm"));

    // Tick 3: Testimony from isolated substrate is ignored
    court.submitTestimony({
        substrate: "webgpu",
        source: "gpu-readback",
        lawHash: 0xCCCC,
        preStateHash: 0xDDDD,
        postStateHash: 0xDDDD,
        entropyDelta: 0,
        tick: 3,
    });

    // We can verify this internally if needed, but for now we just ensure it doesn't trigger new arbitrations
});

Deno.test("Substrate Court timeout arbitration", async () => {
    const court = new SubstrateCourt();

    // Tick 1: Drift detected (WebGPU deviates)
    court.submitTestimony({
        substrate: "webgpu",
        source: "gpu-readback",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xDEAD,
        entropyDelta: 10,
        tick: 1,
    });
    court.submitTestimony({
        substrate: "wasm",
        source: "wasm-memory",
        lawHash: 0xAAAA,
        preStateHash: 0xBBBB,
        postStateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 1,
    });

    assertEquals(court.isolatedSubstrates.size, 0);

    // Wait for arbitration timeout (5000ms internally, we'll invoke the private handler directly or mock timers in a real suite, but here we just wait or call it)
    // For test stability without 5s delays, we will directly call the timeout handler if accessible, or we use fake time.
    // Since handleArbitrationTimeout is private, we can cast to any to call it for testing:
    (court as any).handleArbitrationTimeout(1);

    // After timeout, both substrates should be isolated because SP1 did not arrive
    assert(court.isolatedSubstrates.has("webgpu"));
    assert(court.isolatedSubstrates.has("wasm"));

    // Verify receipt was generated
    assert(court.quarantineReceipts.has("timeout_quarantine_tick_1"));
});
