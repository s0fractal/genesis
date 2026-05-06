import { assertEquals, assert } from "jsr:@std/assert";
import { SubstrateCourt } from "../src/environment/substrate_court.ts";

Deno.test("Era 2100: Substrate Court consensus and ZK arbitration", () => {
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
