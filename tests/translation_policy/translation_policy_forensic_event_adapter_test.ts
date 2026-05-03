// Era 1830: Translation policy telemetry to forensic sink adapter tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import { ForensicEventSink } from "../../src/network/forensic_event_sink.ts";
import {
    createTranslationPolicyForensicEventAdapter,
    TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA,
    translationPolicyForensicBand,
    translationPolicyForensicPayload,
    translationPolicyForensicProjection,
} from "../../src/network/translation_policy/translation_policy_forensic_event_adapter.ts";
import {
    TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
    TranslationPolicyTelemetryEventDetail,
} from "../../src/bootstrap/translation_policy/translation_policy_telemetry_event.ts";
import {
    TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA,
    TranslationPolicyBootstrapTelemetrySnapshot,
} from "../../src/bootstrap/translation_policy/translation_policy_bootstrap_telemetry.ts";

const T0 = 1_000_000;

function snapshot(overrides: {
    installed?: boolean;
    install_reason?: "installed" | "disabled" | "invalid-peer-id" | "install-error";
    install_error?: string | null;
    tick_reason?: "ticked" | "disabled" | "cooldown" | "runtime-error" | "none";
    tick_error?: string | null;
    peer_count?: number;
    drift_peer_count?: number;
    proposals_failed?: number;
    local_policy_hash?: number;
    malformed_claims?: number;
} = {}): TranslationPolicyBootstrapTelemetrySnapshot {
    const installed = overrides.installed ?? true;
    return {
        schema: TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA,
        now_ms: T0,
        installed,
        install_reason: overrides.install_reason ?? (installed ? "installed" : "disabled"),
        install_error: overrides.install_error ?? null,
        tick: {
            ticked: overrides.tick_reason === undefined || overrides.tick_reason === "ticked",
            reason: overrides.tick_reason ?? "ticked",
            now_ms: T0,
            sent_count: 0,
            failed_count: 0,
            skipped_unchanged_count: 0,
            cold_count: 0,
            error: overrides.tick_error ?? null,
        },
        runtime: installed
            ? {
                schema: "OMEGA-1740/v1",
                active: true,
                live_active: true,
                directory_active: true,
                peer_count: overrides.peer_count ?? 1,
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
                    malformed_claims: overrides.malformed_claims ?? 0,
                    drift_events_seen: 0,
                    proposals_built: 0,
                    proposals_emitted: 0,
                    proposals_failed: overrides.proposals_failed ?? 0,
                    proposals_deduped: 0,
                    corroboration_blocked: 0,
                    local_policy_hash: overrides.local_policy_hash ?? 0xABCD,
                    local_pair_count: 1,
                    observed_peer_count: 0,
                    drift_peer_count: overrides.drift_peer_count ?? 0,
                    monitor_alarm_count: overrides.drift_peer_count ?? 0,
                    corroborated_drift_count: 0,
                },
            }
            : null,
        emit: installed
            ? {
                claims_sent: 0,
                claims_failed: 0,
                raises_sent: 0,
                raises_failed: 0,
                warrants_sent: 0,
                warrants_failed: 0,
            }
            : null,
    };
}

function detail(
    snap: TranslationPolicyBootstrapTelemetrySnapshot,
    hash = 0x1111,
): TranslationPolicyTelemetryEventDetail {
    return {
        schema: TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
        event_name: "translationPolicyTelemetry",
        emitted_at_ms: T0,
        hash,
        snapshot: snap,
    };
}

Deno.test("forensic adapter: disabled adapter is inert", () => {
    const sink = new ForensicEventSink();
    const source = new LocalEventSource();
    const adapter = createTranslationPolicyForensicEventAdapter(sink, source, {
        enabled: false,
        now_ms: () => T0,
    })!;
    adapter.start();
    source.dispatch("translationPolicyTelemetry", detail(snapshot()));
    assertEquals(adapter.isActive(), false);
    assertEquals(sink.size(), 0);
});

Deno.test("forensic adapter: start listens and stop unsubscribes", () => {
    const sink = new ForensicEventSink();
    const source = new LocalEventSource();
    const adapter = createTranslationPolicyForensicEventAdapter(sink, source, {
        enabled: true,
        now_ms: () => T0,
    })!;
    adapter.start();
    source.dispatch("translationPolicyTelemetry", detail(snapshot()));
    assertEquals(sink.size(), 1);
    adapter.stop();
    source.dispatch("translationPolicyTelemetry", detail(snapshot({ drift_peer_count: 1 })));
    assertEquals(sink.size(), 1);
    assertEquals(adapter.telemetry().active, false);
});

Deno.test("forensic adapter: appends compact event and preserves sink chain", () => {
    const sink = new ForensicEventSink();
    const source = new LocalEventSource();
    const adapter = createTranslationPolicyForensicEventAdapter(sink, source, {
        enabled: true,
        now_ms: () => T0 + 10,
    })!;
    const result = adapter.handleDetail(detail(snapshot({ local_policy_hash: 0xCAFE })));
    assertEquals(result.reason, "appended");
    assertEquals(result.event?.kind, "tpol");
    assertEquals(result.event?.payload, {
        schema: TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA,
        telemetry_schema: TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
        source_hash: 0x1111,
        emitted_at_ms: T0,
        band: "nominal",
        installed: true,
        install_reason: "installed",
        install_error: null,
        tick_reason: "ticked",
        tick_error: null,
        local_policy_hash: 0xCAFE,
        local_pair_count: 1,
        peer_count: 1,
        due_peer_count: 0,
        drift_peer_count: 0,
        monitor_alarm_count: 0,
        proposals_emitted: 0,
        proposals_failed: 0,
        malformed_count: 0,
    });
    assertEquals(sink.verifyChain(), null);
});

Deno.test("forensic adapter: unchanged forensic projection is skipped", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyForensicEventAdapter(
        sink,
        new LocalEventSource(),
        { enabled: true, now_ms: () => T0 },
    )!;
    adapter.handleDetail(detail(snapshot(), 0x1111));
    const result = adapter.handleDetail(detail(snapshot(), 0x2222));
    assertEquals(result.reason, "unchanged");
    assertEquals(sink.size(), 1);
    assertEquals(adapter.telemetry().skipped_unchanged, 1);
});

Deno.test("forensic adapter: band and policy-hash changes append", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyForensicEventAdapter(
        sink,
        new LocalEventSource(),
        { enabled: true, now_ms: () => T0 },
    )!;
    adapter.handleDetail(detail(snapshot({ local_policy_hash: 0x1000 })));
    adapter.handleDetail(detail(snapshot({ local_policy_hash: 0x2000 })));
    adapter.handleDetail(detail(snapshot({ drift_peer_count: 1 })));
    assertEquals(sink.size(), 3);
    assertEquals(sink.list().map((e) => (e.payload as { band: string }).band), [
        "nominal",
        "nominal",
        "drift",
    ]);
});

Deno.test("forensic adapter: install and tick errors produce dedicated bands", () => {
    assertEquals(
        translationPolicyForensicBand(detail(snapshot({
            installed: false,
            install_reason: "install-error",
            install_error: "bad config",
        }))),
        "install-error",
    );
    assertEquals(
        translationPolicyForensicBand(detail(snapshot({
            tick_reason: "runtime-error",
            tick_error: "boom",
        }))),
        "tick-error",
    );
});

Deno.test("forensic adapter: malformed telemetry detail is counted", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyForensicEventAdapter(
        sink,
        new LocalEventSource(),
        { enabled: true, now_ms: () => T0 },
    )!;
    const result = adapter.handleDetail({ schema: "wrong" });
    assertEquals(result.reason, "malformed");
    assertEquals(sink.size(), 0);
    assertEquals(adapter.telemetry().malformed_events, 1);
});

Deno.test("forensic adapter: custom event name and kind", () => {
    const sink = new ForensicEventSink();
    const source = new LocalEventSource();
    const adapter = createTranslationPolicyForensicEventAdapter(sink, source, {
        enabled: true,
        event_name: "omegaTpolTelemetry",
        kind: "tpfx",
        now_ms: () => T0,
    })!;
    adapter.start();
    source.dispatch("translationPolicyTelemetry", detail(snapshot()));
    source.dispatch("omegaTpolTelemetry", detail(snapshot()));
    assertEquals(sink.size(), 1);
    assertEquals(sink.list()[0].kind, "tpfx");
});

Deno.test("forensic adapter: projection ignores source event hash churn", () => {
    assertEquals(
        translationPolicyForensicProjection(
            translationPolicyForensicPayload(detail(snapshot(), 0x1111)),
        ),
        translationPolicyForensicProjection(
            translationPolicyForensicPayload(detail(snapshot(), 0x2222)),
        ),
    );
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA, "OMEGA-1830/v1");
});
