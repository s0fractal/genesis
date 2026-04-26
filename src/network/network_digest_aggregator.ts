// 🌌 OMEGA-64: Era 1360 — Network Digest Aggregation
//
// Era 1350 needs `network_digests` to compute convergence health,
// but synthesizing that input was left to the caller. In a real
// mesh, the network-known digest set is the UNION of every peer's
// archive digest list — and digest lists arrive asynchronously
// over the same channels Era 1310 already defines (`ArchiveDigestList`).
//
// Era 1360 introduces `NetworkDigestAggregator`: a TTL-bounded
// per-peer observation store with a `networkDigests()` accessor
// that returns the union (deduplicated, sorted) of all currently-
// fresh peer observations. Stale observations are evicted on
// access — observations that haven't been refreshed within the
// TTL no longer count as "what the network has".
//
// The aggregator is the bridge between Era 1310's transport
// envelope and Era 1350's convergence signal: relays observe
// each others' digest lists, aggregate, and the resulting union
// drives the convergence band.
//
// PURE-ish: state is held in the class (typical for stream
// aggregators in this codebase), but every operation is
// deterministic given the input event sequence. No I/O, no timers
// — TTL eviction is driven by `now_ms` parameters.

import { ArchiveDigestList, digestSetHash } from "./archive_sync.ts";
import {
    ConvergenceHealthOptions,
    ConvergenceHealthSignal,
    DEFAULT_CONVERGENCE_OPTS,
    computeConvergenceHealth,
} from "./convergence_health.ts";

export const AGGREGATOR_SCHEMA = "OMEGA-1360/v1";

export interface PeerDigestObservation {
    peer_id: number;
    digests: ReadonlyArray<number>;
    digest_set_hash: number;
    observed_at_ms: number;
    /** ms at broadcast (from the ArchiveDigestList).
     *  Useful for "stale because the peer itself hasn't updated"
     *  vs "stale because we haven't heard from them". */
    broadcast_at_ms: number;
}

export class NetworkDigestAggregator {
    private observations = new Map<number, PeerDigestObservation>();

    constructor(public ttl_ms: number = 5 * 60 * 1000) {
        if (!Number.isFinite(ttl_ms) || ttl_ms <= 0) {
            throw new Error(`NetworkDigestAggregator: ttl_ms must be positive: ${ttl_ms}`);
        }
    }

    /** Record a peer's digest list observation. Re-observing the same
     *  peer overwrites their prior record (the most recent observation
     *  is authoritative). */
    observe(
        peer_id: number,
        list: ArchiveDigestList,
        now_ms: number,
    ): void {
        const pid = peer_id >>> 0;
        // Defensive copy + sort to keep the stored shape canonical,
        // independent of caller's input ordering.
        const digests = [...list.digests].sort((a, b) => a - b);
        const observed_hash = digestSetHash(digests);
        // We TRUST the list's own digest_set_hash for cross-relay
        // anchoring, but recompute and accept either — peers may
        // serialize with different sort discipline.
        this.observations.set(pid, {
            peer_id: pid,
            digests,
            digest_set_hash: observed_hash,
            observed_at_ms: now_ms,
            broadcast_at_ms: list.broadcast_at_ms >>> 0,
        });
    }

    /** Drop an explicit peer observation (e.g. when peer was kicked). */
    forget(peer_id: number): void {
        this.observations.delete(peer_id >>> 0);
    }

    /** Number of currently-fresh observations. */
    peerCount(now_ms: number): number {
        this.evict(now_ms);
        return this.observations.size;
    }

    /** Snapshot of all currently-fresh observations, sorted by peer_id. */
    freshObservations(now_ms: number): PeerDigestObservation[] {
        this.evict(now_ms);
        return [...this.observations.values()].sort((a, b) => a.peer_id - b.peer_id);
    }

    /** Union of all fresh peers' digest sets, sorted ascending. */
    networkDigests(now_ms: number): number[] {
        this.evict(now_ms);
        const set = new Set<number>();
        for (const obs of this.observations.values()) {
            for (const d of obs.digests) set.add(d);
        }
        return [...set].sort((a, b) => a - b);
    }

    /** FNV-1a hash over the network-known digest set (mirrors
     *  Era 1310's digestSetHash convention). Two relays observing
     *  the same fresh peer set produce identical hashes — useful
     *  as a sanity-check anchor across operators. */
    networkDigestSetHash(now_ms: number): number {
        return digestSetHash(this.networkDigests(now_ms));
    }

    /** Compute the convergence health signal for `local_digests` against
     *  the current network union. Convenience wrapper that passes the
     *  same options through. */
    convergenceSignal(
        local_digests: ReadonlyArray<number>,
        now_ms: number,
        opts: ConvergenceHealthOptions = DEFAULT_CONVERGENCE_OPTS,
    ): ConvergenceHealthSignal {
        const network = this.networkDigests(now_ms);
        return computeConvergenceHealth(local_digests, network, opts);
    }

    /** Operator-visible counters. */
    summary(now_ms: number): {
        peer_count: number;
        total_unique_digests: number;
        ttl_ms: number;
        oldest_observed_at_ms: number;
        newest_observed_at_ms: number;
    } {
        this.evict(now_ms);
        let oldest = Number.POSITIVE_INFINITY;
        let newest = Number.NEGATIVE_INFINITY;
        for (const obs of this.observations.values()) {
            if (obs.observed_at_ms < oldest) oldest = obs.observed_at_ms;
            if (obs.observed_at_ms > newest) newest = obs.observed_at_ms;
        }
        if (this.observations.size === 0) {
            oldest = 0;
            newest = 0;
        }
        return {
            peer_count: this.observations.size,
            total_unique_digests: this.networkDigests(now_ms).length,
            ttl_ms: this.ttl_ms,
            oldest_observed_at_ms: oldest,
            newest_observed_at_ms: newest,
        };
    }

    /** Drop observations older than `now_ms - ttl_ms`. */
    private evict(now_ms: number): void {
        const cutoff = now_ms - this.ttl_ms;
        for (const [pid, obs] of this.observations) {
            if (obs.observed_at_ms < cutoff) this.observations.delete(pid);
        }
    }
}
