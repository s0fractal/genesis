// 🌌 OMEGA-64: Era 1250 — Composite Health Broadcast + Peer Monitor
//
// Era 1240 computes a per-relay composite score in [0, 1]. Era 1250
// makes that score broadcastable via a new SporeFrame type
// (FRAME_TYPE_COMPOSITE_HEALTH = 6) so peer relays can compare
// composites the same way they compare resilience digests.
//
// META-PARTITION DETECTION: when two relays observing the same mesh
// disagree on the composite score by ≥ 0.20, that's NOT a network
// partition (which Era 1190 already detects via redundancy_rate);
// it's a META-partition — the relays don't even agree on what
// "healthy" means. Either one is fundamentally mis-classifying its
// observations, or the network split is so severe that one relay
// has lost most of its observability inputs.
//
// The threshold (0.20 absolute = 13107 in Q16) is intentionally
// stricter than Era 1190's 10% redundancy_rate threshold because
// composite scores already aggregate noise across multiple inputs;
// disagreement on the composite is a MORE signal-rich event than
// disagreement on any single underlying metric.

import {
    bandGlyph,
    type CompositeScore,
    type HealthBand,
} from "./mesh_health.ts";
import {
    FRAME_TYPE_COMPOSITE_HEALTH,
    type SporeFrame,
} from "./spore_frame.ts";

export const META_PARTITION_THRESHOLD_Q16 = 13_107; // ≈ 0.20

const BAND_CODES: Record<HealthBand, number> = {
    healthy: 0,
    watch: 1,
    degraded: 2,
    critical: 3,
};

const CODE_TO_BAND: HealthBand[] = ["healthy", "watch", "degraded", "critical"];

export function bandToCode(band: HealthBand): number {
    return BAND_CODES[band];
}

export function codeToBand(code: number): HealthBand {
    return CODE_TO_BAND[code & 0x03] ?? "watch";
}

export interface PeerCompositeRecord {
    relay_id: number;
    score: number;          // composite score in [0, 1]
    band: HealthBand;
    alarm_count: number;
    suspect_count: number;
    quarantine_count: number;
    redundancy_contrib: number; // [0, 1]
    last_seen_at_ms: number;
    /** Q16 diff between peer's composite and our latest local. */
    diff_q16: number;
    /** True iff diff ≥ META_PARTITION_THRESHOLD_Q16. */
    meta_partition_suspected: boolean;
}

export interface MetaPartitionAlarm {
    relay_id: number;
    self_score: number;
    peer_score: number;
    diff_q16: number;
    diff_percent: string;
    self_band: HealthBand;
    peer_band: HealthBand;
    observed_at_ms: number;
}

export interface CompositeMonitorOptions {
    /** Q16 threshold for meta-partition flag. Default 13107 ≈ 0.20. */
    threshold_q16: number;
    /** Capacity of the per-peer record map. Default 64. */
    capacity: number;
    /** Optional callback fired on each new meta-partition alarm. */
    on_meta_alarm?: (alarm: MetaPartitionAlarm) => void;
}

const DEFAULT_OPTS: CompositeMonitorOptions = {
    threshold_q16: META_PARTITION_THRESHOLD_Q16,
    capacity: 64,
};

/** Decode a COMPOSITE_HEALTH SporeFrame into a CompositeScore-shaped record. */
export function compositeFromFrame(frame: SporeFrame): {
    relay_id: number;
    score: number;
    band: HealthBand;
    alarm_count: number;
    suspect_count: number;
    quarantine_count: number;
    redundancy_contrib: number;
} | null {
    if (frame.frameType !== FRAME_TYPE_COMPOSITE_HEALTH) return null;
    const score = (frame.payloadA >>> 0) / 65536;
    const packed = frame.payloadB >>> 0;
    const band_code  = packed & 0xFF;
    const alarms     = (packed >>> 8)  & 0xFF;
    const suspects   = (packed >>> 16) & 0xFF;
    const quarantine = (packed >>> 24) & 0xFF;
    const red_contrib = (frame.payloadC >>> 0) / 65536;
    return {
        relay_id: frame.proposalOrTarget >>> 0,
        score: Math.min(1, Math.max(0, score)),
        band: codeToBand(band_code),
        alarm_count: alarms,
        suspect_count: suspects,
        quarantine_count: quarantine,
        redundancy_contrib: Math.min(1, Math.max(0, red_contrib)),
    };
}

export class CompositeHealthMonitor {
    private peers: Map<number, PeerCompositeRecord> = new Map();
    private order: number[] = [];
    private opts: CompositeMonitorOptions;
    public alarms: MetaPartitionAlarm[] = [];

    constructor(
        private getLocalComposite: () => CompositeScore,
        opts: Partial<CompositeMonitorOptions> = {},
    ) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        if (this.opts.capacity < 1) throw new Error("capacity must be ≥ 1");
    }

    /** Ingest a COMPOSITE_HEALTH frame, classify, surface alarms. */
    observe(frame: SporeFrame, now_ms: number): PeerCompositeRecord {
        if (frame.frameType !== FRAME_TYPE_COMPOSITE_HEALTH) {
            throw new Error("CompositeHealthMonitor: not a COMPOSITE_HEALTH frame");
        }
        const decoded = compositeFromFrame(frame)!;
        const self = this.getLocalComposite();
        const self_q16 = Math.round(self.score * 65536);
        const peer_q16 = frame.payloadA >>> 0;
        const diff = Math.abs(self_q16 - peer_q16);
        const meta = diff >= this.opts.threshold_q16;

        const rec: PeerCompositeRecord = {
            ...decoded,
            last_seen_at_ms: now_ms,
            diff_q16: diff,
            meta_partition_suspected: meta,
        };

        if (!this.peers.has(decoded.relay_id)) {
            this.order.push(decoded.relay_id);
            if (this.order.length > this.opts.capacity) {
                const evicted = this.order.shift()!;
                this.peers.delete(evicted);
            }
        }
        this.peers.set(decoded.relay_id, rec);

        if (meta) {
            const alarm: MetaPartitionAlarm = {
                relay_id: decoded.relay_id,
                self_score: self.score,
                peer_score: decoded.score,
                diff_q16: diff,
                diff_percent: ((diff / 65536) * 100).toFixed(2) + "%",
                self_band: self.band,
                peer_band: decoded.band,
                observed_at_ms: now_ms,
            };
            this.alarms.push(alarm);
            this.opts.on_meta_alarm?.(alarm);
        }

        return rec;
    }

    snapshot(): PeerCompositeRecord[] {
        return [...this.peers.values()];
    }

    suspectedMetaPartitions(): PeerCompositeRecord[] {
        return this.snapshot().filter(p => p.meta_partition_suspected);
    }

    recentAlarms(n: number = 10): MetaPartitionAlarm[] {
        return this.alarms.slice(Math.max(0, this.alarms.length - n));
    }

    /** Renders an ASCII summary line for HUD display. */
    summaryLine(): string {
        const all = this.snapshot();
        if (all.length === 0) return "(no peers reporting composite health)";
        const parts = all
            .sort((a, b) => a.relay_id - b.relay_id)
            .map(p => {
                const glyph = bandGlyph(p.band);
                const flag = p.meta_partition_suspected ? " ⚠" : "";
                return `${glyph}${p.score.toFixed(2)} 0x${p.relay_id.toString(16)}${flag}`;
            });
        return parts.join("  ");
    }

    clear(): void {
        this.peers.clear();
        this.order = [];
        this.alarms = [];
    }
}
