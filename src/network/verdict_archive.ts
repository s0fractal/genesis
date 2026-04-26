// 🌌 OMEGA-64: Era 1300 — Verdict Persistence + Cold Archive
//
// Era 1290's QuorumAgreementTracker is in-memory and FIFO-bounded.
// Verdicts older than the eviction window disappear. For long-term
// audit trails, operators need cold storage: a deterministic,
// import/export-friendly format that survives process restarts.
//
// FORMAT: newline-delimited JSON (ND-JSON). Each line is one
// `ArchivedVerdict` record. The line order MAY differ from
// observation order — readers re-establish ordering by sorting
// on `first_seen_at_ms`.
//
// KEY: an archive is identified by an FNV-1a hash over its sorted
// digest set. Two archivists exporting the same set of high-confidence
// verdicts produce byte-identical archive_hash, providing the same
// chain-of-custody property as Era 1280's adjudication digest.

import { fnv1a32 } from "./cross_model_debate.ts";
import {
    QuorumAgreement,
    QuorumAgreementTracker,
} from "./quorum_broadcast.ts";
import type { QuorumVerdict } from "./forensic_quorum.ts";

const SCHEMA_VERSION = "OMEGA-1300/v1";

export interface ArchivedVerdict {
    schema: string;
    digest: number;
    digest_hex: string;
    verdict: QuorumVerdict;
    source_relay_id: number;
    relay_count: number;
    overlap_pct: number;
    replayed_q16: number;
    diff_q16: number;
    adjudicators: number[];
    first_seen_at_ms: number;
    last_seen_at_ms: number;
    /** Was the verdict at "triple+" confidence at archive time? */
    high_confidence_at_archive: boolean;
}

export interface ArchiveBundle {
    schema: string;
    archive_hash: number;
    archive_hash_hex: string;
    exported_at_ms: number;
    record_count: number;
    /** Hex of the lowest digest in the archive (deterministic peek). */
    min_digest_hex: string;
    /** Hex of the highest digest in the archive (deterministic peek). */
    max_digest_hex: string;
    records: ArchivedVerdict[];
}

function recordFromAgreement(rec: QuorumAgreement): ArchivedVerdict {
    return {
        schema: SCHEMA_VERSION,
        digest: rec.digest,
        digest_hex: `0x${(rec.digest >>> 0).toString(16).padStart(8, "0")}`,
        verdict: rec.verdict,
        source_relay_id: rec.source_relay_id,
        relay_count: rec.relay_count,
        overlap_pct: rec.overlap_pct,
        replayed_q16: rec.replayed_q16,
        diff_q16: rec.diff_q16,
        adjudicators: [...rec.adjudicators].sort((a, b) => a - b),
        first_seen_at_ms: rec.first_seen_at_ms,
        last_seen_at_ms: rec.last_seen_at_ms,
        high_confidence_at_archive: rec.confidence === "triple+",
    };
}

/**
 * Compute the FNV-1a hash over the sorted set of digests.
 * Two archivists exporting the same set produce identical hashes.
 */
export function computeArchiveHash(records: ReadonlyArray<ArchivedVerdict>): number {
    const sorted = [...records].sort((a, b) => a.digest - b.digest);
    const buf = new Uint8Array(sorted.length * 4);
    for (let i = 0; i < sorted.length; i++) {
        const v = sorted[i].digest >>> 0;
        buf[i * 4 + 0] = (v >>> 24) & 0xFF;
        buf[i * 4 + 1] = (v >>> 16) & 0xFF;
        buf[i * 4 + 2] = (v >>> 8) & 0xFF;
        buf[i * 4 + 3] = v & 0xFF;
    }
    return fnv1a32(buf);
}

export interface ExportOptions {
    /** Only export records currently at "triple+" confidence. Default true. */
    only_high_confidence: boolean;
    /** Caller-supplied wall-clock for reproducibility. Default Date.now(). */
    now_ms?: number;
}

const DEFAULT_EXPORT: ExportOptions = {
    only_high_confidence: true,
};

/**
 * Build an ArchiveBundle from a QuorumAgreementTracker. Records are
 * sorted by digest ascending for deterministic output, then by
 * first_seen_at_ms ascending for ties.
 */
export function exportArchive(
    tracker: QuorumAgreementTracker,
    opts: Partial<ExportOptions> = {},
): ArchiveBundle {
    const o = { ...DEFAULT_EXPORT, ...opts };
    const candidates = tracker.list();
    const records: ArchivedVerdict[] = candidates
        .filter(c => !o.only_high_confidence || c.confidence === "triple+")
        .map(recordFromAgreement)
        .sort((a, b) => {
            if (a.digest !== b.digest) return a.digest - b.digest;
            return a.first_seen_at_ms - b.first_seen_at_ms;
        });
    const archive_hash = computeArchiveHash(records);
    const min_digest = records.length > 0 ? records[0].digest : 0;
    const max_digest = records.length > 0 ? records[records.length - 1].digest : 0;
    return {
        schema: SCHEMA_VERSION,
        archive_hash,
        archive_hash_hex: `0x${(archive_hash >>> 0).toString(16).padStart(8, "0")}`,
        exported_at_ms: o.now_ms ?? Date.now(),
        record_count: records.length,
        min_digest_hex: `0x${(min_digest >>> 0).toString(16).padStart(8, "0")}`,
        max_digest_hex: `0x${(max_digest >>> 0).toString(16).padStart(8, "0")}`,
        records,
    };
}

/**
 * Serialize a bundle to ND-JSON. The first line is the manifest;
 * subsequent lines are one ArchivedVerdict each. Reader recovers
 * `archive_hash` by recomputing from the records — drift triggers
 * import failure.
 */
export function bundleToNdjson(bundle: ArchiveBundle): string {
    const manifest = {
        schema: bundle.schema,
        archive_hash_hex: bundle.archive_hash_hex,
        exported_at_ms: bundle.exported_at_ms,
        record_count: bundle.record_count,
        min_digest_hex: bundle.min_digest_hex,
        max_digest_hex: bundle.max_digest_hex,
    };
    const lines: string[] = [JSON.stringify(manifest)];
    for (const r of bundle.records) lines.push(JSON.stringify(r));
    return lines.join("\n") + "\n";
}

export type ImportOutcome =
    | { ok: true; bundle: ArchiveBundle }
    | { ok: false; reason: string };

/**
 * Parse an ND-JSON archive blob and verify integrity. Returns the
 * recovered bundle or an error reason. Drift on archive_hash =
 * tampering detected.
 */
export function ndjsonToBundle(blob: string): ImportOutcome {
    const lines = blob.split("\n").filter(l => l.trim().length > 0);
    if (lines.length === 0) return { ok: false, reason: "empty archive" };

    let manifest: {
        schema: string;
        archive_hash_hex: string;
        exported_at_ms: number;
        record_count: number;
        min_digest_hex?: string;
        max_digest_hex?: string;
    };
    try {
        manifest = JSON.parse(lines[0]);
    } catch (e) {
        return { ok: false, reason: `manifest parse error: ${(e as Error).message}` };
    }
    if (manifest.schema !== SCHEMA_VERSION) {
        return { ok: false, reason: `unsupported schema: ${manifest.schema}` };
    }

    const records: ArchivedVerdict[] = [];
    for (let i = 1; i < lines.length; i++) {
        try {
            const rec = JSON.parse(lines[i]) as ArchivedVerdict;
            if (rec.schema !== SCHEMA_VERSION) {
                return { ok: false, reason: `record ${i} has bad schema: ${rec.schema}` };
            }
            records.push(rec);
        } catch (e) {
            return { ok: false, reason: `record ${i} parse error: ${(e as Error).message}` };
        }
    }

    if (records.length !== manifest.record_count) {
        return {
            ok: false,
            reason: `record_count mismatch: manifest=${manifest.record_count} actual=${records.length}`,
        };
    }

    const recomputed = computeArchiveHash(records);
    const recomputed_hex = `0x${(recomputed >>> 0).toString(16).padStart(8, "0")}`;
    if (recomputed_hex !== manifest.archive_hash_hex) {
        return {
            ok: false,
            reason: `archive_hash drift: manifest=${manifest.archive_hash_hex} recomputed=${recomputed_hex}`,
        };
    }

    return {
        ok: true,
        bundle: {
            schema: SCHEMA_VERSION,
            archive_hash: recomputed,
            archive_hash_hex: recomputed_hex,
            exported_at_ms: manifest.exported_at_ms,
            record_count: records.length,
            min_digest_hex: manifest.min_digest_hex
                ?? (records.length > 0
                    ? `0x${(records[0].digest >>> 0).toString(16).padStart(8, "0")}`
                    : "0x00000000"),
            max_digest_hex: manifest.max_digest_hex
                ?? (records.length > 0
                    ? `0x${(records[records.length - 1].digest >>> 0).toString(16).padStart(8, "0")}`
                    : "0x00000000"),
            records,
        },
    };
}

/**
 * Diff two bundles by digest set membership. Used by operators
 * comparing archives from different parties — agreement on the
 * verdict set is the strongest cross-party post-mortem evidence.
 */
export interface ArchiveDiff {
    shared: number[];
    a_only: number[];
    b_only: number[];
    overlap_ratio: number;
}

export function diffArchives(a: ArchiveBundle, b: ArchiveBundle): ArchiveDiff {
    const a_set = new Set<number>(a.records.map(r => r.digest));
    const b_set = new Set<number>(b.records.map(r => r.digest));
    const shared: number[] = [];
    const a_only: number[] = [];
    const b_only: number[] = [];
    for (const d of a_set) {
        if (b_set.has(d)) shared.push(d);
        else a_only.push(d);
    }
    for (const d of b_set) {
        if (!a_set.has(d)) b_only.push(d);
    }
    const total = shared.length + a_only.length + b_only.length;
    return {
        shared: shared.sort((x, y) => x - y),
        a_only: a_only.sort((x, y) => x - y),
        b_only: b_only.sort((x, y) => x - y),
        overlap_ratio: total === 0 ? 0 : shared.length / total,
    };
}

export const ARCHIVE_SCHEMA_VERSION = SCHEMA_VERSION;
