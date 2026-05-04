// Era 1840: Translation policy forensic replay classifier tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEventSink } from "../../src/network/forensic_event_sink.ts";
import {
    classifyTranslationPolicyForensicEvents,
    classifyTranslationPolicyForensicSink,
    parseTranslationPolicyForensicPayload,
    TRANSLATION_POLICY_FORENSIC_REPLAY_SCHEMA,
} from "../../src/network/translation_policy/translation_policy_forensic_replay.ts";
import {
    TRANSLATION_POLICY_FORENSIC_EVENT_ADAPTER_SCHEMA,
    TranslationPolicyForensicBand,
    TranslationPolicyForensicPayload,
} from "../../src/network/translation_policy/translation_policy_forensic_event_adapter.ts";
import {
    TRANSLATION_POLICY_TELEMETRY_EVENT_SCHEMA,
} from "../../src/bootstrap/translation_policy/translation_policy_telemetry_event.ts";

const T0 = 1_000_000;

function payload(overrides: Partial<TranslationPolicyForensicPayload> = {}):
    TranslationPolicyForensicPayload {
    return {
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
        local_policy_hash: 0xAAAA,
        local_pair_count: 1,
        peer_count: 1,
        due_peer_count: 0,
        drift_peer_count: 0,
        monitor_alarm_count: 0,
        proposals_emitted: 0,
        proposals_failed: 0,
        malformed_count: 0,
        ...overrides,
    };
}

function append(
    sink: ForensicEventSink,
    t: number,
    band: TranslationPolicyForensicBand,
    overrides: Partial<TranslationPolicyForensicPayload> = {},
): void {
    sink.append(
        "tpol",
        (0x1000 + sink.size()) >>> 0,
        payload({ band, ...overrides }),
        t,
    );
}

Deno.test("forensic replay: empty input has stable null summary", async () => {
    const classified = classifyTranslationPolicyForensicEvents([]);
    assertEquals(classified.schema, TRANSLATION_POLICY_FORENSIC_REPLAY_SCHEMA);
    assertEquals(classified.total_events, 0);
    assertEquals(classified.classified_events, 0);
    assertEquals(classified.final_band, null);
    assertEquals(classified.final_policy_hash, null);
    assertEquals(classified.band_timeline, []);
    assertEquals(classified.policy_hash_intervals, []);
    assertEquals(classified.error_windows, []);
});

Deno.test("forensic replay: ignores non-tpol and counts malformed payloads", async () => {
    const sink = new ForensicEventSink();
    sink.append("alrm", 0x01, payload(), T0);
    sink.append("tpol", 0x02, { schema: "wrong" }, T0 + 1);
    append(sink, T0 + 2, "nominal");
    const classified = classifyTranslationPolicyForensicSink(sink);
    assertEquals(classified.total_events, 3);
    assertEquals(classified.ignored_events, 1);
    assertEquals(classified.malformed_payloads, 1);
    assertEquals(classified.classified_events, 1);
});

Deno.test("forensic replay: builds deterministic band timeline", async () => {
    const sink = new ForensicEventSink();
    append(sink, T0 + 20, "drift");
    append(sink, T0 + 0, "nominal");
    append(sink, T0 + 10, "nominal");
    append(sink, T0 + 30, "blocked");
    const classified = classifyTranslationPolicyForensicSink(sink);
    assertEquals(classified.band_timeline.map((s) => ({
        band: s.band,
        start_ms: s.start_ms,
        end_ms: s.end_ms,
    })), [
        { band: "nominal", start_ms: T0, end_ms: T0 + 10 },
        { band: "drift", start_ms: T0 + 20, end_ms: T0 + 20 },
        { band: "blocked", start_ms: T0 + 30, end_ms: T0 + 30 },
    ]);
    assertEquals(classified.final_band, "blocked");
});

Deno.test("forensic replay: builds policy hash intervals", async () => {
    const sink = new ForensicEventSink();
    append(sink, T0, "nominal", { local_policy_hash: 0xAAAA, local_pair_count: 1 });
    append(sink, T0 + 1, "nominal", { local_policy_hash: 0xAAAA, local_pair_count: 1 });
    append(sink, T0 + 2, "nominal", { local_policy_hash: 0xBBBB, local_pair_count: 2 });
    const classified = classifyTranslationPolicyForensicSink(sink);
    assertEquals(classified.policy_hash_intervals.map((i) => ({
        hash: i.local_policy_hash,
        start_ms: i.start_ms,
        end_ms: i.end_ms,
        pairs: i.local_pair_count,
    })), [
        { hash: 0xAAAA, start_ms: T0, end_ms: T0 + 1, pairs: 1 },
        { hash: 0xBBBB, start_ms: T0 + 2, end_ms: T0 + 2, pairs: 2 },
    ]);
    assertEquals(classified.final_policy_hash, 0xBBBB);
});

Deno.test("forensic replay: reconstructs closed and open error windows", async () => {
    const sink = new ForensicEventSink();
    append(sink, T0, "nominal");
    append(sink, T0 + 10, "tick-error", { tick_error: "boom" });
    append(sink, T0 + 20, "tick-error", { tick_error: "boom" });
    append(sink, T0 + 30, "nominal");
    append(sink, T0 + 40, "blocked", { proposals_failed: 2 });
    const classified = classifyTranslationPolicyForensicSink(sink);
    assertEquals(classified.error_windows.map((w) => ({
        kind: w.kind,
        message: w.message,
        start_ms: w.start_ms,
        end_ms: w.end_ms,
    })), [
        { kind: "tick-error", message: "boom", start_ms: T0 + 10, end_ms: T0 + 20 },
        { kind: "proposal-failed", message: "2", start_ms: T0 + 40, end_ms: null },
    ]);
});

Deno.test("forensic replay: separates error windows when message changes", async () => {
    const sink = new ForensicEventSink();
    append(sink, T0, "tick-error", { tick_error: "a" });
    append(sink, T0 + 1, "tick-error", { tick_error: "b" });
    const classified = classifyTranslationPolicyForensicSink(sink);
    assertEquals(classified.error_windows.map((w) => ({
        message: w.message,
        start_ms: w.start_ms,
        end_ms: w.end_ms,
    })), [
        { message: "a", start_ms: T0, end_ms: T0 },
        { message: "b", start_ms: T0 + 1, end_ms: null },
    ]);
});

Deno.test("forensic replay: multiple simultaneous error kinds are tracked", async () => {
    const sink = new ForensicEventSink();
    append(sink, T0, "install-error", {
        install_error: "bad config",
        malformed_count: 3,
    });
    const classified = classifyTranslationPolicyForensicSink(sink);
    assertEquals(classified.error_windows.map((w) => [w.kind, w.message]), [
        ["install-error", "bad config"],
        ["malformed", "3"],
    ]);
});

Deno.test("forensic replay: custom kind option classifies alternate stream", async () => {
    const sink = new ForensicEventSink();
    sink.append("tpol", 0x01, payload({ band: "nominal" }), T0);
    sink.append("tpfx", 0x02, payload({ band: "drift" }), T0 + 1);
    const classified = classifyTranslationPolicyForensicSink(sink, { kind: "tpfx" });
    assertEquals(classified.classified_events, 1);
    assertEquals(classified.ignored_events, 1);
    assertEquals(classified.final_band, "drift");
});

Deno.test("forensic replay: payload parser rejects malformed shapes", async () => {
    assertEquals(parseTranslationPolicyForensicPayload(payload()), payload());
    assertEquals(parseTranslationPolicyForensicPayload({ ...payload(), band: "weird" }), null);
    assertEquals(
        parseTranslationPolicyForensicPayload({ ...payload(), local_policy_hash: "x" }),
        null,
    );
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_FORENSIC_REPLAY_SCHEMA, "OMEGA-1840/v1");
});
