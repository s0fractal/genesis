// OMEGA-64: Era 1840 - Translation Policy Forensic Replay Classifier
//
// Era 1830 writes compact `tpol` forensic events. This module keeps
// replay pure: classify an already-synced sink snapshot into timelines
// without mutating the sink or subscribing to live telemetry.

import type {
    ForensicEvent,
    ForensicEventSink,
} from "./forensic_event_sink.ts";
import {
    TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA,
    TranslationPolicyForensicBand,
    TranslationPolicyForensicPayload,
} from "./translation_policy_forensic_event_adapter.ts";

export const TRANSLATION_POLICY_FORENSIC_REPLAY_SCHEMA = "OMEGA-1840/v1";

export type TranslationPolicyForensicErrorKind =
    | "install-error"
    | "tick-error"
    | "proposal-failed"
    | "malformed";

export interface TranslationPolicyForensicReplayOptions {
    kind: string;
}

export type TranslationPolicyForensicReplayOptionsInput =
    Partial<TranslationPolicyForensicReplayOptions>;

export interface TranslationPolicyBandTimelineSegment {
    band: TranslationPolicyForensicBand;
    start_ms: number;
    end_ms: number | null;
    start_sequence: number;
    end_sequence: number | null;
    event_hash: number;
}

export interface TranslationPolicyHashInterval {
    local_policy_hash: number;
    start_ms: number;
    end_ms: number | null;
    start_sequence: number;
    end_sequence: number | null;
    local_pair_count: number;
}

export interface TranslationPolicyErrorWindow {
    kind: TranslationPolicyForensicErrorKind;
    message: string | null;
    start_ms: number;
    end_ms: number | null;
    start_sequence: number;
    end_sequence: number | null;
    first_event_hash: number;
    last_event_hash: number;
}

export interface TranslationPolicyForensicReplayClassification {
    schema: string;
    total_events: number;
    classified_events: number;
    ignored_events: number;
    malformed_payloads: number;
    first_event_ms: number | null;
    last_event_ms: number | null;
    final_band: TranslationPolicyForensicBand | null;
    final_policy_hash: number | null;
    band_timeline: TranslationPolicyBandTimelineSegment[];
    policy_hash_intervals: TranslationPolicyHashInterval[];
    error_windows: TranslationPolicyErrorWindow[];
}

export const DEFAULT_TRANSLATION_POLICY_FORENSIC_REPLAY_OPTS:
    TranslationPolicyForensicReplayOptions = {
        kind: "tpol",
    };

export function classifyTranslationPolicyForensicSink(
    sink: ForensicEventSink,
    opts: TranslationPolicyForensicReplayOptionsInput = {},
): TranslationPolicyForensicReplayClassification {
    return classifyTranslationPolicyForensicEvents(sink.list(), opts);
}

export function classifyTranslationPolicyForensicEvents(
    events: ReadonlyArray<ForensicEvent>,
    opts: TranslationPolicyForensicReplayOptionsInput = {},
): TranslationPolicyForensicReplayClassification {
    const cfg = { ...DEFAULT_TRANSLATION_POLICY_FORENSIC_REPLAY_OPTS, ...opts };
    const ordered = [...events].sort(compareEvents);
    const payloads: Array<{ event: ForensicEvent; payload: TranslationPolicyForensicPayload }> = [];
    let ignored = 0;
    let malformed = 0;
    for (const event of ordered) {
        if (event.kind !== cfg.kind) {
            ignored++;
            continue;
        }
        const payload = parseTranslationPolicyForensicPayload(event.payload);
        if (!payload) {
            malformed++;
            continue;
        }
        payloads.push({ event, payload });
    }
    const bandTimeline = buildBandTimeline(payloads);
    const policyIntervals = buildPolicyIntervals(payloads);
    const errorWindows = buildErrorWindows(payloads);
    const first = payloads[0];
    const last = payloads[payloads.length - 1];
    return {
        schema: TRANSLATION_POLICY_FORENSIC_REPLAY_SCHEMA,
        total_events: events.length,
        classified_events: payloads.length,
        ignored_events: ignored,
        malformed_payloads: malformed,
        first_event_ms: first?.event.sunk_at_ms ?? null,
        last_event_ms: last?.event.sunk_at_ms ?? null,
        final_band: last?.payload.band ?? null,
        final_policy_hash: last?.payload.local_policy_hash ?? null,
        band_timeline: bandTimeline,
        policy_hash_intervals: policyIntervals,
        error_windows: errorWindows,
    };
}

export function parseTranslationPolicyForensicPayload(
    payload: unknown,
): TranslationPolicyForensicPayload | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Partial<TranslationPolicyForensicPayload>;
    if (p.schema !== TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA) return null;
    if (!isBand(p.band)) return null;
    if (typeof p.installed !== "boolean") return null;
    if (typeof p.install_reason !== "string") return null;
    if (p.install_error !== null && typeof p.install_error !== "string") return null;
    if (typeof p.tick_reason !== "string") return null;
    if (p.tick_error !== null && typeof p.tick_error !== "string") return null;
    for (const key of NUMERIC_PAYLOAD_KEYS) {
        if (!Number.isFinite(p[key])) return null;
    }
    return p as TranslationPolicyForensicPayload;
}

function buildBandTimeline(
    payloads: ReadonlyArray<{ event: ForensicEvent; payload: TranslationPolicyForensicPayload }>,
): TranslationPolicyBandTimelineSegment[] {
    const out: TranslationPolicyBandTimelineSegment[] = [];
    let previous:
        { event: ForensicEvent; payload: TranslationPolicyForensicPayload } | null = null;
    for (const item of payloads) {
        const last = out[out.length - 1];
        if (last && last.band === item.payload.band) {
            last.end_ms = item.event.sunk_at_ms;
            last.end_sequence = item.event.sequence;
            previous = item;
            continue;
        }
        closePreviousSegment(last, previous);
        out.push({
            band: item.payload.band,
            start_ms: item.event.sunk_at_ms,
            end_ms: null,
            start_sequence: item.event.sequence,
            end_sequence: null,
            event_hash: item.event.event_hash,
        });
        previous = item;
    }
    closeOpenTimeline(out, payloads);
    return out;
}

function buildPolicyIntervals(
    payloads: ReadonlyArray<{ event: ForensicEvent; payload: TranslationPolicyForensicPayload }>,
): TranslationPolicyHashInterval[] {
    const out: TranslationPolicyHashInterval[] = [];
    let previous:
        { event: ForensicEvent; payload: TranslationPolicyForensicPayload } | null = null;
    for (const item of payloads) {
        const hash = item.payload.local_policy_hash >>> 0;
        const last = out[out.length - 1];
        if (last && last.local_policy_hash === hash) {
            last.end_ms = item.event.sunk_at_ms;
            last.end_sequence = item.event.sequence;
            previous = item;
            continue;
        }
        closePreviousSegment(last, previous);
        out.push({
            local_policy_hash: hash,
            start_ms: item.event.sunk_at_ms,
            end_ms: null,
            start_sequence: item.event.sequence,
            end_sequence: null,
            local_pair_count: item.payload.local_pair_count >>> 0,
        });
        previous = item;
    }
    closeOpenTimeline(out, payloads);
    return out;
}

function buildErrorWindows(
    payloads: ReadonlyArray<{ event: ForensicEvent; payload: TranslationPolicyForensicPayload }>,
): TranslationPolicyErrorWindow[] {
    const out: TranslationPolicyErrorWindow[] = [];
    const active = new Map<TranslationPolicyForensicErrorKind, TranslationPolicyErrorWindow>();
    for (const item of payloads) {
        const current = activeErrors(item.payload);
        for (const err of current) {
            const existing = active.get(err.kind);
            if (existing && existing.message === err.message) {
                existing.end_ms = item.event.sunk_at_ms;
                existing.end_sequence = item.event.sequence;
                existing.last_event_hash = item.event.event_hash;
                continue;
            }
            if (existing) {
                out.push(existing);
            }
            active.set(err.kind, {
                kind: err.kind,
                message: err.message,
                start_ms: item.event.sunk_at_ms,
                end_ms: item.event.sunk_at_ms,
                start_sequence: item.event.sequence,
                end_sequence: item.event.sequence,
                first_event_hash: item.event.event_hash,
                last_event_hash: item.event.event_hash,
            });
        }
        for (const [kind, window] of active) {
            if (!current.some((err) => err.kind === kind)) {
                out.push(window);
                active.delete(kind);
            }
        }
    }
    for (const window of active.values()) {
        out.push({ ...window, end_ms: null, end_sequence: null });
    }
    out.sort((a, b) => {
        if (a.start_ms !== b.start_ms) return a.start_ms - b.start_ms;
        if (a.start_sequence !== b.start_sequence) {
            return a.start_sequence - b.start_sequence;
        }
        return a.kind.localeCompare(b.kind);
    });
    return out;
}

function activeErrors(
    payload: TranslationPolicyForensicPayload,
): Array<{ kind: TranslationPolicyForensicErrorKind; message: string | null }> {
    const out: Array<{ kind: TranslationPolicyForensicErrorKind; message: string | null }> = [];
    if (payload.install_error) {
        out.push({ kind: "install-error", message: payload.install_error });
    }
    if (payload.tick_error) {
        out.push({ kind: "tick-error", message: payload.tick_error });
    }
    if (payload.proposals_failed > 0) {
        out.push({ kind: "proposal-failed", message: String(payload.proposals_failed >>> 0) });
    }
    if (payload.malformed_count > 0) {
        out.push({ kind: "malformed", message: String(payload.malformed_count >>> 0) });
    }
    return out;
}

function closeOpenTimeline<
    T extends { end_ms: number | null; end_sequence: number | null },
>(
    timeline: T[],
    payloads: ReadonlyArray<{ event: ForensicEvent; payload: TranslationPolicyForensicPayload }>,
): void {
    if (timeline.length === 0 || payloads.length === 0) return;
    const lastEvent = payloads[payloads.length - 1].event;
    const last = timeline[timeline.length - 1];
    last.end_ms = lastEvent.sunk_at_ms;
    last.end_sequence = lastEvent.sequence;
}

function closePreviousSegment<
    T extends { end_ms: number | null; end_sequence: number | null },
>(
    segment: T | undefined,
    previous: { event: ForensicEvent; payload: TranslationPolicyForensicPayload } | null,
): void {
    if (!segment || !previous || segment.end_ms !== null) return;
    segment.end_ms = previous.event.sunk_at_ms;
    segment.end_sequence = previous.event.sequence;
}

function compareEvents(a: ForensicEvent, b: ForensicEvent): number {
    if (a.sunk_at_ms !== b.sunk_at_ms) return a.sunk_at_ms - b.sunk_at_ms;
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return (a.event_hash >>> 0) - (b.event_hash >>> 0);
}

function isBand(value: unknown): value is TranslationPolicyForensicBand {
    return value === "nominal" ||
        value === "watch" ||
        value === "drift" ||
        value === "blocked" ||
        value === "disabled" ||
        value === "install-error" ||
        value === "tick-error";
}

const NUMERIC_PAYLOAD_KEYS = [
    "source_hash",
    "emitted_at_ms",
    "local_policy_hash",
    "local_pair_count",
    "peer_count",
    "due_peer_count",
    "drift_peer_count",
    "monitor_alarm_count",
    "proposals_emitted",
    "proposals_failed",
    "malformed_count",
] as const;
