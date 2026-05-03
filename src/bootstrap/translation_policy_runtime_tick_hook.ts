// OMEGA-64: Era 1800 - Translation Policy Runtime Tick Hook
//
// HUD formatting and outbound policy broadcast cadence are separate
// bootstrap concerns. This hook drives `runtime.tick(...)` at a bounded
// interval without coupling it to HUD slot updates.

import { TranslationPolicyRuntimeTickResult } from "../network/translation_policy_runtime.ts";

export const TRANSLATION_POLICY_RUNTIME_TICK_HOOK_SCHEMA = "OMEGA-1800/v1";

export interface TranslationPolicyRuntimeTickSource {
    tick(now_ms: number, max_peers?: number): TranslationPolicyRuntimeTickResult;
}

export interface TranslationPolicyRuntimeTickHookOptions {
    enabled: boolean;
    min_interval_ms: number;
    max_peers_per_tick: number;
}

export type TranslationPolicyRuntimeTickHookOptionsInput =
    Partial<TranslationPolicyRuntimeTickHookOptions>;

export interface TranslationPolicyRuntimeTickHookResult {
    schema: string;
    ticked: boolean;
    reason: "ticked" | "disabled" | "cooldown" | "runtime-error";
    now_ms: number;
    runtime_result: TranslationPolicyRuntimeTickResult | null;
    error?: string;
}

export const DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS:
    TranslationPolicyRuntimeTickHookOptions = {
        enabled: false,
        min_interval_ms: 1_000,
        max_peers_per_tick: 4,
    };

export class TranslationPolicyRuntimeTickHook {
    private lastTickMs = Number.NEGATIVE_INFINITY;

    constructor(
        private readonly source: TranslationPolicyRuntimeTickSource,
        private readonly opts: TranslationPolicyRuntimeTickHookOptions =
            DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS,
    ) {}

    tick(now_ms: number): TranslationPolicyRuntimeTickHookResult {
        if (!this.opts.enabled) return this.result(now_ms, "disabled", null);
        if (now_ms - this.lastTickMs < this.opts.min_interval_ms) {
            return this.result(now_ms, "cooldown", null);
        }
        try {
            const runtimeResult = this.source.tick(
                now_ms,
                this.opts.max_peers_per_tick,
            );
            this.lastTickMs = now_ms;
            return this.result(now_ms, "ticked", runtimeResult);
        } catch (e) {
            return {
                ...this.result(now_ms, "runtime-error", null),
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }

    private result(
        now_ms: number,
        reason: TranslationPolicyRuntimeTickHookResult["reason"],
        runtime_result: TranslationPolicyRuntimeTickResult | null,
    ): TranslationPolicyRuntimeTickHookResult {
        return {
            schema: TRANSLATION_POLICY_RUNTIME_TICK_HOOK_SCHEMA,
            ticked: reason === "ticked",
            reason,
            now_ms,
            runtime_result,
        };
    }
}

export function createTranslationPolicyRuntimeTickHook(
    source: TranslationPolicyRuntimeTickSource | null | undefined,
    opts: TranslationPolicyRuntimeTickHookOptionsInput = {},
): TranslationPolicyRuntimeTickHook | null {
    if (!source) return null;
    return new TranslationPolicyRuntimeTickHook(source, mergeOptions(opts));
}

export function mergeTranslationPolicyRuntimeTickHookOptions(
    opts: TranslationPolicyRuntimeTickHookOptionsInput = {},
): TranslationPolicyRuntimeTickHookOptions {
    return mergeOptions(opts);
}

function mergeOptions(
    opts: TranslationPolicyRuntimeTickHookOptionsInput,
): TranslationPolicyRuntimeTickHookOptions {
    return {
        ...DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS,
        ...opts,
    };
}
