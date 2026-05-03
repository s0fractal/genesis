// OMEGA-64: Era 1790 - Translation Policy Bootstrap Installer
//
// This is the narrow bootstrap-facing composition point for the
// translation-policy stack. It keeps `bootstrap/v2.ts` from knowing the
// runtime graph while preserving explicit operator opt-in.

import type { EventSource } from "../network/quarantine_lifecycle_bridge.ts";
import type {
    TranslationPolicyRuntimeTickHookOptionsInput,
} from "./translation_policy_runtime_tick_hook.ts";
import type {
    TranslationPolicyTelemetryEventOptionsInput,
} from "./translation_policy_telemetry_event.ts";
import { SchemaTranslatorRegistry } from "../network/schema_translator.ts";
import {
    createTranslationPolicyMeshEmitAdapter,
    TranslationPolicyMeshEmitAdapter,
    TranslationPolicyMeshEmitOptions,
    TranslationPolicyMeshLike,
} from "../network/translation_policy_mesh_emit_adapter.ts";
import {
    createTranslationPolicyRuntime,
    installTranslationPolicyRuntimeGlobal,
    TranslationPolicyRuntimeFactoryOptions,
    TranslationPolicyRuntimeFactoryResult,
    TranslationPolicyRuntimeGlobalTarget,
} from "../network/translation_policy_runtime_factory.ts";

export const TRANSLATION_POLICY_BOOTSTRAP_INSTALLER_SCHEMA = "OMEGA-1790/v1";

export type TranslationPolicyBootstrapGlobalTarget =
    TranslationPolicyRuntimeGlobalTarget & {
        __OMEGA_TRANSLATION_POLICY_TICK__?:
            boolean | TranslationPolicyRuntimeTickHookOptionsInput;
        __OMEGA_TRANSLATION_POLICY_TELEMETRY_EVENT__?:
            boolean | TranslationPolicyTelemetryEventOptionsInput;
    };

export interface TranslationPolicyBootstrapInstallOptions {
    enabled: boolean;
    local_peer_id?: number;
    witness_id?: number;
    registry?: SchemaTranslatorRegistry;
    event_source?: EventSource;
    now_ms?: () => number;
    auto_start?: boolean;
    hud?: boolean | Record<string, unknown>;
    tick?: boolean | TranslationPolicyRuntimeTickHookOptionsInput;
    telemetry_event?: boolean | TranslationPolicyTelemetryEventOptionsInput;
    mesh_emit?: Partial<TranslationPolicyMeshEmitOptions>;
    runtime?: Partial<Omit<
        TranslationPolicyRuntimeFactoryOptions,
        | "local_peer_id"
        | "witness_id"
        | "registry"
        | "event_source"
        | "claim_emit"
        | "raise_emit"
        | "warrant_emit"
        | "now_ms"
        | "auto_start"
    >>;
}

export interface TranslationPolicyBootstrapInstallResult {
    schema: string;
    installed: boolean;
    reason: "installed" | "disabled" | "invalid-peer-id" | "install-error";
    adapter: TranslationPolicyMeshEmitAdapter | null;
    factory: TranslationPolicyRuntimeFactoryResult | null;
    error?: string;
}

export function installTranslationPolicyBootstrap(
    mesh: TranslationPolicyMeshLike,
    opts: TranslationPolicyBootstrapInstallOptions | undefined,
    target: TranslationPolicyBootstrapGlobalTarget =
        globalThis as TranslationPolicyBootstrapGlobalTarget,
): TranslationPolicyBootstrapInstallResult {
    if (!opts?.enabled) return result("disabled", null, null);
    if (!Number.isFinite(opts.local_peer_id) || !Number.isFinite(opts.witness_id)) {
        return result("invalid-peer-id", null, null);
    }
    try {
        const adapter = createTranslationPolicyMeshEmitAdapter(mesh, opts.mesh_emit);
        const callbacks = adapter.callbacks();
        const factory = createTranslationPolicyRuntime({
            local_peer_id: opts.local_peer_id! >>> 0,
            witness_id: opts.witness_id! >>> 0,
            registry: opts.registry ?? new SchemaTranslatorRegistry(),
            event_source: opts.event_source ?? globalThis as EventSource,
            now_ms: opts.now_ms,
            auto_start: opts.auto_start ?? true,
            claim_emit: callbacks.claim_emit,
            raise_emit: callbacks.raise_emit,
            warrant_emit: callbacks.warrant_emit,
            ...opts.runtime,
        });
        installTranslationPolicyRuntimeGlobal(factory, target, opts.hud);
        target.__OMEGA_TRANSLATION_POLICY_TICK__ = opts.tick ?? true;
        target.__OMEGA_TRANSLATION_POLICY_TELEMETRY_EVENT__ =
            opts.telemetry_event ?? false;
        return result("installed", adapter, factory);
    } catch (e) {
        return {
            ...result("install-error", null, null),
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

function result(
    reason: TranslationPolicyBootstrapInstallResult["reason"],
    adapter: TranslationPolicyMeshEmitAdapter | null,
    factory: TranslationPolicyRuntimeFactoryResult | null,
): TranslationPolicyBootstrapInstallResult {
    return {
        schema: TRANSLATION_POLICY_BOOTSTRAP_INSTALLER_SCHEMA,
        installed: reason === "installed",
        reason,
        adapter,
        factory,
    };
}
