// Era 1880: Translation policy replay digest quorum tests.
import { assertEquals, assertThrows } from "jsr:@std/assert";
import {
    DEFAULT_REPLAY_DIGEST_QUORUM_OPTS,
    TRANSLATION_POLICY_REPLAY_DIGEST_QUORUM_SCHEMA,
    TranslationPolicyReplayDigestQuorumTracker,
    classifyReplayDigestQuorumBand,
    replayDigestQuorumBandAtLeast,
    replayDigestQuorumGlyph,
} from "../../src/network/translation_policy/translation_policy_replay_digest_quorum.ts";
import {
    buildTranslationPolicyReplayDigestClaim,
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

function claim(peer_id: number, final_band: "nominal" | "blocked" = "blocked") {
    const digest = translationPolicyForensicReplayDigest(classification(final_band));
    return buildTranslationPolicyReplayDigestClaim(
        peer_id,
        0xCA + peer_id,
        digest,
        T0,
    );
}

Deno.test("replay digest quorum: empty snapshot is stable", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    const s = t.snapshot(T0);
    assertEquals(s.schema, TRANSLATION_POLICY_REPLAY_DIGEST_QUORUM_SCHEMA);
    assertEquals(s.consensus_digest, null);
    assertEquals(s.band, "none");
    assertEquals(s.total_claims, 0);
    assertEquals(s.consensus_claim, null);
});

Deno.test("replay digest quorum: single claim is lone", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    const c = claim(0xAA);
    t.observe(c, T0);
    const s = t.snapshot(T0);
    assertEquals(s.consensus_digest, c.digest);
    assertEquals(s.consensus_count, 1);
    assertEquals(s.band, "lone");
    assertEquals(s.agreement_q16, 65536);
});

Deno.test("replay digest quorum: two matching claims are double", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0);
    const s = t.snapshot(T0);
    assertEquals(s.band, "double");
    assertEquals(s.consensus_count, 2);
    assertEquals(s.dissenter_peer_ids, []);
});

Deno.test("replay digest quorum: three matching claims are high by default", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0);
    t.observe(claim(0xCC), T0);
    assertEquals(t.snapshot(T0).band, "high");
});

Deno.test("replay digest quorum: dissenters are listed for different digest", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    const a = claim(0xAA, "blocked");
    t.observe(a, T0);
    t.observe(claim(0xBB, "blocked"), T0);
    t.observe(claim(0xCC, "nominal"), T0);
    const s = t.snapshot(T0);
    assertEquals(s.consensus_digest, a.digest);
    assertEquals(s.dissenter_peer_ids, [0xCC]);
    assertEquals(s.distinct_digests.length, 2);
});

Deno.test("replay digest quorum: agreement_q16 reflects consensus fraction", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    t.observe(claim(0xAA, "blocked"), T0);
    t.observe(claim(0xBB, "blocked"), T0);
    t.observe(claim(0xCC, "nominal"), T0);
    t.observe({ ...claim(0xDD, "nominal"), digest: 0x1234 }, T0);
    assertEquals(t.snapshot(T0).agreement_q16, 32768);
});

Deno.test("replay digest quorum: tie breaks by lower digest", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    t.observe({ ...claim(0xAA), digest: 0x900 }, T0);
    t.observe({ ...claim(0xBB), digest: 0x100 }, T0);
    assertEquals(t.snapshot(T0).consensus_digest, 0x100);
});

Deno.test("replay digest quorum: re-observe overwrites peer claim", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    t.observe(claim(0xAA, "blocked"), T0);
    const changed = claim(0xAA, "nominal");
    t.observe(changed, T0 + 1);
    const s = t.snapshot(T0 + 1);
    assertEquals(s.total_claims, 1);
    assertEquals(s.consensus_digest, changed.digest);
});

Deno.test("replay digest quorum: TTL evicts stale claims", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker({
        ...DEFAULT_REPLAY_DIGEST_QUORUM_OPTS,
        ttl_ms: 5_000,
    });
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0 + 1_000);
    assertEquals(t.peerCount(T0 + 4_000), 2);
    assertEquals(t.peerCount(T0 + 6_000), 1);
});

Deno.test("replay digest quorum: forget and clear manage state", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0);
    t.forget(0xAA);
    assertEquals(t.peerCount(T0), 1);
    t.clear();
    assertEquals(t.peerCount(T0), 0);
});

Deno.test("replay digest quorum: claimsForDigest returns peer-sorted claims", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker();
    const a = claim(0xCC, "blocked");
    const b = claim(0xAA, "blocked");
    t.observe(a, T0);
    t.observe(b, T0);
    t.observe(claim(0xBB, "nominal"), T0);
    assertEquals(t.claimsForDigest(a.digest, T0).map((c) => c.peer_id), [0xAA, 0xCC]);
});

Deno.test("replay digest quorum: tunable high threshold preserves triple+ band", () => {
    const t = new TranslationPolicyReplayDigestQuorumTracker({
        ttl_ms: 60_000,
        high_threshold: 5,
    });
    for (let i = 0; i < 4; i++) t.observe(claim(i + 1), T0);
    assertEquals(t.snapshot(T0).band, "triple+");
    t.observe(claim(5), T0);
    assertEquals(t.snapshot(T0).band, "high");
});

Deno.test("replay digest quorum: band helpers are ordered", () => {
    assertEquals(classifyReplayDigestQuorumBand(0, 3), "none");
    assertEquals(classifyReplayDigestQuorumBand(1, 3), "lone");
    assertEquals(classifyReplayDigestQuorumBand(2, 3), "double");
    assertEquals(classifyReplayDigestQuorumBand(3, 4), "triple+");
    assertEquals(classifyReplayDigestQuorumBand(4, 4), "high");
    assertEquals(replayDigestQuorumBandAtLeast("double", "lone"), true);
    assertEquals(replayDigestQuorumBandAtLeast("double", "triple+"), false);
});

Deno.test("replay digest quorum: glyphs are stable ascii", () => {
    assertEquals(replayDigestQuorumGlyph("high"), "G");
    assertEquals(replayDigestQuorumGlyph("triple+"), "G");
    assertEquals(replayDigestQuorumGlyph("double"), "Y");
    assertEquals(replayDigestQuorumGlyph("lone"), "O");
    assertEquals(replayDigestQuorumGlyph("none"), "-");
});

Deno.test("replay digest quorum: invalid opts throw", () => {
    assertThrows(() =>
        new TranslationPolicyReplayDigestQuorumTracker({
            ttl_ms: 0,
            high_threshold: 3,
        })
    );
    assertThrows(() =>
        new TranslationPolicyReplayDigestQuorumTracker({
            ttl_ms: 1000,
            high_threshold: 1,
        })
    );
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_REPLAY_DIGEST_QUORUM_SCHEMA, "OMEGA-1880/v1");
});
