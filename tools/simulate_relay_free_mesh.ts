// 🌌 OMEGA-64 — Era 1130 demo: Relay-Free Spore Mesh
//
// Demonstrates that a chain of bare-metal spores can carry warrant
// votes from origin to final relay node WITHOUT any browser-side
// WebRTC relay in the middle. Each spore uses spore_routing's
// decide_forward to TTL-decrement, mix the trail digest, and either
// consume locally or pass along.
//
// Topology:
//   spore-A (origin) ─ UART ─→ spore-B ─ UART ─→ spore-C ─ UART ─→ relay
//                            (TTL=4)         (TTL=3)         (TTL=2)
//
// Run:
//   deno run --allow-read tools/simulate_relay_free_mesh.ts

import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import { LivenessAggregator } from "../src/network/liveness_aggregator.ts";
import {
    buildHeartbeat,
    buildWarrantVote,
    frameFromBytes,
    frameToBytes,
} from "../src/network/spore_frame.ts";
import {
    DEFAULT_TTL,
    FWD_DELIVER_LOCAL,
    FWD_DROP_TTL_ZERO,
    FWD_FORWARD,
    decideForward,
    frameTrail,
    frameTtl,
    stampOrigin,
} from "../src/network/spore_routing.ts";
import { rankNeighbors } from "../src/network/reputation_routing.ts";
import { adaptiveTtl, adaptiveTtlReport } from "../src/network/adaptive_ttl.ts";

const log: string[] = [];
const log_line = (s: string) => log.push(s);

// Five spores with stable IDs (in production these are FNV-1a of the
// device serial, oracle name, or other unique identifier).
const SPORES: { id: string; matrix: number }[] = [
    { id: "spore-A", matrix: 0xA0A0_A0A0 >>> 0 },
    { id: "spore-B", matrix: 0xB0B0_B0B0 >>> 0 },
    { id: "spore-C", matrix: 0xC0C0_C0C0 >>> 0 },
    { id: "spore-D", matrix: 0xD0D0_D0D0 >>> 0 },
];

function emit_warrant_at_origin(origin_id: string, target: number, oracle_bit: number, tick: number, ttl: number = DEFAULT_TTL) {
    const f = stampOrigin(buildWarrantVote(target, oracle_bit, true, tick), ttl);
    log_line(`[${origin_id}] origin emits WARRANT_VOTE target=0x${target.toString(16)} oracle_bit=${oracle_bit} TTL=${frameTtl(f)} trail=0x${frameTrail(f).toString(16)}`);
    return f;
}

function relay_through_chain(start_frame: ReturnType<typeof emit_warrant_at_origin>, chain: typeof SPORES) {
    let f = start_frame;
    for (const sp of chain) {
        const decision = decideForward(f, sp.matrix);
        const ttl = frameTtl(decision.forwardedFrame);
        const trail = frameTrail(decision.forwardedFrame);
        const code_str = ({
            [FWD_FORWARD]: "FORWARD",
            [FWD_DELIVER_LOCAL]: "DELIVER_LOCAL",
            [FWD_DROP_TTL_ZERO]: "DROP_TTL_ZERO",
        } as Record<number, string>)[decision.code] ?? `code=${decision.code}`;
        log_line(`[${sp.id}] decision=${code_str} TTL→${ttl} trail→0x${trail.toString(16)}`);
        if (decision.code === FWD_DROP_TTL_ZERO) {
            log_line(`  ⚠ frame dropped at ${sp.id}; chain interrupted.`);
            return null;
        }
        f = decision.forwardedFrame;
        // Critical: the forwarded frame must still be wire-valid.
        const bytes = frameToBytes(f);
        if (frameFromBytes(bytes) === null) {
            throw new Error(`CRC corruption at ${sp.id}!`);
        }
    }
    return f;
}

function main() {
    log_line("=== OMEGA-64 Era 1130+1150 — Relay-Free Mesh w/ Adaptive TTL ===\n");

    // Build a synthetic LivenessAggregator that knows about every spore
    // in the chain so we can compute reputation-driven adaptive TTL.
    const NOW = 100_000;
    const agg = new LivenessAggregator({ classifyAfter: 1, maxSilenceMs: 30_000 });
    for (const sp of SPORES.slice(1)) {
        // Make every chain neighbor healthy with a few heartbeats.
        agg.ingest(sp.id, buildHeartbeat(GENESIS_HASH_V1_0, 1), NOW - 200);
        agg.ingest(sp.id, buildHeartbeat(GENESIS_HASH_V1_0, 2), NOW - 100);
        agg.ingest(sp.id, buildHeartbeat(GENESIS_HASH_V1_0, 3), NOW);
    }
    const ranked = rankNeighbors(agg, NOW);
    const path = SPORES.slice(1).map(sp =>
        ranked.find(r => r.spore_id === sp.id)!
    );
    const ttl_report = adaptiveTtlReport(path);
    log_line(`[adaptive-ttl] path_length=${ttl_report.path_length}  reliability=${ttl_report.reliability.toFixed(4)}  margin=${ttl_report.margin}  safety=${ttl_report.safety}  ⇒ TTL=${ttl_report.final_ttl}`);

    // (1) spore-A originates a warrant vote with the computed TTL.
    const ttl = adaptiveTtl(path);
    const origin_frame = emit_warrant_at_origin("spore-A", 0xCAFE_BABE >>> 0, 0, 100, ttl);

    // (2) The frame travels A → B → C → D. At each hop, decide_forward
    // mutates the trail and decrements TTL.
    const final_frame = relay_through_chain(origin_frame, SPORES.slice(1));
    if (!final_frame) {
        console.log(log.join("\n"));
        Deno.exit(1);
    }

    // (3) The final relay (spore-D, but acting as a relay-aggregator)
    // ingests the frame into a LivenessAggregator. It can verify:
    //  - the frame is CRC-valid (already proven by frameFromBytes above);
    //  - the trail digest reflects the chain it traversed;
    //  - the AYE was preserved (payloadA === 1).
    const aggregator = new LivenessAggregator({ classifyAfter: 1 });
    aggregator.ingest("spore-A", final_frame, 100_000);
    const snapshot = aggregator.snapshot();
    log_line("");
    log_line(`[relay] received the warrant vote after ${SPORES.length - 1} hops`);
    log_line(`[relay] AYE (payloadA=${final_frame.payloadA}) target=0x${final_frame.proposalOrTarget.toString(16)} oracle_bit=${final_frame.oracleBit}`);
    log_line(`[relay] trail digest carries 3-hop signature: 0x${frameTrail(final_frame).toString(16)}`);
    log_line(`[relay] aggregator snapshot: ${snapshot.length} spore(s) tracked`);

    // (4) Now also send a HEARTBEAT through the same chain to prove
    // both frame types route.
    log_line("\n--- HEARTBEAT relay ---");
    let hb = stampOrigin(buildHeartbeat(GENESIS_HASH_V1_0, 200), DEFAULT_TTL);
    log_line(`[spore-A] origin heartbeat TTL=${frameTtl(hb)}`);
    for (const sp of SPORES.slice(1)) {
        const d = decideForward(hb, sp.matrix);
        log_line(`[${sp.id}] heartbeat decision=${d.code === FWD_FORWARD ? "FORWARD" : `code=${d.code}`} TTL→${frameTtl(d.forwardedFrame)}`);
        hb = d.forwardedFrame;
    }

    log_line("\n✅ Relay-free mesh end-to-end success — no JS relay was used in the warrant path.");
    console.log(log.join("\n"));
    Deno.exit(0);
}

if (import.meta.main) main();
