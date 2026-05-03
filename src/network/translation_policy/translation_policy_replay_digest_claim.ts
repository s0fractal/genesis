// OMEGA-64: Era 1870 - Translation Policy Replay Digest Wire Claim
//
// Era 1860 gives a replay interpretation a deterministic content
// address. This module makes that address announceable over mesh/event
// transports without shipping the full replay timelines.

import type { TranslationPolicyForensicBand } from "./translation_policy_forensic_event_adapter.ts";
import {
    TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
    TranslationPolicyForensicReplayDigest,
} from "./translation_policy_forensic_replay_digest.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_CLAIM_SCHEMA = "OMEGA-1870/v1";

export interface TranslationPolicyReplayDigestClaim {
    schema: string;
    digest_schema: string;
    peer_id: number;
    witness_id: number;
    digest: number;
    band_timeline_hash: number;
    policy_interval_hash: number;
    error_window_hash: number;
    classified_events: number;
    malformed_payloads: number;
    final_band: TranslationPolicyForensicBand | "none";
    final_policy_hash: number;
    claimed_at_ms: number;
}

export type TranslationPolicyReplayDigestClaimEmit = (
    target_peer_id: number,
    body_json: string,
) => boolean;

export class TranslationPolicyReplayDigestClaimBridge {
    public sent_count = 0;
    public last_target?: number;
    public last_body?: string;

    constructor(
        public readonly peer_id: number,
        public readonly witness_id: number,
        public readonly emit: TranslationPolicyReplayDigestClaimEmit,
    ) {}

    sendDigestClaim(
        target_peer_id: number,
        digest: TranslationPolicyForensicReplayDigest,
        claimed_at_ms: number,
    ): boolean {
        const claim = buildTranslationPolicyReplayDigestClaim(
            this.peer_id,
            this.witness_id,
            digest,
            claimed_at_ms,
        );
        const body = JSON.stringify(claim);
        const ok = this.emit(target_peer_id >>> 0, body);
        if (ok) {
            this.sent_count++;
            this.last_target = target_peer_id >>> 0;
            this.last_body = body;
        }
        return ok;
    }

    handleIncoming(body_json: string): TranslationPolicyReplayDigestClaim | null {
        return decodeTranslationPolicyReplayDigestClaim(body_json);
    }
}

export function buildTranslationPolicyReplayDigestClaim(
    peer_id: number,
    witness_id: number,
    digest: TranslationPolicyForensicReplayDigest,
    claimed_at_ms: number,
): TranslationPolicyReplayDigestClaim {
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_CLAIM_SCHEMA,
        digest_schema: digest.schema,
        peer_id: peer_id >>> 0,
        witness_id: witness_id >>> 0,
        digest: digest.digest >>> 0,
        band_timeline_hash: digest.band_timeline_hash >>> 0,
        policy_interval_hash: digest.policy_interval_hash >>> 0,
        error_window_hash: digest.error_window_hash >>> 0,
        classified_events: digest.classified_events >>> 0,
        malformed_payloads: digest.malformed_payloads >>> 0,
        final_band: digest.final_band as TranslationPolicyForensicBand | "none",
        final_policy_hash: digest.final_policy_hash >>> 0,
        claimed_at_ms: finiteNonNegative(claimed_at_ms) ? claimed_at_ms : 0,
    };
}

export function decodeTranslationPolicyReplayDigestClaim(
    body_json: string,
): TranslationPolicyReplayDigestClaim | null {
    try {
        const parsed = JSON.parse(body_json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        if (parsed.schema !== TRANSLATION_POLICY_REPLAY_DIGEST_CLAIM_SCHEMA) return null;
        if (
            parsed.digest_schema !==
                TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA
        ) return null;
        if (!uintField(parsed.peer_id)) return null;
        if (!uintField(parsed.witness_id)) return null;
        if (!uintField(parsed.digest)) return null;
        if (!uintField(parsed.band_timeline_hash)) return null;
        if (!uintField(parsed.policy_interval_hash)) return null;
        if (!uintField(parsed.error_window_hash)) return null;
        if (!uintField(parsed.classified_events)) return null;
        if (!uintField(parsed.malformed_payloads)) return null;
        if (typeof parsed.final_band !== "string") return null;
        if (!uintField(parsed.final_policy_hash)) return null;
        if (!finiteNonNegative(parsed.claimed_at_ms)) return null;
        return {
            schema: parsed.schema,
            digest_schema: parsed.digest_schema,
            peer_id: parsed.peer_id >>> 0,
            witness_id: parsed.witness_id >>> 0,
            digest: parsed.digest >>> 0,
            band_timeline_hash: parsed.band_timeline_hash >>> 0,
            policy_interval_hash: parsed.policy_interval_hash >>> 0,
            error_window_hash: parsed.error_window_hash >>> 0,
            classified_events: parsed.classified_events >>> 0,
            malformed_payloads: parsed.malformed_payloads >>> 0,
            final_band: parsed.final_band,
            final_policy_hash: parsed.final_policy_hash >>> 0,
            claimed_at_ms: parsed.claimed_at_ms,
        };
    } catch {
        return null;
    }
}

export function translationPolicyReplayDigestClaimMatchesDigest(
    claim: TranslationPolicyReplayDigestClaim,
    digest: TranslationPolicyForensicReplayDigest,
): boolean {
    return claim.digest_schema === digest.schema &&
        claim.digest === (digest.digest >>> 0) &&
        claim.band_timeline_hash === (digest.band_timeline_hash >>> 0) &&
        claim.policy_interval_hash === (digest.policy_interval_hash >>> 0) &&
        claim.error_window_hash === (digest.error_window_hash >>> 0) &&
        claim.classified_events === (digest.classified_events >>> 0) &&
        claim.malformed_payloads === (digest.malformed_payloads >>> 0) &&
        claim.final_band === digest.final_band &&
        claim.final_policy_hash === (digest.final_policy_hash >>> 0);
}

export function sameTranslationPolicyReplayDigestClaim(
    a: TranslationPolicyReplayDigestClaim,
    b: TranslationPolicyReplayDigestClaim,
): boolean {
    return a.digest_schema === b.digest_schema &&
        a.digest === b.digest &&
        a.band_timeline_hash === b.band_timeline_hash &&
        a.policy_interval_hash === b.policy_interval_hash &&
        a.error_window_hash === b.error_window_hash &&
        a.classified_events === b.classified_events &&
        a.malformed_payloads === b.malformed_payloads &&
        a.final_band === b.final_band &&
        a.final_policy_hash === b.final_policy_hash;
}

export function translationPolicyReplayDigestPlasmidFields(
    target_peer_id: number,
    claim: TranslationPolicyReplayDigestClaim,
): {
    translationPolicyReplayDigestTarget: number;
    translationPolicyReplayDigestBody: string;
} {
    return {
        translationPolicyReplayDigestTarget: target_peer_id >>> 0,
        translationPolicyReplayDigestBody: JSON.stringify(claim),
    };
}

function uintField(value: unknown): value is number {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 0xFFFF_FFFF;
}

function finiteNonNegative(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
