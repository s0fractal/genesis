// The Kuramoto order parameter, estimated honestly over small samples.
//
// r = |mean of e^{iθ}| is the standard measure of how aligned a set of phases
// is. Over a LARGE set it is fine. Over eight neighbours it is not, and the
// structure probe spent five eras reading its own sample size as physics.
//
// Two separate biases, and the second is the one that hid:
//
//   THE FLOOR. For k independent random phases, E[r] ≈ √(π/(4k)) — 0.31 for the
//   eight-cell Moore neighbourhood. Comparing that against a global r computed
//   over four thousand agents, where the floor is negligible, manufactures a
//   ratio out of nothing. `E[r²] = R² + (1 - R²)/k` gives the standard
//   correction, `R̂² = (k·r² - 1)/(k - 1)`.
//
//   THE CLIP. `R̂²` is unbiased but noisy, and for a genuinely random
//   neighbourhood it lands negative about half the time. Taking `√max(0, R̂²)`
//   per agent and averaging those keeps every upward excursion and floors every
//   downward one, so the result is strictly positive no matter what. Measured
//   against a synthetic field with a KNOWN true R of zero, that estimator
//   returns 0.12. OMEGA's measured "local order" was 0.145 — and it did not move
//   when the coupling was switched off, when reproduction was switched off, or
//   across five eras of physics changes, because it was never a function of the
//   world.
//
// So the average is taken over R̂² — unclipped, negatives included, where the
// errors cancel — and the square root is taken once, at the end, of a quantity
// that is by then precise. `tests/order_parameter_test.ts` pins this against
// fields whose true R is known by construction.

/** One neighbourhood's contribution: the bias-corrected R², which may be < 0. */
export function correctedR2(cosSum: number, sinSum: number, k: number): number {
  if (k < 2) return Number.NaN;
  const r2 = (cosSum / k) ** 2 + (sinSum / k) ** 2;
  return (k * r2 - 1) / (k - 1);
}

/**
 * Accumulates corrected R² across neighbourhoods and reports one order
 * parameter for the field.
 */
export class OrderParameterEstimator {
  private sum = 0;
  private n = 0;

  /** Add one neighbourhood. Samples with k < 2 carry no information and are ignored. */
  add(cosSum: number, sinSum: number, k: number): void {
    const c = correctedR2(cosSum, sinSum, k);
    if (Number.isNaN(c)) return;
    this.sum += c;
    this.n++;
  }

  /** Neighbourhoods that contributed. */
  get count(): number {
    return this.n;
  }

  /**
   * The estimate. Clipping happens ONCE, here, after averaging — a mean of
   * thousands of unbiased R² is precise enough that the clip almost never
   * fires, which is exactly why it must not be applied per sample.
   */
  value(): number {
    if (this.n === 0) return 0;
    return Math.sqrt(Math.max(0, this.sum / this.n));
  }
}
