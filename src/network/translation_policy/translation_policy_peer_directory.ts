// 🌌 OMEGA-64: Era 1730 — Translation Policy Peer Directory Integration
//
// Era 1720 can broadcast policy claims to a known-peer table. Era 1730
// wires that table to mesh lifecycle/activity events without importing
// WebRTC internals into the scheduler.

import type { EventSource } from "../quarantine_lifecycle_bridge.ts";
import { fnv1a32 } from "../cross_model_debate.ts";
import { TranslationPolicyBroadcastScheduler } from "./translation_policy_broadcast_scheduler.ts";

export const TRANSLATION_POLICY_PEER_DIRECTORY_SCHEMA = "OMEGA-1730/v1";

export interface TranslationPolicyPeerDirectoryOptions {
    joined_event_name: string;
    left_event_name: string;
    activity_event_names: string[];
    derive_peer_id: (raw: unknown) => number | null;
}

export const DEFAULT_TRANSLATION_POLICY_PEER_DIRECTORY_OPTS:
    TranslationPolicyPeerDirectoryOptions = {
        joined_event_name: "meshPeerJoined",
        left_event_name: "meshPeerLeft",
        activity_event_names: [
            "translationPolicyClaim",
            "translationPolicyCorroborationRaise",
        ],
        derive_peer_id: deriveTranslationPolicyPeerId,
    };

export interface TranslationPolicyPeerDirectoryTelemetry {
    joined_received: number;
    left_received: number;
    activity_received: number;
    malformed_events: number;
    peers_added: number;
    peers_removed: number;
    activity_peers_seen: number;
}

export function deriveTranslationPolicyPeerId(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw >>> 0;
    if (typeof raw === "string" && raw.length > 0) {
        return fnv1a32(new TextEncoder().encode(raw));
    }
    return null;
}

export class TranslationPolicyPeerDirectoryAdapter {
    private joinedListener?: (event: { detail: unknown }) => void;
    private leftListener?: (event: { detail: unknown }) => void;
    private activityListeners = new Map<string, (event: { detail: unknown }) => void>();
    private active = false;
    private stats: TranslationPolicyPeerDirectoryTelemetry = {
        joined_received: 0,
        left_received: 0,
        activity_received: 0,
        malformed_events: 0,
        peers_added: 0,
        peers_removed: 0,
        activity_peers_seen: 0,
    };

    constructor(
        public readonly scheduler: TranslationPolicyBroadcastScheduler,
        public readonly source: EventSource,
        public readonly opts: TranslationPolicyPeerDirectoryOptions =
            DEFAULT_TRANSLATION_POLICY_PEER_DIRECTORY_OPTS,
    ) {}

    start(): void {
        if (this.active) return;
        this.joinedListener = (event) => this.handleJoined(event.detail);
        this.leftListener = (event) => this.handleLeft(event.detail);
        this.source.addEventListener(this.opts.joined_event_name, this.joinedListener);
        this.source.addEventListener(this.opts.left_event_name, this.leftListener);
        for (const name of this.opts.activity_event_names) {
            const listener = (event: { detail: unknown }) => this.handleActivity(event.detail);
            this.activityListeners.set(name, listener);
            this.source.addEventListener(name, listener);
        }
        this.active = true;
    }

    stop(): void {
        if (!this.active) return;
        if (this.joinedListener) {
            this.source.removeEventListener(this.opts.joined_event_name, this.joinedListener);
        }
        if (this.leftListener) {
            this.source.removeEventListener(this.opts.left_event_name, this.leftListener);
        }
        for (const [name, listener] of this.activityListeners) {
            this.source.removeEventListener(name, listener);
        }
        this.joinedListener = undefined;
        this.leftListener = undefined;
        this.activityListeners.clear();
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    telemetry(): TranslationPolicyPeerDirectoryTelemetry {
        return { ...this.stats };
    }

    handleJoined(detail: unknown): number | null {
        this.stats.joined_received++;
        const peer = this.extractPeerId(detail);
        if (peer === null) {
            this.stats.malformed_events++;
            return null;
        }
        const before = this.scheduler.peerCount();
        this.scheduler.addPeer(peer);
        if (this.scheduler.peerCount() > before) this.stats.peers_added++;
        return peer;
    }

    handleLeft(detail: unknown): number | null {
        this.stats.left_received++;
        const peer = this.extractPeerId(detail);
        if (peer === null) {
            this.stats.malformed_events++;
            return null;
        }
        if (this.scheduler.removePeer(peer)) this.stats.peers_removed++;
        return peer;
    }

    handleActivity(detail: unknown): number | null {
        this.stats.activity_received++;
        const peer = this.extractActivityPeerId(detail);
        if (peer === null) {
            this.stats.malformed_events++;
            return null;
        }
        const before = this.scheduler.peerCount();
        this.scheduler.addPeer(peer);
        if (this.scheduler.peerCount() > before) this.stats.peers_added++;
        this.stats.activity_peers_seen++;
        return peer;
    }

    private extractPeerId(detail: unknown): number | null {
        if (!detail || typeof detail !== "object") return null;
        const d = detail as { peer_id?: unknown; peerId?: unknown; fromPeer?: unknown };
        return this.opts.derive_peer_id(d.peer_id ?? d.peerId ?? d.fromPeer);
    }

    private extractActivityPeerId(detail: unknown): number | null {
        if (!detail || typeof detail !== "object") return null;
        const d = detail as { fromPeer?: unknown; peer_id?: unknown; peerId?: unknown };
        return this.opts.derive_peer_id(d.fromPeer ?? d.peer_id ?? d.peerId);
    }
}
