// Era 1370: Convergence-triggered auto sync tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    AUTO_SYNC_SCHEMA,
    convergenceAlarmEvent,
    rankPeersByNovelty,
    selectAlarmOverrideOrder,
    selectMostInformativePeer,
} from "../src/network/convergence_auto_sync.ts";
import { NetworkDigestAggregator } from "../src/network/network_digest_aggregator.ts";
import {
    addPeer,
    makeCoordinator,
    recordPeerSyncFailure,
} from "../src/network/archive_sync_coordinator.ts";
import { DEFAULT_SCHEDULER_CONFIG } from "../src/network/archive_sync_driver.ts";
import { computeConvergenceHealth } from "../src/network/convergence_health.ts";
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

function listFor(records: ArchivedVerdict[]) {
    return buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: T0, record_count: records.length,
        min_digest_hex: "", max_digest_hex: "", records,
    }, T0);
}

Deno.test("rankPeersByNovelty: orders peers by novel digest count DESC", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20])), T0);            // 0 novel
    agg.observe(0xAAA2, listFor(archiveWith([0x30, 0x40, 0x50])), T0);      // 3 novel
    agg.observe(0xAAA3, listFor(archiveWith([0x60])), T0);                  // 1 novel
    const ranked = rankPeersByNovelty(agg, [0x10, 0x20], T0);
    assertEquals(ranked[0].peer_id, 0xAAA2);
    assertEquals(ranked[0].novel_count, 3);
    assertEquals(ranked[1].peer_id, 0xAAA3);
    assertEquals(ranked[1].novel_count, 1);
    assertEquals(ranked[2].peer_id, 0xAAA1);
    assertEquals(ranked[2].novel_count, 0);
});

Deno.test("rankPeersByNovelty: ties broken by peer_id ASC", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA5, listFor(archiveWith([0x30])), T0);
    agg.observe(0xAAA1, listFor(archiveWith([0x40])), T0);
    agg.observe(0xAAA3, listFor(archiveWith([0x50])), T0);
    const ranked = rankPeersByNovelty(agg, [], T0);
    assertEquals(ranked.map(r => r.peer_id), [0xAAA1, 0xAAA3, 0xAAA5]);
});

Deno.test("selectMostInformativePeer: returns top peer", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10])), T0);
    agg.observe(0xAAA2, listFor(archiveWith([0x10, 0x20, 0x30])), T0);
    const top = selectMostInformativePeer(agg, [0x10], T0);
    assertEquals(top, 0xAAA2);
});

Deno.test("selectMostInformativePeer: null when no peer adds anything", async () => {
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20])), T0);
    const top = selectMostInformativePeer(agg, [0x10, 0x20, 0x30], T0);
    assertEquals(top, null);
});

Deno.test("selectMostInformativePeer: null when aggregator empty", async () => {
    const agg = new NetworkDigestAggregator();
    assertEquals(selectMostInformativePeer(agg, [0x10], T0), null);
});

Deno.test("selectAlarmOverrideOrder: bypasses cooldown — returns informative peers", async () => {
    let coord = makeCoordinator(0xCC01);
    coord = addPeer(coord, 0xAAA1);
    coord = addPeer(coord, 0xAAA2);
    // Mark both peers as just-failed (still in cooldown).
    coord = recordPeerSyncFailure(coord, 0xAAA1, T0);
    coord = recordPeerSyncFailure(coord, 0xAAA2, T0);
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20])), T0);     // 2 novel
    agg.observe(0xAAA2, listFor(archiveWith([0x30, 0x40, 0x50])), T0); // 3 novel
    // Despite cooldown, the override order returns both peers.
    const order = selectAlarmOverrideOrder(coord, agg, [], T0 + 100, 2);
    assertEquals(order, [0xAAA2, 0xAAA1]);
});

Deno.test("selectAlarmOverrideOrder: cold peers excluded even under alarm", async () => {
    let coord = makeCoordinator(0xCC01, {
        ...DEFAULT_SCHEDULER_CONFIG,
        failure_giveup_count: 2,
    });
    coord = addPeer(coord, 0xAAA1);
    coord = addPeer(coord, 0xAAA2);
    // PEER 0xAAA1 → cold (2 failures with cap=2).
    coord = recordPeerSyncFailure(coord, 0xAAA1, T0);
    coord = recordPeerSyncFailure(coord, 0xAAA1, T0 + 10);
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20, 0x30])), T0); // most informative
    agg.observe(0xAAA2, listFor(archiveWith([0x40])), T0);
    const order = selectAlarmOverrideOrder(coord, agg, [], T0 + 100, 5);
    // 0xAAA1 excluded (cold) despite being most informative.
    assertEquals(order, [0xAAA2]);
});

Deno.test("selectAlarmOverrideOrder: peers unknown to coordinator excluded", async () => {
    let coord = makeCoordinator(0xCC01);
    coord = addPeer(coord, 0xAAA1);
    // 0xAAA2 NOT added to coordinator.
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10])), T0);
    agg.observe(0xAAA2, listFor(archiveWith([0x20, 0x30])), T0); // most informative but unknown
    const order = selectAlarmOverrideOrder(coord, agg, [], T0, 5);
    assertEquals(order, [0xAAA1]);
});

Deno.test("selectAlarmOverrideOrder: stops at max parameter", async () => {
    let coord = makeCoordinator(0xCC01);
    coord = addPeer(coord, 0xAAA1);
    coord = addPeer(coord, 0xAAA2);
    coord = addPeer(coord, 0xAAA3);
    const agg = new NetworkDigestAggregator();
    agg.observe(0xAAA1, listFor(archiveWith([0x10])), T0);
    agg.observe(0xAAA2, listFor(archiveWith([0x20])), T0);
    agg.observe(0xAAA3, listFor(archiveWith([0x30])), T0);
    const order = selectAlarmOverrideOrder(coord, agg, [], T0, 2);
    assertEquals(order.length, 2);
});

Deno.test("convergenceAlarmEvent: includes signal snapshot", async () => {
    const sig = computeConvergenceHealth([0x10], [0x10, 0x20, 0x30, 0x40, 0x50]);
    const ev = convergenceAlarmEvent(sig, [
        { peer_id: 0xAAA1, novel_count: 4, total_offered: 5 },
    ], T0);
    assertEquals(ev.schema, AUTO_SYNC_SCHEMA);
    assertEquals(ev.triggered_at_ms, T0);
    assertEquals(ev.score_q16, sig.rate_q16);
    assertEquals(ev.band, sig.band);
    assertEquals(ev.intersection_size, 1);
    assertEquals(ev.network_size, 5);
    assertEquals(ev.informative_peers.length, 1);
});

Deno.test("convergenceAlarmEvent: hash is deterministic across calls", async () => {
    const sig = computeConvergenceHealth([0x10], [0x10, 0x20, 0x30]);
    const peers = [
        { peer_id: 0x01, novel_count: 2, total_offered: 3 },
        { peer_id: 0x02, novel_count: 1, total_offered: 2 },
    ];
    const e1 = convergenceAlarmEvent(sig, peers, T0);
    const e2 = convergenceAlarmEvent(sig, peers, T0);
    assertEquals(e1.event_hash, e2.event_hash);
});

Deno.test("convergenceAlarmEvent: hash differs across distinct signals", async () => {
    const sigA = computeConvergenceHealth([0x10], [0x10, 0x20]);
    const sigB = computeConvergenceHealth([], [0x10, 0x20]);
    const peers = [{ peer_id: 0x01, novel_count: 1, total_offered: 2 }];
    const eA = convergenceAlarmEvent(sigA, peers, T0);
    const eB = convergenceAlarmEvent(sigB, peers, T0);
    assert(eA.event_hash !== eB.event_hash);
});

Deno.test("convergenceAlarmEvent: top_n caps the peer list", async () => {
    const sig = computeConvergenceHealth([], [0x10, 0x20, 0x30]);
    const peers = [
        { peer_id: 0x01, novel_count: 3, total_offered: 3 },
        { peer_id: 0x02, novel_count: 2, total_offered: 2 },
        { peer_id: 0x03, novel_count: 1, total_offered: 1 },
    ];
    const ev = convergenceAlarmEvent(sig, peers, T0, 2);
    assertEquals(ev.informative_peers.length, 2);
    assertEquals(ev.informative_peers.map(p => p.peer_id), [0x01, 0x02]);
});

Deno.test("end-to-end: alarm triggers override order matching aggregator novelty", async () => {
    let coord = makeCoordinator(0xCC01);
    coord = addPeer(coord, 0xAAA1);
    coord = addPeer(coord, 0xAAA2);
    const agg = new NetworkDigestAggregator();
    // Network has 5 digests; local has only 0x10.
    agg.observe(0xAAA1, listFor(archiveWith([0x10, 0x20, 0x30])), T0); // 2 novel
    agg.observe(0xAAA2, listFor(archiveWith([0x10, 0x40, 0x50])), T0); // 2 novel
    const local = [0x10];
    const sig = agg.convergenceSignal(local, T0);
    assert(sig.alarm); // should fire (score = 1/5 = 0.2 < 0.5)
    const order = selectAlarmOverrideOrder(coord, agg, local, T0 + 100, 2);
    // Both peers contribute equal novel count (2); peer_id ASC tiebreak.
    assertEquals(order, [0xAAA1, 0xAAA2]);
    const top = selectMostInformativePeer(agg, local, T0);
    assertEquals(top, 0xAAA1);
    // Build alarm event for forensic audit.
    const ranked = rankPeersByNovelty(agg, local, T0);
    const ev = convergenceAlarmEvent(sig, ranked, T0 + 100);
    assertEquals(ev.network_size, 5);
    assertEquals(ev.intersection_size, 1);
});

Deno.test("schema constant", async () => {
    assertEquals(AUTO_SYNC_SCHEMA, "OMEGA-1370/v1");
});
