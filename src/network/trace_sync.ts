// 🌌 OMEGA-64: Era 1270 — Cross-Substrate Trace Sync
//
// Era 1260 lets a single relay archive its own frame log and replay
// any window through the observability stack. But each relay only
// observed frames that physically reached it. Two relays observing
// overlapping mesh segments hold partially-overlapping logs.
//
// Era 1270 defines the merge protocol: when relay-A and relay-B want
// to reconstruct an incident from BOTH their viewpoints, they exchange
// their RecordedFrames and merge them by deterministic dedup. The
// merged log replays through any observer to yield a more complete
// forensic reconstruction than either relay alone.
//
// THE INVARIANT: merge(A, B) is deterministic — both relays computing
// the merge from the same inputs get byte-identical merged logs.
// Order is established by `received_at_ms` first, then by frame
// content (FNV-1a tiebreaker over the 32-byte frame).
//
// DEDUP RULE: a frame appears once per relay-tuple (delivered_by,
// received_at_ms, content_hash). The same frame physically observed
// by two relays at different times remains TWO records — they are
// distinct "observations of the same event", and forensics often
// cares about which relay saw what when.

import { fnv1a32 } from "./cross_model_debate.ts";
import {
    FrameRecorder,
    RecordedFrame,
} from "./frame_recorder.ts";
import {
    SporeFrame,
    frameToBytes,
} from "./spore_frame.ts";

/** Compute a stable hash over (frame_bytes, delivered_by, received_at_ms). */
export function observationHash(rec: RecordedFrame): number {
    const frame_bytes = frameToBytes(rec.frame);
    const enc = new TextEncoder();
    const by_bytes = enc.encode(rec.delivered_by);
    // 32 frame + delivered_by + 4 timestamp bytes.
    const buf = new Uint8Array(32 + by_bytes.length + 4);
    buf.set(frame_bytes, 0);
    buf.set(by_bytes, 32);
    const t = rec.received_at_ms >>> 0;
    buf[32 + by_bytes.length + 0] = (t >>> 24) & 0xFF;
    buf[32 + by_bytes.length + 1] = (t >>> 16) & 0xFF;
    buf[32 + by_bytes.length + 2] = (t >>> 8) & 0xFF;
    buf[32 + by_bytes.length + 3] = t & 0xFF;
    return fnv1a32(buf);
}

/** Result of a merge operation. */
export interface MergeResult {
    /** All unique observations, sorted deterministically. */
    merged: RecordedFrame[];
    /** Hashes that appeared in both inputs (overlap signal). */
    shared_hashes: number[];
    /** Hashes only in source A. */
    a_only: number[];
    /** Hashes only in source B. */
    b_only: number[];
}

/**
 * Merge two frame log slices into a deterministic, deduplicated
 * sequence. Sort key: received_at_ms ascending, then observation
 * hash ascending (for total order even with simultaneous arrivals).
 */
export function mergeTraces(
    a: ReadonlyArray<RecordedFrame>,
    b: ReadonlyArray<RecordedFrame>,
): MergeResult {
    const a_hashes = new Map<number, RecordedFrame>();
    for (const r of a) a_hashes.set(observationHash(r), r);
    const b_hashes = new Map<number, RecordedFrame>();
    for (const r of b) b_hashes.set(observationHash(r), r);

    const all_hashes = new Map<number, RecordedFrame>();
    const shared: number[] = [];
    const a_only: number[] = [];
    const b_only: number[] = [];

    for (const [h, r] of a_hashes) {
        all_hashes.set(h, r);
        if (b_hashes.has(h)) shared.push(h);
        else a_only.push(h);
    }
    for (const [h, r] of b_hashes) {
        if (!all_hashes.has(h)) {
            all_hashes.set(h, r);
            b_only.push(h);
        }
    }

    const merged: { hash: number; rec: RecordedFrame }[] =
        [...all_hashes].map(([hash, rec]) => ({ hash, rec }));
    // Sort: timestamp asc, then hash asc for deterministic tie-break.
    merged.sort((x, y) => {
        if (x.rec.received_at_ms !== y.rec.received_at_ms) {
            return x.rec.received_at_ms - y.rec.received_at_ms;
        }
        return x.hash - y.hash;
    });

    return {
        merged: merged.map(x => x.rec),
        shared_hashes: shared.sort((x, y) => x - y),
        a_only: a_only.sort((x, y) => x - y),
        b_only: b_only.sort((x, y) => x - y),
    };
}

/**
 * Merge any number of recorders' snapshots, in pairs, accumulating.
 * Useful when ≥3 relays cooperate on incident reconstruction.
 */
export function mergeMany(
    recorders: ReadonlyArray<FrameRecorder>,
): MergeResult {
    if (recorders.length === 0) {
        return { merged: [], shared_hashes: [], a_only: [], b_only: [] };
    }
    if (recorders.length === 1) {
        const snap = recorders[0].snapshot();
        const all = snap.map(observationHash);
        return {
            merged: snap.sort((a, b) => a.received_at_ms - b.received_at_ms),
            shared_hashes: [],
            a_only: all.sort((x, y) => x - y),
            b_only: [],
        };
    }
    let acc = recorders[0].snapshot();
    let shared_total: number[] = [];
    for (let i = 1; i < recorders.length; i++) {
        const result = mergeTraces(acc, recorders[i].snapshot());
        acc = result.merged;
        shared_total = [...new Set([...shared_total, ...result.shared_hashes])];
    }
    return {
        merged: acc,
        shared_hashes: shared_total.sort((x, y) => x - y),
        a_only: [],
        b_only: [],
    };
}

/**
 * Build a fresh FrameRecorder from a merge result. The merged
 * recorder can then be passed to `replayWindow` for unified
 * forensic reconstruction.
 */
export function recorderFromMerge(
    result: MergeResult,
    capacity?: number,
): FrameRecorder {
    const cap = capacity ?? Math.max(result.merged.length, 1);
    const r = new FrameRecorder({ capacity: cap });
    for (const rec of result.merged) {
        r.record(rec.frame, rec.received_at_ms, rec.delivered_by);
    }
    return r;
}

/**
 * Compute coverage statistics for a merge: what fraction of total
 * unique observations did each input contribute?
 */
export interface CoverageStats {
    total_unique: number;
    shared: number;
    a_only: number;
    b_only: number;
    /** shared / total_unique — high overlap means relays saw similar mesh segments. */
    overlap_ratio: number;
    /** unique to A / total — A's exclusive contribution. */
    a_exclusive_ratio: number;
    /** unique to B / total — B's exclusive contribution. */
    b_exclusive_ratio: number;
}

export function coverageStats(result: MergeResult): CoverageStats {
    const total = result.merged.length;
    if (total === 0) {
        return {
            total_unique: 0, shared: 0, a_only: 0, b_only: 0,
            overlap_ratio: 0, a_exclusive_ratio: 0, b_exclusive_ratio: 0,
        };
    }
    return {
        total_unique: total,
        shared: result.shared_hashes.length,
        a_only: result.a_only.length,
        b_only: result.b_only.length,
        overlap_ratio: result.shared_hashes.length / total,
        a_exclusive_ratio: result.a_only.length / total,
        b_exclusive_ratio: result.b_only.length / total,
    };
}
