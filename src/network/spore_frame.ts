// Spore Frame (JS mirror)

// Pure-TS port of `omega_v2::spore_frame`. Used by relay nodes (browser
// or Deno) to encode/decode the 32-byte fixed-width binary frames sent
// over UART/SPI/BLE by bare-metal spores.

// Cross-language anchor lives in `tests/spore_frame_test.ts`.

import { sha256_u32 } from "../sdk/phi_crypto.ts";

export const SPORE_FRAME_BYTES = 32;
export const SPORE_FRAME_MAGIC = 0x4F46;

export const FRAME_TYPE_WARRANT_VOTE = 1;
export const FRAME_TYPE_HALO_STATE = 2;
export const FRAME_TYPE_HEARTBEAT = 3;
export const FRAME_TYPE_QUORUM_QUERY = 4;
export const FRAME_TYPE_SNAPSHOT_DIGEST = 5;
export const FRAME_TYPE_COMPOSITE_HEALTH = 6;
export const FRAME_TYPE_QUORUM_VERDICT = 7;
export const FRAME_TYPE_DELTA_CHUNK = 8;
export const FRAME_TYPE_EVENT_HASH_LIST = 9;
export const FRAME_TYPE_EVENT_DELTA_CHUNK = 10;
export const FRAME_TYPE_EVENT_HASH_REQUEST = 11;
export const FRAME_TYPE_EVENT_HASH_RESPONSE = 12;
export const FRAME_TYPE_V2_SYNC = 13;
export const FRAME_TYPE_BLE_MESH_BROADCAST = 14;
export const FRAME_TYPE_LORA_LONG_RANGE = 15;
export const FRAME_TYPE_ATTRACTOR = 16;
export const FRAME_TYPE_PROPOSAL = 17;
export const FRAME_TYPE_LAW_TELEMETRY = 18;

export interface SporeFrame {
    magic: number;
    frameType: number;
    oracleBit: number;
    proposalOrTarget: number;
    payloadA: number;
    payloadB: number;
    payloadC: number;
    tick: number;
    reserved: number;
    crc32: number;
}

function emptyFrame(): SporeFrame {
    return {
        magic: SPORE_FRAME_MAGIC,
        frameType: 0,
        oracleBit: 0xFF,
        proposalOrTarget: 0,
        payloadA: 0,
        payloadB: 0,
        payloadC: 0,
        tick: 0,
        reserved: 0,
        crc32: 0,
    };
}

function writeU32BE(bytes: Uint8Array, offset: number, value: number) {
    const v = value >>> 0;
    bytes[offset]     = (v >>> 24) & 0xFF;
    bytes[offset + 1] = (v >>> 16) & 0xFF;
    bytes[offset + 2] = (v >>> 8)  & 0xFF;
    bytes[offset + 3] = v          & 0xFF;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
    return (
        ((bytes[offset]     << 24) >>> 0) |
        ((bytes[offset + 1] << 16) >>> 0) |
        ((bytes[offset + 2] << 8 ) >>> 0) |
        ( bytes[offset + 3]              )
    ) >>> 0;
}

/** Serialize the frame to 32 bytes (without filling crc32 — caller does). */
function frameToBytesNoCrc(f: SporeFrame): Uint8Array {
    const out = new Uint8Array(SPORE_FRAME_BYTES);
    out[0] = (f.magic >>> 8) & 0xFF;
    out[1] =  f.magic        & 0xFF;
    out[2] = f.frameType & 0xFF;
    out[3] = f.oracleBit & 0xFF;
    writeU32BE(out, 4,  f.proposalOrTarget);
    writeU32BE(out, 8,  f.payloadA);
    writeU32BE(out, 12, f.payloadB);
    writeU32BE(out, 16, f.payloadC);
    writeU32BE(out, 20, f.tick);
    writeU32BE(out, 24, f.reserved);
    return out;
}

/** Compute CRC over bytes 0..28 of a frame's serialization. */
export function computeFrameCrc(f: SporeFrame): number {
    const bytes = frameToBytesNoCrc(f);
    return sha256_u32(bytes.subarray(0, 28));
}

/** Serialize a frame to bytes, computing the CRC inline. */
export function frameToBytes(f: SporeFrame): Uint8Array {
    const out = frameToBytesNoCrc(f);
    const crc = sha256_u32(out.subarray(0, 28));
    writeU32BE(out, 28, crc);
    return out;
}

/** Parse a 32-byte buffer into a frame, returning `null` on magic/CRC fail. */
export function frameFromBytes(buf: Uint8Array): SporeFrame | null {
    if (buf.length < SPORE_FRAME_BYTES) return null;
    const magic = (buf[0] << 8) | buf[1];
    if (magic !== SPORE_FRAME_MAGIC) return null;
    const f: SporeFrame = {
        magic,
        frameType: buf[2],
        oracleBit: buf[3],
        proposalOrTarget: readU32BE(buf, 4),
        payloadA:         readU32BE(buf, 8),
        payloadB:         readU32BE(buf, 12),
        payloadC:         readU32BE(buf, 16),
        tick:             readU32BE(buf, 20),
        reserved:         readU32BE(buf, 24),
        crc32:            readU32BE(buf, 28),
    };
    const computed = sha256_u32(buf.subarray(0, 28));
    if (computed !== f.crc32) return null;
    return f;
}

/** Build a WARRANT_VOTE frame ready to ship over the wire. */
export function buildWarrantVote(
    proposalHash: number,
    oracleBit: number,
    aye: boolean,
    tick: number,
): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_WARRANT_VOTE;
    f.oracleBit = oracleBit & 0xFF;
    f.proposalOrTarget = proposalHash >>> 0;
    f.payloadA = aye ? 1 : 0;
    f.tick = tick >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build a HEARTBEAT frame. */
export function buildHeartbeat(genesisHash: number, tick: number): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_HEARTBEAT;
    f.proposalOrTarget = genesisHash >>> 0;
    f.tick = tick >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build a SNAPSHOT_DIGEST frame carrying a relay's
 *  headline resilience stats in compact form. */
export function buildSnapshotDigest(
    relayId: number,
    totalIntents: number,
    doubleWitness: number,
    redundancyRateQ16: number,
    tick: number,
): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_SNAPSHOT_DIGEST;
    f.proposalOrTarget = relayId >>> 0;
    f.payloadA = totalIntents >>> 0;
    f.payloadB = doubleWitness >>> 0;
    f.payloadC = redundancyRateQ16 >>> 0;
    f.tick = tick >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build a COMPOSITE_HEALTH frame carrying a relay's
 *  one-glance health composite. Counts clamped to u8 (255 max). */
export function buildCompositeHealth(
    relayId: number,
    compositeScoreQ16: number,
    bandCode: number,
    alarmCount: number,
    suspectCount: number,
    quarantineCount: number,
    redundancyContribQ16: number,
    tick: number,
): SporeFrame {
    const clampU8 = (n: number) => Math.max(0, Math.min(255, n | 0));
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_COMPOSITE_HEALTH;
    f.proposalOrTarget = relayId >>> 0;
    f.payloadA = compositeScoreQ16 >>> 0;
    f.payloadB =
        ((clampU8(bandCode)) |
         (clampU8(alarmCount) << 8) |
         (clampU8(suspectCount) << 16) |
         (clampU8(quarantineCount) << 24)) >>> 0;
    f.payloadC = redundancyContribQ16 >>> 0;
    f.tick = tick >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build a QUORUM_VERDICT frame carrying a forensic adjudication
 *  digest + summary. Q16 fields clamp to u16 for compact transport. */
export function buildQuorumVerdict(
    quorumDigest: number,
    sourceRelayId: number,
    verdictCode: number,
    relayCount: number,
    overlapPct: number,
    replayedQ16: number,
    diffQ16: number,
    windowEndMsLow32: number,
): SporeFrame {
    const clampU8 = (n: number) => Math.max(0, Math.min(255, (n >>> 0)));
    const clampU16 = (n: number) => Math.min(0xFFFF, (n >>> 0));
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_QUORUM_VERDICT;
    f.proposalOrTarget = quorumDigest >>> 0;
    f.payloadA = sourceRelayId >>> 0;
    f.payloadB =
        (clampU8(verdictCode) |
         (clampU8(relayCount) << 8) |
         (clampU8(overlapPct) << 16)) >>> 0;
    f.payloadC = ((clampU16(replayedQ16) << 16) | clampU16(diffQ16)) >>> 0;
    f.tick = windowEndMsLow32 >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Zero-Copy Binary RPC. Packs v2-sync state into a SporeFrame. */
export function buildV2SyncFrame(
    x: number, y: number, m: number, r: number, g: number, o: number,
    ta: number, ta_ortho: number, gt: number, gt_ortho: number, hc: number, mh: number
): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_V2_SYNC;

    // pack x and y into oracleBit and highest byte of payloadA
    f.oracleBit = x & 0xFF;
    const y_clamped = y & 0xFF;
    const r_clamped = r & 0xFF;

    // payloadA: [y:8 | r:8 | m:16 (energy/magnitude)]
    f.payloadA = ((y_clamped << 24) | (r_clamped << 16) | (m & 0xFFFF)) >>> 0;

    // payloadB: g (genome/matrix)
    f.payloadB = g >>> 0;

    // payloadC: o (op/inverse)
    f.payloadC = o >>> 0;

    // proposalOrTarget: ta (target address)
    f.proposalOrTarget = ta >>> 0;

    // tick: gt (golden trace)
    f.tick = gt >>> 0;

    // reserved: [hc:8 | mh:8 | ta_ortho:8 | gt_ortho:8]
    f.reserved = (((hc & 0xFF) << 24) | ((mh & 0xFF) << 16) | ((ta_ortho & 0xFF) << 8) | (gt_ortho & 0xFF)) >>> 0;

    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build an ATTRACTOR frame  */
export function buildAttractor(
    matrix: number,
    inverse: number,
    pulseFreq: number,
    pulseAmp: number,
    recursionDepth: number
): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_ATTRACTOR;
    f.oracleBit = recursionDepth & 0xFF;
    f.proposalOrTarget = matrix >>> 0;
    f.payloadA = inverse >>> 0;
    f.payloadB = pulseFreq >>> 0;
    f.payloadC = pulseAmp >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build a PROPOSAL frame  */
export function buildProposal(
    matrix: number,
    inverse: number,
    pulseFreq: number,
    pulseAmp: number,
    recursionDepth: number
): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_PROPOSAL;
    f.oracleBit = recursionDepth & 0xFF;
    f.proposalOrTarget = matrix >>> 0;
    f.payloadA = inverse >>> 0;
    f.payloadB = pulseFreq >>> 0;
    f.payloadC = pulseAmp >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Build a LAW_TELEMETRY frame broadcasting the results of a physical tick. */
export function buildLawTelemetry(
    witnessKind: number,
    lawHash: number,
    preStateHash: number,
    postStateHash: number,
    entropyDelta: number,
    tick: number,
): SporeFrame {
    const f = emptyFrame();
    f.frameType = FRAME_TYPE_LAW_TELEMETRY;
    f.oracleBit = witnessKind & 0xFF;
    f.proposalOrTarget = lawHash >>> 0;
    f.payloadA = preStateHash >>> 0;
    f.payloadB = postStateHash >>> 0;
    f.payloadC = entropyDelta >>> 0;
    f.tick = tick >>> 0;
    f.crc32 = computeFrameCrc(f);
    return f;
}

/** Decodes a V2_SYNC frame back into an object */
export function parseV2SyncFrame(f: SporeFrame) {
    if (f.frameType !== FRAME_TYPE_V2_SYNC) return null;
    return {
        x: f.oracleBit,
        y: (f.payloadA >>> 24) & 0xFF,
        r: (f.payloadA >>> 16) & 0xFF,
        m: f.payloadA & 0xFFFF,
        g: f.payloadB,
        o: f.payloadC,
        ta: f.proposalOrTarget,
        ta_ortho: (f.reserved >>> 8) & 0xFF,
        gt: f.tick,
        gt_ortho: f.reserved & 0xFF,
        hc: (f.reserved >>> 24) & 0xFF,
        mh: (f.reserved >>> 16) & 0xFF,
    };
}

/** Find the magic bytes 0x4F 0x46 in a streaming buffer. */
export function findSync(buf: Uint8Array): number | null {
    if (buf.length < 2) return null;
    for (let i = 0; i + 1 < buf.length; i++) {
        if (buf[i] === 0x4F && buf[i + 1] === 0x46) return i;
    }
    return null;
}
