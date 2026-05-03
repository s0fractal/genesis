// 🌌 OMEGA-64: Era 1750 — Translation Policy HUD Telemetry Bridge
//
// Runtime telemetry is intentionally rich. HUD slots are intentionally
// scarce. This bridge formats the Era 1740 runtime snapshot into compact
// operator strings without mutating DOM or expanding the core slot
// contract.

import { TranslationPolicyRuntimeTelemetry } from "./translation_policy_runtime.ts";

export const TRANSLATION_POLICY_HUD_SCHEMA = "OMEGA-1750/v1";

export type TranslationPolicyHudBand = "nominal" | "watch" | "drift" | "blocked";

export interface TranslationPolicyHudField {
    label: string;
    value: string;
}

export interface TranslationPolicyHudSnapshot {
    schema: string;
    band: TranslationPolicyHudBand;
    glyph: string;
    summary: string;
    fields: {
        policy: TranslationPolicyHudField;
        peers: TranslationPolicyHudField;
        warrants: TranslationPolicyHudField;
    };
}

export interface TranslationPolicyHudOptions {
    max_summary_len: number;
}

export const DEFAULT_TRANSLATION_POLICY_HUD_OPTS: TranslationPolicyHudOptions = {
    max_summary_len: 96,
};

export function translationPolicyHudBand(
    telemetry: TranslationPolicyRuntimeTelemetry,
): TranslationPolicyHudBand {
    if (telemetry.loop.proposals_failed > 0 || telemetry.live.local_raises_failed > 0) {
        return "blocked";
    }
    if (
        telemetry.loop.drift_peer_count > 0 ||
        telemetry.loop.corroboration_blocked > 0 ||
        telemetry.live.corroboration_raises_malformed > 0
    ) {
        return "drift";
    }
    if (
        telemetry.peer_count === 0 ||
        telemetry.live.claims_malformed > 0 ||
        telemetry.directory.malformed_events > 0
    ) {
        return "watch";
    }
    return "nominal";
}

export function translationPolicyHudGlyph(band: TranslationPolicyHudBand): string {
    switch (band) {
        case "nominal": return "🟢";
        case "watch": return "🟡";
        case "drift": return "🟠";
        case "blocked": return "🔴";
    }
}

export function formatTranslationPolicyHud(
    telemetry: TranslationPolicyRuntimeTelemetry,
    opts: TranslationPolicyHudOptions = DEFAULT_TRANSLATION_POLICY_HUD_OPTS,
): TranslationPolicyHudSnapshot {
    const band = translationPolicyHudBand(telemetry);
    const glyph = translationPolicyHudGlyph(band);
    const policyValue = `P${hex8(telemetry.loop.local_policy_hash)} D${telemetry.loop.drift_peer_count}`;
    const peersValue = `${telemetry.peer_count}/${telemetry.due_peer_count} due`;
    const warrantsValue = `W${telemetry.loop.proposals_emitted}/${telemetry.loop.proposals_failed} C${telemetry.loop.corroboration_blocked}`;
    const summary = truncate(
        `${glyph} TPOL ${band.toUpperCase()} | ${policyValue} | PEERS ${peersValue} | ${warrantsValue}`,
        opts.max_summary_len,
    );
    return {
        schema: TRANSLATION_POLICY_HUD_SCHEMA,
        band,
        glyph,
        summary,
        fields: {
            policy: { label: "TPOL", value: policyValue },
            peers: { label: "TPOL PEERS", value: peersValue },
            warrants: { label: "TPOL WARRANT", value: warrantsValue },
        },
    };
}

export function translationPolicyHudFields(
    telemetry: TranslationPolicyRuntimeTelemetry,
    opts: TranslationPolicyHudOptions = DEFAULT_TRANSLATION_POLICY_HUD_OPTS,
): TranslationPolicyHudField[] {
    const snap = formatTranslationPolicyHud(telemetry, opts);
    return [snap.fields.policy, snap.fields.peers, snap.fields.warrants];
}

function hex8(n: number): string {
    return (n >>> 0).toString(16).padStart(8, "0");
}

function truncate(s: string, max: number): string {
    if (max <= 0) return "";
    if (s.length <= max) return s;
    if (max <= 1) return s.slice(0, max);
    return `${s.slice(0, max - 1)}…`;
}
