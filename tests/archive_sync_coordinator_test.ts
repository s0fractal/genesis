// Era 1340: Multi-peer sync coordinator tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    COORDINATOR_SCHEMA,
    addPeer,
    coordinatorTelemetry,
    dropEnvelope,
    fleetConvergenceRate,
    ingestPeerFrames,
    makeCoordinator,
    progressEnvelope,
    recordEnvelopeRetransmit,
    recordPeerSyncAttempt,
    recordPeerSyncFailure,
    recordPeerSyncSuccess,
    removePeer,
    selectNextSyncPeers,
} from "../src/network/archive_sync_coordinator.ts";
import {
    DEFAULT_RETRANSMIT_CONFIG,
    DEFAULT_SCHEDULER_CONFIG,
} from "../src/network/archive_sync_driver.ts";
import {
    buildDigestList,
    computeDelta,
} from "../src/network/archive_sync.ts";
import { chunkDelta } from "../src/network/archive_sync_wire.ts";
import {
    ARCHIVE_SCHEMA_VERSION,
    ArchivedVerdict,
    exportArchive,
} from "../src/network/verdict_archive.ts";
import { QuorumAgreementTracker } from "../src/network/quorum_broadcast.ts";
import { buildQuorumVerdict } from "../src/network/spore_frame.ts";

const T0 = 1_000_000;
const SELF = 0xCC01;
const PEER_A = 0xCC02;
const PEER_B = 0xCC03;
const PEER_C = 0xCC04;

function archiveWith(digests: ReadonlyArray<number>): ArchivedVerdict[] {
    const t = new QuorumAgreementTracker();
    for (const d of digests) {
        for (const broadcaster of [SELF, PEER_A, PEER_B]) {
            const f = buildQuorumVerdict(d, SELF, 0, 3, 50, 32768, 100, T0 & 0xFFFFFFFF);
            t.observe(f, broadcaster, T0);
        }
    }
    return exportArchive(t, { now_ms: T0 }).records;
}

function deltaFor(a_records: ArchivedVerdict[], b_records: ArchivedVerdict[]) {
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: T0, record_count: a_records.length,
        min_digest_hex: "", max_digest_hex: "", records: a_records,
    }, T0);
    return computeDelta(a_list, b_records, T0 + 1);
}

// ---------- PEER SELECTION ----------

Deno.test("coordinator: empty has nothing to sync", () => {
    const c = makeCoordinator(SELF);
    assertEquals(selectNextSyncPeers(c, T0), []);
});

Deno.test("coordinator: never-attempted peer is selected first", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    // Mark PEER_A as just-succeeded.
    c = recordPeerSyncAttempt(c, PEER_A, T0);
    c = recordPeerSyncSuccess(c, PEER_A, T0);
    const sel = selectNextSyncPeers(c, T0 + 100, 1);
    assertEquals(sel, [PEER_B]);
});

Deno.test("coordinator: respects max parameter", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    c = addPeer(c, PEER_C);
    const sel = selectNextSyncPeers(c, T0, 2);
    assertEquals(sel.length, 2);
});

Deno.test("coordinator: cold peer excluded from selection", () => {
    let c = makeCoordinator(SELF, {
        ...DEFAULT_SCHEDULER_CONFIG,
        failure_giveup_count: 2,
    });
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    c = recordPeerSyncFailure(c, PEER_A, T0);
    c = recordPeerSyncFailure(c, PEER_A, T0 + 1);
    // PEER_A is now cold. PEER_B is fresh.
    const sel = selectNextSyncPeers(c, T0 + 1_000_000, 5);
    assertEquals(sel, [PEER_B]);
});

Deno.test("coordinator: oldest last_success_ms wins among due peers", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    // Both were synced before, PEER_A more recently.
    c = recordPeerSyncSuccess(c, PEER_A, T0 + 1000);
    c = recordPeerSyncSuccess(c, PEER_B, T0);
    // After base interval elapses, both are due.
    const dueAt = T0 + 1000 + DEFAULT_SCHEDULER_CONFIG.base_interval_ms;
    const sel = selectNextSyncPeers(c, dueAt, 1);
    assertEquals(sel, [PEER_B]); // older last_success_ms.
});

Deno.test("coordinator: fewer failures preferred at same age", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    // Both never succeeded; PEER_A has 2 failures, PEER_B has 0.
    c = recordPeerSyncFailure(c, PEER_A, T0);
    c = recordPeerSyncFailure(c, PEER_A, T0 + 1);
    // PEER_A's next_attempt is in the future, so it's not due yet —
    // need to advance time enough that both qualify.
    const sel = selectNextSyncPeers(c, T0 + 1_000_000_000, 1);
    // Both qualify; PEER_B (fewer failures) preferred at same last_success_ms=0.
    assertEquals(sel, [PEER_B]);
});

Deno.test("coordinator: removePeer drops state", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    c = removePeer(c, PEER_A);
    assertEquals(c.peers.size, 1);
    assertEquals(c.peers.has(PEER_B), true);
});

// ---------- ENVELOPE INGESTION ----------

Deno.test("coordinator: ingestPeerFrames creates envelope on first frame", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_A);
    c = ingestPeerFrames(c, PEER_A, frames, T0 + 100);
    assertEquals(c.envelopes.size, 1);
    assertEquals(c.envelopes.get(delta.delta_hash)!.frames_by_sequence.size, frames.length);
    const src = c.sources.get(delta.delta_hash)!;
    assertEquals(src.originator, PEER_A);
    assertEquals(src.contributors.size, 1);
});

Deno.test("coordinator: ingestPeerFrames tracks multi-peer contributions", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_A);
    // PEER_A sends header + first record; PEER_B sends second record.
    c = ingestPeerFrames(c, PEER_A, [frames[0], frames[1]], T0 + 100);
    c = ingestPeerFrames(c, PEER_B, [frames[2]], T0 + 200);
    const src = c.sources.get(delta.delta_hash)!;
    assertEquals(src.originator, PEER_A);
    assertEquals(src.contributors.size, 2);
    assert(src.contributors.has(PEER_A));
    assert(src.contributors.has(PEER_B));
});

Deno.test("coordinator: ignores non-DELTA_CHUNK frames", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    const noise = buildQuorumVerdict(0xBEEF, PEER_A, 0, 3, 50, 32768, 100, T0 & 0xFFFFFFFF);
    c = ingestPeerFrames(c, PEER_A, [noise], T0 + 100);
    assertEquals(c.envelopes.size, 0);
    assertEquals(c.sources.size, 0);
});

// ---------- ENVELOPE PROGRESS ----------

Deno.test("coordinator: progressEnvelope returns complete with target_peers", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_A);
    c = ingestPeerFrames(c, PEER_A, frames, T0 + 100);
    const result = progressEnvelope(c, delta.delta_hash, T0 + 200);
    assert(result !== null);
    assertEquals(result!.action.kind, "complete");
    assertEquals(result!.target_peers, [PEER_A]);
    assertEquals(result!.originator, PEER_A);
});

Deno.test("coordinator: progressEnvelope for unknown envelope returns null", () => {
    const c = makeCoordinator(SELF);
    assertEquals(progressEnvelope(c, 0xDEADBEEF, T0), null);
});

Deno.test("coordinator: progressEnvelope returns retransmit + multi-peer fanout", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_A);
    // Header from A, frame[1] from B; frame[2] missing.
    c = ingestPeerFrames(c, PEER_A, [frames[0]], T0 + 100);
    c = ingestPeerFrames(c, PEER_B, [frames[1]], T0 + 200);
    const result = progressEnvelope(c, delta.delta_hash, T0 + 300);
    assert(result !== null);
    assertEquals(result!.action.kind, "retransmit");
    if (result!.action.kind === "retransmit") {
        assertEquals(result!.action.sequences, [2]);
    }
    // Both peers have contributed; both are retransmit candidates.
    assertEquals(result!.target_peers.length, 2);
    assertEquals(result!.target_peers.sort((x, y) => x - y), [PEER_A, PEER_B].sort((x, y) => x - y));
});

Deno.test("coordinator: recordEnvelopeRetransmit increments per-sequence counter", () => {
    let c = makeCoordinator(SELF, DEFAULT_SCHEDULER_CONFIG, {
        ...DEFAULT_RETRANSMIT_CONFIG,
        retransmit_cooldown_ms: 0,
        max_attempts_per_sequence: 2,
    });
    c = addPeer(c, PEER_A);
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_A);
    // Drop frame[2].
    const partial = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 2);
    c = ingestPeerFrames(c, PEER_A, partial, T0 + 100);
    c = recordEnvelopeRetransmit(c, delta.delta_hash, [2], T0 + 200);
    c = recordEnvelopeRetransmit(c, delta.delta_hash, [2], T0 + 300);
    // Sequence 2 has now hit the cap; next progressEnvelope returns giveup.
    const result = progressEnvelope(c, delta.delta_hash, T0 + 400);
    assert(result !== null);
    assertEquals(result!.action.kind, "giveup");
});

Deno.test("coordinator: dropEnvelope removes envelope + sources", () => {
    let c = makeCoordinator(SELF);
    c = addPeer(c, PEER_A);
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_A);
    c = ingestPeerFrames(c, PEER_A, frames, T0 + 100);
    assertEquals(c.envelopes.size, 1);
    c = dropEnvelope(c, delta.delta_hash);
    assertEquals(c.envelopes.size, 0);
    assertEquals(c.sources.size, 0);
});

// ---------- CONVERGENCE METRIC ----------

Deno.test("convergence: empty network → fully converged (65536)", () => {
    assertEquals(fleetConvergenceRate([0x10], []), 65536);
});

Deno.test("convergence: full overlap → 65536", () => {
    assertEquals(fleetConvergenceRate([0x10, 0x20], [0x10, 0x20]), 65536);
});

Deno.test("convergence: no overlap → 0", () => {
    assertEquals(fleetConvergenceRate([0x10, 0x20], [0x30, 0x40]), 0);
});

Deno.test("convergence: half overlap → ~32768 (Q16 0.5)", () => {
    const r = fleetConvergenceRate([0x10, 0x20], [0x10, 0x20, 0x30, 0x40]);
    assertEquals(r, 32768);
});

Deno.test("convergence: superset of network is still bounded by network size", () => {
    // Local has 4, network has 2 (subset). Intersection = 2 / |network| = 2 = 1.0.
    const r = fleetConvergenceRate([0x10, 0x20, 0x30, 0x40], [0x10, 0x20]);
    assertEquals(r, 65536);
});

// ---------- TELEMETRY ----------

Deno.test("telemetry: counts peers, due, cold, envelopes, frames", () => {
    let c = makeCoordinator(SELF, {
        ...DEFAULT_SCHEDULER_CONFIG,
        failure_giveup_count: 2,
    });
    c = addPeer(c, PEER_A);
    c = addPeer(c, PEER_B);
    c = addPeer(c, PEER_C);
    // PEER_A: cold.
    c = recordPeerSyncFailure(c, PEER_A, T0);
    c = recordPeerSyncFailure(c, PEER_A, T0 + 1);
    // PEER_B: just synced (not due).
    c = recordPeerSyncSuccess(c, PEER_B, T0 + 100);
    // PEER_C: never attempted (due).
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, PEER_C);
    c = ingestPeerFrames(c, PEER_C, frames, T0 + 200);

    const tele = coordinatorTelemetry(c, T0 + 300);
    assertEquals(tele.peer_count, 3);
    assertEquals(tele.cold_peer_count, 1);
    assertEquals(tele.due_peer_count, 1); // PEER_C
    assertEquals(tele.envelope_count, 1);
    assertEquals(tele.total_pending_frames, frames.length);
    assertEquals(tele.abandoned_sequence_count, 0);
});

Deno.test("schema constant", () => {
    assertEquals(COORDINATOR_SCHEMA, "OMEGA-1340/v1");
});
