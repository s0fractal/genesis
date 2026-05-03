/**
 * Φ-SDK: Deterministic Cryptography
 * Read-only re-implementation of OMEGA-64 WASM hash functions for external clients.
 */
import { PhaseAgentMinimal, PhaseAgentParser } from './phi_types.ts';

/**
 * Calculates the exact Golden Trace hash from an array buffer representing `PhaseAgentMinimal` memory.
 * This exactly mirrors `get_golden_trace()` in `lattice.rs`.
 * 
 * @param buffer The binary array buffer containing agent data.
 * @param activeAgentCount The number of currently alive agents (from SignalStore).
 * @returns Unsigned 32-bit integer representing the deterministic mesh hash.
 */
export function calculateGoldenTrace(buffer: ArrayBuffer | Uint8Array, activeAgentCount: number): number {
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
        hash = ((hash + phase) | 0);
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
