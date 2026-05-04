// Era 1250: Composite Health Broadcast + Peer Monitor tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    CompositeHealthMonitor,
    META_PARTITION_THRESHOLD_Q16,
    bandToCode,
    codeToBand,
    compositeFromFrame,
} from "../src/network/composite_monitor.ts";
import {
    FRAME_TYPE_COMPOSITE_HEALTH,
    FRAME_TYPE_HEARTBEAT,
    buildCompositeHealth,
    buildHeartbeat,
    frameFromBytes,
    frameToBytes,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_LEGACY_V1_0 } from "../src/network/genesis_inscription.ts";
import type { CompositeScore, HealthBand } from "../src/network/mesh_health.ts";

const NOW = 100_000;

function localScore(score: number, band: HealthBand = "healthy"): CompositeScore {
    return {
        score,
        band,
        contributions: {
            redundancy: score,
            partition_alarms: 0,
            consensus_suspects: 0,
            quarantines: 0,
        },
    };
}

const Q16 = (s: number) => Math.round(s * 65536);

Deno.test("composite: band <-> code round-trips", async () => {
    for (const b of ["healthy", "watch", "degraded", "critical"] as HealthBand[]) {
        assertEquals(codeToBand(bandToCode(b)), b);
    }
});

Deno.test("composite: codeToBand handles unknown codes safely", async () => {
    assertEquals(codeToBand(0xFF), "critical");
    assertEquals(codeToBand(99), "critical");
});

Deno.test("composite: frame round-trips bit-for-bit", async () => {
    const f = buildCompositeHealth(
        0xAAAA, Q16(0.78), bandToCode("healthy"),
        2, 1, 0, Q16(0.55), 100,
    );
    const bytes = frameToBytes(f);
    const parsed = frameFromBytes(bytes);
    assert(parsed !== null);
    assertEquals(parsed!.frameType, FRAME_TYPE_COMPOSITE_HEALTH);
    const decoded = compositeFromFrame(parsed!);
    assert(decoded !== null);
    assertEquals(decoded!.relay_id, 0xAAAA);
    assertEquals(decoded!.alarm_count, 2);
    assertEquals(decoded!.suspect_count, 1);
    assertEquals(decoded!.quarantine_count, 0);
    assertEquals(decoded!.band, "healthy");
    assert(Math.abs(decoded!.score - 0.78) < 1 / 65536);
});

Deno.test("composite: u8 clamping on counts", async () => {
    const f = buildCompositeHealth(
        0xAAAA, Q16(0.5), bandToCode("watch"),
        300, 999, -5, Q16(0.5), 0,
    );
    const decoded = compositeFromFrame(f)!;
    assertEquals(decoded.alarm_count, 255);
    assertEquals(decoded.suspect_count, 255);
    assertEquals(decoded.quarantine_count, 0);
});

Deno.test("composite: compositeFromFrame rejects non-composite frames", async () => {
    const hb = buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1);
    assertEquals(compositeFromFrame(hb), null);
});

Deno.test("monitor: agreeing peers do not flag meta-partition", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.78));
    const f = buildCompositeHealth(0xAAAA, Q16(0.79), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0);
    const rec = m.observe(f, NOW);
    assertEquals(rec.meta_partition_suspected, false);
    assertEquals(m.alarms.length, 0);
});

Deno.test("monitor: divergent peer triggers meta-partition alarm", async () => {
    let alarms_fired = 0;
    const m = new CompositeHealthMonitor(
        () => localScore(0.85, "healthy"),
        { on_meta_alarm: () => { alarms_fired++; } },
    );
    const f = buildCompositeHealth(0xBBBB, Q16(0.30), bandToCode("degraded"), 5, 2, 1, Q16(0.10), 0);
    const rec = m.observe(f, NOW);
    assertEquals(rec.meta_partition_suspected, true);
    assertEquals(alarms_fired, 1);
    assertEquals(m.alarms.length, 1);
    assertEquals(m.alarms[0].self_band, "healthy");
    assertEquals(m.alarms[0].peer_band, "degraded");
});

Deno.test("monitor: rejects non-composite frame types", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.78));
    const hb = buildHeartbeat(GENESIS_HASH_LEGACY_V1_0, 1);
    assertThrows(() => m.observe(hb, NOW));
});

Deno.test("monitor: threshold exact-boundary triggers alarm", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.50));
    // Self Q16 = 32768. Peer Q16 = 32768 + threshold = 32768 + 13107 = 45875.
    const peer_q16 = 32768 + META_PARTITION_THRESHOLD_Q16;
    const f = buildCompositeHealth(0xAAAA, peer_q16, bandToCode("healthy"), 0, 0, 0, peer_q16, 0);
    const rec = m.observe(f, NOW);
    assertEquals(rec.meta_partition_suspected, true);
});

Deno.test("monitor: just-below threshold does not trigger", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.50));
    const peer_q16 = 32768 + META_PARTITION_THRESHOLD_Q16 - 1;
    const f = buildCompositeHealth(0xAAAA, peer_q16, bandToCode("healthy"), 0, 0, 0, peer_q16, 0);
    const rec = m.observe(f, NOW);
    assertEquals(rec.meta_partition_suspected, false);
});

Deno.test("monitor: capacity bound evicts oldest peer", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.78), { capacity: 2 });
    m.observe(buildCompositeHealth(1, Q16(0.78), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0), NOW);
    m.observe(buildCompositeHealth(2, Q16(0.78), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0), NOW + 10);
    m.observe(buildCompositeHealth(3, Q16(0.78), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0), NOW + 20);
    const ids = m.snapshot().map(r => r.relay_id).sort((a, b) => a - b);
    assertEquals(ids, [2, 3]);
});

Deno.test("monitor: re-observing same relay updates without growing", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.78));
    m.observe(buildCompositeHealth(0xAAAA, Q16(0.78), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0), NOW);
    m.observe(buildCompositeHealth(0xAAAA, Q16(0.65), bandToCode("watch"), 1, 0, 0, Q16(0.50), 0), NOW + 100);
    assertEquals(m.snapshot().length, 1);
    const rec = m.snapshot()[0];
    assertEquals(rec.band, "watch");
    assertEquals(rec.alarm_count, 1);
});

Deno.test("monitor: suspectedMetaPartitions filters correctly", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.85, "healthy"));
    m.observe(buildCompositeHealth(0xAAAA, Q16(0.86), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0), NOW); // agree
    m.observe(buildCompositeHealth(0xBBBB, Q16(0.30), bandToCode("degraded"), 0, 0, 0, Q16(0.10), 0), NOW + 100); // diverge
    const sus = m.suspectedMetaPartitions();
    assertEquals(sus.length, 1);
    assertEquals(sus[0].relay_id, 0xBBBB);
});

Deno.test("monitor: summaryLine handles empty snapshot", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.78));
    assertEquals(m.summaryLine(), "(no peers reporting composite health)");
});

Deno.test("monitor: summaryLine renders peers with glyphs", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.85));
    m.observe(buildCompositeHealth(0x100, Q16(0.85), bandToCode("healthy"), 0, 0, 0, Q16(0.55), 0), NOW);
    m.observe(buildCompositeHealth(0x200, Q16(0.30), bandToCode("degraded"), 0, 0, 0, Q16(0.10), 0), NOW);
    const line = m.summaryLine();
    assert(line.includes("🟢"));
    assert(line.includes("🟠"));
    assert(line.includes("⚠")); // 0x200 should be flagged
});

Deno.test("monitor: clear empties everything", async () => {
    const m = new CompositeHealthMonitor(() => localScore(0.85));
    m.observe(buildCompositeHealth(1, Q16(0.30), bandToCode("degraded"), 0, 0, 0, Q16(0.10), 0), NOW);
    m.clear();
    assertEquals(m.snapshot().length, 0);
    assertEquals(m.alarms.length, 0);
});

Deno.test("monitor: invalid capacity throws", async () => {
    assertThrows(() => new CompositeHealthMonitor(() => localScore(0.78), { capacity: 0 }));
});

Deno.test("monitor: META_PARTITION_THRESHOLD_Q16 ≈ 0.20", async () => {
    const ratio = META_PARTITION_THRESHOLD_Q16 / 65536;
    assert(Math.abs(ratio - 0.20) < 0.001);
});

Deno.test("monitor: redundancy_contrib decoded correctly", async () => {
    const f = buildCompositeHealth(0xAAAA, Q16(0.78), bandToCode("healthy"), 0, 0, 0, Q16(0.42), 0);
    const decoded = compositeFromFrame(f)!;
    assert(Math.abs(decoded.redundancy_contrib - 0.42) < 1 / 65536);
});

Deno.test("composite: HEARTBEAT vs COMPOSITE_HEALTH have different frame_type", async () => {
    assertEquals(FRAME_TYPE_COMPOSITE_HEALTH, 6);
    assertEquals(FRAME_TYPE_HEARTBEAT, 3);
});
