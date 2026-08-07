// Where the fields of a PhaseAgentMinimal actually are.
//
// `omega_v2/tests/ffi_layout.rs` pins the Rust side: phase 0, energy 4,
// base_freq 8, state_flags 12, genome 16, memory 20, total 32 bytes. The
// instruments read the same struct out of wasm memory with hand-written
// offsets — `a[i * 8 + 4]` for the genome, `a[i * 8 + 1]` for energy, twenty-two
// of them across two probes — and **nothing connected the two sides**.
//
// That is the worst possible place for a silent gap. A field moving in Rust
// turns `ffi_layout.rs` red, which is loud; the probes would go on reading the
// old positions, which is silent. Every measurement in `docs/PHYSICS.md` — the
// knockout audit, the entropies, the clines — comes through these offsets, and
// a shifted field does not produce an error. It produces a plausible number.
//
// So the offsets live here once, the probes read them from here, and
// `tests/agent_layout_test.ts` checks them against a real ignited world rather
// than against a copy of the same constants.

/** u32 words per agent — 32 bytes, the GPU-coalesced ABI. */
export const AGENT_WORDS = 8;

/** Word index of each field, mirroring `ffi_layout.rs`'s byte offsets / 4. */
export const FIELD = {
  phase: 0,
  energy: 1,
  baseFreq: 2,
  stateFlags: 3,
  genome: 4,
  memory0: 5,
  memory1: 6,
  memory2: 7,
} as const;

/** Bit 0 of `state_flags`. */
export const FLAG_DEAD = 0x01;
/** Bit 27. */
export const FLAG_TISSUE_LOCKED = 0x0800_0000;
/** Age occupies `state_flags` bits 8..23 (Era 969). */
export const AGE_MASK = 0x00FF_FF00;
export const AGE_SHIFT = 8;

/** A typed view over the agent array, so callers stop counting words. */
export class AgentView {
  constructor(private a: Uint32Array) {}

  word(i: number, field: keyof typeof FIELD): number {
    return this.a[i * AGENT_WORDS + FIELD[field]];
  }

  phase(i: number): number {
    return this.word(i, "phase");
  }
  energy(i: number): number {
    return this.word(i, "energy");
  }
  genome(i: number): number {
    return this.word(i, "genome") >>> 0;
  }
  stateFlags(i: number): number {
    return this.word(i, "stateFlags");
  }

  /** The kernel's own liveness predicate: energy > 0 and not flagged dead. */
  alive(i: number): boolean {
    return this.energy(i) > 0 && (this.stateFlags(i) & FLAG_DEAD) === 0;
  }

  age(i: number): number {
    return (this.stateFlags(i) & AGE_MASK) >>> AGE_SHIFT;
  }

  /** Signed read, for the fields that are `i32` on the Rust side. */
  signed(i: number, field: keyof typeof FIELD): number {
    return this.a[i * AGENT_WORDS + FIELD[field]] | 0;
  }
}
