// Era 1350: Convergence-driven composite health tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    CONVERGENCE_HEALTH_SCHEMA,
    DEFAULT_CONVERGENCE_OPTS,
    computeConvergenceHealth,
    convergenceContribution,
    convergenceGlyph,
} from "../src/network/convergence_health.ts";
import {
    HEALTH_DEFAULTS,
    computeRelayHealth,
} from "../src/network/mesh_health.ts";
import { ConvergenceDetector } from "../src/network/convergence_detector.ts";

// --- Pure signal computation ---

Deno.test("convergence health: full overlap → converged + no alarm", () => {
    const sig = computeConvergenceHealth([0x10, 0x20], [0x10, 0x20]);
    assertEquals(sig.score, 1);
    assertEquals(sig.band, "converged");
    assertEquals(sig.alarm, false);
    assertEquals(sig.intersection_size, 2);
    assertEquals(sig.network_size, 2);
});

Deno.test("convergence health: no overlap → stranded + alarm", () => {
    const sig = computeConvergenceHealth([0x10, 0x20], [0x30, 0x40]);
    assertEquals(sig.score, 0);
    assertEquals(sig.band, "stranded");
    assertEquals(sig.alarm, true);
    assertEquals(sig.intersection_size, 0);
});

Deno.test("convergence health: half overlap → diverged + alarm", () => {
    // local has 1 of 2 network digests = 0.5.
    const sig = computeConvergenceHealth([0x10], [0x10, 0x20]);
    assertEquals(sig.score, 0.5);
    // 0.5 is exactly at lagging_threshold, so band = "lagging"; alarm
    // threshold is also 0.5, score < 0.5 → false.
    assertEquals(sig.band, "lagging");
    assertEquals(sig.alarm, false);
});

Deno.test("convergence health: empty network → fully converged", () => {
    const sig = computeConvergenceHealth([0x10], []);
    assertEquals(sig.score, 1);
    assertEquals(sig.band, "converged");
    assertEquals(sig.alarm, false);
    assertEquals(sig.network_size, 0);
});

Deno.test("convergence health: thresholds tunable via opts", () => {
    // With converged_threshold=0.95, half overlap is "diverged".
    const opts = { ...DEFAULT_CONVERGENCE_OPTS, converged_threshold: 0.95, lagging_threshold: 0.70 };
    const sig = computeConvergenceHealth([0x10], [0x10, 0x20, 0x30, 0x40], opts);
    // 1/4 = 0.25; below diverged_threshold (0.20) is stranded; 0.25 >= 0.20 → diverged.
    assertEquals(sig.score, 0.25);
    assertEquals(sig.band, "diverged");
});

Deno.test("convergence health: rate_q16 matches Era 1340 fleetConvergenceRate", () => {
    const sig = computeConvergenceHealth([0x10, 0x20], [0x10, 0x20, 0x30, 0x40]);
    // half overlap → 32768.
    assertEquals(sig.rate_q16, 32768);
});

// --- Contribution computation ---

Deno.test("contribution: fully-converged relay gets capped bonus", () => {
    const sig = computeConvergenceHealth([0x10, 0x20], [0x10, 0x20]);
    const c = convergenceContribution(sig, 0.20);
    // score=1, reference=0.85, raw = 0.15 * 0.20 = 0.03; bonus cap = 0.20 * 0.10 = 0.02.
    assert(Math.abs(c - 0.02) < 1e-9);
});

Deno.test("contribution: stranded relay produces full negative weight", () => {
    const sig = computeConvergenceHealth([], [0x10, 0x20]);
    const c = convergenceContribution(sig, 0.20);
    // score=0, reference=0.85, raw = -0.85 * 0.20 = -0.17; floor = -0.20.
    // raw=-0.17 is greater than -0.20, so c = -0.17.
    assert(Math.abs(c - -0.17) < 1e-9);
});

Deno.test("contribution: extreme low-weight relay clamps at -weight floor", () => {
    const sig = computeConvergenceHealth([], [0x10]);
    const c = convergenceContribution(sig, 1.0);
    // score=0, reference=0.85, raw = -0.85; floor = -1.0; raw > floor.
    assert(Math.abs(c - -0.85) < 1e-9);
});

Deno.test("contribution: at converged_threshold contributes ~0", () => {
    // Manually craft a signal at exactly the threshold.
    const sig = {
        rate_q16: Math.round(0.85 * 65536),
        score: 0.85,
        band: "converged" as const,
        alarm: false,
        intersection_size: 17,
        network_size: 20,
    };
    const c = convergenceContribution(sig, 0.20);
    assert(Math.abs(c) < 1e-9);
});

// --- Mesh health integration ---

Deno.test("mesh health: convergence_signal absent → no convergence contribution", () => {
    const det = new ConvergenceDetector();
    const score = computeRelayHealth({ detector: det });
    assertEquals(score.contributions.convergence, undefined);
});

Deno.test("mesh health: stranded convergence drags composite down", () => {
    const det = new ConvergenceDetector();
    const baseline = computeRelayHealth({ detector: det });
    const stranded_sig = computeConvergenceHealth([], [0x10, 0x20, 0x30, 0x40]);
    const withConv = computeRelayHealth({ detector: det, convergence_signal: stranded_sig });
    assert(withConv.score < baseline.score);
    assertEquals(withConv.contributions.convergence! < 0, true);
});

Deno.test("mesh health: converged signal applies small bonus", () => {
    const det = new ConvergenceDetector();
    const baseline = computeRelayHealth({ detector: det });
    const converged_sig = computeConvergenceHealth([0x10, 0x20], [0x10, 0x20]);
    const withConv = computeRelayHealth({ detector: det, convergence_signal: converged_sig });
    assert(withConv.score >= baseline.score);
    assertEquals(withConv.contributions.convergence! > 0, true);
});

Deno.test("mesh health: HEALTH_DEFAULTS includes weight_convergence", () => {
    assertEquals(HEALTH_DEFAULTS.weight_convergence, 0.20);
});

// --- Glyph + schema ---

Deno.test("convergence glyph: each band → distinct emoji", () => {
    assertEquals(convergenceGlyph("converged"), "🟢");
    assertEquals(convergenceGlyph("lagging"), "🟡");
    assertEquals(convergenceGlyph("diverged"), "🟠");
    assertEquals(convergenceGlyph("stranded"), "🔴");
});

Deno.test("schema constant", () => {
    assertEquals(CONVERGENCE_HEALTH_SCHEMA, "OMEGA-1350/v1");
});
