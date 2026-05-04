// 🌌 OMEGA-64: Era 1280 — Forensic Quorum
//
// Era 1270 lets N relays merge their recorded views of an incident
// window for cooperative reconstruction. Era 1280 closes the
// post-mortem loop: when the merged replay produces metrics that
// MATCH (within tolerance) the real-time alarm that fired during
// the incident, we have a "forensic quorum" — independent
// multi-relay reconstruction has agreed with the live signal.
//
// THE SEMANTIC: live alarm + cooperative replay agreement =
// post-mortem evidence admissible for archival reports. Disagreement
// suggests either the alarm was spurious OR the merge missed
// frames the real-time observer had.
//
// QUORUM RULE: ≥3 relays' merged replay reproduces the alarm's
// observed metric within `tolerance_q16` (default 6553 ≈ 10%).
// Below threshold = "uncorroborated" (alarm fired but replay
// disagrees). Above = "corroborated" (replay confirms the alarm
// was real, not noise).

import { sha256_u32 } from "../sdk/phi_crypto.ts";
import {
    coverageStats,
    mergeMany,
    type MergeResult,
} from "./trace_sync.ts";
import { FrameRecorder, replayWindow } from "./frame_recorder.ts";
import { ConvergenceDetector } from "./convergence_detector.ts";

export type QuorumVerdict =
    | "corroborated"
    | "uncorroborated"
    | "insufficient-relays"
    | "empty-window";

export interface AlarmFingerprint {
    /** redundancy_rate_q16 reported by the live alarm. */
    observed_q16: number;
    /** The window of interest (UTC ms). */
    window_start_ms: number;
    window_end_ms: number;
    /** Source relay that fired the live alarm. */
    source_relay_id: number;
}

export interface QuorumResult {
    verdict: QuorumVerdict;
    /** Number of relays whose recorders participated. */
    relay_count: number;
    /** Q16 of the merged replay's redundancy_rate. */
    replayed_q16: number;
    /** |observed - replayed| in Q16 units. */
    diff_q16: number;
    /** Frame-level overlap between the input recorders. */
    overlap_ratio: number;
    /** Total frames in the merged window. */
    merged_frame_count: number;
    /** Stable digest of the merge (FNV-1a of (ids|window|q16) for archival). */
    digest: number;
}

export interface QuorumOptions {
    /** Minimum relay count for the verdict to be eligible. Default 3. */
    min_relays: number;
    /** Q16 tolerance for replay-vs-alarm comparison. Default 6553 ≈ 10%. */
    tolerance_q16: number;
}

const DEFAULT_OPTS: QuorumOptions = {
    min_relays: 3,
    tolerance_q16: 6553,
};

/** Compute a stable archival digest for the verdict. */
function buildDigest(
    relay_ids: ReadonlyArray<number>,
    fp: AlarmFingerprint,
    replayed_q16: number,
    diff_q16: number,
): number {
    const buf = new Uint8Array(8 + relay_ids.length * 4 + 16);
    let p = 0;
    const writeU32BE = (v: number) => {
        buf[p++] = (v >>> 24) & 0xFF;
        buf[p++] = (v >>> 16) & 0xFF;
        buf[p++] = (v >>> 8) & 0xFF;
        buf[p++] = v & 0xFF;
    };
    const writeU64BE = (v: number) => {
        // Approximate u64 with two u32s; window timestamps fit comfortably.
        const hi = Math.floor(v / 0x1_0000_0000) & 0xFFFFFFFF;
        const lo = (v >>> 0);
        writeU32BE(hi);
        writeU32BE(lo);
    };
    writeU32BE(fp.source_relay_id >>> 0);
    writeU32BE(fp.observed_q16 >>> 0);
    for (const id of relay_ids) writeU32BE(id >>> 0);
    writeU32BE(replayed_q16 >>> 0);
    writeU32BE(diff_q16 >>> 0);
    return sha256_u32(buf.subarray(0, p));
}

/**
 * Adjudicate forensic agreement: ≥ min_relays cooperate by
 * supplying recorders covering the alarm's window. The merged log
 * is replayed through a fresh ConvergenceDetector; the resulting
 * redundancy_rate_q16 is compared with the alarm's observed_q16.
 *
 * Returns "corroborated" when |replay - observed| ≤ tolerance_q16
 * AND the merged frame count is non-zero. Otherwise the verdict
 * explains the disagreement.
 */
export function adjudicateQuorum(
    fp: AlarmFingerprint,
    relay_recorders: ReadonlyMap<number, FrameRecorder>,
    opts: QuorumOptions = DEFAULT_OPTS,
): QuorumResult {
    const relay_ids = [...relay_recorders.keys()].sort((a, b) => a - b);
    if (relay_ids.length < opts.min_relays) {
        return {
            verdict: "insufficient-relays",
            relay_count: relay_ids.length,
            replayed_q16: 0,
            diff_q16: 0,
            overlap_ratio: 0,
            merged_frame_count: 0,
            digest: buildDigest(relay_ids, fp, 0, 0),
        };
    }

    // Filter each recorder to the window of interest.
    const windowed = new Map<number, FrameRecorder>();
    for (const [id, rec] of relay_recorders) {
        const slice = rec.range(fp.window_start_ms, fp.window_end_ms);
        const fresh = new FrameRecorder({ capacity: Math.max(slice.length, 1) });
        for (const r of slice) fresh.record(r.frame, r.received_at_ms, r.delivered_by);
        windowed.set(id, fresh);
    }

    const merge_result: MergeResult = mergeMany([...windowed.values()]);
    const cov = coverageStats(merge_result);

    if (merge_result.merged.length === 0) {
        return {
            verdict: "empty-window",
            relay_count: relay_ids.length,
            replayed_q16: 0,
            diff_q16: 0,
            overlap_ratio: 0,
            merged_frame_count: 0,
            digest: buildDigest(relay_ids, fp, 0, 0),
        };
    }

    // Build a recorder from the merged log and replay through a fresh
    // ConvergenceDetector — this gives us the quorum's reconstructed
    // redundancy_rate.
    const merged_recorder = new FrameRecorder({
        capacity: merge_result.merged.length,
    });
    for (const r of merge_result.merged) {
        merged_recorder.record(r.frame, r.received_at_ms, r.delivered_by);
    }
    const detector = replayWindow(
        merged_recorder, 0, Number.MAX_SAFE_INTEGER,
        () => new ConvergenceDetector(),
        (cd, f, by, t) => cd.observe(f, by, t),
    );
    const stats = detector.stats();
    const replayed_q16 = stats.total_intents === 0
        ? 0
        : Math.round((stats.double_witness * 65536) / stats.total_intents);
    const diff_q16 = Math.abs(replayed_q16 - fp.observed_q16);

    const verdict: QuorumVerdict =
        diff_q16 <= opts.tolerance_q16 ? "corroborated" : "uncorroborated";

    return {
        verdict,
        relay_count: relay_ids.length,
        replayed_q16,
        diff_q16,
        overlap_ratio: cov.overlap_ratio,
        merged_frame_count: merge_result.merged.length,
        digest: buildDigest(relay_ids, fp, replayed_q16, diff_q16),
    };
}

/** Format a verdict + numbers as a one-line operator-readable summary. */
export function formatVerdict(res: QuorumResult): string {
    const replayed_pct = ((res.replayed_q16 / 65536) * 100).toFixed(2);
    const diff_pct = ((res.diff_q16 / 65536) * 100).toFixed(2);
    const overlap_pct = (res.overlap_ratio * 100).toFixed(1);
    const glyph = ({
        "corroborated": "✅",
        "uncorroborated": "❌",
        "insufficient-relays": "🔍",
        "empty-window": "∅",
    } as Record<QuorumVerdict, string>)[res.verdict];
    return `${glyph} ${res.verdict} | relays=${res.relay_count} ` +
        `frames=${res.merged_frame_count} replay=${replayed_pct}% ` +
        `diff=${diff_pct}% overlap=${overlap_pct}% ` +
        `digest=0x${res.digest.toString(16).padStart(8, "0")}`;
}
