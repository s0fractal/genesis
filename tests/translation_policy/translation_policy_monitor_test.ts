// Era 1650: Translation policy digest + drift alarm tests.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { sha256_u32 } from "../../src/sdk/phi_crypto.ts";
import { ForensicEvent } from "../../src/network/forensic_event_sink.ts";
import { ForensicEventSink } from "../../src/network/forensic_event_sink.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    TRANSLATION_POLICY_SCHEMA,
    TranslationPolicyMonitor,
    buildTranslationPolicyClaim,
    translationPolicyDigest,
    translationPolicyDigestFromPairs,
    translationPolicyDriftEvent,
} from "../../src/network/translation_policy/translation_policy_monitor.ts";

const T0 = 1_000_000;
const passthrough = (event: ForensicEvent) => event;

function registry(pairs: Array<[string, string]>): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) {
        r.register(source, target, passthrough);
    }
    return r;
}

Deno.test("digest: empty policy is FNV offset basis", async () => {
    assertEquals(translationPolicyDigest(registry([])), sha256_u32(new Uint8Array()));
});

Deno.test("digest: order-independent over canonical pairs", async () => {
    const a = translationPolicyDigestFromPairs([
        { source: "metrics:v1", target: "metrics:v2" },
        { source: "alarms:v1", target: "alarms:v2" },
    ]);
    const b = translationPolicyDigestFromPairs([
        { source: "alarms:v1", target: "alarms:v2" },
        { source: "metrics:v1", target: "metrics:v2" },
    ]);
    assertEquals(a, b);
});

Deno.test("claim: includes sorted pairs and stable hash", async () => {
    const r = registry([
        ["metrics:v1.0", "metrics:v2.0"],
        ["alarms:v1.0", "alarms:v2.0"],
    ]);
    const claim = buildTranslationPolicyClaim(0xAA, r, T0);
    assertEquals(claim.schema, TRANSLATION_POLICY_SCHEMA);
    assertEquals(claim.peer_id, 0xAA);
    assertEquals(claim.pair_count, 2);
    assertEquals(claim.pairs, [
        { source: "alarms:v1", target: "alarms:v2" },
        { source: "metrics:v1", target: "metrics:v2" },
    ]);
    assertEquals(claim.policy_hash, translationPolicyDigest(r));
});

Deno.test("drift event: deterministic for same inputs", async () => {
    const local = buildTranslationPolicyClaim(1, registry([["alarms:v1.0", "alarms:v2.0"]]), T0);
    const peer = buildTranslationPolicyClaim(2, registry([]), T0);
    assertEquals(
        translationPolicyDriftEvent(local, peer, T0 + 1),
        translationPolicyDriftEvent(local, peer, T0 + 1),
    );
});

Deno.test("monitor: matching policy produces no alarm", async () => {
    const r = registry([["alarms:v1.0", "alarms:v2.0"]]);
    const monitor = new TranslationPolicyMonitor(1, r);
    const peer = buildTranslationPolicyClaim(2, r, T0);
    const obs = monitor.observeClaim(peer, T0);
    assertEquals(obs.drift_detected, false);
    assertEquals(monitor.driftPeers(T0), []);
    assertEquals(monitor.recentAlarms().length, 0);
});

Deno.test("monitor: mismatched policy raises alarm and sinks forensic event", async () => {
    const local = registry([["alarms:v1.0", "alarms:v2.0"]]);
    const peerRegistry = registry([["alarms:v2.0", "alarms:v1.0"]]);
    const sink = new ForensicEventSink(8);
    const alarms: unknown[] = [];
    const monitor = new TranslationPolicyMonitor(1, local, {
        event_sink: sink,
        on_alarm: (e) => alarms.push(e),
    });
    const obs = monitor.observeClaim(
        buildTranslationPolicyClaim(2, peerRegistry, T0),
        T0,
    );
    assertEquals(obs.drift_detected, true);
    assertEquals(monitor.driftPeers(T0), [2]);
    assertEquals(monitor.recentAlarms().length, 1);
    assertEquals(alarms.length, 1);
    assertEquals(sink.size(), 1);
    assertEquals(sink.tail(1)[0].kind, "translation-policy-drift");
});

Deno.test("monitor: repeated same mismatch is deduped", async () => {
    const local = registry([["alarms:v1.0", "alarms:v2.0"]]);
    const peerRegistry = registry([]);
    const monitor = new TranslationPolicyMonitor(1, local);
    const claim = buildTranslationPolicyClaim(2, peerRegistry, T0);
    monitor.observeClaim(claim, T0);
    monitor.observeClaim(claim, T0 + 1);
    assertEquals(monitor.recentAlarms().length, 1);
});

Deno.test("monitor: new peer hash for same peer raises a new alarm", async () => {
    const local = registry([["alarms:v1.0", "alarms:v2.0"]]);
    const monitor = new TranslationPolicyMonitor(1, local);
    monitor.observeClaim(buildTranslationPolicyClaim(2, registry([]), T0), T0);
    monitor.observeClaim(
        buildTranslationPolicyClaim(
            2,
            registry([["metrics:v1.0", "metrics:v2.0"]]),
            T0 + 1,
        ),
        T0 + 1,
    );
    assertEquals(monitor.recentAlarms().length, 2);
});

Deno.test("monitor: TTL evicts stale observations", async () => {
    const monitor = new TranslationPolicyMonitor(1, registry([]), { ttl_ms: 10 });
    monitor.observeClaim(buildTranslationPolicyClaim(2, registry([]), T0), T0);
    assertEquals(monitor.snapshot(T0 + 9).length, 1);
    assertEquals(monitor.snapshot(T0 + 11).length, 0);
});

Deno.test("monitor: capacity evicts oldest peer", async () => {
    const monitor = new TranslationPolicyMonitor(1, registry([]), { capacity: 2 });
    monitor.observeClaim(buildTranslationPolicyClaim(2, registry([]), T0), T0);
    monitor.observeClaim(buildTranslationPolicyClaim(3, registry([]), T0), T0);
    monitor.observeClaim(buildTranslationPolicyClaim(4, registry([]), T0), T0);
    assertEquals(monitor.snapshot(T0).map((x) => x.peer_id), [3, 4]);
});

Deno.test("monitor: malformed schema rejected", async () => {
    const monitor = new TranslationPolicyMonitor(1, registry([]));
    const claim = buildTranslationPolicyClaim(2, registry([]), T0);
    assertThrows(() => monitor.observeClaim({ ...claim, schema: "bad" }, T0));
});

Deno.test("monitor: summary reports local policy and drift count", async () => {
    const local = registry([["alarms:v1.0", "alarms:v2.0"]]);
    const monitor = new TranslationPolicyMonitor(1, local);
    monitor.observeClaim(buildTranslationPolicyClaim(2, registry([]), T0), T0);
    const s = monitor.summary(T0);
    assertEquals(s.local_policy_hash, translationPolicyDigest(local));
    assertEquals(s.local_pair_count, 1);
    assertEquals(s.observed_peer_count, 1);
    assertEquals(s.drift_peer_count, 1);
    assertEquals(s.alarm_count, 1);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_SCHEMA, "OMEGA-1650/v1");
});
