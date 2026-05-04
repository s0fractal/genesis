// Era 1530: Quorum-driven investigation trigger tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    DEFAULT_TRIGGER_OPTS,
    QuorumInvestigationTrigger,
    TRIGGER_SCHEMA,
    tickTrigger,
} from "../src/network/quorum_investigation.ts";
import { EventChainQuorumTracker } from "../src/network/event_chain_quorum.ts";

const T0 = 1_000_000;

function fillTracker(t: EventChainQuorumTracker, agreeing: number[], dissenters: { id: number; anchor: number }[], now: number = T0) {
    for (const id of agreeing) t.observe(id, 0x100, now);
    for (const d of dissenters) t.observe(d.id, d.anchor, now);
}

Deno.test("trigger: invalid opts throw", async () => {
    assertThrows(() => new QuorumInvestigationTrigger({ ...DEFAULT_TRIGGER_OPTS, per_peer_cooldown_ms: 0 }));
    assertThrows(() => new QuorumInvestigationTrigger({ ...DEFAULT_TRIGGER_OPTS, min_dissent_duration_ms: -1 }));
});

Deno.test("trigger: low-band consensus does NOT fire", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger();
    // Only 2 agreeing peers + 1 dissenter → band="double".
    fillTracker(tracker, [0xAA, 0xBB], [{ id: 0xCC, anchor: 0x999 }], T0);
    const out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, []);
    assertEquals(out.pending, [0xCC]);
    assertEquals(out.dissenter_count, 1);
});

Deno.test("trigger: high-band + dissenter past min duration fires", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        ...DEFAULT_TRIGGER_OPTS,
        min_dissent_duration_ms: 1000,
    });
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0);
    // First evaluate — sets first_seen_dissenting_ms but duration not met.
    let out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, []);
    assertEquals(out.pending, [0xFF]);

    // Advance past min duration, re-observe to keep peers fresh.
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0 + 2000);
    out = tickTrigger(tracker, trig, T0 + 2000);
    assertEquals(out.fire_now, [0xFF]);
});

Deno.test("trigger: cooldown blocks re-fire", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        min_band: "triple+",
        per_peer_cooldown_ms: 5000,
        min_dissent_duration_ms: 0,
    });
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0);
    // Fires immediately.
    let out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, [0xFF]);
    trig.markTriggered(0xFF, T0);
    // Re-evaluate within cooldown.
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0 + 1000);
    out = tickTrigger(tracker, trig, T0 + 1000);
    assertEquals(out.fire_now, []);
    assertEquals(out.pending, [0xFF]);
});

Deno.test("trigger: cooldown elapses → re-fires", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        min_band: "triple+",
        per_peer_cooldown_ms: 1000,
        min_dissent_duration_ms: 0,
    });
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0);
    let out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, [0xFF]);
    trig.markTriggered(0xFF, T0);
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0 + 2000);
    out = tickTrigger(tracker, trig, T0 + 2000);
    assertEquals(out.fire_now, [0xFF]);
});

Deno.test("trigger: empty consensus → no fire", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger();
    const out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, []);
    assertEquals(out.dissenter_count, 0);
});

Deno.test("trigger: dissenter resolved → record dropped", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        min_band: "triple+",
        per_peer_cooldown_ms: 5000,
        min_dissent_duration_ms: 0,
    });
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0);
    tickTrigger(tracker, trig, T0);
    assertEquals(trig.records_snapshot().length, 1);
    // Now 0xFF agrees with consensus — re-observe.
    tracker.observe(0xFF, 0x100, T0 + 100);
    tickTrigger(tracker, trig, T0 + 100);
    assertEquals(trig.records_snapshot().length, 0);
});

Deno.test("trigger: forget removes specific record", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger();
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0);
    tickTrigger(tracker, trig, T0);
    trig.forget(0xFF);
    assertEquals(trig.records_snapshot().length, 0);
});

Deno.test("trigger: markTriggered without prior record creates one", async () => {
    const trig = new QuorumInvestigationTrigger();
    trig.markTriggered(0xAA, T0);
    const records = trig.records_snapshot();
    assertEquals(records.length, 1);
    assertEquals(records[0].peer_id, 0xAA);
    assertEquals(records[0].last_triggered_ms, T0);
});

Deno.test("trigger: consensus change resets first_seen but preserves cooldown", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        min_band: "triple+",
        per_peer_cooldown_ms: 5000,
        min_dissent_duration_ms: 1000,
    });
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0);
    let out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, []); // duration not met yet
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [{ id: 0xFF, anchor: 0x999 }], T0 + 2000);
    out = tickTrigger(tracker, trig, T0 + 2000);
    assertEquals(out.fire_now, [0xFF]);
    trig.markTriggered(0xFF, T0 + 2000);
    // Now everyone shifts to a new consensus anchor 0x500.
    tracker.observe(0xAA, 0x500, T0 + 3000);
    tracker.observe(0xBB, 0x500, T0 + 3000);
    tracker.observe(0xCC, 0x500, T0 + 3000);
    tracker.observe(0xFF, 0x999, T0 + 3000); // still dissenting on different anchor
    out = tickTrigger(tracker, trig, T0 + 3000);
    // first_seen reset but cooldown still active (5000ms cooldown,
    // only 1000ms elapsed since markTriggered).
    assertEquals(out.fire_now, []);
    assertEquals(out.pending, [0xFF]);
});

Deno.test("trigger: tunable min_band='high' is more conservative", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        ...DEFAULT_TRIGGER_OPTS,
        min_band: "high",
        min_dissent_duration_ms: 0,
    });
    // Only 2 agreeing → band="double", below "high".
    fillTracker(tracker, [0xAA, 0xBB], [{ id: 0xFF, anchor: 0x999 }], T0);
    const out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now, []);
});

Deno.test("trigger: multiple dissenters all flagged when conditions met", async () => {
    const tracker = new EventChainQuorumTracker();
    const trig = new QuorumInvestigationTrigger({
        min_band: "triple+",
        per_peer_cooldown_ms: 5000,
        min_dissent_duration_ms: 0,
    });
    fillTracker(tracker, [0xAA, 0xBB, 0xCC], [
        { id: 0xFE, anchor: 0x888 },
        { id: 0xFF, anchor: 0x999 },
    ], T0);
    const out = tickTrigger(tracker, trig, T0);
    assertEquals(out.fire_now.sort((a, b) => a - b), [0xFE, 0xFF]);
});

Deno.test("trigger: records_snapshot sorted by peer_id", async () => {
    const trig = new QuorumInvestigationTrigger();
    trig.markTriggered(0xCC, T0);
    trig.markTriggered(0xAA, T0);
    trig.markTriggered(0xBB, T0);
    assertEquals(trig.records_snapshot().map(r => r.peer_id), [0xAA, 0xBB, 0xCC]);
});

Deno.test("schema constant", async () => {
    assertEquals(TRIGGER_SCHEMA, "OMEGA-1530/v1");
});
