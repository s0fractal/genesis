// Moran's I — do neighbouring cells carry similar VALUES?
//
// The order parameter answers "are these phases aligned". It cannot answer the
// question that matters once you know the alignment is frozen tissue: are there
// regions that move TOGETHER while still moving? A crystal scores high on
// coherence for the trivial reason that nothing in it changes. A coordinated
// region scores high on the correlation of its velocities, which a crystal
// cannot do — a frozen patch has zero variance and drops out of this measure
// rather than dominating it.
//
//   I > 0   neighbours resemble each other — patches
//   I ≈ 0   the value is spatially random
//   I < 0   neighbours differ — a checkerboard
//
// Normalised so that a field which is perfectly constant within blocks reads
// near 1, independent of the number of neighbours each cell has.
//
// `tests/spatial_correlation_test.ts` pins it against fields whose answer is
// known by construction. That is not optional here: the previous instrument in
// this repo reported its own sample size as physics for five eras because
// nobody ever fed it a field with a known answer.

/**
 * Two-pass accumulator. The mean and variance must be known before pairs can be
 * scored, so callers add every value first, then every neighbour pair.
 */
export class MoranEstimator {
  private values: number[] = [];
  private pairSum = 0;
  private pairs = 0;
  private mean = 0;
  private variance = 0;
  private sealed = false;

  /** Pass one: every cell's value, in any order. */
  addValue(v: number): void {
    if (this.sealed) throw new Error("addValue after seal()");
    this.values.push(v);
  }

  /** Freeze the mean and variance. Call once, between the two passes. */
  seal(): void {
    const n = this.values.length;
    if (n === 0) {
      this.sealed = true;
      return;
    }
    this.mean = this.values.reduce((a, b) => a + b, 0) / n;
    this.variance = this.values.reduce((a, b) => a + (b - this.mean) ** 2, 0) /
      n;
    this.sealed = true;
  }

  /** Pass two: one ordered neighbour pair. Add both directions or neither. */
  addPair(a: number, b: number): void {
    if (!this.sealed) throw new Error("addPair before seal()");
    this.pairSum += (a - this.mean) * (b - this.mean);
    this.pairs++;
  }

  /** How many cells carried a value — read it, a small sample means little. */
  get sampleCount(): number {
    return this.values.length;
  }

  /**
   * Moran's I.
   *
   * Zero variance means every cell is identical: there is no pattern to detect
   * and no meaningful normaliser, so this reports 0 rather than dividing by it.
   * That is the correct answer for a fully frozen lattice and the reason this
   * measure cannot be fooled by one.
   */
  value(): number {
    if (this.pairs === 0 || this.variance === 0) return 0;
    return this.pairSum / this.pairs / this.variance;
  }
}

/**
 * Signed phase velocity on a circular phase space of `span`.
 *
 * A raw subtraction reports an agent that stepped from `span - 1` to `0` as
 * having travelled backwards across the whole circle. The shortest signed arc
 * is the only reading under which "moving together" means anything.
 */
export function wrappedDelta(before: number, after: number, span: number) {
  const half = span / 2;
  return ((after - before + half + span) % span) - half;
}
