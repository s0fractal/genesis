// Ecology probe — is this world habitable?
//
// The conservation work of 2026-08-06 made the ledger true. It did not ask the
// next question: with a true ledger, what actually happens to a population left
// to run? A world can be perfectly accounted for and still be uninhabitable.
//
// This drives the REFERENCE law — `v2_tick` → `tick_physics`, the CPU path —
// headlessly, for N ticks, with a mitosis sweep on a fixed cadence, and records
// what a biologist would ask for: how many are alive, how much energy the
// population holds, how much has been dissipated, and how the two trade off.
//
// Deterministic: same seed, same numbers, every run, on any host. No wall clock,
// no randomness, no network. Output is JSON on stdout so it can be diffed
// between commits — a regression in habitability should be as visible as a
// failing test.
//
// DEATHS. The probe counted births and not deaths, which made it blind to the
// thing that matters most about a population: whether it TURNS OVER. Measured
// with it, this world fills its capacity by tick 550 and then nothing is born
// and nothing dies, forever — and the trait the physics selects on freezes to
// the second decimal at the same moment. A world with no death has no selection,
// and a probe that reports only births reports that as health.
//
// Deaths are counted by transition, slot by slot, every tick: an agent that was
// alive on the previous tick and is not now. The kernel exposes no death
// counter, and inferring one from population change would miss every death that
// a birth backfilled in the same sweep — which, in a world at capacity, is all
// of them.
//
//   deno run --allow-read tools/ecology_probe.ts [ticks] [agents] [weather] > run.json
//
// `weather` scales the metabolic maintenance cost (1024 = neutral). It is a
// Layer B environmental parameter, not a law: sweeping it changes what the world
// costs to live in without changing what the world IS.

const TICKS = Number(Deno.args[0] ?? 2000);
const AGENTS = Number(Deno.args[1] ?? 4096);
const WEATHER = Number(Deno.args[2] ?? 1024);
const MITOSIS_EVERY = 10; // matches the renderer's readback cadence
const SEED = 0x0EC0_0107;

const bytes = await Deno.readFile("./public/v2/omega_v2_core.wasm");
const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
const x = instance.exports as Record<string, CallableFunction>;
const memory = instance.exports.memory as WebAssembly.Memory;

x.v2_boot_engine();
// (q_sectors, q_radial, q_harmonics, weather_multiplier) — canonical topology.
x.v2_set_environment(7, 6, 2, WEATHER);
x.v2_ignite_big_bang(SEED, AGENTS);

const latticePtr = x.v2_lattice_ptr() as number;

/** SignalStore lives at byte 32 of PhaseLattice (ffi_layout.rs). */
function signals() {
  const s = new Uint32Array(memory.buffer, latticePtr + 32, 12);
  const lo = s[6], hi = s[7]; // total_entropy_released is u64 at +24
  return {
    causalTicks: s[1],
    activeCount: s[4],
    entropyReleased: hi * 2 ** 32 + lo,
    totalEnergy: s[8],
    solarInput: s[11],
  };
}

/** Alive = energy > 0 and not flagged dead; the kernel's own predicate. */
function census() {
  const agentsPtr = x.v2_agents_ptr() as number;
  const a = new Uint32Array(memory.buffer, agentsPtr, AGENTS * 8);
  const live = signals().activeCount;
  let alive = 0, energy = 0, minE = Infinity, maxE = 0;
  for (let i = 0; i < Math.min(live, AGENTS); i++) {
    const e = a[i * 8 + 1];
    const flags = a[i * 8 + 3];
    if (e > 0 && (flags & 1) === 0) {
      alive++;
      energy += e;
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
    }
  }
  return { alive, energy, minE: alive ? minE : 0, maxE };
}

const start = census();
const series: Array<Record<string, number>> = [];
let births = 0;
let deaths = 0;

/** Per-slot liveness on the previous tick, for counting deaths by transition. */
const wasAlive = new Uint8Array(AGENTS);
function markLiveness(): void {
  const a = new Uint32Array(
    memory.buffer,
    x.v2_agents_ptr() as number,
    AGENTS * 8,
  );
  const live = Math.min(signals().activeCount, AGENTS);
  for (let i = 0; i < AGENTS; i++) {
    wasAlive[i] = i < live && a[i * 8 + 1] > 0 && (a[i * 8 + 3] & 1) === 0
      ? 1
      : 0;
  }
}
function countDeaths(): number {
  const a = new Uint32Array(
    memory.buffer,
    x.v2_agents_ptr() as number,
    AGENTS * 8,
  );
  const live = Math.min(signals().activeCount, AGENTS);
  let n = 0;
  for (let i = 0; i < AGENTS; i++) {
    const nowAlive = i < live && a[i * 8 + 1] > 0 && (a[i * 8 + 3] & 1) === 0;
    if (wasAlive[i] === 1 && !nowAlive) n++;
  }
  return n;
}
markLiveness();

for (let t = 1; t <= TICKS; t++) {
  x.v2_tick();
  deaths += countDeaths();
  markLiveness();
  if (t % MITOSIS_EVERY === 0) {
    births += x.v2_mitosis_sweep() as number;
    // A slot refilled by mitosis was not a death; re-mark so the next tick
    // compares against the post-sweep population.
    markLiveness();
  }

  // Sample on a log-ish cadence: dense early where the transient lives.
  if (t <= 20 || t % Math.max(1, Math.floor(TICKS / 200)) === 0) {
    const c = census();
    const s = signals();
    series.push({
      tick: t,
      alive: c.alive,
      energy: c.energy,
      minEnergy: c.minE,
      maxEnergy: c.maxE,
      entropy: s.entropyReleased,
      births,
      deaths,
      causalTicks: s.causalTicks,
    });
  }
}

const end = census();
const endSignals = signals();

console.log(JSON.stringify(
  {
    config: {
      ticks: TICKS,
      agents: AGENTS,
      seed: SEED,
      weather: WEATHER,
      mitosisEvery: MITOSIS_EVERY,
    },
    start: { alive: start.alive, energy: start.energy },
    end: {
      alive: end.alive,
      energy: end.energy,
      entropy: endSignals.entropyReleased,
      births,
      deaths,
    },
    // The books.
    //
    // `total_entropy_released` carries two physically distinct releases in one
    // accumulator: ATP that left the population (dissipation) and the Landauer
    // cost of information erased when agents dissolved. They are commensurable
    // only because LANDAUER_BIT_COST is the conversion factor — one erased bit
    // costs one ATP of entropy — which is exactly what Landauer's principle
    // says, so the sum is meaningful rather than a unit error.
    //
    // Therefore the trace must be at least the energy drop, never less: energy
    // that vanished without reaching the trace is a leak. The excess above the
    // drop is the information term.
    balance: {
      startEnergy: start.energy,
      solarInput: endSignals.solarInput,
      endEnergy: end.energy,
      // Open-system identity: what came in, plus what was there, equals what
      // is still held plus what was spent. The trace also carries the Landauer
      // term, so it sits above the pure energy figure by that much.
      spent: start.energy + endSignals.solarInput - end.energy,
      traceTotal: endSignals.entropyReleased,
      informationTerm: endSignals.entropyReleased -
        (start.energy + endSignals.solarInput - end.energy),
      leaked: Math.max(
        0,
        (start.energy + endSignals.solarInput - end.energy) -
          endSignals.entropyReleased,
      ),
    },
    series,
  },
  null,
  2,
));
