// Era 1730: Translation policy peer directory integration tests.
import { assertEquals } from "jsr:@std/assert";
import { sha256_u32 } from "../../src/sdk/phi_crypto.ts";
import { ForensicEvent } from "../../src/network/forensic_event_sink.ts";
import { TranslationPolicyMeshBridge } from "../../src/network/mesh_event_bridge.ts";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import { TranslationPolicyBroadcastScheduler } from "../../src/network/translation_policy/translation_policy_broadcast_scheduler.ts";
import { TranslationPolicyMonitor } from "../../src/network/translation_policy/translation_policy_monitor.ts";
import {
    TRANSLATION_POLICY_PEER_DIRECTORY_SCHEMA,
    TranslationPolicyPeerDirectoryAdapter,
    deriveTranslationPolicyPeerId,
} from "../../src/network/translation_policy/translation_policy_peer_directory.ts";

const passthrough = (event: ForensicEvent) => event;

function registry(): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", passthrough);
    return r;
}

function makeScheduler(): TranslationPolicyBroadcastScheduler {
    const monitor = new TranslationPolicyMonitor(0xAA, registry());
    const bridge = new TranslationPolicyMeshBridge(monitor, () => true);
    return new TranslationPolicyBroadcastScheduler(bridge, {
        scheduler: {
            base_interval_ms: 1_000,
            backoff_multiplier: 2,
            max_backoff_ms: 10_000,
            failure_giveup_count: 2,
        },
        unchanged_rebroadcast_ms: 10_000,
    });
}

Deno.test("derivePeerId: numeric input is normalized to u32", async () => {
    assertEquals(deriveTranslationPolicyPeerId(-1), 0xFFFF_FFFF);
    assertEquals(deriveTranslationPolicyPeerId(0x1_0000_0001), 1);
});

Deno.test("derivePeerId: string input hashes deterministically", async () => {
    const expected = sha256_u32(new TextEncoder().encode("peer-alpha"));
    assertEquals(deriveTranslationPolicyPeerId("peer-alpha"), expected);
    assertEquals(deriveTranslationPolicyPeerId(""), null);
});

Deno.test("directory: starts and stops", async () => {
    const source = new LocalEventSource();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(makeScheduler(), source);
    assertEquals(adapter.isActive(), false);
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.stop();
    assertEquals(adapter.isActive(), false);
});

Deno.test("directory: join event adds numeric peer", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("meshPeerJoined", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.snapshot().map((x) => x.peer_id), [0xBB]);
    assertEquals(adapter.telemetry().peers_added, 1);
});

Deno.test("directory: join event hashes string peerId", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("meshPeerJoined", { peerId: "peer-bravo" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.snapshot()[0].peer_id, deriveTranslationPolicyPeerId("peer-bravo"));
});

Deno.test("directory: left event removes peer", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("meshPeerJoined", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("meshPeerLeft", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.peerCount(), 0);
    assertEquals(adapter.telemetry().peers_removed, 1);
});

Deno.test("directory: duplicate left event is harmless", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("meshPeerJoined", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("meshPeerLeft", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("meshPeerLeft", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.peerCount(), 0);
    assertEquals(adapter.telemetry().left_received, 2);
    assertEquals(adapter.telemetry().peers_removed, 1);
});

Deno.test("directory: translation policy claim activity adds sender", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("translationPolicyClaim", { fromPeer: 0xCC, body: "{}" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.snapshot().map((x) => x.peer_id), [0xCC]);
    assertEquals(adapter.telemetry().activity_peers_seen, 1);
});

Deno.test("directory: corroboration activity hashes string sender", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("translationPolicyCorroborationRaise", {
        fromPeer: "peer-charlie",
        body: "{}",
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.snapshot()[0].peer_id, deriveTranslationPolicyPeerId("peer-charlie"));
});

Deno.test("directory: malformed lifecycle/activity events are counted", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    source.dispatch("meshPeerJoined", {}); await new Promise(r => setTimeout(r, 0));
    source.dispatch("meshPeerLeft", null); await new Promise(r => setTimeout(r, 0));
    source.dispatch("translationPolicyClaim", { body: "{}" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().malformed_events, 3);
    assertEquals(scheduler.peerCount(), 0);
});

Deno.test("directory: stop unsubscribes all listeners", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source);
    adapter.start();
    adapter.stop();
    source.dispatch("meshPeerJoined", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("translationPolicyClaim", { fromPeer: 0xCC }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().joined_received, 0);
    assertEquals(adapter.telemetry().activity_received, 0);
    assertEquals(scheduler.peerCount(), 0);
});

Deno.test("directory: configurable event names and peer derivation", async () => {
    const source = new LocalEventSource();
    const scheduler = makeScheduler();
    const adapter = new TranslationPolicyPeerDirectoryAdapter(scheduler, source, {
        joined_event_name: "join",
        left_event_name: "leave",
        activity_event_names: ["active"],
        derive_peer_id: (raw) => typeof raw === "string" ? raw.length : null,
    });
    adapter.start();
    source.dispatch("join", { peerId: "abcd" }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("active", { fromPeer: "xy" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(scheduler.snapshot().map((x) => x.peer_id), [2, 4]);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_PEER_DIRECTORY_SCHEMA, "OMEGA-1730/v1");
});
