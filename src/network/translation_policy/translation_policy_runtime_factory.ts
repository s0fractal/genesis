// OMEGA-64: Era 1770 - Translation Policy Runtime Factory
//
// Era 1740 made the runtime facade; Era 1760 gave bootstrap an
// optional HUD hook. This factory assembles the runtime without making
// bootstrap know the internal component graph.

import { EventSource } from "../quarantine_lifecycle_bridge.ts";
import {
    TranslationPolicyCorroborationPlasmidEmit,
    TranslationPolicyMeshBridge,
    TranslationPolicyPlasmidEmit,
} from "../mesh_event_bridge.ts";
import { SchemaTranslatorRegistry } from "../schema_translator.ts";
import {
    PolicyDriftConfidence,
    PolicyDriftCorroborationOptions,
    TranslationPolicyCorroborationTracker,
} from "./translation_policy_corroboration.ts";
import {
    DEFAULT_TRANSLATION_POLICY_BROADCAST_OPTS,
    TranslationPolicyBroadcastOptions,
    TranslationPolicyBroadcastScheduler,
} from "./translation_policy_broadcast_scheduler.ts";
import {
    TranslationPolicyInvestigationLoop,
    TranslationPolicyWarrantEmit,
} from "./translation_policy_investigation_loop.ts";
import {
    DEFAULT_TRANSLATION_POLICY_LIVE_WIRING_OPTS,
    TranslationPolicyLiveWiringAdapter,
    TranslationPolicyLiveWiringOptions,
} from "./translation_policy_live_wiring_adapter.ts";
import {
    TranslationPolicyMonitor,
    TranslationPolicyMonitorOptions,
} from "./translation_policy_monitor.ts";
import {
    DEFAULT_TRANSLATION_POLICY_PEER_DIRECTORY_OPTS,
    TranslationPolicyPeerDirectoryAdapter,
    TranslationPolicyPeerDirectoryOptions,
} from "./translation_policy_peer_directory.ts";
import {
    TranslationPolicyRuntime,
} from "./translation_policy_runtime.ts";
import {
    DEFAULT_TRANSLATION_POLICY_WARRANT_OPTS,
    TranslationPolicyWarrantBridge,
    TranslationPolicyWarrantOptions,
} from "./translation_policy_warrant_bridge.ts";

export const TRANSLATION_POLICY_RUNTIME_FACTORY_SCHEMA = "OMEGA-1770/v1";

export interface TranslationPolicyRuntimeFactoryOptions {
    local_peer_id: number;
    witness_id: number;
    registry: SchemaTranslatorRegistry;
    event_source: EventSource;
    claim_emit: TranslationPolicyPlasmidEmit;
    warrant_emit: TranslationPolicyWarrantEmit;
    now_ms?: () => number;
    raise_emit?: TranslationPolicyCorroborationPlasmidEmit;
    min_confidence?: PolicyDriftConfidence;
    emit_local_raises?: boolean;
    monitor?: Partial<TranslationPolicyMonitorOptions>;
    broadcast?: TranslationPolicyBroadcastOptions;
    warrant?: TranslationPolicyWarrantOptions;
    corroboration?: Partial<PolicyDriftCorroborationOptions>;
    directory?: Partial<TranslationPolicyPeerDirectoryOptions>;
    live?: Partial<Omit<TranslationPolicyLiveWiringOptions, "now_ms">>;
    auto_start?: boolean;
}

export interface TranslationPolicyRuntimeFactoryResult {
    schema: string;
    runtime: TranslationPolicyRuntime;
    monitor: TranslationPolicyMonitor;
    meshBridge: TranslationPolicyMeshBridge;
    scheduler: TranslationPolicyBroadcastScheduler;
    tracker: TranslationPolicyCorroborationTracker;
    warrantBridge: TranslationPolicyWarrantBridge;
    loop: TranslationPolicyInvestigationLoop;
    live: TranslationPolicyLiveWiringAdapter;
    directory: TranslationPolicyPeerDirectoryAdapter;
}

export interface TranslationPolicyRuntimeGlobalTarget {
    __OMEGA_TRANSLATION_POLICY_RUNTIME__?: TranslationPolicyRuntime;
    __OMEGA_TRANSLATION_POLICY_HUD__?: boolean | Record<string, unknown>;
}

export function createTranslationPolicyRuntime(
    opts: TranslationPolicyRuntimeFactoryOptions,
): TranslationPolicyRuntimeFactoryResult {
    if (!Number.isFinite(opts.local_peer_id)) {
        throw new Error("local_peer_id must be finite");
    }
    if (!Number.isFinite(opts.witness_id)) {
        throw new Error("witness_id must be finite");
    }
    const now = opts.now_ms ?? (() => Date.now());
    const monitor = new TranslationPolicyMonitor(
        opts.local_peer_id >>> 0,
        opts.registry,
        opts.monitor,
    );
    const meshBridge = new TranslationPolicyMeshBridge(monitor, opts.claim_emit);
    const scheduler = new TranslationPolicyBroadcastScheduler(
        meshBridge,
        opts.broadcast ?? DEFAULT_TRANSLATION_POLICY_BROADCAST_OPTS,
    );
    const tracker = new TranslationPolicyCorroborationTracker(opts.corroboration);
    const warrantBridge = new TranslationPolicyWarrantBridge(
        opts.warrant ?? DEFAULT_TRANSLATION_POLICY_WARRANT_OPTS,
    );
    const loop = new TranslationPolicyInvestigationLoop(
        monitor,
        opts.warrant_emit,
        warrantBridge,
        {
            tracker,
            witness_id: opts.witness_id >>> 0,
            min_confidence: opts.min_confidence ?? "double",
        },
    );
    const live = new TranslationPolicyLiveWiringAdapter(
        loop,
        opts.event_source,
        {
            ...DEFAULT_TRANSLATION_POLICY_LIVE_WIRING_OPTS,
            now_ms: now,
            emit_local_raises: opts.emit_local_raises ?? !!opts.raise_emit,
            local_witness_id: opts.witness_id >>> 0,
            raise_emit: opts.raise_emit,
            ...opts.live,
        },
    );
    const directory = new TranslationPolicyPeerDirectoryAdapter(
        scheduler,
        opts.event_source,
        {
            ...DEFAULT_TRANSLATION_POLICY_PEER_DIRECTORY_OPTS,
            ...opts.directory,
            activity_event_names: opts.directory?.activity_event_names ??
                DEFAULT_TRANSLATION_POLICY_PEER_DIRECTORY_OPTS.activity_event_names,
            derive_peer_id: opts.directory?.derive_peer_id ??
                DEFAULT_TRANSLATION_POLICY_PEER_DIRECTORY_OPTS.derive_peer_id,
        },
    );
    const runtime = new TranslationPolicyRuntime(live, directory, scheduler);
    if (opts.auto_start) runtime.start();
    return {
        schema: TRANSLATION_POLICY_RUNTIME_FACTORY_SCHEMA,
        runtime,
        monitor,
        meshBridge,
        scheduler,
        tracker,
        warrantBridge,
        loop,
        live,
        directory,
    };
}

export function installTranslationPolicyRuntimeGlobal(
    result: TranslationPolicyRuntimeFactoryResult,
    target: TranslationPolicyRuntimeGlobalTarget =
        globalThis as TranslationPolicyRuntimeGlobalTarget,
    hud?: boolean | Record<string, unknown>,
): TranslationPolicyRuntime {
    target.__OMEGA_TRANSLATION_POLICY_RUNTIME__ = result.runtime;
    if (hud !== undefined) target.__OMEGA_TRANSLATION_POLICY_HUD__ = hud;
    return result.runtime;
}
