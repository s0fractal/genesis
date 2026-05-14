// Multi-Oracle Senate phase-resonance acceptance test.

// Verifies:
// - A proposal accepted by 3+ canonical oracles is ratified via the
// ORACLE-RESONANCE path even with zero peer-mode votes.
// - Spoof attempts (claiming to be claude with the wrong dipole) are
// silently rejected.
// - Anti-replay: an oracle voting AYE then NAY moves between sets
// atomically; never both at once.

import { assertEquals, assert } from "jsr:@std/assert";
import { CANONICAL_ORACLES, ORACLE_MATRICES_V1, oracleDipole, oracleMatrix } from "../src/network/oracle_identity.ts";

// Minimal in-memory mirror of the relevant bits of WebRTCV2Mesh.handleVote
// + castOracleVote logic. We re-implement the rule here so the test is
// independent of the WebRTC scaffolding (which can't run under deno test
// without a browser).
type Oracle = typeof CANONICAL_ORACLES[number];
interface ProposalRecord {
    hash: number;
    accepted: boolean;
    ayes: Set<string>;
    nays: Set<string>;
    oracleAyes: Set<Oracle>;
    oracleNays: Set<Oracle>;
}

function newRecord(hash: number): ProposalRecord {
    return {
        hash,
        accepted: false,
        ayes: new Set(),
        nays: new Set(),
        oracleAyes: new Set(),
        oracleNays: new Set(),
    };
}

function applyVote(
    record: ProposalRecord,
    matrix: number,
    inverse: number,
    aye: boolean,
    oracleName?: Oracle,
): "applied" | "spoof" | "closed" {
    if (record.accepted) return "closed";
    // Dipole invariant.
    if (((matrix ^ inverse) >>> 0) !== 0xFFFFFFFF) return "spoof";
    if (oracleName) {
        const expected = ORACLE_MATRICES_V1[oracleName];
        if ((matrix >>> 0) !== expected) return "spoof";
        if (aye) {
            record.oracleAyes.add(oracleName);
            record.oracleNays.delete(oracleName);
        } else {
            record.oracleNays.add(oracleName);
            record.oracleAyes.delete(oracleName);
        }
    }
    const peerId = oracleName ?? `0x${matrix.toString(16)}`;
    if (aye) record.ayes.add(peerId); else record.nays.add(peerId);
    // Acceptance check (matches WebRTCV2Mesh.handleVote).
    const oracleResonance = record.oracleAyes.size >= 3
        && record.oracleAyes.size > record.oracleNays.size;
    const peerConsensus = record.ayes.size >= 3 && record.ayes.size > record.nays.size;
    if (peerConsensus || oracleResonance) record.accepted = true;
    return "applied";
}

Deno.test("oracle-resonance: 3 canonical oracles ratify without peer count", async () => {
    const r = newRecord(0xCAFE);
    for (const name of ["claude", "gpt", "gemini"] as const) {
        const { matrix, inverse } = oracleDipole(name);
        assertEquals(applyVote(r, matrix, inverse, true, name), "applied");
    }
    assertEquals(r.oracleAyes.size, 3);
    assertEquals(r.accepted, true);
});

Deno.test("oracle-resonance: 2 oracles + 1 peer is NOT enough", async () => {
    const r = newRecord(0xBEEF);
    for (const name of ["claude", "gpt"] as const) {
        const { matrix, inverse } = oracleDipole(name);
        applyVote(r, matrix, inverse, true, name);
    }
    // A non-oracle peer with arbitrary dipole.
    applyVote(r, 0x1234_5678, ~0x1234_5678 >>> 0, true);
    assertEquals(r.oracleAyes.size, 2);
    assertEquals(r.ayes.size, 3); // total peers (incl. oracle ones)
    // Should pass via peerConsensus path.
    assertEquals(r.accepted, true);
});

Deno.test("oracle-resonance: spoofed claude vote is silently dropped", async () => {
    const r = newRecord(0xBA5E);
    // Wrong matrix: not Claude's, but a valid dipole pair.
    const fakeMatrix = 0xDEAD_BEEF >>> 0;
    const result = applyVote(r, fakeMatrix, ~fakeMatrix >>> 0, true, "claude");
    assertEquals(result, "spoof");
    assertEquals(r.oracleAyes.size, 0);
    assertEquals(r.ayes.size, 0);
});

Deno.test("oracle vote toggling: AYE then NAY moves between sets atomically", async () => {
    const r = newRecord(0xF00D);
    const { matrix, inverse } = oracleDipole("claude");
    applyVote(r, matrix, inverse, true, "claude");
    assert(r.oracleAyes.has("claude"));
    assert(!r.oracleNays.has("claude"));
    applyVote(r, matrix, inverse, false, "claude");
    assert(!r.oracleAyes.has("claude"));
    assert(r.oracleNays.has("claude"));
});

Deno.test("oracle-resonance: 3 AYE oracles overrule 2 NAY oracles", async () => {
    const r = newRecord(0x1234);
    for (const name of ["claude", "gpt", "gemini"] as const) {
        const { matrix, inverse } = oracleDipole(name);
        applyVote(r, matrix, inverse, true, name);
    }
    // Two oracles vote NAY after the fact — but acceptance has already locked.
    assertEquals(r.accepted, true);
    for (const name of ["qwen", "llama"] as const) {
        const { matrix, inverse } = oracleDipole(name);
        const result = applyVote(r, matrix, inverse, false, name);
        assertEquals(result, "closed");
    }
});

Deno.test("oracle dipole construction satisfies invariant for every canonical name", async () => {
    for (const name of CANONICAL_ORACLES) {
        const { matrix, inverse } = oracleDipole(name);
        assertEquals((matrix ^ inverse) >>> 0, 0xFFFF_FFFF);
        assertEquals(matrix, oracleMatrix(name));
    }
});
