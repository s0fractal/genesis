// Era 1710: Translation policy live wiring adapter tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import { WarrantProposalPayload } from "../../src/network/quorum_warrant_bridge.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    TRANSLATION_POLICY_LIVE_WIRING_SCHEMA,
    TranslationPolicyLiveWiringAdapter,
} from "../../src/network/translation_policy/translation_policy_live_wiring_adapter.ts";
import {
    TranslationPolicyInvestigationLoop,
} from "../../src/network/translation_policy/translation_policy_investigation_loop.ts";
import {
    TranslationPolicyMonitor,
    translationPolicyDriftEvent,
} from "../../src/network/translation_policy/translation_policy_monitor.ts";
import {
    decodeTranslationPolicyCorroborationMeshPayload,
    translationPolicyPlasmidFields,
} from "../../src/network/mesh_event_bridge.ts";
import {
    TranslationPolicyCorroborationTracker,
    buildTranslationPolicyCorroborationRaise,
} from "../../src/network/translation_policy/translation_policy_corroboration.ts";
import { TranslationPolicyWarrantBridge } from "../../src/network/translation_policy/translation_policy_warrant_bridge.ts";
import { ForensicEvent } from "../../src/network/forensic_event_sink.ts";

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

function peerMonitor(peer_id = 0xBB): TranslationPolicyMonitor {
    return new TranslationPolicyMonitor(peer_id, registry([]));
}

function makeLoop(
    emitted: WarrantProposalPayload[] = [],
    tracker?: TranslationPolicyCorroborationTracker,
): TranslationPolicyInvestigationLoop {
    return new TranslationPolicyInvestigationLoop(
        localMonitor(),
        (p) => {
            emitted.push(p);
            return true;
        },
        new TranslationPolicyWarrantBridge({ dedup_window_ms: 60_000 }),
        tracker
            ? { tracker, witness_id: 0xA1, min_confidence: "double" }
            : undefined,
    );
}

Deno.test("adapter: starts and stops", async () => {
    const source = new LocalEventSource();
    const adapter = new TranslationPolicyLiveWiringAdapter(makeLoop(), source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    assertEquals(adapter.isActive(), false);
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.stop();
    assertEquals(adapter.isActive(), false);
});

Deno.test("adapter: claim event routes into investigation loop", async () => {
    const emitted: WarrantProposalPayload[] = [];
    const source = new LocalEventSource();
    const loop = makeLoop(emitted);
    const adapter = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    adapter.start();
    const fields = translationPolicyPlasmidFields(0xAA, peerMonitor().localClaim(T0));
    source.dispatch("translationPolicyClaim", {
        body: fields.translationPolicyBody,
        targetPeer: 0xAA,
        fromPeer: 0xBB,
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(emitted.length, 1);
    assertEquals(emitted[0].target_peer_id, 0xBB);
    assertEquals(adapter.telemetry().claims_received, 1);
    assertEquals(adapter.telemetry().claims_observed, 1);
});

Deno.test("adapter: malformed claim payload is counted", async () => {
    const source = new LocalEventSource();
    const loop = makeLoop();
    const adapter = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    adapter.start();
    source.dispatch("translationPolicyClaim", {}); await new Promise(r => setTimeout(r, 0));
    source.dispatch("translationPolicyClaim", { body: "not json" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().claims_received, 2);
    assertEquals(adapter.telemetry().claims_malformed, 2);
    assertEquals(loop.summary(T0).malformed_claims, 1);
});

Deno.test("adapter: corroboration raise event records into loop tracker", async () => {
    const tracker = new TranslationPolicyCorroborationTracker();
    const source = new LocalEventSource();
    const loop = makeLoop([], tracker);
    const adapter = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    const local = localMonitor();
    const peer = peerMonitor();
    const drift = translationPolicyDriftEvent(local.localClaim(T0), peer.localClaim(T0), T0);
    const raise = buildTranslationPolicyCorroborationRaise(drift, 0xC0, T0);
    adapter.start();
    source.dispatch("translationPolicyCorroborationRaise", {
        body: JSON.stringify(raise),
        targetPeer: 0xAA,
        fromPeer: 0xC0,
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().corroboration_raises_recorded, 1);
    assertEquals(tracker.get(raise.drift_hash)?.witnessed_by, [0xC0]);
});

Deno.test("adapter: malformed corroboration raise is counted", async () => {
    const tracker = new TranslationPolicyCorroborationTracker();
    const source = new LocalEventSource();
    const loop = makeLoop([], tracker);
    const adapter = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    adapter.start();
    source.dispatch("translationPolicyCorroborationRaise", { body: "not json" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().corroboration_raises_received, 1);
    assertEquals(adapter.telemetry().corroboration_raises_malformed, 1);
});

Deno.test("adapter: stop unsubscribes from source", async () => {
    const emitted: WarrantProposalPayload[] = [];
    const source = new LocalEventSource();
    const adapter = new TranslationPolicyLiveWiringAdapter(makeLoop(emitted), source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    adapter.start();
    adapter.stop();
    const fields = translationPolicyPlasmidFields(0xAA, peerMonitor().localClaim(T0));
    source.dispatch("translationPolicyClaim", { body: fields.translationPolicyBody }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().claims_received, 0);
    assertEquals(emitted.length, 0);
});

Deno.test("adapter: optional local raise emit follows local drift observation", async () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyCorroborationTracker();
    const emittedRaises: Array<{ target: number; body: string }> = [];
    const loop = makeLoop([], tracker);
    const adapter = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: true,
        now_ms: () => T0,
        raise_emit: (target, body) => {
            emittedRaises.push({ target, body });
            return true;
        },
    });
    adapter.start();
    const fields = translationPolicyPlasmidFields(0xAA, peerMonitor().localClaim(T0));
    source.dispatch("translationPolicyClaim", {
        body: fields.translationPolicyBody,
        targetPeer: 0xAA,
        fromPeer: 0xBB,
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(emittedRaises.length, 1);
    assertEquals(emittedRaises[0].target, 0xBB);
    const decoded = decodeTranslationPolicyCorroborationMeshPayload(emittedRaises[0].body);
    assertEquals(decoded?.witness_id, 0xA1);
    assertEquals(decoded?.peer_id, 0xBB);
    assertEquals(adapter.telemetry().local_raises_built, 1);
    assertEquals(adapter.telemetry().local_raises_emitted, 1);
});

Deno.test("adapter: custom raise target resolver deduplicates targets", async () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyCorroborationTracker();
    const targets: number[] = [];
    const loop = makeLoop([], tracker);
    const adapter = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: true,
        now_ms: () => T0,
        raise_emit: (target) => {
            targets.push(target);
            return true;
        },
        raise_targets: () => [0x10, 0x10, 0x20],
    });
    adapter.start();
    const fields = translationPolicyPlasmidFields(0xAA, peerMonitor().localClaim(T0));
    source.dispatch("translationPolicyClaim", {
        body: fields.translationPolicyBody,
        fromPeer: 0xBB,
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(targets, [0x10, 0x20]);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_LIVE_WIRING_SCHEMA, "OMEGA-1710/v1");
});
