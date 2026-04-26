// 🌌 OMEGA-64: Era 1260 — Frame Recorder + Trace Replay
//
// Every observability layer (Era 1180 ConvergenceDetector, Era 1200
// PeerSnapshotMonitor, Era 1220 InvestigationConvergenceTracker,
// Era 1240 mesh_health, Era 1250 CompositeHealthMonitor) is a pure
// function of the frames it has observed. If we keep an append-only
// log of every frame that arrived at a relay, we can replay any
// past window through the SAME pure functions and forensically
// reconstruct what the relay knew at any point in time.
//
// THE INVARIANT: replay(frames) === observe-each-frame(frames). The
// recorder doesn't change observability — it makes it auditable.
//
// SCOPE: bounded ring buffer (default 4096 entries) so memory is
// predictable on long-running relays. Sufficient for ~1 hour of
// 1Hz traffic, the typical incident-investigation window.

import {
    SporeFrame,
    frameFromBytes,
    frameToBytes,
} from "./spore_frame.ts";

export interface RecordedFrame {
    /** Frame as observed (deep copy to immune from mutation). */
    frame: SporeFrame;
    /** Wall-clock ms when the frame was ingested. */
    received_at_ms: number;
    /** Spore_id that handed us this copy (caller-supplied). */
    delivered_by: string;
}

export interface RecorderOptions {
    /** Capacity of the ring buffer (FIFO eviction). Default 4096. */
    capacity: number;
}

const DEFAULT_OPTS: RecorderOptions = {
    capacity: 4096,
};

/**
 * Append-only frame log with FIFO eviction.
 *
 * The recorder DOES NOT interpret frames — it just stores them. Replay
 * functions operate on the recorded sequence using the existing
 * observability primitives.
 */
export class FrameRecorder {
    private buffer: RecordedFrame[] = [];
    private opts: RecorderOptions;
    /** Total frames ever recorded (overflows wrap, but tracks lifetime ingest). */
    public total_recorded: number = 0;

    constructor(opts: Partial<RecorderOptions> = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
    }

    /**
     * Record a frame observation. Frame is shallow-copied to insulate
     * the log from later mutations of the original object.
     */
    record(frame: SporeFrame, received_at_ms: number, delivered_by: string): void {
        const snapshot: RecordedFrame = {
            frame: { ...frame },
            received_at_ms,
            delivered_by,
        };
        this.buffer.push(snapshot);
        if (this.buffer.length > this.opts.capacity) {
            this.buffer.shift();
        }
        this.total_recorded = (this.total_recorded + 1) >>> 0;
    }

    size(): number {
        return this.buffer.length;
    }

    /** Returns all recorded frames in insertion order. */
    snapshot(): RecordedFrame[] {
        return [...this.buffer];
    }

    /** Returns frames whose `received_at_ms` falls in [start, end]. */
    range(start_ms: number, end_ms: number): RecordedFrame[] {
        return this.buffer.filter(
            r => r.received_at_ms >= start_ms && r.received_at_ms <= end_ms,
        );
    }

    /** Returns frames matching a predicate. */
    filter(pred: (r: RecordedFrame) => boolean): RecordedFrame[] {
        return this.buffer.filter(pred);
    }

    /** Returns frames of a specific type. */
    byType(frame_type: number): RecordedFrame[] {
        return this.buffer.filter(r => r.frame.frameType === frame_type);
    }

    /** Returns frames delivered by a specific spore_id. */
    byDeliverer(spore_id: string): RecordedFrame[] {
        return this.buffer.filter(r => r.delivered_by === spore_id);
    }

    /**
     * Serialize all recorded frames to a flat Uint8Array
     * (32 bytes per frame, in insertion order). Suitable for export
     * to a forensic archive.
     */
    serialize(): Uint8Array {
        const total = this.buffer.length * 32;
        const out = new Uint8Array(total);
        for (let i = 0; i < this.buffer.length; i++) {
            const bytes = frameToBytes(this.buffer[i].frame);
            out.set(bytes, i * 32);
        }
        return out;
    }

    /**
     * Build a recorder from a serialized blob. Lost: per-frame
     * received_at_ms and delivered_by metadata (not on-the-wire).
     * Caller may rehydrate those if it has a separate metadata trail.
     */
    static fromSerialized(blob: Uint8Array, opts: Partial<RecorderOptions> = {}): FrameRecorder {
        const r = new FrameRecorder(opts);
        for (let off = 0; off + 32 <= blob.length; off += 32) {
            const slice = blob.subarray(off, off + 32);
            const f = frameFromBytes(slice);
            if (!f) continue;
            r.record(f, 0, "(replay)");
        }
        return r;
    }

    clear(): void {
        this.buffer = [];
        this.total_recorded = 0;
    }
}

/**
 * Re-feed a sequence of recorded frames through an observation
 * function. Keeps the original recorder untouched.
 *
 * `observe(frame, delivered_by, received_at_ms)` is the per-frame
 * sink — typically `(f, by, t) => detector.observe(f, by, t)`.
 */
export function replayThrough<T>(
    frames: ReadonlyArray<RecordedFrame>,
    observe: (frame: SporeFrame, delivered_by: string, received_at_ms: number) => T,
): T[] {
    const out: T[] = [];
    for (const r of frames) {
        out.push(observe(r.frame, r.delivered_by, r.received_at_ms));
    }
    return out;
}

/**
 * Replay a window into a fresh observer. Convenience wrapper around
 * `replayThrough` for the common pattern of "give me a fresh
 * detector reflecting what the relay would have seen between t1
 * and t2".
 */
export function replayWindow<O>(
    recorder: FrameRecorder,
    start_ms: number,
    end_ms: number,
    factory: () => O,
    feed: (observer: O, frame: SporeFrame, delivered_by: string, received_at_ms: number) => void,
): O {
    const observer = factory();
    const frames = recorder.range(start_ms, end_ms);
    for (const r of frames) {
        feed(observer, r.frame, r.delivered_by, r.received_at_ms);
    }
    return observer;
}

/** Aggregate stats over a recorded slice for HUD/forensics. */
export interface ReplayStats {
    total_frames: number;
    by_type: Record<number, number>;
    by_deliverer: Record<string, number>;
    earliest_at_ms: number;
    latest_at_ms: number;
}

export function summarize(frames: ReadonlyArray<RecordedFrame>): ReplayStats {
    if (frames.length === 0) {
        return {
            total_frames: 0,
            by_type: {},
            by_deliverer: {},
            earliest_at_ms: 0,
            latest_at_ms: 0,
        };
    }
    const by_type: Record<number, number> = {};
    const by_deliverer: Record<string, number> = {};
    let earliest = frames[0].received_at_ms;
    let latest = frames[0].received_at_ms;
    for (const r of frames) {
        const t = r.frame.frameType;
        by_type[t] = (by_type[t] ?? 0) + 1;
        by_deliverer[r.delivered_by] = (by_deliverer[r.delivered_by] ?? 0) + 1;
        if (r.received_at_ms < earliest) earliest = r.received_at_ms;
        if (r.received_at_ms > latest) latest = r.received_at_ms;
    }
    return {
        total_frames: frames.length,
        by_type,
        by_deliverer,
        earliest_at_ms: earliest,
        latest_at_ms: latest,
    };
}
