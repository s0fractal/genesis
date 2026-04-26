// 🌌 OMEGA-64: Era 1130 — Federated Spore-to-Spore Routing (JS mirror)
//
// Pure-TS port of `omega_v2::spore_routing`. Used by browser/Deno relays
// (and by simulator harnesses) to predict what a spore in the field
// will decide to do with an incoming frame, without round-tripping
// through the actual hardware.

import { fnv1a32 } from "./cross_model_debate.ts";
import {
    FRAME_TYPE_HEARTBEAT,
    FRAME_TYPE_WARRANT_VOTE,
    SporeFrame,
    computeFrameCrc,
} from "./spore_frame.ts";
import { GENESIS_HASH_V1_0 } from "./genesis_inscription.ts";

export const DEFAULT_TTL = 4;
const TTL_SHIFT = 24;
const TTL_MASK = 0xFF00_0000 >>> 0;

export const FWD_DROP_TTL_ZERO = 0;
export const FWD_DROP_LOOP = 1;
export const FWD_DROP_NOT_FORWARDABLE = 2;
export const FWD_FORWARD = 3;
export const FWD_DELIVER_LOCAL = 4;

/** Mirror of `mix_trail` — FNV-1a over (existing_BE || spore_id_BE). */
export function mixTrail(existing: number, sporeId: number): number {
    const buf = new Uint8Array(8);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, existing >>> 0, false);
    dv.setUint32(4, sporeId >>> 0, false);
    return fnv1a32(buf);
}

export function frameTtl(f: SporeFrame): number {
    return ((f.payloadC & TTL_MASK) >>> TTL_SHIFT) & 0xFF;
}

export function frameTrail(f: SporeFrame): number {
    return f.payloadB >>> 0;
}

/** Stamp a fresh frame with TTL + zero trail, then refresh CRC. */
export function stampOrigin(f: SporeFrame, ttl: number): SporeFrame {
    const out: SporeFrame = { ...f };
    out.payloadB = 0;
    out.payloadC = ((out.payloadC & ~TTL_MASK) >>> 0) | ((ttl & 0xFF) << TTL_SHIFT) >>> 0;
    out.payloadC = out.payloadC >>> 0;
    out.crc32 = computeFrameCrc(out);
    return out;
}

export interface RoutingDecision {
    code: number;
    forwardedFrame: SporeFrame;
}

/** Mirror of `decide_forward`. */
export function decideForward(
    incoming: SporeFrame,
    ourSporeId: number,
    ourGenesis: number = GENESIS_HASH_V1_0,
): RoutingDecision {
    const out: SporeFrame = { ...incoming };

    const ft = incoming.frameType;
    if (ft !== FRAME_TYPE_HEARTBEAT && ft !== FRAME_TYPE_WARRANT_VOTE) {
        return { code: FWD_DROP_NOT_FORWARDABLE, forwardedFrame: out };
    }

    if (ft === FRAME_TYPE_HEARTBEAT && (incoming.proposalOrTarget >>> 0) !== (ourGenesis >>> 0)) {
        return { code: FWD_DROP_NOT_FORWARDABLE, forwardedFrame: out };
    }

    const ttl = frameTtl(incoming);
    if (ttl === 0) {
        return { code: FWD_DROP_TTL_ZERO, forwardedFrame: out };
    }

    const newTrail = mixTrail(incoming.payloadB, ourSporeId);
    if (newTrail === (incoming.payloadB >>> 0)) {
        return { code: FWD_DROP_LOOP, forwardedFrame: out };
    }
    const twiceMixed = mixTrail(newTrail, ourSporeId);
    if (twiceMixed === (incoming.payloadB >>> 0)) {
        return { code: FWD_DROP_LOOP, forwardedFrame: out };
    }

    out.payloadB = newTrail;
    const newTtl = (ttl - 1) & 0xFF;
    out.payloadC = (((out.payloadC & ~TTL_MASK) >>> 0) | (newTtl << TTL_SHIFT)) >>> 0;
    out.crc32 = computeFrameCrc(out);

    const code = ft === FRAME_TYPE_WARRANT_VOTE ? FWD_DELIVER_LOCAL : FWD_FORWARD;
    return { code, forwardedFrame: out };
}
