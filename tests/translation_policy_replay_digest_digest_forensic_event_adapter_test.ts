// Era 1990: Translation policy replay digest digest forensic adapter tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEventSink } from "../src/network/forensic_event_sink.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
    createTranslationPolicyReplayDigestDigestForensicEventAdapter,
    translationPolicyReplayDigestDigestForensicPayload,
    translationPolicyReplayDigestDigestForensicProjection,
} from "../src/network/translation_policy_replay_digest_digest_forensic_event_adapter.ts";
import type {
    ReplayDigestDigestQuorumSnapshot,
} from "../src/network/translation_policy_replay_digest_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
} from "../src/network/translation_policy_replay_digest_digest_live_wiring.ts";

const T0 = 1_000_000;

function snapshot(
    overrides: Partial<ReplayDigestDigestQuorumSnapshot> = {},
): ReplayDigestDigestQuorumSnapshot {
    return {
        schema: "OMEGA-1960/v1",
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
    overrides:
        Partial<TranslationPolicyReplayDigestDigestLiveWiringTelemetry> = {},
): TranslationPolicyReplayDigestDigestLiveWiringTelemetry {
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

Deno.test("replay digest digest forensic adapter: disabled adapter is inert", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        sink,
        {
            enabled: false,
            now_ms: () => T0,
        },
    )!;
    adapter.start();
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(adapter.isActive(), false);
    assertEquals(result.reason, "disabled");
    assertEquals(sink.size(), 0);
});

Deno.test("replay digest digest forensic adapter: start and stop toggle active", () => {
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        new ForensicEventSink(),
        { enabled: true, now_ms: () => T0 },
    )!;
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.stop();
    assertEquals(adapter.isActive(), false);
});

Deno.test("replay digest digest forensic adapter: appends compact tpdd event", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        sink,
        {
            enabled: true,
            now_ms: () => T0,
        },
    )!;
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(result.reason, "appended");
    assertEquals(result.event?.kind, "tpdd");
    assertEquals(result.event?.payload, {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        hud_schema: "OMEGA-1980/v1",
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

Deno.test("replay digest digest forensic adapter: unchanged projection is skipped", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        sink,
        {
            enabled: true,
            now_ms: () => T0,
        },
    )!;
    adapter.handleSnapshot(snapshot(), telemetry());
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(result.reason, "unchanged");
    assertEquals(sink.size(), 1);
    assertEquals(adapter.telemetry().skipped_unchanged, 1);
});

Deno.test("replay digest digest forensic adapter: changed consensus appends", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        sink,
        {
            enabled: true,
            now_ms: () => T0,
        },
    )!;
    adapter.handleSnapshot(snapshot(), telemetry());
    adapter.handleSnapshot(
        snapshot({ consensus_digest: 0xBBBB, distinct_digests: [0xBBBB] }),
        telemetry(),
    );
    assertEquals(sink.size(), 2);
});

Deno.test("replay digest digest forensic adapter: drift and blocked bands are captured", () => {
    const driftPayload = translationPolicyReplayDigestDigestForensicPayload(
        snapshot({
            consensus_count: 2,
            total_claims: 3,
            dissenter_peer_ids: [0xCC],
            distinct_digests: [1, 2],
        }),
        telemetry(),
        T0,
    );
    const blockedPayload = translationPolicyReplayDigestDigestForensicPayload(
        snapshot(),
        telemetry({ local_claims_failed: 1 }),
        T0,
    );
    assertEquals(driftPayload.band, "drift");
    assertEquals(driftPayload.dissenter_count, 1);
    assertEquals(blockedPayload.band, "blocked");
    assertEquals(blockedPayload.local_claims_failed, 1);
});

Deno.test("replay digest digest forensic adapter: projection ignores emitted time", () => {
    const a = translationPolicyReplayDigestDigestForensicPayload(
        snapshot(),
        telemetry(),
        T0,
    );
    const b = translationPolicyReplayDigestDigestForensicPayload(
        snapshot(),
        telemetry(),
        T0 + 1,
    );
    assertEquals(
        translationPolicyReplayDigestDigestForensicProjection(a),
        translationPolicyReplayDigestDigestForensicProjection(b),
    );
});

Deno.test("replay digest digest forensic adapter: malformed and local counters affect projection", () => {
    const base = translationPolicyReplayDigestDigestForensicPayload(
        snapshot(),
        telemetry(),
        T0,
    );
    const changed = translationPolicyReplayDigestDigestForensicPayload(
        snapshot(),
        telemetry({ claims_malformed: 1 }),
        T0,
    );
    assertEquals(
        translationPolicyReplayDigestDigestForensicProjection(base) ===
            translationPolicyReplayDigestDigestForensicProjection(changed),
        false,
    );
});

Deno.test("replay digest digest forensic adapter: custom kind", () => {
    const sink = new ForensicEventSink();
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        sink,
        {
            enabled: true,
            kind: "rdd",
            now_ms: () => T0,
        },
    )!;
    adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(sink.list()[0].kind, "rdd");
});

Deno.test("replay digest digest forensic adapter: telemetry tracks last hash", () => {
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        new ForensicEventSink(),
        { enabled: true, now_ms: () => T0 },
    )!;
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(adapter.telemetry().appended_events, 1);
    assertEquals(adapter.telemetry().last_event_hash, result.event_hash);
});

Deno.test("replay digest digest forensic adapter: append failures are reported", () => {
    class ThrowingSink extends ForensicEventSink {
        override append(): never {
            throw new Error("sink unavailable");
        }
    }
    const adapter = createTranslationPolicyReplayDigestDigestForensicEventAdapter(
        new ThrowingSink(),
        { enabled: true, now_ms: () => T0 },
    )!;
    const result = adapter.handleSnapshot(snapshot(), telemetry());
    assertEquals(result.reason, "append-error");
    assertEquals(result.error, "sink unavailable");
    assertEquals(adapter.telemetry().append_failed, 1);
});

Deno.test("replay digest digest forensic adapter: null sink factory returns null", () => {
    assertEquals(
        createTranslationPolicyReplayDigestDigestForensicEventAdapter(null),
        null,
    );
});

Deno.test("replay digest digest forensic adapter: schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        "OMEGA-1990/v1",
    );
});
