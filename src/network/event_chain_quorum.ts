// 🌌 OMEGA-64: Era 1520 — Event-Chain Quorum
//
// The forensic-event convergence stack (Eras 1380-1510) gets every
// peer to a sink with the same `event_chain_anchor` after enough
// sync rounds. But while convergence is in progress, peers
// transiently disagree. Even after convergence, network partition
// or deliberate exclusion can leave a sub-mesh with a different
// anchor.
//
// Era 1520 makes that disagreement OBSERVABLE. It introduces a
// pure tracker that consumes (peer_id, anchor) observations and
// answers two questions:
//
//   1. Is there a consensus anchor right now? (i.e. an anchor
//      value claimed by ≥ K distinct peers within a TTL window).
//
//   2. Who's reporting a different anchor than the consensus?
//      These are "dissenters" — candidates for investigation
//      (Era 1210) or convergence-driven reconciliation (Era 1370).
//
// The tracker is pure data + functions. No I/O, no timers; caller
// supplies `now_ms`.
//
// PRINCIPLE: same as Era 1220's investigation convergence, applied
// at the event-chain layer. Multiple independent observers reaching
// the same anchor is the strongest cross-relay claim about "what
// the event log holds right now". A lone observer's anchor is
// informational; ≥3 observers in agreement is high-confidence.

export const QUORUM_SCHEMA = "OMEGA-1520/v1";

/** Confidence band derived from observer count. Mirrors Era 1220. */
export type QuorumBand = "none" | "lone" | "double" | "triple+" | "high";

export interface PeerAnchorObservation {
    peer_id: number;
    anchor: number;
    observed_at_ms: number;
}

export interface QuorumResult {
    /** Anchor value with the most fresh observers. `null` when no
     *  observations are fresh. */
    consensus_anchor: number | null;
    /** Number of peers claiming the consensus_anchor. */
    consensus_count: number;
    /** Total fresh observations across all anchor values. */
    total_observers: number;
    /** Confidence band for the consensus claim. */
    band: QuorumBand;
    /** Peer ids reporting an anchor different from the consensus. */
    dissenter_peer_ids: number[];
    /** Distinct anchor values currently observed (sorted ascending). */
    distinct_anchors: number[];
    /** Q16 fraction of fresh observers agreeing with consensus. */
    agreement_q16: number;
}

export interface QuorumOptions {
    /** Eviction window in ms. Observations older than this are
     *  ignored. */
    ttl_ms: number;
    /** Minimum observers to call the consensus "high confidence".
     *  Default 3, matching Era 1220's triple+ band. */
    high_threshold: number;
}

export const DEFAULT_QUORUM_OPTS: QuorumOptions = {
    ttl_ms: 5 * 60 * 1000,
    high_threshold: 3,
};

export class EventChainQuorumTracker {
    private observations = new Map<number, PeerAnchorObservation>();
    /** Era 1560: peers excluded from quorum (e.g. quarantined).
     *  Observations from these peers are silently dropped at
     *  `observe` time and any existing observations are removed. */
    private excluded = new Set<number>();

    constructor(public readonly opts: QuorumOptions = DEFAULT_QUORUM_OPTS) {
        if (!Number.isFinite(opts.ttl_ms) || opts.ttl_ms <= 0) {
            throw new Error(`EventChainQuorumTracker: ttl_ms must be positive: ${opts.ttl_ms}`);
        }
        if (!Number.isFinite(opts.high_threshold) || opts.high_threshold < 2) {
            throw new Error(`EventChainQuorumTracker: high_threshold must be ≥ 2: ${opts.high_threshold}`);
        }
    }

    /** Record (or update) a peer's anchor claim. Re-observing the
     *  same peer overwrites their prior claim. Excluded peers
     *  (Era 1560) are silently ignored. */
    observe(peer_id: number, anchor: number, now_ms: number): void {
        const pid = peer_id >>> 0;
        if (this.excluded.has(pid)) return;
        this.observations.set(pid, {
            peer_id: pid,
            anchor: anchor >>> 0,
            observed_at_ms: now_ms,
        });
    }

    /** Era 1560: mark a peer as excluded from quorum. Drops any
     *  existing observation. Subsequent `observe` calls for this
     *  peer are silently ignored until `unexclude` is called. */
    exclude(peer_id: number): void {
        const pid = peer_id >>> 0;
        this.excluded.add(pid);
        this.observations.delete(pid);
    }

    /** Era 1560: undo a prior `exclude`. The peer can again contribute
     *  observations from this point forward. */
    unexclude(peer_id: number): void {
        this.excluded.delete(peer_id >>> 0);
    }

    /** Era 1560: snapshot of currently-excluded peer ids, sorted ascending. */
    excludedPeers(): number[] {
        return [...this.excluded].sort((a, b) => a - b);
    }

    /** Drop a peer's observation explicitly (operator command,
     *  partition detection). */
    forget(peer_id: number): void {
        this.observations.delete(peer_id >>> 0);
    }

    /** Number of currently-fresh observations. */
    peerCount(now_ms: number): number {
        this.evict(now_ms);
        return this.observations.size;
    }

    /** Compute the quorum view at `now_ms`. */
    snapshot(now_ms: number): QuorumResult {
        this.evict(now_ms);
        if (this.observations.size === 0) {
            return {
                consensus_anchor: null,
                consensus_count: 0,
                total_observers: 0,
                band: "none",
                dissenter_peer_ids: [],
                distinct_anchors: [],
                agreement_q16: 0,
            };
        }
        // Tally observers per anchor.
        const counts = new Map<number, number>();
        for (const obs of this.observations.values()) {
            counts.set(obs.anchor, (counts.get(obs.anchor) ?? 0) + 1);
        }
        // Pick the most-observed anchor; ties broken by lower
        // anchor value for determinism.
        let consensusAnchor = 0;
        let consensusCount = 0;
        for (const [anchor, count] of counts) {
            if (
                count > consensusCount ||
                (count === consensusCount && anchor < consensusAnchor)
            ) {
                consensusAnchor = anchor;
                consensusCount = count;
            }
        }
        const total = this.observations.size;
        // Build dissenter list — peers reporting any other anchor.
        const dissenters: number[] = [];
        for (const obs of this.observations.values()) {
            if (obs.anchor !== consensusAnchor) dissenters.push(obs.peer_id);
        }
        dissenters.sort((a, b) => a - b);
        const distinct = [...counts.keys()].sort((a, b) => a - b);
        const band = this.bandOf(consensusCount);
        const agreement_q16 = Math.round((consensusCount / total) * 65536);
        return {
            consensus_anchor: consensusAnchor,
            consensus_count: consensusCount,
            total_observers: total,
            band,
            dissenter_peer_ids: dissenters,
            distinct_anchors: distinct,
            agreement_q16,
        };
    }

    /** Convenience: returns just the consensus anchor (or null). */
    consensusAnchor(now_ms: number): number | null {
        return this.snapshot(now_ms).consensus_anchor;
    }

    /** Convenience: returns just the dissenters list. */
    dissenters(now_ms: number): number[] {
        return this.snapshot(now_ms).dissenter_peer_ids;
    }

    private bandOf(count: number): QuorumBand {
        if (count === 0) return "none";
        if (count === 1) return "lone";
        if (count === 2) return "double";
        if (count >= this.opts.high_threshold) return "high";
        return "triple+";
    }

    private evict(now_ms: number): void {
        const cutoff = now_ms - this.opts.ttl_ms;
        for (const [pid, obs] of this.observations) {
            if (obs.observed_at_ms < cutoff) this.observations.delete(pid);
        }
    }
}

/** Format a quorum band as a colored glyph for terminal HUDs. */
export function quorumGlyph(band: QuorumBand): string {
    switch (band) {
        case "high":    return "🟢";
        case "triple+": return "🟢";
        case "double":  return "🟡";
        case "lone":    return "🟠";
        case "none":    return "⚪";
    }
}
