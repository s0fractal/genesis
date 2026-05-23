// Phase 2 — JS reader for the WASM mitosis log.

// Reads the static MitosisLog ring buffer in WASM memory and exposes the
// receipts JS hasn't seen yet. The pointer is zero-copy: we treat the
// underlying ArrayBuffer as the single source of truth.

import { AgentMinimal, AttractorEntry } from "./mitosis_proof.ts";

export const MITOSIS_LOG_CAPACITY = 32;
export const MITOSIS_RECEIPT_SIZE = 192;
const MITOSIS_LOG_HEADER = 16;

export interface MitosisReceipt {
  parent: AgentMinimal;
  child: AgentMinimal;
  attractors: AttractorEntry[];
  qPhase: number;
  receiptHash: string;
  tick: number;
  entropyDelta: number;
  metabolicCost: number;
}

function readAgent(view: DataView, offset: number): AgentMinimal {
  return {
    phase: view.getUint32(offset + 0, true),
    energy: view.getUint32(offset + 4, true),
    base_freq: view.getInt32(offset + 8, true),
    state_flags: view.getUint32(offset + 12, true),
    genome: view.getUint32(offset + 16, true),
    memory: [
      view.getUint32(offset + 20, true),
      view.getUint32(offset + 24, true),
      view.getUint32(offset + 28, true),
    ],
  };
}

function readAttractors(view: DataView, offset: number): AttractorEntry[] {
  // AttractorArray: count(4) + _pad(12) + 4 × AttractorMatrix(16).
  const count = Math.min(view.getUint32(offset + 0, true), 4);
  const out: AttractorEntry[] = [];
  for (let i = 0; i < count; i++) {
    const base = offset + 16 + i * 16;
    out.push({
      matrix: view.getUint32(base + 0, true),
      inverse: view.getUint32(base + 4, true),
      pulse_freq: view.getUint32(base + 8, true),
      pulse_amp: view.getUint32(base + 12, true),
    });
  }
  return out;
}

/**
 * Drain new receipts from the WASM log since `lastSeen`.
 * Returns the receipts and the new `lastSeen` (== current total_written).
 *
 * Loss policy: if the writer overran more than CAPACITY entries past
 * `lastSeen`, we silently skip the missed range and only return the
 * latest CAPACITY receipts. This matches Rust `MitosisLog::get`.
 */
export function drainMitosisLog(
  logBytes: Uint8Array,
  lastSeen: number,
): { receipts: MitosisReceipt[]; nowSeen: number } {
  const view = new DataView(
    logBytes.buffer,
    logBytes.byteOffset,
    logBytes.byteLength,
  );
  const head = view.getUint32(0, true);
  const totalWritten = view.getUint32(4, true);

  if (totalWritten === lastSeen) {
    return { receipts: [], nowSeen: totalWritten };
  }

  const earliest = totalWritten > MITOSIS_LOG_CAPACITY
    ? totalWritten - MITOSIS_LOG_CAPACITY
    : 0;
  const startIdx = Math.max(lastSeen, earliest);
  const receipts: MitosisReceipt[] = [];

  for (let idx = startIdx; idx < totalWritten; idx++) {
    const lookback = totalWritten - idx;
    if (lookback > MITOSIS_LOG_CAPACITY) continue;
    // head points to the NEXT slot; latest entry is at (head - 1).
    let slot = (head - lookback) % MITOSIS_LOG_CAPACITY;
    if (slot < 0) slot += MITOSIS_LOG_CAPACITY;
    const off = MITOSIS_LOG_HEADER + slot * MITOSIS_RECEIPT_SIZE;

    const hashBytes = new Uint8Array(
      logBytes.buffer,
      logBytes.byteOffset + off + 148,
      32,
    );
    let hashHex = "";
    for (let i = 0; i < 32; i++) {
      hashHex += hashBytes[i].toString(16).padStart(2, "0");
    }

    receipts.push({
      parent: readAgent(view, off + 0),
      child: readAgent(view, off + 32),
      attractors: readAttractors(view, off + 64),
      qPhase: view.getUint32(off + 144, true),
      receiptHash: hashHex,
      tick: view.getUint32(off + 180, true),
      entropyDelta: view.getInt32(off + 184, true),
      metabolicCost: view.getUint32(off + 188, true),
    });
  }

  return { receipts, nowSeen: totalWritten };
}
