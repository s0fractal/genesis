// DIPOLE Accounting (pure, testable)
//
// Extracted from `libp2p_mesh.ts` so the verified-proof odometer can live on
// the unit-test surface — the mesh class itself is unimportable in Deno
// tests (native WebRTC dependency chain), which is exactly why
// `verifiedDipoleCount` spent its entire life at 0: the increment path was
// never wired AND never tested.
//
// A DIPOLE plasmid announces a lattice birth (mitosis). It is trustworthy
// iff the announced child re-derives bit-for-bit from (parent, attractors,
// qPhase) via the same pure function the Rust kernel uses — see
// `mitosis_proof.ts` (cross-language anchored in
// `omega_v2/tests/mitosis_anchor.rs`).

import {
  AgentMinimal,
  AttractorEntry,
  deriveMitosisChild,
} from "./mitosis_proof.ts";

/** Structural minimum of a DIPOLE plasmid (matches PlasmidPayload fields). */
export interface DipoleAnnouncement {
  parent?: AgentMinimal;
  claimedChild?: AgentMinimal;
  attractors?: AttractorEntry[];
  qPhase?: number;
  receiptHash?: string;
}

/**
 * Local verification of a mitosis-proof bundle.
 * Returns true iff the announced child re-derives bit-for-bit from
 * (parent, attractors, qPhase). When every field matches, the receipt hash
 * is guaranteed to match as well (it is a pure function of the child), so
 * the async hash recomputation is skipped.
 */
export function verifyDipoleAnnouncement(d: DipoleAnnouncement): boolean {
  if (!d.parent || !d.claimedChild || d.qPhase === undefined) return false;
  const derived = deriveMitosisChild(d.parent, d.attractors ?? [], d.qPhase);
  if (derived.phase !== d.claimedChild.phase) return false;
  if (derived.energy !== d.claimedChild.energy) return false;
  if (derived.base_freq !== d.claimedChild.base_freq) return false;
  if (derived.state_flags !== d.claimedChild.state_flags) return false;
  if (derived.genome !== d.claimedChild.genome) return false;
  if (derived.memory[0] !== d.claimedChild.memory[0]) return false;
  if (derived.memory[1] !== d.claimedChild.memory[1]) return false;
  if (derived.memory[2] !== d.claimedChild.memory[2]) return false;
  return true;
}

/**
 * Counts unique, successfully verified DIPOLE announcements.
 * The same birth can arrive from several forwarding peers (or from the
 * local enqueue path AND the wire), so each unique receipt counts ONCE.
 */
export class DipoleAccountant {
  private seen: Set<string> = new Set();
  /** Genesis odometer: unique verified mitosis proofs. */
  public verifiedCount = 0;

  /**
   * Verify + account for one announcement.
   * Returns "counted" | "duplicate" | "invalid".
   */
  process(d: DipoleAnnouncement): "counted" | "duplicate" | "invalid" {
    if (!verifyDipoleAnnouncement(d)) return "invalid";
    const key = d.receiptHash ??
      `${d.parent?.genome}:${d.claimedChild?.genome}:${d.qPhase}`;
    if (this.seen.has(key)) return "duplicate";
    this.seen.add(key);
    // Bound memory: on overflow keep the newest half of the window.
    if (this.seen.size > 512) {
      this.seen = new Set(Array.from(this.seen).slice(-256));
    }
    this.verifiedCount++;
    return "counted";
  }
}
