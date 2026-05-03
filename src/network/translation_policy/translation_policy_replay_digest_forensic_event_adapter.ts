// OMEGA-64: Era 1910 - Translation Policy Replay Digest Forensic Events
//
// Replay-digest quorum is live and HUD-readable as of Era 1900. This
// adapter records compact `tpdq` forensic events when the quorum/HUD
// projection changes, without owning timers, DOM, or mesh state.

import { fnv1a32 } from "../cross_model_debate.ts";
import {
    ForensicEvent,
    ForensicEventSink,
} from "../forensic_event_sink.ts";
import type {
    ReplayDigestQuorumSnapshot,
} from "./translation_policy_replay_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestLiveWiringTelemetry,
} from "./translation_policy_replay_digest_live_wiring.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA,
    TranslationPolicyReplayDigestHudBand,
    formatTranslationPolicyReplayDigestHud,
} from "./translation_policy_replay_digest_hud.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA =
    "OMEGA-1910/v1";

export interface TranslationPolicyReplayDigestForensicEventOptions {
    enabled: boolean;
    kind: string;
    now_ms: () => number;
}

export type TranslationPolicyReplayDigestForensicEventOptionsInput =
    Partial<TranslationPolicyReplayDigestForensicEventOptions>;

export interface TranslationPolicyReplayDigestForensicPayload {
    schema: string;
    hud_schema: string;
    emitted_at_ms: number;
    band: TranslationPolicyReplayDigestHudBand;
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

export interface TranslationPolicyReplayDigestForensicTelemetry {
    snapshots_received: number;
    appended_events: number;
    skipped_unchanged: number;
    append_failed: number;
    active: boolean;
    last_event_hash: number | null;
}

export interface TranslationPolicyReplayDigestForensicHandleResult {
    appended: boolean;
    reason: "appended" | "disabled" | "unchanged" | "append-error";
    event: ForensicEvent | null;
    event_hash: number | null;
    error?: string;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_OPTS:
    Omit<TranslationPolicyReplayDigestForensicEventOptions, "now_ms"> = {
        enabled: false,
        kind: "tpdq",
    };

const encoder = new TextEncoder();

export class TranslationPolicyReplayDigestForensicEventAdapter {
    private lastProjection: string | null = null;
    private lastEventHash: number | null = null;
    private stats: TranslationPolicyReplayDigestForensicTelemetry = {
        snapshots_received: 0,
        appended_events: 0,
        skipped_unchanged: 0,
        append_failed: 0,
        active: false,
        last_event_hash: null,
    };

    constructor(
        public readonly sink: ForensicEventSink,
        public readonly opts: TranslationPolicyReplayDigestForensicEventOptions = {
            ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_OPTS,
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

    telemetry(): TranslationPolicyReplayDigestForensicTelemetry {
        return {
            ...this.stats,
            last_event_hash: this.lastEventHash,
        };
    }

    handleSnapshot(
        snapshot: ReplayDigestQuorumSnapshot,
        telemetry: TranslationPolicyReplayDigestLiveWiringTelemetry,
    ): TranslationPolicyReplayDigestForensicHandleResult {
        if (!this.opts.enabled) return this.result("disabled", null, null);
        this.stats.snapshots_received++;
        const payload = translationPolicyReplayDigestForensicPayload(
            snapshot,
            telemetry,
            this.opts.now_ms(),
        );
        const projection = translationPolicyReplayDigestForensicProjection(payload);
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
        reason: TranslationPolicyReplayDigestForensicHandleResult["reason"],
        event: ForensicEvent | null,
        event_hash: number | null,
    ): TranslationPolicyReplayDigestForensicHandleResult {
        return {
            appended: reason === "appended",
            reason,
            event,
            event_hash,
        };
    }
}

export function createTranslationPolicyReplayDigestForensicEventAdapter(
    sink: ForensicEventSink | null | undefined,
    opts: TranslationPolicyReplayDigestForensicEventOptionsInput = {},
): TranslationPolicyReplayDigestForensicEventAdapter | null {
    if (!sink) return null;
    return new TranslationPolicyReplayDigestForensicEventAdapter(
        sink,
        mergeTranslationPolicyReplayDigestForensicEventOptions(opts),
    );
}

export function mergeTranslationPolicyReplayDigestForensicEventOptions(
    opts: TranslationPolicyReplayDigestForensicEventOptionsInput = {},
): TranslationPolicyReplayDigestForensicEventOptions {
    return {
        ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_OPTS,
        now_ms: () => Date.now(),
        ...opts,
    };
}

export function translationPolicyReplayDigestForensicPayload(
    snapshot: ReplayDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestLiveWiringTelemetry,
    emitted_at_ms: number,
): TranslationPolicyReplayDigestForensicPayload {
    const hud = formatTranslationPolicyReplayDigestHud(snapshot, telemetry);
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        hud_schema: TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA,
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

export function translationPolicyReplayDigestForensicProjection(
    payload: TranslationPolicyReplayDigestForensicPayload,
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
