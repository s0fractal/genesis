// 🌌 OMEGA-64: Era 1720 — Translation Policy Mesh Broadcast Scheduler
//
// Era 1710 closed inbound live wiring. Era 1720 closes the outbound
// half: known peers receive local translation-policy claims through a
// deterministic per-peer scheduler with cooldown/backoff and unchanged
// policy suppression.

import {
    DEFAULT_SCHEDULER_CONFIG,
    SchedulerConfig,
    initPeerSyncState,
    isPeerCold,
    recordSyncAttempt,
    recordSyncFailure,
    recordSyncSuccess,
    shouldSyncNow,
} from "../archive_sync_driver.ts";
import { TranslationPolicyClaim } from "./translation_policy_monitor.ts";
import { TranslationPolicyMeshBridge } from "../mesh_event_bridge.ts";

export const TRANSLATION_POLICY_BROADCAST_SCHEMA = "OMEGA-1720/v1";

export interface TranslationPolicyBroadcastOptions {
    scheduler: SchedulerConfig;
    /** Successful peers with the same policy hash are suppressed until
     *  this horizon expires. Set to 0 to broadcast unchanged claims on
     *  every due tick. */
    unchanged_rebroadcast_ms: number;
}

export const DEFAULT_TRANSLATION_POLICY_BROADCAST_OPTS:
    TranslationPolicyBroadcastOptions = {
        scheduler: DEFAULT_SCHEDULER_CONFIG,
        unchanged_rebroadcast_ms: 300_000,
    };

export interface TranslationPolicyBroadcastPeerState {
    peer_id: number;
    last_attempt_ms: number;
    last_success_ms: number;
    consecutive_failures: number;
    next_attempt_ms: number;
    last_sent_policy_hash: number | null;
    last_sent_pair_count: number | null;
}

export type TranslationPolicyBroadcastAction =
    | "sent"
    | "failed"
    | "cooldown"
    | "unchanged"
    | "cold";

export interface TranslationPolicyBroadcastDecision {
    peer_id: number;
    action: TranslationPolicyBroadcastAction;
    policy_hash: number;
    pair_count: number;
    next_attempt_ms: number;
}

export interface TranslationPolicyBroadcastResult {
    schema: string;
    now_ms: number;
    claim: TranslationPolicyClaim;
    decisions: TranslationPolicyBroadcastDecision[];
    sent_count: number;
    failed_count: number;
    skipped_unchanged_count: number;
    cold_count: number;
}

interface InternalPeerState extends TranslationPolicyBroadcastPeerState {}

export class TranslationPolicyBroadcastScheduler {
    private peers = new Map<number, InternalPeerState>();

    constructor(
        public readonly bridge: TranslationPolicyMeshBridge,
        public readonly opts: TranslationPolicyBroadcastOptions =
            DEFAULT_TRANSLATION_POLICY_BROADCAST_OPTS,
    ) {
        if (this.opts.unchanged_rebroadcast_ms < 0) {
            throw new Error("unchanged_rebroadcast_ms must be >= 0");
        }
        if (this.opts.scheduler.base_interval_ms <= 0) {
            throw new Error("base_interval_ms must be positive");
        }
    }

    addPeer(peer_id: number): TranslationPolicyBroadcastPeerState {
        const id = peer_id >>> 0;
        const existing = this.peers.get(id);
        if (existing) return { ...existing };
        const base = initPeerSyncState(id);
        const state: InternalPeerState = {
            ...base,
            last_sent_policy_hash: null,
            last_sent_pair_count: null,
        };
        this.peers.set(id, state);
        return { ...state };
    }

    removePeer(peer_id: number): boolean {
        return this.peers.delete(peer_id >>> 0);
    }

    clear(): void {
        this.peers.clear();
    }

    peerCount(): number {
        return this.peers.size;
    }

    snapshot(): TranslationPolicyBroadcastPeerState[] {
        return [...this.peers.values()]
            .sort((a, b) => a.peer_id - b.peer_id)
            .map((s) => ({ ...s }));
    }

    duePeers(now_ms: number): number[] {
        return this.snapshot()
            .filter((s) => shouldSyncNow(s, now_ms))
            .filter((s) => !isPeerCold(s, this.opts.scheduler))
            .map((s) => s.peer_id);
    }

    tick(now_ms: number, max_peers: number = Number.MAX_SAFE_INTEGER):
        TranslationPolicyBroadcastResult {
        const claim = this.bridge.monitor.localClaim(now_ms);
        const decisions: TranslationPolicyBroadcastDecision[] = [];
        let sent = 0;
        let failed = 0;
        let unchanged = 0;
        let cold = 0;
        let attempted = 0;

        for (const peer_id of [...this.peers.keys()].sort((a, b) => a - b)) {
            const state = this.peers.get(peer_id)!;
            if (isPeerCold(state, this.opts.scheduler)) {
                cold++;
                decisions.push(this.decision(state, "cold", claim));
                continue;
            }
            if (!shouldSyncNow(state, now_ms)) {
                decisions.push(this.decision(state, "cooldown", claim));
                continue;
            }
            if (attempted >= max_peers) {
                decisions.push(this.decision(state, "cooldown", claim));
                continue;
            }
            if (this.shouldSuppressUnchanged(state, claim, now_ms)) {
                unchanged++;
                decisions.push(this.decision(state, "unchanged", claim));
                continue;
            }

            const attemptedState = this.mergeSchedulerState(
                state,
                recordSyncAttempt(state, now_ms),
            );
            const ok = this.bridge.sendClaim(peer_id, claim);
            attempted++;
            if (ok) {
                const next = this.mergeSchedulerState(
                    attemptedState,
                    recordSyncSuccess(attemptedState, this.opts.scheduler, now_ms),
                );
                next.last_sent_policy_hash = claim.policy_hash >>> 0;
                next.last_sent_pair_count = claim.pair_count >>> 0;
                this.peers.set(peer_id, next);
                sent++;
                decisions.push(this.decision(next, "sent", claim));
            } else {
                const next = this.mergeSchedulerState(
                    attemptedState,
                    recordSyncFailure(attemptedState, this.opts.scheduler, now_ms),
                );
                this.peers.set(peer_id, next);
                failed++;
                decisions.push(this.decision(next, "failed", claim));
            }
        }

        return {
            schema: TRANSLATION_POLICY_BROADCAST_SCHEMA,
            now_ms,
            claim,
            decisions,
            sent_count: sent,
            failed_count: failed,
            skipped_unchanged_count: unchanged,
            cold_count: cold,
        };
    }

    recordExternalSuccess(
        peer_id: number,
        claim: TranslationPolicyClaim,
        now_ms: number,
    ): void {
        const state = this.peers.get(peer_id >>> 0) ?? this.addPeer(peer_id);
        const next = this.mergeSchedulerState(
            state,
            recordSyncSuccess(state, this.opts.scheduler, now_ms),
        );
        next.last_sent_policy_hash = claim.policy_hash >>> 0;
        next.last_sent_pair_count = claim.pair_count >>> 0;
        this.peers.set(peer_id >>> 0, next);
    }

    private shouldSuppressUnchanged(
        state: InternalPeerState,
        claim: TranslationPolicyClaim,
        now_ms: number,
    ): boolean {
        if (state.last_sent_policy_hash === null) return false;
        if (this.opts.unchanged_rebroadcast_ms === 0) return false;
        if ((state.last_sent_policy_hash >>> 0) !== (claim.policy_hash >>> 0)) {
            return false;
        }
        if ((state.last_sent_pair_count ?? -1) !== (claim.pair_count >>> 0)) {
            return false;
        }
        return now_ms - state.last_success_ms < this.opts.unchanged_rebroadcast_ms;
    }

    private mergeSchedulerState(
        state: InternalPeerState,
        schedulerState: {
            last_attempt_ms: number;
            last_success_ms: number;
            consecutive_failures: number;
            next_attempt_ms: number;
        },
    ): InternalPeerState {
        return {
            ...state,
            last_attempt_ms: schedulerState.last_attempt_ms,
            last_success_ms: schedulerState.last_success_ms,
            consecutive_failures: schedulerState.consecutive_failures,
            next_attempt_ms: schedulerState.next_attempt_ms,
        };
    }

    private decision(
        state: InternalPeerState,
        action: TranslationPolicyBroadcastAction,
        claim: TranslationPolicyClaim,
    ): TranslationPolicyBroadcastDecision {
        return {
            peer_id: state.peer_id,
            action,
            policy_hash: claim.policy_hash >>> 0,
            pair_count: claim.pair_count >>> 0,
            next_attempt_ms: state.next_attempt_ms,
        };
    }
}
