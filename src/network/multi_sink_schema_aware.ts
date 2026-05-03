// 🌌 OMEGA-64: Era 1610 — Schema-Aware Multi-Sink Wiring
// 🌉 Era 1640 — Translation-Aware Multi-Sink Discovery
//
// Era 1580's `MultiSinkInvestigator` keys sinks by opaque
// `sink_id` strings. Era 1590 introduced structured
// `ForensicSinkSchema` identifiers. Era 1600 added schema-
// validated cross-sink sync. But the multi-sink layer still
// doesn't *enforce* schemas — operators have to wire validation
// manually outside the investigator.
//
// Era 1610 closes that gap with `SchemaAwareMultiSinkInvestigator`:
// each registered sink carries its `ForensicSinkSchema` (Era
// 1590 format), and observation/sync operations from peers
// announcing schemas validate compatibility before reaching the
// underlying loop.
//
// COMPOSITION OVER MUTATION: this class wraps the existing
// Era 1580 `MultiSinkInvestigator` + Era 1590 `SinkSchemaRegistry`
// + Era 1600 schema-validation helpers. It doesn't modify any of
// them. Operators using only Era 1580 continue to work without
// changes.

import {
    MultiSinkInvestigator,
} from "./multi_sink_investigator.ts";
import {
    DEFAULT_LOOP_OPTS,
    LoopOptions,
    LoopTickResult,
    WarrantEmit,
} from "./auto_investigation_loop.ts";
import {
    ForensicSinkSchema,
    SinkSchemaRegistry,
    compatibleSchemas,
    parseSinkSchema,
} from "./forensic_sink_schema.ts";
import {
    validateSchemaCompatibility,
} from "./event_sink_sync_schema.ts";
import {
    SchemaTranslator,
    SchemaTranslatorRegistry,
} from "./schema_translator.ts";

export const SCHEMA_AWARE_MULTI_SCHEMA = "OMEGA-1610/v1";

/** Per-sink record with schema + telemetry. */
export interface SchemaAwareSinkInfo {
    sink_id: string;
    schema: ForensicSinkSchema;
}

/** Outcome of a schema-validated peer observation. */
export type SchemaObserveOutcome =
    | { ok: true; sink_id: string; translated_schema?: boolean }
    | { ok: false; reason: "unknown-sink"; sink_id: string }
    | { ok: false; reason: "name-mismatch"; sender: string; local: string }
    | { ok: false; reason: "major-mismatch"; sender: string; local: string }
    | { ok: false; reason: "sender-schema-malformed"; got: string };

export interface RejectionCounts {
    unknown_sink: number;
    name_mismatch: number;
    major_mismatch: number;
    sender_schema_malformed: number;
}

export interface SinkTranslationTelemetry {
    sink_id: string;
    translated_count: number;
    dropped_count: number;
    translatable_observations: number;
}

export interface TranslationCounts {
    registered_pairs: Array<{ source: string; target: string }>;
    translated_count: number;
    dropped_count: number;
    translatable_observations: number;
    per_sink: SinkTranslationTelemetry[];
}

export class SchemaAwareMultiSinkInvestigator {
    public readonly multi: MultiSinkInvestigator;
    public readonly registry: SinkSchemaRegistry;
    public readonly translatorRegistry: SchemaTranslatorRegistry;
    private rejection_counts: RejectionCounts = {
        unknown_sink: 0,
        name_mismatch: 0,
        major_mismatch: 0,
        sender_schema_malformed: 0,
    };
    private translation_counts = new Map<string, SinkTranslationTelemetry>();

    constructor(
        emit: WarrantEmit,
        translatorRegistry: SchemaTranslatorRegistry = new SchemaTranslatorRegistry(),
    ) {
        this.multi = new MultiSinkInvestigator(emit);
        this.registry = new SinkSchemaRegistry();
        this.translatorRegistry = translatorRegistry;
    }

    /** Register a sink with both its content schema (Era 1590)
     *  and its loop options. The schema string is validated
     *  before the underlying multi-sink layer is touched, so
     *  bad input never reaches the investigator. */
    addSink(
        sink_id: string,
        schema_string: string,
        opts: LoopOptions = DEFAULT_LOOP_OPTS,
    ): ForensicSinkSchema {
        // `register` throws on malformed schema or duplicate id —
        // run it first so we don't leave a half-registered sink
        // in `multi`.
        const schema = this.registry.register(sink_id, schema_string);
        try {
            this.multi.addSink(sink_id, opts);
        } catch (e) {
            // Roll back the registry on multi-sink failure (e.g.
            // duplicate id race).
            this.registry.unregister(sink_id);
            throw e;
        }
        return schema;
    }

    /** Drop a sink fully — registry + multi-sink + loop state. */
    removeSink(sink_id: string): void {
        this.multi.removeSink(sink_id);
        this.registry.unregister(sink_id);
        this.translation_counts.delete(sink_id);
    }

    /** Register a schema translator used by Era 1640 discovery
     *  and observation gates. */
    registerTranslator(
        source_schema_string: string,
        target_schema_string: string,
        translator: SchemaTranslator,
    ): void {
        this.translatorRegistry.register(
            source_schema_string,
            target_schema_string,
            translator,
        );
    }

    /** Record apply-path translation telemetry from Era 1630.
     *  The multi-sink layer does not apply deltas itself, so
     *  callers feed successful translation outcomes back here
     *  after `SchemaAwareSinkSync.apply(...)`. */
    recordTranslationApply(
        sink_id: string,
        translated_count: number,
        dropped_count: number,
    ): boolean {
        if (!this.registry.get(sink_id)) return false;
        const tele = this.ensureTranslationTelemetry(sink_id);
        tele.translated_count += translated_count;
        tele.dropped_count += dropped_count;
        return true;
    }

    /** Observe a peer's anchor for a given sink, validating
     *  that the peer's schema is compatible with the sink's
     *  registered schema. Compatible observations are forwarded
     *  to the underlying loop; incompatible ones are rejected
     *  (and counted in telemetry).
     *
     *  Pass `undefined` for `peer_schema_string` to opt out of
     *  schema validation (e.g. legacy peers); the observation
     *  forwards as-is. */
    observePeerAnchor(
        sink_id: string,
        peer_id: number,
        anchor: number,
        now_ms: number,
        peer_schema_string?: string,
    ): SchemaObserveOutcome {
        const localSchema = this.registry.get(sink_id);
        if (!localSchema) {
            this.rejection_counts.unknown_sink++;
            return { ok: false, reason: "unknown-sink", sink_id };
        }
        if (peer_schema_string !== undefined) {
            const validation = validateSchemaCompatibility(
                localSchema,
                peer_schema_string,
            );
            if (!validation.ok) {
                if (validation.reason === "name-mismatch") {
                    this.rejection_counts.name_mismatch++;
                    return { ok: false, reason: "name-mismatch", sender: validation.sender, local: validation.local };
                }
                if (validation.reason === "major-mismatch") {
                    const peerSchema = parseSinkSchema(peer_schema_string);
                    if (
                        peerSchema &&
                        this.translatorRegistry.canTranslate(peerSchema, localSchema)
                    ) {
                        this.ensureTranslationTelemetry(sink_id)
                            .translatable_observations++;
                    } else {
                        this.rejection_counts.major_mismatch++;
                        return { ok: false, reason: "major-mismatch", sender: validation.sender, local: validation.local };
                    }
                } else if (validation.reason === "sender-schema-malformed") {
                    this.rejection_counts.sender_schema_malformed++;
                    return { ok: false, reason: "sender-schema-malformed", got: validation.got };
                } else {
                    // Other reasons should not surface from
                    // validateSchemaCompatibility; keep the gate closed.
                    return { ok: false, reason: "sender-schema-malformed", got: peer_schema_string };
                }
            }
        }
        const ok = this.multi.observePeerAnchor(sink_id, peer_id, anchor, now_ms);
        if (!ok) {
            this.rejection_counts.unknown_sink++;
            return { ok: false, reason: "unknown-sink", sink_id };
        }
        return {
            ok: true,
            sink_id,
            translated_schema: peer_schema_string !== undefined &&
                this.wasTranslationObservation(sink_id, peer_schema_string),
        };
    }

    /** Tick all sinks. Pass-through to the underlying multi-sink
     *  (schema policy applies on observe, not on tick). */
    tickAll(now_ms: number) {
        return this.multi.tickAll(now_ms);
    }

    /** Tick a specific sink. */
    tickOne(sink_id: string, now_ms: number): LoopTickResult | undefined {
        return this.multi.tickOne(sink_id, now_ms);
    }

    /** Globally exclude a peer across every sink — same semantics
     *  as Era 1580. */
    excludePeerGlobally(peer_id: number): void {
        this.multi.excludePeerGlobally(peer_id);
    }

    /** Reverse a global exclusion. */
    includePeerGlobally(peer_id: number): void {
        this.multi.includePeerGlobally(peer_id);
    }

    /** Look up a sink's schema. */
    schemaOf(sink_id: string): ForensicSinkSchema | undefined {
        return this.registry.get(sink_id);
    }

    /** All sink ids matching a content-domain name (any
     *  major.minor). Useful for fan-out routing. */
    sinksByName(name: string): string[] {
        return this.registry.sinksByName(name);
    }

    /** Sink ids compatible with a given schema (same name +
     *  same major). */
    compatibleSinks(schema: ForensicSinkSchema): string[] {
        return this.registry.compatibleSinks(schema);
    }

    /** Sink ids that can accept `schema` only via an explicitly
     *  registered translator. Compatible sinks are excluded so
     *  callers can distinguish no-op fanout from migration fanout. */
    translatableSinks(schema: ForensicSinkSchema): string[] {
        const out: string[] = [];
        for (const id of this.registry.sinksByName(schema.name)) {
            const local = this.registry.get(id);
            if (
                local &&
                !compatibleSchemas(local, schema) &&
                this.translatorRegistry.canTranslate(schema, local)
            ) {
                out.push(id);
            }
        }
        return out.sort();
    }

    /** Sink ids that can receive data for `schema` either by
     *  direct compatibility or by explicit translation. */
    compatibleOrTranslatableSinks(schema: ForensicSinkSchema): string[] {
        return [...new Set([
            ...this.compatibleSinks(schema),
            ...this.translatableSinks(schema),
        ])].sort();
    }

    /** Enriched telemetry combining Era 1580's multi-sink
     *  summary with Era 1610's schema bookkeeping. */
    summary(now_ms: number): {
        sink_count: number;
        sink_ids: string[];
        per_sink: SchemaAwareSinkInfo[];
        per_schema_counts: Array<{ schema: string; sink_count: number }>;
        rejection_counts: RejectionCounts;
        translation_counts: TranslationCounts;
        globally_excluded_count: number;
        total_dissenters: number;
    } {
        const base = this.multi.summary(now_ms);
        const per_sink: SchemaAwareSinkInfo[] = base.sink_ids
            .map((id) => {
                const schema = this.registry.get(id);
                return schema ? { sink_id: id, schema } : null;
            })
            .filter((x): x is SchemaAwareSinkInfo => x !== null);
        return {
            sink_count: base.sink_count,
            sink_ids: base.sink_ids,
            per_sink,
            per_schema_counts: this.registry.summary(),
            rejection_counts: { ...this.rejection_counts },
            translation_counts: this.translationSummary(),
            globally_excluded_count: base.globally_excluded_count,
            total_dissenters: base.total_dissenters,
        };
    }

    private ensureTranslationTelemetry(sink_id: string): SinkTranslationTelemetry {
        let tele = this.translation_counts.get(sink_id);
        if (!tele) {
            tele = {
                sink_id,
                translated_count: 0,
                dropped_count: 0,
                translatable_observations: 0,
            };
            this.translation_counts.set(sink_id, tele);
        }
        return tele;
    }

    private wasTranslationObservation(sink_id: string, peer_schema_string: string): boolean {
        const local = this.registry.get(sink_id);
        const peer = parseSinkSchema(peer_schema_string);
        return !!local && !!peer && !compatibleSchemas(local, peer) &&
            this.translatorRegistry.canTranslate(peer, local);
    }

    private translationSummary(): TranslationCounts {
        const per_sink = [...this.translation_counts.values()]
            .map((x) => ({ ...x }))
            .sort((a, b) => a.sink_id.localeCompare(b.sink_id));
        let translated_count = 0;
        let dropped_count = 0;
        let translatable_observations = 0;
        for (const x of per_sink) {
            translated_count += x.translated_count;
            dropped_count += x.dropped_count;
            translatable_observations += x.translatable_observations;
        }
        return {
            registered_pairs: this.translatorRegistry.listPairs(),
            translated_count,
            dropped_count,
            translatable_observations,
            per_sink,
        };
    }
}
