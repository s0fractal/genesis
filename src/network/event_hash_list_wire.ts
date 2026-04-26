// 🌌 OMEGA-64: Era 1470 — Hash-List Request/Response Frames
//
// Era 1460's `ConvergenceDriver` ships its full local set on
// anchor mismatch — correct (idempotent skip on receiver) but
// bandwidth-suboptimal. Era 1470 adds the request/response
// frame pair so a spore can ask for the peer's full hash list
// and ship only the genuine difference.
//
// FRAME PAIR:
//
//   • EVENT_HASH_REQUEST (frame_type = 11) — single frame.
//     Carries `sender_relay_id` and `request_id` (a nonce).
//
//   • EVENT_HASH_RESPONSE (frame_type = 12) — chunked. Each
//     frame carries up to 4 event_hashes plus (seq, total,
//     valid_count) packed into the reserved field. Receiver
//     buffers chunks by `request_id` and assembles the full
//     hash list once all chunks present.
//
// CHUNK CAPACITY: at 4 hashes per 32-byte frame, a typical sink
// of 64 events fits in 16 frames, comfortably under the seq/total
// u8 ceiling (255 chunks × 4 hashes = 1020 hashes max).

import {
    FRAME_TYPE_EVENT_HASH_REQUEST,
    FRAME_TYPE_EVENT_HASH_RESPONSE,
    SporeFrame,
    computeFrameCrc,
} from "./spore_frame.ts";

export const HASH_LIST_WIRE_SCHEMA = "OMEGA-1470/v1";

/** Build a single HASH_REQUEST frame. `request_id` is any nonce
 *  the caller chooses to disambiguate concurrent requests. */
export function buildHashRequestFrame(
    sender_relay_id: number,
    request_id: number,
): SporeFrame {
    const f: SporeFrame = {
        magic: 0x4F46,
        frameType: FRAME_TYPE_EVENT_HASH_REQUEST,
        oracleBit: 0xFF,
        proposalOrTarget: sender_relay_id >>> 0,
        payloadA: 0,
        payloadB: 0,
        payloadC: 0,
        tick: request_id >>> 0,
        reserved: 0,
        crc32: 0,
    };
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Chunk a sorted hash list into HASH_RESPONSE frames (4 hashes
 *  per frame). Empty input produces a single chunk with valid=0
 *  so the receiver knows the request was answered (with nothing). */
export function chunkHashListResponse(
    hashes: ReadonlyArray<number>,
    request_id: number,
): SporeFrame[] {
    const sorted = [...hashes].map((h) => h >>> 0).sort((a, b) => a - b);
    const total = Math.max(1, Math.ceil(sorted.length / 4));
    if (total > 0xFF) {
        throw new Error(`hash list too large: ${sorted.length} (max 1020)`);
    }
    const frames: SporeFrame[] = [];
    for (let chunk = 0; chunk < total; chunk++) {
        const start = chunk * 4;
        const slice = sorted.slice(start, start + 4);
        const valid = slice.length;
        const slot: number[] = [
            slice[0] ?? 0,
            slice[1] ?? 0,
            slice[2] ?? 0,
            slice[3] ?? 0,
        ];
        const seq = chunk + 1;
        const f: SporeFrame = {
            magic: 0x4F46,
            frameType: FRAME_TYPE_EVENT_HASH_RESPONSE,
            oracleBit: 0xFF,
            proposalOrTarget: slot[0] >>> 0,
            payloadA: slot[1] >>> 0,
            payloadB: slot[2] >>> 0,
            payloadC: slot[3] >>> 0,
            tick: request_id >>> 0,
            reserved:
                (((seq & 0xFF) << 24) |
                ((total & 0xFF) << 16) |
                ((valid & 0xFF) << 8)) >>> 0,
            crc32: 0,
        };
        f.crc32 = computeFrameCrc(f);
        frames.push(f);
    }
    return frames;
}

export interface ReassembleHashListResult {
    ok: boolean;
    hashes?: number[];
    error?: string;
    missing_chunks?: number[];
    request_id?: number;
}

/** Reassemble a hash list from HASH_RESPONSE chunks. Filters by
 *  `request_id` so concurrent responses don't mix. Tolerates
 *  out-of-order arrival, dedups identical chunks, rejects
 *  conflicting chunks at the same sequence. */
export function reassembleHashListResponse(
    frames: ReadonlyArray<SporeFrame>,
    expected_request_id?: number,
): ReassembleHashListResult {
    const candidates = frames.filter(
        (f) =>
            f.frameType === FRAME_TYPE_EVENT_HASH_RESPONSE &&
            (expected_request_id === undefined ||
                (f.tick >>> 0) === (expected_request_id >>> 0)),
    );
    if (candidates.length === 0) {
        return { ok: false, error: "no hash-response frames present" };
    }
    const request_id =
        expected_request_id !== undefined
            ? expected_request_id >>> 0
            : (candidates[0].tick >>> 0);
    for (const f of candidates) {
        if ((f.tick >>> 0) !== request_id) {
            return {
                ok: false,
                error: `cross-request frame: tick=0x${(f.tick >>> 0).toString(16)} expected=0x${request_id.toString(16)}`,
                request_id,
            };
        }
    }
    const bySeq = new Map<number, SporeFrame>();
    let total = 0;
    for (const f of candidates) {
        const seq = (f.reserved >>> 24) & 0xFF;
        const fTotal = (f.reserved >>> 16) & 0xFF;
        if (total === 0) total = fTotal;
        else if (fTotal !== total) {
            return {
                ok: false,
                error: `chunk ${seq} reports total=${fTotal}, expected ${total}`,
                request_id,
            };
        }
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
                error: `duplicate chunk ${seq} with conflicting payload`,
                request_id,
            };
        }
    }
    const missing: number[] = [];
    for (let s = 1; s <= total; s++) if (!bySeq.has(s)) missing.push(s);
    if (missing.length > 0) {
        return {
            ok: false,
            error: `missing ${missing.length} chunk(s)`,
            missing_chunks: missing,
            request_id,
        };
    }
    const hashes: number[] = [];
    for (let s = 1; s <= total; s++) {
        const f = bySeq.get(s)!;
        const valid = (f.reserved >>> 8) & 0xFF;
        const slots = [f.proposalOrTarget, f.payloadA, f.payloadB, f.payloadC];
        for (let i = 0; i < valid && i < 4; i++) {
            hashes.push(slots[i] >>> 0);
        }
    }
    hashes.sort((a, b) => a - b);
    return { ok: true, hashes, request_id };
}

/** Compute the entries the local sink should ship to a peer given
 *  the peer's full hash list. Pure set-difference — the local
 *  entries whose `event_hash` is NOT in the peer's known set. */
export function computeMissingFromPeer<T extends { event_hash: number }>(
    local_entries: ReadonlyArray<T>,
    peer_hashes: ReadonlyArray<number>,
): T[] {
    const peer_set = new Set(peer_hashes.map((h) => h >>> 0));
    return local_entries.filter((e) => !peer_set.has(e.event_hash >>> 0));
}
