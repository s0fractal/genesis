// Era 1860: Translation policy forensic replay digest tests.
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
    hashBandTimeline,
    hashErrorWindows,
    hashPolicyIntervals,
    sameTranslationPolicyForensicReplayDigest,
    TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
    translationPolicyForensicReplayDigest,
    translationPolicyForensicReplayDigestProjection,
} from "../../src/network/translation_policy/translation_policy_forensic_replay_digest.ts";
import {
    TranslationPolicyForensicReplayClassification,
} from "../../src/network/translation_policy/translation_policy_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    overrides: Partial<TranslationPolicyForensicReplayClassification> = {},
): TranslationPolicyForensicReplayClassification {
    const base: TranslationPolicyForensicReplayClassification = {
        schema: "OMEGA-1840/v1",
        total_events: 3,
        classified_events: 3,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0 + 3_000,
        final_band: "blocked",
        final_policy_hash: 0xBBBB,
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
                band: "blocked",
                start_ms: T0 + 2_000,
                end_ms: T0 + 3_000,
                start_sequence: 1,
                end_sequence: 2,
                event_hash: 0x20,
            },
        ],
        policy_hash_intervals: [
            {
                local_policy_hash: 0xAAAA,
                start_ms: T0,
                end_ms: T0 + 1_000,
                start_sequence: 0,
                end_sequence: 0,
                local_pair_count: 1,
            },
            {
                local_policy_hash: 0xBBBB,
                start_ms: T0 + 2_000,
                end_ms: T0 + 3_000,
                start_sequence: 1,
                end_sequence: 2,
                local_pair_count: 2,
            },
        ],
        error_windows: [
            {
                kind: "proposal-failed",
                message: "2",
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
        policy_hash_intervals:
            overrides.policy_hash_intervals ?? base.policy_hash_intervals,
        error_windows: overrides.error_windows ?? base.error_windows,
    };
}

Deno.test("replay digest: empty classification has stable digest shape", () => {
    const digest = translationPolicyForensicReplayDigest(classification({
        total_events: 0,
        classified_events: 0,
        final_band: null,
        final_policy_hash: null,
        band_timeline: [],
        policy_hash_intervals: [],
        error_windows: [],
    }));
    assertEquals(digest.schema, TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA);
    assertEquals(/^0x[0-9a-f]{8}$/.test(digest.digest_hex), true);
    assertEquals(digest.final_band, "none");
    assertEquals(digest.final_policy_hash, 0);
});

Deno.test("replay digest: deterministic across repeated calls", () => {
    const a = translationPolicyForensicReplayDigest(classification());
    const b = translationPolicyForensicReplayDigest(classification());
    assertEquals(a, b);
});

Deno.test("replay digest: ignores non-interpretive bookkeeping counts", () => {
    const a = classification({ total_events: 3, ignored_events: 0 });
    const b = classification({ total_events: 100, ignored_events: 97 });
    assertEquals(
        translationPolicyForensicReplayDigest(a).digest,
        translationPolicyForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest: changes when band timeline changes", () => {
    const a = classification();
    const b = classification({
        band_timeline: [
            ...a.band_timeline.slice(0, 1),
            { ...a.band_timeline[1], band: "drift" },
        ],
        final_band: "drift",
    });
    assertNotEquals(
        translationPolicyForensicReplayDigest(a).digest,
        translationPolicyForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest: changes when policy interval changes", () => {
    const a = classification();
    const b = classification({
        policy_hash_intervals: [
            a.policy_hash_intervals[0],
            { ...a.policy_hash_intervals[1], local_policy_hash: 0xCCCC },
        ],
        final_policy_hash: 0xCCCC,
    });
    assertNotEquals(
        translationPolicyForensicReplayDigest(a).digest,
        translationPolicyForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest: changes when error windows change", () => {
    const a = classification();
    const b = classification({
        error_windows: [{ ...a.error_windows[0], message: "3" }],
    });
    assertNotEquals(
        translationPolicyForensicReplayDigest(a).digest,
        translationPolicyForensicReplayDigest(b).digest,
    );
});

Deno.test("replay digest: component hashes are independently stable", () => {
    const c = classification();
    const d = translationPolicyForensicReplayDigest(c);
    assertEquals(d.band_timeline_hash, hashBandTimeline(c.band_timeline));
    assertEquals(d.policy_interval_hash, hashPolicyIntervals(c.policy_hash_intervals));
    assertEquals(d.error_window_hash, hashErrorWindows(c.error_windows));
});

Deno.test("replay digest: projection is canonical and contains sections", () => {
    const p = translationPolicyForensicReplayDigestProjection(classification());
    assertEquals(p.includes("bands\n"), true);
    assertEquals(p.includes("\npolicies\n"), true);
    assertEquals(p.includes("\nerrors\n"), true);
});

Deno.test("replay digest: same helper proves matching relay interpretations", () => {
    const a = classification({ total_events: 10, ignored_events: 7 });
    const b = classification({ total_events: 3, ignored_events: 0 });
    assertEquals(sameTranslationPolicyForensicReplayDigest(a, b), true);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA, "OMEGA-1860/v1");
});
