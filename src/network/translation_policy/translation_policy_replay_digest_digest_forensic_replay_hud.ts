// OMEGA-64: Era 2020 - Translation Policy Replay Digest Digest Replay HUD
//
// Era 2000 reconstructs digest-digest forensic timelines and Era 2010
// gives that interpretation a deterministic digest. This formatter
// compresses the offline/synced-sink result into stable operator fields
// without touching DOM, sinks, mesh IO, or live runtime state.

import type {
    TranslationPolicyReplayDigestDigestErrorWindow,
    TranslationPolicyReplayDigestDigestForensicReplayClassification,
} from "./translation_policy_replay_digest_digest_forensic_replay.ts";
import {
    translationPolicyReplayDigestDigestForensicReplayDigest,
} from "./translation_policy_replay_digest_digest_forensic_replay_digest.ts";
import type {
    TranslationPolicyReplayDigestDigestHudBand,
} from "./translation_policy_replay_digest_digest_hud.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA =
    "OMEGA-2020/v1";

export type TranslationPolicyReplayDigestDigestForensicReplayHudBand =
    | TranslationPolicyReplayDigestDigestHudBand
    | "empty";

export interface TranslationPolicyReplayDigestDigestForensicReplayHudField {
    label: string;
    value: string;
}

export interface TranslationPolicyReplayDigestDigestForensicReplayHudSnapshot {
    schema: string;
    band: TranslationPolicyReplayDigestDigestForensicReplayHudBand;
    glyph: string;
    summary: string;
    replay_digest_hex: string;
    drift_duration_ms: number;
    malformed_count: number;
    local_failure_count: number;
    active_error: TranslationPolicyReplayDigestDigestErrorWindow | null;
    fields: {
        band: TranslationPolicyReplayDigestDigestForensicReplayHudField;
        digest: TranslationPolicyReplayDigestDigestForensicReplayHudField;
        error: TranslationPolicyReplayDigestDigestForensicReplayHudField;
        drift: TranslationPolicyReplayDigestDigestForensicReplayHudField;
    };
}

export interface TranslationPolicyReplayDigestDigestForensicReplayHudOptions {
    max_summary_len: number;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_HUD_OPTS:
    TranslationPolicyReplayDigestDigestForensicReplayHudOptions = {
        max_summary_len: 116,
    };

export function formatTranslationPolicyReplayDigestDigestForensicReplayHud(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
    opts: Partial<TranslationPolicyReplayDigestDigestForensicReplayHudOptions> = {},
): TranslationPolicyReplayDigestDigestForensicReplayHudSnapshot {
    const cfg = {
        ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_HUD_OPTS,
        ...opts,
    };
    const band = classification.final_band ?? "empty";
    const glyph = replayDigestDigestForensicReplayGlyph(band);
    const finalDigest = classification.final_consensus_digest === null
        ? "--------"
        : hex8(classification.final_consensus_digest);
    const replayDigest =
        translationPolicyReplayDigestDigestForensicReplayDigest(classification);
    const activeError = firstActiveReplayDigestDigestErrorWindow(classification);
    const driftDurationMs =
        translationPolicyReplayDigestDigestReplayDriftDurationMs(classification);
    const malformedCount =
        translationPolicyReplayDigestDigestReplayMalformedCount(classification);
    const localFailureCount =
        translationPolicyReplayDigestDigestReplayLocalFailureCount(classification);
    const errorValue = activeError
        ? `${activeError.kind}:${activeError.message ?? ""}`
        : "none";
    const fields = {
        band: {
            label: "TPOL RDD REPLAY",
            value:
                `${glyph} ${band.toUpperCase()} ${classification.classified_events}/${classification.total_events}`,
        },
        digest: {
            label: "TPOL RDD DIGEST",
            value:
                `C${finalDigest} I${classification.consensus_digest_intervals.length} R${replayDigest.digest_hex.slice(2)}`,
        },
        error: {
            label: "TPOL RDD ERROR",
            value: errorValue,
        },
        drift: {
            label: "TPOL RDD DRIFT",
            value:
                `${formatDuration(driftDurationMs)} M${malformedCount} F${localFailureCount}`,
        },
    };
    const summary = truncate(
        `${fields.band.value} | ${fields.digest.value} | E ${fields.error.value} | D ${fields.drift.value}`,
        cfg.max_summary_len,
    );
    return {
        schema:
            TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA,
        band,
        glyph,
        summary,
        replay_digest_hex: replayDigest.digest_hex,
        drift_duration_ms: driftDurationMs,
        malformed_count: malformedCount,
        local_failure_count: localFailureCount,
        active_error: activeError,
        fields,
    };
}

export function translationPolicyReplayDigestDigestForensicReplayHudFields(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
    opts: Partial<TranslationPolicyReplayDigestDigestForensicReplayHudOptions> = {},
): TranslationPolicyReplayDigestDigestForensicReplayHudField[] {
    const snap = formatTranslationPolicyReplayDigestDigestForensicReplayHud(
        classification,
        opts,
    );
    return [snap.fields.band, snap.fields.digest, snap.fields.error, snap.fields.drift];
}

export function translationPolicyReplayDigestDigestReplayDriftDurationMs(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
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

export function translationPolicyReplayDigestDigestReplayMalformedCount(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
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

export function translationPolicyReplayDigestDigestReplayLocalFailureCount(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
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

export function firstActiveReplayDigestDigestErrorWindow(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
): TranslationPolicyReplayDigestDigestErrorWindow | null {
    for (const window of classification.error_windows) {
        if (window.end_ms === null) return window;
    }
    return null;
}

export function replayDigestDigestForensicReplayGlyph(
    band: TranslationPolicyReplayDigestDigestForensicReplayHudBand,
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
