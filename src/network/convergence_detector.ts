// 🌌 OMEGA-64: Era 1180 — Convergence Detection
//
// When Era 1170 duplicates a WARRANT_VOTE along two disjoint paths,
// the destination's DedupWindow catches the second arrival and discards
// it. Era 1180 elevates that "second arrival caught" event into a
// first-class resilience signal: a "double-witness" log entry that
// proves both paths actually delivered the same intent.
//
// WHY THIS MATTERS:
//   - Single-witness: the vote arrived. The mesh probably works.
//   - Double-witness: the vote arrived TWICE via DISJOINT paths. The
//                     mesh definitely works AND has redundancy headroom.
//
// The double-witness rate is an emergent network health metric. A high
// rate means duplication is doing its job; a low rate means either
// duplication isn't being attempted (fewer disjoint paths available)
// or the secondary paths are losing more frames than primary ones.
//
// Witnesses are stored in a bounded ring buffer keyed by dedup-key, so
// older convergence events naturally age out as new ones arrive.

import { dedupKey } from "./path_diversification.ts";
import { SporeFrame } from "./spore_frame.ts";

export type WitnessClass = "single" | "double" | "triple+";

export interface WitnessRecord {
    /** FNV-1a intent key (matches DedupWindow / path_diversification). */
    key: number;
    /** When the FIRST copy was seen. */
    first_seen_at_ms: number;
    /** When the LAST copy was seen (== first if single-witness). */
    last_seen_at_ms: number;
    /** How many copies have arrived so far. */
    copies: number;
    /** Class derived from `copies`. */
    witness_class: WitnessClass;
    /** The frame_type of the first arrival (informational). */
    frame_type: number;
    /** Spore IDs that delivered each copy (for trail-aware analytics). */
    delivered_by: string[];
}

export interface ConvergenceStats {
    total_intents: number;
    single_witness: number;
    double_witness: number;
    triple_plus_witness: number;
    /** double / total — the headline resilience number. */
    redundancy_rate: number;
}

function classify(copies: number): WitnessClass {
    if (copies <= 1) return "single";
    if (copies === 2) return "double";
    return "triple+";
}

/**
 * Tracks per-intent witness counts. The originator never sees this —
 * it's a destination-side metric exposed by the relay's HUD.
 */
export class ConvergenceDetector {
    private records: Map<number, WitnessRecord> = new Map();
    private order: number[] = [];

    constructor(public capacity: number = 512) {
        if (capacity < 1) throw new Error("capacity must be ≥ 1");
    }

    /**
     * Observe an arrival. `delivered_by` is the spore_id that handed
     * us this copy (typically derived from the frame's trail digest
     * or the immediate sender's UART/SPI link identifier).
     *
     * Returns the witness record AFTER this arrival is recorded.
     */
    observe(
        frame: SporeFrame,
        delivered_by: string,
        now_ms: number,
    ): WitnessRecord {
        const key = dedupKey(frame);
        let rec = this.records.get(key);
        if (!rec) {
            rec = {
                key,
                first_seen_at_ms: now_ms,
                last_seen_at_ms: now_ms,
                copies: 1,
                witness_class: "single",
                frame_type: frame.frameType,
                delivered_by: [delivered_by],
            };
            this.records.set(key, rec);
            this.order.push(key);
            if (this.order.length > this.capacity) {
                const evicted = this.order.shift()!;
                this.records.delete(evicted);
            }
            return rec;
        }
        rec.last_seen_at_ms = now_ms;
        rec.copies += 1;
        rec.witness_class = classify(rec.copies);
        if (!rec.delivered_by.includes(delivered_by)) {
            rec.delivered_by.push(delivered_by);
        }
        return rec;
    }

    /** Returns true iff this intent already has a record. */
    has(key: number): boolean {
        return this.records.has(key);
    }

    /** Read a record by key without modifying it. */
    get(key: number): WitnessRecord | undefined {
        return this.records.get(key);
    }

    /**
     * Aggregated stats across the current window. Useful for HUD
     * panels and operator alarms.
     */
    stats(): ConvergenceStats {
        let total = 0, single = 0, double = 0, triple = 0;
        for (const rec of this.records.values()) {
            total += 1;
            if (rec.witness_class === "single") single += 1;
            else if (rec.witness_class === "double") double += 1;
            else triple += 1;
        }
        const redundancy_rate = total === 0 ? 0 : double / total;
        return {
            total_intents: total,
            single_witness: single,
            double_witness: double,
            triple_plus_witness: triple,
            redundancy_rate,
        };
    }

    /**
     * Returns IDs of spores that participated in at least one
     * double-witness event — i.e. proven-good carriers.
     */
    proven_carriers(): string[] {
        const set = new Set<string>();
        for (const rec of this.records.values()) {
            if (rec.witness_class !== "single") {
                for (const id of rec.delivered_by) set.add(id);
            }
        }
        return [...set].sort();
    }

    /**
     * Returns intents that are still single-witness AFTER `stale_ms`
     * elapsed — these are candidates for retry or alarm.
     */
    stragglers(now_ms: number, stale_ms: number): WitnessRecord[] {
        const out: WitnessRecord[] = [];
        for (const rec of this.records.values()) {
            if (rec.witness_class === "single"
                && (now_ms - rec.first_seen_at_ms) >= stale_ms) {
                out.push(rec);
            }
        }
        return out;
    }

    snapshot(): WitnessRecord[] {
        return [...this.records.values()];
    }

    clear(): void {
        this.records.clear();
        this.order = [];
    }
}
