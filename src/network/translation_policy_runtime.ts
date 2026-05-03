// 🌌 OMEGA-64: Era 1740 — Translation Policy Runtime Orchestrator
//
// Eras 1710, 1720, and 1730 are intentionally separate pieces:
// inbound live wiring, outbound broadcast scheduling, and peer
// directory integration. Era 1740 provides the small facade a caller
// can own at runtime.

import {
    TranslationPolicyBroadcastResult,
    TranslationPolicyBroadcastScheduler,
} from "./translation_policy_broadcast_scheduler.ts";
import {
    TranslationPolicyLiveWiringAdapter,
    TranslationPolicyLiveWiringTelemetry,
} from "./translation_policy_live_wiring_adapter.ts";
import {
    TranslationPolicyPeerDirectoryAdapter,
    TranslationPolicyPeerDirectoryTelemetry,
} from "./translation_policy_peer_directory.ts";

export const TRANSLATION_POLICY_RUNTIME_SCHEMA = "OMEGA-1740/v1";

export interface TranslationPolicyRuntimeTelemetry {
    schema: string;
    active: boolean;
    live_active: boolean;
    directory_active: boolean;
    peer_count: number;
    due_peer_count: number;
    live: TranslationPolicyLiveWiringTelemetry;
    directory: TranslationPolicyPeerDirectoryTelemetry;
    loop: ReturnType<TranslationPolicyLiveWiringAdapter["loop"]["summary"]>;
}

export interface TranslationPolicyRuntimeTickResult {
    schema: string;
    now_ms: number;
    broadcast: TranslationPolicyBroadcastResult;
    telemetry: TranslationPolicyRuntimeTelemetry;
}

export class TranslationPolicyRuntime {
    private active = false;

    constructor(
        public readonly live: TranslationPolicyLiveWiringAdapter,
        public readonly directory: TranslationPolicyPeerDirectoryAdapter,
        public readonly scheduler: TranslationPolicyBroadcastScheduler,
    ) {}

    start(): void {
        if (this.active) return;
        this.live.start();
        this.directory.start();
        this.active = true;
    }

    stop(): void {
        if (!this.active) return;
        this.directory.stop();
        this.live.stop();
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    tick(
        now_ms: number,
        max_peers: number = Number.MAX_SAFE_INTEGER,
    ): TranslationPolicyRuntimeTickResult {
        const broadcast = this.scheduler.tick(now_ms, max_peers);
        return {
            schema: TRANSLATION_POLICY_RUNTIME_SCHEMA,
            now_ms,
            broadcast,
            telemetry: this.telemetry(now_ms),
        };
    }

    telemetry(now_ms: number): TranslationPolicyRuntimeTelemetry {
        return {
            schema: TRANSLATION_POLICY_RUNTIME_SCHEMA,
            active: this.active,
            live_active: this.live.isActive(),
            directory_active: this.directory.isActive(),
            peer_count: this.scheduler.peerCount(),
            due_peer_count: this.scheduler.duePeers(now_ms).length,
            live: this.live.telemetry(),
            directory: this.directory.telemetry(),
            loop: this.live.loop.summary(now_ms),
        };
    }
}
