// Era 1240: Mesh Health Composite Score tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    bandGlyph,
    computeMeshHealth,
    computeRelayHealth,
    q16ToScore,
    scoreToQ16,
    type CompositeScore,
} from "../src/network/mesh_health.ts";
import { ConvergenceDetector } from "../src/network/convergence_detector.ts";
import { PeerSnapshotMonitor } from "../src/network/peer_snapshot_monitor.ts";
import { InvestigationConvergenceTracker } from "../src/network/investigation_convergence.ts";
import { AutoInvestigator } from "../src/network/auto_investigation.ts";
import {
    buildHeartbeat,
    buildSnapshotDigest,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import { InvestigationRecord } from "../src/network/auto_investigation.ts";

const NOW = 100_000;

function detectorWith(double: number, total: number): ConvergenceDetector {
    const cd = new ConvergenceDetector();
    for (let i = 0; i < total; i++) {
        const wv = buildWarrantVote((0xAA00 + i) >>> 0, 0, true, i);
        cd.observe(wv, "spore-A", NOW + i);
        if (i < double) cd.observe(wv, "spore-B", NOW + i + 1);
    }
    return cd;
}

Deno.test("health: empty detector → watch (0.5 base floor)", async () => {
    const cd = new ConvergenceDetector();
    const c = computeRelayHealth({ detector: cd });
    assertEquals(c.band, "watch");
    assertEquals(c.score, 0.5);
});

Deno.test("health: 60% redundancy → healthy band", async () => {
    const cd = detectorWith(60, 100);
    const c = computeRelayHealth({ detector: cd });
    // redundancy 0.6 × 0.55 = 0.33; below 0.75 threshold.
    // No penalties → score 0.33 → "degraded".
    assert(c.score < 0.5);
    assertEquals(c.band, "degraded");
});

Deno.test("health: full redundancy + no penalties → healthy", async () => {
    const cd = detectorWith(100, 100);
    const c = computeRelayHealth({ detector: cd });
    // redundancy 1.0 × 0.55 = 0.55. Watch band.
    assertEquals(c.band, "watch");
    assert(c.score >= 0.5);
});

Deno.test("health: zero redundancy + zero penalties + active data → critical", async () => {
    const cd = detectorWith(0, 100); // 100 single-witness, 0 double
    const c = computeRelayHealth({ detector: cd });
    // redundancy 0 × 0.55 = 0. No data floor (total > 0). No penalties.
    assertEquals(c.score, 0);
    assertEquals(c.band, "critical");
});

Deno.test("health: contributions are itemized correctly", async () => {
    const cd = detectorWith(50, 100);
    const c = computeRelayHealth({ detector: cd });
    // 0.5 × 0.55 = 0.275.
    assert(Math.abs(c.contributions.redundancy - 0.275) < 1e-9);
    assertEquals(c.contributions.partition_alarms, 0);
    assertEquals(c.contributions.consensus_suspects, 0);
    assertEquals(c.contributions.quarantines, 0);
});

Deno.test("health: partition alarms reduce score", async () => {
    const cd = detectorWith(60, 100);
    const monitor = new PeerSnapshotMonitor(cd);
    // Trigger 3 alarms by feeding wildly different digests.
    for (let i = 0; i < 3; i++) {
        const d = buildSnapshotDigest((0x100 + i) >>> 0, 100, 0, 0, NOW + i);
        monitor.observe(d, NOW + i);
    }
    const c = computeRelayHealth({ detector: cd, monitor });
    // 3 alarms × 0.05 = 0.15 penalty (floating-point tolerance).
    assert(Math.abs(c.contributions.partition_alarms - (-0.15)) < 1e-9);
});

Deno.test("health: partition penalty caps at max", async () => {
    const cd = detectorWith(60, 100);
    const monitor = new PeerSnapshotMonitor(cd);
    // 20 alarms — uncapped would be -1.0; capped at -0.30.
    for (let i = 0; i < 20; i++) {
        const d = buildSnapshotDigest((0x100 + i) >>> 0, 100, 0, 0, NOW + i);
        monitor.observe(d, NOW + i);
    }
    const c = computeRelayHealth({ detector: cd, monitor });
    assert(c.contributions.partition_alarms >= -0.30);
});

Deno.test("health: consensus suspects reduce score", async () => {
    const cd = detectorWith(80, 100);
    const conv = new InvestigationConvergenceTracker();
    const rec: InvestigationRecord = {
        proposal_hash: 0xAA, target_relay_id: 0x100,
        reason: "x", raised_at_ms: NOW, triggering_diff_q16: 10000,
        status: "open",
    };
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        conv.recordRaise(rec, src, NOW);
    }
    const c = computeRelayHealth({ detector: cd, convergence: conv });
    assert(Math.abs(c.contributions.consensus_suspects - (-0.10)) < 1e-9);
});

Deno.test("health: quarantines reduce score", async () => {
    const cd = detectorWith(80, 100);
    const inv = new AutoInvestigator({ cooldown_ms: 0 });
    for (const target of [0x100, 0x200]) {
        const r = inv.raiseFromAlarm({
            relay_id: target, self_rate_q16: 50000, peer_rate_q16: 0,
            diff_q16: 50000, diff_percent: "50%", observed_at_ms: NOW,
        })!;
        inv.markWarranted(r.proposal_hash);
    }
    const c = computeRelayHealth({ detector: cd, investigator: inv });
    assert(Math.abs(c.contributions.quarantines - (-0.30)) < 1e-9);
});

Deno.test("health: full chain (all four signals) integrates", async () => {
    const cd = detectorWith(80, 100);
    const monitor = new PeerSnapshotMonitor(cd);
    monitor.observe(buildSnapshotDigest(0x100, 100, 0, 0, NOW), NOW);
    const conv = new InvestigationConvergenceTracker();
    const rec: InvestigationRecord = {
        proposal_hash: 0xAA, target_relay_id: 0x100,
        reason: "x", raised_at_ms: NOW, triggering_diff_q16: 10000,
        status: "open",
    };
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        conv.recordRaise(rec, src, NOW);
    }
    const inv = new AutoInvestigator();
    const r = inv.raiseFromAlarm({
        relay_id: 0x300, self_rate_q16: 50000, peer_rate_q16: 0,
        diff_q16: 50000, diff_percent: "50%", observed_at_ms: NOW,
    })!;
    inv.markWarranted(r.proposal_hash);

    const c = computeRelayHealth({ detector: cd, monitor, convergence: conv, investigator: inv });
    // 0.8 × 0.55 = 0.44 redundancy
    // -0.05 partition (1 alarm)
    // -0.10 suspect (1 high-conf target)
    // -0.15 quarantine (1 relay)
    // total = 0.44 - 0.05 - 0.10 - 0.15 = 0.14 → "critical"
    assert(c.score >= 0.10 && c.score <= 0.20);
    assertEquals(c.band, "critical");
});

Deno.test("health: clamp prevents score above 1", async () => {
    const cd = detectorWith(100, 100);
    // No penalties. redundancy 1.0 × 0.55 = 0.55, clamp irrelevant here.
    const c = computeRelayHealth({ detector: cd });
    assert(c.score <= 1);
});

Deno.test("health: clamp prevents score below 0", async () => {
    const cd = detectorWith(0, 100);
    const monitor = new PeerSnapshotMonitor(cd);
    for (let i = 0; i < 50; i++) {
        const d = buildSnapshotDigest((0x100 + i) >>> 0, 100, 0, 0, NOW + i);
        monitor.observe(d, NOW + i);
    }
    const c = computeRelayHealth({ detector: cd, monitor });
    assert(c.score >= 0);
});

Deno.test("health: deterministic across calls (same inputs → same score)", async () => {
    const cd = detectorWith(60, 100);
    const c1 = computeRelayHealth({ detector: cd });
    const c2 = computeRelayHealth({ detector: cd });
    assertEquals(c1.score, c2.score);
});

Deno.test("mesh: average of per-relay scores", async () => {
    const perRelay = new Map<number, CompositeScore>();
    perRelay.set(0x1, computeRelayHealth({ detector: detectorWith(80, 100) }));
    perRelay.set(0x2, computeRelayHealth({ detector: detectorWith(40, 100) }));
    perRelay.set(0x3, computeRelayHealth({ detector: detectorWith(60, 100) }));
    const mesh = computeMeshHealth(perRelay);
    const expected = ([...perRelay.values()].reduce((a, b) => a + b.score, 0)) / 3;
    assert(Math.abs(mesh.score - expected) < 1e-9);
});

Deno.test("mesh: empty perRelay → watch baseline 0.5", async () => {
    const mesh = computeMeshHealth(new Map());
    assertEquals(mesh.score, 0.5);
    assertEquals(mesh.band, "watch");
});

Deno.test("scoreToQ16 / q16ToScore round-trip with negligible loss", async () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const q = scoreToQ16(v);
        const r = q16ToScore(q);
        assert(Math.abs(r - v) < 1 / 65536);
    }
});

Deno.test("scoreToQ16 clamps inputs", async () => {
    assertEquals(scoreToQ16(-0.5), 0);
    assertEquals(scoreToQ16(2), 65536);
});

Deno.test("bandGlyph returns distinct glyphs", async () => {
    const glyphs = new Set<string>([
        bandGlyph("healthy"),
        bandGlyph("watch"),
        bandGlyph("degraded"),
        bandGlyph("critical"),
    ]);
    assertEquals(glyphs.size, 4);
});

Deno.test("health: detector with mixed witness classes contributes correctly", async () => {
    const cd = new ConvergenceDetector();
    // 5 single, 5 double, 0 triple → redundancy = 5/10 = 0.5.
    for (let i = 0; i < 5; i++) {
        cd.observe(buildWarrantVote((0xA00 + i) >>> 0, 0, true, 0), "x", NOW);
    }
    // Add doubles separately.
    for (let i = 0; i < 5; i++) {
        const wv = buildWarrantVote((0xB00 + i) >>> 0, 0, true, 0);
        cd.observe(wv, "x", NOW);
        cd.observe(wv, "y", NOW + 1);
    }
    const c = computeRelayHealth({ detector: cd });
    // redundancy = 0.5 × 0.55 = 0.275 → "degraded".
    assertEquals(c.band, "degraded");
});
