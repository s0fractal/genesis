// Era 1720: Translation policy broadcast scheduler tests.
import { assertEquals } from "jsr:@std/assert";
import { ForensicEvent } from "../../src/network/forensic_event_sink.ts";
import {
    TranslationPolicyMeshBridge,
    decodeTranslationPolicyMeshPayload,
} from "../../src/network/mesh_event_bridge.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    TRANSLATION_POLICY_BROADCAST_SCHEMA,
    TranslationPolicyBroadcastScheduler,
} from "../../src/network/translation_policy/translation_policy_broadcast_scheduler.ts";
import { TranslationPolicyMonitor } from "../../src/network/translation_policy/translation_policy_monitor.ts";

const T0 = 1_000_000;
const passthrough = (event: ForensicEvent) => event;

function registry(pairs: Array<[string, string]>): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, passthrough);
    return r;
}

function makeScheduler(
    pairs: Array<[string, string]> = [["alarms:v1.0", "alarms:v2.0"]],
    emitOk: (peer_id: number) => boolean = () => true,
) {
    const sent: Array<{ peer_id: number; body: string }> = [];
    const monitor = new TranslationPolicyMonitor(0xAA, registry(pairs));
    const bridge = new TranslationPolicyMeshBridge(monitor, (peer_id, body) => {
        sent.push({ peer_id, body });
        return emitOk(peer_id);
    });
    const scheduler = new TranslationPolicyBroadcastScheduler(bridge, {
        scheduler: {
            base_interval_ms: 1_000,
            backoff_multiplier: 2,
            max_backoff_ms: 10_000,
            failure_giveup_count: 2,
        },
        unchanged_rebroadcast_ms: 10_000,
    });
    return { scheduler, sent, monitor };
}

Deno.test("scheduler: first tick broadcasts to known peers in peer order", () => {
    const { scheduler, sent } = makeScheduler();
    scheduler.addPeer(0xCC);
    scheduler.addPeer(0xBB);
    const result = scheduler.tick(T0);
    assertEquals(result.schema, TRANSLATION_POLICY_BROADCAST_SCHEMA);
    assertEquals(result.sent_count, 2);
    assertEquals(sent.map((x) => x.peer_id), [0xBB, 0xCC]);
    assertEquals(result.decisions.map((x) => x.action), ["sent", "sent"]);
    assertEquals(decodeTranslationPolicyMeshPayload(sent[0].body)?.peer_id, 0xAA);
});

Deno.test("scheduler: cooldown blocks immediate repeat", () => {
    const { scheduler, sent } = makeScheduler();
    scheduler.addPeer(0xBB);
    scheduler.tick(T0);
    const second = scheduler.tick(T0 + 100);
    assertEquals(second.sent_count, 0);
    assertEquals(second.decisions[0].action, "cooldown");
    assertEquals(sent.length, 1);
});

Deno.test("scheduler: unchanged policy is suppressed after cooldown", () => {
    const { scheduler, sent } = makeScheduler();
    scheduler.addPeer(0xBB);
    scheduler.tick(T0);
    const second = scheduler.tick(T0 + 1_001);
    assertEquals(second.sent_count, 0);
    assertEquals(second.skipped_unchanged_count, 1);
    assertEquals(second.decisions[0].action, "unchanged");
    assertEquals(sent.length, 1);
});

Deno.test("scheduler: unchanged policy can rebroadcast after refresh horizon", () => {
    const { scheduler, sent } = makeScheduler();
    scheduler.addPeer(0xBB);
    scheduler.tick(T0);
    const second = scheduler.tick(T0 + 10_001);
    assertEquals(second.sent_count, 1);
    assertEquals(second.decisions[0].action, "sent");
    assertEquals(sent.length, 2);
});

Deno.test("scheduler: policy hash change bypasses unchanged suppression", () => {
    const sent: Array<{ peer_id: number; body: string }> = [];
    const r = registry([["alarms:v1.0", "alarms:v2.0"]]);
    const monitor = new TranslationPolicyMonitor(0xAA, r);
    const bridge = new TranslationPolicyMeshBridge(monitor, (peer_id, body) => {
        sent.push({ peer_id, body });
        return true;
    });
    const scheduler = new TranslationPolicyBroadcastScheduler(bridge, {
        scheduler: {
            base_interval_ms: 1_000,
            backoff_multiplier: 2,
            max_backoff_ms: 10_000,
            failure_giveup_count: 2,
        },
        unchanged_rebroadcast_ms: 10_000,
    });
    scheduler.addPeer(0xBB);
    scheduler.tick(T0);
    r.register("metrics:v1.0", "metrics:v2.0", passthrough);
    const second = scheduler.tick(T0 + 1_001);
    assertEquals(second.sent_count, 1);
    assertEquals(sent.length, 2);
    const first = decodeTranslationPolicyMeshPayload(sent[0].body)!;
    const updated = decodeTranslationPolicyMeshPayload(sent[1].body)!;
    assertEquals(first.policy_hash === updated.policy_hash, false);
});

Deno.test("scheduler: emit failure applies backoff and eventual cold classification", () => {
    const { scheduler } = makeScheduler([], () => false);
    scheduler.addPeer(0xBB);
    const first = scheduler.tick(T0);
    assertEquals(first.failed_count, 1);
    assertEquals(scheduler.snapshot()[0].consecutive_failures, 1);
    const early = scheduler.tick(T0 + 1_000);
    assertEquals(early.decisions[0].action, "cooldown");
    const second = scheduler.tick(T0 + 2_001);
    assertEquals(second.failed_count, 1);
    assertEquals(scheduler.snapshot()[0].consecutive_failures, 2);
    const cold = scheduler.tick(T0 + 20_000);
    assertEquals(cold.cold_count, 1);
    assertEquals(cold.decisions[0].action, "cold");
});

Deno.test("scheduler: max_peers limits attempts but leaves later peers on cooldown decision", () => {
    const { scheduler, sent } = makeScheduler();
    scheduler.addPeer(0x10);
    scheduler.addPeer(0x20);
    scheduler.addPeer(0x30);
    const result = scheduler.tick(T0, 2);
    assertEquals(result.sent_count, 2);
    assertEquals(sent.map((x) => x.peer_id), [0x10, 0x20]);
    assertEquals(result.decisions.map((x) => x.action), ["sent", "sent", "cooldown"]);
});

Deno.test("scheduler: duePeers excludes cooldown and cold peers", () => {
    const { scheduler } = makeScheduler([], (peer_id) => peer_id !== 0xCC);
    scheduler.addPeer(0xBB);
    scheduler.addPeer(0xCC);
    scheduler.tick(T0);
    scheduler.tick(T0 + 2_001);
    assertEquals(scheduler.snapshot().find((x) => x.peer_id === 0xCC)?.consecutive_failures, 2);
    assertEquals(scheduler.duePeers(T0 + 20_000), [0xBB]);
});

Deno.test("scheduler: recordExternalSuccess seeds unchanged suppression", () => {
    const { scheduler, monitor, sent } = makeScheduler();
    const claim = monitor.localClaim(T0);
    scheduler.recordExternalSuccess(0xBB, claim, T0);
    const result = scheduler.tick(T0 + 1_001);
    assertEquals(result.skipped_unchanged_count, 1);
    assertEquals(sent.length, 0);
});

Deno.test("scheduler: remove and clear manage peer table", () => {
    const { scheduler } = makeScheduler();
    scheduler.addPeer(0xBB);
    scheduler.addPeer(0xCC);
    assertEquals(scheduler.peerCount(), 2);
    assertEquals(scheduler.removePeer(0xBB), true);
    assertEquals(scheduler.snapshot().map((x) => x.peer_id), [0xCC]);
    scheduler.clear();
    assertEquals(scheduler.peerCount(), 0);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_BROADCAST_SCHEMA, "OMEGA-1720/v1");
});
