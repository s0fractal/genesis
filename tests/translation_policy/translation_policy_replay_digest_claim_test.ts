// Era 1870: Translation policy replay digest wire-claim tests.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
    buildTranslationPolicyReplayDigestClaim,
    decodeTranslationPolicyReplayDigestClaim,
    sameTranslationPolicyReplayDigestClaim,
    TRANSLATION_POLICY_REPLAY_DIGEST_CLAIM_SCHEMA,
    TranslationPolicyReplayDigestClaimBridge,
    translationPolicyReplayDigestClaimMatchesDigest,
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
        total_events: 2,
        classified_events: 2,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0 + 100,
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

Deno.test("replay digest claim: builds compact claim from digest", async () => {
    const digest = translationPolicyForensicReplayDigest(classification());
    const claim = buildTranslationPolicyReplayDigestClaim(
        0x1_0000_0001,
        0xCA,
        digest,
        T0,
    );
    assertEquals(claim.schema, TRANSLATION_POLICY_REPLAY_DIGEST_CLAIM_SCHEMA);
    assertEquals(claim.peer_id, 1);
    assertEquals(claim.witness_id, 0xCA);
    assertEquals(claim.digest, digest.digest);
    assertEquals(claim.band_timeline_hash, digest.band_timeline_hash);
    assertEquals(claim.final_band, "blocked");
});

Deno.test("replay digest claim: JSON decode round-trips", async () => {
    const digest = translationPolicyForensicReplayDigest(classification());
    const claim = buildTranslationPolicyReplayDigestClaim(0xAA, 0xCA, digest, T0);
    const decoded = decodeTranslationPolicyReplayDigestClaim(JSON.stringify(claim));
    assertEquals(decoded, claim);
});

Deno.test("replay digest claim: decoder rejects malformed shapes", async () => {
    const digest = translationPolicyForensicReplayDigest(classification());
    const claim = buildTranslationPolicyReplayDigestClaim(0xAA, 0xCA, digest, T0);
    assertEquals(decodeTranslationPolicyReplayDigestClaim("not json"), null);
    assertEquals(decodeTranslationPolicyReplayDigestClaim("[]"), null);
    assertEquals(
        decodeTranslationPolicyReplayDigestClaim(JSON.stringify({
            ...claim,
            schema: "OMEGA-1871/v1",
        })),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestClaim(JSON.stringify({
            ...claim,
            digest_schema: "OMEGA-9999/v1",
        })),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestClaim(JSON.stringify({
            ...claim,
            digest: -1,
        })),
        null,
    );
});

Deno.test("replay digest claim: plasmid fields carry target and body", async () => {
    const digest = translationPolicyForensicReplayDigest(classification());
    const claim = buildTranslationPolicyReplayDigestClaim(0xAA, 0xCA, digest, T0);
    const fields = translationPolicyReplayDigestPlasmidFields(0xBB, claim);
    assertEquals(fields.translationPolicyReplayDigestTarget, 0xBB);
    assertEquals(
        decodeTranslationPolicyReplayDigestClaim(
            fields.translationPolicyReplayDigestBody,
        )?.digest,
        digest.digest,
    );
});

Deno.test("replay digest claim bridge: sends and tracks counters", async () => {
    let captured_target = 0;
    let captured_body = "";
    const bridge = new TranslationPolicyReplayDigestClaimBridge(
        0xAA,
        0xCA,
        (target, body) => {
            captured_target = target;
            captured_body = body;
            return true;
        },
    );
    const digest = translationPolicyForensicReplayDigest(classification());
    assert(bridge.sendDigestClaim(0xBB, digest, T0));
    assertEquals(bridge.sent_count, 1);
    assertEquals(bridge.last_target, 0xBB);
    assertEquals(captured_target, 0xBB);
    assertEquals(decodeTranslationPolicyReplayDigestClaim(captured_body)?.peer_id, 0xAA);
});

Deno.test("replay digest claim bridge: emit failure does not count", async () => {
    const bridge = new TranslationPolicyReplayDigestClaimBridge(
        0xAA,
        0xCA,
        () => false,
    );
    const digest = translationPolicyForensicReplayDigest(classification());
    assertEquals(bridge.sendDigestClaim(0xBB, digest, T0), false);
    assertEquals(bridge.sent_count, 0);
    assertEquals(bridge.last_body, undefined);
});

Deno.test("replay digest claim bridge: handleIncoming decodes remote claim", async () => {
    const bridge = new TranslationPolicyReplayDigestClaimBridge(
        0xAA,
        0xCA,
        () => false,
    );
    const digest = translationPolicyForensicReplayDigest(classification());
    const claim = buildTranslationPolicyReplayDigestClaim(0xBB, 0xDD, digest, T0);
    assertEquals(bridge.handleIncoming(JSON.stringify(claim))?.peer_id, 0xBB);
});

Deno.test("replay digest claim: matches local digest exactly", async () => {
    const digest = translationPolicyForensicReplayDigest(classification());
    const claim = buildTranslationPolicyReplayDigestClaim(0xAA, 0xCA, digest, T0);
    assertEquals(translationPolicyReplayDigestClaimMatchesDigest(claim, digest), true);
    assertEquals(
        translationPolicyReplayDigestClaimMatchesDigest(
            { ...claim, final_policy_hash: 0xCCCC },
            digest,
        ),
        false,
    );
});

Deno.test("replay digest claim: equality ignores peer, witness, and wall clock", async () => {
    const digest = translationPolicyForensicReplayDigest(classification());
    const a = buildTranslationPolicyReplayDigestClaim(0xAA, 0xCA, digest, T0);
    const b = buildTranslationPolicyReplayDigestClaim(0xBB, 0xDD, digest, T0 + 1);
    assertEquals(sameTranslationPolicyReplayDigestClaim(a, b), true);
});

Deno.test("replay digest claim: equality detects interpretation drift", async () => {
    const a = buildTranslationPolicyReplayDigestClaim(
        0xAA,
        0xCA,
        translationPolicyForensicReplayDigest(classification("blocked")),
        T0,
    );
    const b = buildTranslationPolicyReplayDigestClaim(
        0xBB,
        0xDD,
        translationPolicyForensicReplayDigest(classification("nominal")),
        T0,
    );
    assertNotEquals(a.digest, b.digest);
    assertEquals(sameTranslationPolicyReplayDigestClaim(a, b), false);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_REPLAY_DIGEST_CLAIM_SCHEMA, "OMEGA-1870/v1");
});
