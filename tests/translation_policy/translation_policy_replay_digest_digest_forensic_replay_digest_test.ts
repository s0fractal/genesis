// Era 2010: Translation policy replay digest digest forensic replay digest tests.
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
    hashReplayDigestDigestBandTimeline,
    hashReplayDigestDigestConsensusIntervals,
    hashReplayDigestDigestErrorWindows,
    sameTranslationPolicyReplayDigestDigestForensicReplayDigest,
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
    translationPolicyReplayDigestDigestForensicReplayDigest,
    translationPolicyReplayDigestDigestForensicReplayDigestProjection,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_forensic_replay_digest.ts";
import type {
    TranslationPolicyReplayDigestDigestForensicReplayClassification,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    overrides:
        Partial<TranslationPolicyReplayDigestDigestForensicReplayClassification> = {},
): TranslationPolicyReplayDigestDigestForensicReplayClassification {
    const base: TranslationPolicyReplayDigestDigestForensicReplayClassification = {
        schema: "OMEGA-2000/v1",
        total_events: 3,
        classified_events: 3,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0 + 3_000,
        final_band: "drift",
        final_consensus_digest: 0xBBBB,
        band_timeline: [
            {
                band: "nominal",
                start_ms: T0,
                end_ms: T0 + 1_000,
                start_sequence: 0,
                end_sequence: 0,
                event_hash: 0x10,
            },
            {
                band: "drift",
                start_ms: T0 + 2_000,
                end_ms: T0 + 3_000,
                start_sequence: 1,
                end_sequence: 2,
                event_hash: 0x20,
            },
        ],
        consensus_digest_intervals: [
            {
                consensus_digest: 0xAAAA,
                start_ms: T0,
                end_ms: T0 + 1_000,
                start_sequence: 0,
                end_sequence: 0,
                consensus_count: 1,
                total_claims: 1,
                agreement_q16: 65_536,
            },
            {
                consensus_digest: 0xBBBB,
                start_ms: T0 + 2_000,
                end_ms: T0 + 3_000,
                start_sequence: 1,
                end_sequence: 2,
                consensus_count: 2,
                total_claims: 3,
                agreement_q16: 43_690,
            },
        ],
        error_windows: [
            {
                kind: "drift",
                message: "1",
                start_ms: T0 + 2_000,
                end_ms: null,
                start_sequence: 1,
                end_sequence: null,
                first_event_hash: 0x20,
                last_event_hash: 0x20,
            },
        ],
    };
    return {
        ...base,
        ...overrides,
        band_timeline: overrides.band_timeline ?? base.band_timeline,
        consensus_digest_intervals:
            overrides.consensus_digest_intervals ?? base.consensus_digest_intervals,
        error_windows: overrides.error_windows ?? base.error_windows,
    };
}

Deno.test("replay digest digest replay digest: empty classification has stable digest shape", () => {
    const digest = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification({
            total_events: 0,
            classified_events: 0,
            final_band: null,
            final_consensus_digest: null,
            band_timeline: [],
            consensus_digest_intervals: [],
            error_windows: [],
        }),
    );
    assertEquals(
        digest.schema,
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
    );
    assertEquals(/^0x[0-9a-f]{8}$/.test(digest.digest_hex), true);
    assertEquals(digest.final_band, "none");
    assertEquals(digest.final_consensus_digest, 0);
});

Deno.test("replay digest digest replay digest: deterministic across repeated calls", () => {
    const a = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    const b = translationPolicyReplayDigestDigestForensicReplayDigest(
        classification(),
    );
    assertEquals(a, b);
});

Deno.test("replay digest digest replay digest: ignores non-interpretive bookkeeping counts", () => {
    const a = classification({ total_events: 3, ignored_events: 0 });
    const b = classification({ total_events: 100, ignored_events: 97 });
    assertEquals(
        translationPolicyReplayDigestDigestForensicReplayDigest(a).digest,
        translationPolicyReplayDigestDigestForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest digest replay digest: changes when band timeline changes", () => {
    const a = classification();
    const b = classification({
        band_timeline: [
            ...a.band_timeline.slice(0, 1),
            { ...a.band_timeline[1], band: "blocked" },
        ],
        final_band: "blocked",
    });
    assertNotEquals(
        translationPolicyReplayDigestDigestForensicReplayDigest(a).digest,
        translationPolicyReplayDigestDigestForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest digest replay digest: changes when consensus interval changes", () => {
    const a = classification();
    const b = classification({
        consensus_digest_intervals: [
            a.consensus_digest_intervals[0],
            {
                ...a.consensus_digest_intervals[1],
                consensus_digest: 0xCCCC,
            },
        ],
        final_consensus_digest: 0xCCCC,
    });
    assertNotEquals(
        translationPolicyReplayDigestDigestForensicReplayDigest(a).digest,
        translationPolicyReplayDigestDigestForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest digest replay digest: changes when error windows change", () => {
    const a = classification();
    const b = classification({
        error_windows: [{ ...a.error_windows[0], message: "2" }],
    });
    assertNotEquals(
        translationPolicyReplayDigestDigestForensicReplayDigest(a).digest,
        translationPolicyReplayDigestDigestForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest digest replay digest: component hashes are independently stable", () => {
    const c = classification();
    const d = translationPolicyReplayDigestDigestForensicReplayDigest(c);
    assertEquals(
        d.band_timeline_hash,
        hashReplayDigestDigestBandTimeline(c.band_timeline),
    );
    assertEquals(
        d.consensus_interval_hash,
        hashReplayDigestDigestConsensusIntervals(c.consensus_digest_intervals),
    );
    assertEquals(
        d.error_window_hash,
        hashReplayDigestDigestErrorWindows(c.error_windows),
    );
});

Deno.test("replay digest digest replay digest: projection is canonical and contains sections", () => {
    const p = translationPolicyReplayDigestDigestForensicReplayDigestProjection(
        classification(),
    );
    assertEquals(p.includes("bands\n"), true);
    assertEquals(p.includes("\nconsensus\n"), true);
    assertEquals(p.includes("\nerrors\n"), true);
});

Deno.test("replay digest digest replay digest: same helper proves matching relay interpretations", () => {
    const a = classification({ total_events: 10, ignored_events: 7 });
    const b = classification({ total_events: 3, ignored_events: 0 });
    assertEquals(
        sameTranslationPolicyReplayDigestDigestForensicReplayDigest(a, b),
        true,
    );
});

Deno.test("replay digest digest replay digest: malformed payload count is interpretive", () => {
    const a = classification({ malformed_payloads: 0 });
    const b = classification({ malformed_payloads: 1 });
    assertNotEquals(
        translationPolicyReplayDigestDigestForensicReplayDigest(a).digest,
        translationPolicyReplayDigestDigestForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest digest replay digest: schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST_SCHEMA,
        "OMEGA-2010/v1",
    );
});

