/**
 * Φ-SDK: Phase Types & Parsers
 * Read-only types representing the OMEGA-64 memory model.
 */

export interface PhaseAgentMinimal {
  phase: number; // u32
  energy: number; // u32
  baseFreq: number; // i32
  stateFlags: number; // u32
  genome: number; // u32
  memory: [number, number, number]; // [u32; 3]

  // Decoded flags
  isLocked: boolean;
  speciesId: number;
  traits: number;
  bornNearAttractor: boolean;
}

export class PhaseAgentParser {
  static readonly BYTES_PER_AGENT = 32;

  /**
   * Parses a single 32-byte PhaseAgentMinimal structure from a DataView at the given byteOffset.
   */
  static parse(view: DataView, byteOffset: number): PhaseAgentMinimal {
    const phase = view.getUint32(byteOffset + 0, true);
    const energy = view.getUint32(byteOffset + 4, true);
    const baseFreq = view.getInt32(byteOffset + 8, true);
    const stateFlags = view.getUint32(byteOffset + 12, true);
    const genome = view.getUint32(byteOffset + 16, true);
    const memory0 = view.getUint32(byteOffset + 20, true);
    const memory1 = view.getUint32(byteOffset + 24, true);
    const memory2 = view.getUint32(byteOffset + 28, true);

    // stateFlags mapping:
    // Bit 0 (LSB): is_locked
    // Bits 1-7: species_id
    // Bits 8-23: traits
    // Bit 24: "born near attractor" bit (0x0100_0000)
    const isLocked = (stateFlags & 1) !== 0;
    const speciesId = (stateFlags >> 1) & 0x7F;
    const traits = (stateFlags >> 8) & 0xFFFF;
    const bornNearAttractor = (stateFlags & 0x01000000) !== 0;

    return {
      phase,
      energy,
      baseFreq,
      stateFlags,
      genome,
      memory: [memory0, memory1, memory2],
      isLocked,
      speciesId,
      traits,
      bornNearAttractor,
    };
  }

  /**
   * Parses an entire array buffer into an array of PhaseAgentMinimal objects.
   * Note: For very large populations, you may want to parse lazily or use typed arrays directly.
   */
  static parseAll(
    buffer: ArrayBuffer | Uint8Array,
    count?: number,
  ): PhaseAgentMinimal[] {
    let view: DataView;
    if (buffer instanceof Uint8Array) {
      view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      view = new DataView(buffer);
    }

    const maxAgents = Math.floor(view.byteLength / this.BYTES_PER_AGENT);
    const parseCount = count !== undefined
      ? Math.min(count, maxAgents)
      : maxAgents;

    const agents: PhaseAgentMinimal[] = [];
    for (let i = 0; i < parseCount; i++) {
      agents.push(this.parse(view, i * this.BYTES_PER_AGENT));
    }
    return agents;
  }
}

export interface SignalStore {
  dirtyFlags: number;
  absoluteTick: number;
  activeAgentCount: number;
  maxCells: number;
}

export class SignalStoreParser {
  static readonly BYTES = 16;

  static parse(view: DataView, byteOffset: number): SignalStore {
    return {
      dirtyFlags: view.getUint32(byteOffset + 0, true),
      absoluteTick: view.getUint32(byteOffset + 4, true), // maps to proper_time.causal_ticks
      activeAgentCount: view.getUint32(byteOffset + 16, true), // past ProperTime (4+12=16)
      maxCells: view.getUint32(byteOffset + 20, true),
    };
  }
}
