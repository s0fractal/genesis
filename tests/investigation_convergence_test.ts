// Era 1220: Cross-Relay Investigation Convergence tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    InvestigationConvergenceTracker,
    CorroboratedRecord,
} from "../src/network/investigation_convergence.ts";
import { InvestigationRecord } from "../src/network/auto_investigation.ts";

const NOW = 100_000;

function rec(
    proposal_hash: number,
    target_relay_id: number,
    triggering_diff_q16 = 10_000,
): InvestigationRecord {
    return {
        proposal_hash: proposal_hash >>> 0,
        target_relay_id: target_relay_id >>> 0,
        reason: `era1210/partition target=${target_relay_id.toString(16)}`,
        raised_at_ms: NOW,
        triggering_diff_q16,
        status: "open",
    };
}

Deno.test("convergence: single raise → lone confidence", () => {
    const t = new InvestigationConvergenceTracker();
    const out = t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW);
    assertEquals(out.corroboration_count, 1);
    assertEquals(out.confidence, "lone");
});

Deno.test("convergence: two distinct raisers → double confidence", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW);
    const out = t.recordRaise(rec(0xAAAA, 0x1111), 0xCC02, NOW + 100);
    assertEquals(out.corroboration_count, 2);
    assertEquals(out.confidence, "double");
});

Deno.test("convergence: three distinct raisers → high confidence", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW);
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC02, NOW + 100);
    const out = t.recordRaise(rec(0xAAAA, 0x1111), 0xCC03, NOW + 200);
    assertEquals(out.corroboration_count, 3);
    assertEquals(out.confidence, "high");
});

Deno.test("convergence: same source raising twice doesn't double-count", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW);
    const out = t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW + 100);
    assertEquals(out.corroboration_count, 1);
    assertEquals(out.raised_by, [0xCC01]);
});

Deno.test("convergence: high-confidence callback fires once on transition", () => {
    let fired = 0;
    const t = new InvestigationConvergenceTracker({
        on_high_confidence: () => { fired++; },
    });
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW);
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC02, NOW + 100);
    assertEquals(fired, 0);
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC03, NOW + 200);
    assertEquals(fired, 1);
    // Fourth distinct raise — confidence stays "high", callback doesn't refire.
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC04, NOW + 300);
    assertEquals(fired, 1);
});

Deno.test("convergence: max_diff_q16 tracks the strongest alarm", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111, 5_000), 0xCC01, NOW);
    t.recordRaise(rec(0xAAAA, 0x1111, 12_000), 0xCC02, NOW + 100);
    t.recordRaise(rec(0xAAAA, 0x1111, 8_000), 0xCC03, NOW + 200);
    const out = t.get(0xAAAA)!;
    assertEquals(out.max_diff_q16, 12_000);
});

Deno.test("convergence: list orders by corroboration desc, then first_observed asc", () => {
    const t = new InvestigationConvergenceTracker();
    // Proposal 1 — lone.
    t.recordRaise(rec(0x1, 0xA), 0xCC01, NOW);
    // Proposal 2 — high (3 raisers).
    t.recordRaise(rec(0x2, 0xB), 0xCC01, NOW + 100);
    t.recordRaise(rec(0x2, 0xB), 0xCC02, NOW + 200);
    t.recordRaise(rec(0x2, 0xB), 0xCC03, NOW + 300);
    // Proposal 3 — double.
    t.recordRaise(rec(0x3, 0xC), 0xCC01, NOW + 400);
    t.recordRaise(rec(0x3, 0xC), 0xCC02, NOW + 500);
    const list = t.list();
    assertEquals(list[0].proposal_hash, 0x2); // high
    assertEquals(list[1].proposal_hash, 0x3); // double
    assertEquals(list[2].proposal_hash, 0x1); // lone
});

Deno.test("convergence: highConfidenceRecords filters correctly", () => {
    const t = new InvestigationConvergenceTracker();
    // Reach high.
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        t.recordRaise(rec(0xAAAA, 0x1111), src, NOW);
    }
    // Stay double.
    t.recordRaise(rec(0xBBBB, 0x2222), 0xCC01, NOW);
    t.recordRaise(rec(0xBBBB, 0x2222), 0xCC02, NOW);
    const high = t.highConfidenceRecords();
    assertEquals(high.length, 1);
    assertEquals(high[0].proposal_hash, 0xAAAA);
});

Deno.test("convergence: consensusSuspectTargets returns sorted unique targets", () => {
    const t = new InvestigationConvergenceTracker();
    // Two distinct high-confidence proposals against different targets.
    for (const src of [0xCC01, 0xCC02, 0xCC03]) {
        t.recordRaise(rec(0xA01, 0x300), src, NOW);
        t.recordRaise(rec(0xA02, 0x100), src, NOW);
        t.recordRaise(rec(0xA03, 0x200), src, NOW);
    }
    assertEquals(t.consensusSuspectTargets(), [0x100, 0x200, 0x300]);
});

Deno.test("convergence: capacity bound evicts oldest proposal", () => {
    const t = new InvestigationConvergenceTracker({ capacity: 2 });
    t.recordRaise(rec(0x1, 0xA), 0xCC01, NOW);
    t.recordRaise(rec(0x2, 0xB), 0xCC01, NOW + 10);
    t.recordRaise(rec(0x3, 0xC), 0xCC01, NOW + 20);
    assertEquals(t.size(), 2);
    assertEquals(t.get(0x1), undefined);
    assert(t.get(0x2) !== undefined);
    assert(t.get(0x3) !== undefined);
});

Deno.test("convergence: clear empties the tracker", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, NOW);
    t.clear();
    assertEquals(t.size(), 0);
    assertEquals(t.list(), []);
});

Deno.test("convergence: invalid options throw", () => {
    assertThrows(() => new InvestigationConvergenceTracker({ capacity: 0 }));
    assertThrows(() => new InvestigationConvergenceTracker({ high_confidence_threshold: 1 }));
});

Deno.test("convergence: raised_by is sorted ascending", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111), 0x300, NOW);
    t.recordRaise(rec(0xAAAA, 0x1111), 0x100, NOW + 10);
    t.recordRaise(rec(0xAAAA, 0x1111), 0x200, NOW + 20);
    const out = t.get(0xAAAA)!;
    assertEquals(out.raised_by, [0x100, 0x200, 0x300]);
});

Deno.test("convergence: first_observed/last_observed timestamps tracked", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC01, 1000);
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC02, 5000);
    t.recordRaise(rec(0xAAAA, 0x1111), 0xCC03, 9000);
    const out = t.get(0xAAAA)!;
    assertEquals(out.first_observed_at_ms, 1000);
    assertEquals(out.last_observed_at_ms, 9000);
});

Deno.test("convergence: distinct proposals stay isolated", () => {
    const t = new InvestigationConvergenceTracker();
    t.recordRaise(rec(0xAAAA, 0x1), 0xCC01, NOW);
    t.recordRaise(rec(0xBBBB, 0x2), 0xCC01, NOW);
    assertEquals(t.size(), 2);
    assertEquals(t.get(0xAAAA)!.target_relay_id, 0x1);
    assertEquals(t.get(0xBBBB)!.target_relay_id, 0x2);
});
