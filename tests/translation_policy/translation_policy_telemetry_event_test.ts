// Era 1820: Translation policy telemetry CustomEvent emission tests.
import { assertEquals } from "jsr:@std/assert";
import {
    createTranslationPolicyTelemetryEventEmitter,
    TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
    TranslationPolicyTelemetryEventDetail,
    translationPolicyTelemetryHash,
} from "../../src/bootstrap/translation_policy/translation_policy_telemetry_event.ts";
import {
    TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA,
    TranslationPolicyBootstrapTelemetrySnapshot,
} from "../../src/bootstrap/translation_policy/translation_policy_bootstrap_telemetry.ts";

const T0 = 1_000_000;

class CaptureTarget {
    events: Array<{ type: string; detail: TranslationPolicyTelemetryEventDetail }> = [];

    dispatchEvent(event: Event): boolean {
        this.events.push({
            type: event.type,
            detail: (event as CustomEvent<TranslationPolicyTelemetryEventDetail>).detail,
        });
        return true;
    }
}

class FailingTarget {
    dispatchEvent(_event: Event): boolean {
        throw new Error("dispatch failed");
    }
}

function snapshot(overrides: {
    now_ms?: number;
    installed?: boolean;
    sent_count?: number;
    peer_count?: number;
} = {}): TranslationPolicyBootstrapTelemetrySnapshot {
    const installed = overrides.installed ?? true;
    return {
        schema: TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA,
        now_ms: overrides.now_ms ?? T0,
        installed,
        install_reason: installed ? "installed" : "disabled",
        install_error: null,
        tick: {
            ticked: true,
            reason: "ticked",
            now_ms: overrides.now_ms ?? T0,
            sent_count: overrides.sent_count ?? 0,
            failed_count: 0,
            skipped_unchanged_count: 0,
            cold_count: 0,
            error: null,
        },
        runtime: installed
            ? {
                schema: "OMEGA-1740/v1",
                active: true,
                live_active: true,
                directory_active: true,
                peer_count: overrides.peer_count ?? 0,
                due_peer_count: 0,
                live: {
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
                },
                directory: {
                    joined_received: 0,
                    left_received: 0,
                    activity_received: 0,
                    malformed_events: 0,
                    peers_added: 0,
                    peers_removed: 0,
                    activity_peers_seen: 0,
                },
                loop: {
                    claims_observed: 0,
                    malformed_claims: 0,
                    drift_events_seen: 0,
                    proposals_built: 0,
                    proposals_emitted: 0,
                    proposals_failed: 0,
                    proposals_deduped: 0,
                    corroboration_blocked: 0,
                    local_policy_hash: 0xABCD,
                    local_pair_count: 1,
                    observed_peer_count: 0,
                    drift_peer_count: 0,
                    monitor_alarm_count: 0,
                    corroborated_drift_count: 0,
                },
            }
            : null,
        emit: installed
            ? {
                claims_sent: overrides.sent_count ?? 0,
                claims_failed: 0,
                raises_sent: 0,
                raises_failed: 0,
                warrants_sent: 0,
                warrants_failed: 0,
            }
            : null,
    };
}

Deno.test("telemetry event: disabled emitter is inert", async () => {
    const target = new CaptureTarget();
    const emitter = createTranslationPolicyTelemetryEventEmitter(target, {
        enabled: false,
    })!;
    const result = emitter.tick(snapshot(), T0);
    assertEquals(result.reason, "disabled");
    assertEquals(result.emitted, false);
    assertEquals(target.events.length, 0);
});

Deno.test("telemetry event: enabled emitter dispatches first snapshot", async () => {
    const target = new CaptureTarget();
    const emitter = createTranslationPolicyTelemetryEventEmitter(target, {
        enabled: true,
    })!;
    const snap = snapshot();
    const result = emitter.tick(snap, T0);
    assertEquals(result.schema, TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA);
    assertEquals(result.reason, "emitted");
    assertEquals(target.events.length, 1);
    assertEquals(target.events[0].type, "translationPolicyTelemetry");
    assertEquals(target.events[0].detail.snapshot, snap);
    assertEquals(target.events[0].detail.hash, result.hash);
});

Deno.test("telemetry event: cooldown throttles dispatch", async () => {
    const target = new CaptureTarget();
    const emitter = createTranslationPolicyTelemetryEventEmitter(target, {
        enabled: true,
        min_interval_ms: 1_000,
    })!;
    emitter.tick(snapshot({ sent_count: 0 }), T0);
    const result = emitter.tick(snapshot({ sent_count: 1 }), T0 + 500);
    assertEquals(result.reason, "cooldown");
    assertEquals(target.events.length, 1);
});

Deno.test("telemetry event: unchanged snapshots are suppressed after cooldown", async () => {
    const target = new CaptureTarget();
    const emitter = createTranslationPolicyTelemetryEventEmitter(target, {
        enabled: true,
        min_interval_ms: 1_000,
        emit_on_change_only: true,
    })!;
    emitter.tick(snapshot({ now_ms: T0 }), T0);
    const result = emitter.tick(snapshot({ now_ms: T0 + 2_000 }), T0 + 2_000);
    assertEquals(result.reason, "unchanged");
    assertEquals(target.events.length, 1);
});

Deno.test("telemetry event: changed snapshot emits after cooldown", async () => {
    const target = new CaptureTarget();
    const emitter = createTranslationPolicyTelemetryEventEmitter(target, {
        enabled: true,
        min_interval_ms: 1_000,
    })!;
    emitter.tick(snapshot({ sent_count: 0 }), T0);
    const result = emitter.tick(snapshot({ sent_count: 1 }), T0 + 2_000);
    assertEquals(result.reason, "emitted");
    assertEquals(target.events.length, 2);
});

Deno.test("telemetry event: custom event name and change-only disable work", async () => {
    const target = new CaptureTarget();
    const emitter = createTranslationPolicyTelemetryEventEmitter(target, {
        enabled: true,
        min_interval_ms: 1_000,
        emit_on_change_only: false,
        event_name: "omegaTpolTelemetry",
    })!;
    emitter.tick(snapshot(), T0);
    const result = emitter.tick(snapshot(), T0 + 2_000);
    assertEquals(result.reason, "emitted");
    assertEquals(target.events.length, 2);
    assertEquals(target.events[0].type, "omegaTpolTelemetry");
    assertEquals(target.events[1].detail.event_name, "omegaTpolTelemetry");
});

Deno.test("telemetry event: dispatch error is contained", async () => {
    const emitter = createTranslationPolicyTelemetryEventEmitter(new FailingTarget(), {
        enabled: true,
    })!;
    const result = emitter.tick(snapshot(), T0);
    assertEquals(result.reason, "dispatch-error");
    assertEquals(result.emitted, false);
    assertEquals(result.error, "dispatch failed");
});

Deno.test("telemetry event: hash ignores wall-clock-only snapshot churn", async () => {
    assertEquals(
        translationPolicyTelemetryHash(snapshot({ now_ms: T0 })),
        translationPolicyTelemetryHash(snapshot({ now_ms: T0 + 42 })),
    );
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA, "OMEGA-1820/v1");
});
