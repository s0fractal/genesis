// 🌌 OMEGA-64: Era 1370 — Convergence-Triggered Auto Sync
//
// Era 1350 raises an `alarm` flag when convergence drops below a
// threshold. Era 1340's coordinator picks sync candidates by
// schedule + reputation. Era 1360 aggregates peer digest lists.
// What was missing: the *reactive* loop — when convergence is
// poor, the coordinator should re-sync IMMEDIATELY (bypass
// cooldown) and prefer the peer whose digest set adds the MOST
// missing entries to the local archive.
//
// Era 1370 closes that loop with three pure functions:
//
//   1. `selectMostInformativePeer` — given peer observations from
//      Era 1360 and the local digest set, return the peer_id whose
//      union-with-local would add the most NEW digests. Ties
//      broken by peer_id (deterministic).
//
//   2. `selectAlarmOverrideOrder` — when convergence alarm is
//      active, return peers ordered by informativeness (not by
//      schedule), bypassing the Era 1330 cooldown gate. Cold
//      peers still excluded (a permanently-failing peer is not
//      magically fixed by bypassing cooldown).
//
//   3. `convergenceAlarmEvent` — emit a forensic event capturing
//      the alarm trigger for postmortem audit. Pure value
//      construction; the caller routes it into whatever event log
//      it owns.

import { CoordinatorState } from "./archive_sync_coordinator.ts";
import { ConvergenceHealthSignal } from "./convergence_health.ts";
import {
    NetworkDigestAggregator,
    PeerDigestObservation,
} from "./network_digest_aggregator.ts";
import { isPeerCold } from "./archive_sync_driver.ts";

export const AUTO_SYNC_SCHEMA = "OMEGA-1370/v1";

/** Score a peer by the number of NEW digests they'd contribute. */
function noveltyScore(
    obs: PeerDigestObservation,
    local_set: Set<number>,
): number {
    let novel = 0;
    for (const d of obs.digests) if (!local_set.has(d)) novel++;
    return novel;
}

export interface PeerNoveltyRanking {
    peer_id: number;
    novel_count: number;
    total_offered: number;
}

/** Rank fresh peers by how many novel digests they'd contribute to
 *  the local set. Returns full ranking sorted novel_count DESC,
 *  peer_id ASC for ties. */
export function rankPeersByNovelty(
    agg: NetworkDigestAggregator,
    local_digests: ReadonlyArray<number>,
    now_ms: number,
): PeerNoveltyRanking[] {
    const local_set = new Set(local_digests);
    const fresh = agg.freshObservations(now_ms);
    const ranked = fresh.map((obs) => ({
        peer_id: obs.peer_id,
        novel_count: noveltyScore(obs, local_set),
        total_offered: obs.digests.length,
    }));
    ranked.sort((a, b) => {
        if (a.novel_count !== b.novel_count) return b.novel_count - a.novel_count;
        return a.peer_id - b.peer_id;
    });
    return ranked;
}

/** Return the peer_id of the peer offering the most novel digests,
 *  or null when no fresh peer adds anything. */
export function selectMostInformativePeer(
    agg: NetworkDigestAggregator,
    local_digests: ReadonlyArray<number>,
    now_ms: number,
): number | null {
    const ranked = rankPeersByNovelty(agg, local_digests, now_ms);
    if (ranked.length === 0) return null;
    if (ranked[0].novel_count === 0) return null;
    return ranked[0].peer_id;
}

/** When the convergence alarm is active, return peers ordered by
 *  informativeness — bypasses the per-peer cooldown gate so a
 *  lagging relay can catch up immediately. Cold peers still
 *  excluded. Returns up to `max` peer_ids; caller must verify the
 *  signal is alarming before calling. */
export function selectAlarmOverrideOrder(
    coord: CoordinatorState,
    agg: NetworkDigestAggregator,
    local_digests: ReadonlyArray<number>,
    now_ms: number,
    max: number = 1,
): number[] {
    const ranked = rankPeersByNovelty(agg, local_digests, now_ms);
    const out: number[] = [];
    for (const r of ranked) {
        if (r.novel_count === 0) break;
        const peer = coord.peers.get(r.peer_id);
        // If we don't track the peer at all, skip — we can't safely
        // initiate a sync to a peer the coordinator doesn't know.
        if (!peer) continue;
        if (isPeerCold(peer, coord.scheduler_config)) continue;
        out.push(r.peer_id);
        if (out.length >= max) break;
    }
    return out;
}

/** Forensic event payload for the alarm trigger. Pure data; caller
 *  routes it into whichever log/forwarder owns event persistence. */
export interface ConvergenceAlarmEvent {
    schema: string;
    triggered_at_ms: number;
    /** Q16 score at trigger time. */
    score_q16: number;
    band: ConvergenceHealthSignal["band"];
    /** Snapshot of the divergence math. */
    intersection_size: number;
    network_size: number;
    /** Top-N most-informative peers at trigger time, ordered by
     *  novelty descending. */
    informative_peers: PeerNoveltyRanking[];
    /** FNV-1a anchor over the alarm payload — useful for cross-relay
     *  agreement on "we both saw the same alarm at the same moment". */
    event_hash: number;
}

import { sha256_u32 } from "../sdk/phi_crypto.ts";

/** Construct the forensic event. The hash is deterministic given
 *  the same inputs, enabling cross-relay corroboration. */
export function convergenceAlarmEvent(
    signal: ConvergenceHealthSignal,
    informative_peers: PeerNoveltyRanking[],
    triggered_at_ms: number,
    top_n: number = 5,
): ConvergenceAlarmEvent {
    const top = informative_peers.slice(0, Math.max(0, top_n));
    // Hash anchor: schema + score_q16 + intersection + network +
    // peer_ids (sorted) + their novelty counts.
    const peerBytes: number[] = [];
    for (const p of [...top].sort((a, b) => a.peer_id - b.peer_id)) {
        peerBytes.push(
            (p.peer_id >>> 24) & 0xFF, (p.peer_id >>> 16) & 0xFF,
            (p.peer_id >>> 8) & 0xFF, p.peer_id & 0xFF,
            (p.novel_count >>> 24) & 0xFF, (p.novel_count >>> 16) & 0xFF,
            (p.novel_count >>> 8) & 0xFF, p.novel_count & 0xFF,
        );
    }
    const u32 = (n: number) => [
        (n >>> 24) & 0xFF, (n >>> 16) & 0xFF,
        (n >>> 8) & 0xFF, n & 0xFF,
    ];
    const hashBytes = new Uint8Array([
        ...u32(signal.rate_q16),
        ...u32(signal.intersection_size),
        ...u32(signal.network_size),
        ...peerBytes,
    ]);
    return {
        schema: AUTO_SYNC_SCHEMA,
        triggered_at_ms,
        score_q16: signal.rate_q16,
        band: signal.band,
        intersection_size: signal.intersection_size,
        network_size: signal.network_size,
        informative_peers: top,
        event_hash: sha256_u32(hashBytes),
    };
}
