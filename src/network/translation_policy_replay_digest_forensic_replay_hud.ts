// OMEGA-64: Era 1930 - Translation Policy Replay Digest Replay HUD
//
// Era 1920 reconstructs replay-digest forensic timelines. This formatter
// compresses that offline/synced-sink classification into stable operator
// report fields without touching DOM, sinks, mesh IO, or live runtime state.

import type {
    TranslationPolicyReplayDigestErrorWindow,
    TranslationPolicyReplayDigestForensicReplayClassification,
} from "./translation_policy_replay_digest_forensic_replay.ts";
import type {
    TranslationPolicyReplayDigestHudBand,
} from "./translation_policy_replay_digest_hud.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA =
    "OMEGA-1930/v1";

export type TranslationPolicyReplayDigestForensicReplayHudBand =
    | TranslationPolicyReplayDigestHudBand
    | "empty";

export interface TranslationPolicyReplayDigestForensicReplayHudField {
    label: string;
    value: string;
}

export interface TranslationPolicyReplayDigestForensicReplayHudSnapshot {
    schema: string;
    band: TranslationPolicyReplayDigestForensicReplayHudBand;
    glyph: string;
    summary: string;
    drift_duration_ms: number;
    malformed_count: number;
    local_failure_count: number;
    active_error: TranslationPolicyReplayDigestErrorWindow | null;
    fields: {
        band: TranslationPolicyReplayDigestForensicReplayHudField;
        digest: TranslationPolicyReplayDigestForensicReplayHudField;
        error: TranslationPolicyReplayDigestForensicReplayHudField;
        drift: TranslationPolicyReplayDigestForensicReplayHudField;
    };
}

export interface TranslationPolicyReplayDigestForensicReplayHudOptions {
    max_summary_len: number;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_OPTS:
    TranslationPolicyReplayDigestForensicReplayHudOptions = {
        max_summary_len: 112,
    };

export function formatTranslationPolicyReplayDigestForensicReplayHud(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
    opts: Partial<TranslationPolicyReplayDigestForensicReplayHudOptions> = {},
): TranslationPolicyReplayDigestForensicReplayHudSnapshot {
    const cfg = {
        ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_OPTS,
        ...opts,
    };
    const band = classification.final_band ?? "empty";
    const glyph = replayDigestForensicReplayGlyph(band);
    const digest = classification.final_consensus_digest === null
        ? "--------"
        : hex8(classification.final_consensus_digest);
    const activeError = firstActiveReplayDigestErrorWindow(classification);
    const driftDurationMs =
        translationPolicyReplayDigestReplayDriftDurationMs(classification);
    const malformedCount =
        translationPolicyReplayDigestReplayMalformedCount(classification);
    const localFailureCount =
        translationPolicyReplayDigestReplayLocalFailureCount(classification);
    const errorValue = activeError
        ? `${activeError.kind}:${activeError.message ?? ""}`
        : "none";
    const fields = {
        band: {
            label: "TPOL RD REPLAY",
            value: `${glyph} ${band.toUpperCase()} ${classification.classified_events}/${classification.total_events}`,
        },
        digest: {
            label: "TPOL RD DIGEST",
            value: `D${digest} I${classification.consensus_digest_intervals.length}`,
        },
        error: {
            label: "TPOL RD ERROR",
            value: errorValue,
        },
        drift: {
            label: "TPOL RD DRIFT",
            value:
                `${formatDuration(driftDurationMs)} M${malformedCount} F${localFailureCount}`,
        },
    };
    const summary = truncate(
        `${fields.band.value} | ${fields.digest.value} | E ${fields.error.value} | D ${fields.drift.value}`,
        cfg.max_summary_len,
    );
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA,
        band,
        glyph,
        summary,
        drift_duration_ms: driftDurationMs,
        malformed_count: malformedCount,
        local_failure_count: localFailureCount,
        active_error: activeError,
        fields,
    };
}

export function translationPolicyReplayDigestForensicReplayHudFields(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
    opts: Partial<TranslationPolicyReplayDigestForensicReplayHudOptions> = {},
): TranslationPolicyReplayDigestForensicReplayHudField[] {
    const snap = formatTranslationPolicyReplayDigestForensicReplayHud(
        classification,
        opts,
    );
    return [snap.fields.band, snap.fields.digest, snap.fields.error, snap.fields.drift];
}

export function translationPolicyReplayDigestReplayDriftDurationMs(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
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

export function translationPolicyReplayDigestReplayMalformedCount(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
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

export function translationPolicyReplayDigestReplayLocalFailureCount(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
): number {
    let maxLocalFailures = 0;
    for (const window of classification.error_windows) {
        if (window.kind !== "local-claim-failed") continue;
        const parsed = Number.parseInt(window.message ?? "0", 10);
        if (Number.isFinite(parsed)) {
            maxLocalFailures = Math.max(maxLocalFailures, parsed >>> 0);
        }
    }
    return maxLocalFailures >>> 0;
}

export function firstActiveReplayDigestErrorWindow(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
): TranslationPolicyReplayDigestErrorWindow | null {
    for (const window of classification.error_windows) {
        if (window.end_ms === null) return window;
    }
    return null;
}

export function replayDigestForensicReplayGlyph(
    band: TranslationPolicyReplayDigestForensicReplayHudBand,
): string {
    switch (band) {
        case "nominal": return "OK";
        case "watch": return "WA";
        case "drift": return "DR";
        case "blocked": return "BL";
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
