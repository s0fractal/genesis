import { assertEquals, assertGreater } from "jsr:@std/assert";
import { PhaseAgentParser, SignalStoreParser } from "../src/sdk/phi_types.ts";
import { calculateGoldenTrace, fnv1a } from "../src/sdk/phi_crypto.ts";

async function instantiateWasm(): Promise<WebAssembly.Instance> {
  const bytes = await Deno.readFile("public/v2/omega_v2_core.wasm");
  const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
  return instance;
}

Deno.test("SDK: calculateGoldenTrace exactly matches Rust WASM parity", async () => {
  const wasm = await instantiateWasm();
  const exports = wasm.exports;
  const memory = exports.memory as WebAssembly.Memory;

  // Boot WASM engine
  (exports.v2_boot_engine as CallableFunction)();
  (exports.v2_reset_runtime_state as CallableFunction)();

  // Ignite 1024 agents
  const AGENT_COUNT = 1024;
  // Ignition seeds BIG_BANG_SEED_DENSITY_Q10 of capacity and leaves the rest
  // empty, so ask for the capacity that yields AGENT_COUNT living agents.
  (exports.v2_ignite_big_bang as CallableFunction)(
    0xABCDEF,
    AGENT_COUNT * 1024 / 256,
  );

  // Read uniform signals
  const latticePtr = (exports.v2_lattice_ptr as CallableFunction)() as number;
  const signalsView = new DataView(memory.buffer, latticePtr + 32, 32);
  const signals = SignalStoreParser.parse(signalsView, 0);

  assertEquals(
    signals.activeAgentCount,
    AGENT_COUNT,
    "SignalStoreParser should correctly extract active agent count",
  );

  // Rust Hash
  const rustHash =
    (exports.v2_get_golden_trace as CallableFunction)() as number;

  // Read agents via SDK
  const agentsPtr = (exports.v2_agents_ptr as CallableFunction)() as number;
  const agentsBytes = new Uint8Array(
    memory.buffer,
    agentsPtr,
    32 * AGENT_COUNT,
  );

  // Test parser
  const parsedAgents = PhaseAgentParser.parseAll(agentsBytes, 10);
  assertEquals(
    parsedAgents.length,
    10,
    "Parser should extract requested number of agents",
  );
  assertGreater(parsedAgents[0].energy, 0, "Agents should have energy");

  // SDK Hash
  const sdkHash = calculateGoldenTrace(agentsBytes, signals.activeAgentCount);

  assertEquals(
    sdkHash,
    rustHash >>> 0,
    "Typescript Golden Trace must match Rust exactly",
  );
});

Deno.test("SDK: FNV-1a Hash parity", async () => {
  // Known FNV-1a hashes for sanity check
  assertEquals(fnv1a("test"), 2949673445);
  assertEquals(fnv1a("GENESIS"), 3917818681);
});
