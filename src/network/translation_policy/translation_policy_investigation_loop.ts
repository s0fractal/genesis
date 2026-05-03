// 🌌 OMEGA-64: Era 1680 — Translation Policy Investigation Loop
// 🧭 Era 1690 — Corroboration-Gated Emission
//
// Era 1650 observes policy drift, Era 1660 carries claims, and Era
// 1670 builds Senate-compatible warrant proposals. Era 1680 stitches
// them into one operator loop while keeping all enforcement under the
// existing Senate path.

import {
    TranslationPolicyClaim,
    TranslationPolicyDriftEvent,
    TranslationPolicyMonitor,
    TranslationPolicyObservation,
} from "./translation_policy_monitor.ts";
import {
    TranslationPolicyWarrantBridge,
    TranslationPolicyWarrantResult,
} from "./translation_policy_warrant_bridge.ts";
import { WarrantProposalPayload } from "../quorum_warrant_bridge.ts";
import { decodeTranslationPolicyMeshPayload } from "../mesh_event_bridge.ts";
import {
    PolicyDriftConfidence,
    PolicyDriftCorroboratedRecord,
    TranslationPolicyCorroborationTracker,
    confidenceAtLeast,
} from "./translation_policy_corroboration.ts";

export const TRANSLATION_POLICY_INVESTIGATION_SCHEMA = "OMEGA-1680/v1";

export type TranslationPolicyWarrantEmit = (
    proposal: WarrantProposalPayload,
) => boolean;

export interface TranslationPolicyLoopResult {
    observation: TranslationPolicyObservation | null;
    new_drift_events: TranslationPolicyDriftEvent[];
    corroborated_records: PolicyDriftCorroboratedRecord[];
    warrant_result: TranslationPolicyWarrantResult;
    proposals_emitted: number;
    proposals_failed: number;
}

export interface TranslationPolicyLoopTelemetry {
    claims_observed: number;
    malformed_claims: number;
    drift_events_seen: number;
    proposals_built: number;
    proposals_emitted: number;
    proposals_failed: number;
    proposals_deduped: number;
    corroboration_blocked: number;
}

export interface TranslationPolicyCorroborationGate {
    tracker: TranslationPolicyCorroborationTracker;
    witness_id: number;
    min_confidence: PolicyDriftConfidence;
}

export class TranslationPolicyInvestigationLoop {
    private seenDriftEvents = new Set<number>();
    private telemetry: TranslationPolicyLoopTelemetry = {
        claims_observed: 0,
        malformed_claims: 0,
        drift_events_seen: 0,
        proposals_built: 0,
        proposals_emitted: 0,
        proposals_failed: 0,
        proposals_deduped: 0,
        corroboration_blocked: 0,
    };

    constructor(
        public readonly monitor: TranslationPolicyMonitor,
        public readonly emit: TranslationPolicyWarrantEmit,
        public readonly warrantBridge: TranslationPolicyWarrantBridge =
            new TranslationPolicyWarrantBridge(),
        public readonly corroborationGate?: TranslationPolicyCorroborationGate,
    ) {}

    ingestPolicyBody(body_json: string, now_ms: number): TranslationPolicyLoopResult {
        const claim = decodeTranslationPolicyMeshPayload(body_json);
        if (!claim) {
            this.telemetry.malformed_claims++;
            return this.emptyResult();
        }
        return this.observeClaim(claim, now_ms);
    }

    observeClaim(
        claim: TranslationPolicyClaim,
        now_ms: number,
    ): TranslationPolicyLoopResult {
        const observation = this.monitor.observeClaim(claim, now_ms);
        this.telemetry.claims_observed++;
        const newDrift = this.collectNewDriftEvents();
        const gated = this.applyCorroborationGate(newDrift, now_ms);
        const warrantResult = this.warrantBridge.issue(gated.allowed, now_ms);
        let emitted = 0;
        let failed = 0;
        for (const proposal of warrantResult.payloads) {
            if (this.emit(proposal)) emitted++;
            else failed++;
        }
        this.telemetry.drift_events_seen += newDrift.length;
        this.telemetry.proposals_built += warrantResult.payloads.length;
        this.telemetry.proposals_emitted += emitted;
        this.telemetry.proposals_failed += failed;
        this.telemetry.proposals_deduped += warrantResult.deduped_peer_ids.length;
        return {
            observation,
            new_drift_events: newDrift,
            corroborated_records: gated.records,
            warrant_result: warrantResult,
            proposals_emitted: emitted,
            proposals_failed: failed,
        };
    }

    summary(now_ms: number): TranslationPolicyLoopTelemetry & {
        observed_peer_count: number;
        drift_peer_count: number;
        monitor_alarm_count: number;
        corroborated_drift_count: number;
        local_policy_hash: number;
        local_pair_count: number;
    } {
        const monitorSummary = this.monitor.summary(now_ms);
        return {
            ...this.telemetry,
            local_policy_hash: monitorSummary.local_policy_hash,
            local_pair_count: monitorSummary.local_pair_count,
            observed_peer_count: monitorSummary.observed_peer_count,
            drift_peer_count: monitorSummary.drift_peer_count,
            monitor_alarm_count: monitorSummary.alarm_count,
            corroborated_drift_count: this.corroborationGate?.tracker.size() ?? 0,
        };
    }

    clearSeenDrift(): void {
        this.seenDriftEvents.clear();
    }

    private collectNewDriftEvents(): TranslationPolicyDriftEvent[] {
        const out: TranslationPolicyDriftEvent[] = [];
        for (const event of this.monitor.recentAlarms(Number.MAX_SAFE_INTEGER)) {
            const key = event.event_hash >>> 0;
            if (this.seenDriftEvents.has(key)) continue;
            this.seenDriftEvents.add(key);
            out.push(event);
        }
        return out;
    }

    private emptyResult(): TranslationPolicyLoopResult {
        return {
            observation: null,
            new_drift_events: [],
            corroborated_records: [],
            warrant_result: { payloads: [], deduped_peer_ids: [] },
            proposals_emitted: 0,
            proposals_failed: 0,
        };
    }

    private applyCorroborationGate(
        events: TranslationPolicyDriftEvent[],
        now_ms: number,
    ): {
        allowed: TranslationPolicyDriftEvent[];
        records: PolicyDriftCorroboratedRecord[];
    } {
        if (!this.corroborationGate) return { allowed: events, records: [] };
        const allowed: TranslationPolicyDriftEvent[] = [];
        const records: PolicyDriftCorroboratedRecord[] = [];
        for (const event of events) {
            const rec = this.corroborationGate.tracker.record(
                event,
                this.corroborationGate.witness_id,
                now_ms,
            );
            records.push(rec);
            if (confidenceAtLeast(rec.confidence, this.corroborationGate.min_confidence)) {
                allowed.push(event);
            } else {
                this.telemetry.corroboration_blocked++;
            }
        }
        return { allowed, records };
    }
}
