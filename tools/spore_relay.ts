// 🌌 OMEGA-64 — Spore Relay CLI
//
// Listens for 32-byte SporeFrame buffers on stdin and prints a health
// table for every spore that's been observed. Useful for piping QEMU's
// semihosting / serial output, or for hand-testing with the simulator.
//
// Usage:
//   deno run --allow-read tools/spore_relay.ts
//   # Then paste/pipe binary frame bytes to stdin.
//
// Self-test:
//   deno run --allow-read tools/spore_relay.ts --self-test
//
// The relay never speaks the WebRTC plasmid protocol directly — it
// observes the wire and produces an operational HUD. Wiring relay → mesh
// is a separate concern; this tool is the local lens for spore fleets.

import {
    SPORE_FRAME_BYTES,
    findSync,
    frameFromBytes,
} from "../src/network/spore_frame.ts";
import {
    LivenessAggregator,
    SporeRecord,
} from "../src/network/liveness_aggregator.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import { buildHeartbeat, buildWarrantVote } from "../src/network/spore_frame.ts";

const HEALTH_GLYPHS: Record<string, string> = {
    healthy: "🟢",
    stalled: "🟡",
    forked:  "🔴",
    lost:    "⚫",
    unknown: "⚪",
};

function renderHud(agg: LivenessAggregator): string {
    const counts = agg.countByHealth();
    const lines: string[] = [];
    lines.push(`Spore fleet: ${agg.snapshot().length} known`);
    lines.push(`  🟢 healthy=${counts.healthy}  🟡 stalled=${counts.stalled}  🔴 forked=${counts.forked}  ⚫ lost=${counts.lost}  ⚪ unknown=${counts.unknown}`);
    lines.push("");
    lines.push("ID                 │ STATE   │ TICK    │ HEARTBEATS │ VOTES │ GENESIS");
    lines.push("───────────────────┼─────────┼─────────┼────────────┼───────┼──────────");
    const sorted = [...agg.snapshot()].sort((a, b) => a.spore_id.localeCompare(b.spore_id));
    for (const r of sorted) {
        const id = r.spore_id.padEnd(18).slice(0, 18);
        const state = (HEALTH_GLYPHS[r.health] + " " + r.health).padEnd(7);
        const tick = String(r.last_tick).padStart(7);
        const hb = String(r.heartbeat_count).padStart(10);
        const votes = String(r.warrant_votes_observed).padStart(5);
        const genesis = "0x" + (r.last_genesis >>> 0).toString(16).padStart(8, "0");
        const driftMark = (r.last_genesis !== GENESIS_HASH_V1_0 && r.heartbeat_count > 0) ? " ⚠ DRIFT" : "";
        lines.push(`${id} │ ${state} │ ${tick} │ ${hb} │ ${votes} │ ${genesis}${driftMark}`);
    }
    return lines.join("\n");
}

function selfTest() {
    const agg = new LivenessAggregator({ classifyAfter: 1 });
    // All spores share a single "now" so timestamps line up consistently.
    // Stagger only what we have to in order to demonstrate distinct states.
    const NOW = 100_000;

    // Healthy spore — three heartbeats with advancing ticks, freshly observed.
    agg.ingest("alpha", buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW - 200);
    agg.ingest("alpha", buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW - 100);
    agg.ingest("alpha", buildHeartbeat(GENESIS_HASH_V1_0, 3), NOW);

    // Stalled spore — three heartbeats but tick stuck at 5.
    agg.ingest("beta", buildHeartbeat(GENESIS_HASH_V1_0, 5), NOW - 200);
    agg.ingest("beta", buildHeartbeat(GENESIS_HASH_V1_0, 5), NOW - 100);
    agg.ingest("beta", buildHeartbeat(GENESIS_HASH_V1_0, 5), NOW);

    // Forked spore — wrong genesis hash, also fresh.
    agg.ingest("gamma", buildHeartbeat(0xDEAD_BEEF >>> 0, 1), NOW);

    // Voter — heartbeats + warrant votes, fresh.
    agg.ingest("delta", buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW - 100);
    agg.ingest("delta", buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW - 50);
    agg.ingest("delta", buildWarrantVote(0xCAFE_BABE, 0, true, 3), NOW - 25);
    agg.ingest("delta", buildWarrantVote(0xCAFE_BABE, 0, true, 4), NOW);

    // Lost spore — last heartbeat was 60 seconds before NOW.
    agg.ingest("epsilon", buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW - 70_000);
    agg.ingest("epsilon", buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW - 60_000);
    agg.sweep(NOW);

    console.log("=== OMEGA-64 Spore Relay HUD (self-test) ===");
    console.log(renderHud(agg));

    // Sanity asserts.
    const counts = agg.countByHealth();
    if (counts.healthy < 1) throw new Error("self-test: expected ≥1 healthy");
    if (counts.stalled < 1) throw new Error("self-test: expected ≥1 stalled");
    if (counts.forked < 1) throw new Error("self-test: expected ≥1 forked");
    if (counts.lost < 1) throw new Error("self-test: expected ≥1 lost");
    console.log("\n✅ Self-test classes confirmed: healthy, stalled, forked, lost.");
}

async function streamMode() {
    const agg = new LivenessAggregator({ classifyAfter: 1 });
    const reader = Deno.stdin.readable.getReader();
    let scratch = new Uint8Array(0);
    let frame_idx = 0;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        // Append to scratch buffer.
        const merged = new Uint8Array(scratch.length + value.length);
        merged.set(scratch, 0);
        merged.set(value, scratch.length);
        scratch = merged;
        // Drain whole frames as long as we can find a magic + 32 bytes.
        while (true) {
            const sync = findSync(scratch);
            if (sync === null || scratch.length - sync < SPORE_FRAME_BYTES) break;
            const candidate = scratch.subarray(sync, sync + SPORE_FRAME_BYTES);
            const frame = frameFromBytes(candidate);
            if (!frame) {
                // Skip 1 byte and try again — the magic match was a false positive.
                scratch = scratch.subarray(sync + 1);
                continue;
            }
            // Frame valid. Use the first 4 hex chars of payload_a as a stable
            // pseudo-spore-id; in production you'd carry it explicitly.
            const spore_id = `spore-${frame.payloadB.toString(16).padStart(8, "0")}`;
            agg.ingest(spore_id, frame, performance.now());
            scratch = scratch.subarray(sync + SPORE_FRAME_BYTES);
            frame_idx++;
            if (frame_idx % 5 === 0) {
                console.clear();
                console.log(renderHud(agg));
            }
        }
    }
    console.log("\n=== Final HUD ===");
    console.log(renderHud(agg));
}

if (import.meta.main) {
    if (Deno.args.includes("--self-test")) {
        selfTest();
    } else {
        await streamMode();
    }
}
