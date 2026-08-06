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

import { OrderParameterEstimator } from "../src/shared/order_parameter.ts";
import {
  MoranEstimator,
  wrappedDelta,
} from "../src/shared/spatial_correlation.ts";

const TICKS = Number(Deno.args[0] ?? 3000);
const CAPACITY = Number(Deno.args[1] ?? 4096);
const STRIDE = Number(Deno.args[2] ?? 0) ||
  Math.max(1, Math.floor(TICKS / 60));
const SEED = 0x0EC0_0107;

const bytes = await Deno.readFile("./public/v2/omega_v2_core.wasm");
const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
const x = instance.exports as Record<string, CallableFunction>;
const memory = instance.exports.memory as WebAssembly.Memory;

x.v2_boot_engine();
x.v2_set_environment(7, 6, 2, 1024);
x.v2_ignite_big_bang(SEED, CAPACITY);

const latticePtr = x.v2_lattice_ptr() as number;
const Q_PHASE = 8;
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

function survey(prevPhase?: Uint32Array) {
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
  let tissue = 0;
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
    // FLAG_TISSUE_LOCKED. A one-way door: `tick_physics` sets it when an agent
    // is rich, aligned and unstressed, zeroes its base_freq — "structurally
    // rigid" — and nothing anywhere clears it again. Tracked here because a
    // lattice that has crystallised looks, to every other measure, exactly like
    // one that has converged.
    if ((a[i * 8 + 3] & 0x08000000) !== 0) tissue++;
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
  const localEst = new OrderParameterEstimator();
  const localNativeEst = new OrderParameterEstimator();
  // Is the TISSUE spatially arranged, or just spatially random?
  //
  // `structure` above measures PHASE domains, which is a different question and
  // the only one this probe used to ask. A tissue fraction can hold any value
  // at all while being scattered uniformly — the number alone cannot tell a
  // body with organs from salt in water. So count, over living neighbours,
  // how often a tissue cell's neighbour is also tissue, and compare that to
  // how often ANY cell's neighbour is tissue.
  //
  //   ratio > 1  patches: tissue cells find each other (organs)
  //   ratio < 1  lateral inhibition: tissue cells repel at range 1 (spots)
  //   ratio ≈ 1  the flag is sprinkled at random and means nothing spatially
  //
  // Both departures from 1 are structure. Only 1 is nothing.
  let tissueNbrsOfTissue = 0, nbrsOfTissue = 0;
  let tissueNbrsAll = 0, nbrsAll = 0;
  for (const i of alive) {
    const cx = i % w, cy = Math.floor(i / w);
    const selfTissue = (a[i * 8 + 3] & 0x08000000) !== 0;
    let c = 0, s = 0, k = 0;
    let cn = 0, sn = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nIdx = ((cy + dy + h) % h) * w + ((cx + dx + w) % w);
        if (nIdx >= active) continue;
        if (a[nIdx * 8 + 1] === 0) continue;
        const th = angleOf(a[nIdx * 8 + 0]);
        c += Math.cos(th);
        s += Math.sin(th);
        // Also in the agents' OWN wrap. When q_phase makes the two circles the
        // same these are identical; when they differ, this is the only one that
        // means anything — and it is the only reading under which a seamed world
        // and a closed one can be compared at all.
        const tn = angleNative(a[nIdx * 8 + 0]);
        cn += Math.cos(tn);
        sn += Math.sin(tn);
        k++;
        const nTissue = (a[nIdx * 8 + 3] & 0x08000000) !== 0 ? 1 : 0;
        tissueNbrsAll += nTissue;
        nbrsAll++;
        if (selfTissue) {
          tissueNbrsOfTissue += nTissue;
          nbrsOfTissue++;
        }
      }
    }
    if (k > 1) {
      // Both accumulators are bias-corrected and CLIPPED ONCE, at the end.
      // See src/shared/order_parameter.ts for why the per-agent clip that used
      // to live here reported 0.12 on a field whose true order is zero.
      localEst.add(c, s, k);
      localNativeEst.add(cn, sn, k);
    }
  }
  // VELOCITY CORRELATION. Do neighbours advance TOGETHER while still moving?
  //
  // The order parameter cannot distinguish a coordinated region from a frozen
  // one; a crystal scores high on it because nothing changes. This scores a
  // crystal at 0 by construction — a frozen patch has no velocity variance and
  // drops out rather than dominating. Reported for the living, and separately
  // for the MOTILE, because tissue is pinned at drift 0 and would otherwise
  // supply a large block of identical values that is stillness, not agreement.
  let velAll = 0, velMotile = 0;
  if (prevPhase) {
    const eAll = new MoranEstimator();
    const eMot = new MoranEstimator();
    const vel = new Map<number, number>();
    for (const i of alive) {
      // Mitosis grows `active` between snapshots, so an agent born since the
      // last sample has no previous phase and therefore no velocity. Skipping
      // it is correct; letting it through produced NaN, which JSON silently
      // renders as null and which would have averaged to nothing at all.
      if (i >= prevPhase.length) continue;
      const v = wrappedDelta(prevPhase[i], a[i * 8 + 0], PHASE_SPAN);
      vel.set(i, v);
      eAll.addValue(v);
      if ((a[i * 8 + 3] & 0x08000000) === 0) eMot.addValue(v);
    }
    eAll.seal();
    eMot.seal();
    for (const i of alive) {
      const cx = i % w, cy = Math.floor(i / w);
      const vi = vel.get(i)!;
      const iMot = (a[i * 8 + 3] & 0x08000000) === 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((cy + dy + h) % h) * w + ((cx + dx + w) % w);
          const vn = vel.get(nIdx);
          if (vn === undefined) continue;
          eAll.addPair(vi, vn);
          if (iMot && (a[nIdx * 8 + 3] & 0x08000000) === 0) {
            eMot.addPair(vi, vn);
          }
        }
      }
    }
    velAll = eAll.value();
    velMotile = eMot.value();
  }

  // HOW BIG IS THE COUPLING, ACTUALLY?
  //
  // `tick_physics` stores the tick's coupling term in memory[0], so the force
  // this kernel is named for can be read directly and compared against the
  // agent's own natural frequency — the two terms that are summed to make the
  // phase advance. "The coupling does nothing" is a claim about a ratio, and
  // the ratio has never been printed.
  let cSum = 0, fSum = 0, cN = 0, clamped = 0;
  for (const i of alive) {
    cSum += Math.abs(new Int32Array(a.buffer, a.byteOffset + i * 32, 8)[5]);
    // The EFFECTIVE natural frequency: what the Nyquist clamp leaves. Reporting
    // the raw `base_freq` overstates it by an order of magnitude, because
    // tick_physics clamps to ±max_phase/2 before dividing out the Q10 scale.
    const raw = new Int32Array(a.buffer, a.byteOffset + i * 32, 8)[2] / 1024;
    const capped = Math.max(-PHASE_SPAN / 2, Math.min(PHASE_SPAN / 2, raw));
    fSum += Math.abs(capped);
    if (Math.abs(raw) >= PHASE_SPAN / 2) clamped++;
    cN++;
  }

  const pGiven = nbrsOfTissue > 0 ? tissueNbrsOfTissue / nbrsOfTissue : 0;
  const pAny = nbrsAll > 0 ? tissueNbrsAll / nbrsAll : 0;

  return {
    alive: n,
    globalOrder,
    nativeOrder,
    localOrder: localEst.value(),
    localOrderNative: localNativeEst.value(),
    structure: localEst.value() / Math.max(globalOrder, 1e-9),
    tissueFraction: tissue / n,
    // 1.0 means the tissue flag has no spatial arrangement at all. Reported
    // even when the fraction is 0, where it is 0 by construction and says
    // nothing — read it together with tissueFraction, never alone.
    tissueClustering: pAny > 0 ? pGiven / pAny : 0,
    meanAbsCoupling: cN > 0 ? cSum / cN : 0,
    meanAbsBaseFreq: cN > 0 ? fSum / cN : 0,
    fractionAtNyquistClamp: cN > 0 ? clamped / cN : 0,
    velocityCorrelation: velAll,
    velocityCorrelationMotile: velMotile,
    meanEfficiency: effSum / n,
    effMin,
    effMax,
    maxPhaseSeen: maxPhase,
  };
}

function phaseSnapshot(): Uint32Array {
  const active = signals().active;
  const a = new Uint32Array(
    memory.buffer,
    x.v2_agents_ptr() as number,
    active * 8,
  );
  const out = new Uint32Array(active);
  for (let i = 0; i < active; i++) out[i] = a[i * 8 + 0];
  return out;
}

const series: Array<Record<string, number>> = [];
const first = survey();
let prev = phaseSnapshot();
for (let t = 1; t <= TICKS; t++) {
  x.v2_tick();
  if (t % 10 === 0) x.v2_mitosis_sweep();
  if (t <= 5 || t % STRIDE === 0) {
    const s = survey(prev);
    prev = phaseSnapshot();
    if (s) series.push({ tick: t, ...s });
  }
}
const last = survey(prev);

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
