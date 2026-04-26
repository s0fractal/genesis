// 🌌 OMEGA-64: Era 1410 — SporeFrame Wire-Format for Event Sync
//
// Era 1390 defined a pure event-delta protocol; Era 1410 packages
// the delta into 32-byte SporeFrames so spores can exchange events
// over the same wire used for archive syncs (Era 1320), warrants,
// and heartbeats.
//
// ENVELOPE: a sequence of `EVENT_DELTA_CHUNK` frames sharing an
// `envelope_hash` (= the JS `delta_hash` of the wrapped EventDelta).
// Sequence 0 is HEADER (carries delta-level metadata); sequences
// 1..N each carry one event entry in compact form.
//
// LOSSY ENCODING (deliberate, consistent with Era 1320): wire chunks
// carry only the fields Era 1390's `applyEventDelta` integrity
// check inspects:
//   • event_hash (the cross-Era content address)
//   • kind (4-char tag, packed into payload_b)
//   • chain_hash (informational; re-derived locally on import)
// Adjudicators, exact ms timestamps, and full payload bodies are
// reconstructed to defaults during reassembly. This is acceptable
// because Era 1390's collision check operates on `event_hash + kind`
// — both of which survive the wire intact.
//
// CROSS-SUBSTRATE: the Rust spore (Era 1400) computes identical
// `event_hash_set_hash` values, so a JS reassembler reading frames
// produced by a Cortex-M4F sender (or vice versa) reaches the same
// envelope_hash and the same applyEventDelta outcome.

import {
    FRAME_TYPE_EVENT_DELTA_CHUNK,
    FRAME_TYPE_EVENT_HASH_LIST,
    SporeFrame,
    computeFrameCrc,
} from "./spore_frame.ts";
import {
    EventDelta,
    eventHashSetHash,
} from "./event_sink_sync.ts";
import {
    EVENT_SINK_SCHEMA,
    ForensicEvent,
} from "./forensic_event_sink.ts";

export const EVENT_WIRE_SCHEMA = "OMEGA-1410/v1";

/** Pack a kind string (up to 4 ASCII chars) into a u32. Truncates
 *  longer strings; pads shorter ones with zeros. Matches the
 *  4-byte slot layout the Rust spore can read trivially. */
export function packKindTag(kind: string): number {
    let v = 0;
    for (let i = 0; i < 4; i++) {
        const code = i < kind.length ? (kind.charCodeAt(i) & 0xFF) : 0;
        v = ((v << 8) | code) >>> 0;
    }
    return v >>> 0;
}

/** Inverse of packKindTag. Stops at the first null byte. */
export function unpackKindTag(packed: number): string {
    const bytes: number[] = [
        (packed >>> 24) & 0xFF,
        (packed >>> 16) & 0xFF,
        (packed >>> 8) & 0xFF,
        packed & 0xFF,
    ];
    let s = "";
    for (const b of bytes) {
        if (b === 0) break;
        s += String.fromCharCode(b);
    }
    return s;
}

/** Chunk an `EventDelta` into a sequence of EVENT_DELTA_CHUNK frames.
 *  Layout per record chunk:
 *    proposalOrTarget = event_hash
 *    payloadA         = sender_relay_id
 *    payloadB         = packed kind tag (up to 4 chars)
 *    payloadC         = chain_hash (informational)
 *    tick             = envelope_hash (= delta_hash)
 *    reserved         = (seq u16 << 16) | total u16
 *  Header (sequence=0):
 *    proposalOrTarget = envelope_hash (= delta_hash)
 *    payloadA         = initiator_anchor
 *    payloadB         = replied_at_ms low32
 *    payloadC         = peer_missing_count
 *    tick             = envelope_hash
 *    reserved         = (0 << 16) | total u16
 */
export function chunkEventDelta(
    delta: EventDelta,
    sender_relay_id: number,
): SporeFrame[] {
    if (delta.missing_entries.length > 0xFFFF) {
        throw new Error(`chunkEventDelta: too many entries: ${delta.missing_entries.length}`);
    }
    const total = delta.missing_entries.length;
    const sender_byte = (sender_relay_id >>> 0) & 0xFF;
    const envelope_hash = delta.delta_hash >>> 0;
    const frames: SporeFrame[] = [];

    const header: SporeFrame = {
        magic: 0x4F46,
        frameType: FRAME_TYPE_EVENT_DELTA_CHUNK,
        oracleBit: sender_byte,
        proposalOrTarget: envelope_hash,
        payloadA: delta.initiator_anchor >>> 0,
        payloadB: (delta.replied_at_ms >>> 0),
        payloadC: Math.min(0xFFFF_FFFF, delta.peer_missing_hashes.length) >>> 0,
        tick: envelope_hash,
        reserved: ((0 << 16) | (total & 0xFFFF)) >>> 0,
        crc32: 0,
    };
    header.crc32 = computeFrameCrc(header);
    frames.push(header);

    for (let i = 0; i < total; i++) {
        const e = delta.missing_entries[i];
        const seq = i + 1;
        const f: SporeFrame = {
            magic: 0x4F46,
            frameType: FRAME_TYPE_EVENT_DELTA_CHUNK,
            oracleBit: sender_byte,
            proposalOrTarget: e.event_hash >>> 0,
            payloadA: 0, // sender_relay_id (sender is shared via header.oracleBit)
            payloadB: packKindTag(e.kind),
            payloadC: e.chain_hash >>> 0,
            tick: envelope_hash,
            reserved: (((seq & 0xFFFF) << 16) | (total & 0xFFFF)) >>> 0,
            crc32: 0,
        };
        f.crc32 = computeFrameCrc(f);
        frames.push(f);
    }
    return frames;
}

export interface ReassembleEventDeltaResult {
    ok: boolean;
    delta?: EventDelta;
    error?: string;
    missing_sequences: number[];
    envelope_hash?: number;
}

/** Reassemble an `EventDelta` from a set of frames sharing the
 *  same envelope_hash. Mirrors the structural guarantees of
 *  Era 1320's `reassembleDelta` — out-of-order tolerant, dedup
 *  idempotent, gap-detecting. */
export function reassembleEventDelta(
    frames: ReadonlyArray<SporeFrame>,
    expected_envelope_hash?: number,
): ReassembleEventDeltaResult {
    const candidates = frames.filter(
        (f) =>
            f.frameType === FRAME_TYPE_EVENT_DELTA_CHUNK &&
            (expected_envelope_hash === undefined ||
                (f.tick >>> 0) === (expected_envelope_hash >>> 0)),
    );
    if (candidates.length === 0) {
        return { ok: false, error: "no event-delta-chunk frames present", missing_sequences: [] };
    }
    const envelope_hash =
        expected_envelope_hash !== undefined
            ? expected_envelope_hash >>> 0
            : (candidates[0].tick >>> 0);
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
    }
    const header = bySeq.get(0);
    if (!header) {
        return { ok: false, error: "header (sequence=0) missing", missing_sequences: [0], envelope_hash };
    }
    const total = header.reserved & 0xFFFF;
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
    const missing: number[] = [];
    for (let s = 1; s <= total; s++) if (!bySeq.has(s)) missing.push(s);
    if (missing.length > 0) {
        return {
            ok: false,
            error: `missing ${missing.length} record chunk(s)`,
            missing_sequences: missing,
            envelope_hash,
        };
    }

    const entries: ForensicEvent[] = [];
    const replied_at_ms = header.payloadB >>> 0;
    for (let s = 1; s <= total; s++) {
        const f = bySeq.get(s)!;
        const event_hash = f.proposalOrTarget >>> 0;
        const kind = unpackKindTag(f.payloadB);
        const chain_hash = f.payloadC >>> 0;
        entries.push({
            schema: EVENT_SINK_SCHEMA,
            kind,
            event_hash,
            sunk_at_ms: replied_at_ms,
            sequence: 0, // local-only on import
            prev_chain_hash: 0,
            chain_hash,
            payload: null,
        });
    }
    // envelope_hash self-check.
    const recomputed = eventHashSetHash(entries.map((e) => e.event_hash));
    if (recomputed !== envelope_hash) {
        return {
            ok: false,
            error: `envelope_hash drift: recomputed=0x${recomputed.toString(16)} envelope=0x${envelope_hash.toString(16)}`,
            missing_sequences: [],
            envelope_hash,
        };
    }
    const delta: EventDelta = {
        schema: "OMEGA-1390/v1",
        initiator_anchor: header.payloadA >>> 0,
        missing_entries: entries,
        peer_missing_hashes: [],
        delta_hash: envelope_hash,
        replied_at_ms,
    };
    return { ok: true, delta, missing_sequences: [], envelope_hash };
}
