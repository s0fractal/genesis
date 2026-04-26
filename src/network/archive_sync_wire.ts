// 🌌 OMEGA-64: Era 1320 — Archive Sync over SporeFrame Wire
//
// Era 1310 defined a pure, transport-agnostic delta-exchange protocol.
// Era 1320 wires it onto the existing 32-byte SporeFrame envelope so
// cooperating relays can periodically reconcile their archives over
// the same UART/SPI/BLE link they already share for warrants and
// heartbeats — no out-of-band file transfer required.
//
// PROBLEM: an `ArchiveDelta` carries N `ArchivedVerdict` records,
// each substantially larger than 32 bytes (verdict string,
// adjudicator list, ms timestamps). It cannot fit in one frame.
//
// SOLUTION: a "delta envelope" — a sequence of DELTA_CHUNK frames
// (frame_type = 8) sharing the same `envelope_hash`. Sequence 0 is
// a HEADER frame carrying delta-level metadata; sequences 1..N each
// carry one record in compact form. Receivers buffer frames by
// envelope_hash, detect missing-chunk gaps, and reassemble the
// delta when the set is complete.
//
// LOSSY ENCODING (deliberate): each record frame carries only the
// fields that affect Era 1310's `applyDelta` integrity check
// (digest, verdict, replayed_q16) plus auxiliary bytes for
// debugging (source_relay_id, relay_count, overlap_pct). Wide-field
// metadata (adjudicator list, exact ms timestamps) is set to
// reasonable defaults during reassembly. The full ND-JSON archive
// (Era 1300) remains the source of truth for cold storage; wire
// chunks are for fast peer replication of "what digests the network
// has", not for cryptographic record forensics.
//
// CONVERGENCE: re-running an envelope with retransmitted frames is
// idempotent. Out-of-order arrival is tolerated. Missing chunks
// are reported by sequence number so the sender can selectively
// retransmit.

import {
    FRAME_TYPE_DELTA_CHUNK,
    SporeFrame,
    computeFrameCrc,
} from "./spore_frame.ts";
import {
    ArchiveDelta,
    digestSetHash,
} from "./archive_sync.ts";
import {
    ArchivedVerdict,
    ARCHIVE_SCHEMA_VERSION,
} from "./verdict_archive.ts";
import {
    codeToVerdict,
    verdictToCode,
} from "./quorum_broadcast.ts";

export const DELTA_CHUNK_SCHEMA = "OMEGA-1320/v1";
const SYNC_SCHEMA = "OMEGA-1310/v1"; // matches archive_sync.ts

/** Maximum records per delta envelope. The reserved field carries
 *  sequence (u16) | total (u16); sequence 0 is the header, so a
 *  single envelope can carry up to 0xFFFF record frames. In practice
 *  receivers will cap this much lower for memory bounds. */
export const MAX_RECORDS_PER_ENVELOPE = 0xFFFF;

/** Build the chunk frames for a delta envelope.
 *
 *  Frame layout (every frame in the envelope):
 *    proposalOrTarget = digest (header sets this to delta_hash)
 *    payloadA         = role-specific (header: initiator_digest_set_hash;
 *                                      record: source_relay_id)
 *    payloadB         = role-specific (header: replied_at_ms low32;
 *                                      record: packed verdict bits)
 *    payloadC         = role-specific (header: peer_missing_count;
 *                                      record: packed q16 fields)
 *    tick             = envelope_hash (= delta_hash) — ties chunks together
 *    reserved         = (sequence u16 << 16) | total u16
 *
 *  sequence 0 is HEADER; sequences 1..total are record chunks.
 *  total = number of record chunks (i.e. delta.missing_records.length).
 */
export function chunkDelta(
    delta: ArchiveDelta,
    sender_relay_id: number,
): SporeFrame[] {
    if (delta.schema !== SYNC_SCHEMA) {
        throw new Error(`chunkDelta: bad delta schema: ${delta.schema}`);
    }
    if (delta.missing_records.length > MAX_RECORDS_PER_ENVELOPE) {
        throw new Error(
            `chunkDelta: too many records: ${delta.missing_records.length} > ${MAX_RECORDS_PER_ENVELOPE}`,
        );
    }
    const total = delta.missing_records.length;
    const sender_byte = (sender_relay_id >>> 0) & 0xFF;
    const envelope_hash = delta.delta_hash >>> 0;

    const frames: SporeFrame[] = [];

    // Header (sequence = 0).
    const header: SporeFrame = {
        magic: 0x4F46,
        frameType: FRAME_TYPE_DELTA_CHUNK,
        oracleBit: sender_byte,
        proposalOrTarget: envelope_hash,
        payloadA: delta.initiator_digest_set_hash >>> 0,
        payloadB: (delta.replied_at_ms >>> 0) & 0xFFFF_FFFF,
        payloadC: Math.min(0xFFFF_FFFF, delta.peer_missing_digests.length) >>> 0,
        tick: envelope_hash,
        reserved: ((0 << 16) | (total & 0xFFFF)) >>> 0,
        crc32: 0,
    };
    header.crc32 = computeFrameCrc(header);
    frames.push(header);

    // Record chunks (sequence = 1..total). missing_records is already sorted
    // by digest in Era 1310's computeDelta, so the sequence ordering is
    // deterministic.
    for (let i = 0; i < total; i++) {
        const r = delta.missing_records[i];
        const verdictCode = verdictToCode(r.verdict) & 0xFF;
        const relayCount = Math.max(0, Math.min(0xFF, r.relay_count));
        const overlapPct = Math.max(0, Math.min(0xFF, r.overlap_pct));
        const highConfBit = r.high_confidence_at_archive ? 1 : 0;
        const verdictBits =
            (verdictCode |
                (relayCount << 8) |
                (overlapPct << 16) |
                ((highConfBit & 0x01) << 24)) >>>
            0;
        const replayedQ16 = Math.min(0xFFFF, r.replayed_q16 >>> 0);
        const diffQ16 = Math.min(0xFFFF, r.diff_q16 >>> 0);
        const q16Bits = ((replayedQ16 << 16) | diffQ16) >>> 0;

        const seq = i + 1;
        const f: SporeFrame = {
            magic: 0x4F46,
            frameType: FRAME_TYPE_DELTA_CHUNK,
            oracleBit: sender_byte,
            proposalOrTarget: r.digest >>> 0,
            payloadA: r.source_relay_id >>> 0,
            payloadB: verdictBits,
            payloadC: q16Bits,
            tick: envelope_hash,
            reserved: (((seq & 0xFFFF) << 16) | (total & 0xFFFF)) >>> 0,
            crc32: 0,
        };
        f.crc32 = computeFrameCrc(f);
        frames.push(f);
    }
    return frames;
}

export interface ReassembleResult {
    ok: boolean;
    delta?: ArchiveDelta;
    error?: string;
    /** Sequence numbers (1..total) that were not present in the input.
     *  Empty when ok=true OR when the failure is structural rather than
     *  a missing-chunk issue. */
    missing_sequences: number[];
    /** The envelope_hash that was being reassembled (best-effort). */
    envelope_hash?: number;
}

/** Reassemble a delta from a set of DELTA_CHUNK frames sharing the same
 *  envelope_hash. Tolerates duplicates (idempotent), rejects
 *  cross-envelope mixing, reports missing sequences.
 *
 *  When `expected_envelope_hash` is supplied, frames whose tick differs
 *  are silently ignored (foreign envelopes). Otherwise the first
 *  HEADER frame's envelope_hash is taken as authoritative. */
export function reassembleDelta(
    frames: ReadonlyArray<SporeFrame>,
    expected_envelope_hash?: number,
): ReassembleResult {
    // Step 1: filter to delta-chunk frames matching the target envelope.
    const candidates = frames.filter(
        (f) =>
            f.frameType === FRAME_TYPE_DELTA_CHUNK &&
            (expected_envelope_hash === undefined ||
                (f.tick >>> 0) === (expected_envelope_hash >>> 0)),
    );
    if (candidates.length === 0) {
        return {
            ok: false,
            error: "no delta-chunk frames present",
            missing_sequences: [],
            envelope_hash: expected_envelope_hash,
        };
    }

    // Step 2: discover envelope_hash from the first candidate when not given.
    const envelope_hash =
        expected_envelope_hash !== undefined
            ? expected_envelope_hash >>> 0
            : (candidates[0].tick >>> 0);

    // Step 3: enforce single-envelope membership.
    for (const f of candidates) {
        if ((f.tick >>> 0) !== envelope_hash) {
            return {
                ok: false,
                error: `cross-envelope frame: tick=0x${(f.tick >>> 0).toString(16)} expected=0x${envelope_hash.toString(16)}`,
                missing_sequences: [],
                envelope_hash,
            };
        }
    }

    // Step 4: dedup by sequence number; reject conflicting payloads at
    // the same sequence (would indicate corruption).
    const bySeq = new Map<number, SporeFrame>();
    for (const f of candidates) {
        const seq = (f.reserved >>> 16) & 0xFFFF;
        const existing = bySeq.get(seq);
        if (existing === undefined) {
            bySeq.set(seq, f);
            continue;
        }
        if (
            existing.proposalOrTarget !== f.proposalOrTarget ||
            existing.payloadA !== f.payloadA ||
            existing.payloadB !== f.payloadB ||
            existing.payloadC !== f.payloadC ||
            existing.reserved !== f.reserved
        ) {
            return {
                ok: false,
                error: `duplicate sequence ${seq} with conflicting payload`,
                missing_sequences: [],
                envelope_hash,
            };
        }
        // Identical retransmit — idempotent skip.
    }

    // Step 5: locate the header.
    const header = bySeq.get(0);
    if (!header) {
        return {
            ok: false,
            error: "header (sequence=0) missing",
            missing_sequences: [0],
            envelope_hash,
        };
    }
    const total = header.reserved & 0xFFFF;

    // Step 6: enforce that every record frame agrees on `total`.
    for (const [seq, f] of bySeq) {
        const fTotal = f.reserved & 0xFFFF;
        if (fTotal !== total) {
            return {
                ok: false,
                error: `sequence ${seq} reports total=${fTotal}, header total=${total}`,
                missing_sequences: [],
                envelope_hash,
            };
        }
    }

    // Step 7: detect missing record sequences.
    const missing: number[] = [];
    for (let s = 1; s <= total; s++) {
        if (!bySeq.has(s)) missing.push(s);
    }
    if (missing.length > 0) {
        return {
            ok: false,
            error: `missing ${missing.length} record chunk(s)`,
            missing_sequences: missing,
            envelope_hash,
        };
    }

    // Step 8: reconstruct the records in sequence order.
    const records: ArchivedVerdict[] = [];
    const replied_at_ms = header.payloadB >>> 0;
    for (let s = 1; s <= total; s++) {
        const f = bySeq.get(s)!;
        const verdictCode = f.payloadB & 0xFF;
        const relayCount = (f.payloadB >>> 8) & 0xFF;
        const overlapPct = (f.payloadB >>> 16) & 0xFF;
        const highConfBit = (f.payloadB >>> 24) & 0x01;
        const replayedQ16 = (f.payloadC >>> 16) & 0xFFFF;
        const diffQ16 = f.payloadC & 0xFFFF;
        const digest = f.proposalOrTarget >>> 0;

        records.push({
            schema: ARCHIVE_SCHEMA_VERSION,
            digest,
            digest_hex: `0x${digest.toString(16).padStart(8, "0")}`,
            verdict: codeToVerdict(verdictCode),
            source_relay_id: f.payloadA >>> 0,
            relay_count: relayCount,
            overlap_pct: overlapPct,
            replayed_q16: replayedQ16,
            diff_q16: diffQ16,
            // Wire form is lossy on these fields — receivers should not rely
            // on adjudicator-list or precise timestamps reconstructed from
            // chunks. The digest still uniquely content-addresses the
            // verdict, and `applyDelta`'s integrity check is digest-based.
            adjudicators: [],
            first_seen_at_ms: replied_at_ms,
            last_seen_at_ms: replied_at_ms,
            high_confidence_at_archive: highConfBit === 1,
        });
    }

    // Step 9: verify the envelope_hash matches the reconstructed record set.
    // This is the same delta_hash test Era 1310 applies post-receipt.
    const recomputed = digestSetHash(records.map((r) => r.digest));
    if (recomputed !== envelope_hash) {
        return {
            ok: false,
            error: `envelope_hash drift: recomputed=0x${(recomputed >>> 0).toString(16)} envelope=0x${envelope_hash.toString(16)}`,
            missing_sequences: [],
            envelope_hash,
        };
    }

    const delta: ArchiveDelta = {
        schema: SYNC_SCHEMA,
        initiator_digest_set_hash: header.payloadA >>> 0,
        missing_records: records,
        // The wire envelope omits the peer_missing_digests list (receiver
        // can derive its own from a fresh DigestList exchange). Future
        // Eras may pack it into auxiliary frames.
        peer_missing_digests: [],
        delta_hash: envelope_hash,
        replied_at_ms,
    };

    return {
        ok: true,
        delta,
        missing_sequences: [],
        envelope_hash,
    };
}
