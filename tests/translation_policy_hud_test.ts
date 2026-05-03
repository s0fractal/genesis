// Era 1750: Translation policy HUD telemetry bridge tests.
import { assertEquals } from "jsr:@std/assert";
import {
    TRANSLATION_POLICY_HUD_SCHEMA,
    formatTranslationPolicyHud,
    translationPolicyHudBand,
    translationPolicyHudFields,
    translationPolicyHudGlyph,
} from "../src/network/translation_policy_hud.ts";
import { TranslationPolicyRuntimeTelemetry } from "../src/network/translation_policy_runtime.ts";

function telemetry(
    overrides: Partial<TranslationPolicyRuntimeTelemetry> = {},
): TranslationPolicyRuntimeTelemetry {
    const base: TranslationPolicyRuntimeTelemetry = {
        schema: "OMEGA-1740/v1",
        active: true,
        live_active: true,
        directory_active: true,
        peer_count: 3,
        due_peer_count: 1,
        live: {
            claims_received: 4,
            claims_malformed: 0,
            claims_observed: 4,
            corroboration_raises_received: 1,
            corroboration_raises_malformed: 0,
            corroboration_raises_recorded: 1,
            local_raises_built: 0,
            local_raises_emitted: 0,
            local_raises_failed: 0,
            local_raises_skipped: 0,
        },
        directory: {
            joined_received: 3,
            left_received: 0,
            activity_received: 4,
            malformed_events: 0,
            peers_added: 3,
            peers_removed: 0,
            activity_peers_seen: 4,
        },
        loop: {
            claims_observed: 4,
            malformed_claims: 0,
            drift_events_seen: 0,
            proposals_built: 0,
            proposals_emitted: 0,
            proposals_failed: 0,
            proposals_deduped: 0,
            corroboration_blocked: 0,
            observed_peer_count: 3,
            drift_peer_count: 0,
            monitor_alarm_count: 0,
            corroborated_drift_count: 0,
            local_policy_hash: 0x1234_ABCD,
            local_pair_count: 2,
        },
    };
    return {
        ...base,
        ...overrides,
        live: { ...base.live, ...(overrides.live ?? {}) },
        directory: { ...base.directory, ...(overrides.directory ?? {}) },
        loop: { ...base.loop, ...(overrides.loop ?? {}) },
    };
}

Deno.test("band: nominal when peers exist and no drift/malformed/failures", () => {
    assertEquals(translationPolicyHudBand(telemetry()), "nominal");
});

Deno.test("band: watch when no peers", () => {
    assertEquals(translationPolicyHudBand(telemetry({ peer_count: 0 })), "watch");
});

Deno.test("band: watch when malformed input observed", () => {
    assertEquals(translationPolicyHudBand(telemetry({
        live: { claims_malformed: 1 } as any,
    })), "watch");
    assertEquals(translationPolicyHudBand(telemetry({
        directory: { malformed_events: 1 } as any,
    })), "watch");
});

Deno.test("band: drift when policy drift or corroboration block exists", () => {
    assertEquals(translationPolicyHudBand(telemetry({
        loop: { drift_peer_count: 1 } as any,
    })), "drift");
    assertEquals(translationPolicyHudBand(telemetry({
        loop: { corroboration_blocked: 1 } as any,
    })), "drift");
});

Deno.test("band: blocked when warrant or local raise emit fails", () => {
    assertEquals(translationPolicyHudBand(telemetry({
        loop: { proposals_failed: 1 } as any,
    })), "blocked");
    assertEquals(translationPolicyHudBand(telemetry({
        live: { local_raises_failed: 1 } as any,
    })), "blocked");
});

Deno.test("glyphs are stable", () => {
    assertEquals(translationPolicyHudGlyph("nominal"), "🟢");
    assertEquals(translationPolicyHudGlyph("watch"), "🟡");
    assertEquals(translationPolicyHudGlyph("drift"), "🟠");
    assertEquals(translationPolicyHudGlyph("blocked"), "🔴");
});

Deno.test("format: compact fields include policy hash, peers, warrants", () => {
    const snap = formatTranslationPolicyHud(telemetry());
    assertEquals(snap.schema, TRANSLATION_POLICY_HUD_SCHEMA);
    assertEquals(snap.fields.policy, { label: "TPOL", value: "P1234abcd D0" });
    assertEquals(snap.fields.peers, { label: "TPOL PEERS", value: "3/1 due" });
    assertEquals(snap.fields.warrants, { label: "TPOL WARRANT", value: "W0/0 C0" });
    assertEquals(snap.summary.includes("TPOL NOMINAL"), true);
});

Deno.test("format: summary truncates deterministically", () => {
    const snap = formatTranslationPolicyHud(telemetry(), { max_summary_len: 24 });
    assertEquals(snap.summary.length, 24);
    assertEquals(snap.summary.endsWith("…"), true);
});

Deno.test("fields helper returns three HUD-ready fields", () => {
    const fields = translationPolicyHudFields(telemetry());
    assertEquals(fields.map((f) => f.label), ["TPOL", "TPOL PEERS", "TPOL WARRANT"]);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_HUD_SCHEMA, "OMEGA-1750/v1");
});
