// The instrument, measured against fields whose answer is known by construction.
//
// Every "no domains" and every "domains!" reading omega has produced came out of
// this estimator. It was never checked against a field with a known order
// parameter, and when it finally was, it returned 0.12 for a field whose true
// value is 0. Five eras of local-order measurements were that number.
//
// A deterministic PRNG so a failure is reproducible rather than a mood.

import { assert } from "jsr:@std/assert";
import {
  correctedR2,
  OrderParameterEstimator,
} from "../src/shared/order_parameter.ts";

/** mulberry32 — small, deterministic, adequate for generating test fields. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

/**
 * A field of `agents` neighbourhoods of `k` phases each, with a known true
 * order parameter.
 *
 * `R = 0` is uniform. `R > 0` is built by placing each phase at the mean
 * direction with probability R and uniformly at random otherwise — a mixture
 * whose resultant length is exactly R in expectation, and which needs no
 * special functions to construct.
 */
function field(
  R: number,
  agents: number,
  k: number,
  seed: number,
): OrderParameterEstimator {
  const rand = rng(seed);
  const est = new OrderParameterEstimator();
  for (let i = 0; i < agents; i++) {
    let c = 0, s = 0;
    for (let j = 0; j < k; j++) {
      const th = rand() < R ? 0 : rand() * TAU;
      c += Math.cos(th);
      s += Math.sin(th);
    }
    est.add(c, s, k);
  }
  return est;
}

Deno.test("a uniformly random field reads as zero, not as its sample size", () => {
  const est = field(0, 4096, 8, 0xEC0_0107);
  const v = est.value();
  assert(
    v < 0.05,
    `uniform random field over 8-neighbourhoods reads ${v.toFixed(4)}. The ` +
      `true order parameter is 0. Averaging per-sample sqrt(max(0, R2)) ` +
      `returns ~0.12 here, which is the number omega reported as "local ` +
      `coherence" for five eras — invariant under coupling, reproduction and ` +
      `every physics change, because it was measuring k.`,
  );
});

Deno.test("a genuinely ordered field is recovered, not flattened", () => {
  // The correction must not buy its honesty at zero by destroying real signal.
  for (const R of [0.3, 0.6, 0.9]) {
    const v = field(R, 4096, 8, 0xBEEF).value();
    assert(
      Math.abs(v - R) < 0.08,
      `field built with true R=${R} reads ${v.toFixed(4)} — the estimator is ` +
        `not just conservative, it is wrong in the other direction`,
    );
  }
});

Deno.test("the correction is what removes the floor", () => {
  // The guard against this file passing for the wrong reason: show that the
  // UNCORRECTED statistic really does sit at the floor on the same field, so
  // the assertions above are testing the correction and not the fixture.
  const rand = rng(0x5EED);
  let raw = 0;
  const k = 8, agents = 4096;
  for (let i = 0; i < agents; i++) {
    let c = 0, s = 0;
    for (let j = 0; j < k; j++) {
      const th = rand() * TAU;
      c += Math.cos(th);
      s += Math.sin(th);
    }
    raw += Math.hypot(c / k, s / k);
  }
  raw /= agents;
  const expectedFloor = Math.sqrt(Math.PI / (4 * k)); // ~0.313
  assert(
    Math.abs(raw - expectedFloor) < 0.05,
    `uncorrected mean r on a random field is ${raw.toFixed(4)}, expected the ` +
      `sampling floor ~${expectedFloor.toFixed(3)} — the fixture is not random`,
  );
});

Deno.test("a sample of one carries no information and is not counted", () => {
  assert(Number.isNaN(correctedR2(1, 0, 1)));
  const est = new OrderParameterEstimator();
  est.add(1, 0, 1);
  assert(est.count === 0, "a k=1 neighbourhood was folded into the average");
});
