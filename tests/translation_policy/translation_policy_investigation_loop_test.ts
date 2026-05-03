// Era 1680: Translation policy investigation loop tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEvent } from "../../src/network/forensic_event_sink.ts";
import { translationPolicyPlasmidFields } from "../../src/network/mesh_event_bridge.ts";
import { WarrantProposalPayload } from "../../src/network/quorum_warrant_bridge.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    TranslationPolicyInvestigationLoop,
    TRANSLATION_POLICY_INVESTIGATION_SCHEMA,
} from "../../src/network/translation_policy/translation_policy_investigation_loop.ts";
import {
    TranslationPolicyMonitor,
    translationPolicyDriftEvent,
} from "../../src/network/translation_policy/translation_policy_monitor.ts";
import { TranslationPolicyWarrantBridge } from "../../src/network/translation_policy/translation_policy_warrant_bridge.ts";
import { TranslationPolicyCorroborationTracker } from "../../src/network/translation_policy/translation_policy_corroboration.ts";

const T0 = 1_000_000;
const passthrough = (event: ForensicEvent) => event;

function registry(pairs: Array<[string, string]>): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, passthrough);
    return r;
}

function localMonitor(): TranslationPolicyMonitor {
    return new TranslationPolicyMonitor(0xAA, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]));
}

Deno.test("loop: matching policy observes without proposal", () => {
    const emitted: WarrantProposalPayload[] = [];
    const monitor = localMonitor();
    const peer = new TranslationPolicyMonitor(0xBB, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]));
    const loop = new TranslationPolicyInvestigationLoop(
        monitor,
        (p) => {
            emitted.push(p);
            return true;
        },
    );
    const result = loop.observeClaim(peer.localClaim(T0), T0);
    assertEquals(result.observation?.drift_detected, false);
    assertEquals(result.warrant_result.payloads.length, 0);
    assertEquals(emitted.length, 0);
});

Deno.test("loop: drift policy builds and emits proposal", () => {
    const emitted: WarrantProposalPayload[] = [];
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    const result = loop.observeClaim(peer.localClaim(T0), T0);
    assertEquals(result.observation?.drift_detected, true);
    assertEquals(result.new_drift_events.length, 1);
    assertEquals(result.warrant_result.payloads.length, 1);
    assertEquals(result.proposals_emitted, 1);
    assertEquals(emitted.length, 1);
    assertEquals(emitted[0].semanticType, "PROPOSAL");
    assertEquals(emitted[0].target_peer_id, 0xBB);
});

Deno.test("loop: duplicate drift claim does not re-emit", () => {
    const emitted: WarrantProposalPayload[] = [];
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
        new TranslationPolicyWarrantBridge({ dedup_window_ms: 60_000 }),
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    loop.observeClaim(peer.localClaim(T0), T0);
    const second = loop.observeClaim(peer.localClaim(T0), T0 + 100);
    assertEquals(second.new_drift_events.length, 0);
    assertEquals(second.warrant_result.payloads.length, 0);
    assertEquals(emitted.length, 1);
});

Deno.test("loop: changed peer policy emits a new proposal", () => {
    const emitted: WarrantProposalPayload[] = [];
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
    );
    const peerA = new TranslationPolicyMonitor(0xBB, registry([]));
    const peerB = new TranslationPolicyMonitor(0xBB, registry([
        ["metrics:v1.0", "metrics:v2.0"],
    ]));
    loop.observeClaim(peerA.localClaim(T0), T0);
    loop.observeClaim(peerB.localClaim(T0 + 1), T0 + 1);
    assertEquals(emitted.length, 2);
});

Deno.test("loop: emit failure is counted", () => {
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        () => false,
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    const result = loop.observeClaim(peer.localClaim(T0), T0);
    assertEquals(result.proposals_emitted, 0);
    assertEquals(result.proposals_failed, 1);
    assertEquals(loop.summary(T0).proposals_failed, 1);
});

Deno.test("loop: ingestPolicyBody decodes mesh payload", () => {
    const emitted: WarrantProposalPayload[] = [];
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    const fields = translationPolicyPlasmidFields(0xAA, peer.localClaim(T0));
    const result = loop.ingestPolicyBody(fields.translationPolicyBody, T0);
    assertEquals(result.new_drift_events.length, 1);
    assertEquals(emitted.length, 1);
});

Deno.test("loop: malformed body increments malformed counter", () => {
    const loop = new TranslationPolicyInvestigationLoop(localMonitor(), () => true);
    const result = loop.ingestPolicyBody("not json", T0);
    assertEquals(result.observation, null);
    assertEquals(loop.summary(T0).malformed_claims, 1);
});

Deno.test("loop: summary combines monitor + proposal telemetry", () => {
    const loop = new TranslationPolicyInvestigationLoop(localMonitor(), () => true);
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    loop.observeClaim(peer.localClaim(T0), T0);
    const summary = loop.summary(T0);
    assertEquals(summary.claims_observed, 1);
    assertEquals(summary.drift_events_seen, 1);
    assertEquals(summary.proposals_built, 1);
    assertEquals(summary.proposals_emitted, 1);
    assertEquals(summary.observed_peer_count, 1);
    assertEquals(summary.drift_peer_count, 1);
    assertEquals(summary.monitor_alarm_count, 1);
});

Deno.test("loop: clearSeenDrift allows bridge dedup to report duplicate", () => {
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        () => true,
        new TranslationPolicyWarrantBridge({ dedup_window_ms: 60_000 }),
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    loop.observeClaim(peer.localClaim(T0), T0);
    loop.clearSeenDrift();
    const second = loop.observeClaim(peer.localClaim(T0), T0 + 100);
    assertEquals(second.new_drift_events.length, 1);
    assertEquals(second.warrant_result.payloads.length, 0);
    assertEquals(second.warrant_result.deduped_peer_ids, [0xBB]);
});

Deno.test("loop: corroboration gate blocks below required band", () => {
    const emitted: WarrantProposalPayload[] = [];
    const tracker = new TranslationPolicyCorroborationTracker();
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
        new TranslationPolicyWarrantBridge(),
        { tracker, witness_id: 0xA1, min_confidence: "double" },
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    const result = loop.observeClaim(peer.localClaim(T0), T0);
    assertEquals(result.corroborated_records[0].confidence, "lone");
    assertEquals(result.warrant_result.payloads.length, 0);
    assertEquals(emitted.length, 0);
    assertEquals(loop.summary(T0).corroboration_blocked, 1);
});

Deno.test("loop: corroboration gate emits after external witness reaches band", () => {
    const emitted: WarrantProposalPayload[] = [];
    const tracker = new TranslationPolicyCorroborationTracker();
    const local = localMonitor();
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    const externalDrift = translationPolicyDriftEvent(
        local.localClaim(T0),
        peer.localClaim(T0),
        T0 - 100,
    );
    tracker.record(externalDrift, 0xA0, T0 - 100);
    const loop = new TranslationPolicyInvestigationLoop(
        local,
        (p) => {
            emitted.push(p);
            return true;
        },
        new TranslationPolicyWarrantBridge(),
        { tracker, witness_id: 0xA1, min_confidence: "double" },
    );
    const result = loop.observeClaim(peer.localClaim(T0), T0);
    assertEquals(result.corroborated_records[0].confidence, "double");
    assertEquals(result.warrant_result.payloads.length, 1);
    assertEquals(emitted.length, 1);
    assertEquals(loop.summary(T0).corroborated_drift_count, 1);
});

Deno.test("loop: no corroboration gate preserves single-observer emission", () => {
    const emitted: WarrantProposalPayload[] = [];
    const loop = new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
    );
    const peer = new TranslationPolicyMonitor(0xBB, registry([]));
    const result = loop.observeClaim(peer.localClaim(T0), T0);
    assertEquals(result.corroborated_records, []);
    assertEquals(result.warrant_result.payloads.length, 1);
    assertEquals(emitted.length, 1);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_INVESTIGATION_SCHEMA, "OMEGA-1680/v1");
});
