// Era 1300: Verdict archive tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    ARCHIVE_SCHEMA_VERSION,
    bundleToNdjson,
    computeArchiveHash,
    diffArchives,
    exportArchive,
    ndjsonToBundle,
} from "../src/network/verdict_archive.ts";
import { QuorumAgreementTracker } from "../src/network/quorum_broadcast.ts";
import { buildQuorumVerdict } from "../src/network/spore_frame.ts";

const NOW = 100_000;

function trackerWithVerdicts(
    items: ReadonlyArray<{ digest: number; broadcasters: number[] }>,
): QuorumAgreementTracker {
    const t = new QuorumAgreementTracker();
    for (const it of items) {
        for (const b of it.broadcasters) {
            const f = buildQuorumVerdict(it.digest, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
            t.observe(f, b, NOW);
        }
    }
    return t;
}

Deno.test("export: filters to triple+ by default", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x01, broadcasters: [0xCC01] },                             // lone
        { digest: 0x02, broadcasters: [0xCC01, 0xCC02] },                     // double
        { digest: 0x03, broadcasters: [0xCC01, 0xCC02, 0xCC03] },             // triple+
        { digest: 0x04, broadcasters: [0xCC01, 0xCC02, 0xCC03, 0xCC04] },     // triple+
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.record_count, 2);
    assertEquals(bundle.records.map(r => r.digest), [0x03, 0x04]);
});

Deno.test("export: only_high_confidence=false keeps everything", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x01, broadcasters: [0xCC01] },
        { digest: 0x02, broadcasters: [0xCC01, 0xCC02] },
        { digest: 0x03, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW, only_high_confidence: false });
    assertEquals(bundle.record_count, 3);
});

Deno.test("export: deterministic hash across calls", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const b1 = exportArchive(t, { now_ms: NOW });
    const b2 = exportArchive(t, { now_ms: NOW });
    assertEquals(b1.archive_hash, b2.archive_hash);
});

Deno.test("export: archive_hash_hex is well-formed", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    assert(/^0x[0-9a-f]{8}$/.test(bundle.archive_hash_hex));
});

Deno.test("export: empty tracker → empty bundle with hash 0x811C9DC5", async () => {
    const t = new QuorumAgreementTracker();
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.record_count, 0);
    // FNV-1a offset basis applied to empty input.
    assertEquals(bundle.archive_hash_hex, "0x811c9dc5");
});

Deno.test("export: records sorted by digest ascending", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x30, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.records.map(r => r.digest), [0x10, 0x20, 0x30]);
});

Deno.test("export: min/max_digest_hex match sorted bounds", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x100, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x500, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x300, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.min_digest_hex, "0x00000100");
    assertEquals(bundle.max_digest_hex, "0x00000500");
});

Deno.test("export: schema version is set", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.schema, ARCHIVE_SCHEMA_VERSION);
    for (const r of bundle.records) assertEquals(r.schema, ARCHIVE_SCHEMA_VERSION);
});

Deno.test("export: high_confidence_at_archive flag is set correctly", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] }, // triple+
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.records[0].high_confidence_at_archive, true);
});

Deno.test("export: adjudicators array is sorted ascending", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0x10, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    for (const id of [0x300, 0x100, 0x200]) t.observe(f, id, NOW);
    const bundle = exportArchive(t, { now_ms: NOW });
    assertEquals(bundle.records[0].adjudicators, [0x100, 0x200, 0x300]);
});

Deno.test("ndjson: round-trips bit-for-bit", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03, 0xCC04] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    const blob = bundleToNdjson(bundle);
    const result = ndjsonToBundle(blob);
    assert(result.ok);
    assertEquals(result.bundle.record_count, bundle.record_count);
    assertEquals(result.bundle.archive_hash, bundle.archive_hash);
});

Deno.test("ndjson: drift detected via archive_hash mismatch", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    const blob = bundleToNdjson(bundle);
    // Tamper with the second line's digest field (the actual record).
    const lines = blob.split("\n");
    lines[1] = lines[1].replace(/"digest":(\d+)/, '"digest":99999');
    const tampered = lines.join("\n");
    const result = ndjsonToBundle(tampered);
    assertEquals(result.ok, false);
    if (!result.ok) {
        assert(result.reason.includes("drift"));
    }
});

Deno.test("ndjson: empty blob is rejected", async () => {
    const result = ndjsonToBundle("");
    assertEquals(result.ok, false);
});

Deno.test("ndjson: bad schema is rejected", async () => {
    const bad = JSON.stringify({
        schema: "bad-schema",
        archive_hash_hex: "0x00000000",
        exported_at_ms: 0,
        record_count: 0,
    }) + "\n";
    const result = ndjsonToBundle(bad);
    assertEquals(result.ok, false);
});

Deno.test("ndjson: record_count mismatch rejected", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    const blob = bundleToNdjson(bundle);
    const lines = blob.split("\n");
    // Drop the only record line, leaving manifest claiming 1 record.
    const truncated = lines[0] + "\n";
    const result = ndjsonToBundle(truncated);
    assertEquals(result.ok, false);
    if (!result.ok) assert(result.reason.includes("record_count"));
});

Deno.test("ndjson: malformed JSON rejected", async () => {
    const result = ndjsonToBundle("not-json\n");
    assertEquals(result.ok, false);
});

Deno.test("computeArchiveHash: deterministic across calls", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const bundle = exportArchive(t, { now_ms: NOW });
    const h1 = computeArchiveHash(bundle.records);
    const h2 = computeArchiveHash(bundle.records);
    assertEquals(h1, h2);
});

Deno.test("computeArchiveHash: different digest sets → different hashes", async () => {
    const t1 = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const t2 = trackerWithVerdicts([
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const b1 = exportArchive(t1, { now_ms: NOW });
    const b2 = exportArchive(t2, { now_ms: NOW });
    assert(b1.archive_hash !== b2.archive_hash);
});

Deno.test("diff: identical archives have full overlap", async () => {
    const t = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const a = exportArchive(t, { now_ms: NOW });
    const b = exportArchive(t, { now_ms: NOW });
    const d = diffArchives(a, b);
    assertEquals(d.shared.length, 2);
    assertEquals(d.overlap_ratio, 1);
});

Deno.test("diff: disjoint archives have zero overlap", async () => {
    const t1 = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const t2 = trackerWithVerdicts([
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const a = exportArchive(t1, { now_ms: NOW });
    const b = exportArchive(t2, { now_ms: NOW });
    const d = diffArchives(a, b);
    assertEquals(d.shared.length, 0);
    assertEquals(d.overlap_ratio, 0);
});

Deno.test("diff: partial overlap returns correct ratios", async () => {
    const t1 = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x20, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const t2 = trackerWithVerdicts([
        { digest: 0x10, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x30, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const a = exportArchive(t1, { now_ms: NOW });
    const b = exportArchive(t2, { now_ms: NOW });
    const d = diffArchives(a, b);
    assertEquals(d.shared, [0x10]);
    assertEquals(d.a_only, [0x20]);
    assertEquals(d.b_only, [0x30]);
    // 1 shared / 3 total = 1/3 ≈ 0.333
    assert(Math.abs(d.overlap_ratio - 1/3) < 1e-9);
});

Deno.test("diff: empty archives yield zero ratios", async () => {
    const t = new QuorumAgreementTracker();
    const a = exportArchive(t, { now_ms: NOW });
    const b = exportArchive(t, { now_ms: NOW });
    const d = diffArchives(a, b);
    assertEquals(d.overlap_ratio, 0);
});

Deno.test("diff: sorted output for determinism", async () => {
    const t1 = trackerWithVerdicts([
        { digest: 0x300, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x100, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
        { digest: 0x200, broadcasters: [0xCC01, 0xCC02, 0xCC03] },
    ]);
    const t2 = new QuorumAgreementTracker();
    const a = exportArchive(t1, { now_ms: NOW });
    const b = exportArchive(t2, { now_ms: NOW });
    const d = diffArchives(a, b);
    assertEquals(d.a_only, [0x100, 0x200, 0x300]);
});
