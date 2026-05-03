// OMEGA-64: Era 1900 - Translation Policy Replay Digest Quorum HUD
//
// Formats live replay-digest quorum state into compact operator fields
// without mutating DOM or owning runtime/network state.

import type {
    ReplayDigestQuorumSnapshot,
} from "./translation_policy_replay_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestLiveWiringTelemetry,
} from "./translation_policy_replay_digest_live_wiring.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA = "OMEGA-1900/v1";

export type TranslationPolicyReplayDigestHudBand =
    | "nominal"
    | "watch"
    | "drift"
    | "blocked";

export interface TranslationPolicyReplayDigestHudField {
    label: string;
    value: string;
}

export interface TranslationPolicyReplayDigestHudSnapshot {
    schema: string;
    band: TranslationPolicyReplayDigestHudBand;
    glyph: string;
    summary: string;
    consensus_digest_hex: string;
    agreement_percent: number;
    fields: {
        quorum: TranslationPolicyReplayDigestHudField;
        digest: TranslationPolicyReplayDigestHudField;
        dissent: TranslationPolicyReplayDigestHudField;
        io: TranslationPolicyReplayDigestHudField;
    };
}

export interface TranslationPolicyReplayDigestHudOptions {
    max_summary_len: number;
    max_dissenters: number;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_HUD_OPTS:
    TranslationPolicyReplayDigestHudOptions = {
        max_summary_len: 112,
        max_dissenters: 4,
    };

export function translationPolicyReplayDigestHudBand(
    snapshot: ReplayDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestLiveWiringTelemetry,
): TranslationPolicyReplayDigestHudBand {
    if (telemetry.local_claims_failed > 0) return "blocked";
    if (snapshot.dissenter_peer_ids.length > 0) return "drift";
    if (
        snapshot.total_claims === 0 ||
        snapshot.band === "lone" ||
        telemetry.claims_malformed > 0
    ) return "watch";
    return "nominal";
}

export function translationPolicyReplayDigestHudGlyph(
    band: TranslationPolicyReplayDigestHudBand,
): string {
    switch (band) {
        case "nominal": return "OK";
        case "watch": return "WA";
        case "drift": return "DR";
        case "blocked": return "BL";
    }
}

export function formatTranslationPolicyReplayDigestHud(
    snapshot: ReplayDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestLiveWiringTelemetry,
    opts: Partial<TranslationPolicyReplayDigestHudOptions> = {},
): TranslationPolicyReplayDigestHudSnapshot {
    const cfg = { ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_HUD_OPTS, ...opts };
    const band = translationPolicyReplayDigestHudBand(snapshot, telemetry);
    const glyph = translationPolicyReplayDigestHudGlyph(band);
    const digestHex = snapshot.consensus_digest === null
        ? "--------"
        : hex8(snapshot.consensus_digest);
    const agreementPercent = q16ToPercent(snapshot.agreement_q16);
    const dissenterValue = formatDissenters(
        snapshot.dissenter_peer_ids,
        cfg.max_dissenters,
    );
    const fields = {
        quorum: {
            label: "TPOL RDQ",
            value:
                `${glyph} ${band.toUpperCase()} ${snapshot.consensus_count}/${snapshot.total_claims} ${snapshot.band}`,
        },
        digest: {
            label: "TPOL RDG",
            value:
                `D${digestHex} A${agreementPercent}% X${snapshot.distinct_digests.length}`,
        },
        dissent: {
            label: "TPOL RDD",
            value: dissenterValue,
        },
        io: {
            label: "TPOL RDIO",
            value:
                `C${telemetry.claims_observed}/${telemetry.claims_malformed} L${telemetry.local_claims_emitted}/${telemetry.local_claims_failed}/${telemetry.local_claims_skipped}`,
        },
    };
    const summary = truncate(
        `${fields.quorum.value} | ${fields.digest.value} | P ${fields.dissent.value} | ${fields.io.value}`,
        cfg.max_summary_len,
    );
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_HUD_SCHEMA,
        band,
        glyph,
        summary,
        consensus_digest_hex: digestHex,
        agreement_percent: agreementPercent,
        fields,
    };
}

export function translationPolicyReplayDigestHudFields(
    snapshot: ReplayDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestLiveWiringTelemetry,
    opts: Partial<TranslationPolicyReplayDigestHudOptions> = {},
): TranslationPolicyReplayDigestHudField[] {
    const snap = formatTranslationPolicyReplayDigestHud(snapshot, telemetry, opts);
    return [snap.fields.quorum, snap.fields.digest, snap.fields.dissent, snap.fields.io];
}

export function q16ToPercent(value: number): number {
    return Math.round(((value >>> 0) / 65536) * 100);
}

export function formatReplayDigestDissenters(
    peer_ids: ReadonlyArray<number>,
    max_dissenters: number =
        DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_HUD_OPTS.max_dissenters,
): string {
    return formatDissenters(peer_ids, max_dissenters);
}

function formatDissenters(
    peer_ids: ReadonlyArray<number>,
    max_dissenters: number,
): string {
    if (peer_ids.length === 0) return "none";
    const max = Math.max(0, max_dissenters | 0);
    const shown = [...peer_ids]
        .sort((a, b) => (a >>> 0) - (b >>> 0))
        .slice(0, max)
        .map((id) => hex4(id));
    const hidden = peer_ids.length - shown.length;
    return hidden > 0 ? `${shown.join(",")}+${hidden}` : shown.join(",");
}

function hex8(n: number): string {
    return (n >>> 0).toString(16).padStart(8, "0");
}

function hex4(n: number): string {
    return (n >>> 0).toString(16).padStart(4, "0");
}

function truncate(s: string, max: number): string {
    if (max <= 0) return "";
    if (s.length <= max) return s;
    if (max <= 1) return s.slice(0, max);
    return `${s.slice(0, max - 1)}…`;
}
