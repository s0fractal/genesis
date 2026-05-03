// Era 2030: Translation policy replay digest digest forensic replay digest claim tests.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
    buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
    sameTranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_CLAIM_SCHEMA,
    TranslationPolicyReplayDigestDigestForensicReplayDigestClaimBridge,
    translationPolicyReplayDigestDigestForensicReplayDigestClaimMatchesDigest,
    translationPolicyReplayDigestDigestForensicReplayDigestPlasmidFields,
} from "../src/network/translation_policy_replay_digest_digest_forensic_replay_digest_claim.ts";
import {
    translationPolicyReplayDigestDigestForensicReplayDigest,
} from "../src/network/translation_policy_replay_digest_digest_forensic_replay_digest.ts";
import type {
    TranslationPolicyReplayDigestDigestForensicReplayClassification,
} from "../src/network/translation_policy_replay_digest_digest_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    final_band: "nominal" | "drift" = "drift",
): TranslationPolicyReplayDigestDigestForensicReplayClassification {
    return {
        schema: "OMEGA-2000/v1",
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

Deno.test("replay digest digest forensic replay digest claim: builds compact claim from digest", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0x1_0000_0001,
        0xCA,
        digest,
        T0,
    );
    assertEquals(
        claim.schema,
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_CLAIM_SCHEMA,
    );
    assertEquals(claim.peer_id, 1);
    assertEquals(claim.witness_id, 0xCA);
    assertEquals(claim.digest, digest.digest);
    assertEquals(claim.consensus_interval_hash, digest.consensus_interval_hash);
    assertEquals(claim.final_band, "drift");
});

Deno.test("replay digest digest forensic replay digest claim: JSON decode round-trips", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    const decoded = decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        JSON.stringify(claim),
    );
    assertEquals(decoded, claim);
});

Deno.test("replay digest digest forensic replay digest claim: decoder rejects malformed shapes", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            "not json",
        ),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim("[]"),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            JSON.stringify({ ...claim, schema: "OMEGA-2031/v1" }),
        ),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            JSON.stringify({ ...claim, digest_schema: "OMEGA-1950/v1" }),
        ),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            JSON.stringify({ ...claim, final_band: "install-error" }),
        ),
        null,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            JSON.stringify({ ...claim, consensus_interval_hash: -1 }),
        ),
        null,
    );
});

Deno.test("replay digest digest forensic replay digest claim: plasmid fields carry target and body", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    const fields =
        translationPolicyReplayDigestDigestForensicReplayDigestPlasmidFields(
            0xBB,
            claim,
        );
    assertEquals(
        fields.translationPolicyReplayDigestDigestForensicReplayDigestTarget,
        0xBB,
    );
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            fields.translationPolicyReplayDigestDigestForensicReplayDigestBody,
        )?.digest,
        digest.digest,
    );
});

Deno.test("replay digest digest forensic replay digest claim bridge: sends and tracks counters", () => {
    let captured_target = 0;
    let captured_body = "";
    const bridge =
        new TranslationPolicyReplayDigestDigestForensicReplayDigestClaimBridge(
            0xAA,
            0xCA,
            (target, body) => {
                captured_target = target;
                captured_body = body;
                return true;
            },
        );
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    assert(bridge.sendDigestClaim(0xBB, digest, T0));
    assertEquals(bridge.sent_count, 1);
    assertEquals(bridge.last_target, 0xBB);
    assertEquals(captured_target, 0xBB);
    assertEquals(
        decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
            captured_body,
        )?.peer_id,
        0xAA,
    );
});

Deno.test("replay digest digest forensic replay digest claim bridge: emit failure does not count", () => {
    const bridge =
        new TranslationPolicyReplayDigestDigestForensicReplayDigestClaimBridge(
            0xAA,
            0xCA,
            () => false,
        );
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    assertEquals(bridge.sendDigestClaim(0xBB, digest, T0), false);
    assertEquals(bridge.sent_count, 0);
    assertEquals(bridge.last_body, undefined);
});

Deno.test("replay digest digest forensic replay digest claim bridge: handleIncoming decodes remote claim", () => {
    const bridge =
        new TranslationPolicyReplayDigestDigestForensicReplayDigestClaimBridge(
            0xAA,
            0xCA,
            () => false,
        );
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xBB,
        0xDD,
        digest,
        T0,
    );
    assertEquals(bridge.handleIncoming(JSON.stringify(claim))?.peer_id, 0xBB);
});

Deno.test("replay digest digest forensic replay digest claim: matches local digest exactly", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    assertEquals(
        translationPolicyReplayDigestDigestForensicReplayDigestClaimMatchesDigest(
            claim,
            digest,
        ),
        true,
    );
    assertEquals(
        translationPolicyReplayDigestDigestForensicReplayDigestClaimMatchesDigest(
            { ...claim, final_consensus_digest: 0xCCCC },
            digest,
        ),
        false,
    );
});

Deno.test("replay digest digest forensic replay digest claim: equality ignores peer, witness, and wall clock", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const a = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        digest,
        T0,
    );
    const b = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xBB,
        0xDD,
        digest,
        T0 + 1,
    );
    assertEquals(
        sameTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(a, b),
        true,
    );
});

Deno.test("replay digest digest forensic replay digest claim: equality detects interpretation drift", () => {
    const a = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        translationPolicyReplayDigestDigestForensicReplayDigest(
            classification("drift"),
        ),
        T0,
    );
    const b = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xBB,
        0xDD,
        translationPolicyReplayDigestDigestForensicReplayDigest(
            classification("nominal"),
        ),
        T0,
    );
    assertNotEquals(a.digest, b.digest);
    assertEquals(
        sameTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(a, b),
        false,
    );
});

Deno.test("replay digest digest forensic replay digest claim: invalid claim time is normalized on build", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const claim = buildTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
        0xAA,
        0xCA,
        digest,
        Number.NaN,
    );
    assertEquals(claim.claimed_at_ms, 0);
});

Deno.test("replay digest digest forensic replay digest claim: schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_CLAIM_SCHEMA,
        "OMEGA-2030/v1",
    );
});

