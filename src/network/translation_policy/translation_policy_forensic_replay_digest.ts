// OMEGA-64: Era 1860 - Translation Policy Forensic Replay Digest
//
// Era 1840 classifies replayed `tpol` events. This module gives that
// interpretation a deterministic content address so relays can compare
// replay outcomes after event-sink sync.

import { fnv1a32 } from "../cross_model_debate.ts";
import type {
    TranslationPolicyBandTimelineSegment,
    TranslationPolicyErrorWindow,
    TranslationPolicyForensicReplayClassification,
    TranslationPolicyHashInterval,
} from "./translation_policy_forensic_replay.ts";

export const TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA = "OMEGA-1860/v1";

export interface TranslationPolicyForensicReplayDigest {
    schema: string;
    digest: number;
    digest_hex: string;
    band_timeline_hash: number;
    policy_interval_hash: number;
    error_window_hash: number;
    classified_events: number;
    malformed_payloads: number;
    final_band: string;
    final_policy_hash: number;
}

const encoder = new TextEncoder();

export function translationPolicyForensicReplayDigest(
    classification: TranslationPolicyForensicReplayClassification,
): TranslationPolicyForensicReplayDigest {
    const bandHash = hashBandTimeline(classification.band_timeline);
    const policyHash = hashPolicyIntervals(classification.policy_hash_intervals);
    const errorHash = hashErrorWindows(classification.error_windows);
    const digest = fnv1a32(encoder.encode([
        TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
        num(bandHash),
        num(policyHash),
        num(errorHash),
        num(classification.classified_events),
        num(classification.malformed_payloads),
        classification.final_band ?? "none",
        num(classification.final_policy_hash ?? 0),
    ].join("|")));
    return {
        schema: TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
        digest,
        digest_hex: hex8(digest),
        band_timeline_hash: bandHash,
        policy_interval_hash: policyHash,
        error_window_hash: errorHash,
        classified_events: classification.classified_events >>> 0,
        malformed_payloads: classification.malformed_payloads >>> 0,
        final_band: classification.final_band ?? "none",
        final_policy_hash: classification.final_policy_hash ?? 0,
    };
}

export function sameTranslationPolicyForensicReplayDigest(
    a: TranslationPolicyForensicReplayClassification,
    b: TranslationPolicyForensicReplayClassification,
): boolean {
    return translationPolicyForensicReplayDigest(a).digest ===
        translationPolicyForensicReplayDigest(b).digest;
}

export function translationPolicyForensicReplayDigestProjection(
    classification: TranslationPolicyForensicReplayClassification,
): string {
    return [
        "bands",
        canonicalBandTimeline(classification.band_timeline),
        "policies",
        canonicalPolicyIntervals(classification.policy_hash_intervals),
        "errors",
        canonicalErrorWindows(classification.error_windows),
        "classified",
        num(classification.classified_events),
        "malformed",
        num(classification.malformed_payloads),
        "final",
        classification.final_band ?? "none",
        num(classification.final_policy_hash ?? 0),
    ].join("\n");
}

export function hashBandTimeline(
    segments: ReadonlyArray<TranslationPolicyBandTimelineSegment>,
): number {
    return fnv1a32(encoder.encode(canonicalBandTimeline(segments)));
}

export function hashPolicyIntervals(
    intervals: ReadonlyArray<TranslationPolicyHashInterval>,
): number {
    return fnv1a32(encoder.encode(canonicalPolicyIntervals(intervals)));
}

export function hashErrorWindows(
    windows: ReadonlyArray<TranslationPolicyErrorWindow>,
): number {
    return fnv1a32(encoder.encode(canonicalErrorWindows(windows)));
}

function canonicalBandTimeline(
    segments: ReadonlyArray<TranslationPolicyBandTimelineSegment>,
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

function canonicalPolicyIntervals(
    intervals: ReadonlyArray<TranslationPolicyHashInterval>,
): string {
    return [...intervals]
        .sort((a, b) => {
            if (a.start_ms !== b.start_ms) return a.start_ms - b.start_ms;
            if (a.start_sequence !== b.start_sequence) {
                return a.start_sequence - b.start_sequence;
            }
            return (a.local_policy_hash >>> 0) - (b.local_policy_hash >>> 0);
        })
        .map((i) => [
            num(i.local_policy_hash),
            num(i.start_ms),
            nullableNum(i.end_ms),
            num(i.start_sequence),
            nullableNum(i.end_sequence),
            num(i.local_pair_count),
        ].join(","))
        .join(";");
}

function canonicalErrorWindows(
    windows: ReadonlyArray<TranslationPolicyErrorWindow>,
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
