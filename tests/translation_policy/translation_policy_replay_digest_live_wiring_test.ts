// Era 1890: Translation policy replay digest live wiring tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_LIVE_WIRING_SCHEMA,
    TranslationPolicyReplayDigestLiveWiringAdapter,
} from "../../src/network/translation_policy/translation_policy_replay_digest_live_wiring.ts";
import {
    TranslationPolicyReplayDigestQuorumTracker,
} from "../../src/network/translation_policy/translation_policy_replay_digest_quorum.ts";
import {
    buildTranslationPolicyReplayDigestClaim,
    decodeTranslationPolicyReplayDigestClaim,
    translationPolicyReplayDigestPlasmidFields,
} from "../../src/network/translation_policy/translation_policy_replay_digest_claim.ts";
import {
    translationPolicyForensicReplayDigest,
} from "../../src/network/translation_policy/translation_policy_forensic_replay_digest.ts";
import type {
    TranslationPolicyForensicReplayClassification,
} from "../../src/network/translation_policy/translation_policy_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    final_band: "nominal" | "blocked" = "blocked",
): TranslationPolicyForensicReplayClassification {
    return {
        schema: "OMEGA-1840/v1",
        total_events: 1,
        classified_events: 1,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0,
        final_band,
        final_policy_hash: final_band === "blocked" ? 0xBBBB : 0xAAAA,
        band_timeline: [{
            band: final_band,
            start_ms: T0,
            end_ms: null,
            start_sequence: 0,
            end_sequence: null,
            event_hash: 0x10,
        }],
        policy_hash_intervals: [{
            local_policy_hash: final_band === "blocked" ? 0xBBBB : 0xAAAA,
            start_ms: T0,
            end_ms: null,
            start_sequence: 0,
            end_sequence: null,
            local_pair_count: 1,
        }],
        error_windows: [],
    };
}

function digest(final_band: "nominal" | "blocked" = "blocked") {
    return translationPolicyForensicReplayDigest(classification(final_band));
}

function claim(peer_id: number, final_band: "nominal" | "blocked" = "blocked") {
    return buildTranslationPolicyReplayDigestClaim(
        peer_id,
        0xC0 + peer_id,
        digest(final_band),
        T0,
    );
}

Deno.test("replay digest live wiring: starts and stops", () => {
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestQuorumTracker(),
        new LocalEventSource(),
        { claim_event_name: "translationPolicyReplayDigestClaim", now_ms: () => T0 },
    );
    assertEquals(adapter.isActive(), false);
    adapter.start();
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.stop();
    assertEquals(adapter.isActive(), false);
});

Deno.test("replay digest live wiring: claim event feeds quorum", () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyReplayDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        tracker,
        source,
        { claim_event_name: "translationPolicyReplayDigestClaim", now_ms: () => T0 },
    );
    adapter.start();
    const fields = translationPolicyReplayDigestPlasmidFields(0xAA, claim(0xBB));
    source.dispatch("translationPolicyReplayDigestClaim", {
        body: fields.translationPolicyReplayDigestBody,
        targetPeer: 0xAA,
        fromPeer: 0xBB,
    });
    assertEquals(adapter.telemetry().claims_received, 1);
    assertEquals(adapter.telemetry().claims_observed, 1);
    assertEquals(tracker.snapshot(T0).consensus_count, 1);
});

Deno.test("replay digest live wiring: malformed events are counted", () => {
    const source = new LocalEventSource();
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestQuorumTracker(),
        source,
        { claim_event_name: "translationPolicyReplayDigestClaim", now_ms: () => T0 },
    );
    adapter.start();
    source.dispatch("translationPolicyReplayDigestClaim", {});
    source.dispatch("translationPolicyReplayDigestClaim", { body: "not json" });
    assertEquals(adapter.telemetry().claims_received, 2);
    assertEquals(adapter.telemetry().claims_malformed, 2);
});

Deno.test("replay digest live wiring: stop unsubscribes", () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyReplayDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        tracker,
        source,
        { claim_event_name: "translationPolicyReplayDigestClaim", now_ms: () => T0 },
    );
    adapter.start();
    adapter.stop();
    source.dispatch("translationPolicyReplayDigestClaim", {
        body: JSON.stringify(claim(0xBB)),
    });
    assertEquals(adapter.telemetry().claims_received, 0);
    assertEquals(tracker.peerCount(T0), 0);
});

Deno.test("replay digest live wiring: custom event name", () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyReplayDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        tracker,
        source,
        { claim_event_name: "customReplayDigest", now_ms: () => T0 },
    );
    adapter.start();
    source.dispatch("customReplayDigest", { body: JSON.stringify(claim(0xBB)) });
    assertEquals(tracker.peerCount(T0), 1);
});

Deno.test("replay digest live wiring: emitLocalClaim sends provider digest", () => {
    const sent: Array<{ target: number; body: string }> = [];
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestClaim",
            now_ms: () => T0,
            local_peer_id: 0xAA,
            local_witness_id: 0xCA,
            digest_provider: () => digest(),
            claim_emit: (target, body) => {
                sent.push({ target, body });
                return true;
            },
        },
    );
    const built = adapter.emitLocalClaim(0xBB);
    assertEquals(sent.length, 1);
    assertEquals(sent[0].target, 0xBB);
    assertEquals(decodeTranslationPolicyReplayDigestClaim(sent[0].body)?.peer_id, 0xAA);
    assertEquals(built?.witness_id, 0xCA);
    assertEquals(adapter.telemetry().local_claims_built, 1);
    assertEquals(adapter.telemetry().local_claims_emitted, 1);
});

Deno.test("replay digest live wiring: emitLocalClaim can use explicit digest", () => {
    const sent: string[] = [];
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestClaim",
            now_ms: () => T0,
            local_peer_id: 0xAA,
            local_witness_id: 0xCA,
            claim_emit: (_target, body) => {
                sent.push(body);
                return true;
            },
        },
    );
    const d = digest("nominal");
    adapter.emitLocalClaim(0xBB, d);
    assertEquals(decodeTranslationPolicyReplayDigestClaim(sent[0])?.digest, d.digest);
});

Deno.test("replay digest live wiring: emitLocalClaim failure is counted", () => {
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestClaim",
            now_ms: () => T0,
            local_peer_id: 0xAA,
            local_witness_id: 0xCA,
            digest_provider: () => digest(),
            claim_emit: () => false,
        },
    );
    assertEquals(adapter.emitLocalClaim(0xBB), null);
    assertEquals(adapter.telemetry().local_claims_built, 1);
    assertEquals(adapter.telemetry().local_claims_failed, 1);
});

Deno.test("replay digest live wiring: emitLocalClaim skip paths are counted", () => {
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestClaim",
            now_ms: () => T0,
            digest_provider: () => null,
            claim_emit: () => true,
        },
    );
    assertEquals(adapter.emitLocalClaim(0xBB), null);
    assertEquals(adapter.telemetry().local_claims_skipped, 1);
});

Deno.test("replay digest live wiring: snapshot proxies tracker", () => {
    const tracker = new TranslationPolicyReplayDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestLiveWiringAdapter(
        tracker,
        new LocalEventSource(),
        { claim_event_name: "translationPolicyReplayDigestClaim", now_ms: () => T0 },
    );
    tracker.observe(claim(0xAA), T0);
    tracker.observe(claim(0xBB), T0);
    assertEquals(adapter.snapshot().band, "double");
});

Deno.test("schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_LIVE_WIRING_SCHEMA,
        "OMEGA-1890/v1",
    );
});
