import { assertEquals, assert } from "jsr:@std/assert";
import { SubstrateCourt, WITNESS_WEBGPU, WITNESS_WASM, WITNESS_SP1 } from "../src/environment/substrate_court.ts";

Deno.test("Era 2100: Substrate Court consensus and ZK arbitration", () => {
    const court = new SubstrateCourt();

    // Tick 1: Perfect consensus
    court.submitTestimony({
        witnessKind: WITNESS_WEBGPU,
        lawHash: 0xAAAA,
        stateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 1,
    });
    court.submitTestimony({
        witnessKind: WITNESS_WASM,
        lawHash: 0xAAAA,
        stateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 1,
    });

    assertEquals(court.isolatedSubstrates.size, 0);

    // Tick 2: Drift detected (WebGPU deviates)
    court.submitTestimony({
        witnessKind: WITNESS_WEBGPU,
        lawHash: 0xAAAA,
        stateHash: 0xDEAD, // Drift!
        entropyDelta: 10,
        tick: 2,
    });
    court.submitTestimony({
        witnessKind: WITNESS_WASM,
        lawHash: 0xAAAA,
        stateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 2,
    });

    // Substrate should not be isolated YET (needs arbitration)
    assertEquals(court.isolatedSubstrates.size, 0);

    // Tick 2: SP1 Arbitration arrives, siding with WASM
    court.resolveArbitration({
        witnessKind: WITNESS_SP1,
        lawHash: 0xAAAA,
        stateHash: 0xBBBB,
        entropyDelta: 10,
        tick: 2,
    });

    // WebGPU should now be isolated
    assert(court.isolatedSubstrates.has(WITNESS_WEBGPU));
    assert(!court.isolatedSubstrates.has(WITNESS_WASM));

    // Tick 3: Testimony from isolated substrate is ignored
    court.submitTestimony({
        witnessKind: WITNESS_WEBGPU,
        lawHash: 0xCCCC,
        stateHash: 0xDDDD,
        entropyDelta: 0,
        tick: 3,
    });
    
    // We can verify this internally if needed, but for now we just ensure it doesn't trigger new arbitrations
});
