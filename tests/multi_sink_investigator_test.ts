// Era 1580: Multi-sink investigator tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    MULTI_SINK_SCHEMA,
    MultiSinkInvestigator,
} from "../src/network/multi_sink_investigator.ts";
import { WarrantEmit } from "../src/network/auto_investigation_loop.ts";
import { WarrantProposalPayload } from "../src/network/quorum_warrant_bridge.ts";

const T0 = 1_000_000;

const TEST_OPTS = {
    quorum: { ttl_ms: 60_000, high_threshold: 3 },
    trigger: {
        min_band: "triple+" as const,
        per_peer_cooldown_ms: 5_000,
        min_dissent_duration_ms: 0,
    },
    bridge: { dedup_window_ms: 5_000 },
};

function makeInvestigator() {
    const emitted: Array<WarrantProposalPayload & { sink_id?: string }> = [];
    const emit: WarrantEmit = (p) => {
        emitted.push(p as WarrantProposalPayload & { sink_id?: string });
        return true;
    };
    return { investigator: new MultiSinkInvestigator(emit), emitted };
}

Deno.test("multi: starts with zero sinks", async () => {
    const { investigator } = makeInvestigator();
    assertEquals(investigator.sinkCount(), 0);
    assertEquals(investigator.sinkIds(), []);
});

Deno.test("multi: addSink registers + addSink twice throws", async () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    assertEquals(investigator.sinkCount(), 1);
    assertEquals(investigator.sinkIds(), ["alpha"]);
    assertThrows(() => investigator.addSink("alpha", TEST_OPTS));
});

Deno.test("multi: removeSink drops it", async () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("beta", TEST_OPTS);
    investigator.removeSink("alpha");
    assertEquals(investigator.sinkCount(), 1);
    assertEquals(investigator.sinkIds(), ["beta"]);
});

Deno.test("multi: observePeerAnchor returns false for unknown sink", async () => {
    const { investigator } = makeInvestigator();
    assertEquals(investigator.observePeerAnchor("missing", 0xAA, 0x100, T0), false);
});

Deno.test("multi: per-sink quorum independence", async () => {
    const { investigator, emitted } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("beta", TEST_OPTS);
    // alpha: 3 peers agree, no dissent.
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0);
    // beta: 3 peers agree + 1 dissenter.
    investigator.observePeerAnchor("beta", 0xAA, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xBB, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xCC, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xFF, 0x999, T0);
    const r = await investigator.tickAll(T0);
    assertEquals(r.total_emitted, 1);
    assertEquals(r.per_sink.get("alpha")!.proposals_emitted, 0);
    assertEquals(r.per_sink.get("beta")!.proposals_emitted, 1);
    assertEquals(emitted[0].sink_id, "beta");
});

Deno.test("multi: emit callback receives sink_id metadata", async () => {
    const { investigator, emitted } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0);
    await investigator.tickAll(T0);
    assertEquals(emitted.length, 1);
    assertEquals(emitted[0].sink_id, "alpha");
});

Deno.test("multi: globally excluded peer pre-add blocks new sinks", async () => {
    const { investigator } = makeInvestigator();
    investigator.excludePeerGlobally(0xFF);
    investigator.addSink("alpha", TEST_OPTS);
    // 0xFF cannot dissent in alpha.
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0);
    const r = await investigator.tickAll(T0);
    assertEquals(r.per_sink.get("alpha")!.quorum_snapshot.dissenter_peer_ids, []);
});

Deno.test("multi: excludePeerGlobally propagates to all existing sinks", async () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("beta", TEST_OPTS);
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0);
    investigator.observePeerAnchor("beta", 0xFF, 0x999, T0);
    investigator.excludePeerGlobally(0xFF);
    assertEquals(investigator.getSink("alpha")!.tracker.peerCount(T0), 0);
    assertEquals(investigator.getSink("beta")!.tracker.peerCount(T0), 0);
    assertEquals(investigator.globallyExcludedPeers(), [0xFF]);
});

Deno.test("multi: includePeerGlobally reverses exclusion", async () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.excludePeerGlobally(0xFF);
    investigator.includePeerGlobally(0xFF);
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0);
    assertEquals(investigator.getSink("alpha")!.tracker.peerCount(T0), 1);
    assertEquals(investigator.globallyExcludedPeers(), []);
});

Deno.test("multi: tickOne runs only one sink", async () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("beta", TEST_OPTS);
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0);
    investigator.observePeerAnchor("beta", 0xAA, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xBB, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xCC, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xFE, 0x888, T0);
    const r = await investigator.tickOne("alpha", T0);
    assert(r);
    assertEquals(r!.proposals_emitted, 1);
    // beta wasn't ticked — it has a different dissenter that wasn't actioned.
});

Deno.test("multi: tickOne returns undefined for unknown sink", async () => {
    const { investigator } = makeInvestigator();
    assertEquals(await investigator.tickOne("missing", T0), undefined);
});

Deno.test("multi: summary aggregates dissenter counts across sinks", async () => {
    const { investigator } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("beta", TEST_OPTS);
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0);
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0);
    investigator.observePeerAnchor("beta", 0xAA, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xBB, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xCC, 0x200, T0);
    investigator.observePeerAnchor("beta", 0xFE, 0x888, T0);
    investigator.observePeerAnchor("beta", 0xFD, 0x777, T0);
    const s = investigator.summary(T0);
    assertEquals(s.sink_count, 2);
    assertEquals(s.sink_ids, ["alpha", "beta"]);
    assertEquals(s.globally_excluded_count, 0);
    assertEquals(s.per_sink_dissenter_counts.length, 2);
    assertEquals(s.total_dissenters, 3); // 1 in alpha + 2 in beta
});

Deno.test("multi: tickAll iterates sinks in sorted-id order", async () => {
    const { investigator, emitted } = makeInvestigator();
    investigator.addSink("zulu", TEST_OPTS);
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("mike", TEST_OPTS);
    for (const sink of ["zulu", "alpha", "mike"]) {
        investigator.observePeerAnchor(sink, 0xAA, 0x100, T0);
        investigator.observePeerAnchor(sink, 0xBB, 0x100, T0);
        investigator.observePeerAnchor(sink, 0xCC, 0x100, T0);
        investigator.observePeerAnchor(sink, 0xFF, 0x999, T0);
    }
    await investigator.tickAll(T0);
    // Emissions arrive in sorted-sink order: alpha, mike, zulu.
    assertEquals(emitted.map(e => e.sink_id), ["alpha", "mike", "zulu"]);
});

Deno.test("end-to-end: multi-sink scenario with global quarantine", async () => {
    const { investigator, emitted } = makeInvestigator();
    investigator.addSink("alpha", TEST_OPTS);
    investigator.addSink("beta", TEST_OPTS);
    // 0xFF dissents in BOTH sinks.
    for (const sink of ["alpha", "beta"]) {
        investigator.observePeerAnchor(sink, 0xAA, 0x100, T0);
        investigator.observePeerAnchor(sink, 0xBB, 0x100, T0);
        investigator.observePeerAnchor(sink, 0xCC, 0x100, T0);
        investigator.observePeerAnchor(sink, 0xFF, 0x999, T0);
    }
    // First tick: warrants emit from BOTH sinks for 0xFF.
    const r1 = await investigator.tickAll(T0);
    assertEquals(r1.total_emitted, 2);
    // Senate quarantines 0xFF globally.
    investigator.excludePeerGlobally(0xFF);
    // Re-observation tries to put 0xFF back in either sink; both reject.
    investigator.observePeerAnchor("alpha", 0xFF, 0x999, T0 + 100_000);
    investigator.observePeerAnchor("beta", 0xFF, 0x999, T0 + 100_000);
    investigator.observePeerAnchor("alpha", 0xAA, 0x100, T0 + 100_000);
    investigator.observePeerAnchor("alpha", 0xBB, 0x100, T0 + 100_000);
    investigator.observePeerAnchor("alpha", 0xCC, 0x100, T0 + 100_000);
    investigator.observePeerAnchor("beta", 0xAA, 0x100, T0 + 100_000);
    investigator.observePeerAnchor("beta", 0xBB, 0x100, T0 + 100_000);
    investigator.observePeerAnchor("beta", 0xCC, 0x100, T0 + 100_000);
    const r2 = await investigator.tickAll(T0 + 100_000);
    assertEquals(r2.total_emitted, 0);
    assertEquals(r2.total_dissenters, 0);
    // Confirm emit log unchanged from r1.
    assertEquals(emitted.length, 2);
});

Deno.test("schema constant", async () => {
    assertEquals(MULTI_SINK_SCHEMA, "OMEGA-1580/v1");
});
