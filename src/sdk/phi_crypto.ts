/**
 * Φ-SDK: Deterministic Cryptography
 * Read-only re-implementation of OMEGA-64 WASM hash functions for external clients.
 */
import { PhaseAgentMinimal, PhaseAgentParser } from "./phi_types.ts";

/**
 * Calculates the exact Golden Trace hash from an array buffer representing `PhaseAgentMinimal` memory.
 * This exactly mirrors `get_golden_trace()` in `lattice.rs`.
 *
 * @param buffer The binary array buffer containing agent data.
 * @param activeAgentCount The number of currently alive agents (from SignalStore).
 * @returns Unsigned 32-bit integer representing the deterministic mesh hash.
 */
export function calculateGoldenTrace(
  buffer: ArrayBuffer | Uint8Array,
  activeAgentCount: number,
): number {
  if (activeAgentCount === 0) return 0;

  let view: DataView;
  if (buffer instanceof Uint8Array) {
    view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    view = new DataView(buffer);
  }

  const skip = Math.max(1, Math.floor(activeAgentCount / 32));
  let hash = 0;

  for (let i = 0; i < activeAgentCount; i += skip) {
    const offset = i * PhaseAgentParser.BYTES_PER_AGENT;
    const phase = view.getUint32(offset + 0, true);
    const energy = view.getUint32(offset + 4, true);

    // 32-bit integer wrapping arithmetic (matches Rust wrapping_add / wrapping_mul)
    hash = (hash + phase) | 0;
    hash = Math.imul(hash, 31) | 0;
    hash = (hash ^ energy) | 0;
  }

  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Simple FNV-1a hash for string inputs (matches Deno tests / DJB2 / generic anchors).
 */
export function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Pure TS SHA-256 implementation (Synchronous)
// Needed because crypto.subtle.digest is asynchronous and we cannot pollute
// the hot-path (tick_physics, UI rendering, WebRTC) with Promises.

const K = new Uint32Array([
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
]);

function rotr(n: number, b: number) {
  return (n >>> b) | (n << (32 - b));
}

export function sha256_hash(data: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  const l = data.length;
  const bitLen = l * 8;
  const paddingLen = 64 - ((l + 8) % 64);
  const padded = new Uint8Array(l + paddingLen + 8);
  padded.set(data);
  padded[l] = 0x80;

  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);

  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j++) W[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const w15 = W[j - 15], w2 = W[j - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
    }

    let a = H[0],
      b = H[1],
      c = H[2],
      d = H[3],
      e = H[4],
      f = H[5],
      g = H[6],
      h = H[7];

    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + W[j]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outDv.setUint32(i * 4, H[i], false);
  return out;
}

export function sha256_u32(data: Uint8Array): number {
  const hash = sha256_hash(data);
  const dv = new DataView(hash.buffer);
  return dv.getUint32(0, false); // Big-endian to match Rust's sha256_u32 (from_be_bytes of first 4 bytes)
}
