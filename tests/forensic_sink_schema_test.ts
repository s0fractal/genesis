// Era 1590: Forensic sink schema versioning tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    SINK_SCHEMA_VERSION,
    SinkSchemaRegistry,
    compatibleSchemaStrings,
    compatibleSchemas,
    formatSinkSchema,
    isValidSinkSchemaString,
    parseSinkSchema,
    sameSinkSchema,
} from "../src/network/forensic_sink_schema.ts";

// --- Parsing ---

Deno.test("parse: valid schema strings", async () => {
    assertEquals(parseSinkSchema("financial-events:v1.0"), {
        name: "financial-events", major: 1, minor: 0,
    });
    assertEquals(parseSinkSchema("alarms:v2.5"), {
        name: "alarms", major: 2, minor: 5,
    });
    assertEquals(parseSinkSchema("a:v0.0"), {
        name: "a", major: 0, minor: 0,
    });
});

Deno.test("parse: rejects malformed strings", async () => {
    assertEquals(parseSinkSchema(""), null);
    assertEquals(parseSinkSchema("no-version"), null);
    assertEquals(parseSinkSchema("name:v1"), null);          // missing minor
    assertEquals(parseSinkSchema("name:1.0"), null);         // missing 'v'
    assertEquals(parseSinkSchema("name:vbad.0"), null);      // non-numeric major
    assertEquals(parseSinkSchema("name:v1.bad"), null);      // non-numeric minor
    assertEquals(parseSinkSchema("name with spaces:v1.0"), null);
    assertEquals(parseSinkSchema("name@invalid:v1.0"), null);
});

Deno.test("parse: rejects names longer than 32 chars", async () => {
    assertEquals(parseSinkSchema("a".repeat(33) + ":v1.0"), null);
});

Deno.test("parse: accepts max-length name (32 chars)", async () => {
    const max = "a".repeat(32);
    assertEquals(parseSinkSchema(max + ":v1.0")?.name, max);
});

Deno.test("parse: non-string input", async () => {
    assertEquals(parseSinkSchema(null as any), null);
    assertEquals(parseSinkSchema(undefined as any), null);
    assertEquals(parseSinkSchema(123 as any), null);
});

// --- Formatting ---

Deno.test("format: roundtrip", async () => {
    const s = "alarms:v3.7";
    const parsed = parseSinkSchema(s)!;
    assertEquals(formatSinkSchema(parsed), s);
});

Deno.test("isValidSinkSchemaString: predicate", async () => {
    assertEquals(isValidSinkSchemaString("alarms:v1.0"), true);
    assertEquals(isValidSinkSchemaString("nope"), false);
});

// --- Compatibility ---

Deno.test("compatible: same name + same major → true", async () => {
    const a = parseSinkSchema("alarms:v1.0")!;
    const b = parseSinkSchema("alarms:v1.5")!;
    assertEquals(compatibleSchemas(a, b), true);
});

Deno.test("compatible: same name + different major → false", async () => {
    const a = parseSinkSchema("alarms:v1.5")!;
    const b = parseSinkSchema("alarms:v2.0")!;
    assertEquals(compatibleSchemas(a, b), false);
});

Deno.test("compatible: different name → false", async () => {
    const a = parseSinkSchema("alarms:v1.0")!;
    const b = parseSinkSchema("metrics:v1.0")!;
    assertEquals(compatibleSchemas(a, b), false);
});

Deno.test("compatibleSchemaStrings: convenience overload", async () => {
    assertEquals(compatibleSchemaStrings("alarms:v1.0", "alarms:v1.5"), true);
    assertEquals(compatibleSchemaStrings("alarms:v1.0", "alarms:v2.0"), false);
    assertEquals(compatibleSchemaStrings("alarms:v1.0", "metrics:v1.0"), false);
    assertEquals(compatibleSchemaStrings("invalid", "alarms:v1.0"), false);
});

Deno.test("sameSinkSchema: full equality", async () => {
    const a = parseSinkSchema("alarms:v1.5")!;
    const b = parseSinkSchema("alarms:v1.5")!;
    const c = parseSinkSchema("alarms:v1.6")!;
    assertEquals(sameSinkSchema(a, b), true);
    assertEquals(sameSinkSchema(a, c), false);
});

// --- Registry ---

Deno.test("registry: register + get", async () => {
    const r = new SinkSchemaRegistry();
    const schema = r.register("alpha", "alarms:v1.0");
    assertEquals(schema.name, "alarms");
    assertEquals(r.get("alpha"), { name: "alarms", major: 1, minor: 0 });
});

Deno.test("registry: register throws on malformed schema", async () => {
    const r = new SinkSchemaRegistry();
    assertThrows(() => r.register("alpha", "invalid"));
});

Deno.test("registry: register throws on duplicate sink_id", async () => {
    const r = new SinkSchemaRegistry();
    r.register("alpha", "alarms:v1.0");
    assertThrows(() => r.register("alpha", "alarms:v1.5"));
});

Deno.test("registry: unregister drops entry", async () => {
    const r = new SinkSchemaRegistry();
    r.register("alpha", "alarms:v1.0");
    r.unregister("alpha");
    assertEquals(r.get("alpha"), undefined);
});

Deno.test("registry: sinksByName filters", async () => {
    const r = new SinkSchemaRegistry();
    r.register("alpha", "alarms:v1.0");
    r.register("beta",  "alarms:v2.0");
    r.register("gamma", "metrics:v1.0");
    assertEquals(r.sinksByName("alarms"), ["alpha", "beta"]);
    assertEquals(r.sinksByName("metrics"), ["gamma"]);
    assertEquals(r.sinksByName("missing"), []);
});

Deno.test("registry: compatibleSinks filters by major", async () => {
    const r = new SinkSchemaRegistry();
    r.register("a", "alarms:v1.0");
    r.register("b", "alarms:v1.7");
    r.register("c", "alarms:v2.0");
    const target = parseSinkSchema("alarms:v1.3")!;
    assertEquals(r.compatibleSinks(target), ["a", "b"]);
});

Deno.test("registry: summary aggregates per-schema counts sorted", async () => {
    const r = new SinkSchemaRegistry();
    r.register("a", "alarms:v1.0");
    r.register("b", "alarms:v1.0");
    r.register("c", "metrics:v2.5");
    const s = r.summary();
    assertEquals(s, [
        { schema: "alarms:v1.0", sink_count: 2 },
        { schema: "metrics:v2.5", sink_count: 1 },
    ]);
});

Deno.test("registry: size reports total", async () => {
    const r = new SinkSchemaRegistry();
    assertEquals(r.size(), 0);
    r.register("a", "alarms:v1.0");
    r.register("b", "alarms:v2.0");
    assertEquals(r.size(), 2);
});

Deno.test("registry: get on unknown id returns undefined", async () => {
    const r = new SinkSchemaRegistry();
    assertEquals(r.get("missing"), undefined);
});

Deno.test("schema constant", async () => {
    assertEquals(SINK_SCHEMA_VERSION, "OMEGA-1590/v1");
});
