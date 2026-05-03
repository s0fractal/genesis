// Era 1770: Translation policy runtime factory tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import { WarrantProposalPayload } from "../../src/network/quorum_warrant_bridge.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    buildTranslationPolicyCorroborationRaise,
} from "../../src/network/translation_policy/translation_policy_corroboration.ts";
import {
    buildTranslationPolicyClaim,
    translationPolicyDriftEvent,
} from "../../src/network/translation_policy/translation_policy_monitor.ts";
import {
    createTranslationPolicyRuntime,
    installTranslationPolicyRuntimeGlobal,
    TRANSLATION_POLICY_RUNTIME_FACTORY_SCHEMA,
    TranslationPolicyRuntimeFactoryOptions,
    TranslationPolicyRuntimeGlobalTarget,
} from "../../src/network/translation_policy/translation_policy_runtime_factory.ts";

const T0 = 1_000_000;

function registry(pairs: Array<[string, string]> = []): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, (event) => event);
    return r;
}

function makeFactory(overrides: Partial<TranslationPolicyRuntimeFactoryOptions> = {}) {
    const source = new LocalEventSource();
    const claimSends: Array<{ peer: number; body: string }> = [];
    const raiseSends: Array<{ peer: number; body: string }> = [];
    const warrants: WarrantProposalPayload[] = [];
    const result = createTranslationPolicyRuntime({
        local_peer_id: 0xAA,
        witness_id: 0xA1,
        registry: registry([["alarms:v1.0", "alarms:v2.0"]]),
        event_source: source,
        claim_emit: (peer: number, body: string) => {
            claimSends.push({ peer, body });
            return true;
        },
        raise_emit: (peer: number, body: string) => {
            raiseSends.push({ peer, body });
            return true;
        },
        warrant_emit: (proposal: WarrantProposalPayload) => {
            warrants.push(proposal);
            return true;
        },
        now_ms: () => T0,
        ...overrides,
    });
    return { result, source, claimSends, raiseSends, warrants };
}

Deno.test("factory: assembles runtime graph with schema marker", () => {
    const { result } = makeFactory();
    assertEquals(result.schema, TRANSLATION_POLICY_RUNTIME_FACTORY_SCHEMA);
    assertEquals(result.runtime.isActive(), false);
    assertEquals(result.runtime.telemetry(T0).peer_count, 0);
    assertEquals(result.loop.corroborationGate?.witness_id, 0xA1);
    assertEquals(result.loop.corroborationGate?.min_confidence, "double");
});

Deno.test("factory: auto_start starts live wiring and peer directory", () => {
    const { result } = makeFactory({ auto_start: true });
    const telemetry = result.runtime.telemetry(T0);
    assertEquals(result.runtime.isActive(), true);
    assertEquals(telemetry.live_active, true);
    assertEquals(telemetry.directory_active, true);
});

Deno.test("factory: mesh lifecycle feeds scheduler and tick broadcasts claim", () => {
    const { result, source, claimSends } = makeFactory({ auto_start: true });
    source.dispatch("meshPeerJoined", { peer_id: 0xBB });
    const tick = result.runtime.tick(T0);
    assertEquals(tick.broadcast.sent_count, 1);
    assertEquals(claimSends.map((x) => x.peer), [0xBB]);
    assertEquals(tick.telemetry.peer_count, 1);
});

Deno.test("factory: claim event observes drift and emits local corroboration raise", () => {
    const { result, source, raiseSends, warrants } = makeFactory({ auto_start: true });
    const peerClaim = buildTranslationPolicyClaim(
        0xBB,
        registry([["alarms:v1.0", "alarms:v3.0"]]),
        T0,
    );
    source.dispatch("translationPolicyClaim", {
        fromPeer: 0xBB,
        body: JSON.stringify(peerClaim),
    });
    const telemetry = result.runtime.telemetry(T0);
    assertEquals(telemetry.loop.corroboration_blocked, 1);
    assertEquals(telemetry.loop.proposals_emitted, 0);
    assertEquals(raiseSends.map((x) => x.peer), [0xBB]);
    assertEquals(warrants.length, 0);
});

Deno.test("factory: external corroboration plus changed claim reaches warrant emit", () => {
    const { result, source, warrants } = makeFactory({ auto_start: true });
    const peerClaim = buildTranslationPolicyClaim(
        0xBB,
        registry([["alarms:v1.0", "alarms:v3.0"]]),
        T0,
    );
    source.dispatch("translationPolicyClaim", {
        fromPeer: 0xBB,
        body: JSON.stringify(peerClaim),
    });
    const changedClaim = {
        ...peerClaim,
        policy_hash: peerClaim.policy_hash ^ 0xFFFF,
        pair_count: peerClaim.pair_count + 1,
        claimed_at_ms: T0 + 2,
    };
    const event = translationPolicyDriftEvent(
        result.monitor.localClaim(T0 + 2),
        changedClaim,
        T0 + 2,
    );
    const raise = buildTranslationPolicyCorroborationRaise(event, 0xB2, T0 + 1);
    source.dispatch("translationPolicyCorroborationRaise", {
        fromPeer: 0xB2,
        body: JSON.stringify(raise),
    });
    source.dispatch("translationPolicyClaim", {
        fromPeer: 0xBB,
        body: JSON.stringify(changedClaim),
    });
    assertEquals(warrants.length, 1);
    assertEquals(warrants[0].semanticType, "PROPOSAL");
    assertEquals(warrants[0].target_peer_id, 0xBB);
});

Deno.test("factory: install global exposes runtime and optional HUD config", () => {
    const { result } = makeFactory();
    const target: TranslationPolicyRuntimeGlobalTarget = {};
    const runtime = installTranslationPolicyRuntimeGlobal(result, target, {
        enabled: true,
        slot: "e",
    });
    assertEquals(runtime, result.runtime);
    assertEquals(target.__OMEGA_TRANSLATION_POLICY_RUNTIME__, result.runtime);
    assertEquals(target.__OMEGA_TRANSLATION_POLICY_HUD__, {
        enabled: true,
        slot: "e",
    });
});

Deno.test("factory: invalid identifiers are rejected", () => {
    let threw = false;
    try {
        makeFactory({ local_peer_id: Number.NaN });
    } catch {
        threw = true;
    }
    assertEquals(threw, true);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_RUNTIME_FACTORY_SCHEMA, "OMEGA-1770/v1");
});
