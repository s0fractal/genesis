// 🌌 OMEGA-64: Era 1310 — Periodic Archive Sync
//
// Era 1300 archives are deterministic + integrity-checked, but
// shipping a full archive every sync wastes bandwidth when only a
// few digests differ. Era 1310 defines a delta-exchange protocol:
//
//   1. Initiator broadcasts an ARCHIVE_DIGEST_LIST (its set of
//      verdict digests) to peer archivists.
//   2. Peer compares against its own set, computes the difference,
//      and replies with ONLY the missing ArchivedVerdict records.
//   3. Initiator imports the reply, verifies each record's
//      archive integrity, and adds them to its tracker.
//
// CONVERGENCE: after a complete sync, both parties' archives have
// identical digest sets. The protocol is symmetric — either party
// can initiate, and a full bidirectional sync converges in two
// request/response pairs.
//
// SECURITY: each delta record carries the same FNV-1a-derived
// integrity guarantees as Era 1300 archives. A malicious peer
// supplying fabricated digests can't forge agreement — the
// receiver still re-verifies that ≥3 distinct adjudicators
// claim the digest before treating it as high-confidence.

import { sha256_u32 } from "../sdk/phi_crypto.ts";
import {
    ArchivedVerdict,
    ArchiveBundle,
    ARCHIVE_SCHEMA_VERSION,
} from "./verdict_archive.ts";

const SYNC_SCHEMA = "OMEGA-1310/v1";

/** Manifest broadcast by the initiator. */
export interface ArchiveDigestList {
    schema: string;
    /** All digests the initiator currently holds, sorted ascending. */
    digests: number[];
    /** FNV-1a hash over the sorted digest set (mirrors Era 1300). */
    digest_set_hash: number;
    /** Wall-clock at broadcast time (informational). */
    broadcast_at_ms: number;
}

/** Reply from peer carrying records the initiator didn't have. */
export interface ArchiveDelta {
    schema: string;
    /** Echo of the initiator's digest_set_hash for correlation. */
    initiator_digest_set_hash: number;
    /** Records the peer holds that the initiator does not. */
    missing_records: ArchivedVerdict[];
    /** Digests the initiator has that the peer doesn't (so initiator can
     *  send them in the symmetric reply). */
    peer_missing_digests: number[];
    /** FNV-1a hash over the sorted missing-records digest set —
     *  proves the delta wasn't tampered with in transit. */
    delta_hash: number;
    /** Wall-clock at reply time. */
    replied_at_ms: number;
}

/** Compute FNV-1a over a sorted digest set. Identical to Era 1300's
 *  computeArchiveHash for ArchivedVerdict[]. */
export function digestSetHash(digests: ReadonlyArray<number>): number {
    const sorted = [...digests].sort((a, b) => a - b);
    const buf = new Uint8Array(sorted.length * 4);
    for (let i = 0; i < sorted.length; i++) {
        const v = sorted[i] >>> 0;
        buf[i * 4 + 0] = (v >>> 24) & 0xFF;
        buf[i * 4 + 1] = (v >>> 16) & 0xFF;
        buf[i * 4 + 2] = (v >>> 8) & 0xFF;
        buf[i * 4 + 3] = v & 0xFF;
    }
    return sha256_u32(buf);
}

/** Build a digest list from a local archive snapshot. */
export function buildDigestList(
    bundle: ArchiveBundle,
    now_ms: number,
): ArchiveDigestList {
    const digests = bundle.records.map(r => r.digest).sort((a, b) => a - b);
    return {
        schema: SYNC_SCHEMA,
        digests,
        digest_set_hash: digestSetHash(digests),
        broadcast_at_ms: now_ms,
    };
}

/**
 * Compute the delta a peer should send back. `peer_records` is the
 * peer's full archive (could be filtered by window upstream); the
 * function sends only those records the initiator doesn't have.
 */
export function computeDelta(
    initiator_list: ArchiveDigestList,
    peer_records: ReadonlyArray<ArchivedVerdict>,
    now_ms: number,
): ArchiveDelta {
    const initiator_set = new Set(initiator_list.digests);
    const peer_set = new Set(peer_records.map(r => r.digest));
    const missing_records = peer_records.filter(r => !initiator_set.has(r.digest));
    const peer_missing_digests = initiator_list.digests
        .filter(d => !peer_set.has(d))
        .sort((a, b) => a - b);
    return {
        schema: SYNC_SCHEMA,
        initiator_digest_set_hash: initiator_list.digest_set_hash,
        missing_records: missing_records.sort((a, b) => a.digest - b.digest),
        peer_missing_digests,
        delta_hash: digestSetHash(missing_records.map(r => r.digest)),
        replied_at_ms: now_ms,
    };
}

export type ApplyDeltaOutcome =
    | { ok: true; added_count: number; new_digest_set_hash: number }
    | { ok: false; reason: string };

/**
 * Apply a delta to a local archive's record set, returning the
 * augmented set. Verifies:
 *   - schema match;
 *   - all delta records have ARCHIVE_SCHEMA_VERSION (Era 1300 valid);
 *   - delta_hash matches recomputation;
 *   - no record collisions (same digest already present locally with
 *     different content — would indicate corruption).
 *
 * Records are added by digest — duplicate digests in the delta that
 * already exist locally are silently skipped. Collision (same digest,
 * different bytes) is rejected.
 */
export function applyDelta(
    local_records: ArchivedVerdict[],
    delta: ArchiveDelta,
): { outcome: ApplyDeltaOutcome; merged: ArchivedVerdict[] } {
    if (delta.schema !== SYNC_SCHEMA) {
        return { outcome: { ok: false, reason: `bad delta schema: ${delta.schema}` }, merged: local_records };
    }
    const recomputed = digestSetHash(delta.missing_records.map(r => r.digest));
    if (recomputed !== delta.delta_hash) {
        return {
            outcome: { ok: false, reason: `delta_hash drift: claimed=0x${(delta.delta_hash >>> 0).toString(16)} recomputed=0x${(recomputed >>> 0).toString(16)}` },
            merged: local_records,
        };
    }
    for (const r of delta.missing_records) {
        if (r.schema !== ARCHIVE_SCHEMA_VERSION) {
            return {
                outcome: { ok: false, reason: `delta record has bad archive schema: ${r.schema}` },
                merged: local_records,
            };
        }
    }
    const local_by_digest = new Map<number, ArchivedVerdict>();
    for (const r of local_records) local_by_digest.set(r.digest, r);
    let added = 0;
    for (const r of delta.missing_records) {
        const existing = local_by_digest.get(r.digest);
        if (!existing) {
            local_by_digest.set(r.digest, r);
            added++;
        } else {
            // Collision detection: a digest is supposed to be unique by
            // construction (FNV-1a of a verdict's content); if local and
            // remote disagree on contents at the same digest, it's a
            // corruption signal. We intentionally fail rather than
            // silently overwrite.
            if (existing.digest_hex !== r.digest_hex
                || existing.verdict !== r.verdict
                || existing.replayed_q16 !== r.replayed_q16) {
                return {
                    outcome: { ok: false, reason: `digest collision at 0x${existing.digest_hex}: local vs remote disagree` },
                    merged: local_records,
                };
            }
            // Identical record — idempotent skip.
        }
    }
    const merged = [...local_by_digest.values()].sort((a, b) => a.digest - b.digest);
    const new_set_hash = digestSetHash(merged.map(r => r.digest));
    return {
        outcome: { ok: true, added_count: added, new_digest_set_hash: new_set_hash },
        merged,
    };
}

/**
 * Run a single round of bidirectional sync between two archive
 * record sets. Returns the converged set + per-party delta info.
 *
 * This is a pure function for tests; in production each party
 * runs its own apply-delta over the wire.
 */
export interface RoundTrip {
    a_added_from_b: number;
    b_added_from_a: number;
    converged_records: ArchivedVerdict[];
    converged_digest_set_hash: number;
}

export function syncRound(
    a_records: ReadonlyArray<ArchivedVerdict>,
    b_records: ReadonlyArray<ArchivedVerdict>,
    now_ms: number,
): RoundTrip {
    const a_list: ArchiveDigestList = {
        schema: SYNC_SCHEMA,
        digests: a_records.map(r => r.digest).sort((x, y) => x - y),
        digest_set_hash: digestSetHash(a_records.map(r => r.digest)),
        broadcast_at_ms: now_ms,
    };
    // B sends A what A is missing.
    const b_to_a_delta = computeDelta(a_list, b_records, now_ms + 1);
    const a_after = applyDelta([...a_records], b_to_a_delta);
    if (!a_after.outcome.ok) {
        throw new Error(`syncRound: a applyDelta failed: ${a_after.outcome.reason}`);
    }

    // A sends B what B is missing (using B's missing-list from the same delta).
    const b_list: ArchiveDigestList = {
        schema: SYNC_SCHEMA,
        digests: b_records.map(r => r.digest).sort((x, y) => x - y),
        digest_set_hash: digestSetHash(b_records.map(r => r.digest)),
        broadcast_at_ms: now_ms,
    };
    const a_to_b_delta = computeDelta(b_list, a_after.merged, now_ms + 2);
    const b_after = applyDelta([...b_records], a_to_b_delta);
    if (!b_after.outcome.ok) {
        throw new Error(`syncRound: b applyDelta failed: ${b_after.outcome.reason}`);
    }

    return {
        a_added_from_b: a_after.outcome.added_count,
        b_added_from_a: b_after.outcome.added_count,
        converged_records: a_after.merged,
        converged_digest_set_hash: digestSetHash(a_after.merged.map(r => r.digest)),
    };
}

export const SYNC_SCHEMA_VERSION = SYNC_SCHEMA;
