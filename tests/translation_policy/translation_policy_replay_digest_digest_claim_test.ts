// Era 1950: Translation policy replay digest digest claim tests.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
    buildTranslationPolicyReplayDigestDigestClaim,
    decodeTranslationPolicyReplayDigestDigestClaim,
    sameTranslationPolicyReplayDigestDigestClaim,
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_CLAIM_SCHEMA,
    TranslationPolicyReplayDigestDigestClaimBridge,
    translationPolicyReplayDigestDigestClaimMatchesDigest,
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
        total_events: 2,
        classified_events: 2,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0 + 100,
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

Deno.test("replay digest digest claim: builds compact claim from digest", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0x1_0000_0001,
        0xCA,
        digest,
        T0,
    );
    assertEquals(claim.schema, TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_CLAIM_SCHEMA);
    assertEquals(claim.peer_id, 1);
    assertEquals(claim.witness_id, 0xCA);
    assertEquals(claim.digest, digest.digest);
    assertEquals(claim.consensus_interval_hash, digest.consensus_interval_hash);
    assertEquals(claim.final_band, "drift");
});

Deno.test("replay digest digest claim: JSON decode round-trips", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    const decoded = decodeTranslationPolicyReplayDigestDigestClaim(
        JSON.stringify(claim),
    );
    assertEquals(decoded, claim);
});

Deno.test("replay digest digest claim: decoder rejects malformed shapes", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    assertEquals(decodeTranslationPolicyReplayDigestDigestClaim("not json"), null);
    assertEquals(decodeTranslationPolicyReplayDigestDigestClaim("[]"), null);
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(JSON.stringify({
            ...claim,
            schema: "OMEGA-1951/v1",
        })),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(JSON.stringify({
            ...claim,
            digest_schema: "OMEGA-1870/v1",
        })),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(JSON.stringify({
            ...claim,
            final_band: "install-error",
        })),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(JSON.stringify({
            ...claim,
            consensus_interval_hash: -1,
        })),
        null,
    );
});

Deno.test("replay digest digest claim: plasmid fields carry target and body", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    const fields = translationPolicyReplayDigestDigestPlasmidFields(0xBB, claim);
    assertEquals(fields.translationPolicyReplayDigestDigestTarget, 0xBB);
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(
            fields.translationPolicyReplayDigestDigestBody,
        )?.digest,
        digest.digest,
    );
});

Deno.test("replay digest digest claim bridge: sends and tracks counters", async () => {
    let captured_target = 0;
    let captured_body = "";
    const bridge = new TranslationPolicyReplayDigestDigestClaimBridge(
        0xAA,
        0xCA,
        (target, body) => {
            captured_target = target;
            captured_body = body;
            return true;
        },
    );
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    assert(bridge.sendDigestClaim(0xBB, digest, T0));
    assertEquals(bridge.sent_count, 1);
    assertEquals(bridge.last_target, 0xBB);
    assertEquals(captured_target, 0xBB);
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestClaim(captured_body)?.peer_id,
        0xAA,
    );
});

Deno.test("replay digest digest claim bridge: emit failure does not count", async () => {
    const bridge = new TranslationPolicyReplayDigestDigestClaimBridge(
        0xAA,
        0xCA,
        () => false,
    );
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    assertEquals(bridge.sendDigestClaim(0xBB, digest, T0), false);
    assertEquals(bridge.sent_count, 0);
    assertEquals(bridge.last_body, undefined);
});

Deno.test("replay digest digest claim bridge: handleIncoming decodes remote claim", async () => {
    const bridge = new TranslationPolicyReplayDigestDigestClaimBridge(
        0xAA,
        0xCA,
        () => false,
    );
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0xBB,
        0xDD,
        digest,
        T0,
    );
    assertEquals(bridge.handleIncoming(JSON.stringify(claim))?.peer_id, 0xBB);
});

Deno.test("replay digest digest claim: matches local digest exactly", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    assertEquals(
        translationPolicyReplayDigestDigestClaimMatchesDigest(claim, digest),
        true,
    );
    assertEquals(
        translationPolicyReplayDigestDigestClaimMatchesDigest(
            { ...claim, final_consensus_digest: 0xCCCC },
            digest,
        ),
        false,
    );
});

Deno.test("replay digest digest claim: equality ignores peer, witness, and wall clock", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const a = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    const b = buildTranslationPolicyReplayDigestDigestClaim(
        0xBB,
        0xDD,
        digest,
        T0 + 1,
    );
    assertEquals(sameTranslationPolicyReplayDigestDigestClaim(a, b), true);
});

Deno.test("replay digest digest claim: equality detects interpretation drift", async () => {
    const a = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        translationPolicyReplayDigestForensicReplayDigest(classification("drift")),
        T0,
    );
    const b = buildTranslationPolicyReplayDigestDigestClaim(
        0xBB,
        0xDD,
        translationPolicyReplayDigestForensicReplayDigest(classification("nominal")),
        T0,
    );
    assertNotEquals(a.digest, b.digest);
    assertEquals(sameTranslationPolicyReplayDigestDigestClaim(a, b), false);
});

Deno.test("replay digest digest claim: invalid claim time is normalized on build", async () => {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestClaim(
        0xAA,
        0xCA,
        digest,
        Number.NaN,
    );
    assertEquals(claim.claimed_at_ms, 0);
});

Deno.test("replay digest digest claim: schema constant", async () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_CLAIM_SCHEMA,
        "OMEGA-1950/v1",
    );
});
