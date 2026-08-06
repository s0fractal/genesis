// The velocity-correlation instrument, against fields whose answer is known.
//
// Written before it was pointed at omega, because the last instrument in this
// repo was pointed at omega for five eras first and turned out to be reporting
// its own sample size.

import { assert } from "jsr:@std/assert";
import {
  MoranEstimator,
  wrappedDelta,
} from "../src/shared/spatial_correlation.ts";

const W = 64, H = 64;

/** Score a w×h field with 4-neighbour adjacency (toroidal). */
function moran(field: number[]): number {
  const est = new MoranEstimator();
  for (const v of field) est.addValue(v);
  est.seal();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = field[y * W + x];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
        est.addPair(v, field[ny * W + nx]);
      }
    }
  }
  return est.value();
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Deno.test("a spatially random field reads as zero", () => {
  const r = rng(0xEC0_0107);
  const v = moran(Array.from({ length: W * H }, () => r()));
  assert(
    Math.abs(v) < 0.05,
    `random field reads I=${v.toFixed(4)}, expected ~0 — this measure would ` +
      `report structure in noise`,
  );
});

Deno.test("blocks that move together read as strongly positive", () => {
  // 8×8 blocks, each with its own constant value: the shape a coordinated
  // region would have.
  const r = rng(0xB10C);
  const blockVal = Array.from({ length: 64 }, () => r());
  const field = Array.from({ length: W * H }, (_, i) => {
    const x = i % W, y = Math.floor(i / W);
    return blockVal[Math.floor(y / 8) * 8 + Math.floor(x / 8)];
  });
  const v = moran(field);
  assert(v > 0.7, `8×8 blocks read I=${v.toFixed(4)}, expected near 1`);
});

Deno.test("a checkerboard reads as strongly negative", () => {
  const field = Array.from(
    { length: W * H },
    (_, i) => ((i % W) + Math.floor(i / W)) % 2,
  );
  const v = moran(field);
  assert(v < -0.9, `checkerboard reads I=${v.toFixed(4)}, expected near -1`);
});

Deno.test("a frozen field reports 0, not a division by its own stillness", () => {
  // Every cell identical: perfect "agreement", zero variance, no pattern. The
  // failure this guards is the one the order parameter has — a crystal reading
  // as maximal structure because nothing in it moves.
  const v = moran(new Array(W * H).fill(7));
  assert(v === 0, `constant field reads I=${v}, expected exactly 0`);
});

Deno.test("velocity across the phase wrap is the short way round", () => {
  // 255 → 0 is one step forward on a circle of 256, not 255 steps back.
  assert(wrappedDelta(255, 0, 256) === 1);
  assert(wrappedDelta(0, 255, 256) === -1);
  assert(wrappedDelta(10, 20, 256) === 10);
  // Exactly antipodal is reported as +half by the convention, consistently.
  assert(wrappedDelta(0, 128, 256) === -128);
});
