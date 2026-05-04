// Era 1360: Network digest aggregator tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    AGGREGATOR_SCHEMA,
    NetworkDigestAggregator,
} from "../src/network/network_digest_aggregator.ts";
import {
    buildDigestList,
    digestSetHash,
} from "../src/network/archive_sync.ts";
import {
    ARCHIVE_SCHEMA_VERSION,
    ArchivedVerdict,
    exportArchive,
} from "../src/network/verdict_archive.ts";
import { QuorumAgreementTracker } from "../src/network/quorum_broadcast.ts";
import { buildQuorumVerdict } from "../src/network/spore_frame.ts";

const T0 = 1_000_000;

function archiveWith(digests: ReadonlyArray<number>): ArchivedVerdict[] {
    const t = new QuorumAgreementTracker();
    for (const d of digests) {
        for (const broadcaster of [0xCC01, 0xCC02, 0xCC03]) {
            const f = buildQuorumVerdict(d, 0xCC01, 0, 3, 50, 32768, 100, T0 & 0xFFFFFFFF);
            t.observe(f, broadcaster, T0);
        }
    }
    return exportArchive(t, { now_ms: T0 }).records;
}

function listFor(records: ArchivedVerdict[], now_ms = T0) {
    return buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: now_ms, record_count: records.length,
        min_digest_hex: "", max_digest_hex: "", records,
    }, now_ms);
}

Deno.test("aggregator: empty has no peers, no digests", async () => {
    const agg = new NetworkDigestAggregator();
    assertEquals(agg.peerCount(T0), 0);
    assertEquals(agg.networkDigests(T0), []);
});

Deno.test("aggregator: single peer's digests become network", async () => {
    const agg = new NetworkDigestAggregator();
    const recs = archiveWith([0x10, 0x20, 0x30]);
    agg.observe(0xAAA1, listFor(recs), T0);
    assertEquals(agg.peerCount(T0), 1);
    assertEquals(agg.networkDigests(T0), [0x10, 0x20, 0x30]);
});

Deno.test("aggregator: union across peers, deduplicated + sorted", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x30])), T0);
    agg.observe(0xAAA2, listFor(archiveWith([0x20, 0x30, 0x40])), T0 + 100);
    assertEquals(agg.networkDigests(T0 + 100), [0x10, 0x20, 0x30, 0x40]);
});

Deno.test("aggregator: re-observation overwrites prior peer record", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10])), T0);
    agg.observe(0xAAA1, listFor(archiveWith([0x20, 0x30])), T0 + 1000);
    assertEquals(agg.networkDigests(T0 + 1000), [0x20, 0x30]);
});

Deno.test("aggregator: TTL evicts stale observations", async () => {
    const agg = new NetworkDigestAggregator(5_000);
    agg.observe(0xAAA1, listFor(archiveWith([0x10])), T0);
    agg.observe(0xAAA2, listFor(archiveWith([0x20])), T0 + 1000);
    // Both are fresh at T0 + 4_000.
    assertEquals(agg.peerCount(T0 + 4_000), 2);
    // At T0 + 6_000, peer 0xAAA1's observation is older than TTL=5_000.
    assertEquals(agg.peerCount(T0 + 6_000), 1);
    assertEquals(agg.networkDigests(T0 + 6_000), [0x20]);
});

Deno.test("aggregator: forget removes specific peer", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10])), T0);
    agg.observe(0xAAA2, listFor(archiveWith([0x20])), T0);
    agg.forget(0xAAA1);
    assertEquals(agg.peerCount(T0), 1);
    assertEquals(agg.networkDigests(T0), [0x20]);
});

Deno.test("aggregator: networkDigestSetHash is order-independent", async () => {
    const aggA = new NetworkDigestAggregator();
    const aggB = new NetworkDigestAggregator();
    // Different peer-observation order; same union.
    aggA.observe(0x01, listFor(archiveWith([0x10, 0x20])), T0);
    aggA.observe(0x02, listFor(archiveWith([0x30])), T0 + 1);
    aggB.observe(0x99, listFor(archiveWith([0x30])), T0 + 5);
    aggB.observe(0x88, listFor(archiveWith([0x10, 0x20])), T0 + 6);
    assertEquals(
        aggA.networkDigestSetHash(T0 + 100),
        aggB.networkDigestSetHash(T0 + 100),
    );
    assertEquals(aggA.networkDigestSetHash(T0 + 100), digestSetHash([0x10, 0x20, 0x30]));
});

Deno.test("aggregator: convergenceSignal — local matches network → converged", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20])), T0);
    const sig = agg.convergenceSignal([0x10, 0x20], T0);
    assertEquals(sig.score, 1);
    assertEquals(sig.band, "converged");
});

Deno.test("aggregator: convergenceSignal — local empty vs network → stranded + alarm", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20, 0x30])), T0);
    const sig = agg.convergenceSignal([], T0);
    assertEquals(sig.score, 0);
    assertEquals(sig.band, "stranded");
    assertEquals(sig.alarm, true);
});

Deno.test("aggregator: freshObservations sorted by peer_id", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0x05, listFor(archiveWith([0x10])), T0);
    agg.observe(0x01, listFor(archiveWith([0x20])), T0);
    agg.observe(0x03, listFor(archiveWith([0x30])), T0);
    const fresh = agg.freshObservations(T0);
    assertEquals(fresh.map(o => o.peer_id), [0x01, 0x03, 0x05]);
});

Deno.test("aggregator: summary reports counts + age extremes", async () => {
    const agg = new NetworkDigestAggregator(60_000);
    agg.observe(0x01, listFor(archiveWith([0x10, 0x20])), T0);
    agg.observe(0x02, listFor(archiveWith([0x30])), T0 + 1000);
    agg.observe(0x03, listFor(archiveWith([0x10])), T0 + 2000); // overlap
    const s = agg.summary(T0 + 3000);
    assertEquals(s.peer_count, 3);
    assertEquals(s.total_unique_digests, 3);
    assertEquals(s.ttl_ms, 60_000);
    assertEquals(s.oldest_observed_at_ms, T0);
    assertEquals(s.newest_observed_at_ms, T0 + 2000);
});

Deno.test("aggregator: summary handles empty state", async () => {
    const agg = new NetworkDigestAggregator();
    const s = agg.summary(T0);
    assertEquals(s.peer_count, 0);
    assertEquals(s.total_unique_digests, 0);
    assertEquals(s.oldest_observed_at_ms, 0);
    assertEquals(s.newest_observed_at_ms, 0);
});

Deno.test("aggregator: invalid TTL throws", async () => {
    assertThrows(() => new NetworkDigestAggregator(0));
    assertThrows(() => new NetworkDigestAggregator(-1));
});

Deno.test("aggregator: digests are stored sorted regardless of input order", async () => {
    const agg = new NetworkDigestAggregator();
    // Construct an ArchiveDigestList with deliberately unsorted digests.
    const list = {
        schema: "OMEGA-1310/v1",
        digests: [0x30, 0x10, 0x20],
        digest_set_hash: digestSetHash([0x10, 0x20, 0x30]),
        broadcast_at_ms: T0,
    };
    agg.observe(0xAAA1, list, T0);
    const fresh = agg.freshObservations(T0);
    assertEquals(fresh[0].digests, [0x10, 0x20, 0x30]);
});

Deno.test("aggregator: networkDigests after multiple TTL evictions stabilizes", async () => {
    const agg = new NetworkDigestAggregator(1000);
    agg.observe(0x01, listFor(archiveWith([0x10])), T0);
    agg.observe(0x02, listFor(archiveWith([0x20])), T0 + 500);
    agg.observe(0x03, listFor(archiveWith([0x30])), T0 + 800);
    // At T0 + 1500: 0x01 expired, 0x02 + 0x03 fresh.
    assertEquals(agg.networkDigests(T0 + 1500), [0x20, 0x30]);
    // At T0 + 1800: only 0x03 fresh.
    assertEquals(agg.networkDigests(T0 + 1800), [0x30]);
    // At T0 + 2000: nothing.
    assertEquals(agg.networkDigests(T0 + 2000), []);
});

Deno.test("schema constant", async () => {
    assertEquals(AGGREGATOR_SCHEMA, "OMEGA-1360/v1");
});
