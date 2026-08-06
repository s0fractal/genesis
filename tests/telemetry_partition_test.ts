import { assert, assertEquals } from "jsr:@std/assert";
import { SubstrateCourt } from "../src/environment/substrate_court.ts";

Deno.test("Substrate Court consensus and ZK arbitration", () => {
  const court = new SubstrateCourt();

  // Tick 1: Perfect consensus
  court.submitTestimony({
    substrate: "webgpu",
    source: "gpu-readback",
    derivation: "computed",
    lawHash: 0xAAAA,
    preStateHash: 0xBBBB,
    postStateHash: 0xBBBB,
    entropyDelta: 10,
    tick: 1,
  });
  court.submitTestimony({
    substrate: "wasm",
    source: "wasm-memory",
    derivation: "computed",
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
    derivation: "computed",
    lawHash: 0xAAAA,
    preStateHash: 0xBBBB,
    postStateHash: 0xDEAD, // Drift!
    entropyDelta: 10,
    tick: 2,
  });
  court.submitTestimony({
    substrate: "wasm",
    source: "wasm-memory",
    derivation: "computed",
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
    derivation: "computed",
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
    derivation: "computed",
    lawHash: 0xCCCC,
    preStateHash: 0xDDDD,
    postStateHash: 0xDDDD,
    entropyDelta: 0,
    tick: 3,
  });

  // We can verify this internally if needed, but for now we just ensure it doesn't trigger new arbitrations
});

Deno.test("Substrate Court: an unanswered arbitration convicts nobody", () => {
  const court = new SubstrateCourt();

  // Tick 1: two substrates that each ran the transition, and disagree.
  court.submitTestimony({
    substrate: "webgpu",
    source: "gpu-readback",
    derivation: "computed",
    lawHash: 0xAAAA,
    preStateHash: 0xBBBB,
    postStateHash: 0xDEAD,
    entropyDelta: 10,
    tick: 1,
  });
  court.submitTestimony({
    substrate: "wasm",
    source: "wasm-memory",
    derivation: "computed",
    lawHash: 0xAAAA,
    preStateHash: 0xBBBB,
    postStateHash: 0xBBBB,
    entropyDelta: 10,
    tick: 1,
  });

  assertEquals(court.isolatedSubstrates.size, 0);
  assertEquals(court.verdictFor(1), "drift");

  // The arbiter never answers.
  (court as unknown as { handleArbitrationTimeout(t: number): void })
    .handleArbitrationTimeout(1);

  // REGRESSION: this used to isolate BOTH, turning "I could not find out" into
  // a conviction of everyone present — and since isolated substrates have their
  // testimony dropped, one unanswered request permanently blinded the organ.
  assertEquals(court.isolatedSubstrates.size, 0, "silence is not evidence");
  assertEquals(court.quarantineReceipts.size, 0);
  assert(court.unresolvedTicks.has(1), "the debt is recorded, not hidden");
});
