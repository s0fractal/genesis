// Path diversification + dedup tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    DedupWindow,
    HIGH_PRIORITY_FRAME_TYPES,
    dedupKey,
    isHighPriority,
    pathsAreDisjoint,
    planDiversification,
} from "../src/network/path_diversification.ts";
import { ReputationScore } from "../src/network/reputation_routing.ts";
import {
    FRAME_TYPE_HEARTBEAT,
    FRAME_TYPE_WARRANT_VOTE,
    buildHeartbeat,
    buildWarrantVote,
} from "../src/network/spore_frame.ts";
import { PathCandidate } from "../src/network/path_selection.ts";

function rep(id: string, score: number, health: ReputationScore["health"] = "healthy"): ReputationScore {
    return { spore_id: id, score, health, eligible: score > 0, breakdown: {} };
}

Deno.test("dedup: high-priority frame types include WARRANT_VOTE", async () => {
    assert(HIGH_PRIORITY_FRAME_TYPES.includes(FRAME_TYPE_WARRANT_VOTE));
    assert(!HIGH_PRIORITY_FRAME_TYPES.includes(FRAME_TYPE_HEARTBEAT));
});

Deno.test("dedup: warrant vote is high-priority", async () => {
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1);
    const hb = buildHeartbeat(0x549A_6307, 1);
    assert(isHighPriority(wv));
    assert(!isHighPriority(hb));
});

Deno.test("dedup: same intent produces same key (TTL/trail differ)", async () => {
    const wv1 = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 100);
    const wv2 = { ...wv1, payloadB: 0xDEAD_BEEF, payloadC: 0xFFFF_FFFF };
    assertEquals(dedupKey(wv1), dedupKey(wv2));
});

Deno.test("dedup: different intent produces different keys", async () => {
    const a = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 100);
    const b = buildWarrantVote(0xDEAD_BEEF >>> 0, 0, true, 100);
    const c = buildWarrantVote(0xCAFE_BABE >>> 0, 1, true, 100);
    const d = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 101);
    assert(dedupKey(a) !== dedupKey(b));
    assert(dedupKey(a) !== dedupKey(c));
    assert(dedupKey(a) !== dedupKey(d));
});

Deno.test("disjoint: empty intersection", async () => {
    const a = [rep("x", 200), rep("y", 200)];
    const b = [rep("p", 200), rep("q", 200)];
    assert(pathsAreDisjoint(a, b));
});

Deno.test("disjoint: overlap detected", async () => {
    const a = [rep("x", 200), rep("y", 200)];
    const b = [rep("p", 200), rep("y", 200)]; // shares "y"
    assertEquals(pathsAreDisjoint(a, b), false);
});

Deno.test("plan: high-priority frame with two disjoint paths → duplicated", async () => {
    const candidates: PathCandidate[] = [
        { label: "north", hops: [rep("n1", 250), rep("n2", 250)] },
        { label: "south", hops: [rep("s1", 250), rep("s2", 250)] },
    ];
    const plan = planDiversification(candidates, buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1));
    assertEquals(plan.duplicated, true);
    assertEquals(plan.primary.label, "north");
    assertEquals(plan.secondary?.label, "south");
});

Deno.test("plan: low-priority frame stays single-path", async () => {
    const candidates: PathCandidate[] = [
        { label: "north", hops: [rep("n1", 250)] },
        { label: "south", hops: [rep("s1", 250)] },
    ];
    const plan = planDiversification(candidates, buildHeartbeat(0x549A_6307, 1));
    assertEquals(plan.duplicated, false);
    assertEquals(plan.secondary, undefined);
});

Deno.test("plan: no disjoint alternative → primary-only", async () => {
    const candidates: PathCandidate[] = [
        { label: "p1", hops: [rep("a", 250), rep("shared", 250)] },
        { label: "p2", hops: [rep("b", 250), rep("shared", 250)] }, // shares "shared"
    ];
    const plan = planDiversification(candidates, buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1));
    assertEquals(plan.duplicated, false);
    assertEquals(plan.primary.label, "p1");
    assertEquals(plan.secondary, undefined);
});

Deno.test("plan: forked candidates excluded from primary/secondary", async () => {
    const candidates: PathCandidate[] = [
        { label: "rogue",   hops: [rep("r", 0, "forked")] },
        { label: "primary", hops: [rep("g1", 250), rep("g2", 250)] },
        { label: "second",  hops: [rep("a1", 250), rep("a2", 250)] },
    ];
    const plan = planDiversification(candidates, buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1));
    assertEquals(plan.duplicated, true);
    // Tie-break by label asc among equal-efficiency candidates.
    assertEquals(plan.primary.label, "primary");
    assertEquals(plan.secondary?.label, "second");
});

Deno.test("plan: empty input → stable shape, not duplicated", async () => {
    const plan = planDiversification([], buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 1));
    assertEquals(plan.duplicated, false);
});

Deno.test("dedup window: first observation returns false", async () => {
    const w = new DedupWindow(4);
    assertEquals(w.seen(0xAAAA), false);
    assertEquals(w.size(), 1);
});

Deno.test("dedup window: second observation returns true", async () => {
    const w = new DedupWindow(4);
    w.seen(0xAAAA);
    assertEquals(w.seen(0xAAAA), true);
});

Deno.test("dedup window: capacity bound evicts oldest", async () => {
    const w = new DedupWindow(2);
    w.seen(1);
    w.seen(2);
    w.seen(3); // evicts 1
    assertEquals(w.contains(1), false);
    assertEquals(w.contains(2), true);
    assertEquals(w.contains(3), true);
    assertEquals(w.size(), 2);
});

Deno.test("dedup window: contains() does NOT insert", async () => {
    const w = new DedupWindow(4);
    assertEquals(w.contains(0xBBBB), false);
    assertEquals(w.size(), 0);
});

Deno.test("dedup window: clear empties the window", async () => {
    const w = new DedupWindow(4);
    w.seen(1); w.seen(2); w.seen(3);
    w.clear();
    assertEquals(w.size(), 0);
    assertEquals(w.seen(1), false);
});

Deno.test("dedup window: invalid capacity throws", async () => {
    assertThrows(() => new DedupWindow(0));
    assertThrows(() => new DedupWindow(-1));
});

Deno.test("dedup: end-to-end — duplicate WARRANT_VOTE arrives, dedup catches it", async () => {
    const wv = buildWarrantVote(0xCAFE_BABE >>> 0, 0, true, 42);
    const window = new DedupWindow(16);
    // Primary path delivers first.
    assertEquals(window.seen(dedupKey(wv)), false);
    // Secondary path arrives later — same intent, different routing metadata.
    const wv_dup = { ...wv, payloadB: 0xCAFE_FACE, payloadC: 0xBEEF_FEED, crc32: 0 };
    assertEquals(window.seen(dedupKey(wv_dup)), true);
});
