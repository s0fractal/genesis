// Era 1550: Auto-investigation loop end-to-end tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    AutoInvestigationLoop,
    DEFAULT_LOOP_OPTS,
    LOOP_SCHEMA,
    WarrantEmit,
} from "../src/network/auto_investigation_loop.ts";
import { WarrantProposalPayload } from "../src/network/quorum_warrant_bridge.ts";

const T0 = 1_000_000;

function makeLoop() {
    const emitted: WarrantProposalPayload[] = [];
    const emit: WarrantEmit = (p) => {
        emitted.push(p);
        return true;
    };
    const loop = new AutoInvestigationLoop(emit, {
        quorum: { ttl_ms: 60_000, high_threshold: 3 },
        trigger: {
            min_band: "triple+",
            per_peer_cooldown_ms: 5_000,
            min_dissent_duration_ms: 0,
        },
        bridge: { dedup_window_ms: 5_000 },
    });
    return { loop, emitted };
}

Deno.test("loop: empty mesh → no warrants", async () => {
    const { loop, emitted } = makeLoop();
    const r = await loop.tick(T0);
    assertEquals(r.proposals_built.length, 0);
    assertEquals(emitted.length, 0);
    assertEquals(r.quorum_snapshot.consensus_anchor, null);
});

Deno.test("loop: healthy consensus → no warrants", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    const r = await loop.tick(T0);
    assertEquals(r.trigger_outcome.fire_now, []);
    assertEquals(emitted.length, 0);
});

Deno.test("loop: high-band consensus + dissenter → 1 warrant", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    const r = await loop.tick(T0);
    assertEquals(r.trigger_outcome.fire_now, [0xFF]);
    assertEquals(r.proposals_built.length, 1);
    assertEquals(r.proposals_emitted, 1);
    assertEquals(emitted.length, 1);
    assertEquals(emitted[0].target_peer_id, 0xFF);
});

Deno.test("loop: cooldown blocks re-emit on second tick", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    await loop.tick(T0);
    // Re-tick at T0 + 1s — within both the trigger cooldown
    // (5s) and the warrant dedup window (5s).
    loop.observePeerAnchor(0xAA, 0x100, T0 + 1000);
    loop.observePeerAnchor(0xBB, 0x100, T0 + 1000);
    loop.observePeerAnchor(0xCC, 0x100, T0 + 1000);
    loop.observePeerAnchor(0xFF, 0x999, T0 + 1000);
    const r = await loop.tick(T0 + 1000);
    assertEquals(r.proposals_emitted, 0);
    assertEquals(emitted.length, 1); // unchanged
});

Deno.test("loop: cooldown elapses → re-emit allowed", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    await loop.tick(T0);
    // Advance well past both cooldowns.
    loop.observePeerAnchor(0xAA, 0x100, T0 + 10_000);
    loop.observePeerAnchor(0xBB, 0x100, T0 + 10_000);
    loop.observePeerAnchor(0xCC, 0x100, T0 + 10_000);
    loop.observePeerAnchor(0xFF, 0x999, T0 + 10_000);
    const r = await loop.tick(T0 + 10_000);
    assertEquals(r.proposals_emitted, 1);
    assertEquals(emitted.length, 2);
});

Deno.test("loop: emit failure increments proposals_failed", async () => {
    const failingEmit: WarrantEmit = () => false;
    const loop = new AutoInvestigationLoop(failingEmit, DEFAULT_LOOP_OPTS);
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    // First tick records the dissent (duration=10s default not met).
    let r = await loop.tick(T0);
    assertEquals(r.proposals_emitted, 0);
    // Wait 11s for duration gate to pass.
    loop.observePeerAnchor(0xAA, 0x100, T0 + 11_000);
    loop.observePeerAnchor(0xBB, 0x100, T0 + 11_000);
    loop.observePeerAnchor(0xCC, 0x100, T0 + 11_000);
    loop.observePeerAnchor(0xFF, 0x999, T0 + 11_000);
    r = await loop.tick(T0 + 11_000);
    assertEquals(r.proposals_built.length, 1);
    assertEquals(r.proposals_emitted, 0);
    assertEquals(r.proposals_failed, 1);
});

Deno.test("loop: multi-dissenter chain produces multiple warrants", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFE, 0x888, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    const r = await loop.tick(T0);
    assertEquals(r.proposals_built.length, 2);
    assertEquals(r.proposals_emitted, 2);
    assertEquals(emitted.map(e => e.target_peer_id).sort((a, b) => a - b), [0xFE, 0xFF]);
});

Deno.test("loop: dissenter resolves → no further warrants", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    await loop.tick(T0);
    // 0xFF now agrees.
    loop.observePeerAnchor(0xFF, 0x100, T0 + 100);
    const r = await loop.tick(T0 + 100);
    assertEquals(r.trigger_outcome.fire_now, []);
    assertEquals(r.proposals_built.length, 0);
});

Deno.test("loop: forgetPeer drops all per-peer state", async () => {
    const { loop, emitted } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    await loop.tick(T0);
    loop.forgetPeer(0xFF);
    // Re-introduce as a fresh dissenter.
    loop.observePeerAnchor(0xFF, 0x999, T0 + 100);
    const r = await loop.tick(T0 + 100);
    // Cooldown was cleared along with the forget, so it can fire again.
    assertEquals(r.proposals_emitted, 1);
});

Deno.test("loop: tick result carries snapshot + outcome for HUD", async () => {
    const { loop } = makeLoop();
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    const r = await loop.tick(T0);
    assertEquals(r.quorum_snapshot.consensus_anchor, 0x100);
    assertEquals(r.quorum_snapshot.band, "high");
    assertEquals(r.trigger_outcome.dissenter_count, 0);
});

Deno.test("end-to-end: 5-peer mesh with 1 dissenter → emitted warrant has matching hash", async () => {
    const { loop, emitted } = makeLoop();
    // 4 healthy peers + 1 dissenter.
    for (const id of [0x01, 0x02, 0x03, 0x04]) {
        loop.observePeerAnchor(id, 0xCAFE, T0);
    }
    loop.observePeerAnchor(0xFF, 0xDEAD, T0);
    const r = await loop.tick(T0);
    assertEquals(r.proposals_emitted, 1);
    assertEquals(r.quorum_snapshot.consensus_anchor, 0xCAFE);
    assertEquals(r.quorum_snapshot.consensus_count, 4);
    assertEquals(r.quorum_snapshot.dissenter_peer_ids, [0xFF]);
    // The warrant's description encodes the consensus anchor.
    assert(emitted[0].proposalDescription.includes("0x000000ff")); // peer
    assert(emitted[0].proposalDescription.includes("0x0000cafe")); // consensus
});

Deno.test("schema constant", async () => {
    assertEquals(LOOP_SCHEMA, "OMEGA-1550/v1");
});
