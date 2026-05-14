// Path Diversification

// High-priority frames (TYPE = WARRANT_VOTE — the things that change
// Senate state) get duplicated along TWO DISJOINT paths simultaneously.
// HEARTBEATs stay single-path (low priority — losing one doesn't hurt).

// At the destination, a small dedup window catches the second arrival
// and discards it without reprocessing. The dedup key is the FNV-1a
// over (frame_type || proposal_or_target || oracle_bit || tick) — bytes
// that uniquely identify the *intent* of the frame, ignoring routing
// metadata (TTL, trail digest) that legitimately differs across copies.

// PATH DISJOINTNESS RULE: two paths are disjoint iff they share no
// intermediate spore_id. The originator and the destination MAY be
// shared (they always are for a single-emit-multi-deliver pattern),
// but every middle hop must be unique.

import { ReputationScore } from "./reputation_routing.ts";
import { sha256_u32 } from "../sdk/phi_crypto.ts";
import {
    FRAME_TYPE_HEARTBEAT,
    FRAME_TYPE_WARRANT_VOTE,
    SporeFrame,
} from "./spore_frame.ts";
import { PathCandidate, rankPaths } from "./path_selection.ts";

/** Frames that warrant duplication. */
export const HIGH_PRIORITY_FRAME_TYPES: ReadonlyArray<number> = [
    FRAME_TYPE_WARRANT_VOTE,
];

/** Compute the canonical dedup key for a frame. */
export function dedupKey(f: SporeFrame): number {
    const buf = new Uint8Array(10);
    buf[0] = f.frameType & 0xFF;
    buf[1] = f.oracleBit & 0xFF;
    const dv = new DataView(buf.buffer);
    dv.setUint32(2, f.proposalOrTarget >>> 0, false);
    dv.setUint32(6, f.tick >>> 0, false);
    return sha256_u32(buf);
}

/** Returns true iff this frame deserves duplicate transmission. */
export function isHighPriority(f: SporeFrame): boolean {
    return HIGH_PRIORITY_FRAME_TYPES.includes(f.frameType);
}

/**
 * Two paths are DISJOINT iff they share no intermediate spore_id.
 * (Originator and destination are NOT in the path's `hops` array;
 * `hops` represents middle hops only by convention here.)
 */
export function pathsAreDisjoint(
    a: ReadonlyArray<ReputationScore>,
    b: ReadonlyArray<ReputationScore>,
): boolean {
    const ids = new Set(a.map(h => h.spore_id));
    return b.every(h => !ids.has(h.spore_id));
}

export interface DiversifiedPlan {
    /** Always-emitted primary path. */
    primary: PathCandidate;
    /** Optional secondary disjoint path; undefined for low-priority frames
     *  or when no disjoint candidate exists. */
    secondary: PathCandidate | undefined;
    /** True iff both paths will be used. */
    duplicated: boolean;
}

/**
 * Choose primary + (optionally) disjoint secondary from a candidate list.
 * `frame` decides whether duplication is even attempted.
 */
export function planDiversification(
    candidates: PathCandidate[],
    frame: SporeFrame,
): DiversifiedPlan {
    if (candidates.length === 0) {
        // Empty input — pathological, but return a stable shape.
        return {
            primary: { label: "empty", hops: [] },
            secondary: undefined,
            duplicated: false,
        };
    }
    const ranked = rankPaths(candidates);
    const eligible = ranked.filter(r => r.eligible);
    if (eligible.length === 0) {
        // No eligible — pick the first ranked (will be reported as
        // ineligible at the layer above). Caller decides whether to
        // emit anyway.
        return {
            primary: { label: ranked[0].label, hops: ranked[0].hops },
            secondary: undefined,
            duplicated: false,
        };
    }
    const primary = { label: eligible[0].label, hops: eligible[0].hops };
    if (!isHighPriority(frame) || eligible.length < 2) {
        return { primary, secondary: undefined, duplicated: false };
    }
    // Find the highest-efficiency disjoint candidate.
    for (let i = 1; i < eligible.length; i++) {
        if (pathsAreDisjoint(eligible[0].hops, eligible[i].hops)) {
            return {
                primary,
                secondary: { label: eligible[i].label, hops: eligible[i].hops },
                duplicated: true,
            };
        }
    }
    // No disjoint alternative — fall back to primary-only.
    return { primary, secondary: undefined, duplicated: false };
}

/**
 * Sliding-window deduplication for the destination.
 *
 * The window stores up to `capacity` recent dedup keys. When a new
 * frame arrives, `seen(key)` returns true if it's already in the
 * window (and therefore should be discarded). False entries get
 * inserted and may evict the oldest seen key once capacity fills.
 *
 * The destination is responsible for calling `seen` BEFORE applying
 * the frame's effects. After acceptance, callers MAY call `seen`
 * again with the same key (which will return true) to be sure.
 */
export class DedupWindow {
    private order: number[] = [];   // FIFO insertion order
    private set: Set<number> = new Set();
    constructor(public capacity: number = 256) {
        if (capacity < 1) throw new Error("capacity must be ≥ 1");
    }
    /** Returns true iff key is already in the window. Inserts if absent. */
    seen(key: number): boolean {
        if (this.set.has(key)) return true;
        this.set.add(key);
        this.order.push(key);
        if (this.order.length > this.capacity) {
            const evicted = this.order.shift()!;
            this.set.delete(evicted);
        }
        return false;
    }
    /** Returns true iff key is in the window WITHOUT inserting. */
    contains(key: number): boolean {
        return this.set.has(key);
    }
    size(): number {
        return this.order.length;
    }
    clear(): void {
        this.order = [];
        this.set = new Set();
    }
}
