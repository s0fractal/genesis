// 🌌 OMEGA-64: Era 1580 — Multi-Sink Investigator
//
// Eras 1380–1570 built the autonomous-investigation loop for
// ONE forensic event sink. A real deployment may host several:
// one per security domain, per cluster, per data category. Each
// sink has its own anchor, its own consensus, its own dissenters.
//
// Era 1580 introduces `MultiSinkInvestigator` — a thin
// orchestrator that holds a map of `sink_id → AutoInvestigationLoop`
// and routes operations to the right one. Critically, it
// maintains a SHARED peer-quarantine set: a peer banned in one
// domain is banned across all sinks (consistent with
// Era 1080's notion of quarantine as a peer-level, not domain-
// level, state).
//
// PURE COMPOSITION: this module doesn't introduce new policy.
// Each sink runs the same Era 1550 loop semantics; the
// multi-sink layer just dispatches. Per-sink customization
// (different `LoopOptions`) is allowed at sink-creation time.

import {
    AutoInvestigationLoop,
    DEFAULT_LOOP_OPTS,
    LoopOptions,
    LoopTickResult,
    WarrantEmit,
} from "./auto_investigation_loop.ts";
import { WarrantProposalPayload } from "./quorum_warrant_bridge.ts";

export const MULTI_SINK_SCHEMA = "OMEGA-1580/v1";

export interface MultiTickResult {
    /** Per-sink tick result, keyed by sink_id. */
    per_sink: Map<string, LoopTickResult>;
    /** Total proposals emitted across all sinks. */
    total_emitted: number;
    /** Total proposals built (incl. those that failed to emit
     *  or were deduped). */
    total_built: number;
    /** Total dissenters seen across all sinks (each peer counted
     *  once per sink it dissents in). */
    total_dissenters: number;
}

export class MultiSinkInvestigator {
    private sinks = new Map<string, AutoInvestigationLoop>();
    /** Shared exclusion set — applied to every sink on add. */
    private globally_excluded = new Set<number>();

    constructor(public readonly emit: WarrantEmit) {}

    /** Register a new sink with optional per-sink options. The
     *  emit callback will receive proposals from this sink wrapped
     *  with `sink_id` metadata via the wrapping helper, so callers
     *  can route each proposal to the correct sink's handler. */
    addSink(sink_id: string, opts: LoopOptions = DEFAULT_LOOP_OPTS): void {
        if (this.sinks.has(sink_id)) {
            throw new Error(`MultiSinkInvestigator: sink_id '${sink_id}' already registered`);
        }
        const wrappedEmit: WarrantEmit = (proposal: WarrantProposalPayload) => {
            return this.emit({ ...proposal, sink_id } as WarrantProposalPayload & { sink_id: string });
        };
        const loop = new AutoInvestigationLoop(wrappedEmit, opts);
        // Apply pre-existing globally-excluded peers.
        for (const peer of this.globally_excluded) loop.excludePeer(peer);
        this.sinks.set(sink_id, loop);
    }

    /** Drop a sink and its loop entirely. */
    removeSink(sink_id: string): void {
        this.sinks.delete(sink_id);
    }

    /** Direct accessor for inspection / drilldown. */
    getSink(sink_id: string): AutoInvestigationLoop | undefined {
        return this.sinks.get(sink_id);
    }

    /** Number of registered sinks. */
    sinkCount(): number {
        return this.sinks.size;
    }

    /** Sorted list of sink ids. */
    sinkIds(): string[] {
        return [...this.sinks.keys()].sort();
    }

    /** Route a peer-anchor observation to a specific sink. */
    observePeerAnchor(
        sink_id: string,
        peer_id: number,
        anchor: number,
        now_ms: number,
    ): boolean {
        const loop = this.sinks.get(sink_id);
        if (!loop) return false;
        loop.observePeerAnchor(peer_id, anchor, now_ms);
        return true;
    }

    /** Run a tick on every registered sink. Returns aggregated +
     *  per-sink results. */
    async tickAll(now_ms: number): Promise<MultiTickResult> {
        const per_sink = new Map<string, LoopTickResult>();
        let total_emitted = 0;
        let total_built = 0;
        let total_dissenters = 0;
        // Iterate in a deterministic order (sorted ids) so test
        // output is reproducible.
        for (const id of [...this.sinks.keys()].sort()) {
            const loop = this.sinks.get(id)!;
            const r = await loop.tick(now_ms);
            per_sink.set(id, r);
            total_emitted += r.proposals_emitted;
            total_built += r.proposals_built.length;
            total_dissenters += r.trigger_outcome.dissenter_count;
        }
        return { per_sink, total_emitted, total_built, total_dissenters };
    }

    /** Run tick on a single sink only. Useful when only one sink
     *  has new observations and tickAll would waste work. */
    async tickOne(sink_id: string, now_ms: number): Promise<LoopTickResult | undefined> {
        const loop = this.sinks.get(sink_id);
        if (!loop) return undefined;
        return await loop.tick(now_ms);
    }

    /** Globally exclude a peer (e.g. quarantined by senate).
     *  Propagates `excludePeer` to every existing sink AND
     *  remembers the exclusion so any sinks added later are
     *  also gated against this peer. */
    excludePeerGlobally(peer_id: number): void {
        const pid = peer_id >>> 0;
        this.globally_excluded.add(pid);
        for (const loop of this.sinks.values()) loop.excludePeer(pid);
    }

    /** Reverse a global exclusion. */
    includePeerGlobally(peer_id: number): void {
        const pid = peer_id >>> 0;
        this.globally_excluded.delete(pid);
        for (const loop of this.sinks.values()) loop.includePeer(pid);
    }

    /** Sorted list of currently-globally-excluded peer ids. */
    globallyExcludedPeers(): number[] {
        return [...this.globally_excluded].sort((a, b) => a - b);
    }

    /** Operator-friendly aggregated telemetry. */
    summary(now_ms: number): {
        sink_count: number;
        sink_ids: string[];
        globally_excluded_count: number;
        per_sink_dissenter_counts: Array<{ sink_id: string; dissenter_count: number }>;
        total_dissenters: number;
    } {
        const counts: Array<{ sink_id: string; dissenter_count: number }> = [];
        let total = 0;
        for (const id of [...this.sinks.keys()].sort()) {
            const loop = this.sinks.get(id)!;
            const snap = loop.tracker.snapshot(now_ms);
            counts.push({
                sink_id: id,
                dissenter_count: snap.dissenter_peer_ids.length,
            });
            total += snap.dissenter_peer_ids.length;
        }
        return {
            sink_count: this.sinks.size,
            sink_ids: this.sinkIds(),
            globally_excluded_count: this.globally_excluded.size,
            per_sink_dissenter_counts: counts,
            total_dissenters: total,
        };
    }
}
