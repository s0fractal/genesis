// 🌌 OMEGA-64: Era 1550 — Auto-Investigation Loop Harness
//
// Eras 1380–1540 each contribute a pure layer:
//
//   • 1380 ForensicEventSink             — append-only event log
//   • 1390 event_sink_sync                — set-difference convergence
//   • 1500 WebRTCEventBridge              — transport-agnostic bridge
//   • 1520 EventChainQuorumTracker        — cross-relay anchor consensus
//   • 1530 QuorumInvestigationTrigger     — gated dissenter detection
//   • 1540 QuorumWarrantBridge            — warrant-proposal emission
//
// Era 1550 stitches them into a single `AutoInvestigationLoop`
// orchestrator. One `tick(now_ms)` call walks the entire chain:
//
//   1. Each known peer's most-recent anchor is fed into the
//      quorum tracker.
//   2. The tracker's snapshot is evaluated by the trigger.
//   3. Fire-now peers are turned into warrant proposals by the
//      warrant bridge.
//   4. Returned proposals are handed to a caller-supplied
//      emit callback (which would, in production, route into
//      the mesh's plasmid pipeline).
//   5. After successful emit, the trigger's `markTriggered`
//      records the cooldown timestamp.
//
// Pure orchestration; no I/O. Tests verify the full chain
// produces a warrant when expected, dedupes correctly, and
// stays silent when consensus is healthy.

import {
    DEFAULT_QUORUM_OPTS,
    EventChainQuorumTracker,
    QuorumOptions,
    QuorumResult,
} from "./event_chain_quorum.ts";
import {
    DEFAULT_TRIGGER_OPTS,
    QuorumInvestigationTrigger,
    TriggerOptions,
    TriggerOutcome,
} from "./quorum_investigation.ts";
import {
    DEFAULT_BRIDGE_OPTS,
    QuorumWarrantBridge,
    BridgeOptions,
    WarrantProposalPayload,
} from "./quorum_warrant_bridge.ts";

export const LOOP_SCHEMA = "OMEGA-1550/v1";

/** Caller-supplied emit hook. Returns true if the proposal was
 *  successfully handed off to the underlying transport. */
export type WarrantEmit = (proposal: WarrantProposalPayload) => boolean;

export interface LoopOptions {
    quorum: QuorumOptions;
    trigger: TriggerOptions;
    bridge: BridgeOptions;
}

export const DEFAULT_LOOP_OPTS: LoopOptions = {
    quorum: DEFAULT_QUORUM_OPTS,
    trigger: DEFAULT_TRIGGER_OPTS,
    bridge: DEFAULT_BRIDGE_OPTS,
};

export interface LoopTickResult {
    quorum_snapshot: QuorumResult;
    trigger_outcome: TriggerOutcome;
    proposals_built: WarrantProposalPayload[];
    proposals_emitted: number;
    proposals_failed: number;
    deduped_peer_ids: number[];
}

export class AutoInvestigationLoop {
    public readonly tracker: EventChainQuorumTracker;
    public readonly trigger: QuorumInvestigationTrigger;
    public readonly warrants: QuorumWarrantBridge;

    constructor(
        public readonly emit: WarrantEmit,
        opts: LoopOptions = DEFAULT_LOOP_OPTS,
    ) {
        this.tracker = new EventChainQuorumTracker(opts.quorum);
        this.trigger = new QuorumInvestigationTrigger(opts.trigger);
        this.warrants = new QuorumWarrantBridge(opts.bridge);
    }

    /** Inform the loop of a peer's most-recent anchor. Typically
     *  called when a HASH_LIST plasmid arrives. */
    observePeerAnchor(peer_id: number, anchor: number, now_ms: number): void {
        this.tracker.observe(peer_id, anchor, now_ms);
    }

    /** One tick of the full chain. Returns a structured outcome
     *  for observability/HUD wiring. */
    async tick(now_ms: number): Promise<LoopTickResult> {
        const snap = this.tracker.snapshot(now_ms);
        const outcome = this.trigger.evaluate(snap, now_ms);
        if (outcome.fire_now.length === 0 || snap.consensus_anchor === null) {
            return {
                quorum_snapshot: snap,
                trigger_outcome: outcome,
                proposals_built: [],
                proposals_emitted: 0,
                proposals_failed: 0,
                deduped_peer_ids: [],
            };
        }
        const issued = await this.warrants.issue(outcome, snap.consensus_anchor, now_ms);
        let emitted = 0;
        let failed = 0;
        for (const proposal of issued.payloads) {
            const ok = this.emit(proposal);
            if (ok) {
                this.trigger.markTriggered(proposal.target_peer_id, now_ms);
                emitted++;
            } else {
                failed++;
            }
        }
        return {
            quorum_snapshot: snap,
            trigger_outcome: outcome,
            proposals_built: issued.payloads,
            proposals_emitted: emitted,
            proposals_failed: failed,
            deduped_peer_ids: issued.deduped_peer_ids,
        };
    }

    /** Operator command: forget a peer entirely (drops anchor,
     *  trigger record, and dedup state). */
    forgetPeer(peer_id: number): void {
        this.tracker.forget(peer_id);
        this.trigger.forget(peer_id);
        this.warrants.forget(peer_id);
    }

    /** Era 1560: mark a peer as quarantined. Their anchor
     *  observations are excluded from quorum (so they can't game
     *  consensus) and their trigger record is cleared so they
     *  won't generate further warrants while excluded. The
     *  dedup state in the warrant bridge IS preserved — if the
     *  peer is later un-excluded and dissents again, the cooldown
     *  still applies. */
    excludePeer(peer_id: number): void {
        this.tracker.exclude(peer_id);
        this.trigger.forget(peer_id);
    }

    /** Era 1560: undo `excludePeer`. */
    includePeer(peer_id: number): void {
        this.tracker.unexclude(peer_id);
    }
}
