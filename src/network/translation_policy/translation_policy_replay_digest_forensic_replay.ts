// OMEGA-64: Era 1920 - Translation Policy Replay Digest Forensic Replay
//
// Era 1910 writes compact `tpdq` forensic events. This module replays
// already-synced sink snapshots into deterministic interpretation
// timelines without mutating the sink or subscribing to live state.

import type {
    ForensicEvent,
    ForensicEventSink,
} from "../forensic_event_sink.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
    TranslationPolicyReplayDigestForensicPayload,
} from "./translation_policy_replay_digest_forensic_event_adapter.ts";
import type {
    TranslationPolicyReplayDigestHudBand,
} from "./translation_policy_replay_digest_hud.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_SCHEMA =
    "OMEGA-1920/v1";

export type TranslationPolicyReplayDigestErrorKind =
    | "drift"
    | "malformed"
    | "local-claim-failed";

export interface TranslationPolicyReplayDigestForensicReplayOptions {
    kind: string;
}

export type TranslationPolicyReplayDigestForensicReplayOptionsInput =
    Partial<TranslationPolicyReplayDigestForensicReplayOptions>;

export interface TranslationPolicyReplayDigestBandSegment {
    band: TranslationPolicyReplayDigestHudBand;
    start_ms: number;
    end_ms: number | null;
    start_sequence: number;
    end_sequence: number | null;
    event_hash: number;
}

export interface TranslationPolicyReplayDigestConsensusInterval {
    consensus_digest: number;
    start_ms: number;
    end_ms: number | null;
    start_sequence: number;
    end_sequence: number | null;
    consensus_count: number;
    total_claims: number;
    agreement_q16: number;
}

export interface TranslationPolicyReplayDigestErrorWindow {
    kind: TranslationPolicyReplayDigestErrorKind;
    message: string | null;
    start_ms: number;
    end_ms: number | null;
    start_sequence: number;
    end_sequence: number | null;
    first_event_hash: number;
    last_event_hash: number;
}

export interface TranslationPolicyReplayDigestForensicReplayClassification {
    schema: string;
    total_events: number;
    classified_events: number;
    ignored_events: number;
    malformed_payloads: number;
    first_event_ms: number | null;
    last_event_ms: number | null;
    final_band: TranslationPolicyReplayDigestHudBand | null;
    final_consensus_digest: number | null;
    band_timeline: TranslationPolicyReplayDigestBandSegment[];
    consensus_digest_intervals: TranslationPolicyReplayDigestConsensusInterval[];
    error_windows: TranslationPolicyReplayDigestErrorWindow[];
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_OPTS:
    TranslationPolicyReplayDigestForensicReplayOptions = {
        kind: "tpdq",
    };

export function classifyTranslationPolicyReplayDigestForensicSink(
    sink: ForensicEventSink,
    opts: TranslationPolicyReplayDigestForensicReplayOptionsInput = {},
): TranslationPolicyReplayDigestForensicReplayClassification {
    return classifyTranslationPolicyReplayDigestForensicEvents(sink.list(), opts);
}

export function classifyTranslationPolicyReplayDigestForensicEvents(
    events: ReadonlyArray<ForensicEvent>,
    opts: TranslationPolicyReplayDigestForensicReplayOptionsInput = {},
): TranslationPolicyReplayDigestForensicReplayClassification {
    const cfg = {
        ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_OPTS,
        ...opts,
    };
    const ordered = [...events].sort(compareEvents);
    const payloads: Array<{
        event: ForensicEvent;
        payload: TranslationPolicyReplayDigestForensicPayload;
    }> = [];
    let ignored = 0;
    let malformed = 0;
    for (const event of ordered) {
        if (event.kind !== cfg.kind) {
            ignored++;
            continue;
        }
        const payload = parseTranslationPolicyReplayDigestForensicPayload(
            event.payload,
        );
        if (!payload) {
            malformed++;
            continue;
        }
        payloads.push({ event, payload });
    }
    const first = payloads[0];
    const last = payloads[payloads.length - 1];
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_SCHEMA,
        total_events: events.length,
        classified_events: payloads.length,
        ignored_events: ignored,
        malformed_payloads: malformed,
        first_event_ms: first?.event.sunk_at_ms ?? null,
        last_event_ms: last?.event.sunk_at_ms ?? null,
        final_band: last?.payload.band ?? null,
        final_consensus_digest: last?.payload.consensus_digest ?? null,
        band_timeline: buildBandTimeline(payloads),
        consensus_digest_intervals: buildConsensusIntervals(payloads),
        error_windows: buildErrorWindows(payloads),
    };
}

export function parseTranslationPolicyReplayDigestForensicPayload(
    payload: unknown,
): TranslationPolicyReplayDigestForensicPayload | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Partial<TranslationPolicyReplayDigestForensicPayload>;
    if (p.schema !== TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA) {
        return null;
    }
    if (!isBand(p.band)) return null;
    if (typeof p.hud_schema !== "string") return null;
    for (const key of NUMERIC_PAYLOAD_KEYS) {
        if (!Number.isFinite(p[key])) return null;
    }
    return p as TranslationPolicyReplayDigestForensicPayload;
}

function buildBandTimeline(
    payloads: ReadonlyArray<{
        event: ForensicEvent;
        payload: TranslationPolicyReplayDigestForensicPayload;
    }>,
): TranslationPolicyReplayDigestBandSegment[] {
    const out: TranslationPolicyReplayDigestBandSegment[] = [];
    let previous:
        | { event: ForensicEvent; payload: TranslationPolicyReplayDigestForensicPayload }
        | null = null;
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

function buildConsensusIntervals(
    payloads: ReadonlyArray<{
        event: ForensicEvent;
        payload: TranslationPolicyReplayDigestForensicPayload;
    }>,
): TranslationPolicyReplayDigestConsensusInterval[] {
    const out: TranslationPolicyReplayDigestConsensusInterval[] = [];
    let previous:
        | { event: ForensicEvent; payload: TranslationPolicyReplayDigestForensicPayload }
        | null = null;
    for (const item of payloads) {
        const digest = item.payload.consensus_digest >>> 0;
        const last = out[out.length - 1];
        if (last && last.consensus_digest === digest) {
            last.end_ms = item.event.sunk_at_ms;
            last.end_sequence = item.event.sequence;
            last.consensus_count = item.payload.consensus_count >>> 0;
            last.total_claims = item.payload.total_claims >>> 0;
            last.agreement_q16 = item.payload.agreement_q16 >>> 0;
            previous = item;
            continue;
        }
        closePreviousSegment(last, previous);
        out.push({
            consensus_digest: digest,
            start_ms: item.event.sunk_at_ms,
            end_ms: null,
            start_sequence: item.event.sequence,
            end_sequence: null,
            consensus_count: item.payload.consensus_count >>> 0,
            total_claims: item.payload.total_claims >>> 0,
            agreement_q16: item.payload.agreement_q16 >>> 0,
        });
        previous = item;
    }
    closeOpenTimeline(out, payloads);
    return out;
}

function buildErrorWindows(
    payloads: ReadonlyArray<{
        event: ForensicEvent;
        payload: TranslationPolicyReplayDigestForensicPayload;
    }>,
): TranslationPolicyReplayDigestErrorWindow[] {
    const out: TranslationPolicyReplayDigestErrorWindow[] = [];
    const active = new Map<
        TranslationPolicyReplayDigestErrorKind,
        TranslationPolicyReplayDigestErrorWindow
    >();
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
            if (existing) out.push(existing);
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
    payload: TranslationPolicyReplayDigestForensicPayload,
): Array<{ kind: TranslationPolicyReplayDigestErrorKind; message: string | null }> {
    const out: Array<{
        kind: TranslationPolicyReplayDigestErrorKind;
        message: string | null;
    }> = [];
    if (payload.dissenter_count > 0 || payload.band === "drift") {
        out.push({ kind: "drift", message: String(payload.dissenter_count >>> 0) });
    }
    if (payload.malformed_count > 0) {
        out.push({ kind: "malformed", message: String(payload.malformed_count >>> 0) });
    }
    if (payload.local_claims_failed > 0) {
        out.push({
            kind: "local-claim-failed",
            message: String(payload.local_claims_failed >>> 0),
        });
    }
    return out;
}

function closeOpenTimeline<
    T extends { end_ms: number | null; end_sequence: number | null },
>(
    timeline: T[],
    payloads: ReadonlyArray<{
        event: ForensicEvent;
        payload: TranslationPolicyReplayDigestForensicPayload;
    }>,
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
    previous:
        | { event: ForensicEvent; payload: TranslationPolicyReplayDigestForensicPayload }
        | null,
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

function isBand(value: unknown): value is TranslationPolicyReplayDigestHudBand {
    return value === "nominal" ||
        value === "watch" ||
        value === "drift" ||
        value === "blocked";
}

const NUMERIC_PAYLOAD_KEYS = [
    "emitted_at_ms",
    "consensus_digest",
    "consensus_count",
    "total_claims",
    "agreement_q16",
    "distinct_digest_count",
    "dissenter_count",
    "malformed_count",
    "local_claims_emitted",
    "local_claims_failed",
    "local_claims_skipped",
] as const;
