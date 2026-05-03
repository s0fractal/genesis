// 🌌 OMEGA-64: Era 1690 — Translation Policy Corroboration Gate
// 📡 Era 1700 — Corroboration Raise Wire Shape
//
// Era 1680 can raise a warrant proposal from one local policy-drift
// observation. Era 1690 adds an optional corroboration layer so
// operators can require double/triple+ independent witnesses before
// the proposal is emitted.

import { fnv1a32 } from "../cross_model_debate.ts";
import { TranslationPolicyDriftEvent } from "./translation_policy_monitor.ts";

export const TRANSLATION_POLICY_CORROBORATION_SCHEMA = "OMEGA-1690/v1";
export const TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA = "OMEGA-1700/v1";

export type PolicyDriftConfidence = "lone" | "double" | "triple+" | "high";

export interface PolicyDriftCorroboratedRecord {
    drift_hash: number;
    peer_id: number;
    local_policy_hash: number;
    peer_policy_hash: number;
    local_pair_count: number;
    peer_pair_count: number;
    witness_count: number;
    witnessed_by: number[];
    first_observed_at_ms: number;
    last_observed_at_ms: number;
    confidence: PolicyDriftConfidence;
}

export interface PolicyDriftCorroborationOptions {
    high_confidence_threshold: number;
    capacity: number;
    on_high_confidence?: (record: PolicyDriftCorroboratedRecord) => void;
}

export interface TranslationPolicyCorroborationRaise {
    schema: string;
    drift_hash: number;
    witness_id: number;
    peer_id: number;
    local_policy_hash: number;
    peer_policy_hash: number;
    local_pair_count: number;
    peer_pair_count: number;
    raised_at_ms: number;
}

const DEFAULT_OPTS: PolicyDriftCorroborationOptions = {
    high_confidence_threshold: 3,
    capacity: 256,
};

function pushU32(out: number[], n: number): void {
    out.push(
        (n >>> 24) & 0xFF,
        (n >>> 16) & 0xFF,
        (n >>> 8) & 0xFF,
        n & 0xFF,
    );
}

export function policyDriftEquivalenceHash(
    event: TranslationPolicyDriftEvent,
): number {
    const bytes: number[] = [];
    pushU32(bytes, event.peer_id);
    pushU32(bytes, event.local_policy_hash);
    pushU32(bytes, event.peer_policy_hash);
    pushU32(bytes, event.local_pair_count);
    pushU32(bytes, event.peer_pair_count);
    return fnv1a32(new Uint8Array(bytes));
}

export function policyDriftHashFromFields(fields: {
    peer_id: number;
    local_policy_hash: number;
    peer_policy_hash: number;
    local_pair_count: number;
    peer_pair_count: number;
}): number {
    const bytes: number[] = [];
    pushU32(bytes, fields.peer_id);
    pushU32(bytes, fields.local_policy_hash);
    pushU32(bytes, fields.peer_policy_hash);
    pushU32(bytes, fields.local_pair_count);
    pushU32(bytes, fields.peer_pair_count);
    return fnv1a32(new Uint8Array(bytes));
}

export function buildTranslationPolicyCorroborationRaise(
    event: TranslationPolicyDriftEvent,
    witness_id: number,
    raised_at_ms: number,
): TranslationPolicyCorroborationRaise {
    return {
        schema: TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA,
        drift_hash: policyDriftEquivalenceHash(event),
        witness_id: witness_id >>> 0,
        peer_id: event.peer_id >>> 0,
        local_policy_hash: event.local_policy_hash >>> 0,
        peer_policy_hash: event.peer_policy_hash >>> 0,
        local_pair_count: event.local_pair_count >>> 0,
        peer_pair_count: event.peer_pair_count >>> 0,
        raised_at_ms,
    };
}

export function validateTranslationPolicyCorroborationRaise(
    raise: TranslationPolicyCorroborationRaise,
): boolean {
    if (raise.schema !== TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA) return false;
    const expected = policyDriftHashFromFields(raise);
    return (raise.drift_hash >>> 0) === expected;
}

function eventFromRaise(
    raise: TranslationPolicyCorroborationRaise,
): TranslationPolicyDriftEvent {
    return {
        schema: TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA,
        peer_id: raise.peer_id >>> 0,
        local_policy_hash: raise.local_policy_hash >>> 0,
        peer_policy_hash: raise.peer_policy_hash >>> 0,
        local_pair_count: raise.local_pair_count >>> 0,
        peer_pair_count: raise.peer_pair_count >>> 0,
        observed_at_ms: raise.raised_at_ms,
        event_hash: raise.drift_hash >>> 0,
    };
}

export function classifyPolicyDriftConfidence(
    count: number,
    high_threshold: number,
): PolicyDriftConfidence {
    if (count >= high_threshold) return "high";
    if (count >= 3) return "triple+";
    if (count === 2) return "double";
    return "lone";
}

export function confidenceAtLeast(
    actual: PolicyDriftConfidence,
    required: PolicyDriftConfidence,
): boolean {
    const rank: Record<PolicyDriftConfidence, number> = {
        "lone": 1,
        "double": 2,
        "triple+": 3,
        "high": 4,
    };
    return rank[actual] >= rank[required];
}

export class TranslationPolicyCorroborationTracker {
    private records = new Map<number, PolicyDriftCorroboratedRecord>();
    private order: number[] = [];
    private opts: PolicyDriftCorroborationOptions;

    constructor(opts: Partial<PolicyDriftCorroborationOptions> = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
        if (this.opts.high_confidence_threshold < 2) {
            throw new Error("high_confidence_threshold must be ≥ 2");
        }
    }

    record(
        event: TranslationPolicyDriftEvent,
        witness_id: number,
        now_ms: number,
    ): PolicyDriftCorroboratedRecord {
        const hash = policyDriftEquivalenceHash(event);
        const witness = witness_id >>> 0;
        let record = this.records.get(hash);
        if (!record) {
            record = {
                drift_hash: hash,
                peer_id: event.peer_id >>> 0,
                local_policy_hash: event.local_policy_hash >>> 0,
                peer_policy_hash: event.peer_policy_hash >>> 0,
                local_pair_count: event.local_pair_count >>> 0,
                peer_pair_count: event.peer_pair_count >>> 0,
                witness_count: 1,
                witnessed_by: [witness],
                first_observed_at_ms: now_ms,
                last_observed_at_ms: now_ms,
                confidence: classifyPolicyDriftConfidence(
                    1,
                    this.opts.high_confidence_threshold,
                ),
            };
            this.records.set(hash, record);
            this.order.push(hash);
            if (this.order.length > this.opts.capacity) {
                const evicted = this.order.shift()!;
                this.records.delete(evicted);
            }
            return record;
        }

        record.last_observed_at_ms = now_ms;
        if (!record.witnessed_by.includes(witness)) {
            record.witnessed_by.push(witness);
            record.witnessed_by.sort((a, b) => a - b);
            record.witness_count = record.witnessed_by.length;
            const wasHigh = record.confidence === "high";
            record.confidence = classifyPolicyDriftConfidence(
                record.witness_count,
                this.opts.high_confidence_threshold,
            );
            if (!wasHigh && record.confidence === "high") {
                this.opts.on_high_confidence?.(record);
            }
        }
        return record;
    }

    recordRaise(
        raise: TranslationPolicyCorroborationRaise,
        now_ms: number = raise.raised_at_ms,
    ): PolicyDriftCorroboratedRecord | null {
        if (!validateTranslationPolicyCorroborationRaise(raise)) return null;
        return this.record(eventFromRaise(raise), raise.witness_id, now_ms);
    }

    get(drift_hash: number): PolicyDriftCorroboratedRecord | undefined {
        return this.records.get(drift_hash >>> 0);
    }

    list(): PolicyDriftCorroboratedRecord[] {
        return [...this.records.values()].sort((a, b) => {
            if (b.witness_count !== a.witness_count) {
                return b.witness_count - a.witness_count;
            }
            return a.first_observed_at_ms - b.first_observed_at_ms;
        });
    }

    byConfidence(min: PolicyDriftConfidence): PolicyDriftCorroboratedRecord[] {
        return this.list().filter((r) => confidenceAtLeast(r.confidence, min));
    }

    size(): number {
        return this.records.size;
    }

    clear(): void {
        this.records.clear();
        this.order = [];
    }
}
