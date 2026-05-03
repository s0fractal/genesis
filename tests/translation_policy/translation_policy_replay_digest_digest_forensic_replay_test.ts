// Era 2000: Translation policy replay digest digest forensic replay tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEventSink } from "../../src/network/forensic_event_sink.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
    TranslationPolicyReplayDigestDigestForensicPayload,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_forensic_event_adapter.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_SCHEMA,
    classifyTranslationPolicyReplayDigestDigestForensicEvents,
    classifyTranslationPolicyReplayDigestDigestForensicSink,
    parseTranslationPolicyReplayDigestDigestForensicPayload,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_forensic_replay.ts";

const T0 = 1_000_000;

function payload(
    overrides: Partial<TranslationPolicyReplayDigestDigestForensicPayload> = {},
): TranslationPolicyReplayDigestDigestForensicPayload {
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_EVENT_ADAPTER_SCHEMA,
        hud_schema: "OMEGA-1980/v1",
        emitted_at_ms: T0,
        band: "nominal",
        consensus_digest: 0xAAAA,
        consensus_count: 3,
        total_claims: 3,
        agreement_q16: 65536,
        distinct_digest_count: 1,
        dissenter_count: 0,
        malformed_count: 0,
        local_claims_emitted: 1,
        local_claims_failed: 0,
        local_claims_skipped: 0,
        ...overrides,
    };
}

function append(
    sink: ForensicEventSink,
    t: number,
    overrides: Partial<TranslationPolicyReplayDigestDigestForensicPayload> = {},
): void {
    sink.append(
        "tpdd",
        (0x3000 + sink.size()) >>> 0,
        payload(overrides),
        t,
    );
}

Deno.test("replay digest digest forensic replay: empty input has stable null summary", () => {
    const c = classifyTranslationPolicyReplayDigestDigestForensicEvents([]);
    assertEquals(
        c.schema,
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_SCHEMA,
    );
    assertEquals(c.total_events, 0);
    assertEquals(c.classified_events, 0);
    assertEquals(c.final_band, null);
    assertEquals(c.final_consensus_digest, null);
    assertEquals(c.band_timeline, []);
    assertEquals(c.consensus_digest_intervals, []);
    assertEquals(c.error_windows, []);
});

Deno.test("replay digest digest forensic replay: ignores non-tpdd and counts malformed", () => {
    const sink = new ForensicEventSink();
    sink.append("tpdq", 1, payload(), T0);
    sink.append("tpdd", 2, { schema: "wrong" }, T0 + 1);
    append(sink, T0 + 2);
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink);
    assertEquals(c.total_events, 3);
    assertEquals(c.ignored_events, 1);
    assertEquals(c.malformed_payloads, 1);
    assertEquals(c.classified_events, 1);
});

Deno.test("replay digest digest forensic replay: builds deterministic band timeline", () => {
    const sink = new ForensicEventSink();
    append(sink, T0 + 20, { band: "drift" });
    append(sink, T0, { band: "nominal" });
    append(sink, T0 + 10, { band: "nominal" });
    append(sink, T0 + 30, { band: "blocked" });
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink);
    assertEquals(c.band_timeline.map((s) => ({
        band: s.band,
        start_ms: s.start_ms,
        end_ms: s.end_ms,
    })), [
        { band: "nominal", start_ms: T0, end_ms: T0 + 10 },
        { band: "drift", start_ms: T0 + 20, end_ms: T0 + 20 },
        { band: "blocked", start_ms: T0 + 30, end_ms: T0 + 30 },
    ]);
    assertEquals(c.final_band, "blocked");
});

Deno.test("replay digest digest forensic replay: builds consensus digest intervals", () => {
    const sink = new ForensicEventSink();
    append(sink, T0, { consensus_digest: 0xAAAA, consensus_count: 2 });
    append(sink, T0 + 1, { consensus_digest: 0xAAAA, consensus_count: 3 });
    append(sink, T0 + 2, {
        consensus_digest: 0xBBBB,
        consensus_count: 1,
        total_claims: 2,
        agreement_q16: 32768,
    });
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink);
    assertEquals(c.consensus_digest_intervals.map((i) => ({
        digest: i.consensus_digest,
        start_ms: i.start_ms,
        end_ms: i.end_ms,
        count: i.consensus_count,
        total: i.total_claims,
        q16: i.agreement_q16,
    })), [
        {
            digest: 0xAAAA,
            start_ms: T0,
            end_ms: T0 + 1,
            count: 3,
            total: 3,
            q16: 65536,
        },
        {
            digest: 0xBBBB,
            start_ms: T0 + 2,
            end_ms: T0 + 2,
            count: 1,
            total: 2,
            q16: 32768,
        },
    ]);
    assertEquals(c.final_consensus_digest, 0xBBBB);
});

Deno.test("replay digest digest forensic replay: reconstructs drift and failure windows", () => {
    const sink = new ForensicEventSink();
    append(sink, T0);
    append(sink, T0 + 10, { band: "drift", dissenter_count: 2 });
    append(sink, T0 + 20, { band: "drift", dissenter_count: 2 });
    append(sink, T0 + 30);
    append(sink, T0 + 40, { band: "blocked", local_claims_failed: 1 });
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink);
    assertEquals(c.error_windows.map((w) => ({
        kind: w.kind,
        message: w.message,
        start_ms: w.start_ms,
        end_ms: w.end_ms,
    })), [
        { kind: "drift", message: "2", start_ms: T0 + 10, end_ms: T0 + 20 },
        {
            kind: "local-claim-failed",
            message: "1",
            start_ms: T0 + 40,
            end_ms: null,
        },
    ]);
});

Deno.test("replay digest digest forensic replay: malformed windows are tracked", () => {
    const sink = new ForensicEventSink();
    append(sink, T0, { malformed_count: 3 });
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink);
    assertEquals(c.error_windows.map((w) => [w.kind, w.message]), [
        ["malformed", "3"],
    ]);
});

Deno.test("replay digest digest forensic replay: custom kind classifies alternate stream", () => {
    const sink = new ForensicEventSink();
    sink.append("tpdd", 1, payload({ band: "nominal" }), T0);
    sink.append("rddq", 2, payload({ band: "drift", dissenter_count: 1 }), T0 + 1);
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink, {
        kind: "rddq",
    });
    assertEquals(c.classified_events, 1);
    assertEquals(c.ignored_events, 1);
    assertEquals(c.final_band, "drift");
});

Deno.test("replay digest digest forensic replay: parser rejects malformed shapes", () => {
    assertEquals(
        parseTranslationPolicyReplayDigestDigestForensicPayload(payload()),
        payload(),
    );
    assertEquals(
        parseTranslationPolicyReplayDigestDigestForensicPayload({
            ...payload(),
            band: "weird",
        }),
        null,
    );
    assertEquals(
        parseTranslationPolicyReplayDigestDigestForensicPayload({
            ...payload(),
            consensus_digest: "x",
        }),
        null,
    );
});

Deno.test("replay digest digest forensic replay: first and last times follow classified events", () => {
    const sink = new ForensicEventSink();
    sink.append("noise", 1, payload(), T0 - 100);
    append(sink, T0 + 50);
    append(sink, T0 + 10);
    const c = classifyTranslationPolicyReplayDigestDigestForensicSink(sink);
    assertEquals(c.first_event_ms, T0 + 10);
    assertEquals(c.last_event_ms, T0 + 50);
});

Deno.test("replay digest digest forensic replay: schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_SCHEMA,
        "OMEGA-2000/v1",
    );
});

