// OMEGA-64: Era 1890 - Translation Policy Replay Digest Live Wiring
//
// Era 1880 classifies replay-digest claims once they are in memory.
// This adapter wires passive mesh events into that tracker and offers
// an explicit local-claim emission helper for operator-owned runtimes.

import type { EventSource } from "../quarantine_lifecycle_bridge.ts";
import type {
    TranslationPolicyForensicReplayDigest,
} from "./translation_policy_forensic_replay_digest.ts";
import {
    TranslationPolicyReplayDigestClaim,
    TranslationPolicyReplayDigestClaimEmit,
    buildTranslationPolicyReplayDigestClaim,
    decodeTranslationPolicyReplayDigestClaim,
} from "./translation_policy_replay_digest_claim.ts";
import {
    ReplayDigestQuorumSnapshot,
    TranslationPolicyReplayDigestQuorumTracker,
} from "./translation_policy_replay_digest_quorum.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_LIVE_WIRING_SCHEMA =
    "OMEGA-1890/v1";

export interface TranslationPolicyReplayDigestLiveEventDetail {
    body?: unknown;
    targetPeer?: unknown;
    fromPeer?: unknown;
}

export interface TranslationPolicyReplayDigestLiveWiringOptions {
    claim_event_name: string;
    now_ms: () => number;
    local_peer_id?: number;
    local_witness_id?: number;
    digest_provider?: () => TranslationPolicyForensicReplayDigest | null;
    claim_emit?: TranslationPolicyReplayDigestClaimEmit;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_LIVE_WIRING_OPTS:
    Omit<TranslationPolicyReplayDigestLiveWiringOptions, "now_ms"> = {
        claim_event_name: "translationPolicyReplayDigestClaim",
    };

export interface TranslationPolicyReplayDigestLiveWiringTelemetry {
    claims_received: number;
    claims_malformed: number;
    claims_observed: number;
    local_claims_built: number;
    local_claims_emitted: number;
    local_claims_failed: number;
    local_claims_skipped: number;
}

export class TranslationPolicyReplayDigestLiveWiringAdapter {
    private claimListener?: (event: { detail: unknown }) => void;
    private active = false;
    private stats: TranslationPolicyReplayDigestLiveWiringTelemetry = {
        claims_received: 0,
        claims_malformed: 0,
        claims_observed: 0,
        local_claims_built: 0,
        local_claims_emitted: 0,
        local_claims_failed: 0,
        local_claims_skipped: 0,
    };

    constructor(
        public readonly tracker: TranslationPolicyReplayDigestQuorumTracker,
        public readonly source: EventSource,
        public readonly opts: TranslationPolicyReplayDigestLiveWiringOptions = {
            ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_LIVE_WIRING_OPTS,
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
            this.source.removeEventListener(this.opts.claim_event_name, this.claimListener);
        }
        this.claimListener = undefined;
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    telemetry(): TranslationPolicyReplayDigestLiveWiringTelemetry {
        return { ...this.stats };
    }

    handleClaimEvent(detail: unknown): TranslationPolicyReplayDigestClaim | null {
        this.stats.claims_received++;
        const parsed = this.extractDetail(detail);
        if (!parsed || typeof parsed.body !== "string") {
            this.stats.claims_malformed++;
            return null;
        }
        const claim = decodeTranslationPolicyReplayDigestClaim(parsed.body);
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
        digest: TranslationPolicyForensicReplayDigest | null =
            this.opts.digest_provider?.() ?? null,
        now_ms: number = this.opts.now_ms(),
    ): TranslationPolicyReplayDigestClaim | null {
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
        const claim = buildTranslationPolicyReplayDigestClaim(
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

    snapshot(now_ms: number = this.opts.now_ms()): ReplayDigestQuorumSnapshot {
        return this.tracker.snapshot(now_ms);
    }

    private extractDetail(
        detail: unknown,
    ): TranslationPolicyReplayDigestLiveEventDetail | null {
        if (!detail || typeof detail !== "object") return null;
        return detail as TranslationPolicyReplayDigestLiveEventDetail;
    }
}
