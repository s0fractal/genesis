// 🌌 OMEGA-64: Era 1620 — Cross-Domain Translation Bridge
//
// Era 1610 enforces schema compatibility on cross-sink merges:
// same name + same major. That's the right default — major
// bumps mean breaking changes, and silently merging across
// majors would corrupt content semantics.
//
// But operators DO need to migrate. A live deployment running
// "alarms:v1.5" can't atomically swap every node to "alarms:v2.0".
// The transition window requires a way to translate v1 records
// into v2 form (and vice versa) when the two domains overlap.
//
// Era 1620 introduces `SchemaTranslator` — a function pair
// registered per schema-pair that maps `ForensicEvent` records
// from one schema to another. The translator registry stores
// translators keyed by `(source_name:source_major) →
// (target_name:target_major)`. A migration owner registers a
// translator pair; the rest of the stack consults the registry
// before refusing a cross-major merge.
//
// PRINCIPLE: translation is OPT-IN per schema-pair. Without a
// registered translator, Era 1610's hard refusal stands. With
// one registered, the operator has explicitly declared "v1
// records can be safely interpreted as v2 records" and accepts
// responsibility for that mapping.
//
// MINOR DRIFT REMAINS PERMISSIVE: this module only matters for
// MAJOR mismatches. Same-name + same-major still passes through
// Era 1390/1600 unchanged. Same-name + same-major + different
// minor stays permissive (Era 1590 rule).

import { ForensicEvent } from "./forensic_event_sink.ts";
import {
    ForensicSinkSchema,
    formatSinkSchema,
    parseSinkSchema,
} from "./forensic_sink_schema.ts";

export const TRANSLATOR_SCHEMA = "OMEGA-1620/v1";

/** A translator maps a ForensicEvent from `source` schema to
 *  `target` schema. Returns the translated event, or `null` to
 *  indicate the translator deliberately dropped this event
 *  (e.g. v1 record has no v2 equivalent). */
export type SchemaTranslator = (
    event: ForensicEvent,
    source: ForensicSinkSchema,
    target: ForensicSinkSchema,
) => ForensicEvent | null;

/** Translator key encoded as "name:vMAJOR" (no minor) — minor
 *  versions are treated as compatible within a major, so a
 *  single translator handles the full minor range. */
function translatorKey(schema: ForensicSinkSchema): string {
    return `${schema.name}:v${schema.major}`;
}

/** Registry of schema-pair translators. */
export class SchemaTranslatorRegistry {
    /** Map<source_key, Map<target_key, translator>>. */
    private byPair = new Map<string, Map<string, SchemaTranslator>>();

    /** Register a translator from `source` to `target`. Throws
     *  on malformed schema strings, on identical source/target
     *  (no translation needed), or on duplicate registration
     *  for the same pair. */
    register(
        source_schema_string: string,
        target_schema_string: string,
        translator: SchemaTranslator,
    ): void {
        const source = parseSinkSchema(source_schema_string);
        const target = parseSinkSchema(target_schema_string);
        if (!source) {
            throw new Error(`SchemaTranslatorRegistry: malformed source '${source_schema_string}'`);
        }
        if (!target) {
            throw new Error(`SchemaTranslatorRegistry: malformed target '${target_schema_string}'`);
        }
        if (source.name === target.name && source.major === target.major) {
            throw new Error(
                `SchemaTranslatorRegistry: source and target are compatible (${formatSinkSchema(source)} vs ${formatSinkSchema(target)}); translation is unnecessary`,
            );
        }
        const sk = translatorKey(source);
        const tk = translatorKey(target);
        const inner = this.byPair.get(sk) ?? new Map();
        if (inner.has(tk)) {
            throw new Error(`SchemaTranslatorRegistry: pair ${sk} → ${tk} already registered`);
        }
        inner.set(tk, translator);
        this.byPair.set(sk, inner);
    }

    /** Drop a registered translator. */
    unregister(source: ForensicSinkSchema, target: ForensicSinkSchema): void {
        const sk = translatorKey(source);
        const inner = this.byPair.get(sk);
        if (!inner) return;
        inner.delete(translatorKey(target));
        if (inner.size === 0) this.byPair.delete(sk);
    }

    /** Lookup a translator. Returns `null` when no translator
     *  registered for the pair. */
    lookup(source: ForensicSinkSchema, target: ForensicSinkSchema): SchemaTranslator | null {
        const inner = this.byPair.get(translatorKey(source));
        if (!inner) return null;
        return inner.get(translatorKey(target)) ?? null;
    }

    /** Convenience predicate. */
    canTranslate(source: ForensicSinkSchema, target: ForensicSinkSchema): boolean {
        return this.lookup(source, target) !== null;
    }

    /** Run a registered translator. Returns `null` (and counts as
     *  a translation refusal) if no translator is registered;
     *  returns whatever the translator chose to emit otherwise.
     *
     *  When source and target are compatible (same name + same
     *  major), the input is returned unchanged — no translation
     *  needed. */
    translate(
        event: ForensicEvent,
        source: ForensicSinkSchema,
        target: ForensicSinkSchema,
    ): ForensicEvent | null {
        if (source.name === target.name && source.major === target.major) {
            return event; // identity translation
        }
        const fn = this.lookup(source, target);
        if (!fn) return null;
        return fn(event, source, target);
    }

    /** Snapshot of all registered pairs, sorted for deterministic
     *  output. */
    listPairs(): Array<{ source: string; target: string }> {
        const out: Array<{ source: string; target: string }> = [];
        for (const [sk, inner] of this.byPair) {
            for (const tk of inner.keys()) {
                out.push({ source: sk, target: tk });
            }
        }
        out.sort((a, b) => {
            if (a.source !== b.source) return a.source.localeCompare(b.source);
            return a.target.localeCompare(b.target);
        });
        return out;
    }

    /** Number of registered pairs. */
    size(): number {
        let n = 0;
        for (const inner of this.byPair.values()) n += inner.size;
        return n;
    }
}

/** Translate a batch of events. Returns the successfully-
 *  translated events plus a count of how many the translator
 *  dropped (returned `null`). When no translator is registered
 *  for the pair, returns `null` as the array (caller should
 *  refuse the whole exchange rather than partially translate). */
export function translateBatch(
    events: ReadonlyArray<ForensicEvent>,
    source: ForensicSinkSchema,
    target: ForensicSinkSchema,
    registry: SchemaTranslatorRegistry,
): { translated: ForensicEvent[]; dropped: number } | null {
    if (source.name !== target.name) {
        // Cross-domain bridging requires a translator AND name match.
        // Different content domains should never translate directly.
        if (!registry.canTranslate(source, target)) return null;
    }
    if (source.name === target.name && source.major === target.major) {
        // Identity case; fast-path no-op.
        return { translated: [...events], dropped: 0 };
    }
    if (!registry.canTranslate(source, target)) return null;
    const translated: ForensicEvent[] = [];
    let dropped = 0;
    for (const e of events) {
        const out = registry.translate(e, source, target);
        if (out === null) dropped++;
        else translated.push(out);
    }
    return { translated, dropped };
}
