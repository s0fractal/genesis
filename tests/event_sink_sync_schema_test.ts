// Era 1600: Schema-validated cross-sink sync tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    SCHEMA_SYNC_SCHEMA,
    SchemaAwareSinkSync,
    SchemaTaggedDelta,
    applyEventDeltaWithSchema,
    buildSchemaTaggedDelta,
    buildSchemaTaggedHashList,
    validateSchemaCompatibility,
} from "../src/network/event_sink_sync_schema.ts";
import { ForensicEventSink } from "../src/network/forensic_event_sink.ts";
import {
    buildEventHashList,
    computeEventDelta,
} from "../src/network/event_sink_sync.ts";
import { parseSinkSchema } from "../src/network/forensic_sink_schema.ts";

const T0 = 1_000_000;

const ALARMS_V1 = parseSinkSchema("alarms:v1.0")!;
const ALARMS_V1_5 = parseSinkSchema("alarms:v1.5")!;
const ALARMS_V2 = parseSinkSchema("alarms:v2.0")!;
const METRICS_V1 = parseSinkSchema("metrics:v1.0")!;

function makeSink(events: Array<{ kind: string; hash: number }>): ForensicEventSink {
    const s = new ForensicEventSink();
    for (const e of events) s.append(e.kind, e.hash, null, T0);
    return s;
}

// --- buildSchemaTaggedDelta + buildSchemaTaggedHashList ---

Deno.test("buildSchemaTaggedDelta: wraps + tags with sender schema string", () => {
    const sinkA = makeSink([{ kind: "alrm", hash: 0x10 }]);
    const sinkB = makeSink([{ kind: "alrm", hash: 0x10 }, { kind: "alrm", hash: 0x20 }]);
    const list = buildEventHashList(sinkA, T0);
    const delta = computeEventDelta(list, sinkB.list(), T0);
    const tagged = buildSchemaTaggedDelta(delta, ALARMS_V1);
    assertEquals(tagged.schema, SCHEMA_SYNC_SCHEMA);
    assertEquals(tagged.sender_sink_schema, "alarms:v1.0");
    assertEquals(tagged.delta, delta);
});

Deno.test("buildSchemaTaggedHashList: includes sender schema", () => {
    const sink = makeSink([]);
    const tagged = buildSchemaTaggedHashList(buildEventHashList(sink, T0), ALARMS_V1);
    assertEquals(tagged.sender_sink_schema, "alarms:v1.0");
    assertEquals(tagged.schema, SCHEMA_SYNC_SCHEMA);
});

// --- applyEventDeltaWithSchema ---

Deno.test("apply: same major → success delegates to Era 1390", () => {
    const localSink = makeSink([{ kind: "alrm", hash: 0x10 }]);
    const senderSink = makeSink([{ kind: "alrm", hash: 0x10 }, { kind: "alrm", hash: 0x20 }]);
    const localList = buildEventHashList(localSink, T0);
    const delta = computeEventDelta(localList, senderSink.list(), T0);
    const tagged = buildSchemaTaggedDelta(delta, ALARMS_V1_5);
    const out = applyEventDeltaWithSchema(localSink, ALARMS_V1, tagged, T0 + 100);
    assert(out.ok);
    if (out.ok) {
        assertEquals(out.added_count, 1);
    }
    assertEquals(localSink.size(), 2);
});

Deno.test("apply: name mismatch → name-mismatch rejection", () => {
    const localSink = makeSink([]);
    const senderSink = makeSink([{ kind: "vrdt", hash: 0x42 }]);
    const tagged = buildSchemaTaggedDelta(
        computeEventDelta(buildEventHashList(localSink, T0), senderSink.list(), T0),
        METRICS_V1,
    );
    const out = applyEventDeltaWithSchema(localSink, ALARMS_V1, tagged, T0);
    assertEquals(out.ok, false);
    if (!out.ok) {
        assertEquals(out.reason, "name-mismatch");
        if (out.reason === "name-mismatch") {
            assertEquals(out.sender, "metrics");
            assertEquals(out.local, "alarms");
        }
    }
    assertEquals(localSink.size(), 0);
});

Deno.test("apply: major mismatch → major-mismatch rejection", () => {
    const localSink = makeSink([]);
    const senderSink = makeSink([{ kind: "alrm", hash: 0x42 }]);
    const tagged = buildSchemaTaggedDelta(
        computeEventDelta(buildEventHashList(localSink, T0), senderSink.list(), T0),
        ALARMS_V2,
    );
    const out = applyEventDeltaWithSchema(localSink, ALARMS_V1, tagged, T0);
    assertEquals(out.ok, false);
    if (!out.ok && out.reason === "major-mismatch") {
        assertEquals(out.sender, "alarms:v2.0");
        assertEquals(out.local, "alarms:v1.0");
    }
});

Deno.test("apply: malformed sender schema → sender-schema-malformed", () => {
    const localSink = makeSink([]);
    const tagged: SchemaTaggedDelta = {
        schema: SCHEMA_SYNC_SCHEMA,
        sender_sink_schema: "not-a-schema",
        delta: {
            schema: "OMEGA-1390/v1",
            initiator_anchor: 0,
            missing_entries: [],
            peer_missing_hashes: [],
            delta_hash: 0x811C_9DC5,
            replied_at_ms: T0,
        },
    };
    const out = applyEventDeltaWithSchema(localSink, ALARMS_V1, tagged, T0);
    assertEquals(out.ok, false);
    if (!out.ok) assertEquals(out.reason, "sender-schema-malformed");
});

Deno.test("apply: wrapper-schema-mismatch when wrapper schema wrong", () => {
    const localSink = makeSink([]);
    const tagged: SchemaTaggedDelta = {
        schema: "OMEGA-9999/v1",
        sender_sink_schema: "alarms:v1.0",
        delta: {
            schema: "OMEGA-1390/v1",
            initiator_anchor: 0,
            missing_entries: [],
            peer_missing_hashes: [],
            delta_hash: 0x811C_9DC5,
            replied_at_ms: T0,
        },
    };
    const out = applyEventDeltaWithSchema(localSink, ALARMS_V1, tagged, T0);
    assertEquals(out.ok, false);
    if (!out.ok) assertEquals(out.reason, "wrapper-schema-mismatch");
});

Deno.test("apply: underlying Era 1390 collision surfaces as apply-failed", () => {
    const localSink = makeSink([{ kind: "alrm", hash: 0x42 }]);
    const senderSink = makeSink([{ kind: "vrdt", hash: 0x42 }]); // same hash, different kind
    // Need to build a delta that includes the colliding entry.
    const emptyList = buildEventHashList(makeSink([]), T0);
    const delta = computeEventDelta(emptyList, senderSink.list(), T0);
    const tagged = buildSchemaTaggedDelta(delta, ALARMS_V1);
    const out = applyEventDeltaWithSchema(localSink, ALARMS_V1, tagged, T0);
    assertEquals(out.ok, false);
    if (!out.ok && out.reason === "apply-failed") {
        assert(out.underlying.includes("collision"));
    }
});

// --- validateSchemaCompatibility ---

Deno.test("validate: compatible schemas → ok", () => {
    const out = validateSchemaCompatibility(ALARMS_V1, "alarms:v1.5");
    assertEquals(out.ok, true);
});

Deno.test("validate: incompatible major → major-mismatch", () => {
    const out = validateSchemaCompatibility(ALARMS_V1, "alarms:v2.0");
    assertEquals(out.ok, false);
    if (!out.ok) assertEquals(out.reason, "major-mismatch");
});

Deno.test("validate: malformed sender → sender-schema-malformed", () => {
    const out = validateSchemaCompatibility(ALARMS_V1, "garbage");
    assertEquals(out.ok, false);
    if (!out.ok) assertEquals(out.reason, "sender-schema-malformed");
});

// --- SchemaAwareSinkSync ---

Deno.test("aware: build HASH_LIST tagged with own schema", () => {
    const sink = makeSink([{ kind: "alrm", hash: 0x10 }]);
    const aware = new SchemaAwareSinkSync(sink, ALARMS_V1);
    const list = aware.buildHashList(T0);
    assertEquals(list.sender_sink_schema, "alarms:v1.0");
    assertEquals(list.list.event_hashes.length, 1);
});

Deno.test("aware: computeDeltaForPeer with compatible schema returns delta", () => {
    const localSink = makeSink([{ kind: "alrm", hash: 0x10 }]);
    const peerSink = makeSink([]);
    const aware = new SchemaAwareSinkSync(localSink, ALARMS_V1);
    const peerAware = new SchemaAwareSinkSync(peerSink, ALARMS_V1_5);
    const peerList = peerAware.buildHashList(T0);
    const delta = aware.computeDeltaForPeer(peerList, T0);
    assert(delta !== null);
    assertEquals(delta!.delta.missing_entries.length, 1);
});

Deno.test("aware: computeDeltaForPeer with incompatible schema returns null", () => {
    const localSink = makeSink([]);
    const peerSink = makeSink([]);
    const aware = new SchemaAwareSinkSync(localSink, ALARMS_V1);
    const peerAware = new SchemaAwareSinkSync(peerSink, METRICS_V1);
    const peerList = peerAware.buildHashList(T0);
    assertEquals(aware.computeDeltaForPeer(peerList, T0), null);
});

Deno.test("aware: computeDeltaForPeer rejects bad wrapper schema", () => {
    const localSink = makeSink([]);
    const aware = new SchemaAwareSinkSync(localSink, ALARMS_V1);
    const bogus = {
        schema: "OMEGA-9999/v1",
        sender_sink_schema: "alarms:v1.0",
        list: { schema: "OMEGA-1390/v1", event_hashes: [], hash_set_anchor: 0, broadcast_at_ms: T0 },
    };
    assertEquals(aware.computeDeltaForPeer(bogus as any, T0), null);
});

Deno.test("aware: apply same-major delta succeeds", () => {
    const localSink = makeSink([{ kind: "alrm", hash: 0x10 }]);
    const peerSink = makeSink([{ kind: "alrm", hash: 0x20 }]);
    const aware = new SchemaAwareSinkSync(localSink, ALARMS_V1);
    const peerAware = new SchemaAwareSinkSync(peerSink, ALARMS_V1_5);
    const list = aware.buildHashList(T0);
    const delta = peerAware.computeDeltaForPeer(list, T0);
    const result = aware.apply(delta!, T0 + 100);
    assert(result.ok);
    if (result.ok) assertEquals(result.added_count, 1);
});

Deno.test("aware: apply major-mismatch delta refuses", () => {
    const localSink = makeSink([]);
    const aware = new SchemaAwareSinkSync(localSink, ALARMS_V1);
    const tagged = buildSchemaTaggedDelta(
        computeEventDelta(buildEventHashList(localSink, T0), [], T0),
        ALARMS_V2,
    );
    const result = aware.apply(tagged, T0 + 100);
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.reason, "major-mismatch");
});

Deno.test("aware: underlyingSyncSchema reports Era 1390 string", () => {
    const aware = new SchemaAwareSinkSync(makeSink([]), ALARMS_V1);
    assertEquals(aware.underlyingSyncSchema(), "OMEGA-1390/v1");
});

Deno.test("end-to-end: same-schema sinks converge through aware path", () => {
    const sinkA = makeSink([{ kind: "alrm", hash: 0x10 }, { kind: "alrm", hash: 0x20 }]);
    const sinkB = makeSink([{ kind: "alrm", hash: 0x20 }, { kind: "alrm", hash: 0x30 }]);
    const aA = new SchemaAwareSinkSync(sinkA, ALARMS_V1);
    const aB = new SchemaAwareSinkSync(sinkB, ALARMS_V1);
    // B announces; A computes delta for B.
    const listB = aB.buildHashList(T0);
    const deltaForB = aA.computeDeltaForPeer(listB, T0);
    aB.apply(deltaForB!, T0);
    // A announces; B computes delta for A.
    const listA = aA.buildHashList(T0 + 100);
    const deltaForA = aB.computeDeltaForPeer(listA, T0 + 100);
    aA.apply(deltaForA!, T0 + 200);
    assertEquals(sinkA.eventChainAnchor(), sinkB.eventChainAnchor());
    assertEquals(sinkA.size(), 3);
    assertEquals(sinkB.size(), 3);
});

Deno.test("schema constant", () => {
    assertEquals(SCHEMA_SYNC_SCHEMA, "OMEGA-1600/v1");
});
