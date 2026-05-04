// Era 1970: Translation policy replay digest digest live wiring tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_LIVE_WIRING_SCHEMA,
    TranslationPolicyReplayDigestDigestLiveWiringAdapter,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_live_wiring.ts";
import {
    TranslationPolicyReplayDigestDigestQuorumTracker,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_quorum.ts";
import {
    buildTranslationPolicyReplayDigestDigestClaim,
    decodeTranslationPolicyReplayDigestDigestClaim,
    translationPolicyReplayDigestDigestPlasmidFields,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_claim.ts";
import {
    translationPolicyReplayDigestForensicReplayDigest,
} from "../../src/network/translation_policy/translation_policy_replay_digest_forensic_replay_digest.ts";
import type {
    TranslationPolicyReplayDigestForensicReplayClassification,
} from "../../src/network/translation_policy/translation_policy_replay_digest_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    final_band: "nominal" | "drift" = "drift",
): TranslationPolicyReplayDigestForensicReplayClassification {
    return {
        schema: "OMEGA-1920/v1",
        total_events: 1,
        classified_events: 1,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0,
        final_band,
        final_consensus_digest: final_band === "drift" ? 0xBBBB : 0xAAAA,
        band_timeline: [{
            band: final_band,
            start_ms: T0,
            end_ms: null,
            start_sequence: 0,
            end_sequence: null,
            event_hash: 0x10,
        }],
        consensus_digest_intervals: [{
            consensus_digest: final_band === "drift" ? 0xBBBB : 0xAAAA,
            start_ms: T0,
            end_ms: null,
            start_sequence: 0,
            end_sequence: null,
            consensus_count: final_band === "drift" ? 1 : 2,
            total_claims: 2,
            agreement_q16: final_band === "drift" ? 32_768 : 65_536,
        }],
        error_windows: [],
    };
}

function digest(final_band: "nominal" | "drift" = "drift") {
    return translationPolicyReplayDigestForensicReplayDigest(
        classification(final_band),
    );
}

function claim(peer_id: number, final_band: "nominal" | "drift" = "drift") {
    return buildTranslationPolicyReplayDigestDigestClaim(
        peer_id,
        0xC0 + peer_id,
        digest(final_band),
        T0,
    );
}

Deno.test("replay digest digest live wiring: starts and stops", async () => {
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
        },
    );
    assertEquals(adapter.isActive(), false);
    adapter.start();
    adapter.start();
    assertEquals(adapter.isActive(), true);
    adapter.stop();
    assertEquals(adapter.isActive(), false);
});

Deno.test("replay digest digest live wiring: claim event feeds quorum", async () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        tracker,
        source,
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
        },
    );
    adapter.start();
    const fields = translationPolicyReplayDigestDigestPlasmidFields(
        0xAA,
        claim(0xBB),
    );
    source.dispatch("translationPolicyReplayDigestDigestClaim", {
        body: fields.translationPolicyReplayDigestDigestBody,
        targetPeer: 0xAA,
        fromPeer: 0xBB,
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().claims_received, 1);
    assertEquals(adapter.telemetry().claims_observed, 1);
    assertEquals(tracker.snapshot(T0).consensus_count, 1);
});

Deno.test("replay digest digest live wiring: malformed events are counted", async () => {
    const source = new LocalEventSource();
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        source,
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
        },
    );
    adapter.start();
    source.dispatch("translationPolicyReplayDigestDigestClaim", {}); await new Promise(r => setTimeout(r, 0));
    source.dispatch("translationPolicyReplayDigestDigestClaim", { body: "not json" }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().claims_received, 2);
    assertEquals(adapter.telemetry().claims_malformed, 2);
});

Deno.test("replay digest digest live wiring: stop unsubscribes", async () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        tracker,
        source,
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
        },
    );
    adapter.start();
    adapter.stop();
    source.dispatch("translationPolicyReplayDigestDigestClaim", {
        body: JSON.stringify(claim(0xBB)),
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(adapter.telemetry().claims_received, 0);
    assertEquals(tracker.peerCount(T0), 0);
});

Deno.test("replay digest digest live wiring: custom event name", async () => {
    const source = new LocalEventSource();
    const tracker = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        tracker,
        source,
        { claim_event_name: "customReplayDigestDigest", now_ms: () => T0 },
    );
    adapter.start();
    source.dispatch("customReplayDigestDigest", {
        body: JSON.stringify(claim(0xBB)),
    }); await new Promise(r => setTimeout(r, 0));
    assertEquals(tracker.peerCount(T0), 1);
});

Deno.test("replay digest digest live wiring: emitLocalClaim sends provider digest", async () => {
    const sent: Array<{ target: number; body: string }> = [];
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
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
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(sent[0].body)?.peer_id,
        0xAA,
    );
    assertEquals(built?.witness_id, 0xCA);
    assertEquals(adapter.telemetry().local_claims_built, 1);
    assertEquals(adapter.telemetry().local_claims_emitted, 1);
});

Deno.test("replay digest digest live wiring: emitLocalClaim can use explicit digest", async () => {
    const sent: string[] = [];
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
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
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(sent[0])?.digest,
        d.digest,
    );
});

Deno.test("replay digest digest live wiring: emitLocalClaim failure is counted", async () => {
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
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

Deno.test("replay digest digest live wiring: emitLocalClaim skip paths are counted", async () => {
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
            digest_provider: () => null,
            claim_emit: () => true,
        },
    );
    assertEquals(adapter.emitLocalClaim(0xBB), null);
    assertEquals(adapter.telemetry().local_claims_skipped, 1);
});

Deno.test("replay digest digest live wiring: invalid local identity skips emit", async () => {
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        new TranslationPolicyReplayDigestDigestQuorumTracker(),
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
            local_peer_id: Number.NaN,
            local_witness_id: 0xCA,
            digest_provider: () => digest(),
            claim_emit: () => true,
        },
    );
    assertEquals(adapter.emitLocalClaim(0xBB), null);
    assertEquals(adapter.telemetry().local_claims_skipped, 1);
});

Deno.test("replay digest digest live wiring: snapshot proxies tracker", async () => {
    const tracker = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const adapter = new TranslationPolicyReplayDigestDigestLiveWiringAdapter(
        tracker,
        new LocalEventSource(),
        {
            claim_event_name: "translationPolicyReplayDigestDigestClaim",
            now_ms: () => T0,
        },
    );
    tracker.observe(claim(0xAA), T0);
    tracker.observe(claim(0xBB), T0);
    assertEquals(adapter.snapshot().band, "double");
});

Deno.test("replay digest digest live wiring: schema constant", async () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_LIVE_WIRING_SCHEMA,
        "OMEGA-1970/v1",
    );
});
