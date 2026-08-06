// Structure probe — is this world interesting?
//
// `ecology_probe.ts` answers whether anything is alive. That is the lower bar,
// and it was failing until this week. This asks the next question: does the
// world DO anything, or is it a lit box in which nothing distinguishes itself?
//
// Two measures, both computed from state the kernel already publishes, neither
// tunable after the fact:
//
//   ORDER. The Kuramoto order parameter r = |mean(e^{iθ})| over the living.
//   r→1 is a synchronised crystal, r→0 is noise, and both are boring in the
//   same way: nothing is locally different from anything else.
//
//   STRUCTURE. The same quantity computed per agent over its eight neighbours,
//   averaged. If local order is much higher than global order there are
//   DOMAINS — patches that agree internally and disagree with each other. That
//   ratio is the thing phase-gated conduction was supposed to produce, and it
//   has never been measured. If local ≈ global the lattice is uniform, and the
//   gate is decoration.
//
// Plus the trait the physics actually selects on. Metabolic burn is decoded
// from `genome & 0xFF`, so if selection operates at all, the living population's
// mean should drift — and a drift that only shows up WITH reproduction, not
// without it, is evidence rather than noise.
//
// This is a Layer C instrument (docs/PHYSICS_BOUNDARY.md): it observes and
// never writes, so it computes in floats. The consensus path stays integer-only.
//
//   deno run --allow-read tools/structure_probe.ts [ticks] [capacity]

const TICKS = Number(Deno.args[0] ?? 3000);
const CAPACITY = Number(Deno.args[1] ?? 4096);
const SEED = 0x0EC0_0107;

const bytes = await Deno.readFile("./public/v2/omega_v2_core.wasm");
const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
const x = instance.exports as Record<string, CallableFunction>;
const memory = instance.exports.memory as WebAssembly.Memory;

x.v2_boot_engine();
x.v2_set_environment(7, 6, 2, 1024);
x.v2_ignite_big_bang(SEED, CAPACITY);

const latticePtr = x.v2_lattice_ptr() as number;
const Q_PHASE = 7;
const PHASE_SPAN = 1 << Q_PHASE; // agents wrap here
const LUT_SPAN = 256; // ...and the sine table is this wide

function signals() {
  const s = new Uint32Array(memory.buffer, latticePtr + 32, 12);
  return { causalTicks: s[1], active: s[4] };
}

/** Angle as the KERNEL's trigonometry reads it: the sine table spans 256. */
function angleOf(phase: number): number {
  return (phase / LUT_SPAN) * 2 * Math.PI;
}

/**
 * Angle if the agents' own wrap IS the circle — phase 0 and phase 127 adjacent.
 *
 * The discriminator. Agents wrap at 1<<q_phase = 128 while the trig table spans
 * 256, so under `angleOf` the population is confined to half a circle and a
 * UNIFORM distribution there already reads as order 2/π ≈ 0.637 — no
 * synchronisation required. If the two readings disagree, that number is
 * geometry rather than physics.
 */
function angleNative(phase: number): number {
  return (phase / PHASE_SPAN) * 2 * Math.PI;
}

function survey() {
  const active = signals().active;
  const a = new Uint32Array(
    memory.buffer,
    x.v2_agents_ptr() as number,
    active * 8,
  );

  const alive: number[] = []; // indices
  let sumCos = 0, sumSin = 0;
  let natCos = 0, natSin = 0;
  let effSum = 0, effMin = 255, effMax = 0;
  let maxPhase = 0;
  for (let i = 0; i < active; i++) {
    const e = a[i * 8 + 1];
    if (e === 0 || (a[i * 8 + 3] & 1) !== 0) continue;
    alive.push(i);
    const ph = a[i * 8 + 0];
    if (ph > maxPhase) maxPhase = ph;
    const th = angleOf(ph);
    sumCos += Math.cos(th);
    sumSin += Math.sin(th);
    const nt = angleNative(ph);
    natCos += Math.cos(nt);
    natSin += Math.sin(nt);
    const eff = a[i * 8 + 4] & 0xFF; // metabolic_efficiency, the burn trait
    effSum += eff;
    if (eff < effMin) effMin = eff;
    if (eff > effMax) effMax = eff;
  }
  const n = alive.length;
  if (n === 0) return null;

  const globalOrder = Math.hypot(sumCos / n, sumSin / n);
  const nativeOrder = Math.hypot(natCos / n, natSin / n);

  // Local order over the same Moore neighbourhood the physics uses.
  const w = 1 << 6; // q_radial = 6
  const h = Math.max(1, Math.ceil(active / w));
  let localSum = 0;
  for (const i of alive) {
    const cx = i % w, cy = Math.floor(i / w);
    let c = 0, s = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nIdx = ((cy + dy + h) % h) * w + ((cx + dx + w) % w);
        if (nIdx >= active) continue;
        if (a[nIdx * 8 + 1] === 0) continue;
        const th = angleOf(a[nIdx * 8 + 0]);
        c += Math.cos(th);
        s += Math.sin(th);
        k++;
      }
    }
    if (k > 0) localSum += Math.hypot(c / k, s / k);
  }

  return {
    alive: n,
    globalOrder,
    nativeOrder,
    localOrder: localSum / n,
    structure: localSum / n / Math.max(globalOrder, 1e-9),
    meanEfficiency: effSum / n,
    effMin,
    effMax,
    maxPhaseSeen: maxPhase,
  };
}

const series: Array<Record<string, number>> = [];
const first = survey();
for (let t = 1; t <= TICKS; t++) {
  x.v2_tick();
  if (t % 10 === 0) x.v2_mitosis_sweep();
  if (t <= 5 || t % Math.max(1, Math.floor(TICKS / 60)) === 0) {
    const s = survey();
    if (s) series.push({ tick: t, ...s });
  }
}
const last = survey();

console.log(JSON.stringify(
  {
    config: { ticks: TICKS, capacity: CAPACITY, seed: SEED },
    // Agents wrap their phase at 1<<q_phase while the sine table spans 256.
    // If nothing ever exceeds PHASE_SPAN-1, the population lives on HALF the
    // trigonometric circle and every phase difference is read through a table
    // twice as wide as the space it is measuring.
    phaseSpace: {
      agentWrap: PHASE_SPAN,
      lutSpan: LUT_SPAN,
      maxPhaseSeen: Math.max(first?.maxPhaseSeen ?? 0, last?.maxPhaseSeen ?? 0),
    },
    first,
    last,
    series,
  },
  null,
  2,
));
