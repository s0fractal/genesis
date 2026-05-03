// 🌌 OMEGA-64: Era 1510 — Mesh Event Bridge Adapter
// 📡 Era 1660 — Translation Policy Wire Bridge
// 🛰️ Era 1700 — Translation Policy Corroboration Wire Sync
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

import { BridgeMessage, BridgeTransport } from "./webrtc_event_bridge.ts";
import {
  TranslationPolicyClaim,
  TranslationPolicyMonitor,
  TranslationPolicyObservation,
} from "./translation_policy_monitor.ts";
import {
  PolicyDriftCorroboratedRecord,
  TranslationPolicyCorroborationRaise,
  TranslationPolicyCorroborationTracker,
} from "./translation_policy_corroboration.ts";
import {
  decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
  TranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
} from "./translation_policy_replay_digest_digest_forensic_replay_digest_claim.ts";

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
    if (
      !parsed || typeof parsed !== "object" || typeof parsed.kind !== "string"
    ) {
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

/** Caller-supplied emit function for translation-policy claims. */
export type TranslationPolicyPlasmidEmit = (
  target_peer_id: number,
  body_json: string,
) => boolean;

/** Wire shim for Era 1650 policy claims. */
export class TranslationPolicyMeshBridge {
  public sent_count = 0;
  public last_target?: number;
  public last_body?: string;

  constructor(
    public readonly monitor: TranslationPolicyMonitor,
    public readonly emit: TranslationPolicyPlasmidEmit,
  ) {}

  sendClaim(target_peer_id: number, claim: TranslationPolicyClaim): boolean {
    const body = JSON.stringify(claim);
    const ok = this.emit(target_peer_id >>> 0, body);
    if (ok) {
      this.sent_count++;
      this.last_target = target_peer_id >>> 0;
      this.last_body = body;
    }
    return ok;
  }

  broadcastLocalClaim(target_peer_id: number, now_ms: number): boolean {
    return this.sendClaim(target_peer_id, this.monitor.localClaim(now_ms));
  }

  handleIncoming(
    body_json: string,
    now_ms: number,
  ): TranslationPolicyObservation | null {
    const claim = decodeTranslationPolicyMeshPayload(body_json);
    if (!claim) return null;
    return this.monitor.observeClaim(claim, now_ms);
  }
}

/** Decode a translation-policy claim carried by a mesh plasmid.
 *  Returns null on malformed JSON or missing scalar fields. */
export function decodeTranslationPolicyMeshPayload(
  body_json: string,
): TranslationPolicyClaim | null {
  try {
    const parsed = JSON.parse(body_json);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.schema !== "string") return null;
    if (typeof parsed.peer_id !== "number") return null;
    if (typeof parsed.policy_hash !== "number") return null;
    if (typeof parsed.pair_count !== "number") return null;
    if (typeof parsed.claimed_at_ms !== "number") return null;
    if (!Array.isArray(parsed.pairs)) return null;
    for (const p of parsed.pairs) {
      if (!p || typeof p !== "object") return null;
      if (typeof p.source !== "string" || typeof p.target !== "string") {
        return null;
      }
    }
    return parsed as TranslationPolicyClaim;
  } catch {
    return null;
  }
}

/** Build plasmid extension fields for a TRANSLATION_POLICY payload. */
export function translationPolicyPlasmidFields(
  target_peer_id: number,
  claim: TranslationPolicyClaim,
): { translationPolicyTarget: number; translationPolicyBody: string } {
  return {
    translationPolicyTarget: target_peer_id >>> 0,
    translationPolicyBody: JSON.stringify(claim),
  };
}

/** Caller-supplied emit function for translation-policy
 *  corroboration raises. */
export type TranslationPolicyCorroborationPlasmidEmit = (
  target_peer_id: number,
  body_json: string,
) => boolean;

/** Wire shim for Era 1700 corroboration raises. */
export class TranslationPolicyCorroborationMeshBridge {
  public sent_count = 0;
  public last_target?: number;
  public last_body?: string;

  constructor(
    public readonly tracker: TranslationPolicyCorroborationTracker,
    public readonly emit: TranslationPolicyCorroborationPlasmidEmit,
  ) {}

  sendRaise(
    target_peer_id: number,
    raise: TranslationPolicyCorroborationRaise,
  ): boolean {
    const body = JSON.stringify(raise);
    const ok = this.emit(target_peer_id >>> 0, body);
    if (ok) {
      this.sent_count++;
      this.last_target = target_peer_id >>> 0;
      this.last_body = body;
    }
    return ok;
  }

  handleIncoming(
    body_json: string,
    now_ms: number,
  ): PolicyDriftCorroboratedRecord | null {
    const raise = decodeTranslationPolicyCorroborationMeshPayload(body_json);
    if (!raise) return null;
    return this.tracker.recordRaise(raise, now_ms);
  }
}

/** Decode a translation-policy corroboration raise carried by a
 *  mesh plasmid. Returns null on malformed JSON or missing fields. */
export function decodeTranslationPolicyCorroborationMeshPayload(
  body_json: string,
): TranslationPolicyCorroborationRaise | null {
  try {
    const parsed = JSON.parse(body_json);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.schema !== "string") return null;
    if (typeof parsed.drift_hash !== "number") return null;
    if (typeof parsed.witness_id !== "number") return null;
    if (typeof parsed.peer_id !== "number") return null;
    if (typeof parsed.local_policy_hash !== "number") return null;
    if (typeof parsed.peer_policy_hash !== "number") return null;
    if (typeof parsed.local_pair_count !== "number") return null;
    if (typeof parsed.peer_pair_count !== "number") return null;
    if (typeof parsed.raised_at_ms !== "number") return null;
    return parsed as TranslationPolicyCorroborationRaise;
  } catch {
    return null;
  }
}

/** Build plasmid extension fields for a
 *  TRANSLATION_POLICY_CORROBORATION payload. */
export function translationPolicyCorroborationPlasmidFields(
  target_peer_id: number,
  raise: TranslationPolicyCorroborationRaise,
): {
  translationPolicyCorroborationTarget: number;
  translationPolicyCorroborationBody: string;
} {
  return {
    translationPolicyCorroborationTarget: target_peer_id >>> 0,
    translationPolicyCorroborationBody: JSON.stringify(raise),
  };
}

/** Caller-supplied emit function for Era 2030 tpdd replay digest claims. */
export type TranslationPolicyReplayDigestDigestForensicReplayDigestPlasmidEmit =
  (
    target_peer_id: number,
    body_json: string,
  ) => boolean;

/** Wire shim for Era 2030 claims over the Era 2040 passive mesh surface. */
export class TranslationPolicyReplayDigestDigestForensicReplayDigestMeshBridge {
  public sent_count = 0;
  public last_target?: number;
  public last_body?: string;

  constructor(
    public readonly emit:
      TranslationPolicyReplayDigestDigestForensicReplayDigestPlasmidEmit,
  ) {}

  sendClaim(
    target_peer_id: number,
    claim: TranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
  ): boolean {
    const body = JSON.stringify(claim);
    const ok = this.emit(target_peer_id >>> 0, body);
    if (ok) {
      this.sent_count++;
      this.last_target = target_peer_id >>> 0;
      this.last_body = body;
    }
    return ok;
  }

  handleIncoming(
    body_json: string,
  ): TranslationPolicyReplayDigestDigestForensicReplayDigestClaim | null {
    return decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      body_json,
    );
  }
}

/** Decode an Era 2030 tpdd replay digest claim carried by a mesh plasmid. */
export function decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
  body_json: string,
): TranslationPolicyReplayDigestDigestForensicReplayDigestClaim | null {
  return decodeTranslationPolicyReplayDigestDigestForensicReplayDigestClaim(
    body_json,
  );
}

/** Build plasmid extension fields for the Era 2040 passive dispatch surface. */
export function translationPolicyReplayDigestDigestForensicReplayDigestPlasmidFields(
  target_peer_id: number,
  claim: TranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
): {
  translationPolicyReplayDigestDigestForensicReplayDigestTarget: number;
  translationPolicyReplayDigestDigestForensicReplayDigestBody: string;
} {
  return {
    translationPolicyReplayDigestDigestForensicReplayDigestTarget:
      target_peer_id >>> 0,
    translationPolicyReplayDigestDigestForensicReplayDigestBody: JSON.stringify(
      claim,
    ),
  };
}
