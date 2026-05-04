// OMEGA-64: Era 1830 - Translation Policy Forensic Event Sink Adapter
//
// The bootstrap telemetry event stream is operational diagnostics. This
// adapter turns selected state transitions into compact forensic events
// without making bootstrap know about sinks.

import type { EventSource } from "../quarantine_lifecycle_bridge.ts";
import { sha256_u32 } from "../../sdk/phi_crypto.ts";
import {
    ForensicEvent,
    ForensicEventSink,
} from "../forensic_event_sink.ts";
import {
    translationPolicyHudBand,
    TranslationPolicyHudBand,
} from "./translation_policy_hud.ts";
import type {
    TranslationPolicyTelemetryEventDetail,
} from "../../bootstrap/translation_policy/translation_policy_telemetry_event.ts";
import {
    TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
} from "../../bootstrap/translation_policy/translation_policy_telemetry_event.ts";

export const TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA = "OMEGA-1830/v1";

export interface TranslationPolicyForensicEventOptions {
    enabled: boolean;
    event_name: string;
    kind: string;
    now_ms: () => number;
}

export type TranslationPolicyForensicEventOptionsInput =
    Partial<TranslationPolicyForensicEventOptions>;

export type TranslationPolicyForensicBand =
    | TranslationPolicyHudBand
    | "disabled"
    | "install-error"
    | "tick-error";

export interface TranslationPolicyForensicPayload {
    schema: string;
    telemetry_schema: string;
    source_hash: number;
    emitted_at_ms: number;
    band: TranslationPolicyForensicBand;
    installed: boolean;
    install_reason: string;
    install_error: string | null;
    tick_reason: string;
    tick_error: string | null;
    local_policy_hash: number;
    local_pair_count: number;
    peer_count: number;
    due_peer_count: number;
    drift_peer_count: number;
    monitor_alarm_count: number;
    proposals_emitted: number;
    proposals_failed: number;
    malformed_count: number;
}

export interface TranslationPolicyForensicTelemetry {
    events_received: number;
    malformed_events: number;
    appended_events: number;
    skipped_unchanged: number;
    append_failed: number;
    active: boolean;
    last_event_hash: number | null;
}

export interface TranslationPolicyForensicHandleResult {
    appended: boolean;
    reason: "appended" | "disabled" | "malformed" | "unchanged" | "append-error";
    event: ForensicEvent | null;
    event_hash: number | null;
    error?: string;
}

export const DEFAULT_TRANSLATION_POLICY_FORENSIC_EVENT_OPTS:
    Omit<TranslationPolicyForensicEventOptions, "now_ms"> = {
        enabled: false,
        event_name: "translationPolicyTelemetry",
        kind: "tpol",
    };

const encoder = new TextEncoder();

export class TranslationPolicyForensicEventAdapter {
    private listener?: (event: { detail: unknown }) => void;
    private active = false;
    private lastProjection: string | null = null;
    private lastEventHash: number | null = null;
    private stats: TranslationPolicyForensicTelemetry = {
        events_received: 0,
        malformed_events: 0,
        appended_events: 0,
        skipped_unchanged: 0,
        append_failed: 0,
        active: false,
        last_event_hash: null,
    };

    constructor(
        public readonly sink: ForensicEventSink,
        public readonly source: EventSource,
        public readonly opts: TranslationPolicyForensicEventOptions = {
            ...DEFAULT_TRANSLATION_POLICY_FORENSIC_EVENT_OPTS,
            now_ms: () => Date.now(),
        },
    ) {}

    start(): void {
        if (this.active || !this.opts.enabled) return;
        this.listener = (event) => {
            this.handleDetail(event.detail);
        };
        this.source.addEventListener(this.opts.event_name, this.listener);
        this.active = true;
        this.stats.active = true;
    }

    stop(): void {
        if (!this.active) return;
        if (this.listener) {
            this.source.removeEventListener(this.opts.event_name, this.listener);
        }
        this.listener = undefined;
        this.active = false;
        this.stats.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    telemetry(): TranslationPolicyForensicTelemetry {
        return {
            ...this.stats,
            active: this.active,
            last_event_hash: this.lastEventHash,
        };
    }

    handleDetail(detail: unknown): TranslationPolicyForensicHandleResult {
        if (!this.opts.enabled) return this.result("disabled", null, null);
        this.stats.events_received++;
        const eventDetail = parseTelemetryDetail(detail);
        if (!eventDetail) {
            this.stats.malformed_events++;
            return this.result("malformed", null, null);
        }
        const payload = translationPolicyForensicPayload(eventDetail);
        const projection = translationPolicyForensicProjection(payload);
        const eventHash = sha256_u32(encoder.encode(projection));
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
        reason: TranslationPolicyForensicHandleResult["reason"],
        event: ForensicEvent | null,
        event_hash: number | null,
    ): TranslationPolicyForensicHandleResult {
        return {
            appended: reason === "appended",
            reason,
            event,
            event_hash,
        };
    }
}

export function createTranslationPolicyForensicEventAdapter(
    sink: ForensicEventSink | null | undefined,
    source: EventSource | null | undefined,
    opts: TranslationPolicyForensicEventOptionsInput = {},
): TranslationPolicyForensicEventAdapter | null {
    if (!sink || !source) return null;
    return new TranslationPolicyForensicEventAdapter(
        sink,
        source,
        mergeTranslationPolicyForensicEventOptions(opts),
    );
}

export function mergeTranslationPolicyForensicEventOptions(
    opts: TranslationPolicyForensicEventOptionsInput = {},
): TranslationPolicyForensicEventOptions {
    return {
        ...DEFAULT_TRANSLATION_POLICY_FORENSIC_EVENT_OPTS,
        now_ms: () => Date.now(),
        ...opts,
    };
}

export function translationPolicyForensicPayload(
    detail: TranslationPolicyTelemetryEventDetail,
): TranslationPolicyForensicPayload {
    const snapshot = detail.snapshot;
    const runtime = snapshot.runtime;
    const loop = runtime?.loop;
    const live = runtime?.live;
    const directory = runtime?.directory;
    return {
        schema: TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA,
        telemetry_schema: detail.schema,
        source_hash: detail.hash >>> 0,
        emitted_at_ms: detail.emitted_at_ms,
        band: translationPolicyForensicBand(detail),
        installed: snapshot.installed,
        install_reason: snapshot.install_reason,
        install_error: snapshot.install_error,
        tick_reason: snapshot.tick.reason,
        tick_error: snapshot.tick.error,
        local_policy_hash: loop?.local_policy_hash ?? 0,
        local_pair_count: loop?.local_pair_count ?? 0,
        peer_count: runtime?.peer_count ?? 0,
        due_peer_count: runtime?.due_peer_count ?? 0,
        drift_peer_count: loop?.drift_peer_count ?? 0,
        monitor_alarm_count: loop?.monitor_alarm_count ?? 0,
        proposals_emitted: loop?.proposals_emitted ?? 0,
        proposals_failed: loop?.proposals_failed ?? 0,
        malformed_count:
            (loop?.malformed_claims ?? 0) +
            (live?.claims_malformed ?? 0) +
            (live?.corroboration_raises_malformed ?? 0) +
            (directory?.malformed_events ?? 0),
    };
}

export function translationPolicyForensicBand(
    detail: TranslationPolicyTelemetryEventDetail,
): TranslationPolicyForensicBand {
    const snapshot = detail.snapshot;
    if (snapshot.install_reason === "install-error") return "install-error";
    if (!snapshot.installed) return "disabled";
    if (snapshot.tick.reason === "runtime-error") return "tick-error";
    if (!snapshot.runtime) return "watch";
    return translationPolicyHudBand(snapshot.runtime);
}

export function translationPolicyForensicProjection(
    payload: TranslationPolicyForensicPayload,
): string {
    return [
        payload.schema,
        payload.band,
        bool(payload.installed),
        payload.install_reason,
        payload.install_error ?? "",
        payload.tick_reason,
        payload.tick_error ?? "",
        num(payload.local_policy_hash),
        num(payload.local_pair_count),
        num(payload.peer_count),
        num(payload.due_peer_count),
        num(payload.drift_peer_count),
        num(payload.monitor_alarm_count),
        num(payload.proposals_emitted),
        num(payload.proposals_failed),
        num(payload.malformed_count),
    ].join("|");
}

function parseTelemetryDetail(
    detail: unknown,
): TranslationPolicyTelemetryEventDetail | null {
    if (!detail || typeof detail !== "object") return null;
    const maybe = detail as Partial<TranslationPolicyTelemetryEventDetail>;
    if (maybe.schema !== TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA) return null;
    if (!Number.isFinite(maybe.hash)) return null;
    if (!Number.isFinite(maybe.emitted_at_ms)) return null;
    if (!maybe.snapshot || typeof maybe.snapshot !== "object") return null;
    return maybe as TranslationPolicyTelemetryEventDetail;
}

function bool(value: boolean): string {
    return value ? "1" : "0";
}

function num(value: number): string {
    return Number.isFinite(value) ? String(value >>> 0) : "0";
}
