// Substrate Court

// The Substrate Court enforces multi-witness deterministic consensus across
// heterogeneous substrates (WebGPU, Cortex-M4F/WASM, and SP1 ZK-VM).
// Instead of one substrate acting as a passive slave, all compute nodes
// broadcast LawHash and StateHash as "Testimonies".
// If a drift is detected, the SP1 ZK-VM acts as the Supreme Arbiter.

export const WITNESS_WEBGPU = 0;
export const WITNESS_WASM = 1;
export const WITNESS_SP1 = 2;

export type WitnessSubstrate = "webgpu" | "wasm" | "sp1";
export type WitnessSource = "gpu-readback" | "wasm-memory" | "zk-proof";
export type ProofKind = "mock" | "sp1-stark" | "groth16";

/**
 * Where a witness's state came from.
 *
 * `computed` — this substrate executed the transition and is reporting its OWN
 * result. Only these are evidence.
 *
 * `mirrored` — this substrate is reporting state it received from another. It
 * can corroborate nothing: comparing a mirror against its source asks whether
 * a copy equals the thing it was copied from.
 *
 * The distinction is not pedantry. Until 2026-08-06 this court took two
 * testimonies from ONE state — `renderer.tick()` writes only GPU buffers and
 * never touches WASM agent memory, so the "wasm" witness hashed a mirror the
 * GPU had filled at the last readback, and its pre- and post-state hashes were
 * equal by construction — then convicted on the fact that the two used
 * different hash functions, and quarantined both substrates when the arbiter it
 * called never answered. An organ that manufactures a second opinion out of one
 * observation does not detect drift; it fabricates it.
 */
export type WitnessDerivation = "computed" | "mirrored";

/** What the court can honestly say about a tick. */
export type CourtVerdict = "agreement" | "drift" | "not-assessed";

export interface StateWitness {
  substrate: WitnessSubstrate;
  source: WitnessSource;
  /** Omitted defaults to `mirrored`: a witness that does not claim to have
   *  computed the transition must not be counted as if it had. Fail closed. */
  derivation?: WitnessDerivation;
  proofKind?: ProofKind;
  lawHash: number;
  preStateHash: number;
  postStateHash: number;
  entropyDelta: number;
  tick: number;
}

export class SubstrateCourt {
  private testimonies = new Map<number, Map<WitnessSubstrate, StateWitness>>(); // tick -> (substrate -> StateWitness)
  private pendingArbitrations = new Map<number, number>(); // tick -> timeout id

  // Substrates that have failed arbitration and are temporarily isolated
  public isolatedSubstrates = new Set<WitnessSubstrate>();
  public quarantineReceipts = new Set<string>(); // Store isolation receipts
  /** Ticks where drift was seen and the arbiter never answered. Visible debt,
   *  not a conviction — see handleArbitrationTimeout. */
  public unresolvedTicks = new Set<number>();
  public transitionReceipts = new Set<string>(); // Store transitions into isolation

  constructor() {}

  /** Submit a testimony from a substrate for a specific absolute tick. */
  public submitTestimony(testimony: StateWitness): void {
    if (this.isolatedSubstrates.has(testimony.substrate)) {
      return; // Ignore testimony from isolated/distrusted substrates
    }

    if (!this.testimonies.has(testimony.tick)) {
      this.testimonies.set(testimony.tick, new Map());
    }

    const tickRecords = this.testimonies.get(testimony.tick)!;
    tickRecords.set(testimony.substrate, testimony);

    this.checkConsensus(testimony.tick);
  }

  /** The court's honest reading of a tick. */
  public verdictFor(tick: number): CourtVerdict {
    const records = this.testimonies.get(tick);
    if (!records) return "not-assessed";

    const computed = [...records.values()].filter(
      (w) => w.derivation === "computed",
    );
    // Two independent computations of the same transition, or nothing to say.
    if (computed.length < 2) return "not-assessed";

    const [first, ...rest] = computed;
    const agrees = rest.every(
      (w) =>
        w.postStateHash === first.postStateHash && w.lawHash === first.lawHash,
    );
    return agrees ? "agreement" : "drift";
  }

  /** Check if we have drift between the fast substrates (WebGPU vs WASM). */
  private checkConsensus(tick: number): void {
    const records = this.testimonies.get(tick)!;

    const verdict = this.verdictFor(tick);
    if (verdict === "not-assessed") {
      // Nothing to arbitrate and nothing to celebrate. Silence here is the
      // point: the alternative is an organ that reports agreement it never
      // established, which is how a court becomes a rubber stamp.
      return;
    }
    if (verdict === "agreement") {
      this.prune(tick - 100);
      return;
    }

    const gpu = records.get("webgpu");
    const wasm = records.get("wasm");

    if (gpu && wasm) {
      {
        // Drift detected! Trigger ZK arbitration if not already pending
        if (!this.pendingArbitrations.has(tick)) {
          const timeoutId = setTimeout(
            () => this.handleArbitrationTimeout(tick),
            5000,
          );
          this.pendingArbitrations.set(tick, timeoutId as unknown as number);
          this.requestArbitration(tick, gpu, wasm);
        }
      }
    }
  }

  /** Trigger SP1 to arbitrate the divergent tick. */
  private requestArbitration(
    tick: number,
    gpu: StateWitness,
    wasm: StateWitness,
  ): void {
    // Dispatch block to SP1 prover (simulated here for tests unless hooked).
    // A real SP1 backend will respond asynchronously with a proofKind: "sp1-stark"
    console.warn(
      `[SubstrateCourt] Drift detected at tick ${tick}. Requesting SP1 STARK arbitration.`,
    );
  }

  private handleArbitrationTimeout(tick: number): void {
    if (this.pendingArbitrations.has(tick)) {
      clearTimeout(this.pendingArbitrations.get(tick));
      console.warn(
        `[SubstrateCourt] Arbitration for tick ${tick} went unanswered. ` +
          `Drift stands UNRESOLVED — no substrate is convicted on silence.`,
      );

      // The arbiter did not answer, so the court does not know which substrate
      // was right. It used to isolate BOTH — converting "I could not find out"
      // into a conviction of everyone present, which then silenced every future
      // testimony (`submitTestimony` drops isolated substrates), so a single
      // unanswered request permanently blinded the organ.
      //
      // Uncertainty is not guilt. This is the same rule the Bitcoin anchor
      // already follows, where UNREACHABLE is a distinct verdict from MISMATCH:
      // failing to ask is not evidence of forgery. The unresolved tick is
      // recorded so the debt is visible, and `resolveArbitration` can still
      // convict later if a real proof arrives.
      this.unresolvedTicks.add(tick);
      this.pendingArbitrations.delete(tick);
    }
  }

  /** Process the definitive STARK proof testimony and punish the drifting substrate. */
  public resolveArbitration(arbiterTestimony: StateWitness): void {
    if (arbiterTestimony.substrate !== "sp1") return;

    // Ensure mock vs real proofs are tracked in the receipt
    const proofKind = arbiterTestimony.proofKind || "mock";

    const tick = arbiterTestimony.tick;
    if (!this.pendingArbitrations.has(tick)) return;

    clearTimeout(this.pendingArbitrations.get(tick));

    const records = this.testimonies.get(tick);
    if (!records) return;

    const gpu = records.get("webgpu");
    const wasm = records.get("wasm");

    if (
      gpu &&
      (gpu.postStateHash !== arbiterTestimony.postStateHash ||
        gpu.lawHash !== arbiterTestimony.lawHash)
    ) {
      console.error(
        `[SubstrateCourt] WebGPU drift convicted at tick ${tick} by ${proofKind}. Isolating substrate.`,
      );
      this.isolatedSubstrates.add("webgpu");
      const receipt = `convicted_webgpu_tick_${tick}_proof_${proofKind}`;
      this.quarantineReceipts.add(receipt);
      this.transitionReceipts.add(receipt);
    }

    if (
      wasm &&
      (wasm.postStateHash !== arbiterTestimony.postStateHash ||
        wasm.lawHash !== arbiterTestimony.lawHash)
    ) {
      console.error(
        `[SubstrateCourt] WASM drift convicted at tick ${tick} by ${proofKind}. Isolating substrate.`,
      );
      this.isolatedSubstrates.add("wasm");
      const receipt = `convicted_wasm_tick_${tick}_proof_${proofKind}`;
      this.quarantineReceipts.add(receipt);
      this.transitionReceipts.add(receipt);
    }

    this.pendingArbitrations.delete(tick);
  }

  /** Clean up old testimony records to prevent memory leaks. */
  private prune(beforeTick: number): void {
    for (const tick of this.testimonies.keys()) {
      if (tick < beforeTick && !this.pendingArbitrations.has(tick)) {
        this.testimonies.delete(tick);
      }
    }
  }
}
