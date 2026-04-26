// 🌌 OMEGA-64: Era 1290 — Quorum-Anchored Post-Mortem Reports
//
// Era 1280 produces a `QuorumResult` with a deterministic digest.
// Era 1290 makes that digest broadcastable: a relay that has
// adjudicated an alarm wraps the result in a SporeFrame
// (frame_type = 7 QUORUM_VERDICT) and broadcasts it. Other relays
// observe the frame, decode the verdict, and accumulate "who agreed
// on what digest" tallies.
//
// MULTI-PARTY AGREEMENT ON ADJUDICATION:
//   - Single relay's adjudication = one perspective.
//   - Multiple relays broadcasting the SAME digest = independent
//     adjudication agreed on identical inputs/outputs.
//   - Threshold (default ≥3 distinct adjudicators) = the verdict
//     becomes "high-confidence" for archival.
//
// This is the post-mortem analog of Era 1220's pre-ratification
// corroboration. The pattern repeats: agreement across observers
// is the strongest claim a decentralized system can make about its
// own behavior.

import {
    FRAME_TYPE_QUORUM_VERDICT,
    SporeFrame,
} from "./spore_frame.ts";
import {
    QuorumResult,
    QuorumVerdict,
} from "./forensic_quorum.ts";

const VERDICT_CODES: Record<QuorumVerdict, number> = {
    "corroborated": 0,
    "uncorroborated": 1,
    "insufficient-relays": 2,
    "empty-window": 3,
};
const CODE_TO_VERDICT: QuorumVerdict[] = [
    "corroborated",
    "uncorroborated",
    "insufficient-relays",
    "empty-window",
];

export function verdictToCode(v: QuorumVerdict): number {
    return VERDICT_CODES[v];
}

export function codeToVerdict(c: number): QuorumVerdict {
    return CODE_TO_VERDICT[c & 0x03] ?? "uncorroborated";
}

/** Build a QUORUM_VERDICT SporeFrame from an adjudication result. */
export function frameFromQuorum(
    result: QuorumResult,
    source_relay_id: number,
    window_end_ms: number,
): SporeFrame {
    const overlap_pct = Math.max(0, Math.min(100, Math.round(result.overlap_ratio * 100)));
    return {
        magic: 0x4F46,
        frameType: FRAME_TYPE_QUORUM_VERDICT,
        oracleBit: 0xFF,
        proposalOrTarget: result.digest >>> 0,
        payloadA: source_relay_id >>> 0,
        payloadB:
            (verdictToCode(result.verdict) |
             (Math.min(255, result.relay_count) << 8) |
             (overlap_pct << 16)) >>> 0,
        payloadC: (
            (Math.min(0xFFFF, result.replayed_q16) << 16) |
             Math.min(0xFFFF, result.diff_q16)
        ) >>> 0,
        tick: (window_end_ms & 0xFFFF_FFFF) >>> 0,
        reserved: 0,
        crc32: 0, // recomputed by caller via computeFrameCrc if transmitted
    };
}

export interface DecodedVerdict {
    digest: number;
    source_relay_id: number;
    verdict: QuorumVerdict;
    relay_count: number;
    overlap_pct: number;
    replayed_q16: number;
    diff_q16: number;
    window_end_low32: number;
}

/** Decode a QUORUM_VERDICT frame back into structured form. */
export function decodeQuorumFrame(frame: SporeFrame): DecodedVerdict | null {
    if (frame.frameType !== FRAME_TYPE_QUORUM_VERDICT) return null;
    const verdict_code = frame.payloadB & 0xFF;
    const relay_count = (frame.payloadB >>> 8) & 0xFF;
    const overlap_pct = (frame.payloadB >>> 16) & 0xFF;
    const replayed_q16 = (frame.payloadC >>> 16) & 0xFFFF;
    const diff_q16 = frame.payloadC & 0xFFFF;
    return {
        digest: frame.proposalOrTarget >>> 0,
        source_relay_id: frame.payloadA >>> 0,
        verdict: codeToVerdict(verdict_code),
        relay_count,
        overlap_pct,
        replayed_q16,
        diff_q16,
        window_end_low32: frame.tick >>> 0,
    };
}

export interface QuorumAgreement {
    digest: number;
    /** Distinct relay IDs that broadcast the same digest. */
    adjudicators: number[];
    /** Verdict consensus (latest observed; expected stable for same digest). */
    verdict: QuorumVerdict;
    source_relay_id: number;
    relay_count: number;
    overlap_pct: number;
    replayed_q16: number;
    diff_q16: number;
    first_seen_at_ms: number;
    last_seen_at_ms: number;
    confidence: "lone" | "double" | "triple+";
}

export interface AgreementOptions {
    /** Capacity of the digest table (FIFO eviction). Default 128. */
    capacity: number;
    /** Distinct adjudicators required to flag a digest as "triple+". Default 3. */
    high_confidence_threshold: number;
}

const DEFAULT_OPTS: AgreementOptions = {
    capacity: 128,
    high_confidence_threshold: 3,
};

function classifyConfidence(count: number, threshold: number): QuorumAgreement["confidence"] {
    if (count >= threshold) return "triple+";
    if (count >= 2) return "double";
    return "lone";
}

/**
 * Tracks who has broadcast which quorum digest. A digest broadcast by
 * multiple distinct relays is high-confidence post-mortem evidence —
 * the multi-party agreement on multi-party agreement on observations
 * promised in Era 1280's design notes.
 */
export class QuorumAgreementTracker {
    private records: Map<number, QuorumAgreement> = new Map();
    private order: number[] = [];
    private opts: AgreementOptions;

    constructor(opts: Partial<AgreementOptions> = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
        if (this.opts.high_confidence_threshold < 2) {
            throw new Error("high_confidence_threshold must be ≥ 2");
        }
    }

    /**
     * Ingest a QUORUM_VERDICT frame. The broadcaster's relay ID is
     * caller-supplied (typically derived from the link layer).
     */
    observe(frame: SporeFrame, broadcaster_relay_id: number, now_ms: number): QuorumAgreement {
        if (frame.frameType !== FRAME_TYPE_QUORUM_VERDICT) {
            throw new Error("QuorumAgreementTracker: not a QUORUM_VERDICT frame");
        }
        const decoded = decodeQuorumFrame(frame)!;
        const broadcaster = broadcaster_relay_id >>> 0;

        let rec = this.records.get(decoded.digest);
        if (!rec) {
            rec = {
                digest: decoded.digest,
                adjudicators: [broadcaster],
                verdict: decoded.verdict,
                source_relay_id: decoded.source_relay_id,
                relay_count: decoded.relay_count,
                overlap_pct: decoded.overlap_pct,
                replayed_q16: decoded.replayed_q16,
                diff_q16: decoded.diff_q16,
                first_seen_at_ms: now_ms,
                last_seen_at_ms: now_ms,
                confidence: classifyConfidence(1, this.opts.high_confidence_threshold),
            };
            this.records.set(decoded.digest, rec);
            this.order.push(decoded.digest);
            if (this.order.length > this.opts.capacity) {
                const evicted = this.order.shift()!;
                this.records.delete(evicted);
            }
            return rec;
        }
        // Existing record — accumulate agreement.
        rec.last_seen_at_ms = now_ms;
        if (!rec.adjudicators.includes(broadcaster)) {
            rec.adjudicators.push(broadcaster);
            rec.adjudicators.sort((a, b) => a - b);
            rec.confidence = classifyConfidence(
                rec.adjudicators.length,
                this.opts.high_confidence_threshold,
            );
        }
        return rec;
    }

    get(digest: number): QuorumAgreement | undefined {
        return this.records.get(digest >>> 0);
    }

    /** All records sorted by adjudicator count desc, first_seen asc. */
    list(): QuorumAgreement[] {
        return [...this.records.values()].sort((a, b) => {
            if (b.adjudicators.length !== a.adjudicators.length) {
                return b.adjudicators.length - a.adjudicators.length;
            }
            return a.first_seen_at_ms - b.first_seen_at_ms;
        });
    }

    /** Records currently at high confidence (multi-party agreement). */
    highConfidenceVerdicts(): QuorumAgreement[] {
        return this.list().filter(r => r.confidence === "triple+");
    }

    size(): number {
        return this.records.size;
    }

    clear(): void {
        this.records.clear();
        this.order = [];
    }
}
