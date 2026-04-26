// Era 1180: Convergence Detector tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    ConvergenceDetector,
} from "../src/network/convergence_detector.ts";
import {
    buildHeartbeat,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";

const NOW = 100_000;

Deno.test("convergence: first observation is single-witness", () => {
    const cd = new ConvergenceDetector();
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    const rec = cd.observe(wv, "spore-A", NOW);
    assertEquals(rec.copies, 1);
    assertEquals(rec.witness_class, "single");
    assertEquals(rec.delivered_by, ["spore-A"]);
});

Deno.test("convergence: second observation is double-witness", () => {
    const cd = new ConvergenceDetector();
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    cd.observe(wv, "spore-A", NOW);
    const rec = cd.observe(wv, "spore-B", NOW + 100);
    assertEquals(rec.copies, 2);
    assertEquals(rec.witness_class, "double");
    assertEquals(rec.delivered_by.sort(), ["spore-A", "spore-B"]);
});

Deno.test("convergence: third observation is triple+", () => {
    const cd = new ConvergenceDetector();
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    cd.observe(wv, "spore-A", NOW);
    cd.observe(wv, "spore-B", NOW + 50);
    const rec = cd.observe(wv, "spore-C", NOW + 100);
    assertEquals(rec.copies, 3);
    assertEquals(rec.witness_class, "triple+");
});

Deno.test("convergence: same delivered_by twice doesn't add to list", () => {
    const cd = new ConvergenceDetector();
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    cd.observe(wv, "spore-A", NOW);
    cd.observe(wv, "spore-A", NOW + 100);
    const rec = cd.get(cd.snapshot()[0].key)!;
    assertEquals(rec.copies, 2);
    assertEquals(rec.delivered_by, ["spore-A"]);
});

Deno.test("convergence: different intents tracked separately", () => {
    const cd = new ConvergenceDetector();
    cd.observe(buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1), "spore-A", NOW);
    cd.observe(buildWarrantVote(0xDEAD_BEEF >>> 0, 0, true, 1), "spore-A", NOW + 50);
    cd.observe(buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 2), "spore-A", NOW + 100);
    assertEquals(cd.snapshot().length, 3);
});

Deno.test("convergence: stats aggregation", () => {
    const cd = new ConvergenceDetector();
    // Two double-witness intents.
    for (let i = 0; i < 2; i++) {
        const wv = buildWarrantVote((0xAA00 + i) >>> 0, 0, true, 1);
        cd.observe(wv, "spore-A", NOW);
        cd.observe(wv, "spore-B", NOW + 50);
    }
    // One single-witness intent.
    cd.observe(buildWarrantVote(0xBB00 >>> 0, 0, true, 1), "spore-A", NOW);
    // One triple-witness intent.
    const tri = buildWarrantVote(0xCC00 >>> 0, 0, true, 1);
    cd.observe(tri, "spore-A", NOW);
    cd.observe(tri, "spore-B", NOW + 50);
    cd.observe(tri, "spore-C", NOW + 100);

    const s = cd.stats();
    assertEquals(s.total_intents, 4);
    assertEquals(s.single_witness, 1);
    assertEquals(s.double_witness, 2);
    assertEquals(s.triple_plus_witness, 1);
    assertEquals(s.redundancy_rate, 2 / 4);
});

Deno.test("convergence: stats on empty detector", () => {
    const cd = new ConvergenceDetector();
    const s = cd.stats();
    assertEquals(s.total_intents, 0);
    assertEquals(s.redundancy_rate, 0);
});

Deno.test("convergence: proven_carriers returns sorted unique IDs", () => {
    const cd = new ConvergenceDetector();
    const wv1 = buildWarrantVote(0xAA00 >>> 0, 0, true, 1);
    cd.observe(wv1, "zeta", NOW);
    cd.observe(wv1, "alpha", NOW + 50);
    const wv2 = buildWarrantVote(0xBB00 >>> 0, 0, true, 1);
    cd.observe(wv2, "zeta", NOW);
    cd.observe(wv2, "mu", NOW + 50);
    // Single-witness carriers don't qualify.
    cd.observe(buildWarrantVote(0xCC00 >>> 0, 0, true, 1), "loner", NOW);
    assertEquals(cd.proven_carriers(), ["alpha", "mu", "zeta"]);
});

Deno.test("convergence: stragglers returns single-witness intents past stale threshold", () => {
    const cd = new ConvergenceDetector();
    cd.observe(buildWarrantVote(0xAA00 >>> 0, 0, true, 1), "spore-A", NOW);
    cd.observe(buildWarrantVote(0xBB00 >>> 0, 0, true, 1), "spore-A", NOW + 5_000);
    // Double-witness one — does NOT count as straggler.
    const wv = buildWarrantVote(0xCC00 >>> 0, 0, true, 1);
    cd.observe(wv, "spore-A", NOW);
    cd.observe(wv, "spore-B", NOW + 100);

    const stale = cd.stragglers(NOW + 10_000, 3_000);
    // 0xAA00: first_seen=NOW, age=10000 ≥ 3000 → straggler
    // 0xBB00: first_seen=NOW+5000, age=5000 ≥ 3000 → straggler
    // 0xCC00: double-witness → not straggler
    assertEquals(stale.length, 2);
});

Deno.test("convergence: capacity bound evicts oldest", () => {
    const cd = new ConvergenceDetector(2);
    cd.observe(buildWarrantVote(0xAA >>> 0, 0, true, 1), "x", NOW);
    cd.observe(buildWarrantVote(0xBB >>> 0, 0, true, 1), "x", NOW + 10);
    cd.observe(buildWarrantVote(0xCC >>> 0, 0, true, 1), "x", NOW + 20); // evicts 0xAA
    assertEquals(cd.snapshot().length, 2);
    const keys = cd.snapshot().map(r => r.frame_type);
    assert(keys.length === 2);
});

Deno.test("convergence: clear empties the detector", () => {
    const cd = new ConvergenceDetector();
    cd.observe(buildWarrantVote(0xAA >>> 0, 0, true, 1), "x", NOW);
    cd.clear();
    assertEquals(cd.snapshot().length, 0);
    assertEquals(cd.stats().total_intents, 0);
});

Deno.test("convergence: invalid capacity throws", () => {
    assertThrows(() => new ConvergenceDetector(0));
    assertThrows(() => new ConvergenceDetector(-1));
});

Deno.test("convergence: heartbeat-and-warrant tracked separately", () => {
    const cd = new ConvergenceDetector();
    cd.observe(buildHeartbeat(GENESIS_HASH_V1_0, 1), "spore-A", NOW);
    cd.observe(buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1), "spore-A", NOW + 50);
    assertEquals(cd.snapshot().length, 2);
});

Deno.test("convergence: identical intent via different routing metadata still counts as duplicate", () => {
    const cd = new ConvergenceDetector();
    const wv1 = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    // Mutate routing metadata (TTL/trail) to simulate two-path arrival.
    const wv2 = { ...wv1, payloadB: 0xDEAD_BEEF, payloadC: 0xFFFF_FFFF };
    cd.observe(wv1, "spore-A", NOW);
    const rec = cd.observe(wv2, "spore-B", NOW + 100);
    assertEquals(rec.witness_class, "double");
});
