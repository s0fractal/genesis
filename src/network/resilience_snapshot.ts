// 🌌 OMEGA-64: Era 1190 — Resilience Snapshot Export (JS mirror)
//
// Pure-TS port of `omega_v2::resilience_snapshot`. Used by browser/
// Deno relays to broadcast their own ConvergenceDetector stats and
// to ingest peer relays' snapshots for partition detection.

import { sha256_u32 } from "../sdk/phi_crypto.ts";
import { ConvergenceDetector } from "./convergence_detector.ts";

export const SNAPSHOT_BYTES = 32;
export const SNAPSHOT_MAGIC = 0x5253; // "RS"
export const SNAPSHOT_VERSION_V1 = 1;
export const PARTITION_DIFF_THRESHOLD_Q16 = 6553;

export interface ResilienceSnapshot {
    magic: number;
    version: number;
    reserved: number;
    totalIntents: number;
    singleWitness: number;
    doubleWitness: number;
    triplePlus: number;
    redundancyRateQ16: number;
    provenCarrierCount: number;
    crc32: number;
}

function writeU32BE(buf: Uint8Array, offset: number, value: number) {
    const v = value >>> 0;
    buf[offset]     = (v >>> 24) & 0xFF;
    buf[offset + 1] = (v >>> 16) & 0xFF;
    buf[offset + 2] = (v >>> 8)  & 0xFF;
    buf[offset + 3] = v          & 0xFF;
}

function readU32BE(buf: Uint8Array, offset: number): number {
    return (
        ((buf[offset]     << 24) >>> 0) |
        ((buf[offset + 1] << 16) >>> 0) |
        ((buf[offset + 2] << 8 ) >>> 0) |
        ( buf[offset + 3]              )
    ) >>> 0;
}

function snapshotBytesNoCrc(s: ResilienceSnapshot): Uint8Array {
    const out = new Uint8Array(SNAPSHOT_BYTES);
    out[0] = (s.magic >>> 8) & 0xFF;
    out[1] =  s.magic        & 0xFF;
    out[2] = s.version & 0xFF;
    out[3] = s.reserved & 0xFF;
    writeU32BE(out, 4,  s.totalIntents);
    writeU32BE(out, 8,  s.singleWitness);
    writeU32BE(out, 12, s.doubleWitness);
    writeU32BE(out, 16, s.triplePlus);
    writeU32BE(out, 20, s.redundancyRateQ16);
    writeU32BE(out, 24, s.provenCarrierCount);
    return out;
}

export function computeSnapshotCrc(s: ResilienceSnapshot): number {
    return sha256_u32(snapshotBytesNoCrc(s).subarray(0, 28));
}

export function snapshotFromCounts(
    totalIntents: number,
    singleWitness: number,
    doubleWitness: number,
    triplePlus: number,
    provenCarrierCount: number,
): ResilienceSnapshot {
    let q16 = 0;
    if (totalIntents > 0) {
        // Round-half-up to match Rust's integer math.
        const scaled = (doubleWitness >>> 0) * 65536;
        const half = (totalIntents >>> 0) >> 1;
        q16 = Math.floor((scaled + half) / totalIntents) >>> 0;
    }
    const s: ResilienceSnapshot = {
        magic: SNAPSHOT_MAGIC,
        version: SNAPSHOT_VERSION_V1,
        reserved: 0,
        totalIntents: totalIntents >>> 0,
        singleWitness: singleWitness >>> 0,
        doubleWitness: doubleWitness >>> 0,
        triplePlus: triplePlus >>> 0,
        redundancyRateQ16: q16,
        provenCarrierCount: provenCarrierCount >>> 0,
        crc32: 0,
    };
    s.crc32 = computeSnapshotCrc(s);
    return s;
}

/** Build a snapshot from a ConvergenceDetector's current state. */
export function snapshotFromDetector(cd: ConvergenceDetector): ResilienceSnapshot {
    const stats = cd.stats();
    const carriers = cd.proven_carriers();
    return snapshotFromCounts(
        stats.total_intents,
        stats.single_witness,
        stats.double_witness,
        stats.triple_plus_witness,
        carriers.length,
    );
}

export function snapshotToBytes(s: ResilienceSnapshot): Uint8Array {
    const out = snapshotBytesNoCrc(s);
    const crc = sha256_u32(out.subarray(0, 28));
    writeU32BE(out, 28, crc);
    return out;
}

export function snapshotFromBytes(buf: Uint8Array): ResilienceSnapshot | null {
    if (buf.length < SNAPSHOT_BYTES) return null;
    const magic = (buf[0] << 8) | buf[1];
    if (magic !== SNAPSHOT_MAGIC) return null;
    const version = buf[2];
    if (version !== SNAPSHOT_VERSION_V1) return null;
    const s: ResilienceSnapshot = {
        magic,
        version,
        reserved: buf[3],
        totalIntents:        readU32BE(buf, 4),
        singleWitness:       readU32BE(buf, 8),
        doubleWitness:       readU32BE(buf, 12),
        triplePlus:          readU32BE(buf, 16),
        redundancyRateQ16:   readU32BE(buf, 20),
        provenCarrierCount:  readU32BE(buf, 24),
        crc32:               readU32BE(buf, 28),
    };
    if (computeSnapshotCrc(s) !== s.crc32) return null;
    return s;
}

/** Absolute difference in redundancy rate, Q16 units. */
export function redundancyRateDiffQ16(
    a: ResilienceSnapshot,
    b: ResilienceSnapshot,
): number {
    return Math.abs(a.redundancyRateQ16 - b.redundancyRateQ16);
}

/** True iff the absolute Q16 difference exceeds the partition threshold. */
export function isPartitionDetected(
    a: ResilienceSnapshot,
    b: ResilienceSnapshot,
    threshold: number = PARTITION_DIFF_THRESHOLD_Q16,
): boolean {
    return redundancyRateDiffQ16(a, b) >= threshold;
}

/** Convert Q16 rate to a human-readable percentage string. */
export function rateAsPercent(q16: number): string {
    return ((q16 / 65536) * 100).toFixed(2) + "%";
}
