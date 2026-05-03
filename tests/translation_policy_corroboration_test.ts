// Era 1690: Translation policy drift corroboration tests.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import {
    TRANSLATION_POLICY_CORROBORATION_SCHEMA,
    TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA,
    TranslationPolicyCorroborationTracker,
    buildTranslationPolicyCorroborationRaise,
    classifyPolicyDriftConfidence,
    confidenceAtLeast,
    policyDriftEquivalenceHash,
    validateTranslationPolicyCorroborationRaise,
} from "../src/network/translation_policy_corroboration.ts";
import {
    TranslationPolicyDriftEvent,
    buildTranslationPolicyClaim,
    translationPolicyDriftEvent,
} from "../src/network/translation_policy_monitor.ts";
import { SchemaTranslatorRegistry } from "../src/network/schema_translator.ts";
import { ForensicEvent } from "../src/network/forensic_event_sink.ts";

const T0 = 1_000_000;
const passthrough = (event: ForensicEvent) => event;

function registry(pairs: Array<[string, string]>): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, passthrough);
    return r;
}

function drift(observed_at_ms = T0): TranslationPolicyDriftEvent {
    const local = buildTranslationPolicyClaim(0xAA, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]), T0);
    const peer = buildTranslationPolicyClaim(0xBB, registry([]), T0);
    return translationPolicyDriftEvent(local, peer, observed_at_ms);
}

Deno.test("equivalence hash: ignores observed timestamp", () => {
    const a = drift(T0);
    const b = drift(T0 + 1234);
    assert(a.event_hash !== b.event_hash);
    assertEquals(policyDriftEquivalenceHash(a), policyDriftEquivalenceHash(b));
});

Deno.test("classify confidence bands", () => {
    assertEquals(classifyPolicyDriftConfidence(1, 4), "lone");
    assertEquals(classifyPolicyDriftConfidence(2, 4), "double");
    assertEquals(classifyPolicyDriftConfidence(3, 4), "triple+");
    assertEquals(classifyPolicyDriftConfidence(4, 4), "high");
});

Deno.test("confidenceAtLeast: ordered predicate", () => {
    assertEquals(confidenceAtLeast("double", "lone"), true);
    assertEquals(confidenceAtLeast("double", "double"), true);
    assertEquals(confidenceAtLeast("double", "triple+"), false);
    assertEquals(confidenceAtLeast("high", "triple+"), true);
});

Deno.test("tracker: single witness is lone", () => {
    const t = new TranslationPolicyCorroborationTracker();
    const rec = t.record(drift(), 0x01, T0);
    assertEquals(rec.witness_count, 1);
    assertEquals(rec.confidence, "lone");
    assertEquals(rec.witnessed_by, [0x01]);
});

Deno.test("tracker: two distinct witnesses produce double", () => {
    const t = new TranslationPolicyCorroborationTracker();
    t.record(drift(T0), 0x02, T0);
    const rec = t.record(drift(T0 + 10), 0x01, T0 + 10);
    assertEquals(rec.witness_count, 2);
    assertEquals(rec.confidence, "double");
    assertEquals(rec.witnessed_by, [0x01, 0x02]);
});

Deno.test("tracker: same witness duplicate is idempotent", () => {
    const t = new TranslationPolicyCorroborationTracker();
    t.record(drift(T0), 0x01, T0);
    const rec = t.record(drift(T0 + 10), 0x01, T0 + 10);
    assertEquals(rec.witness_count, 1);
    assertEquals(rec.witnessed_by, [0x01]);
});

Deno.test("tracker: high-confidence callback fires once", () => {
    let fired = 0;
    const t = new TranslationPolicyCorroborationTracker({
        high_confidence_threshold: 3,
        on_high_confidence: () => {
            fired++;
        },
    });
    t.record(drift(T0), 0x01, T0);
    t.record(drift(T0 + 1), 0x02, T0 + 1);
    assertEquals(fired, 0);
    t.record(drift(T0 + 2), 0x03, T0 + 2);
    assertEquals(fired, 1);
    t.record(drift(T0 + 3), 0x04, T0 + 3);
    assertEquals(fired, 1);
});

Deno.test("tracker: list orders by witness count then first observed", () => {
    const t = new TranslationPolicyCorroborationTracker();
    const a = drift(T0);
    const b = { ...drift(T0 + 1), peer_id: 0xCC };
    t.record(a, 0x01, T0);
    t.record(b, 0x01, T0 + 1);
    t.record(b, 0x02, T0 + 2);
    const list = t.list();
    assertEquals(list[0].peer_id, 0xCC);
    assertEquals(list[1].peer_id, 0xBB);
});

Deno.test("tracker: capacity evicts oldest drift", () => {
    const t = new TranslationPolicyCorroborationTracker({ capacity: 1 });
    const a = drift(T0);
    const b = { ...drift(T0 + 1), peer_id: 0xCC };
    t.record(a, 0x01, T0);
    t.record(b, 0x01, T0 + 1);
    assertEquals(t.size(), 1);
    assertEquals(t.get(policyDriftEquivalenceHash(a)), undefined);
    assert(t.get(policyDriftEquivalenceHash(b)) !== undefined);
});

Deno.test("tracker: byConfidence filters by minimum band", () => {
    const t = new TranslationPolicyCorroborationTracker();
    t.record(drift(T0), 0x01, T0);
    t.record(drift(T0 + 1), 0x02, T0 + 1);
    assertEquals(t.byConfidence("double").length, 1);
    assertEquals(t.byConfidence("triple+").length, 0);
});

Deno.test("raise: build + validate", () => {
    const raise = buildTranslationPolicyCorroborationRaise(drift(), 0xC0, T0);
    assertEquals(raise.schema, TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA);
    assertEquals(raise.witness_id, 0xC0);
    assertEquals(validateTranslationPolicyCorroborationRaise(raise), true);
});

Deno.test("raise: tampered drift hash rejected", () => {
    const raise = buildTranslationPolicyCorroborationRaise(drift(), 0xC0, T0);
    assertEquals(validateTranslationPolicyCorroborationRaise({
        ...raise,
        drift_hash: raise.drift_hash ^ 1,
    }), false);
});

Deno.test("tracker: recordRaise validates and applies witness", () => {
    const t = new TranslationPolicyCorroborationTracker();
    const raise = buildTranslationPolicyCorroborationRaise(drift(), 0xC0, T0);
    const rec = t.recordRaise(raise, T0 + 10);
    assert(rec !== null);
    assertEquals(rec.witnessed_by, [0xC0]);
    assertEquals(rec.last_observed_at_ms, T0 + 10);
});

Deno.test("tracker: recordRaise rejects invalid raise", () => {
    const t = new TranslationPolicyCorroborationTracker();
    const raise = buildTranslationPolicyCorroborationRaise(drift(), 0xC0, T0);
    assertEquals(t.recordRaise({ ...raise, peer_policy_hash: raise.peer_policy_hash ^ 1 }), null);
    assertEquals(t.size(), 0);
});

Deno.test("tracker: invalid opts throw", () => {
    assertThrows(() => new TranslationPolicyCorroborationTracker({ capacity: 0 }));
    assertThrows(() => new TranslationPolicyCorroborationTracker({ high_confidence_threshold: 1 }));
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_CORROBORATION_SCHEMA, "OMEGA-1690/v1");
    assertEquals(TRANSLATION_POLICY_CORROBORATION_WIRE_SCHEMA, "OMEGA-1700/v1");
});
