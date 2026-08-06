// Canonical Senate proposal texts and their derived keys.
//
// A proposal's identity IS its description: the key is the SHA-256→u32 of the
// text zero-padded to 64 bytes. That made the following possible, and it lived
// in the tree for a while: `bootstrap/v2.ts` held the Era-1040 description as a
// string literal, while `libp2p_mesh.ts` held its hash as an unexplained
// `0x5507_4120` literal 900 lines away. Edit one word of the description — a
// typo fix, a clarification — and auto-ratification silently stops finding the
// proposal. Nothing fails; the loop simply never closes, and the only symptom
// is an absence.
//
// So the text is the single source and the key is derived from it. The frozen
// literals below are anchors, asserted in `tests/senate_proposals_test.ts`: if
// a description changes, that test fails LOUDLY and tells the author that they
// changed a proposal's identity, which is a governance act, not an edit.

import { sha256_u32 } from "../sdk/phi_crypto.ts";

/**
 * Canonical proposal key: SHA-256→u32 over the description zero-padded to
 * exactly 64 bytes (descriptions longer than 64 bytes are truncated). Mirrors
 * `Libp2pMesh.senateHash` and the Rust senate — all three must agree, or a
 * proposer's key and a verifier's check disagree about what was voted on.
 */
export function senateHash(description: string): number {
  const buf = new Uint8Array(64);
  const raw = new TextEncoder().encode(description);
  buf.set(raw.subarray(0, 64));
  return sha256_u32(buf) >>> 0;
}

/**
 * Era 1040 → 1030, the autopoietic first proposal: the lattice asking itself to
 * notarize its own mutations. Submitted by `bootstrap/v2.ts` on the
 * `era1030-unlocked` event and self-ratified by `autoRatifyEra1040Proposal`
 * once verified mitosis proofs accumulate.
 */
export const ERA_1040_PROPOSAL =
  "ZK-Notarized Mutations — every darwinian_mitosis emits an SP1 STARK proof; peers reject mutations without a valid receipt.";

/**
 * Frozen key of ERA_1040_PROPOSAL. NOT the genesis `firstProposalHash` anchor
 * (0x30083117), which hashes a different canonical string ("Task 0090…").
 */
export const ERA_1040_PROPOSAL_HASH = 0x5507_4120;
