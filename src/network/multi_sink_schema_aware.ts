// 🌌 OMEGA-64: Era 1610 — Schema-Aware Multi-Sink Wiring
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
    parseSinkSchema,
} from "./forensic_sink_schema.ts";
import {
    validateSchemaCompatibility,
} from "./event_sink_sync_schema.ts";

export const SCHEMA_AWARE_MULTI_SCHEMA = "OMEGA-1610/v1";

/** Per-sink record with schema + telemetry. */
export interface SchemaAwareSinkInfo {
    sink_id: string;
    schema: ForensicSinkSchema;
}

/** Outcome of a schema-validated peer observation. */
export type SchemaObserveOutcome =
    | { ok: true; sink_id: string }
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

export class SchemaAwareMultiSinkInvestigator {
    public readonly multi: MultiSinkInvestigator;
    public readonly registry: SinkSchemaRegistry;
    private rejection_counts: RejectionCounts = {
        unknown_sink: 0,
        name_mismatch: 0,
        major_mismatch: 0,
        sender_schema_malformed: 0,
    };

    constructor(emit: WarrantEmit) {
        this.multi = new MultiSinkInvestigator(emit);
        this.registry = new SinkSchemaRegistry();
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
                    this.rejection_counts.major_mismatch++;
                    return { ok: false, reason: "major-mismatch", sender: validation.sender, local: validation.local };
                }
                if (validation.reason === "sender-schema-malformed") {
                    this.rejection_counts.sender_schema_malformed++;
                    return { ok: false, reason: "sender-schema-malformed", got: validation.got };
                }
                // Other reasons (wrapper-schema-mismatch, apply-failed,
                // local-schema-malformed) shouldn't surface from
                // validateSchemaCompatibility — fall through defensively.
                return { ok: false, reason: "sender-schema-malformed", got: peer_schema_string };
            }
        }
        const ok = this.multi.observePeerAnchor(sink_id, peer_id, anchor, now_ms);
        if (!ok) {
            this.rejection_counts.unknown_sink++;
            return { ok: false, reason: "unknown-sink", sink_id };
        }
        return { ok: true, sink_id };
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

    /** Enriched telemetry combining Era 1580's multi-sink
     *  summary with Era 1610's schema bookkeeping. */
    summary(now_ms: number): {
        sink_count: number;
        sink_ids: string[];
        per_sink: SchemaAwareSinkInfo[];
        per_schema_counts: Array<{ schema: string; sink_count: number }>;
        rejection_counts: RejectionCounts;
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
            globally_excluded_count: base.globally_excluded_count,
            total_dissenters: base.total_dissenters,
        };
    }
}
