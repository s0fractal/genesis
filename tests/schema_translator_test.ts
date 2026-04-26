// Era 1620: Cross-domain translation bridge tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    SchemaTranslator,
    SchemaTranslatorRegistry,
    TRANSLATOR_SCHEMA,
    translateBatch,
} from "../src/network/schema_translator.ts";
import { ForensicEvent } from "../src/network/forensic_event_sink.ts";
import { parseSinkSchema } from "../src/network/forensic_sink_schema.ts";

const T0 = 1_000_000;
const ALARMS_V1 = parseSinkSchema("alarms:v1.0")!;
const ALARMS_V1_5 = parseSinkSchema("alarms:v1.5")!;
const ALARMS_V2 = parseSinkSchema("alarms:v2.0")!;
const ALARMS_V3 = parseSinkSchema("alarms:v3.0")!;
const METRICS_V1 = parseSinkSchema("metrics:v1.0")!;

function mkEvent(kind: string, hash: number, payload: unknown = null): ForensicEvent {
    return {
        schema: "OMEGA-1380/v1",
        kind,
        event_hash: hash,
        sunk_at_ms: T0,
        sequence: 0,
        prev_chain_hash: 0,
        chain_hash: 0xCAFE,
        payload,
    };
}

const passthroughTranslator: SchemaTranslator = (event) => event;

const upgradeTranslator: SchemaTranslator = (event, source, target) => {
    return { ...event, payload: { upgraded_from: `${source.name}:v${source.major}`, target: `${target.name}:v${target.major}`, original: event.payload } };
};

// --- Registration ---

Deno.test("register: basic pair", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    assertEquals(r.size(), 1);
});

Deno.test("register: malformed source throws", () => {
    const r = new SchemaTranslatorRegistry();
    assertThrows(() => r.register("garbage", "alarms:v2.0", passthroughTranslator));
});

Deno.test("register: malformed target throws", () => {
    const r = new SchemaTranslatorRegistry();
    assertThrows(() => r.register("alarms:v1.0", "garbage", passthroughTranslator));
});

Deno.test("register: identical compatible pair throws", () => {
    const r = new SchemaTranslatorRegistry();
    assertThrows(() => r.register("alarms:v1.0", "alarms:v1.5", passthroughTranslator));
});

Deno.test("register: duplicate pair throws", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    assertThrows(() => r.register("alarms:v1.0", "alarms:v2.0", passthroughTranslator));
});

Deno.test("unregister: removes specific pair", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    r.register("alarms:v1.0", "alarms:v3.0", passthroughTranslator);
    r.unregister(ALARMS_V1, ALARMS_V2);
    assertEquals(r.size(), 1);
    assertEquals(r.canTranslate(ALARMS_V1, ALARMS_V2), false);
    assertEquals(r.canTranslate(ALARMS_V1, ALARMS_V3), true);
});

// --- Lookup ---

Deno.test("lookup: returns registered translator", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", upgradeTranslator);
    const fn = r.lookup(ALARMS_V1, ALARMS_V2);
    assert(fn !== null);
});

Deno.test("lookup: returns null when missing", () => {
    const r = new SchemaTranslatorRegistry();
    assertEquals(r.lookup(ALARMS_V1, ALARMS_V2), null);
});

Deno.test("lookup: minor versions of same major share key", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", upgradeTranslator);
    // Looking up ALARMS_V1_5 → ALARMS_V2 should find the same translator.
    assert(r.lookup(ALARMS_V1_5, ALARMS_V2) !== null);
});

Deno.test("canTranslate: predicate", () => {
    const r = new SchemaTranslatorRegistry();
    assertEquals(r.canTranslate(ALARMS_V1, ALARMS_V2), false);
    r.register("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    assertEquals(r.canTranslate(ALARMS_V1, ALARMS_V2), true);
});

// --- Translate ---

Deno.test("translate: identity for compatible pair", () => {
    const r = new SchemaTranslatorRegistry();
    const e = mkEvent("alrm", 0x42);
    const out = r.translate(e, ALARMS_V1, ALARMS_V1_5);
    assertEquals(out, e);
});

Deno.test("translate: applies registered translator", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", upgradeTranslator);
    const e = mkEvent("alrm", 0x42, { foo: "bar" });
    const out = r.translate(e, ALARMS_V1, ALARMS_V2);
    assert(out !== null);
    const payload = out!.payload as { upgraded_from: string; target: string; original: unknown };
    assertEquals(payload.upgraded_from, "alarms:v1");
    assertEquals(payload.target, "alarms:v2");
    assertEquals(payload.original, { foo: "bar" });
});

Deno.test("translate: returns null when no translator registered", () => {
    const r = new SchemaTranslatorRegistry();
    const e = mkEvent("alrm", 0x42);
    assertEquals(r.translate(e, ALARMS_V1, ALARMS_V2), null);
});

Deno.test("translate: forwards translator's null (drop) signal", () => {
    const r = new SchemaTranslatorRegistry();
    const dropAll: SchemaTranslator = () => null;
    r.register("alarms:v1.0", "alarms:v2.0", dropAll);
    const e = mkEvent("alrm", 0x42);
    assertEquals(r.translate(e, ALARMS_V1, ALARMS_V2), null);
});

// --- Listing ---

Deno.test("listPairs: sorted by source then target", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v3.0", passthroughTranslator);
    r.register("alarms:v1.0", "alarms:v2.0", passthroughTranslator);
    r.register("metrics:v1.0", "metrics:v2.0", passthroughTranslator);
    const pairs = r.listPairs();
    assertEquals(pairs, [
        { source: "alarms:v1", target: "alarms:v2" },
        { source: "alarms:v1", target: "alarms:v3" },
        { source: "metrics:v1", target: "metrics:v2" },
    ]);
});

// --- translateBatch ---

Deno.test("translateBatch: identity on compatible pair", () => {
    const r = new SchemaTranslatorRegistry();
    const events = [mkEvent("a", 0x10), mkEvent("a", 0x20)];
    const out = translateBatch(events, ALARMS_V1, ALARMS_V1_5, r);
    assert(out !== null);
    assertEquals(out!.translated.length, 2);
    assertEquals(out!.dropped, 0);
});

Deno.test("translateBatch: applies registered translator", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", upgradeTranslator);
    const events = [mkEvent("a", 0x10), mkEvent("a", 0x20)];
    const out = translateBatch(events, ALARMS_V1, ALARMS_V2, r);
    assert(out !== null);
    assertEquals(out!.translated.length, 2);
    assertEquals(out!.dropped, 0);
});

Deno.test("translateBatch: returns null when no translator", () => {
    const r = new SchemaTranslatorRegistry();
    const events = [mkEvent("a", 0x10)];
    assertEquals(translateBatch(events, ALARMS_V1, ALARMS_V2, r), null);
});

Deno.test("translateBatch: cross-domain (different name) refused without translator", () => {
    const r = new SchemaTranslatorRegistry();
    const events = [mkEvent("a", 0x10)];
    assertEquals(translateBatch(events, ALARMS_V1, METRICS_V1, r), null);
});

Deno.test("translateBatch: cross-domain WITH translator allowed", () => {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "metrics:v1.0", upgradeTranslator);
    const events = [mkEvent("a", 0x10), mkEvent("a", 0x20)];
    const out = translateBatch(events, ALARMS_V1, METRICS_V1, r);
    assert(out !== null);
    assertEquals(out!.translated.length, 2);
});

Deno.test("translateBatch: counts dropped events", () => {
    const r = new SchemaTranslatorRegistry();
    let counter = 0;
    const halfDrop: SchemaTranslator = (event) => {
        counter++;
        return counter % 2 === 0 ? null : event;
    };
    r.register("alarms:v1.0", "alarms:v2.0", halfDrop);
    const events = [mkEvent("a", 0x10), mkEvent("a", 0x20), mkEvent("a", 0x30), mkEvent("a", 0x40)];
    const out = translateBatch(events, ALARMS_V1, ALARMS_V2, r);
    assert(out !== null);
    assertEquals(out!.translated.length, 2);
    assertEquals(out!.dropped, 2);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATOR_SCHEMA, "OMEGA-1620/v1");
});
