// Peer Snapshot Monitor

// Era 1190 made a relay's resilience metrics serializable. Era 1200
// makes them BROADCASTABLE: each relay periodically emits a
// SNAPSHOT_DIGEST frame containing its headline stats. Other relays
// observe these digests, compare them with their own
// ConvergenceDetector state, and detect partitions when measurements
// diverge by ≥ PARTITION_DIFF_THRESHOLD_Q16.

// On partition detection, the monitor surfaces an alarm AND can
// auto-raise an investigation proposal via the Era 1090 warrant
// issuance flow (caller-provided callback).

// SECURITY NOTE: a malicious relay could broadcast a fake digest
// claiming arbitrary numbers. The protocol does NOT trust digests
// blindly — the partition detection is a SIGNAL, not a verdict.
// The Senate's investigation flow  handles
// authentication of the response.

import { ConvergenceDetector } from "./convergence_detector.ts";
import {
    PARTITION_DIFF_THRESHOLD_Q16,
    rateAsPercent,
    redundancyRateDiffQ16,
    snapshotFromCounts,
    snapshotFromDetector,
    type ResilienceSnapshot,
} from "./resilience_snapshot.ts";
import {
    FRAME_TYPE_SNAPSHOT_DIGEST,
    type SporeFrame,
} from "./spore_frame.ts";

export interface PeerSnapshot {
    relay_id: number;
    last_seen_at_ms: number;
    digest: ResilienceSnapshot;
    /** True when this peer's measurement diverges from ours past threshold. */
    partition_suspected: boolean;
    /** Q16 difference vs our latest local snapshot at observation time. */
    diff_q16: number;
}

export interface PartitionAlarm {
    relay_id: number;
    self_rate_q16: number;
    peer_rate_q16: number;
    diff_q16: number;
    diff_percent: string;
    observed_at_ms: number;
}

export interface MonitorOptions {
    /** Q16 difference above which a peer is flagged. */
    threshold_q16: number;
    /** Capacity of the per-peer record map (FIFO eviction). */
    capacity: number;
    /** Optional callback fired on each new partition alarm. */
    on_alarm?: (alarm: PartitionAlarm) => void;
}

const DEFAULT_OPTS: MonitorOptions = {
    threshold_q16: PARTITION_DIFF_THRESHOLD_Q16,
    capacity: 64,
};

/**
 * Reconstruct a ResilienceSnapshot from a SNAPSHOT_DIGEST SporeFrame.
 * The digest carries only the headline stats; single/triple+ counters
 * are reconstructed conservatively (single = total - double, triple = 0).
 */
export function snapshotFromDigest(frame: SporeFrame): ResilienceSnapshot {
    const total = frame.payloadA >>> 0;
    const double = frame.payloadB >>> 0;
    const single = total > double ? total - double : 0;
    return snapshotFromCounts(total, single, double, 0, 0);
}

export class PeerSnapshotMonitor {
    private peers: Map<number, PeerSnapshot> = new Map();
    private order: number[] = [];
    private opts: MonitorOptions;
    public alarms: PartitionAlarm[] = [];

    constructor(
        private detector: ConvergenceDetector,
        opts: Partial<MonitorOptions> = {},
    ) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
    }

    /**
     * Ingest a SNAPSHOT_DIGEST frame. Compares the peer's stats with
     * our own ConvergenceDetector and records a partition alarm when
     * they diverge past the threshold.
     */
    observe(frame: SporeFrame, now_ms: number): PeerSnapshot {
        if (frame.frameType !== FRAME_TYPE_SNAPSHOT_DIGEST) {
            throw new Error("PeerSnapshotMonitor: not a SNAPSHOT_DIGEST frame");
        }
        const relay_id = frame.proposalOrTarget >>> 0;
        const peer_snap = snapshotFromDigest(frame);
        const self_snap = snapshotFromDetector(this.detector);
        const diff = redundancyRateDiffQ16(peer_snap, self_snap);
        const partition = diff >= this.opts.threshold_q16
            && self_snap.totalIntents > 0
            && peer_snap.totalIntents > 0;

        const rec: PeerSnapshot = {
            relay_id,
            last_seen_at_ms: now_ms,
            digest: peer_snap,
            partition_suspected: partition,
            diff_q16: diff,
        };

        if (!this.peers.has(relay_id)) {
            this.order.push(relay_id);
            if (this.order.length > this.opts.capacity) {
                const evicted = this.order.shift()!;
                this.peers.delete(evicted);
            }
        }
        this.peers.set(relay_id, rec);

        if (partition) {
            const alarm: PartitionAlarm = {
                relay_id,
                self_rate_q16: self_snap.redundancyRateQ16,
                peer_rate_q16: peer_snap.redundancyRateQ16,
                diff_q16: diff,
                diff_percent: rateAsPercent(diff),
                observed_at_ms: now_ms,
            };
            this.alarms.push(alarm);
            this.opts.on_alarm?.(alarm);
        }

        return rec;
    }

    /** All currently-tracked peer snapshots. */
    snapshot(): PeerSnapshot[] {
        return [...this.peers.values()];
    }

    /** Subset of peers currently flagged as partition-suspected. */
    suspectedPartitions(): PeerSnapshot[] {
        return this.snapshot().filter(p => p.partition_suspected);
    }

    /** Most recent N alarms, oldest-first. */
    recentAlarms(n: number = 10): PartitionAlarm[] {
        const len = this.alarms.length;
        return this.alarms.slice(Math.max(0, len - n));
    }

    /** Clear all peer state and alarms (test / reboot helper). */
    clear(): void {
        this.peers.clear();
        this.order = [];
        this.alarms = [];
    }
}
