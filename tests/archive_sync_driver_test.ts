// Era 1330: Sync scheduler + retransmission driver tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    DEFAULT_RETRANSMIT_CONFIG,
    DEFAULT_SCHEDULER_CONFIG,
    DRIVER_SCHEMA,
    decideAction,
    ingestFrames,
    initPeerSyncState,
    isPeerCold,
    makePendingEnvelope,
    recordRetransmitRequest,
    recordSyncAttempt,
    recordSyncFailure,
    recordSyncSuccess,
    shouldSyncNow,
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
const SENDER = 0xCC02;

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

function deltaFor(a_records: ArchivedVerdict[], b_records: ArchivedVerdict[]) {
    const a_list = buildDigestList({
        schema: ARCHIVE_SCHEMA_VERSION,
        archive_hash: 0, archive_hash_hex: "",
        exported_at_ms: T0, record_count: a_records.length,
        min_digest_hex: "", max_digest_hex: "", records: a_records,
    }, T0);
    return computeDelta(a_list, b_records, T0 + 1);
}

// ---------- SCHEDULER ----------

Deno.test("scheduler: fresh peer should sync immediately", async () => {
    const s = initPeerSyncState(0xAA);
    assertEquals(shouldSyncNow(s, T0), true);
});

Deno.test("scheduler: success defers next attempt by base interval", async () => {
    let s = initPeerSyncState(0xAA);
    s = recordSyncAttempt(s, T0);
    s = recordSyncSuccess(s, DEFAULT_SCHEDULER_CONFIG, T0);
    assertEquals(shouldSyncNow(s, T0 + 1000), false);
    assertEquals(shouldSyncNow(s, T0 + DEFAULT_SCHEDULER_CONFIG.base_interval_ms), true);
});

Deno.test("scheduler: failure applies exponential backoff", async () => {
    let s = initPeerSyncState(0xAA);
    const cfg = { ...DEFAULT_SCHEDULER_CONFIG, base_interval_ms: 1000, backoff_multiplier: 2, max_backoff_ms: 60_000 };
    s = recordSyncAttempt(s, T0);
    s = recordSyncFailure(s, cfg, T0);
    // After 1 failure: base_interval * 2 = 2000ms.
    assertEquals(shouldSyncNow(s, T0 + 1999), false);
    assertEquals(shouldSyncNow(s, T0 + 2000), true);

    s = recordSyncAttempt(s, T0 + 2000);
    s = recordSyncFailure(s, cfg, T0 + 2000);
    // After 2 failures: 1000 * 2 * 2 = 4000ms from T0+2000.
    assertEquals(shouldSyncNow(s, T0 + 2000 + 3999), false);
    assertEquals(shouldSyncNow(s, T0 + 2000 + 4000), true);
});

Deno.test("scheduler: backoff caps at max_backoff_ms", async () => {
    let s = initPeerSyncState(0xAA);
    const cfg = { ...DEFAULT_SCHEDULER_CONFIG, base_interval_ms: 1000, backoff_multiplier: 10, max_backoff_ms: 5000 };
    let now = T0;
    for (let i = 0; i < 5; i++) {
        s = recordSyncAttempt(s, now);
        s = recordSyncFailure(s, cfg, now);
        now += 5000;
    }
    // Backoff should never push next_attempt_ms more than max_backoff_ms ahead.
    assert(s.next_attempt_ms - now <= 5000);
});

Deno.test("scheduler: success resets failure counter", async () => {
    let s = initPeerSyncState(0xAA);
    s = recordSyncFailure(s, DEFAULT_SCHEDULER_CONFIG, T0);
    s = recordSyncFailure(s, DEFAULT_SCHEDULER_CONFIG, T0 + 100);
    assertEquals(s.consecutive_failures, 2);
    s = recordSyncSuccess(s, DEFAULT_SCHEDULER_CONFIG, T0 + 200);
    assertEquals(s.consecutive_failures, 0);
});

Deno.test("scheduler: isPeerCold triggers after configured failure count", async () => {
    let s = initPeerSyncState(0xAA);
    const cfg = { ...DEFAULT_SCHEDULER_CONFIG, failure_giveup_count: 3 };
    assertEquals(isPeerCold(s, cfg), false);
    for (let i = 0; i < 3; i++) {
        s = recordSyncFailure(s, cfg, T0 + i * 100);
    }
    assertEquals(isPeerCold(s, cfg), true);
});

// ---------- RETRANSMISSION DRIVER ----------

Deno.test("driver: ingestFrames merges new frames, dedups by sequence", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, [frames[0]], T0 + 100);
    env = ingestFrames(env, [frames[0], frames[1]], T0 + 200);
    env = ingestFrames(env, [frames[2]], T0 + 300);
    assertEquals(env.frames_by_sequence.size, 3);
});

Deno.test("driver: ingestFrames filters frames from other envelopes", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const c = archiveWith([0x10, 0x40]);
    const deltaB = deltaFor(a, b);
    const deltaC = deltaFor(a, c);
    const framesB = chunkDelta(deltaB, SENDER);
    const framesC = chunkDelta(deltaC, 0xCC03);
    let env = makePendingEnvelope(deltaB.delta_hash, T0);
    env = ingestFrames(env, [...framesB, ...framesC], T0 + 100);
    assertEquals(env.frames_by_sequence.size, framesB.length);
});

Deno.test("driver: complete action when all frames received", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, frames, T0 + 50);
    const action = decideAction(env, DEFAULT_RETRANSMIT_CONFIG, T0 + 100);
    assertEquals(action.kind, "complete");
    if (action.kind === "complete") {
        assertEquals(action.delta.missing_records.length, 2);
    }
});

Deno.test("driver: retransmit action lists missing sequences (no cooldown)", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    // Drop frame for sequence 2.
    const partial = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 2);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, partial, T0 + 50);
    const action = decideAction(env, DEFAULT_RETRANSMIT_CONFIG, T0 + 100);
    assertEquals(action.kind, "retransmit");
    if (action.kind === "retransmit") {
        assertEquals(action.sequences, [2]);
    }
});

Deno.test("driver: cooldown blocks back-to-back retransmits", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    const partial = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 1);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, partial, T0 + 50);
    const cfg = { ...DEFAULT_RETRANSMIT_CONFIG, retransmit_cooldown_ms: 1000 };
    // First decision: retransmit allowed.
    let act = decideAction(env, cfg, T0 + 100);
    assertEquals(act.kind, "retransmit");
    // Record the request.
    env = recordRetransmitRequest(env, [1], cfg, T0 + 100);
    // Immediate next decision: cooldown blocks.
    act = decideAction(env, cfg, T0 + 200);
    assertEquals(act.kind, "wait");
    // After cooldown elapses: retransmit allowed again.
    act = decideAction(env, cfg, T0 + 1100);
    assertEquals(act.kind, "retransmit");
});

Deno.test("driver: per-sequence attempt cap → giveup once exhausted", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    const partial = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 1);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, partial, T0 + 10);
    const cfg = { ...DEFAULT_RETRANSMIT_CONFIG, retransmit_cooldown_ms: 0, max_attempts_per_sequence: 2 };
    // First retransmit OK.
    let act = decideAction(env, cfg, T0 + 100);
    assertEquals(act.kind, "retransmit");
    env = recordRetransmitRequest(env, [1], cfg, T0 + 100);
    // Second retransmit: still allowed (count=1 < 2 going in, becomes 2).
    act = decideAction(env, cfg, T0 + 200);
    assertEquals(act.kind, "retransmit");
    env = recordRetransmitRequest(env, [1], cfg, T0 + 200);
    // Third decision: sequence 1 has 2 attempts, abandoned. No eligible
    // sequences left → giveup.
    act = decideAction(env, cfg, T0 + 300);
    assertEquals(act.kind, "giveup");
    if (act.kind === "giveup") {
        assert(act.reason.includes("max_attempts_per_sequence"));
    }
});

Deno.test("driver: envelope_giveup_ms triggers full surrender", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    const partial = frames.filter((f) => ((f.reserved >>> 16) & 0xFFFF) !== 2);
    const cfg = { ...DEFAULT_RETRANSMIT_CONFIG, envelope_giveup_ms: 5000 };
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, partial, T0 + 100);
    const act = decideAction(env, cfg, T0 + 5500);
    assertEquals(act.kind, "giveup");
    if (act.kind === "giveup") {
        assert(act.reason.includes("envelope giveup"));
        assertEquals(act.partial_frame_count, partial.length);
    }
});

Deno.test("driver: recordRetransmitRequest abandons sequence at cap", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, b);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    const cfg = { ...DEFAULT_RETRANSMIT_CONFIG, max_attempts_per_sequence: 2 };
    env = recordRetransmitRequest(env, [1], cfg, T0 + 100);
    assertEquals(env.abandoned_sequences.has(1), false);
    env = recordRetransmitRequest(env, [1], cfg, T0 + 200);
    assertEquals(env.abandoned_sequences.has(1), true);
});

Deno.test("driver: ingestFrames updates last_progress_ms only when frames added", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20]);
    const delta = deltaFor(a, b);
    const frames = chunkDelta(delta, SENDER);
    let env = makePendingEnvelope(delta.delta_hash, T0);
    env = ingestFrames(env, [frames[0]], T0 + 100);
    assertEquals(env.last_progress_ms, T0 + 100);
    // Re-ingesting the same frame doesn't bump last_progress_ms.
    env = ingestFrames(env, [frames[0]], T0 + 200);
    assertEquals(env.last_progress_ms, T0 + 100);
    // A new frame does.
    env = ingestFrames(env, [frames[1]], T0 + 300);
    assertEquals(env.last_progress_ms, T0 + 300);
});

Deno.test("driver: full retransmit/recovery loop converges", async () => {
    const a = archiveWith([0x10]);
    const b = archiveWith([0x10, 0x20, 0x30, 0x40]);
    const delta = deltaFor(a, b);
    const all_frames = chunkDelta(delta, SENDER);
    const cfg = { ...DEFAULT_RETRANSMIT_CONFIG, retransmit_cooldown_ms: 0 };
    let env = makePendingEnvelope(delta.delta_hash, T0);
    // First arrival: header + frame[1] + frame[3] (sequence 1, 3).
    env = ingestFrames(env, [all_frames[0], all_frames[1], all_frames[3]], T0 + 100);
    let act = decideAction(env, cfg, T0 + 200);
    assertEquals(act.kind, "retransmit");
    if (act.kind === "retransmit") {
        assertEquals(act.sequences, [2]);
    }
    env = recordRetransmitRequest(env, [2], cfg, T0 + 200);
    // Retransmit arrives.
    env = ingestFrames(env, [all_frames[2]], T0 + 300);
    act = decideAction(env, cfg, T0 + 400);
    assertEquals(act.kind, "complete");
    if (act.kind === "complete") {
        assertEquals(act.delta.missing_records.length, 3);
    }
});

Deno.test("schema constant", async () => {
    assertEquals(DRIVER_SCHEMA, "OMEGA-1330/v1");
});
