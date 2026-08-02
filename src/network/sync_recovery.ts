// Sync boundary guards for the v2-state channel (T6 seam).
//
// Pure, unit-testable logic extracted from `libp2p_mesh.ts` per the repo
// pattern (`senate_weight.ts`, `dipole_accounting.ts`) — the mesh class
// itself is unimportable in unit tests (native WebRTC deps).
//
// Two independent guards live here:
//
// 1. `DivergenceRecovery` — liveness for the golden-trace divergence path.
//    Before 2026-08-01 the mesh set `isSyncFrozen = true` on `remoteGt >
//    localTrace` and published REQ_SNAPSHOT — but no responder exists
//    anywhere in the codebase (nothing handles REQ_SNAPSHOT, nothing ever
//    allocates `incomingSnapshot`), so the unfreeze branch was unreachable
//    and the node halted its physics forever. The recovery machine freezes
//    once per distinct remote gt, auto-unfreezes after a timeout, and
//    refuses to re-freeze for a gt that already timed out (anti-flap).
//
// 2. `sanitizeDeltaMutation` — boundary validation for the Era 6000
//    "Xenobiological Mutations" (raw `{index, phase, energy, genome}`
//    tuples any peer can write into WASM agent memory). Xenobiology is a
//    deliberate feature, but it must respect physics at the boundary:
//    index in bounds, energy ≤ MAX_ATP (Era 2080: energy is zero-sum
//    except solar input — nobody may mint ATP over the wire).

/** omega_v2/src/constants.rs:77 — thermodynamic ceiling. */
export const MAX_ATP = 4096;

/** Cap on mutations applied from a single v2-state message (anti-flood). */
export const MAX_MUTATIONS_PER_MESSAGE = 4096;

/** How long a node waits for a snapshot that may never come. */
export const SNAPSHOT_FREEZE_TIMEOUT_MS = 10_000;

export interface DeltaMutation {
  index: number;
  phase: number;
  energy: number;
  genome: number;
}

/**
 * Validate and clamp one incoming delta tuple. Returns null for out-of-bounds
 * indices (malformed or hostile); clamps energy to MAX_ATP otherwise.
 */
export function sanitizeDeltaMutation(
  index: number,
  phase: number,
  energy: number,
  genome: number,
  maxAgents: number,
): DeltaMutation | null {
  if (!Number.isInteger(index) || index < 0 || index >= maxAgents) {
    return null;
  }
  return {
    index,
    phase: phase >>> 0,
    energy: Math.min(energy >>> 0, MAX_ATP),
    genome: genome >>> 0,
  };
}

export class DivergenceRecovery {
  private frozenAtMs: number | null = null;
  private frozenForGt: number = 0;
  private exhaustedGt: number | null = null;
  private divergenceCount: number = 0;

  /** Total divergence events observed (telemetry / quarantine signal). */
  get divergences(): number {
    return this.divergenceCount;
  }

  /** The remote gt we are currently frozen waiting on, or null. */
  get waitingFor(): number | null {
    return this.frozenAtMs === null ? null : this.frozenForGt;
  }

  /**
   * A divergence was observed. Returns true exactly once per freeze episode
   * (the edge transition) so the caller publishes REQ_SNAPSHOT once, not per
   * packet. Never freezes for `remoteGt <= localGt` (we are the authority)
   * or for a gt whose freeze already timed out unanswered (anti-flap).
   */
  onDivergence(localGt: number, remoteGt: number, nowMs: number): boolean {
    if (remoteGt <= localGt) return false;
    if (remoteGt === this.exhaustedGt) return false;
    this.divergenceCount++;
    if (this.frozenAtMs !== null) return false; // already frozen
    this.frozenAtMs = nowMs;
    this.frozenForGt = remoteGt;
    return true;
  }

  /**
   * Current freeze state, with lazy timeout: an expired freeze releases
   * itself and remembers the unanswered gt so it is never retried.
   */
  isFrozen(nowMs: number): boolean {
    if (this.frozenAtMs === null) return false;
    if (nowMs - this.frozenAtMs >= SNAPSHOT_FREEZE_TIMEOUT_MS) {
      this.exhaustedGt = this.frozenForGt;
      this.frozenAtMs = null;
      return false;
    }
    return true;
  }

  /** A snapshot was actually applied — reset the episode. */
  onSnapshotApplied(): void {
    this.frozenAtMs = null;
    this.exhaustedGt = null;
  }
}
