/**
 * OMEGA-64 | Deterministic Structural Identity
 * 
 * Guarantees cross-platform perfect deterministic hashing of strings into 64-bit semantic IDs.
 * Utilizes the 64-bit FNV-1a algorithm for high collision resistance on small intent phrases.
 */

import { FNV64_OFFSET_BASIS, FNV64_PRIME } from "./constants.ts";

export function fnv1a_64(str: string): bigint {
    let hash = FNV64_OFFSET_BASIS;
    for (let i = 0; i < str.length; i++) {
        hash ^= BigInt(str.charCodeAt(i));
        // Use BigInt.asUintN to strictly bound to 64-bit multiplication overflow boundaries mimicking Rust u64
        hash = BigInt.asUintN(64, hash * FNV64_PRIME);
    }
    return hash;
}
