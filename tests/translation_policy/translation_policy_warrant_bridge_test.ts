// Era 1670: Translation policy drift → warrant proposal bridge tests.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { senateHash } from "../../src/network/quorum_warrant_bridge.ts";
import {
    DEFAULT_TRANSLATION_POLICY_WARRANT_OPTS,
    TRANSLATION_POLICY_WARRANT_SCHEMA,
    TranslationPolicyWarrantBridge,
    buildTranslationPolicyWarrantDescription,
} from "../../src/network/translation_policy/translation_policy_warrant_bridge.ts";
import {
    TranslationPolicyDriftEvent,
    buildTranslationPolicyClaim,
    translationPolicyDriftEvent,
} from "../../src/network/translation_policy/translation_policy_monitor.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import { ForensicEvent } from "../../src/network/forensic_event_sink.ts";

const T0 = 1_000_000;
const passthrough = (event: ForensicEvent) => event;

function registry(pairs: Array<[string, string]>): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, passthrough);
    return r;
}

function drift(peer_id = 0xBB): TranslationPolicyDriftEvent {
    const local = buildTranslationPolicyClaim(0xAA, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]), T0);
    const peer = buildTranslationPolicyClaim(peer_id, registry([]), T0);
    return translationPolicyDriftEvent(local, peer, T0 + 1);
}

Deno.test("description: deterministic and senate-sized", async () => {
    const d = buildTranslationPolicyWarrantDescription(drift(0xBB));
    assertEquals(d.startsWith("TPOL peer=0x000000bb local=0x"), true);
    assert(d.length <= 64);
    assertEquals(d, buildTranslationPolicyWarrantDescription(drift(0xBB)));
});

Deno.test("bridge: invalid opts throw", async () => {
    assertThrows(() => new TranslationPolicyWarrantBridge({ dedup_window_ms: 0 }));
});

Deno.test("bridge: empty events produce no payloads", async () => {
    const bridge = new TranslationPolicyWarrantBridge();
    assertEquals(await bridge.issue([], T0), { payloads: [], deduped_peer_ids: [] });
});

Deno.test("bridge: single drift event becomes senate-compatible proposal", async () => {
    const bridge = new TranslationPolicyWarrantBridge();
    const result = await bridge.issue([drift(0xBB)], T0);
    assertEquals(result.payloads.length, 1);
    const payload = result.payloads[0];
    assertEquals(payload.semanticType, "PROPOSAL");
    assertEquals(payload.target_peer_id, 0xBB);
    assertEquals(payload.issued_at_ms, T0);
    assertEquals(payload.proposalHash, await senateHash(payload.proposalDescription));
});

Deno.test("bridge: multiple drift events produce sorted input-order payloads", async () => {
    const bridge = new TranslationPolicyWarrantBridge();
    const result = await bridge.issue([drift(0xBB), drift(0xCC)], T0);
    assertEquals(result.payloads.map((p) => p.target_peer_id), [0xBB, 0xCC]);
});

Deno.test("bridge: dedup window blocks same peer/policy pair", async () => {
    const bridge = new TranslationPolicyWarrantBridge({ dedup_window_ms: 1000 });
    const event = drift(0xBB);
    assertEquals((await bridge.issue([event], T0)).payloads.length, 1);
    const repeat = await bridge.issue([event], T0 + 500);
    assertEquals(repeat.payloads.length, 0);
    assertEquals(repeat.deduped_peer_ids, [0xBB]);
});

Deno.test("bridge: dedup window elapsed allows reissue", async () => {
    const bridge = new TranslationPolicyWarrantBridge({ dedup_window_ms: 1000 });
    const event = drift(0xBB);
    await bridge.issue([event], T0);
    assertEquals((await bridge.issue([event], T0 + 1500)).payloads.length, 1);
});

Deno.test("bridge: different peer policy hash is a distinct issue", async () => {
    const bridge = new TranslationPolicyWarrantBridge({ dedup_window_ms: 60_000 });
    const first = drift(0xBB);
    const local = buildTranslationPolicyClaim(0xAA, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]), T0);
    const changedPeer = buildTranslationPolicyClaim(0xBB, registry([
        ["metrics:v1.0", "metrics:v2.0"],
    ]), T0);
    const second = translationPolicyDriftEvent(local, changedPeer, T0 + 1);
    assertEquals((await bridge.issue([first], T0)).payloads.length, 1);
    assertEquals((await bridge.issue([second], T0 + 10)).payloads.length, 1);
});

Deno.test("bridge: forget clears a specific policy-pair dedup key", async () => {
    const bridge = new TranslationPolicyWarrantBridge({ dedup_window_ms: 60_000 });
    const event = drift(0xBB);
    await bridge.issue([event], T0);
    bridge.forget(event);
    assertEquals((await bridge.issue([event], T0 + 100)).payloads.length, 1);
});

Deno.test("bridge: last issued snapshot sorted by dedup key", async () => {
    const bridge = new TranslationPolicyWarrantBridge();
    await bridge.issue([drift(0xCC), drift(0xAA), drift(0xBB)], T0);
    const keys = bridge.last_issued_snapshot().map((x) => x.key);
    assertEquals(keys, [...keys].sort());
});

Deno.test("defaults: dedup window is positive", async () => {
    assert(DEFAULT_TRANSLATION_POLICY_WARRANT_OPTS.dedup_window_ms > 0);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_WARRANT_SCHEMA, "OMEGA-1670/v1");
});
