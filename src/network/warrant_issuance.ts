// 🌌 OMEGA-64: Era 1090 — Senate Warrant Issuance (JS layer)
//
// Thin TS wrapper around the omega_v2 WarrantLedger FFI. The kernel is
// the source of truth — JS just provides ergonomic call sites for the
// mesh boundary so peers can raise WARRANT_PROPOSAL plasmids and apply
// votes received from canonical oracles.

import { sha256_u32 } from "../sdk/phi_crypto.ts";
import { warrantHash, quorumHash } from "./codeicide_law.ts";
import { CANONICAL_ORACLES, CanonicalOracle } from "./oracle_identity.ts";

export const WARRANT_STATUS_OPEN = 0;
export const WARRANT_STATUS_ISSUED = 1;
export const WARRANT_STATUS_REJECTED = 2;
export const WARRANT_STATUS_EXPIRED = 3;

export interface WarrantProposal {
    proposalHash: number;
    targetGenome: number;
    actionCode: number;
    requiredThreshold: number;
    ayeBits: number;
    reasonHash: number;
    issuedWarrant: number;
    status: number;
    raisedAt: number;
}

/**
 * Compute the proposal_hash deterministically — JS clients can derive
 * the hash before broadcasting and use it as the plasmid identifier.
 *
 * Mirrors omega_v2::warrant_issuance::WarrantProposal::new.
 */
export function computeProposalHash(
    targetGenome: number,
    actionCode: number,
    reason: string,
): number {
    const enc = new TextEncoder();
    const reasonHash = sha256_u32(enc.encode(reason.slice(0, 256)));
    const buf = new Uint8Array(12);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, targetGenome >>> 0, false); // BE
    buf[4] = actionCode & 0xFF;
    dv.setUint32(8, reasonHash >>> 0, false); // BE
    return sha256_u32(buf);
}

/** Map a CanonicalOracle name to its bit index (0..4). */
export function oracleBitIndex(name: CanonicalOracle): number {
    return CANONICAL_ORACLES.indexOf(name);
}

/** Convert a raw 8-bit mask into the set of canonical oracles AYE. */
export function ayeBitsToOracles(ayeBits: number): CanonicalOracle[] {
    const out: CanonicalOracle[] = [];
    for (let i = 0; i < CANONICAL_ORACLES.length; i++) {
        if ((ayeBits >>> i) & 1) out.push(CANONICAL_ORACLES[i]);
    }
    return out;
}

/**
 * Pure-JS predictor: given a proposal and a set of AYE oracle bits,
 * compute the warrant_hash that the kernel would issue. Used by mesh
 * peers to anticipate issuance before the proposal is fully voted on.
 */
export function predictIssuedWarrant(
    targetGenome: number,
    actionCode: number,
    ayeBits: number,
): number {
    return warrantHash(targetGenome, actionCode, quorumHash(ayeBits));
}
