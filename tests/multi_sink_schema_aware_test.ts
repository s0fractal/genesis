// Era 1610: Schema-aware multi-sink wiring tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    SCHEMA_AWARE_MULTI_SCHEMA,
    SchemaAwareMultiSinkInvestigator,
} from "../src/network/multi_sink_schema_aware.ts";
import { SchemaTranslator } from "../src/network/schema_translator.ts";
import { WarrantEmit } from "../src/network/auto_investigation_loop.ts";
import { WarrantProposalPayload } from "../src/network/quorum_warrant_bridge.ts";

const T0 = 1_000_000;

const TEST_OPTS = {
    quorum: { ttl_ms: 60_000, high_threshold: 3 },
    trigger: {
        min_band: "triple+" as const,
        per_peer_cooldown_ms: 5_000,
        min_dissent_duration_ms: 0,
    },
    bridge: { dedup_window_ms: 5_000 },
};

const passthroughTranslator: SchemaTranslator = (event) => event;

function makeInvestigator() {
    const emitted: Array<WarrantProposalPayload & { sink_id?: string }> = [];
    const emit: WarrantEmit = (p) => {
        emitted.push(p as WarrantProposalPayload & { sink_id?: string });
        return true;
    };
    return { investigator: new SchemaAwareMultiSinkInvestigator(emit), emitted };
}

// --- Sink registration ---

Deno.test("aware-multi: addSink registers with schema", () => {
    const { investigator } = makeInvestigator();
    const schema = investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    assertEquals(schema.name, "alarms");
    assertEquals(schema.major, 1);
    assertEquals(schema.minor, 0);
    assertEquals(investigator.schemaOf("alpha"), schema);
});

Deno.test("aware-multi: addSink throws on malformed schema", () => {
    const { investigator } = makeInvestigator();
    assertThrows(() => investigator.addSink("alpha", "garbage", TEST_OPTS));
    // Registry not polluted by failed registration.
    assertEquals(investigator.schemaOf("alpha"), undefined);
});

Deno.test("aware-multi: addSink throws on duplicate id", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    assertThrows(() => investigator.addSink("alpha", "alarms:v2.0", TEST_OPTS));
});

Deno.test("aware-multi: removeSink drops registry + multi state", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    investigator.removeSink("alpha");
    assertEquals(investigator.schemaOf("alpha"), undefined);
    assertEquals(investigator.multi.sinkCount(), 0);
});

// --- Schema-validated observation ---

Deno.test("observe: compatible schema accepted", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v1.5");
    assertEquals(r.ok, true);
});

Deno.test("observe: name mismatch rejected with typed reason", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "metrics:v1.0");
    assertEquals(r.ok, false);
    if (!r.ok) {
        assertEquals(r.reason, "name-mismatch");
        if (r.reason === "name-mismatch") {
            assertEquals(r.sender, "metrics");
            assertEquals(r.local, "alarms");
        }
    }
});

Deno.test("observe: major mismatch rejected with typed reason", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v2.0");
    assertEquals(r.ok, false);
    if (!r.ok && r.reason === "major-mismatch") {
        assertEquals(r.sender, "alarms:v2.0");
        assertEquals(r.local, "alarms:v1.0");
    }
});

Deno.test("observe: malformed peer schema rejected", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "garbage");
    assertEquals(r.ok, false);
    if (!r.ok && r.reason === "sender-schema-malformed") {
        assertEquals(r.got, "garbage");
    }
});

Deno.test("observe: unknown sink rejected", () => {
    const { investigator } = makeInvestigator();
    const r = investigator.observePeerAnchor("nope", 0xAA, 0x100, T0, "alarms:v1.0");
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.reason, "unknown-sink");
});

Deno.test("observe: omitting peer schema bypasses validation (legacy compat)", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    // No peer_schema_string provided — observation forwards.
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0);
    assertEquals(r.ok, true);
});

// --- Telemetry ---

Deno.test("rejection counters increment per category", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    investigator.observePeerAnchor("nope", 0xAA, 0x100, T0, "alarms:v1.0");
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "metrics:v1.0");
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v2.0");
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "garbage");
    const counts = investigator.summary(T0).rejection_counts;
    assertEquals(counts.unknown_sink, 1);
    assertEquals(counts.name_mismatch, 1);
    assertEquals(counts.major_mismatch, 1);
    assertEquals(counts.sender_schema_malformed, 1);
});

Deno.test("summary: aggregated per-sink + per-schema info", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    investigator.addSink("beta", "alarms:v1.5", TEST_OPTS);
    investigator.addSink("gamma", "metrics:v1.0", TEST_OPTS);
    const s = investigator.summary(T0);
    assertEquals(s.sink_count, 3);
    assertEquals(s.sink_ids.sort(), ["alpha", "beta", "gamma"]);
    assertEquals(s.per_sink.length, 3);
    assertEquals(s.per_schema_counts.length, 3);
    assertEquals(s.rejection_counts.unknown_sink, 0);
});

// --- Discovery helpers ---

Deno.test("sinksByName: returns sorted ids matching domain", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("zulu", "alarms:v1.0", TEST_OPTS);
    investigator.addSink("alpha", "alarms:v2.0", TEST_OPTS);
    investigator.addSink("mike", "metrics:v1.0", TEST_OPTS);
    assertEquals(investigator.sinksByName("alarms"), ["alpha", "zulu"]);
    assertEquals(investigator.sinksByName("metrics"), ["mike"]);
});

Deno.test("compatibleSinks: filters by name + major", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("a", "alarms:v1.0", TEST_OPTS);
    investigator.addSink("b", "alarms:v1.5", TEST_OPTS);
    investigator.addSink("c", "alarms:v2.0", TEST_OPTS);
    investigator.addSink("d", "metrics:v1.0", TEST_OPTS);
    const compat = investigator.compatibleSinks(
        // alarms:v1.x compatibles
        { name: "alarms", major: 1, minor: 3 },
    );
    assertEquals(compat, ["a", "b"]);
});

Deno.test("translatableSinks: returns registered migration targets only", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("a", "alarms:v1.0", TEST_OPTS);
    investigator.addSink("b", "alarms:v2.0", TEST_OPTS);
    investigator.addSink("c", "alarms:v3.0", TEST_OPTS);
    investigator.addSink("d", "metrics:v1.0", TEST_OPTS);
    investigator.registerTranslator("alarms:v2.0", "alarms:v1.0", passthroughTranslator);
    investigator.registerTranslator("alarms:v2.0", "alarms:v3.0", passthroughTranslator);
    assertEquals(
        investigator.translatableSinks({ name: "alarms", major: 2, minor: 7 }),
        ["a", "c"],
    );
});

Deno.test("compatibleOrTranslatableSinks: merges direct + migration fanout", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("a", "alarms:v1.0", TEST_OPTS);
    investigator.addSink("b", "alarms:v2.0", TEST_OPTS);
    investigator.addSink("c", "alarms:v2.5", TEST_OPTS);
    investigator.registerTranslator("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    assertEquals(
        investigator.compatibleOrTranslatableSinks({ name: "alarms", major: 1, minor: 8 }),
        ["a", "b", "c"],
    );
});

Deno.test("observe: major mismatch accepted when translator registered", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    investigator.registerTranslator("alarms:v2.0", "alarms:v1.0", passthroughTranslator);
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v2.0");
    assertEquals(r.ok, true);
    if (r.ok) assertEquals(r.translated_schema, true);
    const summary = investigator.summary(T0);
    assertEquals(summary.rejection_counts.major_mismatch, 0);
    assertEquals(summary.translation_counts.translatable_observations, 1);
    assertEquals(summary.translation_counts.per_sink, [{
        sink_id: "alpha",
        translated_count: 0,
        dropped_count: 0,
        translatable_observations: 1,
    }]);
});

Deno.test("observe: major mismatch still rejected without translator", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    investigator.registerTranslator("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    const r = investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v2.0");
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.reason, "major-mismatch");
});

Deno.test("translation telemetry: record apply counts per sink", () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    assertEquals(investigator.recordTranslationApply("missing", 1, 2), false);
    assertEquals(investigator.recordTranslationApply("alpha", 3, 1), true);
    assertEquals(investigator.recordTranslationApply("alpha", 2, 4), true);
    const counts = investigator.summary(T0).translation_counts;
    assertEquals(counts.translated_count, 5);
    assertEquals(counts.dropped_count, 5);
    assertEquals(counts.per_sink, [{
        sink_id: "alpha",
        translated_count: 5,
        dropped_count: 5,
        translatable_observations: 0,
    }]);
});

Deno.test("summary: exposes registered translator pairs", () => {
    const { investigator } = makeInvestigator();
    investigator.registerTranslator("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    investigator.registerTranslator("metrics:v1.0", "metrics:v2.0", passthroughTranslator);
    assertEquals(investigator.summary(T0).translation_counts.registered_pairs, [
        { source: "alarms:v1", target: "alarms:v2" },
        { source: "metrics:v1", target: "metrics:v2" },
    ]);
});

// --- End-to-end ---

Deno.test("end-to-end: incompatible peer can't influence dissenter count", () => {
    const { investigator, emitted } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    // 3 healthy peers + 1 dissenter on the wrong domain.
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v1.0");
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0, "alarms:v1.0");
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0, "alarms:v1.0");
    // 0xFF tries to dissent but announces "metrics:v1.0" — rejected.
    const r = investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0, "metrics:v1.0");
    assertEquals(r.ok, false);
    investigator.tickAll(T0);
    assertEquals(emitted.length, 0); // no warrant fired
});

Deno.test("end-to-end: minor version drift accepted, major rejected", () => {
    const { investigator, emitted } = makeInvestigator();
    investigator.addSink("alpha", "alarms:v1.0", TEST_OPTS);
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0, "alarms:v1.0");
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0, "alarms:v1.5"); // ok
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0, "alarms:v1.7"); // ok
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0, "alarms:v2.0"); // rejected
    investigator.tickAll(T0);
    // Three peers agree, no dissenter (0xFF was rejected).
    assertEquals(emitted.length, 0);
    const tele = investigator.summary(T0);
    assertEquals(tele.rejection_counts.major_mismatch, 1);
});

Deno.test("schema constant", () => {
    assertEquals(SCHEMA_AWARE_MULTI_SCHEMA, "OMEGA-1610/v1");
});
