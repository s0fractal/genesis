// OMEGA-64: Era 1850 - Translation Policy Forensic Replay HUD Summary
//
// Era 1840 reconstructs replay timelines. This formatter turns that
// classification into compact operator/report fields without touching
// DOM, sinks, or live event streams.

import type {
    TranslationPolicyErrorWindow,
    TranslationPolicyForensicReplayClassification,
} from "./translation_policy_forensic_replay.ts";
import type {
    TranslationPolicyForensicBand,
} from "./translation_policy_forensic_event_adapter.ts";

export const TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_SCHEMA = "OMEGA-1850/v1";

export interface TranslationPolicyForensicReplayHudField {
    label: string;
    value: string;
}

export interface TranslationPolicyForensicReplayHudSnapshot {
    schema: string;
    band: TranslationPolicyForensicBand | "empty";
    glyph: string;
    summary: string;
    drift_duration_ms: number;
    malformed_count: number;
    active_error: TranslationPolicyErrorWindow | null;
    fields: {
        band: TranslationPolicyForensicReplayHudField;
        policy: TranslationPolicyForensicReplayHudField;
        error: TranslationPolicyForensicReplayHudField;
        drift: TranslationPolicyForensicReplayHudField;
    };
}

export interface TranslationPolicyForensicReplayHudOptions {
    max_summary_len: number;
}

export const DEFAULT_TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_OPTS:
    TranslationPolicyForensicReplayHudOptions = {
        max_summary_len: 112,
    };

export function formatTranslationPolicyForensicReplayHud(
    classification: TranslationPolicyForensicReplayClassification,
    opts: Partial<TranslationPolicyForensicReplayHudOptions> = {},
): TranslationPolicyForensicReplayHudSnapshot {
    const cfg = { ...DEFAULT_TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_OPTS, ...opts };
    const band = classification.final_band ?? "empty";
    const glyph = forensicReplayGlyph(band);
    const policyHash = classification.final_policy_hash === null
        ? "--------"
        : hex8(classification.final_policy_hash);
    const activeError = firstActiveErrorWindow(classification);
    const driftDurationMs = translationPolicyReplayDriftDurationMs(classification);
    const malformedCount = translationPolicyReplayMalformedCount(classification);
    const errorValue = activeError
        ? `${activeError.kind}:${activeError.message ?? ""}`
        : "none";
    const fields = {
        band: {
            label: "TPOL REPLAY",
            value: `${glyph} ${band.toUpperCase()} ${classification.classified_events}/${classification.total_events}`,
        },
        policy: {
            label: "TPOL POLICY",
            value: `P${policyHash} I${classification.policy_hash_intervals.length}`,
        },
        error: {
            label: "TPOL ERROR",
            value: errorValue,
        },
        drift: {
            label: "TPOL DRIFT",
            value: `${formatDuration(driftDurationMs)} M${malformedCount}`,
        },
    };
    const summary = truncate(
        `${fields.band.value} | ${fields.policy.value} | E ${fields.error.value} | D ${fields.drift.value}`,
        cfg.max_summary_len,
    );
    return {
        schema: TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_SCHEMA,
        band,
        glyph,
        summary,
        drift_duration_ms: driftDurationMs,
        malformed_count: malformedCount,
        active_error: activeError,
        fields,
    };
}

export function translationPolicyForensicReplayHudFields(
    classification: TranslationPolicyForensicReplayClassification,
    opts: Partial<TranslationPolicyForensicReplayHudOptions> = {},
): TranslationPolicyForensicReplayHudField[] {
    const snap = formatTranslationPolicyForensicReplayHud(classification, opts);
    return [snap.fields.band, snap.fields.policy, snap.fields.error, snap.fields.drift];
}

export function translationPolicyReplayDriftDurationMs(
    classification: TranslationPolicyForensicReplayClassification,
): number {
    const lastMs = classification.last_event_ms ?? 0;
    let total = 0;
    for (const segment of classification.band_timeline) {
        if (segment.band !== "drift") continue;
        const end = segment.end_ms ?? lastMs;
        total += Math.max(0, end - segment.start_ms);
    }
    return total;
}

export function translationPolicyReplayMalformedCount(
    classification: TranslationPolicyForensicReplayClassification,
): number {
    let maxPayloadMalformed = 0;
    for (const window of classification.error_windows) {
        if (window.kind !== "malformed") continue;
        const parsed = Number.parseInt(window.message ?? "0", 10);
        if (Number.isFinite(parsed)) {
            maxPayloadMalformed = Math.max(maxPayloadMalformed, parsed >>> 0);
        }
    }
    return (classification.malformed_payloads + maxPayloadMalformed) >>> 0;
}

export function firstActiveErrorWindow(
    classification: TranslationPolicyForensicReplayClassification,
): TranslationPolicyErrorWindow | null {
    for (const window of classification.error_windows) {
        if (window.end_ms === null) return window;
    }
    return null;
}

export function forensicReplayGlyph(
    band: TranslationPolicyForensicBand | "empty",
): string {
    switch (band) {
        case "nominal": return "OK";
        case "watch": return "WA";
        case "drift": return "DR";
        case "blocked": return "BL";
        case "disabled": return "DI";
        case "install-error": return "IE";
        case "tick-error": return "TE";
        case "empty": return "--";
    }
}

function hex8(n: number): string {
    return (n >>> 0).toString(16).padStart(8, "0");
}

function formatDuration(ms: number): string {
    if (ms < 1_000) return `${ms >>> 0}ms`;
    if (ms < 60_000) return `${Math.floor(ms / 1_000)}s`;
    return `${Math.floor(ms / 60_000)}m`;
}

function truncate(s: string, max: number): string {
    if (max <= 0) return "";
    if (s.length <= max) return s;
    if (max <= 1) return s.slice(0, max);
    return `${s.slice(0, max - 1)}…`;
}
