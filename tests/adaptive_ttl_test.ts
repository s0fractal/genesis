// Era 1150: Adaptive TTL tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    MAX_TTL,
    MIN_TTL,
    adaptiveTtl,
    adaptiveTtlReport,
    marginHops,
    pathReliability,
    reliabilityOf,
} from "../src/network/adaptive_ttl.ts";
import { ReputationScore } from "../src/network/reputation_routing.ts";

function rep(id: string, score: number, health: ReputationScore["health"] = "healthy"): ReputationScore {
    return {
        spore_id: id,
        score,
        health,
        eligible: score > 0,
        breakdown: {},
    };
}

Deno.test("ttl: empty path → minTtl", async () => {
    assertEquals(adaptiveTtl([]), MIN_TTL);
});

Deno.test("ttl: reliabilityOf clamps to (0, 1]", async () => {
    assertEquals(reliabilityOf(0), 0);
    assertEquals(reliabilityOf(-5), 0);
    assertEquals(reliabilityOf(250), 1);
    assertEquals(reliabilityOf(500), 1); // clamp to 1
    assert(reliabilityOf(125) > 0 && reliabilityOf(125) < 1);
});

Deno.test("ttl: path of healthy spores → low margin, low TTL", async () => {
    // Three high-reputation spores → reliability ≈ (250/250)^3 = 1.
    const path = [rep("a", 200), rep("b", 200), rep("c", 200)];
    const ttl = adaptiveTtl(path);
    // path_length=3 + margin (small) + safety (1) → likely 4-6.
    assert(ttl >= 4 && ttl <= 6, `expected 4..6, got ${ttl}`);
});

Deno.test("ttl: path through marginal spores → larger margin", async () => {
    // Each spore is half-strength; reliability = 0.5^3 = 0.125, log2(8)=3.
    const path = [rep("a", 125), rep("b", 125), rep("c", 125)];
    const ttl = adaptiveTtl(path);
    // path_length=3 + margin=3 + safety=1 = 7.
    assertEquals(ttl, 7);
});

Deno.test("ttl: any zero-score hop → MAX_TTL", async () => {
    const path = [rep("good", 200), rep("forked", 0, "forked"), rep("good2", 200)];
    assertEquals(adaptiveTtl(path), MAX_TTL);
});

Deno.test("ttl: marginHops behaves correctly", async () => {
    assertEquals(marginHops(1), 0);
    assertEquals(marginHops(0.5), 1);
    assertEquals(marginHops(0.25), 2);
    assertEquals(marginHops(0.125), 3);
});

Deno.test("ttl: marginHops handles 0 and 1 boundaries", async () => {
    assert(!Number.isFinite(marginHops(0)));
    assertEquals(marginHops(1), 0);
});

Deno.test("ttl: pathReliability multiplies hops", async () => {
    const path = [rep("a", 200), rep("b", 200)];
    const expected = (200 / 250) * (200 / 250);
    const got = pathReliability(path);
    assert(Math.abs(got - expected) < 1e-9);
});

Deno.test("ttl: respects min/max bounds", async () => {
    // Force enormous safety hops — should clamp at maxTtl.
    const path = [rep("a", 200)];
    assertEquals(adaptiveTtl(path, { safetyHops: 100 }), MAX_TTL);
    // Force tiny path with low minTtl — clamped from below.
    const empty: ReputationScore[] = [];
    assertEquals(adaptiveTtl(empty, { minTtl: 5 }), 5);
});

Deno.test("ttl: report breakdown is consistent with adaptiveTtl", async () => {
    const path = [rep("a", 200), rep("b", 125)];
    const ttl = adaptiveTtl(path);
    const rep_ = adaptiveTtlReport(path);
    assertEquals(rep_.final_ttl, ttl);
    assertEquals(rep_.path_length, 2);
    assert(rep_.reliability > 0 && rep_.reliability < 1);
});

Deno.test("ttl: deterministic across calls", async () => {
    const path = [rep("a", 175), rep("b", 100), rep("c", 60)];
    const t1 = adaptiveTtl(path);
    const t2 = adaptiveTtl(path);
    assertEquals(t1, t2);
});

Deno.test("ttl: longer healthy path → linearly larger TTL", async () => {
    const t1 = adaptiveTtl([rep("a", 250)]);
    const t3 = adaptiveTtl([rep("a", 250), rep("b", 250), rep("c", 250)]);
    const t5 = adaptiveTtl([rep("a", 250), rep("b", 250), rep("c", 250), rep("d", 250), rep("e", 250)]);
    assert(t1 < t3 && t3 < t5);
});
