// Era 1930: Translation policy replay digest forensic replay HUD tests.
import { assertEquals } from "jsr:@std/assert";
import {
    firstActiveReplayDigestErrorWindow,
    formatTranslationPolicyReplayDigestForensicReplayHud,
    replayDigestForensicReplayGlyph,
    TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA,
    translationPolicyReplayDigestForensicReplayHudFields,
    translationPolicyReplayDigestReplayDriftDurationMs,
    translationPolicyReplayDigestReplayLocalFailureCount,
    translationPolicyReplayDigestReplayMalformedCount,
} from "../../src/network/translation_policy/translation_policy_replay_digest_forensic_replay_hud.ts";
import type {
    TranslationPolicyReplayDigestForensicReplayClassification,
} from "../../src/network/translation_policy/translation_policy_replay_digest_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    overrides: Partial<TranslationPolicyReplayDigestForensicReplayClassification> = {},
): TranslationPolicyReplayDigestForensicReplayClassification {
    const base: TranslationPolicyReplayDigestForensicReplayClassification = {
        schema: "OMEGA-1920/v1",
        total_events: 4,
        classified_events: 4,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0 + 4_000,
        final_band: "nominal",
        final_consensus_digest: 0x1234_ABCD,
        band_timeline: [
            {
                band: "nominal",
                start_ms: T0,
                end_ms: T0 + 1_000,
                start_sequence: 0,
                end_sequence: 1,
                event_hash: 0x10,
            },
            {
                band: "drift",
                start_ms: T0 + 2_000,
                end_ms: T0 + 4_000,
                start_sequence: 2,
                end_sequence: 3,
                event_hash: 0x20,
            },
        ],
        consensus_digest_intervals: [
            {
                consensus_digest: 0x1234_ABCD,
                start_ms: T0,
                end_ms: T0 + 4_000,
                start_sequence: 0,
                end_sequence: 3,
                consensus_count: 3,
                total_claims: 4,
                agreement_q16: 49_152,
            },
        ],
        error_windows: [],
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

Deno.test("replay digest replay HUD: empty classification formats stable fields", () => {
    const snap = formatTranslationPolicyReplayDigestForensicReplayHud(
        classification({
            total_events: 0,
            classified_events: 0,
            first_event_ms: null,
            last_event_ms: null,
            final_band: null,
            final_consensus_digest: null,
            band_timeline: [],
            consensus_digest_intervals: [],
        }),
    );
    assertEquals(
        snap.schema,
        TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA,
    );
    assertEquals(snap.band, "empty");
    assertEquals(snap.fields.band.value, "-- EMPTY 0/0");
    assertEquals(snap.fields.digest.value, "D-------- I0");
    assertEquals(snap.fields.error.value, "none");
    assertEquals(snap.fields.drift.value, "0ms M0 F0");
});

Deno.test("replay digest replay HUD: compact fields include final band, digest intervals, drift and failures", () => {
    const snap = formatTranslationPolicyReplayDigestForensicReplayHud(
        classification({
            final_band: "drift",
            malformed_payloads: 2,
            consensus_digest_intervals: [
                {
                    consensus_digest: 0xAAAA,
                    start_ms: T0,
                    end_ms: T0 + 1,
                    start_sequence: 0,
                    end_sequence: 0,
                    consensus_count: 1,
                    total_claims: 1,
                    agreement_q16: 65_535,
                },
                {
                    consensus_digest: 0xBBBB,
                    start_ms: T0 + 2,
                    end_ms: T0 + 4_000,
                    start_sequence: 1,
                    end_sequence: 3,
                    consensus_count: 3,
                    total_claims: 4,
                    agreement_q16: 49_152,
                },
            ],
            error_windows: [
                {
                    kind: "malformed",
                    message: "3",
                    start_ms: T0,
                    end_ms: T0 + 1,
                    start_sequence: 0,
                    end_sequence: 0,
                    first_event_hash: 0x10,
                    last_event_hash: 0x10,
                },
                {
                    kind: "local-claim-failed",
                    message: "2",
                    start_ms: T0 + 2,
                    end_ms: T0 + 3,
                    start_sequence: 1,
                    end_sequence: 1,
                    first_event_hash: 0x20,
                    last_event_hash: 0x20,
                },
            ],
        }),
    );
    assertEquals(snap.fields.band.value, "DR DRIFT 4/4");
    assertEquals(snap.fields.digest.value, "D1234abcd I2");
    assertEquals(snap.drift_duration_ms, 2_000);
    assertEquals(snap.malformed_count, 5);
    assertEquals(snap.local_failure_count, 2);
    assertEquals(snap.summary.includes("D1234abcd I2"), true);
});

Deno.test("replay digest replay HUD: first active error window is surfaced", () => {
    const snap = formatTranslationPolicyReplayDigestForensicReplayHud(
        classification({
            final_band: "blocked",
            error_windows: [
                {
                    kind: "malformed",
                    message: "old",
                    start_ms: T0,
                    end_ms: T0 + 1,
                    start_sequence: 0,
                    end_sequence: 0,
                    first_event_hash: 0x10,
                    last_event_hash: 0x10,
                },
                {
                    kind: "local-claim-failed",
                    message: "2",
                    start_ms: T0 + 2,
                    end_ms: null,
                    start_sequence: 1,
                    end_sequence: null,
                    first_event_hash: 0x20,
                    last_event_hash: 0x20,
                },
            ],
        }),
    );
    assertEquals(snap.active_error?.kind, "local-claim-failed");
    assertEquals(snap.fields.error.value, "local-claim-failed:2");
});

Deno.test("replay digest replay HUD: drift duration uses last replay time for open drift segment", () => {
    const c = classification({
        last_event_ms: T0 + 10_000,
        band_timeline: [
            {
                band: "drift",
                start_ms: T0 + 4_000,
                end_ms: null,
                start_sequence: 2,
                end_sequence: null,
                event_hash: 0x20,
            },
        ],
    });
    assertEquals(translationPolicyReplayDigestReplayDriftDurationMs(c), 6_000);
    assertEquals(
        formatTranslationPolicyReplayDigestForensicReplayHud(c).fields.drift.value,
        "6s M0 F0",
    );
});

Deno.test("replay digest replay HUD: malformed count combines parser and payload malformed windows", () => {
    const c = classification({
        malformed_payloads: 2,
        error_windows: [
            {
                kind: "malformed",
                message: "3",
                start_ms: T0,
                end_ms: null,
                start_sequence: 0,
                end_sequence: null,
                first_event_hash: 0x10,
                last_event_hash: 0x10,
            },
        ],
    });
    assertEquals(translationPolicyReplayDigestReplayMalformedCount(c), 5);
});

Deno.test("replay digest replay HUD: local failure count uses local-claim-failed windows", () => {
    const c = classification({
        error_windows: [
            {
                kind: "local-claim-failed",
                message: "2",
                start_ms: T0,
                end_ms: T0 + 1,
                start_sequence: 0,
                end_sequence: 0,
                first_event_hash: 0x10,
                last_event_hash: 0x10,
            },
            {
                kind: "local-claim-failed",
                message: "5",
                start_ms: T0 + 2,
                end_ms: null,
                start_sequence: 1,
                end_sequence: null,
                first_event_hash: 0x20,
                last_event_hash: 0x20,
            },
        ],
    });
    assertEquals(translationPolicyReplayDigestReplayLocalFailureCount(c), 5);
});

Deno.test("replay digest replay HUD: helper fields preserve order", () => {
    const fields = translationPolicyReplayDigestForensicReplayHudFields(
        classification(),
    );
    assertEquals(fields.map((f) => f.label), [
        "TPOL RD REPLAY",
        "TPOL RD DIGEST",
        "TPOL RD ERROR",
        "TPOL RD DRIFT",
    ]);
});

Deno.test("replay digest replay HUD: summary truncates deterministically", () => {
    const snap = formatTranslationPolicyReplayDigestForensicReplayHud(
        classification({ final_band: "blocked" }),
        { max_summary_len: 18 },
    );
    assertEquals(snap.summary.length, 18);
    assertEquals(snap.summary.endsWith("…"), true);
});

Deno.test("replay digest replay HUD: glyphs cover replay digest bands", () => {
    assertEquals(replayDigestForensicReplayGlyph("nominal"), "OK");
    assertEquals(replayDigestForensicReplayGlyph("watch"), "WA");
    assertEquals(replayDigestForensicReplayGlyph("drift"), "DR");
    assertEquals(replayDigestForensicReplayGlyph("blocked"), "BL");
    assertEquals(replayDigestForensicReplayGlyph("empty"), "--");
});

Deno.test("replay digest replay HUD: firstActiveReplayDigestErrorWindow returns null when all closed", () => {
    assertEquals(firstActiveReplayDigestErrorWindow(classification()), null);
});

Deno.test("replay digest replay HUD: schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_FORENSIC_REPLAY_HUD_SCHEMA,
        "OMEGA-1930/v1",
    );
});
