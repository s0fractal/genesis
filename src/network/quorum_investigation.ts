// 🌌 OMEGA-64: Era 1530 — Quorum-Driven Investigation Trigger
//
// Era 1520's `EventChainQuorumTracker` exposes which peers
// disagree with the network consensus on the event chain. Era
// 1530 closes the loop: when consensus is high-confidence AND
// dissenters exist, automatically nominate them for forensic
// investigation (Era 1210's `WARRANT_PROPOSAL` pipeline).
//
// The trigger is pure decision logic; the *issuance* of warrants
// belongs to existing infrastructure. This module returns
// "candidates ready for investigation" — callers wire them into
// whatever warrant-creation API their relay exposes.
//
// COOLDOWN: a peer that just got investigated shouldn't get
// re-investigated on every tick. The trigger tracks per-peer
// last-trigger timestamps and respects a configurable cooldown
// window so the warrant pipeline isn't flooded.
//
// PRINCIPLE: investigation is *signal* about the network, not
// punishment. A dissenter peer might just be lagging convergence.
// Era 1370's auto-sync should catch up most cases. Era 1530's
// trigger fires only when the dissenter has been visible LONG
// enough to rule out transient lag — controlled by an optional
// "must-be-dissenting-for" duration parameter.

import {
    EventChainQuorumTracker,
    QuorumBand,
    QuorumResult,
} from "./event_chain_quorum.ts";

export const TRIGGER_SCHEMA = "OMEGA-1530/v1";

export interface TriggerOptions {
    /** Minimum band before triggering. "high" is most conservative;
     *  "triple+" fires earlier. "double"/"lone"/"none" never trigger. */
    min_band: QuorumBand;
    /** A peer triggered within this window will not re-trigger. */
    per_peer_cooldown_ms: number;
    /** A dissenter must have been observed dissenting for at least
     *  this duration before triggering. Filters transient lag. */
    min_dissent_duration_ms: number;
}

export const DEFAULT_TRIGGER_OPTS: TriggerOptions = {
    min_band: "triple+",
    per_peer_cooldown_ms: 60_000,
    min_dissent_duration_ms: 10_000,
};

export interface DissenterRecord {
    peer_id: number;
    /** Anchor the peer is reporting (different from consensus). */
    dissenting_anchor: number;
    /** Time we first saw this peer dissenting from current consensus. */
    first_seen_dissenting_ms: number;
    /** Time we last triggered an investigation against this peer. 0 if never. */
    last_triggered_ms: number;
}

export interface TriggerOutcome {
    /** Peers ready for investigation right now. */
    fire_now: number[];
    /** Peers seen dissenting but not yet eligible (cooldown or
     *  duration not met). */
    pending: number[];
    /** Total dissenters in the snapshot (for observability). */
    dissenter_count: number;
}

export class QuorumInvestigationTrigger {
    private records = new Map<number, DissenterRecord>();
    /** Last consensus_anchor we evaluated against. Used to clear
     *  records when consensus changes. */
    private last_consensus: number | null = null;

    constructor(public readonly opts: TriggerOptions = DEFAULT_TRIGGER_OPTS) {
        if (!Number.isFinite(opts.per_peer_cooldown_ms) || opts.per_peer_cooldown_ms <= 0) {
            throw new Error(`QuorumInvestigationTrigger: per_peer_cooldown_ms must be > 0`);
        }
        if (!Number.isFinite(opts.min_dissent_duration_ms) || opts.min_dissent_duration_ms < 0) {
            throw new Error(`QuorumInvestigationTrigger: min_dissent_duration_ms must be ≥ 0`);
        }
    }

    /** Evaluate the current quorum snapshot. Returns peers ready
     *  for investigation now and peers still in cooldown/pending. */
    evaluate(snap: QuorumResult, now_ms: number): TriggerOutcome {
        // Consensus changed (or absent) → reset the dissent records
        // so we don't fire on stale state.
        if (snap.consensus_anchor !== this.last_consensus) {
            // Keep last_triggered_ms entries to honor cooldown across
            // consensus changes; reset only first_seen_dissenting.
            for (const rec of this.records.values()) {
                rec.first_seen_dissenting_ms = 0;
                rec.dissenting_anchor = 0;
            }
            this.last_consensus = snap.consensus_anchor;
        }

        const fire_now: number[] = [];
        const pending: number[] = [];

        // Band gate.
        if (!this.bandSatisfies(snap.band)) {
            // Below threshold: still update first_seen for tracking
            // purposes but never fire.
            this.refreshFirstSeen(snap, now_ms);
            return { fire_now: [], pending: [...snap.dissenter_peer_ids], dissenter_count: snap.dissenter_peer_ids.length };
        }

        // Refresh first_seen_dissenting for current dissenters.
        this.refreshFirstSeen(snap, now_ms);

        for (const peer_id of snap.dissenter_peer_ids) {
            const rec = this.records.get(peer_id)!; // refreshFirstSeen ensures existence
            const dissent_age = now_ms - rec.first_seen_dissenting_ms;
            const cooldown_age = rec.last_triggered_ms === 0
                ? Number.POSITIVE_INFINITY
                : now_ms - rec.last_triggered_ms;
            if (dissent_age >= this.opts.min_dissent_duration_ms
                && cooldown_age >= this.opts.per_peer_cooldown_ms) {
                fire_now.push(peer_id);
            } else {
                pending.push(peer_id);
            }
        }

        // Drop records for peers no longer dissenting (consensus
        // gained their support OR they fell out of TTL).
        const stillDissenting = new Set(snap.dissenter_peer_ids);
        for (const pid of [...this.records.keys()]) {
            if (!stillDissenting.has(pid)) this.records.delete(pid);
        }

        return {
            fire_now,
            pending,
            dissenter_count: snap.dissenter_peer_ids.length,
        };
    }

    /** Caller invokes after issuing a warrant for the peer.
     *  Updates last_triggered_ms so the cooldown gate works. */
    markTriggered(peer_id: number, now_ms: number): void {
        const rec = this.records.get(peer_id >>> 0);
        if (rec) {
            rec.last_triggered_ms = now_ms;
        } else {
            // No prior record (race): create one with last_triggered set.
            this.records.set(peer_id >>> 0, {
                peer_id: peer_id >>> 0,
                dissenting_anchor: 0,
                first_seen_dissenting_ms: now_ms,
                last_triggered_ms: now_ms,
            });
        }
    }

    /** Drop trigger state for a peer (operator command, peer
     *  removal, partition resolution). */
    forget(peer_id: number): void {
        this.records.delete(peer_id >>> 0);
    }

    /** Snapshot the per-peer state for HUD/observability. */
    records_snapshot(): DissenterRecord[] {
        return [...this.records.values()].sort((a, b) => a.peer_id - b.peer_id);
    }

    private bandSatisfies(band: QuorumBand): boolean {
        const order = ["none", "lone", "double", "triple+", "high"];
        return order.indexOf(band) >= order.indexOf(this.opts.min_band);
    }

    private refreshFirstSeen(snap: QuorumResult, now_ms: number): void {
        const dissentingSet = new Set(snap.dissenter_peer_ids);
        for (const peer_id of dissentingSet) {
            const rec = this.records.get(peer_id);
            const peerAnchor = this.peerAnchorAt(snap, peer_id);
            if (!rec) {
                this.records.set(peer_id, {
                    peer_id,
                    dissenting_anchor: peerAnchor,
                    first_seen_dissenting_ms: now_ms,
                    last_triggered_ms: 0,
                });
            } else {
                if (rec.first_seen_dissenting_ms === 0) {
                    rec.first_seen_dissenting_ms = now_ms;
                }
                rec.dissenting_anchor = peerAnchor;
            }
        }
    }

    /** The QuorumResult doesn't carry per-peer anchor breakdown,
     *  but distinct_anchors gives us the candidate set. For the
     *  trigger's purposes we just need to know dissenters exist;
     *  recording 0 as a sentinel is fine. */
    private peerAnchorAt(snap: QuorumResult, _peer_id: number): number {
        // Choose any anchor that isn't the consensus, if available.
        // This is informational only; the trigger semantics depend
        // on dissenter membership, not on the dissenter's specific
        // anchor value. Future Eras can plumb the per-peer anchor
        // through the snapshot if needed.
        if (snap.consensus_anchor === null) return 0;
        for (const a of snap.distinct_anchors) {
            if (a !== snap.consensus_anchor) return a;
        }
        return 0;
    }
}

/** Convenience: orchestrate a single tick — pull the snapshot
 *  from the tracker, evaluate, return the outcome. */
export function tickTrigger(
    tracker: EventChainQuorumTracker,
    trigger: QuorumInvestigationTrigger,
    now_ms: number,
): TriggerOutcome {
    return trigger.evaluate(tracker.snapshot(now_ms), now_ms);
}
