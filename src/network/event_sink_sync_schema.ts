// 🌌 OMEGA-64: Era 1600 — Schema-Validated Cross-Sink Sync
//
// Era 1390's `applyEventDelta` merges entries from any sender
// into the local sink — the sender's content-domain identity
// isn't part of the integrity check. For multi-domain
// deployments (Era 1580/1590) that's a hole: a "metrics" sink
// could accidentally absorb "alarms" entries if the wire layer
// routes them wrong.
//
// Era 1600 closes that hole with a thin wrapper around Era 1390:
//
//   • `SchemaTaggedDelta` — bundles an `EventDelta` with the
//     sender's `ForensicSinkSchema`.
//   • `applyEventDeltaWithSchema(...)` — validates schema
//     compatibility (Era 1590 rules) before delegating to
//     Era 1390's `applyEventDelta`. Rejection codes are typed
//     so callers can distinguish protocol-vs-content failures.
//   • `SchemaAwareSinkSync` helper class binds a local sink to
//     a local schema and exposes apply / build methods that
//     enforce the contract automatically.
//
// PRINCIPLE: Era 1390's apply path is unchanged — schema
// validation is an outer layer. Existing callers continue to
// work; new callers gate via the schema variant.

import {
    ForensicEventSink,
} from "./forensic_event_sink.ts";
import {
    EventDelta,
    SYNC_SCHEMA_VERSION,
    applyEventDelta,
    computeEventDelta,
    buildEventHashList,
    EventHashList,
} from "./event_sink_sync.ts";
import {
    ForensicSinkSchema,
    compatibleSchemas,
    formatSinkSchema,
    parseSinkSchema,
} from "./forensic_sink_schema.ts";

export const SCHEMA_SYNC_SCHEMA = "OMEGA-1600/v1";

/** Wrapper carrying both an Era 1390 EventDelta and the sender's
 *  content-domain identity. */
export interface SchemaTaggedDelta {
    /** Schema version of the wrapper (Era 1600). */
    schema: string;
    /** Sender's sink schema as a formatted string
     *  (e.g. "alarms:v1.0"). */
    sender_sink_schema: string;
    /** The wrapped Era 1390 EventDelta. */
    delta: EventDelta;
}

/** Wrapper for HASH_LIST broadcasts including sender schema. */
export interface SchemaTaggedHashList {
    schema: string;
    sender_sink_schema: string;
    list: EventHashList;
}

/** Outcome of a schema-validated apply. The `schema-*` cases
 *  are surfaced before the underlying applyEventDelta runs;
 *  `apply-failed` wraps Era 1390's own rejection. */
export type SchemaApplyOutcome =
    | { ok: true; added_count: number; skipped_count: number; new_anchor: number }
    | { ok: false; reason: "wrapper-schema-mismatch"; got: string }
    | { ok: false; reason: "sender-schema-malformed"; got: string }
    | { ok: false; reason: "local-schema-malformed"; got: string }
    | { ok: false; reason: "name-mismatch"; sender: string; local: string }
    | { ok: false; reason: "major-mismatch"; sender: string; local: string }
    | { ok: false; reason: "apply-failed"; underlying: string };

/** Wrap a raw Era 1390 delta with the sender's schema. */
export function buildSchemaTaggedDelta(
    delta: EventDelta,
    sender_sink_schema: ForensicSinkSchema,
): SchemaTaggedDelta {
    return {
        schema: SCHEMA_SYNC_SCHEMA,
        sender_sink_schema: formatSinkSchema(sender_sink_schema),
        delta,
    };
}

/** Wrap a hash list broadcast with the sender's schema. */
export function buildSchemaTaggedHashList(
    list: EventHashList,
    sender_sink_schema: ForensicSinkSchema,
): SchemaTaggedHashList {
    return {
        schema: SCHEMA_SYNC_SCHEMA,
        sender_sink_schema: formatSinkSchema(sender_sink_schema),
        list,
    };
}

/** Apply a schema-tagged delta to the local sink. Refuses on
 *  schema mismatch; otherwise delegates to Era 1390. */
export function applyEventDeltaWithSchema(
    local_sink: ForensicEventSink,
    local_schema: ForensicSinkSchema,
    tagged: SchemaTaggedDelta,
    now_ms: number,
): SchemaApplyOutcome {
    if (tagged.schema !== SCHEMA_SYNC_SCHEMA) {
        return { ok: false, reason: "wrapper-schema-mismatch", got: tagged.schema };
    }
    const senderParsed = parseSinkSchema(tagged.sender_sink_schema);
    if (!senderParsed) {
        return { ok: false, reason: "sender-schema-malformed", got: tagged.sender_sink_schema };
    }
    if (local_schema.name !== senderParsed.name) {
        return {
            ok: false,
            reason: "name-mismatch",
            sender: senderParsed.name,
            local: local_schema.name,
        };
    }
    if (local_schema.major !== senderParsed.major) {
        return {
            ok: false,
            reason: "major-mismatch",
            sender: formatSinkSchema(senderParsed),
            local: formatSinkSchema(local_schema),
        };
    }
    // Schemas compatible — delegate to Era 1390.
    const outcome = applyEventDelta(local_sink, tagged.delta, now_ms);
    if (outcome.ok) {
        return {
            ok: true,
            added_count: outcome.added_count,
            skipped_count: outcome.skipped_count,
            new_anchor: outcome.new_anchor,
        };
    }
    return { ok: false, reason: "apply-failed", underlying: outcome.reason };
}

/** Validate just schemas (no apply). Useful for HASH_LIST
 *  arrival paths where the receiver decides whether to even
 *  *respond* before computing a delta. */
export function validateSchemaCompatibility(
    local_schema: ForensicSinkSchema,
    sender_schema_string: string,
): SchemaApplyOutcome {
    const senderParsed = parseSinkSchema(sender_schema_string);
    if (!senderParsed) {
        return { ok: false, reason: "sender-schema-malformed", got: sender_schema_string };
    }
    if (local_schema.name !== senderParsed.name) {
        return {
            ok: false,
            reason: "name-mismatch",
            sender: senderParsed.name,
            local: local_schema.name,
        };
    }
    if (local_schema.major !== senderParsed.major) {
        return {
            ok: false,
            reason: "major-mismatch",
            sender: formatSinkSchema(senderParsed),
            local: formatSinkSchema(local_schema),
        };
    }
    return { ok: true, added_count: 0, skipped_count: 0, new_anchor: 0 };
}

/** Convenience class binding a sink to a schema. Methods enforce
 *  Era 1600 invariants automatically — callers don't have to
 *  pass `local_schema` repeatedly. */
export class SchemaAwareSinkSync {
    constructor(
        public readonly sink: ForensicEventSink,
        public readonly schema: ForensicSinkSchema,
    ) {}

    /** Build a HASH_LIST tagged with our schema. */
    buildHashList(now_ms: number): SchemaTaggedHashList {
        return buildSchemaTaggedHashList(
            buildEventHashList(this.sink, now_ms),
            this.schema,
        );
    }

    /** Compute a schema-tagged delta against an incoming
     *  schema-tagged hash list. Returns null if schemas don't
     *  match (caller should not respond). */
    computeDeltaForPeer(
        tagged_list: SchemaTaggedHashList,
        now_ms: number,
    ): SchemaTaggedDelta | null {
        if (tagged_list.schema !== SCHEMA_SYNC_SCHEMA) return null;
        const peerParsed = parseSinkSchema(tagged_list.sender_sink_schema);
        if (!peerParsed) return null;
        if (!compatibleSchemas(this.schema, peerParsed)) return null;
        const delta = computeEventDelta(tagged_list.list, this.sink.list(), now_ms);
        return buildSchemaTaggedDelta(delta, this.schema);
    }

    /** Apply a tagged delta to our local sink. */
    apply(tagged: SchemaTaggedDelta, now_ms: number): SchemaApplyOutcome {
        return applyEventDeltaWithSchema(this.sink, this.schema, tagged, now_ms);
    }

    /** Echo Era 1390's underlying schema for diagnostics. */
    underlyingSyncSchema(): string {
        return SYNC_SCHEMA_VERSION;
    }
}
