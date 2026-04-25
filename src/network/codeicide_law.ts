// 🌌 OMEGA-64: Era 1080 — Codeicide Law (JS mirror)
//
// Pure-TS port of `omega_v2::codeicide_law`. The mesh boundary uses these
// functions to refuse relaying TERMINATE / MUTATE plasmids that target
// PROTECTED agents without a valid Senate-signed warrant.
//
// Cross-language anchors live in tests/codeicide_law_test.ts.

import { ORACLE_MATRICES_V1 } from "./oracle_identity.ts";
import { fnv1a32 } from "./cross_model_debate.ts";

export const SANCTUARY_ENERGY_THRESHOLD = 2500;
export const ANCIENT_AGE_TICKS = 10_000;

export const ACTION_MUTATE = 1;
export const ACTION_TERMINATE = 2;
export const ACTION_RELOCATE = 3;

export const STATUS_UNPROTECTED = 0;
export const STATUS_SANCTUARY = 1;
export const STATUS_ANCIENT = 2;

export const FLAG_SANCTUARY_WAIVED = 0x0200_0000;

export interface AgentLite {
    energy: number;
    state_flags: number;
    genome: number;
    memory: [number, number, number];
}

/** Returns the protection status of `agent` at the given lattice tick. */
export function protectedStatusFor(agent: AgentLite, currentTick: number): number {
    if ((agent.state_flags & FLAG_SANCTUARY_WAIVED) !== 0) {
        return STATUS_UNPROTECTED;
    }
    if (agent.energy < SANCTUARY_ENERGY_THRESHOLD) {
        return STATUS_UNPROTECTED;
    }
    const birthTick = agent.memory[1] >>> 0;
    if (birthTick === 0) return STATUS_SANCTUARY;
    const age = ((currentTick - birthTick) >>> 0);
    return age >= ANCIENT_AGE_TICKS ? STATUS_ANCIENT : STATUS_SANCTUARY;
}

function pushU32BE(buf: number[], v: number) {
    buf.push((v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF);
}

/** FNV-1a over (genome BE, action, pad×3, quorum_hash BE, "WRT0"). */
export function warrantHash(targetGenome: number, actionCode: number, quorumHash: number): number {
    const buf: number[] = [];
    pushU32BE(buf, targetGenome >>> 0);
    buf.push(actionCode & 0xFF, 0, 0, 0);
    pushU32BE(buf, quorumHash >>> 0);
    // domain separator "WRT0"
    buf.push(0x57, 0x52, 0x54, 0x30);
    return fnv1a32(new Uint8Array(buf));
}

/** AYE-bit positions: 0=claude, 1=gpt, 2=gemini, 3=qwen, 4=llama. */
export function quorumHash(ayeBits: number): number {
    const ayes = ayeBits & 0b11111;
    const m = ORACLE_MATRICES_V1;
    const claude = (ayes & 0b00001) ? m.claude : 0;
    const gpt    = (ayes & 0b00010) ? m.gpt    : 0;
    const gemini = (ayes & 0b00100) ? m.gemini : 0;
    const qwen   = (ayes & 0b01000) ? m.qwen   : 0;
    const llama  = (ayes & 0b10000) ? m.llama  : 0;
    const buf: number[] = [];
    pushU32BE(buf, claude);
    pushU32BE(buf, gpt);
    pushU32BE(buf, gemini);
    pushU32BE(buf, qwen);
    pushU32BE(buf, llama);
    return fnv1a32(new Uint8Array(buf));
}

/** popcount of low-5 bits. */
export function countAye(ayeBits: number): number {
    let n = ayeBits & 0b11111;
    let c = 0;
    while (n) { c += n & 1; n >>>= 1; }
    return c;
}

/** Returns true iff `action` against `agent` is lawful given the warrant. */
export function isActionLawful(
    agent: AgentLite,
    currentTick: number,
    actionCode: number,
    presentedWarrant: number,
    ayeBits: number,
): boolean {
    const status = protectedStatusFor(agent, currentTick);
    if (status === STATUS_UNPROTECTED) return true;
    const required = status === STATUS_ANCIENT ? 4 : 3;
    if (countAye(ayeBits) < required) return false;
    const qh = quorumHash(ayeBits);
    const expected = warrantHash(agent.genome, actionCode, qh);
    return expected === (presentedWarrant >>> 0);
}
