// 🌌 OMEGA-64: Era 1570 — Quarantine Lifecycle Bridge
//
// Era 1560 added `excludePeer`/`includePeer` to
// `AutoInvestigationLoop` but left the wiring to the caller:
// "when quarantine engages, call excludePeer". Era 1570 closes
// that gap by listening to quarantine lifecycle events and
// flipping exclusion automatically.
//
// EVENT SOURCE: in production, the senate / `auto_investigation`
// pipeline dispatches `CustomEvent`s on `globalThis`. Tests need
// to be hermetic and shouldn't pollute the global scope, so the
// bridge is parameterized over an `EventSource` interface — a
// minimal `addEventListener` / `removeEventListener` shim. A
// `LocalEventSource` implementation lets tests run without
// globalThis.
//
// EVENT NAMES (configurable, defaults match existing convention):
//   • `quarantine-engaged`  — payload: { peer_id: number }
//   • `quarantine-resolved` — payload: { peer_id: number }
//
// IDEMPOTENT: re-engagement events for an already-excluded peer
// are no-ops; resolution events for a non-excluded peer are
// no-ops. Bridge tracks no internal state about which peers
// are excluded — it just dispatches to the loop, which is
// already idempotent.

import type { AutoInvestigationLoop } from "./auto_investigation_loop.ts";

export const LIFECYCLE_BRIDGE_SCHEMA = "OMEGA-1570/v1";

/** Minimal event-source contract. Production code passes
 *  `globalThis`; tests use `LocalEventSource`. */
export interface EventSource {
    addEventListener(
        type: string,
        listener: (event: { detail: unknown }) => void,
    ): void;
    removeEventListener(
        type: string,
        listener: (event: { detail: unknown }) => void,
    ): void;
}

/** Hermetic event source for tests — implements addEventListener
 *  / removeEventListener over a Map of listener arrays. */
export class LocalEventSource implements EventSource {
    private listeners = new Map<string, Array<(event: { detail: unknown }) => void>>();

    addEventListener(type: string, listener: (event: { detail: unknown }) => void): void {
        const arr = this.listeners.get(type) ?? [];
        arr.push(listener);
        this.listeners.set(type, arr);
    }

    removeEventListener(type: string, listener: (event: { detail: unknown }) => void): void {
        const arr = this.listeners.get(type);
        if (!arr) return;
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
    }

    /** Test helper: dispatch an event. */
    dispatch(type: string, detail: unknown): void {
        const arr = this.listeners.get(type) ?? [];
        for (const fn of arr) fn({ detail });
    }
}

export interface LifecycleBridgeOptions {
    /** Event name for quarantine engagement. Default
     *  "quarantine-engaged". */
    engaged_event_name: string;
    /** Event name for quarantine resolution. Default
     *  "quarantine-resolved". */
    resolved_event_name: string;
}

export const DEFAULT_LIFECYCLE_OPTS: LifecycleBridgeOptions = {
    engaged_event_name: "quarantine-engaged",
    resolved_event_name: "quarantine-resolved",
};

export interface LifecycleBridgeStats {
    engaged_received: number;
    resolved_received: number;
    malformed_payloads: number;
    excluded_peers: number;
    included_peers: number;
}

export class QuarantineLifecycleBridge {
    private engagedListener?: (event: { detail: unknown }) => void;
    private resolvedListener?: (event: { detail: unknown }) => void;
    private active = false;
    private stats: LifecycleBridgeStats = {
        engaged_received: 0,
        resolved_received: 0,
        malformed_payloads: 0,
        excluded_peers: 0,
        included_peers: 0,
    };

    constructor(
        public readonly loop: AutoInvestigationLoop,
        public readonly source: EventSource,
        public readonly opts: LifecycleBridgeOptions = DEFAULT_LIFECYCLE_OPTS,
    ) {}

    /** Subscribe to lifecycle events. Idempotent — calling
     *  twice without `stop` between them is a no-op for the
     *  second call. */
    start(): void {
        if (this.active) return;
        this.engagedListener = (event) => {
            this.stats.engaged_received++;
            const peer_id = this.extractPeerId(event.detail);
            if (peer_id === null) {
                this.stats.malformed_payloads++;
                return;
            }
            this.loop.excludePeer(peer_id);
            this.stats.excluded_peers++;
        };
        this.resolvedListener = (event) => {
            this.stats.resolved_received++;
            const peer_id = this.extractPeerId(event.detail);
            if (peer_id === null) {
                this.stats.malformed_payloads++;
                return;
            }
            this.loop.includePeer(peer_id);
            this.stats.included_peers++;
        };
        this.source.addEventListener(this.opts.engaged_event_name, this.engagedListener);
        this.source.addEventListener(this.opts.resolved_event_name, this.resolvedListener);
        this.active = true;
    }

    /** Unsubscribe. After `stop`, `start` may be called again. */
    stop(): void {
        if (!this.active) return;
        if (this.engagedListener) {
            this.source.removeEventListener(this.opts.engaged_event_name, this.engagedListener);
        }
        if (this.resolvedListener) {
            this.source.removeEventListener(this.opts.resolved_event_name, this.resolvedListener);
        }
        this.engagedListener = undefined;
        this.resolvedListener = undefined;
        this.active = false;
    }

    isActive(): boolean { return this.active; }

    telemetry(): LifecycleBridgeStats { return { ...this.stats }; }

    private extractPeerId(detail: unknown): number | null {
        if (!detail || typeof detail !== "object") return null;
        const peer_id = (detail as { peer_id?: unknown }).peer_id;
        if (typeof peer_id !== "number" || !Number.isFinite(peer_id)) return null;
        return peer_id >>> 0;
    }
}
