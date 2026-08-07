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

export const MUTATION_LUT = new Uint32Array([
  0x00000000,
  0x00000001,
  0x00000002,
  0x00000004,
  0x00000008,
  0x00000010,
  0x00000020,
  0x00000040,
  0x00000080,
  0x00000100,
  0x00000200,
  0x00000400,
  0x00000800,
  0x00001000,
  0x00002000,
  0x00004000,
  0x00008000,
  0x00010000,
  0x00020000,
  0x00040000,
  0x00080000,
  0x00100000,
  0x00200000,
  0x00400000,
  0x00800000,
  0x01000000,
  0x02000000,
  0x04000000,
  0x08000000,
  0x10000000,
  0x20000000,
  0x40000000,
  0x80000000,
  0x00000003,
  0x00000006,
  0x0000000C,
  0x00000018,
  0x00000030,
  0x00000060,
  0x000000C0,
  0x00000180,
  0x00000300,
  0x00000600,
  0x00000C00,
  0x00001800,
  0x00003000,
  0x00006000,
  0x0000C000,
  0x00018000,
  0x00030000,
  0x00060000,
  0x000C0000,
  0x00180000,
  0x00300000,
  0x00600000,
  0x00C00000,
  0x01800000,
  0x03000000,
  0x06000000,
  0x0C000000,
  0x18000000,
  0x30000000,
  0x60000000,
  0xC0000000,
  0x00000007,
  0x0000000E,
  0x0000001C,
  0x00000038,
  0x00000070,
  0x000000E0,
  0x000001C0,
  0x00000380,
  0x00000700,
  0x00000E00,
  0x00001C00,
  0x00003800,
  0x00007000,
  0x0000E000,
  0x0001C000,
  0x00038000,
  0x00070000,
  0x000E0000,
  0x001C0000,
  0x00380000,
  0x00700000,
  0x00E00000,
  0x01C00000,
  0x03800000,
  0x07000000,
  0x0E000000,
  0x1C000000,
  0x38000000,
  0x70000000,
  0xE0000000,
  0x00028082,
  0x00000140,
  0x08000026,
  0x00006000,
  0x04005002,
  0x00020401,
  0x08220200,
  0x00200040,
  0x01000040,
  0x00410004,
  0x210000A0,
  0x00841010,
  0x00044000,
  0x00004040,
  0x20820000,
  0x00C00000,
  0x00020010,
  0x20008400,
  0x00124000,
  0x00004004,
  0x02020010,
  0x00102000,
  0xA2000200,
  0x00018100,
  0x0A804000,
  0x80000020,
  0x00000280,
  0x09000410,
  0x20010001,
  0x00220080,
  0x28000400,
  0x00010800,
  0x00081240,
  0x00100401,
  0x00800082,
  0x00008008,
  0x80000030,
  0x40000500,
  0x08003000,
  0x12880000,
  0x1000C080,
  0x00200002,
  0x00004011,
  0x0000401C,
  0x00028010,
  0xC0002100,
  0x44000000,
  0x00000040,
  0x0C400000,
  0x00000048,
  0x00208040,
  0x10001000,
  0x08000800,
  0x20008010,
  0x00000049,
  0x00008400,
  0xC0002000,
  0x01000408,
  0x01010000,
  0x88040000,
  0x00041000,
  0x00000008,
  0x40100008,
  0x00000C28,
  0x00008010,
  0x00008084,
  0x04110020,
  0x00108000,
  0x02080100,
  0x00100011,
  0x00002050,
  0x00410110,
  0x00840000,
  0x10080000,
  0x00080141,
  0x000002C0,
  0x00242000,
  0x80010000,
  0x08000028,
  0x00200005,
  0x00010400,
  0x18000081,
  0x00000204,
  0x08000300,
  0x00880000,
  0x00402000,
  0x04408040,
  0x00008E00,
  0x00200802,
  0x00028400,
  0x41000044,
  0x20001000,
  0x00084000,
  0x02001000,
  0x00020010,
  0x02200002,
  0x00010800,
  0x08010044,
  0x08100080,
  0x00011004,
  0x08801001,
  0x00300010,
  0x04080080,
  0x02040100,
  0x05000000,
  0x02080801,
  0x08042000,
  0x30100000,
  0x40002420,
  0x00208020,
  0x00085200,
  0x00008004,
  0x24000010,
  0x83001000,
  0x00000201,
  0x08004000,
  0x20000008,
  0x20008180,
  0x18100000,
  0x50000400,
  0x80028000,
  0x10028010,
  0x00268000,
  0x00000320,
  0x01000200,
  0x04002010,
  0x24000008,
  0x05000000,
  0x41000003,
  0x05080000,
  0x80024000,
  0x81000002,
  0x22000400,
  0x02000002,
  0x08000122,
  0x00010808,
  0x20102000,
  0x01220000,
  0x40010020,
  0x00400008,
  0x00000014,
  0x00009000,
  0x00008200,
  0x40000080,
  0x20812000,
  0x00000480,
  0x00080042,
  0x03001010,
  0x000880C0,
  0x08C00004,
  0x00200001,
  0x88000040,
  0x28000200,
  0x40020000,
  0x08120000,
  0x00020020,
  0x21008000,
  0x80100002,
  0x80002000,
  0x00230000,
  0x00021021,
  0x84000000,
]);

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
    const index = Number(mutSeed & 0xFFn);
    const mask = MUTATION_LUT[index];
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
    // MASKED — mirrors `derive_mitosis_child` in omega_v2/src/mitosis_proof.rs.
    // Both sides wrote `parent.phase + halfPhase` raw, so a parent near the top
    // of the wrap produced a child outside it: 383 where q_phase=8 ends at 255.
    // This is the third mirror of that law — Rust, the SP1 guest (same code) and
    // this — and the host's pre-flight ("claimed child does not match
    // derivation") is what catches the two disagreeing.
    phase: (parent.phase + halfPhase) & maxPhaseMask,
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
