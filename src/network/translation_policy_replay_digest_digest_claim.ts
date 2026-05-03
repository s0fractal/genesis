// OMEGA-64: Era 1950 - Translation Policy Replay Digest Digest Claim
//
// Era 1940 content-addresses `tpdq` replay interpretations. This module
// makes that newer digest announceable over mesh/event transports without
// reusing the older Era 1870 `tpol` replay-digest claim shape.

import type {
    TranslationPolicyReplayDigestForensicReplayDigest,
} from "./translation_policy_replay_digest_forensic_replay_digest.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
} from "./translation_policy_replay_digest_forensic_replay_digest.ts";
import type {
    TranslationPolicyReplayDigestHudBand,
} from "./translation_policy_replay_digest_hud.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_CLAIM_SCHEMA =
    "OMEGA-1950/v1";

export interface TranslationPolicyReplayDigestDigestClaim {
    schema: string;
    digest_schema: string;
    peer_id: number;
    witness_id: number;
    digest: number;
    band_timeline_hash: number;
    consensus_interval_hash: number;
    error_window_hash: number;
    classified_events: number;
    malformed_payloads: number;
    final_band: TranslationPolicyReplayDigestHudBand | "none";
    final_consensus_digest: number;
    claimed_at_ms: number;
}

export type TranslationPolicyReplayDigestDigestClaimEmit = (
    target_peer_id: number,
    body_json: string,
) => boolean;

export class TranslationPolicyReplayDigestDigestClaimBridge {
    public sent_count = 0;
    public last_target?: number;
    public last_body?: string;

    constructor(
        public readonly peer_id: number,
        public readonly witness_id: number,
        public readonly emit: TranslationPolicyReplayDigestDigestClaimEmit,
    ) {}

    sendDigestClaim(
        target_peer_id: number,
        digest: TranslationPolicyReplayDigestForensicReplayDigest,
        claimed_at_ms: number,
    ): boolean {
        const claim = buildTranslationPolicyReplayDigestDigestClaim(
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

    handleIncoming(body_json: string): TranslationPolicyReplayDigestDigestClaim | null {
        return decodeTranslationPolicyReplayDigestDigestClaim(body_json);
    }
}

export function buildTranslationPolicyReplayDigestDigestClaim(
    peer_id: number,
    witness_id: number,
    digest: TranslationPolicyReplayDigestForensicReplayDigest,
    claimed_at_ms: number,
): TranslationPolicyReplayDigestDigestClaim {
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_CLAIM_SCHEMA,
        digest_schema: digest.schema,
        peer_id: peer_id >>> 0,
        witness_id: witness_id >>> 0,
        digest: digest.digest >>> 0,
        band_timeline_hash: digest.band_timeline_hash >>> 0,
        consensus_interval_hash: digest.consensus_interval_hash >>> 0,
        error_window_hash: digest.error_window_hash >>> 0,
        classified_events: digest.classified_events >>> 0,
        malformed_payloads: digest.malformed_payloads >>> 0,
        final_band: digest.final_band as TranslationPolicyReplayDigestHudBand | "none",
        final_consensus_digest: digest.final_consensus_digest >>> 0,
        claimed_at_ms: finiteNonNegative(claimed_at_ms) ? claimed_at_ms : 0,
    };
}

export function decodeTranslationPolicyReplayDigestDigestClaim(
    body_json: string,
): TranslationPolicyReplayDigestDigestClaim | null {
    try {
        const parsed = JSON.parse(body_json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        if (parsed.schema !== TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_CLAIM_SCHEMA) {
            return null;
        }
        if (
            parsed.digest_schema !==
                TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA
        ) {
            return null;
        }
        if (!uintField(parsed.peer_id)) return null;
        if (!uintField(parsed.witness_id)) return null;
        if (!uintField(parsed.digest)) return null;
        if (!uintField(parsed.band_timeline_hash)) return null;
        if (!uintField(parsed.consensus_interval_hash)) return null;
        if (!uintField(parsed.error_window_hash)) return null;
        if (!uintField(parsed.classified_events)) return null;
        if (!uintField(parsed.malformed_payloads)) return null;
        if (!isFinalBand(parsed.final_band)) return null;
        if (!uintField(parsed.final_consensus_digest)) return null;
        if (!finiteNonNegative(parsed.claimed_at_ms)) return null;
        return {
            schema: parsed.schema,
            digest_schema: parsed.digest_schema,
            peer_id: parsed.peer_id >>> 0,
            witness_id: parsed.witness_id >>> 0,
            digest: parsed.digest >>> 0,
            band_timeline_hash: parsed.band_timeline_hash >>> 0,
            consensus_interval_hash: parsed.consensus_interval_hash >>> 0,
            error_window_hash: parsed.error_window_hash >>> 0,
            classified_events: parsed.classified_events >>> 0,
            malformed_payloads: parsed.malformed_payloads >>> 0,
            final_band: parsed.final_band,
            final_consensus_digest: parsed.final_consensus_digest >>> 0,
            claimed_at_ms: parsed.claimed_at_ms,
        };
    } catch {
        return null;
    }
}

export function translationPolicyReplayDigestDigestClaimMatchesDigest(
    claim: TranslationPolicyReplayDigestDigestClaim,
    digest: TranslationPolicyReplayDigestForensicReplayDigest,
): boolean {
    return claim.digest_schema === digest.schema &&
        claim.digest === (digest.digest >>> 0) &&
        claim.band_timeline_hash === (digest.band_timeline_hash >>> 0) &&
        claim.consensus_interval_hash === (digest.consensus_interval_hash >>> 0) &&
        claim.error_window_hash === (digest.error_window_hash >>> 0) &&
        claim.classified_events === (digest.classified_events >>> 0) &&
        claim.malformed_payloads === (digest.malformed_payloads >>> 0) &&
        claim.final_band === digest.final_band &&
        claim.final_consensus_digest === (digest.final_consensus_digest >>> 0);
}

export function sameTranslationPolicyReplayDigestDigestClaim(
    a: TranslationPolicyReplayDigestDigestClaim,
    b: TranslationPolicyReplayDigestDigestClaim,
): boolean {
    return a.digest_schema === b.digest_schema &&
        a.digest === b.digest &&
        a.band_timeline_hash === b.band_timeline_hash &&
        a.consensus_interval_hash === b.consensus_interval_hash &&
        a.error_window_hash === b.error_window_hash &&
        a.classified_events === b.classified_events &&
        a.malformed_payloads === b.malformed_payloads &&
        a.final_band === b.final_band &&
        a.final_consensus_digest === b.final_consensus_digest;
}

export function translationPolicyReplayDigestDigestPlasmidFields(
    target_peer_id: number,
    claim: TranslationPolicyReplayDigestDigestClaim,
): {
    translationPolicyReplayDigestDigestTarget: number;
    translationPolicyReplayDigestDigestBody: string;
} {
    return {
        translationPolicyReplayDigestDigestTarget: target_peer_id >>> 0,
        translationPolicyReplayDigestDigestBody: JSON.stringify(claim),
    };
}

function isFinalBand(
    value: unknown,
): value is TranslationPolicyReplayDigestHudBand | "none" {
    return value === "nominal" ||
        value === "watch" ||
        value === "drift" ||
        value === "blocked" ||
        value === "none";
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
