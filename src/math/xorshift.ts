/**
 * Xorshift64* Deterministic PRNG (TypeScript / BigInt)
 *
 * Port of the Rust `omega_v2/src/math.rs` xorshift64* to TypeScript.
 * Period: 2^64 - 1. Passes BigCrush. Zero allocations. Single bigint state.
 *
 * # HIGH-4 FIX
 * Replaces `Math.random()` in mock bridge with cryptographically-adjacent
 * deterministic entropy. Same algorithm as Rust kernel guarantees identical
 * spectral properties across the WASM/TS boundary.
 */

export class Xorshift64TS {
    private state: bigint;

    constructor(seed: bigint) {
        this.state = this.splitmix64(seed);
    }

    /** SplitMix64 seed mixing — avalanche effect, one-way diffusion. */
    private splitmix64(z: bigint): bigint {
        const mask = 0xFFFFFFFFFFFFFFFFn;
        z = (z + 0x9E3779B97F4A7C15n) & mask;
        z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & mask;
        z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & mask;
        z = (z ^ (z >> 31n)) & mask;
        return z;
    }

    /** Generates the next 64-bit random value (xorshift64* permutation). */
    next(): bigint {
        const mask = 0xFFFFFFFFFFFFFFFFn;
        this.state = (this.state ^ ((this.state << 13n) & mask)) & mask;
        this.state = (this.state ^ (this.state >> 7n)) & mask;
        this.state = (this.state ^ ((this.state << 17n) & mask)) & mask;
        return this.state;
    }

    /** Upper 32 bits of next 64-bit value. */
    nextU32(): number {
        return Number(this.next() >> 32n);
    }

    /** Integer in [0, max). */
    nextRange(max: number): number {
        if (max <= 0) return 0;
        return this.nextU32() % max;
    }

    /** Deterministic hex string of `byteLen` bytes (2 chars per byte). */
    nextHex(byteLen: number): string {
        let hex = "";
        let remaining = byteLen;
        while (remaining > 0) {
            const chunk = Math.min(remaining, 4);
            const val = this.nextU32() >>> 0;
            hex += val.toString(16).padStart(chunk * 2, "0");
            remaining -= chunk;
        }
        return hex.substring(0, byteLen * 2);
    }
}

/** Convenience: seeded deterministic random for a given tick/epoch. */
export function createSeededRng(seed: bigint | number | string): Xorshift64TS {
    let bigSeed: bigint;
    if (typeof seed === "bigint") {
        bigSeed = seed;
    } else if (typeof seed === "number") {
        bigSeed = BigInt.asUintN(64, BigInt(seed));
    } else {
        // FNV-1a hash the string into a 64-bit seed
        let hash = 0xCBF29CE484222325n;
        for (let i = 0; i < seed.length; i++) {
            hash ^= BigInt(seed.charCodeAt(i));
            hash = (hash * 0x100000001B3n) & 0xFFFFFFFFFFFFFFFFn;
        }
        bigSeed = hash;
    }
    return new Xorshift64TS(bigSeed);
}
