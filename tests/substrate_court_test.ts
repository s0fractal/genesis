import { assertEquals, assert } from "jsr:@std/assert";
import { SubstrateCourt, StateWitness } from "../src/environment/substrate_court.ts";

// Utility to create a witness
function makeWitness(
    substrate: "webgpu" | "wasm" | "sp1",
    tick: number,
    stateHash: number,
    lawHash: number,
    proofKind?: "mock" | "sp1-stark" | "groth16"
): StateWitness {
    return {
        substrate,
        source: substrate === "webgpu" ? "gpu-readback" : substrate === "wasm" ? "wasm-memory" : "zk-proof",
        proofKind,
        lawHash,
        preStateHash: 0,
        postStateHash: stateHash,
        entropyDelta: 0,
        tick,
    };
}

// Ensure the court uses FakeTimers to test timeouts synchronously
Deno.test("SubstrateCourt: consensus between WASM and WebGPU proceeds without arbitration", () => {
    const court = new SubstrateCourt();
    
    court.submitTestimony(makeWitness("wasm", 100, 0x1234, 0xAAAA));
    court.submitTestimony(makeWitness("webgpu", 100, 0x1234, 0xAAAA));
    
    // Both agreed. No isolation.
    assertEquals(court.isolatedSubstrates.size, 0);
    assertEquals(court.quarantineReceipts.size, 0);
});

Deno.test("SubstrateCourt: drift triggers arbitration and SP1 proof isolates the divergent substrate", () => {
    const court = new SubstrateCourt();
    
    court.submitTestimony(makeWitness("wasm", 101, 0x1234, 0xAAAA));
    // WebGPU drifts!
    court.submitTestimony(makeWitness("webgpu", 101, 0x9999, 0xAAAA));
    
    // We submit a real SP1 proof that agrees with WASM
    court.resolveArbitration(makeWitness("sp1", 101, 0x1234, 0xAAAA, "sp1-stark"));
    
    // WebGPU should be isolated
    assert(court.isolatedSubstrates.has("webgpu"));
    assert(!court.isolatedSubstrates.has("wasm"));
    assert(court.quarantineReceipts.has("convicted_webgpu_tick_101_proof_sp1-stark"));
});

Deno.test("SubstrateCourt: timeout triggers isolation of both fast substrates", async () => {
    // We cannot easily mock setTimeout in Deno's standard test runner without bringing in fake time libraries.
    // However, we can just replace handleArbitrationTimeout's caller or mock the timeout.
    // For simplicity, we just trigger the private timeout handler manually to simulate timeout.
    
    const court = new SubstrateCourt();
    
    court.submitTestimony(makeWitness("wasm", 102, 0x1234, 0xAAAA));
    court.submitTestimony(makeWitness("webgpu", 102, 0x9999, 0xAAAA));
    
    // Simulate timeout firing before SP1 proof arrives
    // TypeScript allows accessing private methods using bracket notation for tests
    (court as any).handleArbitrationTimeout(102);
    
    // Both should be isolated because we lack SP1 testimony to break the tie
    assert(court.isolatedSubstrates.has("webgpu"));
    assert(court.isolatedSubstrates.has("wasm"));
    assert(court.quarantineReceipts.has("timeout_quarantine_tick_102"));
});

Deno.test("SubstrateCourt: isolated substrates have their testimonies ignored", () => {
    const court = new SubstrateCourt();
    court.isolatedSubstrates.add("webgpu");
    
    court.submitTestimony(makeWitness("wasm", 103, 0x1234, 0xAAAA));
    court.submitTestimony(makeWitness("webgpu", 103, 0x9999, 0xAAAA)); // should be ignored
    
    // The court should not trigger arbitration because the webgpu testimony was dropped
    // We can verify this by checking if there's any pending arbitration (private map)
    const pending = (court as any).pendingArbitrations;
    assertEquals(pending.has(103), false);
});
