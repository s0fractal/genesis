// Era 1520: Event-chain quorum tracker tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    DEFAULT_QUORUM_OPTS,
    EventChainQuorumTracker,
    QUORUM_SCHEMA,
    quorumGlyph,
} from "../src/network/event_chain_quorum.ts";

const T0 = 1_000_000;

Deno.test("quorum: empty tracker has consensus=null + band=none", async () => {
    const t = new EventChainQuorumTracker();
    const s = t.snapshot(T0);
    assertEquals(s.consensus_anchor, null);
    assertEquals(s.band, "none");
    assertEquals(s.total_observers, 0);
});

Deno.test("quorum: single observer → lone band", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    const s = t.snapshot(T0);
    assertEquals(s.consensus_anchor, 0x100);
    assertEquals(s.consensus_count, 1);
    assertEquals(s.band, "lone");
    assertEquals(s.agreement_q16, 65536);
});

Deno.test("quorum: two observers same anchor → double band", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    const s = t.snapshot(T0);
    assertEquals(s.band, "double");
    assertEquals(s.consensus_count, 2);
});

Deno.test("quorum: three observers same anchor → high band (default)", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xCC, 0x100, T0);
    const s = t.snapshot(T0);
    assertEquals(s.band, "high");
    assertEquals(s.consensus_count, 3);
});

Deno.test("quorum: dissenters listed when peer disagrees", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xCC, 0x999, T0); // different anchor
    const s = t.snapshot(T0);
    assertEquals(s.consensus_anchor, 0x100);
    assertEquals(s.consensus_count, 2);
    assertEquals(s.dissenter_peer_ids, [0xCC]);
    assertEquals(s.distinct_anchors, [0x100, 0x999]);
});

Deno.test("quorum: agreement_q16 reflects fraction agreeing", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xCC, 0x999, T0);
    t.observe(0xDD, 0x888, T0);
    const s = t.snapshot(T0);
    // 2 of 4 agree on 0x100 = 0.5
    assertEquals(s.agreement_q16, 32768);
});

Deno.test("quorum: tied counts broken by lower anchor wins", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x999, T0);
    t.observe(0xBB, 0x100, T0);
    const s = t.snapshot(T0);
    // Both have count=1; 0x100 < 0x999, so 0x100 wins.
    assertEquals(s.consensus_anchor, 0x100);
});

Deno.test("quorum: re-observe overwrites prior claim", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xAA, 0x999, T0 + 1000); // peer changed its anchor
    const s = t.snapshot(T0 + 1000);
    assertEquals(s.consensus_anchor, 0x999);
    assertEquals(s.consensus_count, 1);
    assertEquals(s.total_observers, 1);
});

Deno.test("quorum: forget drops a peer", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.forget(0xAA);
    const s = t.snapshot(T0);
    assertEquals(s.total_observers, 1);
});

Deno.test("quorum: TTL evicts stale observations", async () => {
    const t = new EventChainQuorumTracker({ ...DEFAULT_QUORUM_OPTS, ttl_ms: 5_000 });
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0 + 1_000);
    assertEquals(t.peerCount(T0 + 4_000), 2);
    // At T0 + 6_000, peer AA is evicted (observed at T0; 6000 - 5000 = 1000 cutoff).
    assertEquals(t.peerCount(T0 + 6_000), 1);
});

Deno.test("quorum: convenience accessors match snapshot", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xCC, 0x999, T0);
    assertEquals(t.consensusAnchor(T0), 0x100);
    assertEquals(t.dissenters(T0), [0xCC]);
});

Deno.test("quorum: tunable high_threshold", async () => {
    const t = new EventChainQuorumTracker({ ttl_ms: 60_000, high_threshold: 5 });
    for (let i = 0; i < 4; i++) t.observe(i + 1, 0x100, T0);
    const s4 = t.snapshot(T0);
    assertEquals(s4.band, "triple+"); // 4 observers, threshold=5 → triple+
    t.observe(5, 0x100, T0);
    const s5 = t.snapshot(T0);
    assertEquals(s5.band, "high");
});

Deno.test("quorum: invalid opts throw", async () => {
    assertThrows(() => new EventChainQuorumTracker({ ttl_ms: 0, high_threshold: 3 }));
    assertThrows(() => new EventChainQuorumTracker({ ttl_ms: 1000, high_threshold: 1 }));
});

Deno.test("quorum: distinct_anchors sorted ascending", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0x01, 0x300, T0);
    t.observe(0x02, 0x100, T0);
    t.observe(0x03, 0x200, T0);
    const s = t.snapshot(T0);
    assertEquals(s.distinct_anchors, [0x100, 0x200, 0x300]);
});

Deno.test("quorum: dissenter_peer_ids sorted ascending", async () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xCC, 0x999, T0);
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xDD, 0x888, T0);
    const s = t.snapshot(T0);
    assertEquals(s.dissenter_peer_ids, [0xCC, 0xDD]);
});

Deno.test("quorumGlyph: high/triple+/double/lone/none distinct", async () => {
    assertEquals(quorumGlyph("high"), "🟢");
    assertEquals(quorumGlyph("triple+"), "🟢");
    assertEquals(quorumGlyph("double"), "🟡");
    assertEquals(quorumGlyph("lone"), "🟠");
    assertEquals(quorumGlyph("none"), "⚪");
});

Deno.test("schema constant", async () => {
    assertEquals(QUORUM_SCHEMA, "OMEGA-1520/v1");
});
