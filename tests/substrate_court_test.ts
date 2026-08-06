import { assert, assertEquals } from "jsr:@std/assert";
import {
  StateWitness,
  SubstrateCourt,
} from "../src/environment/substrate_court.ts";

// Utility to create a witness
function makeWitness(
  substrate: "webgpu" | "wasm" | "sp1",
  tick: number,
  stateHash: number,
  lawHash: number,
  proofKind?: "mock" | "sp1-stark" | "groth16",
): StateWitness {
  return {
    substrate,
    source: substrate === "webgpu"
      ? "gpu-readback"
      : substrate === "wasm"
      ? "wasm-memory"
      : "zk-proof",
    // These fixtures model substrates that each ran the transition themselves.
    // That is the only case the court can rule on, and it is deliberately NOT
    // the default — a witness that does not claim to have computed the tick
    // must not be counted as corroboration.
    derivation: "computed",
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
  court.resolveArbitration(
    makeWitness("sp1", 101, 0x1234, 0xAAAA, "sp1-stark"),
  );

  // WebGPU should be isolated
  assert(court.isolatedSubstrates.has("webgpu"));
  assert(!court.isolatedSubstrates.has("wasm"));
  assert(
    court.quarantineReceipts.has("convicted_webgpu_tick_101_proof_sp1-stark"),
  );
});

Deno.test("SubstrateCourt: an unanswered arbitration convicts nobody", async () => {
  // REGRESSION. This used to isolate BOTH fast substrates on timeout, which
  // converted "the arbiter never answered" into a conviction of everyone
  // present — and since `submitTestimony` drops testimony from isolated
  // substrates, one unanswered request permanently blinded the organ.
  // Uncertainty is not guilt; the same rule the Bitcoin anchor already follows,
  // where UNREACHABLE is a distinct verdict from MISMATCH.
  const court = new SubstrateCourt();

  court.submitTestimony(makeWitness("wasm", 102, 0x1234, 0xAAAA));
  court.submitTestimony(makeWitness("webgpu", 102, 0x9999, 0xAAAA));

  // Simulate timeout firing before SP1 proof arrives
  // TypeScript allows accessing private methods using bracket notation for tests
  (court as any).handleArbitrationTimeout(102);

  assertEquals(court.isolatedSubstrates.size, 0, "silence is not evidence");
  assertEquals(court.quarantineReceipts.size, 0);
  // The debt is recorded rather than hidden.
  assert(court.unresolvedTicks.has(102));
  assertEquals(court.verdictFor(102), "drift");
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

Deno.test("SubstrateCourt: one computation is never two witnesses", () => {
  // The defect this whole distinction exists for. In production `renderer.tick()`
  // writes only GPU buffers and never touches WASM agent memory, so the "wasm"
  // testimony hashed a mirror the GPU had filled at the last readback — its pre-
  // and post-state hashes equal by construction — while the "webgpu" testimony
  // hashed that same mirror with a DIFFERENT function. The court then convicted
  // on the difference between two hash functions applied to one state, and
  // quarantined both substrates when the arbiter it called never answered.
  const court = new SubstrateCourt();

  const mirrored: StateWitness = {
    substrate: "wasm",
    source: "wasm-memory",
    derivation: "mirrored", // received from the GPU at readback
    lawHash: 0xAAAA,
    preStateHash: 0x1234,
    postStateHash: 0x1234, // unchanged: nothing computed it
    entropyDelta: 0,
    tick: 200,
  };
  const computed: StateWitness = {
    substrate: "webgpu",
    source: "gpu-readback",
    derivation: "computed",
    lawHash: 0xAAAA,
    preStateHash: 0x1234,
    postStateHash: 0x9999,
    entropyDelta: 0,
    tick: 200,
  };

  court.submitTestimony(mirrored);
  court.submitTestimony(computed);

  assertEquals(
    court.verdictFor(200),
    "not-assessed",
    "a mirror cannot corroborate its own source",
  );
  assertEquals(court.isolatedSubstrates.size, 0, "and nobody is convicted");
});

Deno.test("SubstrateCourt: a witness that does not claim to have computed fails closed", () => {
  const court = new SubstrateCourt();
  // `derivation` omitted on both — the old shape. It must NOT be read as two
  // independent computations just because two objects arrived.
  court.submitTestimony(makeWitness("wasm", 300, 0x1111, 0xAAAA));
  court.submitTestimony(makeWitness("webgpu", 300, 0x1111, 0xAAAA));
  (court as unknown as {
    testimonies: Map<number, Map<string, StateWitness>>;
  }).testimonies.get(300)!.forEach((w) => delete w.derivation);

  assertEquals(court.verdictFor(300), "not-assessed");
});
