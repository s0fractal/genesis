// Era 1960: Translation policy replay digest digest quorum tests.
import { assertEquals, assertThrows } from "jsr:@std/assert";
import {
    classifyReplayDigestDigestQuorumBand,
    DEFAULT_REPLAY_DIGEST_DIGEST_QUORUM_OPTS,
    replayDigestDigestQuorumBandAtLeast,
    replayDigestDigestQuorumGlyph,
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_QUORUM_SCHEMA,
    TranslationPolicyReplayDigestDigestQuorumTracker,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_quorum.ts";
import {
    buildTranslationPolicyReplayDigestDigestClaim,
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

function claim(peer_id: number, final_band: "nominal" | "drift" = "drift") {
    const digest = translationPolicyReplayDigestForensicReplayDigest(
        classification(final_band),
    );
    return buildTranslationPolicyReplayDigestDigestClaim(
        peer_id,
        0xCA + peer_id,
        digest,
        T0,
    );
}

Deno.test("replay digest digest quorum: empty snapshot is stable", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const s = t.snapshot(T0);
    assertEquals(s.schema, TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_QUORUM_SCHEMA);
    assertEquals(s.consensus_digest, null);
    assertEquals(s.band, "none");
    assertEquals(s.total_claims, 0);
    assertEquals(s.consensus_claim, null);
});

Deno.test("replay digest digest quorum: single claim is lone", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const c = claim(0xAA);
    t.observe(c, T0);
    const s = t.snapshot(T0);
    assertEquals(s.consensus_digest, c.digest);
    assertEquals(s.consensus_count, 1);
    assertEquals(s.band, "lone");
    assertEquals(s.agreement_q16, 65536);
});

Deno.test("replay digest digest quorum: two matching claims are double", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0);
    const s = t.snapshot(T0);
    assertEquals(s.band, "double");
    assertEquals(s.consensus_count, 2);
    assertEquals(s.dissenter_peer_ids, []);
});

Deno.test("replay digest digest quorum: three matching claims are high by default", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0);
    t.observe(claim(0xCC), T0);
    assertEquals(t.snapshot(T0).band, "high");
});

Deno.test("replay digest digest quorum: dissenters are listed for different digest", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const a = claim(0xAA, "drift");
    t.observe(a, T0);
    t.observe(claim(0xBB, "drift"), T0);
    t.observe(claim(0xCC, "nominal"), T0);
    const s = t.snapshot(T0);
    assertEquals(s.consensus_digest, a.digest);
    assertEquals(s.dissenter_peer_ids, [0xCC]);
    assertEquals(s.distinct_digests.length, 2);
});

Deno.test("replay digest digest quorum: agreement_q16 reflects consensus fraction", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    t.observe(claim(0xAA, "drift"), T0);
    t.observe(claim(0xBB, "drift"), T0);
    t.observe(claim(0xCC, "nominal"), T0);
    t.observe({ ...claim(0xDD, "nominal"), digest: 0x1234 }, T0);
    assertEquals(t.snapshot(T0).agreement_q16, 32768);
});

Deno.test("replay digest digest quorum: tie breaks by lower digest", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    t.observe({ ...claim(0xAA), digest: 0x900 }, T0);
    t.observe({ ...claim(0xBB), digest: 0x100 }, T0);
    assertEquals(t.snapshot(T0).consensus_digest, 0x100);
});

Deno.test("replay digest digest quorum: re-observe overwrites peer claim", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    t.observe(claim(0xAA, "drift"), T0);
    const changed = claim(0xAA, "nominal");
    t.observe(changed, T0 + 1);
    const s = t.snapshot(T0 + 1);
    assertEquals(s.total_claims, 1);
    assertEquals(s.consensus_digest, changed.digest);
});

Deno.test("replay digest digest quorum: TTL evicts stale claims", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker({
        ...DEFAULT_REPLAY_DIGEST_DIGEST_QUORUM_OPTS,
        ttl_ms: 5_000,
    });
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0 + 1_000);
    assertEquals(t.peerCount(T0 + 4_000), 2);
    assertEquals(t.peerCount(T0 + 6_000), 1);
});

Deno.test("replay digest digest quorum: forget and clear manage state", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    t.observe(claim(0xAA), T0);
    t.observe(claim(0xBB), T0);
    t.forget(0xAA);
    assertEquals(t.peerCount(T0), 1);
    t.clear();
    assertEquals(t.peerCount(T0), 0);
});

Deno.test("replay digest digest quorum: claimsForDigest returns peer-sorted claims", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const a = claim(0xCC, "drift");
    const b = claim(0xAA, "drift");
    t.observe(a, T0);
    t.observe(b, T0);
    t.observe(claim(0xBB, "nominal"), T0);
    assertEquals(t.claimsForDigest(a.digest, T0).map((c) => c.peer_id), [
        0xAA,
        0xCC,
    ]);
});

Deno.test("replay digest digest quorum: tunable high threshold preserves triple+ band", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker({
        ttl_ms: 60_000,
        high_threshold: 5,
    });
    for (let i = 0; i < 4; i++) t.observe(claim(i + 1), T0);
    assertEquals(t.snapshot(T0).band, "triple+");
    t.observe(claim(5), T0);
    assertEquals(t.snapshot(T0).band, "high");
});

Deno.test("replay digest digest quorum: band helpers are ordered", async () => {
    assertEquals(classifyReplayDigestDigestQuorumBand(0, 3), "none");
    assertEquals(classifyReplayDigestDigestQuorumBand(1, 3), "lone");
    assertEquals(classifyReplayDigestDigestQuorumBand(2, 3), "double");
    assertEquals(classifyReplayDigestDigestQuorumBand(3, 4), "triple+");
    assertEquals(classifyReplayDigestDigestQuorumBand(4, 4), "high");
    assertEquals(replayDigestDigestQuorumBandAtLeast("double", "lone"), true);
    assertEquals(
        replayDigestDigestQuorumBandAtLeast("double", "triple+"),
        false,
    );
});

Deno.test("replay digest digest quorum: glyphs are stable ascii", async () => {
    assertEquals(replayDigestDigestQuorumGlyph("high"), "G");
    assertEquals(replayDigestDigestQuorumGlyph("triple+"), "G");
    assertEquals(replayDigestDigestQuorumGlyph("double"), "Y");
    assertEquals(replayDigestDigestQuorumGlyph("lone"), "O");
    assertEquals(replayDigestDigestQuorumGlyph("none"), "-");
});

Deno.test("replay digest digest quorum: consensus helpers proxy snapshot", async () => {
    const t = new TranslationPolicyReplayDigestDigestQuorumTracker();
    const a = claim(0xAA, "drift");
    t.observe(a, T0);
    t.observe(claim(0xBB, "nominal"), T0);
    assertEquals(t.consensusDigest(T0), Math.min(a.digest, claim(0xBB, "nominal").digest));
    assertEquals(t.dissenters(T0).length, 1);
});

Deno.test("replay digest digest quorum: invalid opts throw", async () => {
    assertThrows(() =>
        new TranslationPolicyReplayDigestDigestQuorumTracker({
            ttl_ms: 0,
            high_threshold: 3,
        })
    );
    assertThrows(() =>
        new TranslationPolicyReplayDigestDigestQuorumTracker({
            ttl_ms: 1000,
            high_threshold: 1,
        })
    );
});

Deno.test("replay digest digest quorum: schema constant", async () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_QUORUM_SCHEMA,
        "OMEGA-1960/v1",
    );
});
