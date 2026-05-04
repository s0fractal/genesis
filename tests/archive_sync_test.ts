// Era 1310: Archive sync tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    SYNC_SCHEMA_VERSION,
    applyDelta,
    buildDigestList,
    computeDelta,
    digestSetHash,
    syncRound,
} from "../src/network/archive_sync.ts";
import {
    ARCHIVE_SCHEMA_VERSION,
    ArchivedVerdict,
    exportArchive,
} from "../src/network/verdict_archive.ts";
import { QuorumAgreementTracker } from "../src/network/quorum_broadcast.ts";
import { buildQuorumVerdict } from "../src/network/spore_frame.ts";

const NOW = 100_000;

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

Deno.test("digestSetHash: deterministic across calls", async () => {
    const h1 = digestSetHash([0x10, 0x20, 0x30]);
    const h2 = digestSetHash([0x10, 0x20, 0x30]);
    assertEquals(h1, h2);
});

Deno.test("digestSetHash: order-independent", async () => {
    assertEquals(
        digestSetHash([0x30, 0x10, 0x20]),
        digestSetHash([0x10, 0x20, 0x30]),
    );
});

Deno.test("digestSetHash: empty input → FNV-1a offset basis", async () => {
    assertEquals(digestSetHash([]), 0x811C_9DC5);
});

Deno.test("buildDigestList: sorted digests + correct hash", async () => {
    const records = archiveWith([0x30, 0x10, 0x20]);
    const list = buildDigestList(
        { schema: ARCHIVE_SCHEMA_VERSION, archive_hash: 0, archive_hash_hex: "",
          exported_at_ms: NOW, record_count: records.length, min_digest_hex: "",
          max_digest_hex: "", records },
        NOW,
    );
    assertEquals(list.digests, [0x10, 0x20, 0x30]);
    assertEquals(list.digest_set_hash, digestSetHash([0x10, 0x20, 0x30]));
});

Deno.test("computeDelta: peer records initiator is missing → returned", async () => {
    const a = archiveWith([0x10, 0x20]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, b, NOW + 100);
    assertEquals(delta.missing_records.length, 2);
    assertEquals(delta.missing_records.map(r => r.digest), [0x30, 0x40]);
});

Deno.test("computeDelta: identifies what peer is missing too", async () => {
    const a = archiveWith([0x10, 0x20, 0x30]);
    const b = archiveWith([0x10, 0x40]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, b, NOW + 100);
    // a needs 0x40 from b; b needs 0x20 and 0x30 from a.
    assertEquals(delta.missing_records.map(r => r.digest), [0x40]);
    assertEquals(delta.peer_missing_digests, [0x20, 0x30]);
});

Deno.test("computeDelta: identical archives → empty delta", async () => {
    const a = archiveWith([0x10, 0x20, 0x30]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, a, NOW);
    assertEquals(delta.missing_records.length, 0);
    assertEquals(delta.peer_missing_digests.length, 0);
});

Deno.test("computeDelta: delta_hash is deterministic", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const d1 = computeDelta(a_list, b, NOW);
    const d2 = computeDelta(a_list, b, NOW);
    assertEquals(d1.delta_hash, d2.delta_hash);
});

Deno.test("applyDelta: adds missing records to local set", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, b, NOW);
    const result = applyDelta([...a], delta);
    assert(result.outcome.ok);
    if (result.outcome.ok) {
        assertEquals(result.outcome.added_count, 2);
    }
    assertEquals(result.merged.length, 3);
    assertEquals(result.merged.map(r => r.digest).sort((x, y) => x - y), [0x10, 0x20, 0x30]);
});

Deno.test("applyDelta: empty delta is a no-op", async () => {
    const a = archiveWith([0x10, 0x20]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, a, NOW);
    const result = applyDelta([...a], delta);
    assert(result.outcome.ok);
    if (result.outcome.ok) assertEquals(result.outcome.added_count, 0);
    assertEquals(result.merged.length, 2);
});

Deno.test("applyDelta: rejects bad schema", async () => {
    const a = archiveWith([0x10]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, archiveWith([0x10, 0x20]), NOW);
    delta.schema = "bad-schema";
    const result = applyDelta([...a], delta);
    assertEquals(result.outcome.ok, false);
});

Deno.test("applyDelta: rejects delta_hash drift (tampering)", async () => {
    const a = archiveWith([0x10]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: a.length,
        min_digest_hex: "", max_digest_hex: "", records: a,
    }, NOW);
    const delta = computeDelta(a_list, archiveWith([0x10, 0x20, 0x30]), NOW);
    delta.delta_hash ^= 0xFFFFFFFF;
    const result = applyDelta([...a], delta);
    assertEquals(result.outcome.ok, false);
    if (!result.outcome.ok) assert(result.outcome.reason.includes("drift"));
});

Deno.test("applyDelta: idempotent on duplicate digests", async () => {
    const a = archiveWith([0x10, 0x20]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: 0,
        min_digest_hex: "", max_digest_hex: "", records: [],
    }, NOW);
    // Construct a delta containing 0x10 (already present locally).
    const delta = computeDelta(a_list, [a[0]], NOW);
    const result = applyDelta([...a], delta);
    assert(result.outcome.ok);
    // a already had 0x10; identical record → idempotent skip.
    if (result.outcome.ok) assertEquals(result.outcome.added_count, 0);
    assertEquals(result.merged.length, 2);
});

Deno.test("applyDelta: rejects collision (same digest, different content)", async () => {
    const a = archiveWith([0x10]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: 0,
        min_digest_hex: "", max_digest_hex: "", records: [],
    }, NOW);
    // Build a fake "remote" record with the same digest but different verdict.
    const fake_remote: ArchivedVerdict = {
        ...a[0],
        verdict: "uncorroborated",
        replayed_q16: 99999,
    };
    const delta = computeDelta(a_list, [fake_remote], NOW);
    const result = applyDelta([...a], delta);
    assertEquals(result.outcome.ok, false);
    if (!result.outcome.ok) assert(result.outcome.reason.includes("collision"));
});

Deno.test("applyDelta: rejects record with bad archive schema", async () => {
    const a = archiveWith([0x10]);
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: NOW, record_count: 0,
        min_digest_hex: "", max_digest_hex: "", records: [],
    }, NOW);
    const remote = archiveWith([0x20]);
    remote[0].schema = "bad-archive-schema";
    const delta = computeDelta(a_list, remote, NOW);
    const result = applyDelta([...a], delta);
    assertEquals(result.outcome.ok, false);
});

Deno.test("syncRound: bidirectional convergence", async () => {
    const a = archiveWith([0x10, 0x20]);
    const b = archiveWith([0x20, 0x30]);
    const result = syncRound(a, b, NOW);
    // Both sides converge to {10, 20, 30}.
    const digests = result.converged_records.map(r => r.digest).sort((x, y) => x - y);
    assertEquals(digests, [0x10, 0x20, 0x30]);
    // a was missing 0x30 from b.
    assertEquals(result.a_added_from_b, 1);
    // b was missing 0x10 from a.
    assertEquals(result.b_added_from_a, 1);
});

Deno.test("syncRound: identical inputs → no additions", async () => {
    const records = archiveWith([0x10, 0x20]);
    const result = syncRound(records, records, NOW);
    assertEquals(result.a_added_from_b, 0);
    assertEquals(result.b_added_from_a, 0);
});

Deno.test("syncRound: disjoint inputs → both sides fully merge", async () => {
    const a = archiveWith([0x10, 0x20]);
    const b = archiveWith([0x30, 0x40]);
    const result = syncRound(a, b, NOW);
    assertEquals(result.a_added_from_b, 2);
    assertEquals(result.b_added_from_a, 2);
    assertEquals(result.converged_records.length, 4);
});

Deno.test("syncRound: converged_digest_set_hash matches archive_hash math", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const result = syncRound(a, b, NOW);
    const expected = digestSetHash([0x10, 0x20, 0x30]);
    assertEquals(result.converged_digest_set_hash, expected);
});

Deno.test("schema constant", async () => {
    assertEquals(SYNC_SCHEMA_VERSION, "OMEGA-1310/v1");
});
