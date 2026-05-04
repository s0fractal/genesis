// Era 1900: Translation policy replay digest HUD formatter tests.
import { assertEquals } from "jsr:@std/assert";
import {
    TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA,
    formatReplayDigestDissenters,
    formatTranslationPolicyReplayDigestHud,
    q16ToPercent,
    translationPolicyReplayDigestHudBand,
    translationPolicyReplayDigestHudFields,
    translationPolicyReplayDigestHudGlyph,
} from "../../src/network/translation_policy/translation_policy_replay_digest_hud.ts";
import type {
    ReplayDigestQuorumSnapshot,
} from "../../src/network/translation_policy/translation_policy_replay_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestLiveWiringTelemetry,
} from "../../src/network/translation_policy/translation_policy_replay_digest_live_wiring.ts";

function snapshot(
    overrides: Partial<ReplayDigestQuorumSnapshot> = {},
): ReplayDigestQuorumSnapshot {
    return {
        schema: "OMEGA-1880/v1",
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
    overrides: Partial<TranslationPolicyReplayDigestLiveWiringTelemetry> = {},
): TranslationPolicyReplayDigestLiveWiringTelemetry {
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

Deno.test("replay digest HUD: nominal with agreed quorum and no errors", async () => {
    assertEquals(translationPolicyReplayDigestHudBand(snapshot(), telemetry()), "nominal");
});

Deno.test("replay digest HUD: watch for no claims, lone claim, or malformed", async () => {
    assertEquals(
        translationPolicyReplayDigestHudBand(
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
        translationPolicyReplayDigestHudBand(
            snapshot({ consensus_count: 1, total_claims: 1, band: "lone" }),
            telemetry(),
        ),
        "watch",
    );
    assertEquals(
        translationPolicyReplayDigestHudBand(snapshot(), telemetry({ claims_malformed: 1 })),
        "watch",
    );
});

Deno.test("replay digest HUD: drift when dissenters exist", async () => {
    assertEquals(
        translationPolicyReplayDigestHudBand(
            snapshot({ dissenter_peer_ids: [0xCC], distinct_digests: [1, 2] }),
            telemetry(),
        ),
        "drift",
    );
});

Deno.test("replay digest HUD: blocked when local emission fails", async () => {
    assertEquals(
        translationPolicyReplayDigestHudBand(
            snapshot({ dissenter_peer_ids: [0xCC] }),
            telemetry({ local_claims_failed: 1 }),
        ),
        "blocked",
    );
});

Deno.test("replay digest HUD: glyphs are stable ascii", async () => {
    assertEquals(translationPolicyReplayDigestHudGlyph("nominal"), "OK");
    assertEquals(translationPolicyReplayDigestHudGlyph("watch"), "WA");
    assertEquals(translationPolicyReplayDigestHudGlyph("drift"), "DR");
    assertEquals(translationPolicyReplayDigestHudGlyph("blocked"), "BL");
});

Deno.test("replay digest HUD: compact fields include quorum digest dissent and IO", async () => {
    const snap = formatTranslationPolicyReplayDigestHud(
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
    assertEquals(snap.schema, TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA);
    assertEquals(snap.band, "drift");
    assertEquals(snap.consensus_digest_hex, "1234abcd");
    assertEquals(snap.agreement_percent, 50);
    assertEquals(snap.fields.quorum.value, "DR DRIFT 2/4 double");
    assertEquals(snap.fields.digest.value, "D1234abcd A50% X2");
    assertEquals(snap.fields.dissent.value, "00cc,00dd");
    assertEquals(snap.fields.io.value, "C4/1 L1/0/0");
});

Deno.test("replay digest HUD: empty digest renders placeholders", async () => {
    const snap = formatTranslationPolicyReplayDigestHud(
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

Deno.test("replay digest HUD: helper fields preserve order", async () => {
    const fields = translationPolicyReplayDigestHudFields(snapshot(), telemetry());
    assertEquals(fields.map((f) => f.label), [
        "TPOL RDQ",
        "TPOL RDG",
        "TPOL RDD",
        "TPOL RDIO",
    ]);
});

Deno.test("replay digest HUD: summary truncates deterministically", async () => {
    const snap = formatTranslationPolicyReplayDigestHud(
        snapshot({ dissenter_peer_ids: [1, 2, 3, 4, 5, 6] }),
        telemetry(),
        { max_summary_len: 28 },
    );
    assertEquals(snap.summary.length, 28);
    assertEquals(snap.summary.endsWith("…"), true);
});

Deno.test("replay digest HUD: dissenter formatting sorts and caps", async () => {
    assertEquals(formatReplayDigestDissenters([], 4), "none");
    assertEquals(formatReplayDigestDissenters([0x30, 0x10, 0x20], 4), "0010,0020,0030");
    assertEquals(formatReplayDigestDissenters([1, 2, 3, 4, 5], 3), "0001,0002,0003+2");
});

Deno.test("replay digest HUD: q16 percent conversion", async () => {
    assertEquals(q16ToPercent(0), 0);
    assertEquals(q16ToPercent(32768), 50);
    assertEquals(q16ToPercent(65536), 100);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA, "OMEGA-1900/v1");
});
