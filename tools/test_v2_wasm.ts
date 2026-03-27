const bytes = await Deno.readFile("./dist/v2/omega_v2_core.wasm");

const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
const exports = instance.exports as any;
const memory = exports.memory as WebAssembly.Memory;

// 1. Boot
exports.v2_boot_engine();
console.log("Memory pages after boot:", memory.buffer.byteLength / 65536);

// 2. Set Env & Ignite
exports.v2_set_environment(7, 8, 4);
exports.v2_ignite_big_bang(1337, 1000000);

// 3. Tick
exports.v2_tick();

// 4. Read Memory
const latticePtr = exports.v2_lattice_ptr();
const agentsPtr = exports.v2_agents_ptr();

console.log("Lattice Ptr:", latticePtr);
console.log("Agents Ptr:", agentsPtr);

const u32Lattice = new Uint32Array(memory.buffer, latticePtr, 8); // 32 bytes = 8 u32s
console.log("PhaseTopology:");
console.log("  q_phase:", u32Lattice[0]);
console.log("  q_sectors:", u32Lattice[1]);
console.log("  q_radial:", u32Lattice[2]);
console.log("  q_math:", u32Lattice[3]);

console.log("SignalStore:");
console.log("  dirty_flags:", u32Lattice[4]);
console.log("  absolute_tick:", u32Lattice[5]);
console.log("  active_agent_count:", u32Lattice[6]);
console.log("  max_cells:", u32Lattice[7]);

const firstAgent = new Uint32Array(memory.buffer, agentsPtr, 4); // 16 bytes = 4 u32s
console.log("First Agent:");
console.log("  phase:", firstAgent[0]);
console.log("  energy:", firstAgent[1]);
console.log("  base_freq:", new Int32Array(memory.buffer, agentsPtr, 4)[2]);
console.log("  state_flags:", firstAgent[3]);
