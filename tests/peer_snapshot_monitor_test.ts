// Peer Snapshot Monitor tests.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import {
  PeerSnapshotMonitor,
  snapshotFromDigest,
} from "../src/network/peer_snapshot_monitor.ts";
import { ConvergenceDetector } from "../src/network/convergence_detector.ts";
import {
  buildHeartbeat,
  buildSnapshotDigest,
  buildWarrantVote,
  FRAME_TYPE_HEARTBEAT,
  FRAME_TYPE_SNAPSHOT_DIGEST,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_LEGACY_V1_0 } from "../src/network/genesis_inscription.ts";

const NOW = 100_000;

function selfWith(rate_double: number, total: number): ConvergenceDetector {
  const cd = new ConvergenceDetector();
  // Generate `total` intents, with `rate_double` of them double-witnessed.
  for (let i = 0; i < total; i++) {
    const wv = buildWarrantVote((0xAA00 + i) >>> 0, 0, true, i);
    cd.observe(wv, "spore-A", NOW + i);
    if (i < rate_double) {
      cd.observe(wv, "spore-B", NOW + i + 1);
    }
  }
  return cd;
}

Deno.test("monitor: rejects non-digest frame", async () => {
  const cd = new ConvergenceDetector();
  const m = new PeerSnapshotMonitor(cd);
  const hb = buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1);
  assertThrows(() => m.observe(hb, NOW));
});

Deno.test("monitor: agreeing peer is NOT partition-suspected", async () => {
  // Self has 60/100 double-witness. Peer reports the same.
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  // 60/100 → 39322 Q16
  const digest = buildSnapshotDigest(0xAAAA, 100, 60, 39322, NOW);
  const rec = m.observe(digest, NOW);
  assertEquals(rec.partition_suspected, false);
});

Deno.test("monitor: divergent peer IS partition-suspected", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  // Peer reports 0/100 → 0 Q16; self is 39322.
  const digest = buildSnapshotDigest(0xBBBB, 100, 0, 0, NOW);
  const rec = m.observe(digest, NOW);
  assertEquals(rec.partition_suspected, true);
  assert(rec.diff_q16 >= 6553);
});

Deno.test("monitor: alarm fires once per partition observation", async () => {
  let alarms_fired = 0;
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd, {
    on_alarm: () => {
      alarms_fired++;
    },
  });
  m.observe(buildSnapshotDigest(0xBBBB, 100, 0, 0, NOW), NOW);
  assertEquals(alarms_fired, 1);
  assertEquals(m.alarms.length, 1);
});

Deno.test("monitor: empty self detector does not flag partition", async () => {
  const cd = new ConvergenceDetector();
  const m = new PeerSnapshotMonitor(cd);
  const digest = buildSnapshotDigest(0xAAAA, 100, 80, 52429, NOW);
  const rec = m.observe(digest, NOW);
  // Self has zero data; partition flag requires both sides observable.
  assertEquals(rec.partition_suspected, false);
  assertEquals(m.alarms.length, 0);
});

Deno.test("monitor: empty peer digest does not flag partition", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  // Peer reports nothing — total=0.
  const digest = buildSnapshotDigest(0xCCCC, 0, 0, 0, NOW);
  const rec = m.observe(digest, NOW);
  assertEquals(rec.partition_suspected, false);
});

Deno.test("monitor: snapshot lists all observed peers", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  m.observe(buildSnapshotDigest(0x1111, 100, 60, 39322, NOW), NOW);
  m.observe(buildSnapshotDigest(0x2222, 100, 50, 32768, NOW + 100), NOW + 100);
  m.observe(buildSnapshotDigest(0x3333, 100, 0, 0, NOW + 200), NOW + 200);
  assertEquals(m.snapshot().length, 3);
});

Deno.test("monitor: suspectedPartitions returns only flagged peers", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  m.observe(buildSnapshotDigest(0xAAAA, 100, 60, 39322, NOW), NOW); // healthy
  m.observe(buildSnapshotDigest(0xBBBB, 100, 0, 0, NOW + 100), NOW); // forked
  const sus = m.suspectedPartitions();
  assertEquals(sus.length, 1);
  assertEquals(sus[0].relay_id, 0xBBBB);
});

Deno.test("monitor: capacity bound evicts oldest peer", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd, { capacity: 2 });
  m.observe(buildSnapshotDigest(1, 100, 60, 39322, NOW), NOW);
  m.observe(buildSnapshotDigest(2, 100, 60, 39322, NOW + 10), NOW + 10);
  m.observe(buildSnapshotDigest(3, 100, 60, 39322, NOW + 20), NOW + 20);
  const ids = m.snapshot().map((s) => s.relay_id).sort();
  assertEquals(ids, [2, 3]);
});

Deno.test("monitor: re-observing same peer updates record without growing", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  m.observe(buildSnapshotDigest(0xAAAA, 100, 60, 39322, NOW), NOW);
  m.observe(buildSnapshotDigest(0xAAAA, 200, 100, 32768, NOW + 100), NOW + 100);
  assertEquals(m.snapshot().length, 1);
  const rec = m.snapshot()[0];
  assertEquals(rec.digest.totalIntents, 200);
});

Deno.test("monitor: snapshotFromDigest reconstructs total/double/single", async () => {
  const digest = buildSnapshotDigest(0xAA, 100, 60, 39322, NOW);
  const reconstructed = snapshotFromDigest(digest);
  assertEquals(reconstructed.totalIntents, 100);
  assertEquals(reconstructed.doubleWitness, 60);
  assertEquals(reconstructed.singleWitness, 40); // total - double
  assertEquals(reconstructed.triplePlus, 0); // not transported in digest
});

Deno.test("monitor: clear empties peers and alarms", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  m.observe(buildSnapshotDigest(0xAA, 100, 0, 0, NOW), NOW);
  assert(m.alarms.length > 0);
  m.clear();
  assertEquals(m.snapshot().length, 0);
  assertEquals(m.alarms.length, 0);
});

Deno.test("monitor: invalid capacity throws", async () => {
  const cd = new ConvergenceDetector();
  assertThrows(() => new PeerSnapshotMonitor(cd, { capacity: 0 }));
});

Deno.test("monitor: digest frameType constant matches Rust", async () => {
  assertEquals(FRAME_TYPE_SNAPSHOT_DIGEST, 5);
});

Deno.test("monitor: alarm carries diff_percent for human display", async () => {
  const cd = selfWith(60, 100);
  const m = new PeerSnapshotMonitor(cd);
  m.observe(buildSnapshotDigest(0xBBBB, 100, 0, 0, NOW), NOW);
  const alarm = m.recentAlarms(1)[0];
  assert(alarm.diff_percent.endsWith("%"));
  assertEquals(alarm.relay_id, 0xBBBB);
});
