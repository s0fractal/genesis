// 🌌 OMEGA-64: Era 1590 — Forensic Sink Schema Versioning
//
// Era 1580's `MultiSinkInvestigator` keys sinks by opaque
// `sink_id: string`. That works for single-version deployments
// but doesn't surface a key real-world need: identifying a sink's
// CONTENT DOMAIN explicitly so cross-sink operations can be
// validated.
//
// Era 1590 introduces `ForensicSinkSchema` — a structured
// "name:vMAJOR.MINOR" identifier with parsing, formatting, and
// compatibility predicates:
//
//   • Same name + same MAJOR → compatible (delta merge allowed)
//   • Same name + different MAJOR → incompatible (delta merge
//     refused; would corrupt content semantics)
//   • Different name → incompatible (different domains entirely)
//
// MINOR version drift is permissive: a v1.2 sink can accept
// deltas from a v1.0 peer because the major contract is the
// same. Operators bumping to v2.0 (breaking change) get a hard
// gate.
//
// `SinkSchemaRegistry` is an optional helper that validates
// schemas at sink-registration time and lets operators query
// per-schema sink counts.

export const SINK_SCHEMA_VERSION = "OMEGA-1590/v1";

/** Structured sink schema. */
export interface ForensicSinkSchema {
    name: string;
    major: number;
    minor: number;
}

/** Format: "name:vMAJOR.MINOR". Allowed name chars are
 *  [a-zA-Z0-9_-], length 1..32. */
const SCHEMA_RE = /^([a-zA-Z0-9_-]{1,32}):v(\d{1,4})\.(\d{1,4})$/;

/** Parse "name:vMAJOR.MINOR" into a schema. Returns null on
 *  malformed input. */
export function parseSinkSchema(s: string): ForensicSinkSchema | null {
    if (typeof s !== "string") return null;
    const m = SCHEMA_RE.exec(s);
    if (!m) return null;
    const major = Number(m[2]);
    const minor = Number(m[3]);
    if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
    return { name: m[1], major, minor };
}

/** Inverse of parseSinkSchema. */
export function formatSinkSchema(schema: ForensicSinkSchema): string {
    return `${schema.name}:v${schema.major}.${schema.minor}`;
}

/** True when string is a syntactically valid schema. */
export function isValidSinkSchemaString(s: string): boolean {
    return parseSinkSchema(s) !== null;
}

/** Two schemas are compatible when they share a name AND a
 *  major version. Minor differences are permissive. */
export function compatibleSchemas(
    a: ForensicSinkSchema,
    b: ForensicSinkSchema,
): boolean {
    return a.name === b.name && a.major === b.major;
}

/** Convenience: parse + compare in one call. Returns false on
 *  malformed input from either side. */
export function compatibleSchemaStrings(a: string, b: string): boolean {
    const pa = parseSinkSchema(a);
    const pb = parseSinkSchema(b);
    if (!pa || !pb) return false;
    return compatibleSchemas(pa, pb);
}

/** Identical schema (for tests / dedup). */
export function sameSinkSchema(
    a: ForensicSinkSchema,
    b: ForensicSinkSchema,
): boolean {
    return a.name === b.name && a.major === b.major && a.minor === b.minor;
}

/** Registry: track per-schema sink counts. Callers register
 *  sinks with their schema; the registry validates the schema
 *  string and provides operator telemetry. */
export class SinkSchemaRegistry {
    private byId = new Map<string, ForensicSinkSchema>();

    /** Register a sink_id with a schema. Returns the parsed
     *  schema on success, throws on malformed input or
     *  duplicate id. */
    register(sink_id: string, schema_string: string): ForensicSinkSchema {
        const parsed = parseSinkSchema(schema_string);
        if (!parsed) {
            throw new Error(`SinkSchemaRegistry: malformed schema '${schema_string}'`);
        }
        if (this.byId.has(sink_id)) {
            throw new Error(`SinkSchemaRegistry: sink_id '${sink_id}' already registered`);
        }
        this.byId.set(sink_id, parsed);
        return parsed;
    }

    unregister(sink_id: string): void {
        this.byId.delete(sink_id);
    }

    /** Look up a sink's schema. */
    get(sink_id: string): ForensicSinkSchema | undefined {
        return this.byId.get(sink_id);
    }

    /** Sink ids sharing a name (any major.minor). */
    sinksByName(name: string): string[] {
        const out: string[] = [];
        for (const [id, schema] of this.byId) {
            if (schema.name === name) out.push(id);
        }
        return out.sort();
    }

    /** Sink ids compatible with the given schema (same name +
     *  same major). */
    compatibleSinks(schema: ForensicSinkSchema): string[] {
        const out: string[] = [];
        for (const [id, s] of this.byId) {
            if (compatibleSchemas(s, schema)) out.push(id);
        }
        return out.sort();
    }

    /** Per-schema sink counts. Output keyed by formatted schema
     *  string, sorted ascending. */
    summary(): Array<{ schema: string; sink_count: number }> {
        const counts = new Map<string, number>();
        for (const schema of this.byId.values()) {
            const key = formatSinkSchema(schema);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()]
            .map(([schema, sink_count]) => ({ schema, sink_count }))
            .sort((a, b) => a.schema.localeCompare(b.schema));
    }

    /** Total registered sinks. */
    size(): number {
        return this.byId.size;
    }
}
