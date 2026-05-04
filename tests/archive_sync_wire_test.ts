// Era 1320: Archive sync over SporeFrame wire — chunking + reassembly tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    DELTA_CHUNK_SCHEMA,
    chunkDelta,
    reassembleDelta,
} from "../src/network/archive_sync_wire.ts";
import {
    buildDigestList,
    computeDelta,
    applyDelta,
    SYNC_SCHEMA_VERSION,
} from "../src/network/archive_sync.ts";
import {
    ARCHIVE_SCHEMA_VERSION,
    ArchivedVerdict,
    exportArchive,
} from "../src/network/verdict_archive.ts";
import { QuorumAgreementTracker } from "../src/network/quorum_broadcast.ts";
import { buildQuorumVerdict, FRAME_TYPE_DELTA_CHUNK, frameToBytes, frameFromBytes } from "../src/network/spore_frame.ts";

const NOW = 100_000;
const SENDER = 0xCC02;

function archiveWith(digests: ReadonlyArray<number>): ArchivedVerdict[] {
    const t = new QuorumAgreementTracker();
    for (const d of digests) {
        for (const broadcaster of [0xCC01, 0xCC02, 0xCC03]) {
            const f = buildQuorumVerdict(d, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
            t.observe(f, broadcaster, NOW);
        }
    }
    return exportArchive(t, { now_ms: NOW }).records;
}

function deltaFor(a_records: ArchivedVerdict[], b_records: ArchivedVerdict[]) {
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a_records.length,
        min_digest_hex: "", max_digest_hex: "", records: a_records,
    }, NOW);
    return computeDelta(a_list, b_records, NOW + 1);
}

Deno.test("chunkDelta: emits header + one frame per record", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // 1 header + 2 record chunks (0x20, 0x30 missing from a).
    assertEquals(frames.length, 3);
    assertEquals(frames[0].frameType, FRAME_TYPE_DELTA_CHUNK);
    assertEquals((frames[0].reserved >>> 16) & 0xFFFF, 0); // header sequence = 0
    assertEquals(frames[0].reserved & 0xFFFF, 2); // total = 2
});

Deno.test("chunkDelta: empty delta produces header-only envelope", async () => {
    const a = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, a);
    const frames = chunkDelta(delta, SENDER);
    assertEquals(frames.length, 1);
    assertEquals(frames[0].reserved & 0xFFFF, 0);
});

Deno.test("chunkDelta: deterministic across calls", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const f1 = chunkDelta(delta, SENDER);
    const f2 = chunkDelta(delta, SENDER);
    for (let i = 0; i < f1.length; i++) {
        assertEquals(f1[i].crc32, f2[i].crc32);
        assertEquals(f1[i].proposalOrTarget, f2[i].proposalOrTarget);
        assertEquals(f1[i].tick, f2[i].tick);
        assertEquals(f1[i].reserved, f2[i].reserved);
    }
});

Deno.test("chunkDelta: every frame's CRC validates after byte round-trip", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    for (const f of frames) {
        const bytes = frameToBytes(f);
        const decoded = frameFromBytes(bytes);
        assert(decoded !== null);
        assertEquals(decoded!.crc32, f.crc32);
        assertEquals(decoded!.frameType, FRAME_TYPE_DELTA_CHUNK);
    }
});

Deno.test("reassembleDelta: roundtrip preserves digest set + delta_hash", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    const result = reassembleDelta(frames);
    assert(result.ok, result.error);
    assertEquals(result.delta!.delta_hash, delta.delta_hash);
    assertEquals(
        result.delta!.missing_records.map((r) => r.digest).sort((x, y) => x - y),
        [0x20, 0x30],
    );
});

Deno.test("reassembleDelta: empty envelope reassembles to empty delta", async () => {
    const a = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, a);
    const frames = chunkDelta(delta, SENDER);
    const result = reassembleDelta(frames);
    assert(result.ok, result.error);
    assertEquals(result.delta!.missing_records.length, 0);
    assertEquals(result.delta!.delta_hash, delta.delta_hash);
});

Deno.test("reassembleDelta: out-of-order frames reassemble correctly", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Reverse the frame order to simulate out-of-order arrival.
    const shuffled = [...frames].reverse();
    const result = reassembleDelta(shuffled);
    assert(result.ok, result.error);
    assertEquals(
        result.delta!.missing_records.map((r) => r.digest).sort((x, y) => x - y),
        [0x20, 0x30, 0x40],
    );
});

Deno.test("reassembleDelta: detects missing record chunk", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Drop the second record chunk (sequence = 2).
    const dropped = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 2);
    const result = reassembleDelta(dropped);
    assertEquals(result.ok, false);
    assertEquals(result.missing_sequences, [2]);
});

Deno.test("reassembleDelta: detects missing header", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Drop the header (sequence = 0).
    const dropped = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 0);
    const result = reassembleDelta(dropped);
    assertEquals(result.ok, false);
    assertEquals(result.missing_sequences, [0]);
});

Deno.test("reassembleDelta: idempotent on duplicate frames", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Duplicate every frame (simulating retransmission).
    const doubled = [...frames, ...frames];
    const result = reassembleDelta(doubled);
    assert(result.ok, result.error);
    assertEquals(result.delta!.missing_records.length, 2);
});

Deno.test("reassembleDelta: rejects conflicting payload at same sequence", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Tamper a copy of frame[1]: keep sequence/total but change the digest.
    const tampered = { ...frames[1], proposalOrTarget: 0xDEADBEEF };
    const result = reassembleDelta([...frames, tampered]);
    assertEquals(result.ok, false);
    assert(result.error!.includes("conflicting payload"));
});

Deno.test("reassembleDelta: filters foreign envelopes when expected_envelope_hash supplied", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const c = archiveWith([0x10, 0x40, 0x50]);
    const deltaB = deltaFor(a, b);
    const deltaC = deltaFor(a, c);
    const framesMixed = [...chunkDelta(deltaB, SENDER), ...chunkDelta(deltaC, 0xCC04)];
    const onlyB = reassembleDelta(framesMixed, deltaB.delta_hash);
    assert(onlyB.ok, onlyB.error);
    assertEquals(
        onlyB.delta!.missing_records.map((r) => r.digest).sort((x, y) => x - y),
        [0x20, 0x30],
    );
});

Deno.test("reassembleDelta: rejects cross-envelope mixing without expected_envelope_hash", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const c = archiveWith([0x10, 0x40, 0x50]);
    const framesMixed = [
        ...chunkDelta(deltaFor(a, b), SENDER),
        ...chunkDelta(deltaFor(a, c), 0xCC04),
    ];
    const result = reassembleDelta(framesMixed);
    assertEquals(result.ok, false);
    assert(result.error!.includes("cross-envelope"));
});

Deno.test("reassembleDelta: ignores non-delta-chunk frames", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Mix in an unrelated QUORUM_VERDICT frame.
    const noise = buildQuorumVerdict(0xBEEF, 0xCC09, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    const result = reassembleDelta([noise, ...frames]);
    assert(result.ok, result.error);
    assertEquals(result.delta!.missing_records.length, 2);
});

Deno.test("reassembleDelta: empty input → ok=false with informative error", async () => {
    const result = reassembleDelta([]);
    assertEquals(result.ok, false);
    assert(result.error!.includes("no delta-chunk frames"));
});

Deno.test("reassembled delta passes Era 1310 applyDelta integrity check", async () => {
    const a = archiveWith([0x10, 0x20]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    const result = reassembleDelta(frames);
    assert(result.ok);
    // Apply the reassembled delta to the local set.
    const apply = applyDelta([...a], result.delta!);
    assert(apply.outcome.ok);
    if (apply.outcome.ok) {
        assertEquals(apply.outcome.added_count, 2);
    }
    assertEquals(
        apply.merged.map((r) => r.digest).sort((x, y) => x - y),
        [0x10, 0x20, 0x30, 0x40],
    );
});

Deno.test("reassembleDelta: detects multi-chunk gap", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40, 0x50]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Drop sequences 2 and 4.
    const dropped = frames.filter((f) => {
        const seq = (f.reserved >>> 16) & 0xFFFF;
        return seq !== 2 && seq !== 4;
    });
    const result = reassembleDelta(dropped);
    assertEquals(result.ok, false);
    assertEquals(result.missing_sequences, [2, 4]);
});

Deno.test("reassembled record retains digest, verdict, q16 fidelity", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    const result = reassembleDelta(frames);
    assert(result.ok);
    const original = delta.missing_records[0];
    const reassembled = result.delta!.missing_records[0];
    assertEquals(reassembled.digest, original.digest);
    assertEquals(reassembled.verdict, original.verdict);
    assertEquals(reassembled.replayed_q16, original.replayed_q16);
    assertEquals(reassembled.diff_q16, original.diff_q16);
    assertEquals(reassembled.relay_count, original.relay_count);
    assertEquals(reassembled.overlap_pct, original.overlap_pct);
});

Deno.test("schema constants", async () => {
    assertEquals(DELTA_CHUNK_SCHEMA, "OMEGA-1320/v1");
    assertEquals(SYNC_SCHEMA_VERSION, "OMEGA-1310/v1");
});
