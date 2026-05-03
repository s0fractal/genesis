// OMEGA-64: Era 1970 - Translation Policy Replay Digest Digest Live Wiring
//
// Era 1960 evaluates `tpdq` replay-interpretation digest quorum once
// claims are in memory. This adapter wires passive mesh events into that
// tracker and offers explicit local claim emission for operator-owned
// runtimes.

import type { EventSource } from "./quarantine_lifecycle_bridge.ts";
import type {
    TranslationPolicyReplayDigestForensicReplayDigest,
} from "./translation_policy_replay_digest_forensic_replay_digest.ts";
import {
    TranslationPolicyReplayDigestDigestClaim,
    TranslationPolicyReplayDigestDigestClaimEmit,
    buildTranslationPolicyReplayDigestDigestClaim,
    decodeTranslationPolicyReplayDigestDigestClaim,
} from "./translation_policy_replay_digest_digest_claim.ts";
import {
    ReplayDigestDigestQuorumSnapshot,
    TranslationPolicyReplayDigestDigestQuorumTracker,
} from "./translation_policy_replay_digest_digest_quorum.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_LIVE_WIRING_SCHEMA =
    "OMEGA-1970/v1";

export interface TranslationPolicyReplayDigestDigestLiveEventDetail {
    body?: unknown;
    targetPeer?: unknown;
    fromPeer?: unknown;
}

export interface TranslationPolicyReplayDigestDigestLiveWiringOptions {
    claim_event_name: string;
    now_ms: () => number;
    local_peer_id?: number;
    local_witness_id?: number;
    digest_provider?: () => TranslationPolicyReplayDigestForensicReplayDigest | null;
    claim_emit?: TranslationPolicyReplayDigestDigestClaimEmit;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_LIVE_WIRING_OPTS:
    Omit<TranslationPolicyReplayDigestDigestLiveWiringOptions, "now_ms"> = {
        claim_event_name: "translationPolicyReplayDigestDigestClaim",
    };

export interface TranslationPolicyReplayDigestDigestLiveWiringTelemetry {
    claims_received: number;
    claims_malformed: number;
    claims_observed: number;
    local_claims_built: number;
    local_claims_emitted: number;
    local_claims_failed: number;
    local_claims_skipped: number;
}

export class TranslationPolicyReplayDigestDigestLiveWiringAdapter {
    private claimListener?: (event: { detail: unknown }) => void;
    private active = false;
    private stats: TranslationPolicyReplayDigestDigestLiveWiringTelemetry = {
        claims_received: 0,
        claims_malformed: 0,
        claims_observed: 0,
        local_claims_built: 0,
        local_claims_emitted: 0,
        local_claims_failed: 0,
        local_claims_skipped: 0,
    };

    constructor(
        public readonly tracker: TranslationPolicyReplayDigestDigestQuorumTracker,
        public readonly source: EventSource,
        public readonly opts:
            TranslationPolicyReplayDigestDigestLiveWiringOptions = {
                ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_LIVE_WIRING_OPTS,
                now_ms: () => Date.now(),
            },
    ) {}

    start(): void {
        if (this.active) return;
        this.claimListener = (event) => this.handleClaimEvent(event.detail);
        this.source.addEventListener(this.opts.claim_event_name, this.claimListener);
        this.active = true;
    }

    stop(): void {
        if (!this.active) return;
        if (this.claimListener) {
            this.source.removeEventListener(
                this.opts.claim_event_name,
                this.claimListener,
            );
        }
        this.claimListener = undefined;
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    telemetry(): TranslationPolicyReplayDigestDigestLiveWiringTelemetry {
        return { ...this.stats };
    }

    handleClaimEvent(
        detail: unknown,
    ): TranslationPolicyReplayDigestDigestClaim | null {
        this.stats.claims_received++;
        const parsed = this.extractDetail(detail);
        if (!parsed || typeof parsed.body !== "string") {
            this.stats.claims_malformed++;
            return null;
        }
        const claim = decodeTranslationPolicyReplayDigestDigestClaim(parsed.body);
        if (!claim) {
            this.stats.claims_malformed++;
            return null;
        }
        this.tracker.observe(claim, this.opts.now_ms());
        this.stats.claims_observed++;
        return claim;
    }

    emitLocalClaim(
        target_peer_id: number,
        digest: TranslationPolicyReplayDigestForensicReplayDigest | null =
            this.opts.digest_provider?.() ?? null,
        now_ms: number = this.opts.now_ms(),
    ): TranslationPolicyReplayDigestDigestClaim | null {
        if (!digest || !this.opts.claim_emit) {
            this.stats.local_claims_skipped++;
            return null;
        }
        if (
            typeof this.opts.local_peer_id !== "number" ||
            typeof this.opts.local_witness_id !== "number" ||
            !Number.isFinite(this.opts.local_peer_id) ||
            !Number.isFinite(this.opts.local_witness_id)
        ) {
            this.stats.local_claims_skipped++;
            return null;
        }
        const claim = buildTranslationPolicyReplayDigestDigestClaim(
            this.opts.local_peer_id,
            this.opts.local_witness_id,
            digest,
            now_ms,
        );
        this.stats.local_claims_built++;
        const ok = this.opts.claim_emit(target_peer_id >>> 0, JSON.stringify(claim));
        if (ok) {
            this.stats.local_claims_emitted++;
            return claim;
        }
        this.stats.local_claims_failed++;
        return null;
    }

    snapshot(
        now_ms: number = this.opts.now_ms(),
    ): ReplayDigestDigestQuorumSnapshot {
        return this.tracker.snapshot(now_ms);
    }

    private extractDetail(
        detail: unknown,
    ): TranslationPolicyReplayDigestDigestLiveEventDetail | null {
        if (!detail || typeof detail !== "object") return null;
        return detail as TranslationPolicyReplayDigestDigestLiveEventDetail;
    }
}
