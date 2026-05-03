// OMEGA-64: Era 1940 - Translation Policy Replay Digest Replay Digest
//
// Era 1920 classifies replayed `tpdq` events and Era 1930 formats them.
// This module gives the replay-digest interpretation a deterministic
// content address so relays can compare offline outcomes without shipping
// full timelines.

import { fnv1a32 } from "./cross_model_debate.ts";
import type {
    TranslationPolicyReplayDigestBandSegment,
    TranslationPolicyReplayDigestConsensusInterval,
    TranslationPolicyReplayDigestErrorWindow,
    TranslationPolicyReplayDigestForensicReplayClassification,
} from "./translation_policy_replay_digest_forensic_replay.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA =
    "OMEGA-1940/v1";

export interface TranslationPolicyReplayDigestForensicReplayDigest {
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

export function translationPolicyReplayDigestForensicReplayDigest(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
): TranslationPolicyReplayDigestForensicReplayDigest {
    const bandHash = hashReplayDigestBandTimeline(classification.band_timeline);
    const consensusHash = hashReplayDigestConsensusIntervals(
        classification.consensus_digest_intervals,
    );
    const errorHash = hashReplayDigestErrorWindows(classification.error_windows);
    const digest = fnv1a32(encoder.encode([
        TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
        num(bandHash),
        num(consensusHash),
        num(errorHash),
        num(classification.classified_events),
        num(classification.malformed_payloads),
        classification.final_band ?? "none",
        num(classification.final_consensus_digest ?? 0),
    ].join("|")));
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
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

export function sameTranslationPolicyReplayDigestForensicReplayDigest(
    a: TranslationPolicyReplayDigestForensicReplayClassification,
    b: TranslationPolicyReplayDigestForensicReplayClassification,
): boolean {
    return translationPolicyReplayDigestForensicReplayDigest(a).digest ===
        translationPolicyReplayDigestForensicReplayDigest(b).digest;
}

export function translationPolicyReplayDigestForensicReplayDigestProjection(
    classification: TranslationPolicyReplayDigestForensicReplayClassification,
): string {
    return [
        "bands",
        canonicalReplayDigestBandTimeline(classification.band_timeline),
        "consensus",
        canonicalReplayDigestConsensusIntervals(
            classification.consensus_digest_intervals,
        ),
        "errors",
        canonicalReplayDigestErrorWindows(classification.error_windows),
        "classified",
        num(classification.classified_events),
        "malformed",
        num(classification.malformed_payloads),
        "final",
        classification.final_band ?? "none",
        num(classification.final_consensus_digest ?? 0),
    ].join("\n");
}

export function hashReplayDigestBandTimeline(
    segments: ReadonlyArray<TranslationPolicyReplayDigestBandSegment>,
): number {
    return fnv1a32(encoder.encode(canonicalReplayDigestBandTimeline(segments)));
}

export function hashReplayDigestConsensusIntervals(
    intervals: ReadonlyArray<TranslationPolicyReplayDigestConsensusInterval>,
): number {
    return fnv1a32(
        encoder.encode(canonicalReplayDigestConsensusIntervals(intervals)),
    );
}

export function hashReplayDigestErrorWindows(
    windows: ReadonlyArray<TranslationPolicyReplayDigestErrorWindow>,
): number {
    return fnv1a32(encoder.encode(canonicalReplayDigestErrorWindows(windows)));
}

function canonicalReplayDigestBandTimeline(
    segments: ReadonlyArray<TranslationPolicyReplayDigestBandSegment>,
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

function canonicalReplayDigestConsensusIntervals(
    intervals: ReadonlyArray<TranslationPolicyReplayDigestConsensusInterval>,
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

function canonicalReplayDigestErrorWindows(
    windows: ReadonlyArray<TranslationPolicyReplayDigestErrorWindow>,
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
