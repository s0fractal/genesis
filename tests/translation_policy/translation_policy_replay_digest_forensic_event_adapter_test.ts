// Era 1910: Translation policy replay digest forensic adapter tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEventSink } from "../../src/network/forensic_event_sink.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
    createTranslationPolicyReplayDigestForensicEventAdapter,
    translationPolicyReplayDigestForensicPayload,
    translationPolicyReplayDigestForensicProjection,
} from "../../src/network/translation_policy/translation_policy_replay_digest_forensic_event_adapter.ts";
import type {
    ReplayDigestQuorumSnapshot,
} from "../../src/network/translation_policy/translation_policy_replay_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestLiveWiringTelemetry,
} from "../../src/network/translation_policy/translation_policy_replay_digest_live_wiring.ts";

const T0 = 1_000_000;

function snapshot(
    overrides: Partial<ReplayDigestQuorumSnapshot> = {},
): ReplayDigestQuorumSnapshot {
    return {
        schema: "OMEGA-1880/v1",
        consensus_digest: 0x1234_ABCD,
        consensus_count: 3,
        total_claims: 3,
        band: "high",
        dissenter_peer_ids: [],
        distinct_digests: [0x1234_ABCD],
        agreement_q16: 65536,
        consensus_claim: null,
        ...overrides,
    };
}

function telemetry(
    overrides: Partial<TranslationPolicyReplayDigestLiveWiringTelemetry> = {},
): TranslationPolicyReplayDigestLiveWiringTelemetry {
    return {
        claims_received: 3,
        claims_malformed: 0,
        claims_observed: 3,
        local_claims_built: 1,
        local_claims_emitted: 1,
        local_claims_failed: 0,
        local_claims_skipped: 0,
        ...overrides,
    };
}

Deno.test("replay digest forensic adapter: disabled adapter is inert", async () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(sink, {
        enabled: false,
        now_ms: () => T0,
    })!;
    adapter.start();
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(adapter.isActive(), false);
    assertEquals(result.reason, "disabled");
    assertEquals(sink.size(), 0);
});

Deno.test("replay digest forensic adapter: start and stop toggle active", async () => {
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(
        new ForensicEventSink(),
        { enabled: true, now_ms: () => T0 },
    )!;
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.stop();
    assertEquals(adapter.isActive(), false);
});

Deno.test("replay digest forensic adapter: appends compact tpdq event", async () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(sink, {
        enabled: true,
        now_ms: () => T0,
    })!;
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(result.reason, "appended");
    assertEquals(result.event?.kind, "tpdq");
    assertEquals(result.event?.payload, {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        hud_schema: "OMEGA-1900/v1",
        emitted_at_ms: T0,
        band: "nominal",
        consensus_digest: 0x1234_ABCD,
        consensus_count: 3,
        total_claims: 3,
        agreement_q16: 65536,
        distinct_digest_count: 1,
        dissenter_count: 0,
        malformed_count: 0,
        local_claims_emitted: 1,
        local_claims_failed: 0,
        local_claims_skipped: 0,
    });
    assertEquals(sink.verifyChain(), null);
});

Deno.test("replay digest forensic adapter: unchanged projection is skipped", async () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(sink, {
        enabled: true,
        now_ms: () => T0,
    })!;
    adapter.handleSnapshot(snapshot(), telemetry());
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(result.reason, "unchanged");
    assertEquals(sink.size(), 1);
    assertEquals(adapter.telemetry().skipped_unchanged, 1);
});

Deno.test("replay digest forensic adapter: changed consensus appends", async () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(sink, {
        enabled: true,
        now_ms: () => T0,
    })!;
    adapter.handleSnapshot(snapshot(), telemetry());
    adapter.handleSnapshot(
        snapshot({ consensus_digest: 0xBBBB, distinct_digests: [0xBBBB] }),
        telemetry(),
    );
    assertEquals(sink.size(), 2);
});

Deno.test("replay digest forensic adapter: drift and blocked bands are captured", async () => {
    const driftPayload = translationPolicyReplayDigestForensicPayload(
        snapshot({
            consensus_count: 2,
            total_claims: 3,
            dissenter_peer_ids: [0xCC],
            distinct_digests: [1, 2],
        }),
        telemetry(),
        T0,
    );
    const blockedPayload = translationPolicyReplayDigestForensicPayload(
        snapshot(),
        telemetry({ local_claims_failed: 1 }),
        T0,
    );
    assertEquals(driftPayload.band, "drift");
    assertEquals(driftPayload.dissenter_count, 1);
    assertEquals(blockedPayload.band, "blocked");
    assertEquals(blockedPayload.local_claims_failed, 1);
});

Deno.test("replay digest forensic adapter: projection ignores emitted time", async () => {
    const a = translationPolicyReplayDigestForensicPayload(snapshot(), telemetry(), T0);
    const b = translationPolicyReplayDigestForensicPayload(snapshot(), telemetry(), T0 + 1);
    assertEquals(
        translationPolicyReplayDigestForensicProjection(a),
        translationPolicyReplayDigestForensicProjection(b),
    );
});

Deno.test("replay digest forensic adapter: malformed and local counters affect projection", async () => {
    const base = translationPolicyReplayDigestForensicPayload(snapshot(), telemetry(), T0);
    const changed = translationPolicyReplayDigestForensicPayload(
        snapshot(),
        telemetry({ claims_malformed: 1 }),
        T0,
    );
    assertEquals(
        translationPolicyReplayDigestForensicProjection(base) ===
            translationPolicyReplayDigestForensicProjection(changed),
        false,
    );
});

Deno.test("replay digest forensic adapter: custom kind", async () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(sink, {
        enabled: true,
        kind: "rdq",
        now_ms: () => T0,
    })!;
    adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(sink.list()[0].kind, "rdq");
});

Deno.test("replay digest forensic adapter: telemetry tracks last hash", async () => {
    const adapter = createTranslationPolicyReplayDigestForensicEventAdapter(
        new ForensicEventSink(),
        { enabled: true, now_ms: () => T0 },
    )!;
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(adapter.telemetry().appended_events, 1);
    assertEquals(adapter.telemetry().last_event_hash, result.event_hash);
});

Deno.test("schema constant", async () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        "OMEGA-1910/v1",
    );
});
