// 🌌 OMEGA-64: Era 1510 — Mesh Event Bridge Adapter
//
// Era 1500's `WebRTCEventBridge` is transport-agnostic. Era 1510
// adapts it onto the existing `WebRTCV2Mesh`'s plasmid pipeline so
// browser peers can run forensic-event convergence on the same
// mesh that already carries warrants, votes, and resilience data.
//
// PROTOCOL: a `EVENT_SYNC` plasmid's `eventSyncBody` carries a
// JSON-serialized `BridgeMessage`. `eventSyncTarget` names the
// recipient peer_id. Receivers in the V2_SYNC handler decode and
// route to their local bridge.
//
// The adapter is a thin shim that:
//   • Implements `BridgeTransport` over a caller-supplied
//     plasmid-emit callback.
//   • Provides a static `decodeMeshPayload` helper for receivers
//     to pull the inner BridgeMessage out of an EVENT_SYNC plasmid.
//
// Avoids importing WebRTCV2Mesh directly so this module remains
// testable without WebRTC stubs.

import {
    BridgeMessage,
    BridgeTransport,
} from "./webrtc_event_bridge.ts";

export const MESH_BRIDGE_SCHEMA = "OMEGA-1510/v1";

/** Caller-supplied emit function. Mesh integration wires this to
 *  `WebRTCV2Mesh.enqueuePlasmid` or `channel.send` for unicast. */
export type MeshPlasmidEmit = (
    target_peer_id: number,
    body_json: string,
) => boolean;

/** Adapter: turns a per-peer emit callback into a `BridgeTransport`
 *  the Era 1500 bridge can consume. */
export class MeshBridgeTransport implements BridgeTransport {
    public sent_count = 0;
    public last_target?: number;
    public last_body?: string;

    constructor(public readonly emit: MeshPlasmidEmit) {}

    send(peer_id: number, msg: BridgeMessage): boolean {
        const body = JSON.stringify(msg);
        const ok = this.emit(peer_id >>> 0, body);
        if (ok) {
            this.sent_count++;
            this.last_target = peer_id >>> 0;
            this.last_body = body;
        }
        return ok;
    }
}

/** Inverse of `MeshBridgeTransport.send`. Receiver-side helper:
 *  given a plasmid's `eventSyncBody`, decode the BridgeMessage.
 *  Returns `null` on JSON parse failure or schema-shape mismatch. */
export function decodeMeshPayload(body_json: string): BridgeMessage | null {
    try {
        const parsed = JSON.parse(body_json);
        if (!parsed || typeof parsed !== "object" || typeof parsed.kind !== "string") {
            return null;
        }
        // Light shape check — full schema validation happens in
        // the bridge's handleIncoming.
        if (
            parsed.kind === "PEER_HELLO" ||
            parsed.kind === "HASH_LIST" ||
            parsed.kind === "DELTA"
        ) {
            return parsed as BridgeMessage;
        }
        return null;
    } catch {
        return null;
    }
}

/** Build the plasmid extension fields for an EVENT_SYNC payload.
 *  Returns the partial PlasmidPayload that callers merge into a
 *  full plasmid template before enqueuing. */
export function eventSyncPlasmidFields(
    target_peer_id: number,
    msg: BridgeMessage,
): { eventSyncTarget: number; eventSyncBody: string } {
    return {
        eventSyncTarget: target_peer_id >>> 0,
        eventSyncBody: JSON.stringify(msg),
    };
}
