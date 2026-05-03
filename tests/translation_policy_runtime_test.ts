// Era 1740: Translation policy runtime orchestrator tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEvent } from "../src/network/forensic_event_sink.ts";
import { TranslationPolicyMeshBridge } from "../src/network/mesh_event_bridge.ts";
import { LocalEventSource } from "../src/network/quarantine_lifecycle_bridge.ts";
import { WarrantProposalPayload } from "../src/network/quorum_warrant_bridge.ts";
import { SchemaTranslatorRegistry } from "../src/network/schema_translator.ts";
import { TranslationPolicyBroadcastScheduler } from "../src/network/translation_policy_broadcast_scheduler.ts";
import { TranslationPolicyCorroborationTracker } from "../src/network/translation_policy_corroboration.ts";
import { TranslationPolicyInvestigationLoop } from "../src/network/translation_policy_investigation_loop.ts";
import { TranslationPolicyLiveWiringAdapter } from "../src/network/translation_policy_live_wiring_adapter.ts";
import { TranslationPolicyMonitor } from "../src/network/translation_policy_monitor.ts";
import { TranslationPolicyPeerDirectoryAdapter } from "../src/network/translation_policy_peer_directory.ts";
import {
    TRANSLATION_POLICY_RUNTIME_SCHEMA,
    TranslationPolicyRuntime,
} from "../src/network/translation_policy_runtime.ts";
import { TranslationPolicyWarrantBridge } from "../src/network/translation_policy_warrant_bridge.ts";

const T0 = 1_000_000;
const passthrough = (event: ForensicEvent) => event;

function registry(pairs: Array<[string, string]>): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, passthrough);
    return r;
}

function makeRuntime() {
    const source = new LocalEventSource();
    const sentClaims: Array<{ peer: number; body: string }> = [];
    const emittedWarrants: WarrantProposalPayload[] = [];
    const monitor = new TranslationPolicyMonitor(0xAA, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]));
    const meshBridge = new TranslationPolicyMeshBridge(monitor, (peer, body) => {
        sentClaims.push({ peer, body });
        return true;
    });
    const scheduler = new TranslationPolicyBroadcastScheduler(meshBridge, {
        scheduler: {
            base_interval_ms: 1_000,
            backoff_multiplier: 2,
            max_backoff_ms: 10_000,
            failure_giveup_count: 2,
        },
        unchanged_rebroadcast_ms: 10_000,
    });
    const tracker = new TranslationPolicyCorroborationTracker();
    const loop = new TranslationPolicyInvestigationLoop(
        monitor,
        (p) => {
            emittedWarrants.push(p);
            return true;
        },
        new TranslationPolicyWarrantBridge({ dedup_window_ms: 60_000 }),
        { tracker, witness_id: 0xA1, min_confidence: "double" },
    );
    const live = new TranslationPolicyLiveWiringAdapter(loop, source, {
        claim_event_name: "translationPolicyClaim",
        corroboration_event_name: "translationPolicyCorroborationRaise",
        emit_local_raises: false,
        now_ms: () => T0,
    });
    const directory = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    const runtime = new TranslationPolicyRuntime(live, directory, scheduler);
    return { runtime, source, sentClaims, emittedWarrants, scheduler };
}

Deno.test("runtime: start/stop controls live wiring and directory", () => {
    const { runtime } = makeRuntime();
    assertEquals(runtime.isActive(), false);
    runtime.start();
    assertEquals(runtime.isActive(), true);
    assertEquals(runtime.telemetry(T0).live_active, true);
    assertEquals(runtime.telemetry(T0).directory_active, true);
    runtime.start();
    assertEquals(runtime.isActive(), true);
    runtime.stop();
    assertEquals(runtime.isActive(), false);
    assertEquals(runtime.telemetry(T0).live_active, false);
    assertEquals(runtime.telemetry(T0).directory_active, false);
});

Deno.test("runtime: lifecycle event populates scheduler and tick broadcasts", () => {
    const { runtime, source, sentClaims } = makeRuntime();
    runtime.start();
    source.dispatch("meshPeerJoined", { peer_id: 0xBB });
    const result = runtime.tick(T0);
    assertEquals(result.schema, TRANSLATION_POLICY_RUNTIME_SCHEMA);
    assertEquals(result.broadcast.sent_count, 1);
    assertEquals(sentClaims.map((x) => x.peer), [0xBB]);
    assertEquals(result.telemetry.peer_count, 1);
});

Deno.test("runtime: activity event is enough to discover peer", () => {
    const { runtime, source, sentClaims } = makeRuntime();
    runtime.start();
    source.dispatch("translationPolicyClaim", { fromPeer: 0xCC, body: "not json" });
    const tele = runtime.telemetry(T0);
    assertEquals(tele.directory.activity_peers_seen, 1);
    assertEquals(tele.live.claims_malformed, 1);
    assertEquals(tele.peer_count, 1);
    runtime.tick(T0);
    assertEquals(sentClaims.map((x) => x.peer), [0xCC]);
});

Deno.test("runtime: max_peers delegates to scheduler tick", () => {
    const { runtime, source, sentClaims } = makeRuntime();
    runtime.start();
    source.dispatch("meshPeerJoined", { peer_id: 0x10 });
    source.dispatch("meshPeerJoined", { peer_id: 0x20 });
    const result = runtime.tick(T0, 1);
    assertEquals(result.broadcast.sent_count, 1);
    assertEquals(sentClaims.map((x) => x.peer), [0x10]);
    assertEquals(result.broadcast.decisions.map((x) => x.action), ["sent", "cooldown"]);
});

Deno.test("runtime: stop unsubscribes both adapters", () => {
    const { runtime, source, scheduler } = makeRuntime();
    runtime.start();
    runtime.stop();
    source.dispatch("meshPeerJoined", { peer_id: 0xBB });
    source.dispatch("translationPolicyClaim", { fromPeer: 0xCC, body: "not json" });
    const tele = runtime.telemetry(T0);
    assertEquals(scheduler.peerCount(), 0);
    assertEquals(tele.directory.joined_received, 0);
    assertEquals(tele.live.claims_received, 0);
});

Deno.test("runtime: telemetry includes loop summary", () => {
    const { runtime, source } = makeRuntime();
    runtime.start();
    source.dispatch("translationPolicyClaim", { fromPeer: 0xCC, body: "not json" });
    const tele = runtime.telemetry(T0);
    assertEquals(tele.schema, TRANSLATION_POLICY_RUNTIME_SCHEMA);
    assertEquals(tele.loop.malformed_claims, 1);
    assertEquals(tele.due_peer_count, 1);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_RUNTIME_SCHEMA, "OMEGA-1740/v1");
});
