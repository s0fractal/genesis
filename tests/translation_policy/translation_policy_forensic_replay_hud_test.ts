// Era 1850: Translation policy forensic replay HUD summary tests.
import { assertEquals } from "jsr:@std/assert";
import {
    firstActiveErrorWindow,
    forensicReplayGlyph,
    formatTranslationPolicyForensicReplayHud,
    TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_SCHEMA,
    translationPolicyForensicReplayHudFields,
    translationPolicyReplayDriftDurationMs,
    translationPolicyReplayMalformedCount,
} from "../../src/network/translation_policy/translation_policy_forensic_replay_hud.ts";
import {
    TranslationPolicyForensicReplayClassification,
} from "../../src/network/translation_policy/translation_policy_forensic_replay.ts";

const T0 = 1_000_000;

function classification(
    overrides: Partial<TranslationPolicyForensicReplayClassification> = {},
): TranslationPolicyForensicReplayClassification {
    const base: TranslationPolicyForensicReplayClassification = {
        schema: "OMEGA-1840/v1",
        total_events: 4,
        classified_events: 4,
        ignored_events: 0,
        malformed_payloads: 0,
        first_event_ms: T0,
        last_event_ms: T0 + 4_000,
        final_band: "nominal",
        final_policy_hash: 0x1234_ABCD,
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
        policy_hash_intervals: [
            {
                local_policy_hash: 0x1234_ABCD,
                start_ms: T0,
                end_ms: T0 + 4_000,
                start_sequence: 0,
                end_sequence: 3,
                local_pair_count: 2,
            },
        ],
        error_windows: [],
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

Deno.test("replay HUD: empty classification formats stable fields", async () => {
    const snap = formatTranslationPolicyForensicReplayHud(classification({
        total_events: 0,
        classified_events: 0,
        first_event_ms: null,
        last_event_ms: null,
        final_band: null,
        final_policy_hash: null,
        band_timeline: [],
        policy_hash_intervals: [],
    }));
    assertEquals(snap.schema, TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_SCHEMA);
    assertEquals(snap.band, "empty");
    assertEquals(snap.fields.band.value, "-- EMPTY 0/0");
    assertEquals(snap.fields.policy.value, "P-------- I0");
    assertEquals(snap.fields.error.value, "none");
    assertEquals(snap.fields.drift.value, "0ms M0");
});

Deno.test("replay HUD: compact fields include final band, policy intervals, drift, malformed", async () => {
    const snap = formatTranslationPolicyForensicReplayHud(classification({
        final_band: "drift",
        malformed_payloads: 2,
        policy_hash_intervals: [
            {
                local_policy_hash: 0xAAAA,
                start_ms: T0,
                end_ms: T0 + 1,
                start_sequence: 0,
                end_sequence: 0,
                local_pair_count: 1,
            },
            {
                local_policy_hash: 0xBBBB,
                start_ms: T0 + 2,
                end_ms: T0 + 4_000,
                start_sequence: 1,
                end_sequence: 3,
                local_pair_count: 2,
            },
        ],
    }));
    assertEquals(snap.fields.band.value, "DR DRIFT 4/4");
    assertEquals(snap.fields.policy.value, "P1234abcd I2");
    assertEquals(snap.drift_duration_ms, 2_000);
    assertEquals(snap.malformed_count, 2);
    assertEquals(snap.summary.includes("P1234abcd I2"), true);
});

Deno.test("replay HUD: first active error window is surfaced", async () => {
    const snap = formatTranslationPolicyForensicReplayHud(classification({
        final_band: "blocked",
        error_windows: [
            {
                kind: "tick-error",
                message: "old",
                start_ms: T0,
                end_ms: T0 + 1,
                start_sequence: 0,
                end_sequence: 0,
                first_event_hash: 0x10,
                last_event_hash: 0x10,
            },
            {
                kind: "proposal-failed",
                message: "2",
                start_ms: T0 + 2,
                end_ms: null,
                start_sequence: 1,
                end_sequence: null,
                first_event_hash: 0x20,
                last_event_hash: 0x20,
            },
        ],
    }));
    assertEquals(snap.active_error?.kind, "proposal-failed");
    assertEquals(snap.fields.error.value, "proposal-failed:2");
});

Deno.test("replay HUD: drift duration uses last replay time for open drift segment", async () => {
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
    assertEquals(translationPolicyReplayDriftDurationMs(c), 6_000);
    assertEquals(formatTranslationPolicyForensicReplayHud(c).fields.drift.value, "6s M0");
});

Deno.test("replay HUD: malformed count combines parser and payload malformed windows", async () => {
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
    assertEquals(translationPolicyReplayMalformedCount(c), 5);
});

Deno.test("replay HUD: helper fields preserve order", async () => {
    const fields = translationPolicyForensicReplayHudFields(classification());
    assertEquals(fields.map((f) => f.label), [
        "TPOL REPLAY",
        "TPOL POLICY",
        "TPOL ERROR",
        "TPOL DRIFT",
    ]);
});

Deno.test("replay HUD: summary truncates deterministically", async () => {
    const snap = formatTranslationPolicyForensicReplayHud(
        classification({ final_band: "install-error" }),
        { max_summary_len: 18 },
    );
    assertEquals(snap.summary.length, 18);
    assertEquals(snap.summary.endsWith("…"), true);
});

Deno.test("replay HUD: glyphs cover all replay bands", async () => {
    assertEquals(forensicReplayGlyph("nominal"), "OK");
    assertEquals(forensicReplayGlyph("watch"), "WA");
    assertEquals(forensicReplayGlyph("drift"), "DR");
    assertEquals(forensicReplayGlyph("blocked"), "BL");
    assertEquals(forensicReplayGlyph("disabled"), "DI");
    assertEquals(forensicReplayGlyph("install-error"), "IE");
    assertEquals(forensicReplayGlyph("tick-error"), "TE");
    assertEquals(forensicReplayGlyph("empty"), "--");
});

Deno.test("replay HUD: firstActiveErrorWindow returns null when all closed", async () => {
    assertEquals(firstActiveErrorWindow(classification()), null);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_FORENSIC_REPLAY_HUD_SCHEMA, "OMEGA-1850/v1");
});
