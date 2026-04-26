// Era 1560: Quarantine-aware exclusion tests.
//
// Verifies that excluded peers (typically: those quarantined by the
// 3-of-5 oracle gate) drop out of the quorum tracker's consensus
// computation and don't contribute to dissenter counts that could
// re-trigger warrants in a feedback loop.

import { assertEquals, assert } from "jsr:@std/assert";
import { EventChainQuorumTracker } from "../src/network/event_chain_quorum.ts";
import {
    AutoInvestigationLoop,
    LOOP_SCHEMA,
    WarrantEmit,
} from "../src/network/auto_investigation_loop.ts";
import { WarrantProposalPayload } from "../src/network/quorum_warrant_bridge.ts";

const T0 = 1_000_000;

Deno.test("tracker: exclude drops existing observation", () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xFF, 0x999, T0);
    assertEquals(t.peerCount(T0), 3);
    t.exclude(0xFF);
    assertEquals(t.peerCount(T0), 2);
});

Deno.test("tracker: excluded peer's subsequent observe calls are silently ignored", () => {
    const t = new EventChainQuorumTracker();
    t.exclude(0xFF);
    t.observe(0xFF, 0x999, T0);
    assertEquals(t.peerCount(T0), 0);
});

Deno.test("tracker: unexclude allows new observations", () => {
    const t = new EventChainQuorumTracker();
    t.exclude(0xFF);
    t.observe(0xFF, 0x999, T0);
    assertEquals(t.peerCount(T0), 0);
    t.unexclude(0xFF);
    t.observe(0xFF, 0x999, T0 + 100);
    assertEquals(t.peerCount(T0 + 100), 1);
});

Deno.test("tracker: excludedPeers returns sorted snapshot", () => {
    const t = new EventChainQuorumTracker();
    t.exclude(0xCC);
    t.exclude(0xAA);
    t.exclude(0xBB);
    assertEquals(t.excludedPeers(), [0xAA, 0xBB, 0xCC]);
});

Deno.test("tracker: excluded peer's anchor doesn't enter consensus", () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    // 0xFF reports the same anchor as everyone else.
    t.observe(0xFF, 0x100, T0);
    assertEquals(t.snapshot(T0).consensus_count, 3);
    t.exclude(0xFF);
    assertEquals(t.snapshot(T0).consensus_count, 2);
});

Deno.test("tracker: excluded dissenter doesn't appear in dissenter list", () => {
    const t = new EventChainQuorumTracker();
    t.observe(0xAA, 0x100, T0);
    t.observe(0xBB, 0x100, T0);
    t.observe(0xCC, 0x100, T0);
    t.observe(0xFF, 0x999, T0);
    assertEquals(t.dissenters(T0), [0xFF]);
    t.exclude(0xFF);
    assertEquals(t.dissenters(T0), []);
});

Deno.test("loop: excludePeer prevents excluded dissenter from triggering warrant", () => {
    const emitted: WarrantProposalPayload[] = [];
    const emit: WarrantEmit = (p) => { emitted.push(p); return true; };
    const loop = new AutoInvestigationLoop(emit, {
        quorum: { ttl_ms: 60_000, high_threshold: 3 },
        trigger: {
            min_band: "triple+",
            per_peer_cooldown_ms: 5_000,
            min_dissent_duration_ms: 0,
        },
        bridge: { dedup_window_ms: 5_000 },
    });
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    // First tick fires a warrant for 0xFF.
    loop.tick(T0);
    assertEquals(emitted.length, 1);
    // Now exclude 0xFF (simulating a quarantine engagement).
    loop.excludePeer(0xFF);
    // Even if 0xFF reports anchor again, observations are dropped.
    loop.observePeerAnchor(0xFF, 0x999, T0 + 100_000);
    const r = loop.tick(T0 + 100_000);
    assertEquals(r.trigger_outcome.fire_now, []);
    assertEquals(r.proposals_built.length, 0);
    assertEquals(emitted.length, 1); // unchanged
});

Deno.test("loop: includePeer un-quarantines so dissenter can re-trigger after cooldown", () => {
    const emitted: WarrantProposalPayload[] = [];
    const emit: WarrantEmit = (p) => { emitted.push(p); return true; };
    const loop = new AutoInvestigationLoop(emit, {
        quorum: { ttl_ms: 60_000, high_threshold: 3 },
        trigger: {
            min_band: "triple+",
            per_peer_cooldown_ms: 5_000,
            min_dissent_duration_ms: 0,
        },
        bridge: { dedup_window_ms: 100 },
    });
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    loop.tick(T0);
    loop.excludePeer(0xFF);
    // Re-include after the trigger cooldown elapsed.
    loop.includePeer(0xFF);
    loop.observePeerAnchor(0xAA, 0x100, T0 + 10_000);
    loop.observePeerAnchor(0xBB, 0x100, T0 + 10_000);
    loop.observePeerAnchor(0xCC, 0x100, T0 + 10_000);
    loop.observePeerAnchor(0xFF, 0x999, T0 + 10_000);
    const r = loop.tick(T0 + 10_000);
    // The trigger record was dropped on excludePeer; dedup window
    // was 100ms (long elapsed); peer dissents fresh → warrant fires.
    assertEquals(r.proposals_emitted, 1);
    assertEquals(emitted.length, 2);
});

Deno.test("loop: excluding the lone dissenter restores band='high'", () => {
    const emit: WarrantEmit = () => true;
    const loop = new AutoInvestigationLoop(emit, {
        quorum: { ttl_ms: 60_000, high_threshold: 3 },
        trigger: {
            min_band: "triple+",
            per_peer_cooldown_ms: 5_000,
            min_dissent_duration_ms: 0,
        },
        bridge: { dedup_window_ms: 5_000 },
    });
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    let r = loop.tick(T0);
    assertEquals(r.quorum_snapshot.band, "high");
    assertEquals(r.quorum_snapshot.dissenter_peer_ids, [0xFF]);
    loop.excludePeer(0xFF);
    r = loop.tick(T0 + 100);
    assertEquals(r.quorum_snapshot.band, "high");
    assertEquals(r.quorum_snapshot.dissenter_peer_ids, []);
    assertEquals(r.trigger_outcome.dissenter_count, 0);
});

Deno.test("loop: schema constant unchanged after Era 1560 additions", () => {
    assertEquals(LOOP_SCHEMA, "OMEGA-1550/v1");
});
