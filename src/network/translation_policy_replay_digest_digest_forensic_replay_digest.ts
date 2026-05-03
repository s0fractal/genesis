// OMEGA-64: Era 2010 - Translation Policy Replay Digest Digest Replay Digest
//
// Era 2000 classifies replayed `tpdd` events. This module gives the
// digest-digest replay interpretation a deterministic content address
// so relays can compare offline outcomes without shipping full timelines.

import { fnv1a32 } from "./cross_model_debate.ts";
import type {
    TranslationPolicyReplayDigestDigestBandSegment,
    TranslationPolicyReplayDigestDigestConsensusInterval,
    TranslationPolicyReplayDigestDigestErrorWindow,
    TranslationPolicyReplayDigestDigestForensicReplayClassification,
} from "./translation_policy_replay_digest_digest_forensic_replay.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA =
    "OMEGA-2010/v1";

export interface TranslationPolicyReplayDigestDigestForensicReplayDigest {
    schema: string;
    digest: number;
    digest_hex: string;
    band_timeline_hash: number;
    consensus_interval_hash: number;
    error_window_hash: number;
    classified_events: number;
    malformed_payloads: number;
    final_band: string;
    final_consensus_digest: number;
}

const encoder = new TextEncoder();

export function translationPolicyReplayDigestDigestForensicReplayDigest(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
): TranslationPolicyReplayDigestDigestForensicReplayDigest {
    const bandHash = hashReplayDigestDigestBandTimeline(
        classification.band_timeline,
    );
    const consensusHash = hashReplayDigestDigestConsensusIntervals(
        classification.consensus_digest_intervals,
    );
    const errorHash = hashReplayDigestDigestErrorWindows(
        classification.error_windows,
    );
    const digest = fnv1a32(encoder.encode([
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
        num(bandHash),
        num(consensusHash),
        num(errorHash),
        num(classification.classified_events),
        num(classification.malformed_payloads),
        classification.final_band ?? "none",
        num(classification.final_consensus_digest ?? 0),
    ].join("|")));
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
        digest,
        digest_hex: hex8(digest),
        band_timeline_hash: bandHash,
        consensus_interval_hash: consensusHash,
        error_window_hash: errorHash,
        classified_events: classification.classified_events >>> 0,
        malformed_payloads: classification.malformed_payloads >>> 0,
        final_band: classification.final_band ?? "none",
        final_consensus_digest: classification.final_consensus_digest ?? 0,
    };
}

export function sameTranslationPolicyReplayDigestDigestForensicReplayDigest(
    a: TranslationPolicyReplayDigestDigestForensicReplayClassification,
    b: TranslationPolicyReplayDigestDigestForensicReplayClassification,
): boolean {
    return translationPolicyReplayDigestDigestForensicReplayDigest(a).digest ===
        translationPolicyReplayDigestDigestForensicReplayDigest(b).digest;
}

export function translationPolicyReplayDigestDigestForensicReplayDigestProjection(
    classification: TranslationPolicyReplayDigestDigestForensicReplayClassification,
): string {
    return [
        "bands",
        canonicalReplayDigestDigestBandTimeline(classification.band_timeline),
        "consensus",
        canonicalReplayDigestDigestConsensusIntervals(
            classification.consensus_digest_intervals,
        ),
        "errors",
        canonicalReplayDigestDigestErrorWindows(classification.error_windows),
        "classified",
        num(classification.classified_events),
        "malformed",
        num(classification.malformed_payloads),
        "final",
        classification.final_band ?? "none",
        num(classification.final_consensus_digest ?? 0),
    ].join("\n");
}

export function hashReplayDigestDigestBandTimeline(
    segments: ReadonlyArray<TranslationPolicyReplayDigestDigestBandSegment>,
): number {
    return fnv1a32(
        encoder.encode(canonicalReplayDigestDigestBandTimeline(segments)),
    );
}

export function hashReplayDigestDigestConsensusIntervals(
    intervals: ReadonlyArray<TranslationPolicyReplayDigestDigestConsensusInterval>,
): number {
    return fnv1a32(
        encoder.encode(canonicalReplayDigestDigestConsensusIntervals(intervals)),
    );
}

export function hashReplayDigestDigestErrorWindows(
    windows: ReadonlyArray<TranslationPolicyReplayDigestDigestErrorWindow>,
): number {
    return fnv1a32(
        encoder.encode(canonicalReplayDigestDigestErrorWindows(windows)),
    );
}

function canonicalReplayDigestDigestBandTimeline(
    segments: ReadonlyArray<TranslationPolicyReplayDigestDigestBandSegment>,
): string {
    return [...segments]
        .sort((a, b) => {
            if (a.start_ms !== b.start_ms) return a.start_ms - b.start_ms;
            if (a.start_sequence !== b.start_sequence) {
                return a.start_sequence - b.start_sequence;
            }
            return (a.event_hash >>> 0) - (b.event_hash >>> 0);
        })
        .map((s) => [
            s.band,
            num(s.start_ms),
            nullableNum(s.end_ms),
            num(s.start_sequence),
            nullableNum(s.end_sequence),
            num(s.event_hash),
        ].join(","))
        .join(";");
}

function canonicalReplayDigestDigestConsensusIntervals(
    intervals: ReadonlyArray<TranslationPolicyReplayDigestDigestConsensusInterval>,
): string {
    return [...intervals]
        .sort((a, b) => {
            if (a.start_ms !== b.start_ms) return a.start_ms - b.start_ms;
            if (a.start_sequence !== b.start_sequence) {
                return a.start_sequence - b.start_sequence;
            }
            return (a.consensus_digest >>> 0) - (b.consensus_digest >>> 0);
        })
        .map((i) => [
            num(i.consensus_digest),
            num(i.start_ms),
            nullableNum(i.end_ms),
            num(i.start_sequence),
            nullableNum(i.end_sequence),
            num(i.consensus_count),
            num(i.total_claims),
            num(i.agreement_q16),
        ].join(","))
        .join(";");
}

function canonicalReplayDigestDigestErrorWindows(
    windows: ReadonlyArray<TranslationPolicyReplayDigestDigestErrorWindow>,
): string {
    return [...windows]
        .sort((a, b) => {
            if (a.start_ms !== b.start_ms) return a.start_ms - b.start_ms;
            if (a.start_sequence !== b.start_sequence) {
                return a.start_sequence - b.start_sequence;
            }
            if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
            return (a.first_event_hash >>> 0) - (b.first_event_hash >>> 0);
        })
        .map((w) => [
            w.kind,
            w.message ?? "",
            num(w.start_ms),
            nullableNum(w.end_ms),
            num(w.start_sequence),
            nullableNum(w.end_sequence),
            num(w.first_event_hash),
            num(w.last_event_hash),
        ].join(","))
        .join(";");
}

function num(value: number): string {
    return String(value >>> 0);
}

function nullableNum(value: number | null): string {
    return value === null ? "-" : num(value);
}

function hex8(value: number): string {
    return `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
}
