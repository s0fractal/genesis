// 🌌 OMEGA-64: Era 1380 — Forensic Event Sink
//
// Era 1370 produces `ConvergenceAlarmEvent` with a stable per-event
// FNV-1a hash. Earlier Eras emit other event-shaped payloads:
// partition alarms (Era 1200), investigation conclusions (Era 1210),
// quorum verdicts (Era 1290), etc. None of them had durable,
// chain-anchored storage.
//
// Era 1380 introduces an append-only event log:
//
//   • Each entry carries the entire payload PLUS a chain hash that
//     folds the previous entry's chain hash into its own — Merkle-
//     like sequential anchor. Tampering with any past entry breaks
//     the chain from that point onward, detectable by recomputation.
//
//   • Bounded ring buffer with FIFO eviction. Operators set capacity;
//     the oldest entries roll off. The chain anchor follows the
//     LIVE tail, so even after eviction the chain remains valid for
//     the surviving prefix.
//
//   • Cross-relay sync via the same set-difference idiom Era 1310
//     uses for archives: `eventChainHash(records)` over sorted
//     `event_hash` set is the cross-relay anchor.
//
// PRIMITIVE: FNV-1a only — same as the rest of the protocol. No
// new crypto. The chain is defensive against silent corruption +
// out-of-order replay, not adversarial forgery (Era 1040's ZK
// proofs cover the latter).

import { fnv1a32 } from "./cross_model_debate.ts";

export const EVENT_SINK_SCHEMA = "OMEGA-1380/v1";

/** Generic event envelope. Specific event types (alarm, verdict,
 *  partition) embed their own structured payload via `kind` + `payload`. */
export interface ForensicEvent {
    schema: string;
    /** Discriminator — e.g. "convergence-alarm", "partition", "verdict". */
    kind: string;
    /** Caller-supplied content hash from the originating Era. For
     *  Era 1370 this is `ConvergenceAlarmEvent.event_hash`. */
    event_hash: number;
    /** Wall-clock at the moment the event was sunk. */
    sunk_at_ms: number;
    /** Sequence index in the live log (0-based, monotonic across
     *  evictions). */
    sequence: number;
    /** Predecessor's `chain_hash` (0 for the first entry of the
     *  ring's lifetime). */
    prev_chain_hash: number;
    /** FNV-1a over (kind || event_hash || sunk_at_ms || sequence ||
     *  prev_chain_hash). */
    chain_hash: number;
    /** Opaque payload — caller's responsibility to interpret. Stored
     *  by reference; the sink does not introspect. */
    payload: unknown;
}

function u32Bytes(n: number, into: number[]): void {
    into.push(
        (n >>> 24) & 0xFF, (n >>> 16) & 0xFF,
        (n >>> 8) & 0xFF, n & 0xFF,
    );
}

function strBytes(s: string, into: number[]): void {
    for (let i = 0; i < s.length; i++) into.push(s.charCodeAt(i) & 0xFF);
    into.push(0); // null terminator (delimiter to prevent kind/event_hash overlap)
}

/** Compute the chain_hash for a candidate entry. */
export function computeChainHash(
    kind: string,
    event_hash: number,
    sunk_at_ms: number,
    sequence: number,
    prev_chain_hash: number,
): number {
    const b: number[] = [];
    strBytes(kind, b);
    u32Bytes(event_hash >>> 0, b);
    u32Bytes(sunk_at_ms >>> 0, b);
    u32Bytes(sequence >>> 0, b);
    u32Bytes(prev_chain_hash >>> 0, b);
    return fnv1a32(new Uint8Array(b));
}

/** Append-only ring buffer with chain-anchored entries. */
export class ForensicEventSink {
    private entries: ForensicEvent[] = [];
    private nextSequence = 0;
    private liveTailChainHash = 0;

    constructor(public capacity: number = 1024) {
        if (!Number.isFinite(capacity) || capacity <= 0) {
            throw new Error(`ForensicEventSink: capacity must be positive: ${capacity}`);
        }
    }

    /** Append a new event. Returns the constructed envelope. */
    append(
        kind: string,
        event_hash: number,
        payload: unknown,
        now_ms: number,
    ): ForensicEvent {
        const sequence = this.nextSequence++;
        const prev = this.liveTailChainHash;
        const chain = computeChainHash(kind, event_hash, now_ms, sequence, prev);
        const entry: ForensicEvent = {
            schema: EVENT_SINK_SCHEMA,
            kind,
            event_hash: event_hash >>> 0,
            sunk_at_ms: now_ms,
            sequence,
            prev_chain_hash: prev,
            chain_hash: chain,
            payload,
        };
        this.entries.push(entry);
        this.liveTailChainHash = chain;
        // FIFO eviction past capacity. Chain-of-custody for evicted
        // entries is preserved by the surviving entries' prev_chain_hash
        // links — verification works on whatever prefix is still live.
        while (this.entries.length > this.capacity) {
            this.entries.shift();
        }
        return entry;
    }

    /** All currently-live entries in append order. */
    list(): ReadonlyArray<ForensicEvent> {
        return this.entries;
    }

    /** Live-event count. */
    size(): number {
        return this.entries.length;
    }

    /** Most recent N entries (newest last). */
    tail(n: number): ForensicEvent[] {
        if (n <= 0) return [];
        return this.entries.slice(Math.max(0, this.entries.length - n));
    }

    /** Filter live entries by kind. */
    byKind(kind: string): ForensicEvent[] {
        return this.entries.filter((e) => e.kind === kind);
    }

    /** Lookup by event_hash. Returns null if not present (may have
     *  been evicted). */
    findByEventHash(event_hash: number): ForensicEvent | null {
        const target = event_hash >>> 0;
        for (const e of this.entries) {
            if (e.event_hash === target) return e;
        }
        return null;
    }

    /** Verify the chain from the first live entry forward. Returns
     *  the first sequence number where the chain breaks, or null
     *  if intact. */
    verifyChain(): number | null {
        let prev = this.entries.length > 0 ? this.entries[0].prev_chain_hash : 0;
        for (const e of this.entries) {
            if (e.prev_chain_hash !== prev) return e.sequence;
            const recomputed = computeChainHash(
                e.kind, e.event_hash, e.sunk_at_ms, e.sequence, e.prev_chain_hash,
            );
            if (recomputed !== e.chain_hash) return e.sequence;
            prev = e.chain_hash;
        }
        return null;
    }

    /** FNV-1a over the sorted set of `event_hash`es — cross-relay
     *  anchor (mirrors Era 1310's archive_hash convention). */
    eventChainAnchor(): number {
        const hashes = this.entries.map((e) => e.event_hash >>> 0);
        hashes.sort((a, b) => a - b);
        const buf = new Uint8Array(hashes.length * 4);
        for (let i = 0; i < hashes.length; i++) {
            const v = hashes[i];
            buf[i * 4 + 0] = (v >>> 24) & 0xFF;
            buf[i * 4 + 1] = (v >>> 16) & 0xFF;
            buf[i * 4 + 2] = (v >>> 8) & 0xFF;
            buf[i * 4 + 3] = v & 0xFF;
        }
        return fnv1a32(buf);
    }

    /** Operator-friendly summary. */
    summary(): {
        size: number;
        capacity: number;
        next_sequence: number;
        live_tail_chain_hash: number;
        event_chain_anchor: number;
        kinds: Record<string, number>;
    } {
        const kinds: Record<string, number> = {};
        for (const e of this.entries) {
            kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
        }
        return {
            size: this.entries.length,
            capacity: this.capacity,
            next_sequence: this.nextSequence,
            live_tail_chain_hash: this.liveTailChainHash,
            event_chain_anchor: this.eventChainAnchor(),
            kinds,
        };
    }

    /** Drop everything. Used in tests / manual reset. */
    clear(): void {
        this.entries = [];
        this.nextSequence = 0;
        this.liveTailChainHash = 0;
    }
}

/** Compare event_hash sets across two sinks. Mirrors Era 1310's
 *  archive `diffArchives` — returns digests each side lacks. */
export function diffEventSinks(
    a: ForensicEventSink,
    b: ForensicEventSink,
): { only_in_a: number[]; only_in_b: number[]; shared: number[] } {
    const ah = new Set(a.list().map((e) => e.event_hash >>> 0));
    const bh = new Set(b.list().map((e) => e.event_hash >>> 0));
    const only_in_a: number[] = [];
    const only_in_b: number[] = [];
    const shared: number[] = [];
    for (const h of ah) (bh.has(h) ? shared : only_in_a).push(h);
    for (const h of bh) if (!ah.has(h)) only_in_b.push(h);
    only_in_a.sort((x, y) => x - y);
    only_in_b.sort((x, y) => x - y);
    shared.sort((x, y) => x - y);
    return { only_in_a, only_in_b, shared };
}
