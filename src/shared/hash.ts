/**
 * OMEGA-64 | Deterministic Structural Identity
 * 
 * Guarantees cross-platform perfect deterministic hashing of strings into 64-bit semantic IDs.
 * Utilizes the 64-bit FNV-1a algorithm for high collision resistance on small intent phrases.
 */

const FNV_PRIME_64 = 1099511628211n;
const FNV_OFFSET_BASIS_64 = 14695981039346656037n;

export function fnv1a_64(str: string): bigint {
    let hash = FNV_OFFSET_BASIS_64;
    for (let i = 0; i < str.length; i++) {
        hash ^= BigInt(str.charCodeAt(i));
        // Use BigInt.asUintN to strictly bound to 64-bit multiplication overflow boundaries mimicking Rust u64
        hash = BigInt.asUintN(64, hash * FNV_PRIME_64);
    }
    return hash;
}
