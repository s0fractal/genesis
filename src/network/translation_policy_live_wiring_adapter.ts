// 🌌 OMEGA-64: Era 1710 — Translation Policy Live Wiring Adapter
//
// Eras 1650→1700 made translation policy claims observable,
// warrantable, corroborated, and mesh-serializable. Era 1710 closes
// the application wiring gap: WebRTC dispatches passive CustomEvents,
// and this adapter routes them into the investigation loop and
// corroboration tracker with explicit lifecycle + telemetry.

import type { EventSource } from "./quarantine_lifecycle_bridge.ts";
import {
    TranslationPolicyCorroborationPlasmidEmit,
    decodeTranslationPolicyCorroborationMeshPayload,
} from "./mesh_event_bridge.ts";
import {
    PolicyDriftCorroboratedRecord,
    TranslationPolicyCorroborationRaise,
    buildTranslationPolicyCorroborationRaise,
} from "./translation_policy_corroboration.ts";
import {
    TranslationPolicyInvestigationLoop,
    TranslationPolicyLoopResult,
} from "./translation_policy_investigation_loop.ts";
import { TranslationPolicyDriftEvent } from "./translation_policy_monitor.ts";

export const TRANSLATION_POLICY_LIVE_WIRING_SCHEMA = "OMEGA-1710/v1";

export interface TranslationPolicyLiveEventDetail {
    body?: unknown;
    targetPeer?: unknown;
    fromPeer?: unknown;
}

export interface TranslationPolicyLiveWiringOptions {
    claim_event_name: string;
    corroboration_event_name: string;
    now_ms: () => number;
    emit_local_raises: boolean;
    local_witness_id?: number;
    raise_emit?: TranslationPolicyCorroborationPlasmidEmit;
    raise_targets?: (
        detail: TranslationPolicyLiveEventDetail,
        event: TranslationPolicyDriftEvent,
        result: TranslationPolicyLoopResult,
    ) => number[];
}

export const DEFAULT_TRANSLATION_POLICY_LIVE_WIRING_OPTS:
    Omit<TranslationPolicyLiveWiringOptions, "now_ms"> = {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
    };

export interface TranslationPolicyLiveWiringTelemetry {
    claims_received: number;
    claims_malformed: number;
    claims_observed: number;
    corroboration_raises_received: number;
    corroboration_raises_malformed: number;
    corroboration_raises_recorded: number;
    local_raises_built: number;
    local_raises_emitted: number;
    local_raises_failed: number;
    local_raises_skipped: number;
}

export class TranslationPolicyLiveWiringAdapter {
    private claimListener?: (event: { detail: unknown }) => void;
    private corroborationListener?: (event: { detail: unknown }) => void;
    private active = false;
    private stats: TranslationPolicyLiveWiringTelemetry = {
        claims_received: 0,
        claims_malformed: 0,
        claims_observed: 0,
        corroboration_raises_received: 0,
        corroboration_raises_malformed: 0,
        corroboration_raises_recorded: 0,
        local_raises_built: 0,
        local_raises_emitted: 0,
        local_raises_failed: 0,
        local_raises_skipped: 0,
    };

    constructor(
        public readonly loop: TranslationPolicyInvestigationLoop,
        public readonly source: EventSource,
        public readonly opts: TranslationPolicyLiveWiringOptions = {
            ...DEFAULT_TRANSLATION_POLICY_LIVE_WIRING_OPTS,
            now_ms: () => Date.now(),
        },
    ) {}

    start(): void {
        if (this.active) return;
        this.claimListener = (event) => this.handleClaimEvent(event.detail);
        this.corroborationListener = (event) => {
            this.handleCorroborationEvent(event.detail);
        };
        this.source.addEventListener(this.opts.claim_event_name, this.claimListener);
        this.source.addEventListener(
            this.opts.corroboration_event_name,
            this.corroborationListener,
        );
        this.active = true;
    }

    stop(): void {
        if (!this.active) return;
        if (this.claimListener) {
            this.source.removeEventListener(this.opts.claim_event_name, this.claimListener);
        }
        if (this.corroborationListener) {
            this.source.removeEventListener(
                this.opts.corroboration_event_name,
                this.corroborationListener,
            );
        }
        this.claimListener = undefined;
        this.corroborationListener = undefined;
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    telemetry(): TranslationPolicyLiveWiringTelemetry {
        return { ...this.stats };
    }

    handleClaimEvent(detail: unknown): TranslationPolicyLoopResult | null {
        this.stats.claims_received++;
        const parsed = this.extractDetail(detail);
        if (!parsed || typeof parsed.body !== "string") {
            this.stats.claims_malformed++;
            return null;
        }
        const now = this.opts.now_ms();
        const result = this.loop.ingestPolicyBody(parsed.body, now);
        if (result.observation) {
            this.stats.claims_observed++;
            this.emitLocalRaises(parsed, result, now);
        } else {
            this.stats.claims_malformed++;
        }
        return result;
    }

    handleCorroborationEvent(
        detail: unknown,
    ): PolicyDriftCorroboratedRecord | null {
        this.stats.corroboration_raises_received++;
        const parsed = this.extractDetail(detail);
        if (!parsed || typeof parsed.body !== "string") {
            this.stats.corroboration_raises_malformed++;
            return null;
        }
        const raise = decodeTranslationPolicyCorroborationMeshPayload(parsed.body);
        const tracker = this.loop.corroborationGate?.tracker;
        if (!raise || !tracker) {
            this.stats.corroboration_raises_malformed++;
            return null;
        }
        const record = tracker.recordRaise(raise, this.opts.now_ms());
        if (!record) {
            this.stats.corroboration_raises_malformed++;
            return null;
        }
        this.stats.corroboration_raises_recorded++;
        return record;
    }

    private emitLocalRaises(
        detail: TranslationPolicyLiveEventDetail,
        result: TranslationPolicyLoopResult,
        now_ms: number,
    ): void {
        if (!this.opts.emit_local_raises || !this.opts.raise_emit) return;
        const witness = this.opts.local_witness_id ??
            this.loop.corroborationGate?.witness_id;
        if (typeof witness !== "number" || !Number.isFinite(witness)) {
            this.stats.local_raises_skipped += result.new_drift_events.length;
            return;
        }
        for (const event of result.new_drift_events) {
            const targets = this.resolveRaiseTargets(detail, event, result);
            if (targets.length === 0) {
                this.stats.local_raises_skipped++;
                continue;
            }
            const raise = buildTranslationPolicyCorroborationRaise(
                event,
                witness >>> 0,
                now_ms,
            );
            for (const target of targets) this.emitRaise(target, raise);
        }
    }

    private emitRaise(
        target_peer_id: number,
        raise: TranslationPolicyCorroborationRaise,
    ): void {
        this.stats.local_raises_built++;
        if (this.opts.raise_emit!(target_peer_id >>> 0, JSON.stringify(raise))) {
            this.stats.local_raises_emitted++;
        } else {
            this.stats.local_raises_failed++;
        }
    }

    private resolveRaiseTargets(
        detail: TranslationPolicyLiveEventDetail,
        event: TranslationPolicyDriftEvent,
        result: TranslationPolicyLoopResult,
    ): number[] {
        const custom = this.opts.raise_targets?.(detail, event, result);
        const raw = custom ?? (
            typeof detail.fromPeer === "number" ? [detail.fromPeer] : []
        );
        const seen = new Set<number>();
        const out: number[] = [];
        for (const target of raw) {
            if (!Number.isFinite(target)) continue;
            const peer = target >>> 0;
            if (seen.has(peer)) continue;
            seen.add(peer);
            out.push(peer);
        }
        return out;
    }

    private extractDetail(detail: unknown): TranslationPolicyLiveEventDetail | null {
        if (!detail || typeof detail !== "object") return null;
        return detail as TranslationPolicyLiveEventDetail;
    }
}
