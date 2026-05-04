// Era 1570: Quarantine lifecycle bridge tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    DEFAULT_LIFECYCLE_OPTS,
    LIFECYCLE_BRIDGE_SCHEMA,
    LocalEventSource,
    QuarantineLifecycleBridge,
} from "../src/network/quarantine_lifecycle_bridge.ts";
import { AutoInvestigationLoop } from "../src/network/auto_investigation_loop.ts";
import { WarrantProposalPayload } from "../src/network/quorum_warrant_bridge.ts";

const T0 = 1_000_000;

function makeLoopAndBridge() {
    const emitted: WarrantProposalPayload[] = [];
    const loop = new AutoInvestigationLoop((p) => { emitted.push(p); return true; }, {
        quorum: { ttl_ms: 60_000, high_threshold: 3 },
        trigger: {
            min_band: "triple+",
            per_peer_cooldown_ms: 5_000,
            min_dissent_duration_ms: 0,
        },
        bridge: { dedup_window_ms: 5_000 },
    });
    const source = new LocalEventSource();
    const bridge = new QuarantineLifecycleBridge(loop, source);
    return { loop, source, bridge, emitted };
}

Deno.test("bridge: starts inactive", async () => {
    const { bridge } = makeLoopAndBridge();
    assertEquals(bridge.isActive(), false);
});

Deno.test("bridge: start/stop lifecycle", async () => {
    const { bridge } = makeLoopAndBridge();
    bridge.start();
    assertEquals(bridge.isActive(), true);
    bridge.stop();
    assertEquals(bridge.isActive(), false);
});

Deno.test("bridge: start is idempotent", async () => {
    const { bridge } = makeLoopAndBridge();
    bridge.start();
    bridge.start(); // no-op
    assertEquals(bridge.isActive(), true);
});

Deno.test("bridge: stop without start is no-op", async () => {
    const { bridge } = makeLoopAndBridge();
    bridge.stop(); // should not throw
    assertEquals(bridge.isActive(), false);
});

Deno.test("bridge: engagement event triggers excludePeer", async () => {
    const { loop, source, bridge } = makeLoopAndBridge();
    bridge.start();
    loop.observePeerAnchor(0xFF, 0x999, T0);
    assertEquals(loop.tracker.peerCount(T0), 1);
    source.dispatch("quarantine-engaged", { peer_id: 0xFF }); await new Promise(r => setTimeout(r, 0));
    assertEquals(loop.tracker.peerCount(T0), 0);
    assertEquals(loop.tracker.excludedPeers(), [0xFF]);
});

Deno.test("bridge: resolution event triggers includePeer", async () => {
    const { loop, source, bridge } = makeLoopAndBridge();
    bridge.start();
    source.dispatch("quarantine-engaged", { peer_id: 0xFF }); await new Promise(r => setTimeout(r, 0));
    assertEquals(loop.tracker.excludedPeers(), [0xFF]);
    source.dispatch("quarantine-resolved", { peer_id: 0xFF }); await new Promise(r => setTimeout(r, 0));
    assertEquals(loop.tracker.excludedPeers(), []);
});

Deno.test("bridge: malformed payload (missing peer_id) counted, not crashed", async () => {
    const { source, bridge } = makeLoopAndBridge();
    bridge.start();
    source.dispatch("quarantine-engaged", {}); await new Promise(r => setTimeout(r, 0));
    source.dispatch("quarantine-engaged", { peer_id: "not-a-number" }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("quarantine-engaged", null); await new Promise(r => setTimeout(r, 0));
    const tele = bridge.telemetry();
    assertEquals(tele.engaged_received, 3);
    assertEquals(tele.malformed_payloads, 3);
    assertEquals(tele.excluded_peers, 0);
});

Deno.test("bridge: telemetry counts engagements + resolutions", async () => {
    const { source, bridge } = makeLoopAndBridge();
    bridge.start();
    source.dispatch("quarantine-engaged", { peer_id: 0xAA }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("quarantine-engaged", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    source.dispatch("quarantine-resolved", { peer_id: 0xAA }); await new Promise(r => setTimeout(r, 0));
    const tele = bridge.telemetry();
    assertEquals(tele.engaged_received, 2);
    assertEquals(tele.resolved_received, 1);
    assertEquals(tele.excluded_peers, 2);
    assertEquals(tele.included_peers, 1);
});

Deno.test("bridge: stop unsubscribes — events after stop are no-ops", async () => {
    const { loop, source, bridge } = makeLoopAndBridge();
    bridge.start();
    bridge.stop();
    source.dispatch("quarantine-engaged", { peer_id: 0xFF }); await new Promise(r => setTimeout(r, 0));
    assertEquals(loop.tracker.excludedPeers(), []);
    assertEquals(bridge.telemetry().engaged_received, 0);
});

Deno.test("bridge: configurable event names", async () => {
    const { loop, source } = makeLoopAndBridge();
    const bridge = new QuarantineLifecycleBridge(loop, source, {
        engaged_event_name: "custom-engaged",
        resolved_event_name: "custom-resolved",
    });
    bridge.start();
    source.dispatch("custom-engaged", { peer_id: 0xFF }); await new Promise(r => setTimeout(r, 0));
    assertEquals(loop.tracker.excludedPeers(), [0xFF]);
    // Default name no longer triggers anything.
    source.dispatch("quarantine-engaged", { peer_id: 0xAA }); await new Promise(r => setTimeout(r, 0));
    assertEquals(loop.tracker.excludedPeers(), [0xFF]);
});

Deno.test("end-to-end: warrant fires → quarantine engages → tracker excludes → no re-fire", async () => {
    const { loop, source, bridge, emitted } = makeLoopAndBridge();
    bridge.start();
    // 4 healthy + 1 dissenter.
    loop.observePeerAnchor(0xAA, 0x100, T0);
    loop.observePeerAnchor(0xBB, 0x100, T0);
    loop.observePeerAnchor(0xCC, 0x100, T0);
    loop.observePeerAnchor(0xFF, 0x999, T0);
    // Tick → warrant proposal fires.
    await loop.tick(T0);
    assertEquals(emitted.length, 1);
    // Senate adjudicates → quarantine engaged event fires.
    source.dispatch("quarantine-engaged", { peer_id: 0xFF }); await new Promise(r => setTimeout(r, 0));
    // Even after a long interval (past all cooldowns), 0xFF is
    // excluded, so re-observation is silently dropped and no
    // further warrants emit.
    loop.observePeerAnchor(0xFF, 0x999, T0 + 100_000);
    loop.observePeerAnchor(0xAA, 0x100, T0 + 100_000);
    loop.observePeerAnchor(0xBB, 0x100, T0 + 100_000);
    loop.observePeerAnchor(0xCC, 0x100, T0 + 100_000);
    const r = await loop.tick(T0 + 100_000);
    assertEquals(r.proposals_emitted, 0);
    assertEquals(r.quorum_snapshot.dissenter_peer_ids, []);
    assertEquals(emitted.length, 1); // unchanged from before
});

Deno.test("schema constant", async () => {
    assertEquals(LIFECYCLE_BRIDGE_SCHEMA, "OMEGA-1570/v1");
    assertEquals(DEFAULT_LIFECYCLE_OPTS.engaged_event_name, "quarantine-engaged");
});
