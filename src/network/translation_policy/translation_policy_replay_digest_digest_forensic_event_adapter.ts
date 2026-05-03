// OMEGA-64: Era 1990 - Translation Policy Replay Digest Digest Forensic Events
//
// The digest-digest quorum is live and HUD-readable as of Era 1980.
// This adapter records compact `tpdd` forensic events when the
// quorum/HUD projection changes, without owning timers, DOM, or mesh
// state.

import { fnv1a32 } from "../cross_model_debate.ts";
import {
    ForensicEvent,
    ForensicEventSink,
} from "../forensic_event_sink.ts";
import type {
    ReplayDigestDigestQuorumSnapshot,
} from "./translation_policy_replay_digest_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
} from "./translation_policy_replay_digest_digest_live_wiring.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA,
    TranslationPolicyReplayDigestDigestHudBand,
    formatTranslationPolicyReplayDigestDigestHud,
} from "./translation_policy_replay_digest_digest_hud.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA =
    "OMEGA-1990/v1";

export interface TranslationPolicyReplayDigestDigestForensicEventOptions {
    enabled: boolean;
    kind: string;
    now_ms: () => number;
}

export type TranslationPolicyReplayDigestDigestForensicEventOptionsInput =
    Partial<TranslationPolicyReplayDigestDigestForensicEventOptions>;

export interface TranslationPolicyReplayDigestDigestForensicPayload {
    schema: string;
    hud_schema: string;
    emitted_at_ms: number;
    band: TranslationPolicyReplayDigestDigestHudBand;
    consensus_digest: number;
    consensus_count: number;
    total_claims: number;
    agreement_q16: number;
    distinct_digest_count: number;
    dissenter_count: number;
    malformed_count: number;
    local_claims_emitted: number;
    local_claims_failed: number;
    local_claims_skipped: number;
}

export interface TranslationPolicyReplayDigestDigestForensicTelemetry {
    snapshots_received: number;
    appended_events: number;
    skipped_unchanged: number;
    append_failed: number;
    active: boolean;
    last_event_hash: number | null;
}

export interface TranslationPolicyReplayDigestDigestForensicHandleResult {
    appended: boolean;
    reason: "appended" | "disabled" | "unchanged" | "append-error";
    event: ForensicEvent | null;
    event_hash: number | null;
    error?: string;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_OPTS:
    Omit<TranslationPolicyReplayDigestDigestForensicEventOptions, "now_ms"> = {
        enabled: false,
        kind: "tpdd",
    };

const encoder = new TextEncoder();

export class TranslationPolicyReplayDigestDigestForensicEventAdapter {
    private lastProjection: string | null = null;
    private lastEventHash: number | null = null;
    private stats: TranslationPolicyReplayDigestDigestForensicTelemetry = {
        snapshots_received: 0,
        appended_events: 0,
        skipped_unchanged: 0,
        append_failed: 0,
        active: false,
        last_event_hash: null,
    };

    constructor(
        public readonly sink: ForensicEventSink,
        public readonly opts: TranslationPolicyReplayDigestDigestForensicEventOptions = {
            ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_OPTS,
            now_ms: () => Date.now(),
        },
    ) {}

    start(): void {
        if (!this.opts.enabled) return;
        this.stats.active = true;
    }

    stop(): void {
        this.stats.active = false;
    }

    isActive(): boolean {
        return this.stats.active;
    }

    telemetry(): TranslationPolicyReplayDigestDigestForensicTelemetry {
        return {
            ...this.stats,
            last_event_hash: this.lastEventHash,
        };
    }

    handleSnapshot(
        snapshot: ReplayDigestDigestQuorumSnapshot,
        telemetry: TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
    ): TranslationPolicyReplayDigestDigestForensicHandleResult {
        if (!this.opts.enabled) return this.result("disabled", null, null);
        this.stats.snapshots_received++;
        const payload = translationPolicyReplayDigestDigestForensicPayload(
            snapshot,
            telemetry,
            this.opts.now_ms(),
        );
        const projection = translationPolicyReplayDigestDigestForensicProjection(
            payload,
        );
        const eventHash = fnv1a32(encoder.encode(projection));
        if (this.lastProjection === projection) {
            this.stats.skipped_unchanged++;
            return this.result("unchanged", null, eventHash);
        }
        try {
            const event = this.sink.append(
                this.opts.kind,
                eventHash,
                payload,
                this.opts.now_ms(),
            );
            this.lastProjection = projection;
            this.lastEventHash = eventHash;
            this.stats.appended_events++;
            return this.result("appended", event, eventHash);
        } catch (e) {
            this.stats.append_failed++;
            return {
                ...this.result("append-error", null, eventHash),
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }

    private result(
        reason: TranslationPolicyReplayDigestDigestForensicHandleResult["reason"],
        event: ForensicEvent | null,
        event_hash: number | null,
    ): TranslationPolicyReplayDigestDigestForensicHandleResult {
        return {
            appended: reason === "appended",
            reason,
            event,
            event_hash,
        };
    }
}

export function createTranslationPolicyReplayDigestDigestForensicEventAdapter(
    sink: ForensicEventSink | null | undefined,
    opts: TranslationPolicyReplayDigestDigestForensicEventOptionsInput = {},
): TranslationPolicyReplayDigestDigestForensicEventAdapter | null {
    if (!sink) return null;
    return new TranslationPolicyReplayDigestDigestForensicEventAdapter(
        sink,
        mergeTranslationPolicyReplayDigestDigestForensicEventOptions(opts),
    );
}

export function mergeTranslationPolicyReplayDigestDigestForensicEventOptions(
    opts: TranslationPolicyReplayDigestDigestForensicEventOptionsInput = {},
): TranslationPolicyReplayDigestDigestForensicEventOptions {
    return {
        ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_OPTS,
        now_ms: () => Date.now(),
        ...opts,
    };
}

export function translationPolicyReplayDigestDigestForensicPayload(
    snapshot: ReplayDigestDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
    emitted_at_ms: number,
): TranslationPolicyReplayDigestDigestForensicPayload {
    const hud = formatTranslationPolicyReplayDigestDigestHud(snapshot, telemetry);
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        hud_schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA,
        emitted_at_ms,
        band: hud.band,
        consensus_digest: snapshot.consensus_digest ?? 0,
        consensus_count: snapshot.consensus_count >>> 0,
        total_claims: snapshot.total_claims >>> 0,
        agreement_q16: snapshot.agreement_q16 >>> 0,
        distinct_digest_count: snapshot.distinct_digests.length >>> 0,
        dissenter_count: snapshot.dissenter_peer_ids.length >>> 0,
        malformed_count: telemetry.claims_malformed >>> 0,
        local_claims_emitted: telemetry.local_claims_emitted >>> 0,
        local_claims_failed: telemetry.local_claims_failed >>> 0,
        local_claims_skipped: telemetry.local_claims_skipped >>> 0,
    };
}

export function translationPolicyReplayDigestDigestForensicProjection(
    payload: TranslationPolicyReplayDigestDigestForensicPayload,
): string {
    return [
        payload.schema,
        payload.hud_schema,
        payload.band,
        num(payload.consensus_digest),
        num(payload.consensus_count),
        num(payload.total_claims),
        num(payload.agreement_q16),
        num(payload.distinct_digest_count),
        num(payload.dissenter_count),
        num(payload.malformed_count),
        num(payload.local_claims_emitted),
        num(payload.local_claims_failed),
        num(payload.local_claims_skipped),
    ].join("|");
}

function num(value: number): string {
    return Number.isFinite(value) ? String(value >>> 0) : "0";
}
