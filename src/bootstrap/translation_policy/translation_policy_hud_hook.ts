// OMEGA-64: Era 1760 - Translation Policy Bootstrap HUD Hook
//
// Bootstrap owns scarce HUD slots. Translation policy owns rich runtime
// telemetry. This hook keeps the boundary explicit: a caller must opt in
// with an existing runtime-like object before any slot is touched.

import {
    DEFAULT_TRANSLATION_POLICY_HUD_OPTS,
    formatTranslationPolicyHud,
    TranslationPolicyHudOptions,
} from "../../network/translation_policy/translation_policy_hud.ts";
import { TranslationPolicyRuntimeTelemetry } from "../../network/translation_policy/translation_policy_runtime.ts";

export const TRANSLATION_POLICY_HUD_HOOK_SCHEMA = "OMEGA-1760/v1";

export type HudStatSlot = "a" | "b" | "c" | "d" | "e" | "f";

export type HudStatWriter = (
    slot: HudStatSlot,
    label: string,
    value: string,
) => void;

export interface TranslationPolicyTelemetrySource {
    telemetry(now_ms: number): TranslationPolicyRuntimeTelemetry;
}

export interface TranslationPolicyHudHookOptions {
    enabled: boolean;
    slot: HudStatSlot;
    min_interval_ms: number;
    label: string;
    hud: TranslationPolicyHudOptions;
}

export type TranslationPolicyHudHookOptionsInput =
    Partial<Omit<TranslationPolicyHudHookOptions, "hud">> & {
        hud?: Partial<TranslationPolicyHudOptions>;
    };

export interface TranslationPolicyHudHookTick {
    schema: string;
    updated: boolean;
    reason: "updated" | "disabled" | "cooldown" | "runtime-error";
    now_ms: number;
    summary: string | null;
}

export const DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS: TranslationPolicyHudHookOptions = {
    enabled: false,
    slot: "c",
    min_interval_ms: 1_000,
    label: "TPOL",
    hud: DEFAULT_TRANSLATION_POLICY_HUD_OPTS,
};

export class TranslationPolicyHudHook {
    private lastUpdateMs = Number.NEGATIVE_INFINITY;

    constructor(
        private readonly source: TranslationPolicyTelemetrySource,
        private readonly write: HudStatWriter,
        private readonly opts: TranslationPolicyHudHookOptions =
            DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS,
    ) {}

    tick(now_ms: number): TranslationPolicyHudHookTick {
        if (!this.opts.enabled) return this.result(now_ms, "disabled", null);
        if (now_ms - this.lastUpdateMs < this.opts.min_interval_ms) {
            return this.result(now_ms, "cooldown", null);
        }
        try {
            const snapshot = formatTranslationPolicyHud(
                this.source.telemetry(now_ms),
                this.opts.hud,
            );
            this.write(this.opts.slot, this.opts.label, snapshot.summary);
            this.lastUpdateMs = now_ms;
            return this.result(now_ms, "updated", snapshot.summary);
        } catch {
            return this.result(now_ms, "runtime-error", null);
        }
    }

    private result(
        now_ms: number,
        reason: TranslationPolicyHudHookTick["reason"],
        summary: string | null,
    ): TranslationPolicyHudHookTick {
        return {
            schema: TRANSLATION_POLICY_HUD_HOOK_SCHEMA,
            updated: reason === "updated",
            reason,
            now_ms,
            summary,
        };
    }
}

export function createTranslationPolicyHudHook(
    source: TranslationPolicyTelemetrySource | null | undefined,
    write: HudStatWriter,
    opts: TranslationPolicyHudHookOptionsInput = {},
): TranslationPolicyHudHook | null {
    if (!source) return null;
    return new TranslationPolicyHudHook(source, write, mergeOptions(opts));
}

export function mergeTranslationPolicyHudHookOptions(
    opts: TranslationPolicyHudHookOptionsInput = {},
): TranslationPolicyHudHookOptions {
    return mergeOptions(opts);
}

function mergeOptions(
    opts: TranslationPolicyHudHookOptionsInput,
): TranslationPolicyHudHookOptions {
    return {
        ...DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS,
        ...opts,
        hud: {
            ...DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS.hud,
            ...(opts.hud ?? {}),
        },
    };
}
