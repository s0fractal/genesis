// OMEGA-64: Era 1810 - Translation Policy Bootstrap Telemetry Snapshot
//
// Operators need one stable diagnostic object instead of reaching into
// installer result, runtime internals, tick hook output, and mesh emit
// counters separately.

import type {
    TranslationPolicyBootstrapInstallResult,
} from "./translation_policy_bootstrap_installer.ts";
import type {
    TranslationPolicyRuntimeTickHookResult,
} from "./translation_policy_runtime_tick_hook.ts";
import type {
    TranslationPolicyMeshEmitTelemetry,
} from "../network/translation_policy_mesh_emit_adapter.ts";
import type {
    TranslationPolicyRuntimeTelemetry,
} from "../network/translation_policy_runtime.ts";

export const TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA = "OMEGA-1810/v1";

export interface TranslationPolicyBootstrapTelemetrySnapshot {
    schema: string;
    now_ms: number;
    installed: boolean;
    install_reason: TranslationPolicyBootstrapInstallResult["reason"];
    install_error: string | null;
    tick: {
        ticked: boolean;
        reason: TranslationPolicyRuntimeTickHookResult["reason"] | "none";
        now_ms: number | null;
        sent_count: number;
        failed_count: number;
        skipped_unchanged_count: number;
        cold_count: number;
        error: string | null;
    };
    runtime: TranslationPolicyRuntimeTelemetry | null;
    emit: TranslationPolicyMeshEmitTelemetry | null;
}

export function translationPolicyBootstrapTelemetrySnapshot(
    install: TranslationPolicyBootstrapInstallResult,
    lastTick: TranslationPolicyRuntimeTickHookResult | null,
    now_ms: number,
): TranslationPolicyBootstrapTelemetrySnapshot {
    const runtime = runtimeTelemetry(install, now_ms, lastTick);
    const broadcast = lastTick?.runtime_result?.broadcast;
    return {
        schema: TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA,
        now_ms,
        installed: install.installed,
        install_reason: install.reason,
        install_error: install.error ?? null,
        tick: {
            ticked: lastTick?.ticked ?? false,
            reason: lastTick?.reason ?? "none",
            now_ms: lastTick?.now_ms ?? null,
            sent_count: broadcast?.sent_count ?? 0,
            failed_count: broadcast?.failed_count ?? 0,
            skipped_unchanged_count: broadcast?.skipped_unchanged_count ?? 0,
            cold_count: broadcast?.cold_count ?? 0,
            error: lastTick?.error ?? null,
        },
        runtime,
        emit: install.adapter?.telemetry() ?? null,
    };
}

function runtimeTelemetry(
    install: TranslationPolicyBootstrapInstallResult,
    now_ms: number,
    lastTick: TranslationPolicyRuntimeTickHookResult | null,
): TranslationPolicyRuntimeTelemetry | null {
    if (lastTick?.runtime_result?.telemetry) {
        return lastTick.runtime_result.telemetry;
    }
    try {
        return install.factory?.runtime.telemetry(now_ms) ?? null;
    } catch {
        return null;
    }
}
