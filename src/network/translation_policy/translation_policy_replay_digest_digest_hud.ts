// OMEGA-64: Era 1980 - Translation Policy Replay Digest Digest HUD
//
// Formats live `tpdq` replay-interpretation digest quorum state into
// compact operator fields without mutating DOM or owning runtime/network
// state.

import type {
    ReplayDigestDigestQuorumSnapshot,
} from "./translation_policy_replay_digest_digest_quorum.ts";
import type {
    TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
} from "./translation_policy_replay_digest_digest_live_wiring.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA =
    "OMEGA-1980/v1";

export type TranslationPolicyReplayDigestDigestHudBand =
    | "nominal"
    | "watch"
    | "drift"
    | "blocked";

export interface TranslationPolicyReplayDigestDigestHudField {
    label: string;
    value: string;
}

export interface TranslationPolicyReplayDigestDigestHudSnapshot {
    schema: string;
    band: TranslationPolicyReplayDigestDigestHudBand;
    glyph: string;
    summary: string;
    consensus_digest_hex: string;
    agreement_percent: number;
    fields: {
        quorum: TranslationPolicyReplayDigestDigestHudField;
        digest: TranslationPolicyReplayDigestDigestHudField;
        dissent: TranslationPolicyReplayDigestDigestHudField;
        io: TranslationPolicyReplayDigestDigestHudField;
    };
}

export interface TranslationPolicyReplayDigestDigestHudOptions {
    max_summary_len: number;
    max_dissenters: number;
}

export const DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_OPTS:
    TranslationPolicyReplayDigestDigestHudOptions = {
        max_summary_len: 112,
        max_dissenters: 4,
    };

export function translationPolicyReplayDigestDigestHudBand(
    snapshot: ReplayDigestDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
): TranslationPolicyReplayDigestDigestHudBand {
    if (telemetry.local_claims_failed > 0) return "blocked";
    if (snapshot.dissenter_peer_ids.length > 0) return "drift";
    if (
        snapshot.total_claims === 0 ||
        snapshot.band === "lone" ||
        telemetry.claims_malformed > 0
    ) return "watch";
    return "nominal";
}

export function translationPolicyReplayDigestDigestHudGlyph(
    band: TranslationPolicyReplayDigestDigestHudBand,
): string {
    switch (band) {
        case "nominal": return "OK";
        case "watch": return "WA";
        case "drift": return "DR";
        case "blocked": return "BL";
    }
}

export function formatTranslationPolicyReplayDigestDigestHud(
    snapshot: ReplayDigestDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
    opts: Partial<TranslationPolicyReplayDigestDigestHudOptions> = {},
): TranslationPolicyReplayDigestDigestHudSnapshot {
    const cfg = {
        ...DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_OPTS,
        ...opts,
    };
    const band = translationPolicyReplayDigestDigestHudBand(snapshot, telemetry);
    const glyph = translationPolicyReplayDigestDigestHudGlyph(band);
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
            label: "TPOL RDDQ",
            value:
                `${glyph} ${band.toUpperCase()} ${snapshot.consensus_count}/${snapshot.total_claims} ${snapshot.band}`,
        },
        digest: {
            label: "TPOL RDDG",
            value:
                `D${digestHex} A${agreementPercent}% X${snapshot.distinct_digests.length}`,
        },
        dissent: {
            label: "TPOL RDDD",
            value: dissenterValue,
        },
        io: {
            label: "TPOL RDDIO",
            value:
                `C${telemetry.claims_observed}/${telemetry.claims_malformed} L${telemetry.local_claims_emitted}/${telemetry.local_claims_failed}/${telemetry.local_claims_skipped}`,
        },
    };
    const summary = truncate(
        `${fields.quorum.value} | ${fields.digest.value} | P ${fields.dissent.value} | ${fields.io.value}`,
        cfg.max_summary_len,
    );
    return {
        schema: TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_SCHEMA,
        band,
        glyph,
        summary,
        consensus_digest_hex: digestHex,
        agreement_percent: agreementPercent,
        fields,
    };
}

export function translationPolicyReplayDigestDigestHudFields(
    snapshot: ReplayDigestDigestQuorumSnapshot,
    telemetry: TranslationPolicyReplayDigestDigestLiveWiringTelemetry,
    opts: Partial<TranslationPolicyReplayDigestDigestHudOptions> = {},
): TranslationPolicyReplayDigestDigestHudField[] {
    const snap = formatTranslationPolicyReplayDigestDigestHud(
        snapshot,
        telemetry,
        opts,
    );
    return [snap.fields.quorum, snap.fields.digest, snap.fields.dissent, snap.fields.io];
}

export function q16ToPercent(value: number): number {
    return Math.round(((value >>> 0) / 65536) * 100);
}

export function formatReplayDigestDigestDissenters(
    peer_ids: ReadonlyArray<number>,
    max_dissenters: number =
        DEFAULT_TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_HUD_OPTS.max_dissenters,
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
