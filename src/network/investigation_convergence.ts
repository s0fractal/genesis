// 🌌 OMEGA-64: Era 1220 — Cross-Relay Investigation Convergence
//
// Era 1210's deterministic proposal_hash means that two relays observing
// the same partition independently raise BYTE-IDENTICAL warrants. The
// Senate's WarrantLedger naturally dedups them — but the fact that N
// distinct relays converged on the SAME suspicion is itself a stronger
// signal than any single relay's alarm.
//
// Era 1220 surfaces that convergence as a first-class metric. Each
// proposal_hash accumulates a `corroboration_count` — how many distinct
// relays raised it. When corroboration ≥ threshold (default 3), the
// proposal is flagged "high-confidence"; even before oracle ratification,
// operators can see "3 relays independently agreed this target is
// suspect" — a much louder signal than "1 relay alarmed".
//
// SECURITY: corroboration_count is OBSERVABLE-only. A malicious relay
// can fake its own raise, but it cannot fake the existence of N OTHER
// relays raising the same hash. Convergence proves multiple distinct
// observers reached the same conclusion through their independent
// PartitionAlarm streams.

import { InvestigationRecord } from "./auto_investigation.ts";

export interface CorroboratedRecord {
    proposal_hash: number;
    target_relay_id: number;
    /** Number of DISTINCT raising relays that observed this proposal. */
    corroboration_count: number;
    /** IDs of the raising relays (sorted ascending for determinism). */
    raised_by: number[];
    /** First time this proposal_hash was observed (any relay). */
    first_observed_at_ms: number;
    /** Most recent time this proposal_hash was observed (any relay). */
    last_observed_at_ms: number;
    /** Maximum triggering_diff_q16 across all raising relays. */
    max_diff_q16: number;
    /** Confidence band derived from corroboration_count. */
    confidence: ConvergenceConfidence;
}

export type ConvergenceConfidence = "lone" | "double" | "triple+" | "high";

export interface ConvergenceOptions {
    /** corroboration_count ≥ this → "high" confidence. Default 3. */
    high_confidence_threshold: number;
    /** Capacity of the corroboration table (FIFO eviction). Default 256. */
    capacity: number;
    /** Optional callback fired when a record reaches high_confidence. */
    on_high_confidence?: (rec: CorroboratedRecord) => void;
}

const DEFAULT_OPTS: ConvergenceOptions = {
    high_confidence_threshold: 3,
    capacity: 256,
};

function classify(count: number, threshold: number): ConvergenceConfidence {
    if (count >= threshold) return "high";
    if (count >= 3) return "triple+";
    if (count === 2) return "double";
    return "lone";
}

/**
 * Tracks corroboration: who raised which proposal, how many times.
 *
 * Each relay observing a peer's WARRANT_PROPOSAL (typically forwarded
 * via Era 1130 or Era 1170 paths) calls `recordRaise(record, source_id)`.
 * The aggregator counts distinct source_ids per proposal_hash and
 * surfaces high-confidence records.
 */
export class InvestigationConvergenceTracker {
    private records: Map<number, CorroboratedRecord> = new Map();
    private order: number[] = [];
    private opts: ConvergenceOptions;

    constructor(opts: Partial<ConvergenceOptions> = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
        if (this.opts.high_confidence_threshold < 2) {
            throw new Error("high_confidence_threshold must be ≥ 2");
        }
    }

    /**
     * Record that `source_relay_id` raised `record`. Returns the
     * (possibly updated) corroborated record.
     *
     * Same-source duplicates are idempotent: a relay raising the same
     * proposal_hash twice doesn't double-count itself.
     */
    recordRaise(record: InvestigationRecord, source_relay_id: number, now_ms: number): CorroboratedRecord {
        const hash = record.proposal_hash >>> 0;
        const source = source_relay_id >>> 0;
        let corroborated = this.records.get(hash);
        if (!corroborated) {
            corroborated = {
                proposal_hash: hash,
                target_relay_id: record.target_relay_id >>> 0,
                corroboration_count: 1,
                raised_by: [source],
                first_observed_at_ms: now_ms,
                last_observed_at_ms: now_ms,
                max_diff_q16: record.triggering_diff_q16 >>> 0,
                confidence: classify(1, this.opts.high_confidence_threshold),
            };
            this.records.set(hash, corroborated);
            this.order.push(hash);
            if (this.order.length > this.opts.capacity) {
                const evicted = this.order.shift()!;
                this.records.delete(evicted);
            }
            return corroborated;
        }
        // Existing record — update.
        corroborated.last_observed_at_ms = now_ms;
        if ((record.triggering_diff_q16 >>> 0) > corroborated.max_diff_q16) {
            corroborated.max_diff_q16 = record.triggering_diff_q16 >>> 0;
        }
        if (!corroborated.raised_by.includes(source)) {
            corroborated.raised_by.push(source);
            corroborated.raised_by.sort((a, b) => a - b);
            corroborated.corroboration_count = corroborated.raised_by.length;
            const new_class = classify(
                corroborated.corroboration_count,
                this.opts.high_confidence_threshold,
            );
            const was_high = corroborated.confidence === "high";
            corroborated.confidence = new_class;
            if (!was_high && new_class === "high") {
                this.opts.on_high_confidence?.(corroborated);
            }
        }
        return corroborated;
    }

    /** Returns the corroborated record for a given proposal_hash, or undefined. */
    get(proposal_hash: number): CorroboratedRecord | undefined {
        return this.records.get(proposal_hash >>> 0);
    }

    /** All currently-tracked records, sorted by corroboration desc / first_observed asc. */
    list(): CorroboratedRecord[] {
        return [...this.records.values()].sort((a, b) => {
            if (b.corroboration_count !== a.corroboration_count) {
                return b.corroboration_count - a.corroboration_count;
            }
            return a.first_observed_at_ms - b.first_observed_at_ms;
        });
    }

    /** Records currently at high confidence. */
    highConfidenceRecords(): CorroboratedRecord[] {
        return this.list().filter(r => r.confidence === "high");
    }

    /**
     * Returns target_relay_ids whose proposals have reached high
     * confidence — the "consensus suspicion" set. Operators may treat
     * these as automatic candidates for SOFT pre-emptive deprioritization
     * even before the Senate ratifies (the Senate gate still controls
     * actual quarantine via Era 1210).
     */
    consensusSuspectTargets(): number[] {
        return [...new Set(this.highConfidenceRecords().map(r => r.target_relay_id))]
            .sort((a, b) => a - b);
    }

    /** Total number of distinct proposal_hashes tracked. */
    size(): number {
        return this.records.size;
    }

    /** Test/reset helper. */
    clear(): void {
        this.records.clear();
        this.order = [];
    }
}
