// 🌌 OMEGA-64: Era 1650 — Translation Policy Digest & Drift Alarm
//
// Era 1640 made schema translation policy operational inside
// `SchemaAwareMultiSinkInvestigator`, but the registry was still
// local operator state. Two peers could both support translated sync
// while disagreeing about which migration pairs are authorized.
//
// Era 1650 makes that policy OBSERVABLE:
//   • registered translator pairs are canonicalized and FNV-1a hashed;
//   • peers broadcast compact policy claims;
//   • relays compare peer claims against local policy and raise a
//     forensic event when authorization drifts.
//
// The monitor does not judge whether a policy is "right". It only
// detects disagreement deterministically before translated sync relies
// on incompatible operator assumptions.

import { fnv1a32 } from "../cross_model_debate.ts";
import { ForensicEventSink } from "../forensic_event_sink.ts";
import { SchemaTranslatorRegistry } from "../schema_translator.ts";

export const TRANSLATION_POLICY_SCHEMA = "OMEGA-1650/v1";

export interface TranslationPolicyPair {
    source: string;
    target: string;
}

export interface TranslationPolicyClaim {
    schema: string;
    peer_id: number;
    policy_hash: number;
    pair_count: number;
    pairs: TranslationPolicyPair[];
    claimed_at_ms: number;
}

export interface TranslationPolicyDriftEvent {
    schema: string;
    peer_id: number;
    local_policy_hash: number;
    peer_policy_hash: number;
    local_pair_count: number;
    peer_pair_count: number;
    observed_at_ms: number;
    event_hash: number;
}

export interface TranslationPolicyObservation {
    peer_id: number;
    last_seen_at_ms: number;
    claim: TranslationPolicyClaim;
    drift_detected: boolean;
}

export interface TranslationPolicyMonitorOptions {
    ttl_ms: number;
    capacity: number;
    on_alarm?: (event: TranslationPolicyDriftEvent) => void;
    event_sink?: ForensicEventSink;
}

const DEFAULT_OPTS: TranslationPolicyMonitorOptions = {
    ttl_ms: 60_000,
    capacity: 64,
};

const enc = new TextEncoder();

function canonicalPairs(
    pairs: ReadonlyArray<TranslationPolicyPair>,
): TranslationPolicyPair[] {
    return [...pairs]
        .map((p) => ({ source: p.source, target: p.target }))
        .sort((a, b) => {
            if (a.source !== b.source) return a.source.localeCompare(b.source);
            return a.target.localeCompare(b.target);
        });
}

function pushU32(out: number[], n: number): void {
    out.push(
        (n >>> 24) & 0xFF,
        (n >>> 16) & 0xFF,
        (n >>> 8) & 0xFF,
        n & 0xFF,
    );
}

function pushString(out: number[], s: string): void {
    const bytes = enc.encode(s);
    for (const b of bytes) out.push(b);
    out.push(0);
}

/** Deterministic digest over registered source→target translator
 *  pairs. Empty policy hashes to FNV-1a offset basis. */
export function translationPolicyDigestFromPairs(
    pairs: ReadonlyArray<TranslationPolicyPair>,
): number {
    const bytes: number[] = [];
    for (const p of canonicalPairs(pairs)) {
        pushString(bytes, p.source);
        pushString(bytes, p.target);
    }
    return fnv1a32(new Uint8Array(bytes));
}

/** Deterministic digest over a registry's canonical pair list. */
export function translationPolicyDigest(
    registry: SchemaTranslatorRegistry,
): number {
    return translationPolicyDigestFromPairs(registry.listPairs());
}

/** Build the compact claim a peer can broadcast. */
export function buildTranslationPolicyClaim(
    peer_id: number,
    registry: SchemaTranslatorRegistry,
    claimed_at_ms: number,
): TranslationPolicyClaim {
    const pairs = canonicalPairs(registry.listPairs());
    return {
        schema: TRANSLATION_POLICY_SCHEMA,
        peer_id: peer_id >>> 0,
        policy_hash: translationPolicyDigestFromPairs(pairs),
        pair_count: pairs.length,
        pairs,
        claimed_at_ms,
    };
}

/** Stable forensic event for a local-vs-peer policy mismatch. */
export function translationPolicyDriftEvent(
    local: TranslationPolicyClaim,
    peer: TranslationPolicyClaim,
    observed_at_ms: number,
): TranslationPolicyDriftEvent {
    const bytes: number[] = [];
    pushU32(bytes, peer.peer_id);
    pushU32(bytes, local.policy_hash);
    pushU32(bytes, peer.policy_hash);
    pushU32(bytes, local.pair_count);
    pushU32(bytes, peer.pair_count);
    pushU32(bytes, observed_at_ms);
    const event_hash = fnv1a32(new Uint8Array(bytes));
    return {
        schema: TRANSLATION_POLICY_SCHEMA,
        peer_id: peer.peer_id,
        local_policy_hash: local.policy_hash,
        peer_policy_hash: peer.policy_hash,
        local_pair_count: local.pair_count,
        peer_pair_count: peer.pair_count,
        observed_at_ms,
        event_hash,
    };
}

export class TranslationPolicyMonitor {
    private observations = new Map<number, TranslationPolicyObservation>();
    private order: number[] = [];
    private alarms: TranslationPolicyDriftEvent[] = [];
    private alarmKeys = new Set<string>();
    private opts: TranslationPolicyMonitorOptions;

    constructor(
        private localPeerId: number,
        private registry: SchemaTranslatorRegistry,
        opts: Partial<TranslationPolicyMonitorOptions> = {},
    ) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.ttl_ms <= 0) throw new Error("ttl_ms must be positive");
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
    }

    localClaim(now_ms: number): TranslationPolicyClaim {
        return buildTranslationPolicyClaim(this.localPeerId, this.registry, now_ms);
    }

    observeClaim(
        claim: TranslationPolicyClaim,
        now_ms: number,
    ): TranslationPolicyObservation {
        if (claim.schema !== TRANSLATION_POLICY_SCHEMA) {
            throw new Error("TranslationPolicyMonitor: schema mismatch");
        }
        this.evictExpired(now_ms);
        const local = this.localClaim(now_ms);
        const drift = claim.policy_hash !== local.policy_hash ||
            claim.pair_count !== local.pair_count;
        const rec: TranslationPolicyObservation = {
            peer_id: claim.peer_id,
            last_seen_at_ms: now_ms,
            claim: { ...claim, pairs: canonicalPairs(claim.pairs) },
            drift_detected: drift,
        };
        this.upsert(rec);
        if (drift) this.raiseDrift(local, rec.claim, now_ms);
        return rec;
    }

    snapshot(now_ms?: number): TranslationPolicyObservation[] {
        if (now_ms !== undefined) this.evictExpired(now_ms);
        return [...this.observations.values()]
            .sort((a, b) => a.peer_id - b.peer_id)
            .map((x) => ({ ...x, claim: { ...x.claim, pairs: [...x.claim.pairs] } }));
    }

    driftPeers(now_ms?: number): number[] {
        return this.snapshot(now_ms)
            .filter((x) => x.drift_detected)
            .map((x) => x.peer_id);
    }

    recentAlarms(n: number = 10): TranslationPolicyDriftEvent[] {
        return this.alarms.slice(Math.max(0, this.alarms.length - n));
    }

    summary(now_ms: number): {
        local_policy_hash: number;
        local_pair_count: number;
        observed_peer_count: number;
        drift_peer_count: number;
        alarm_count: number;
    } {
        const local = this.localClaim(now_ms);
        const snapshot = this.snapshot(now_ms);
        return {
            local_policy_hash: local.policy_hash,
            local_pair_count: local.pair_count,
            observed_peer_count: snapshot.length,
            drift_peer_count: snapshot.filter((x) => x.drift_detected).length,
            alarm_count: this.alarms.length,
        };
    }

    clear(): void {
        this.observations.clear();
        this.order = [];
        this.alarms = [];
        this.alarmKeys.clear();
    }

    private upsert(rec: TranslationPolicyObservation): void {
        if (!this.observations.has(rec.peer_id)) {
            this.order.push(rec.peer_id);
            if (this.order.length > this.opts.capacity) {
                const evicted = this.order.shift()!;
                this.observations.delete(evicted);
            }
        }
        this.observations.set(rec.peer_id, rec);
    }

    private evictExpired(now_ms: number): void {
        const keep: number[] = [];
        for (const peer_id of this.order) {
            const rec = this.observations.get(peer_id);
            if (!rec) continue;
            if (now_ms - rec.last_seen_at_ms <= this.opts.ttl_ms) {
                keep.push(peer_id);
            } else {
                this.observations.delete(peer_id);
            }
        }
        this.order = keep;
    }

    private raiseDrift(
        local: TranslationPolicyClaim,
        peer: TranslationPolicyClaim,
        now_ms: number,
    ): void {
        const key = `${peer.peer_id}:${peer.policy_hash}:${local.policy_hash}`;
        if (this.alarmKeys.has(key)) return;
        this.alarmKeys.add(key);
        const event = translationPolicyDriftEvent(local, peer, now_ms);
        this.alarms.push(event);
        this.opts.event_sink?.append(
            "translation-policy-drift",
            event.event_hash,
            event,
            now_ms,
        );
        this.opts.on_alarm?.(event);
    }
}
