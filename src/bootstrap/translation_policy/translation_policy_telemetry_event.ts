// OMEGA-64: Era 1820 - Translation Policy Snapshot Event Emission
//
// Era 1810 publishes one stable diagnostic snapshot on `window`. This
// module makes that snapshot subscribable without forcing consumers to
// poll the render loop global.

import { sha256_u32 } from "../../sdk/phi_crypto.ts";
import type {
    TranslationPolicyBootstrapTelemetrySnapshot,
} from "./translation_policy_bootstrap_telemetry.ts";

export const TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA = "OMEGA-1820/v1";

export interface TranslationPolicyTelemetryEventTarget {
    dispatchEvent(event: Event): boolean;
}

export interface TranslationPolicyTelemetryEventOptions {
    enabled: boolean;
    min_interval_ms: number;
    emit_on_change_only: boolean;
    event_name: string;
}

export type TranslationPolicyTelemetryEventOptionsInput =
    Partial<TranslationPolicyTelemetryEventOptions>;

export interface TranslationPolicyTelemetryEventDetail {
    schema: string;
    event_name: string;
    emitted_at_ms: number;
    hash: number;
    snapshot: TranslationPolicyBootstrapTelemetrySnapshot;
}

export interface TranslationPolicyTelemetryEventTick {
    schema: string;
    emitted: boolean;
    reason: "emitted" | "disabled" | "cooldown" | "unchanged" | "dispatch-error";
    now_ms: number;
    hash: number | null;
    error?: string;
}

export const DEFAULT_TRANSLATION_POLICY_TELEMETRY_EVENT_OPTS:
    TranslationPolicyTelemetryEventOptions = {
        enabled: false,
        min_interval_ms: 1_000,
        emit_on_change_only: true,
        event_name: "translationPolicyTelemetry",
    };

const encoder = new TextEncoder();

export class TranslationPolicyTelemetryEventEmitter {
    private lastEmitMs = Number.NEGATIVE_INFINITY;
    private lastHash: number | null = null;

    constructor(
        private readonly target: TranslationPolicyTelemetryEventTarget,
        private readonly opts: TranslationPolicyTelemetryEventOptions =
            DEFAULT_TRANSLATION_POLICY_TELEMETRY_EVENT_OPTS,
    ) {}

    tick(
        snapshot: TranslationPolicyBootstrapTelemetrySnapshot,
        now_ms: number,
    ): TranslationPolicyTelemetryEventTick {
        if (!this.opts.enabled) return this.result(now_ms, "disabled", null);
        if (now_ms - this.lastEmitMs < this.opts.min_interval_ms) {
            return this.result(now_ms, "cooldown", null);
        }
        const hash = translationPolicyTelemetryHash(snapshot);
        if (this.opts.emit_on_change_only && this.lastHash === hash) {
            return this.result(now_ms, "unchanged", hash);
        }
        try {
            const detail: TranslationPolicyTelemetryEventDetail = {
                schema: TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
                event_name: this.opts.event_name,
                emitted_at_ms: now_ms,
                hash,
                snapshot,
            };
            this.target.dispatchEvent(new CustomEvent(this.opts.event_name, { detail }));
            this.lastEmitMs = now_ms;
            this.lastHash = hash;
            return this.result(now_ms, "emitted", hash);
        } catch (e) {
            return {
                ...this.result(now_ms, "dispatch-error", hash),
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }

    private result(
        now_ms: number,
        reason: TranslationPolicyTelemetryEventTick["reason"],
        hash: number | null,
    ): TranslationPolicyTelemetryEventTick {
        return {
            schema: TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
            emitted: reason === "emitted",
            reason,
            now_ms,
            hash,
        };
    }
}

export function createTranslationPolicyTelemetryEventEmitter(
    target: TranslationPolicyTelemetryEventTarget | null | undefined,
    opts: TranslationPolicyTelemetryEventOptionsInput = {},
): TranslationPolicyTelemetryEventEmitter | null {
    if (!target) return null;
    return new TranslationPolicyTelemetryEventEmitter(target, mergeOptions(opts));
}

export function mergeTranslationPolicyTelemetryEventOptions(
    opts: TranslationPolicyTelemetryEventOptionsInput = {},
): TranslationPolicyTelemetryEventOptions {
    return mergeOptions(opts);
}

export function translationPolicyTelemetryHash(
    snapshot: TranslationPolicyBootstrapTelemetrySnapshot,
): number {
    return sha256_u32(encoder.encode(stableTelemetryProjection(snapshot)));
}

function mergeOptions(
    opts: TranslationPolicyTelemetryEventOptionsInput,
): TranslationPolicyTelemetryEventOptions {
    return {
        ...DEFAULT_TRANSLATION_POLICY_TELEMETRY_EVENT_OPTS,
        ...opts,
    };
}

function stableTelemetryProjection(
    snapshot: TranslationPolicyBootstrapTelemetrySnapshot,
): string {
    const runtime = snapshot.runtime;
    const live = runtime?.live;
    const directory = runtime?.directory;
    const loop = runtime?.loop;
    const emit = snapshot.emit;
    return [
        snapshot.schema,
        bool(snapshot.installed),
        snapshot.install_reason,
        snapshot.install_error ?? "",
        bool(snapshot.tick.ticked),
        snapshot.tick.reason,
        num(snapshot.tick.sent_count),
        num(snapshot.tick.failed_count),
        num(snapshot.tick.skipped_unchanged_count),
        num(snapshot.tick.cold_count),
        snapshot.tick.error ?? "",
        bool(runtime?.active),
        bool(runtime?.live_active),
        bool(runtime?.directory_active),
        num(runtime?.peer_count),
        num(runtime?.due_peer_count),
        num(live?.claims_received),
        num(live?.claims_malformed),
        num(live?.claims_observed),
        num(live?.corroboration_raises_received),
        num(live?.corroboration_raises_malformed),
        num(live?.corroboration_raises_recorded),
        num(live?.local_raises_built),
        num(live?.local_raises_emitted),
        num(live?.local_raises_failed),
        num(live?.local_raises_skipped),
        num(directory?.joined_received),
        num(directory?.left_received),
        num(directory?.activity_received),
        num(directory?.malformed_events),
        num(directory?.peers_added),
        num(directory?.peers_removed),
        num(directory?.activity_peers_seen),
        num(loop?.claims_observed),
        num(loop?.malformed_claims),
        num(loop?.drift_events_seen),
        num(loop?.proposals_built),
        num(loop?.proposals_emitted),
        num(loop?.proposals_failed),
        num(loop?.proposals_deduped),
        num(loop?.corroboration_blocked),
        num(loop?.local_policy_hash),
        num(loop?.local_pair_count),
        num(loop?.observed_peer_count),
        num(loop?.drift_peer_count),
        num(loop?.monitor_alarm_count),
        num(loop?.corroborated_drift_count),
        num(emit?.claims_sent),
        num(emit?.claims_failed),
        num(emit?.raises_sent),
        num(emit?.raises_failed),
        num(emit?.warrants_sent),
        num(emit?.warrants_failed),
    ].join("|");
}

function bool(value: boolean | undefined): string {
    return value === true ? "1" : "0";
}

function num(value: number | undefined): string {
    return Number.isFinite(value) ? String(value! >>> 0) : "0";
}
