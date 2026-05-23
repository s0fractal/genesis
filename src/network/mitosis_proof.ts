// Mitosis Proof (JS mirror)

// Pure-TS port of `omega_v2::mitosis_proof::derive_mitosis_child` and
// `child_receipt_hash`. Used by the WebRTC mesh to locally verify a DIPOLE
// birth-announcement plasmid before accepting it: if the announced child
// does not match what the lattice would have produced from the same parent
// + attractor state, the plasmid is rejected at the boundary.

// THIS FILE MUST STAY BIT-FOR-BIT IDENTICAL TO THE RUST SOURCE-OF-TRUTH.
// Cross-language anchor lives in `omega_v2/tests/mitosis_anchor.rs` and
// `tests/mitosis_proof_test.ts`.

export interface AgentMinimal {
  phase: number; // u32
  energy: number; // u32
  base_freq: number; // i32
  state_flags: number; // u32
  genome: number; // u32
  memory: [number, number, number]; // u32 × 3
}

export interface AttractorEntry {
  matrix: number; // u32
  inverse: number; // u32
  pulse_freq: number; // u32
  pulse_amp: number; // u32
}

export const CHILD_ENERGY_SEED = 1024;
export const BIRTH_NEAR_ATTRACTOR_FLAG = 0x0100_0000;

/** Mirror of omega_v2::math::xorshift64_once (single-step variant). */
export function xorshift64Once(seed: bigint): bigint {
  let s = seed;
  if (s === 0n) s = 1n;
  s ^= (s << 13n) & 0xFFFF_FFFF_FFFF_FFFFn;
  s ^= (s >> 7n) & 0xFFFF_FFFF_FFFF_FFFFn;
  s ^= (s << 17n) & 0xFFFF_FFFF_FFFF_FFFFn;
  return s & 0xFFFF_FFFF_FFFF_FFFFn;
}

/** Pure derivation of the mitosis offspring. */
export function deriveMitosisChild(
  parent: AgentMinimal,
  attractors: AttractorEntry[],
  qPhase: number,
): AgentMinimal {
  const maxPhaseMask = ((1 << qPhase) - 1) >>> 0;
  const halfPhase = (1 << Math.max(qPhase - 1, 0)) >>> 0;
  const quarterPhase = (1 << Math.max(qPhase - 2, 0)) >>> 0;

  let bestDist = 0xFFFF_FFFF;
  let bestMatrix = 0;
  const count = Math.min(attractors.length, 4);
  for (let i = 0; i < count; i++) {
    const a = attractors[i];
    if (a.pulse_amp === 0) continue;
    const masked = (a.matrix & maxPhaseMask) >>> 0;
    const diff = parent.phase >= masked
      ? parent.phase - masked
      : masked - parent.phase;
    const wrapped = (maxPhaseMask + 1) - diff;
    const dist = diff < wrapped ? diff : wrapped;
    if (dist < bestDist) {
      bestDist = dist;
      bestMatrix = a.matrix >>> 0;
    }
  }

  const birthNearAttractor = bestDist < quarterPhase && bestMatrix !== 0;

  let genome: number;
  let memory0: number;
  let stateFlags: number;
  if (birthNearAttractor) {
    genome = (parent.genome ^ bestMatrix) >>> 0;
    memory0 = bestMatrix >>> 0;
    stateFlags = (parent.state_flags | BIRTH_NEAR_ATTRACTOR_FLAG) >>> 0;
  } else {
    // Epigenetic Inheritance
    // The parent's lived experience (memory) and stress (energy) alters the mutation vector.
    const mem1 = BigInt(parent.memory[1] >>> 0) << 16n;
    const mem2 = BigInt(parent.memory[2] >>> 0) << 32n;
    const energy = BigInt(parent.energy >>> 0);
    const epigeneticBase = BigInt(parent.genome >>> 0) ^ mem1 ^ mem2 ^ energy;

    const mutSeed = xorshift64Once(epigeneticBase);
    const mask = Number(mutSeed & 0xFFFF_FFFFn) >>> 0;
    genome = (parent.genome ^ mask) >>> 0;
    memory0 = parent.memory[0] >>> 0;
    stateFlags = parent.state_flags >>> 0;
  }

  // Decode Species from Genome
  const species = genome & 0x7F;
  stateFlags = ((stateFlags & ~0xFE) | (species << 1)) >>> 0;

  // Thermodynamic Epistemology (Landauer's Principle):
  // Deduct exact energy cost for every bit flipped during mitosis.
  let flippedBits = 0;
  let flipMask = (parent.genome ^ genome) >>> 0;
  while (flipMask > 0) {
    flippedBits += flipMask & 1;
    flipMask >>>= 1;
  }
  // LANDAUER_BIT_COST = 1
  let childEnergy = CHILD_ENERGY_SEED - flippedBits;
  if (childEnergy <= 0) childEnergy = 1;

  return {
    phase: ((parent.phase + halfPhase) >>> 0) & 0xFFFF_FFFF,
    energy: childEnergy >>> 0,
    base_freq: parent.base_freq | 0,
    state_flags: stateFlags,
    genome,
    memory: [memory0, parent.memory[1] >>> 0, parent.memory[2] >>> 0],
  };
}

/** Mirror of omega_v2::mitosis_proof::child_receipt_hash (SHA-256 over LE 32-byte agent). */
export async function childReceiptHash(child: AgentMinimal): Promise<string> {
  const buf = new Uint8Array(32);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, child.phase >>> 0, true);
  dv.setUint32(4, child.energy >>> 0, true);
  dv.setInt32(8, child.base_freq | 0, true);
  dv.setUint32(12, child.state_flags >>> 0, true);
  dv.setUint32(16, child.genome >>> 0, true);
  dv.setUint32(20, child.memory[0] >>> 0, true);
  dv.setUint32(24, child.memory[1] >>> 0, true);
  dv.setUint32(28, child.memory[2] >>> 0, true);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = "";
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, "0");
  }
  return hex;
}
