// Era 1980: Translation policy replay digest digest HUD formatter tests.
import { assertEquals } from "jsr:@std/assert";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA,
    formatReplayDigestDigestDissenters,
    formatTranslationPolicyReplayDigestDigestHud,
    q16ToPercent,
    translationPolicyReplayDigestDigestHudBand,
    translationPolicyReplayDigestDigestHudFields,
    translationPolicyReplayDigestDigestHudGlyph,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_hud.ts";
import type {
    ReplayDigestDigestQuorumSnapshot,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
} from "../../src/network/translation_policy/translation_policy_replay_digest_digest_live_wiring.ts";

function snapshot(
    overrides: Partial<ReplayDigestDigestQuorumSnapshot> = {},
): ReplayDigestDigestQuorumSnapshot {
    return {
        schema: "OMEGA-1960/v1",
        consensus_digest: 0x1234_ABCD,
        consensus_count: 3,
        total_claims: 3,
        band: "high",
        dissenter_peer_ids: [],
        distinct_digests: [0x1234_ABCD],
        agreement_q16: 65536,
        consensus_claim: null,
        ...overrides,
    };
}

function telemetry(
    overrides:
        Partial<TranslationPolicyReplayDigestDigestLiveWiringTelemetry> = {},
): TranslationPolicyReplayDigestDigestLiveWiringTelemetry {
    return {
        claims_received: 3,
        claims_malformed: 0,
        claims_observed: 3,
        local_claims_built: 1,
        local_claims_emitted: 1,
        local_claims_failed: 0,
        local_claims_skipped: 0,
        ...overrides,
    };
}

Deno.test("replay digest digest HUD: nominal with agreed quorum and no errors", () => {
    assertEquals(
        translationPolicyReplayDigestDigestHudBand(snapshot(), telemetry()),
        "nominal",
    );
});

Deno.test("replay digest digest HUD: watch for no claims, lone claim, or malformed", () => {
    assertEquals(
        translationPolicyReplayDigestDigestHudBand(
            snapshot({
                consensus_digest: null,
                consensus_count: 0,
                total_claims: 0,
                band: "none",
                agreement_q16: 0,
            }),
            telemetry(),
        ),
        "watch",
    );
    assertEquals(
        translationPolicyReplayDigestDigestHudBand(
            snapshot({ consensus_count: 1, total_claims: 1, band: "lone" }),
            telemetry(),
        ),
        "watch",
    );
    assertEquals(
        translationPolicyReplayDigestDigestHudBand(
            snapshot(),
            telemetry({ claims_malformed: 1 }),
        ),
        "watch",
    );
});

Deno.test("replay digest digest HUD: drift when dissenters exist", () => {
    assertEquals(
        translationPolicyReplayDigestDigestHudBand(
            snapshot({ dissenter_peer_ids: [0xCC], distinct_digests: [1, 2] }),
            telemetry(),
        ),
        "drift",
    );
});

Deno.test("replay digest digest HUD: blocked when local emission fails", () => {
    assertEquals(
        translationPolicyReplayDigestDigestHudBand(
            snapshot({ dissenter_peer_ids: [0xCC] }),
            telemetry({ local_claims_failed: 1 }),
        ),
        "blocked",
    );
});

Deno.test("replay digest digest HUD: glyphs are stable ascii", () => {
    assertEquals(translationPolicyReplayDigestDigestHudGlyph("nominal"), "OK");
    assertEquals(translationPolicyReplayDigestDigestHudGlyph("watch"), "WA");
    assertEquals(translationPolicyReplayDigestDigestHudGlyph("drift"), "DR");
    assertEquals(translationPolicyReplayDigestDigestHudGlyph("blocked"), "BL");
});

Deno.test("replay digest digest HUD: compact fields include quorum digest dissent and IO", () => {
    const snap = formatTranslationPolicyReplayDigestDigestHud(
        snapshot({
            consensus_count: 2,
            total_claims: 4,
            band: "double",
            dissenter_peer_ids: [0xCC, 0xDD],
            distinct_digests: [0x1234_ABCD, 0x8888],
            agreement_q16: 32768,
        }),
        telemetry({ claims_observed: 4, claims_malformed: 1 }),
    );
    assertEquals(snap.schema, TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA);
    assertEquals(snap.band, "drift");
    assertEquals(snap.consensus_digest_hex, "1234abcd");
    assertEquals(snap.agreement_percent, 50);
    assertEquals(snap.fields.quorum.value, "DR DRIFT 2/4 double");
    assertEquals(snap.fields.digest.value, "D1234abcd A50% X2");
    assertEquals(snap.fields.dissent.value, "00cc,00dd");
    assertEquals(snap.fields.io.value, "C4/1 L1/0/0");
});

Deno.test("replay digest digest HUD: empty digest renders placeholders", () => {
    const snap = formatTranslationPolicyReplayDigestDigestHud(
        snapshot({
            consensus_digest: null,
            consensus_count: 0,
            total_claims: 0,
            band: "none",
            distinct_digests: [],
            agreement_q16: 0,
        }),
        telemetry(),
    );
    assertEquals(snap.consensus_digest_hex, "--------");
    assertEquals(snap.fields.digest.value, "D-------- A0% X0");
});

Deno.test("replay digest digest HUD: helper fields preserve order", () => {
    const fields = translationPolicyReplayDigestDigestHudFields(
        snapshot(),
        telemetry(),
    );
    assertEquals(fields.map((f) => f.label), [
        "TPOL RDDQ",
        "TPOL RDDG",
        "TPOL RDDD",
        "TPOL RDDIO",
    ]);
});

Deno.test("replay digest digest HUD: summary truncates deterministically", () => {
    const snap = formatTranslationPolicyReplayDigestDigestHud(
        snapshot({ dissenter_peer_ids: [1, 2, 3, 4, 5, 6] }),
        telemetry(),
        { max_summary_len: 28 },
    );
    assertEquals(snap.summary.length, 28);
    assertEquals(snap.summary.endsWith("…"), true);
});

Deno.test("replay digest digest HUD: dissenter formatting sorts and caps", () => {
    assertEquals(formatReplayDigestDigestDissenters([], 4), "none");
    assertEquals(
        formatReplayDigestDigestDissenters([0x30, 0x10, 0x20], 4),
        "0010,0020,0030",
    );
    assertEquals(
        formatReplayDigestDigestDissenters([1, 2, 3, 4, 5], 3),
        "0001,0002,0003+2",
    );
});

Deno.test("replay digest digest HUD: q16 percent conversion", () => {
    assertEquals(q16ToPercent(0), 0);
    assertEquals(q16ToPercent(32768), 50);
    assertEquals(q16ToPercent(65536), 100);
});

Deno.test("replay digest digest HUD: schema constant", () => {
    assertEquals(
        TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA,
        "OMEGA-1980/v1",
    );
});
