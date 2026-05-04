// Era 1290: Quorum broadcast + agreement tracker tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    QuorumAgreementTracker,
    codeToVerdict,
    decodeQuorumFrame,
    frameFromQuorum,
    verdictToCode,
} from "../src/network/quorum_broadcast.ts";
import {
    FRAME_TYPE_QUORUM_VERDICT,
    buildHeartbeat,
    buildQuorumVerdict,
    computeFrameCrc,
    frameFromBytes,
    frameToBytes,
} from "../src/network/spore_frame.ts";
import { GENESIS_HASH_V1_0 } from "../src/network/genesis_inscription.ts";
import { QuorumResult } from "../src/network/forensic_quorum.ts";

const NOW = 100_000;

function quorumResult(digest: number, verdict: QuorumResult["verdict"] = "corroborated"): QuorumResult {
    return {
        verdict,
        relay_count: 3,
        replayed_q16: 32768,
        diff_q16: 100,
        overlap_ratio: 0.5,
        merged_frame_count: 12,
        digest: digest >>> 0,
    };
}

Deno.test("verdictToCode/codeToVerdict round-trip all 4 values", async () => {
    for (const v of ["corroborated", "uncorroborated", "insufficient-relays", "empty-window"] as const) {
        assertEquals(codeToVerdict(verdictToCode(v)), v);
    }
});

Deno.test("codeToVerdict masks to low 2 bits (only 4 verdicts)", async () => {
    // 99 & 0x03 = 3 → "empty-window"
    assertEquals(codeToVerdict(99), "empty-window");
    // 0xFF & 0x03 = 3 → "empty-window"
    assertEquals(codeToVerdict(0xFF), "empty-window");
    // 4 & 0x03 = 0 → "corroborated"
    assertEquals(codeToVerdict(4), "corroborated");
});

Deno.test("frame round-trips bit-for-bit through CRC", async () => {
    const f = buildQuorumVerdict(0xDEAD_BEEF, 0xCC01, 0, 4, 75, 32768, 100, NOW & 0xFFFF_FFFF);
    const bytes = frameToBytes(f);
    const parsed = frameFromBytes(bytes);
    assert(parsed !== null);
    assertEquals(parsed!.frameType, FRAME_TYPE_QUORUM_VERDICT);
    const decoded = decodeQuorumFrame(parsed!);
    assert(decoded !== null);
    assertEquals(decoded!.digest, 0xDEAD_BEEF);
    assertEquals(decoded!.source_relay_id, 0xCC01);
    assertEquals(decoded!.verdict, "corroborated");
    assertEquals(decoded!.relay_count, 4);
    assertEquals(decoded!.overlap_pct, 75);
    assertEquals(decoded!.replayed_q16, 32768);
    assertEquals(decoded!.diff_q16, 100);
});

Deno.test("frameFromQuorum builds a valid frame from a QuorumResult", async () => {
    const res = quorumResult(0x1234);
    const frame = frameFromQuorum(res, 0xCC01, NOW);
    frame.crc32 = computeFrameCrc(frame);
    const decoded = decodeQuorumFrame(frame);
    assert(decoded !== null);
    assertEquals(decoded!.digest, 0x1234);
    assertEquals(decoded!.verdict, "corroborated");
    assertEquals(decoded!.relay_count, 3);
});

Deno.test("decodeQuorumFrame rejects non-quorum frame types", async () => {
    const hb = buildHeartbeat(GENESIS_HASH_V1_0, 1);
    assertEquals(decodeQuorumFrame(hb), null);
});

Deno.test("u8/u16 clamping prevents overflow", async () => {
    const f = buildQuorumVerdict(0xAA, 0xBB, 999, 999, 999, 0xFFFFFFFF, 0xFFFFFFFF, 0);
    const decoded = decodeQuorumFrame(f)!;
    assertEquals(decoded.relay_count, 255);
    assertEquals(decoded.overlap_pct, 255);
    assertEquals(decoded.replayed_q16, 0xFFFF);
    assertEquals(decoded.diff_q16, 0xFFFF);
});

Deno.test("tracker: first observation is lone confidence", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    const rec = t.observe(f, 0xCC01, NOW);
    assertEquals(rec.confidence, "lone");
    assertEquals(rec.adjudicators.length, 1);
});

Deno.test("tracker: two distinct broadcasters → double confidence", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    t.observe(f, 0xCC01, NOW);
    const rec = t.observe(f, 0xCC02, NOW + 100);
    assertEquals(rec.confidence, "double");
    assertEquals(rec.adjudicators.length, 2);
});

Deno.test("tracker: three distinct broadcasters → triple+ (high confidence)", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    t.observe(f, 0xCC01, NOW);
    t.observe(f, 0xCC02, NOW + 100);
    const rec = t.observe(f, 0xCC03, NOW + 200);
    assertEquals(rec.confidence, "triple+");
    assertEquals(rec.adjudicators.length, 3);
});

Deno.test("tracker: same broadcaster twice doesn't double-count", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    t.observe(f, 0xCC01, NOW);
    const rec = t.observe(f, 0xCC01, NOW + 100);
    assertEquals(rec.adjudicators.length, 1);
    assertEquals(rec.confidence, "lone");
});

Deno.test("tracker: distinct digests tracked separately", async () => {
    const t = new QuorumAgreementTracker();
    const f1 = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    const f2 = buildQuorumVerdict(0xBB, 0xCC01, 1, 3, 50, 32768, 100, NOW & 0xFFFFFFFF);
    t.observe(f1, 0xCC01, NOW);
    t.observe(f2, 0xCC01, NOW + 100);
    assertEquals(t.size(), 2);
});

Deno.test("tracker: list orders by adjudicators desc, first_seen asc", async () => {
    const t = new QuorumAgreementTracker();
    // Digest 1: 1 adjudicator
    const f1 = buildQuorumVerdict(0x01, 0xCC01, 0, 3, 50, 0, 0, 0);
    t.observe(f1, 0xCC01, NOW);
    // Digest 2: 3 adjudicators (high)
    const f2 = buildQuorumVerdict(0x02, 0xCC01, 0, 3, 50, 0, 0, 0);
    t.observe(f2, 0xCC01, NOW + 100);
    t.observe(f2, 0xCC02, NOW + 200);
    t.observe(f2, 0xCC03, NOW + 300);
    // Digest 3: 2 adjudicators (double)
    const f3 = buildQuorumVerdict(0x03, 0xCC01, 0, 3, 50, 0, 0, 0);
    t.observe(f3, 0xCC01, NOW + 400);
    t.observe(f3, 0xCC02, NOW + 500);
    const list = t.list();
    assertEquals(list[0].digest, 0x02); // triple+
    assertEquals(list[1].digest, 0x03); // double
    assertEquals(list[2].digest, 0x01); // lone
});

Deno.test("tracker: highConfidenceVerdicts filters correctly", async () => {
    const t = new QuorumAgreementTracker();
    const f1 = buildQuorumVerdict(0x01, 0xCC01, 0, 3, 50, 0, 0, 0);
    for (const id of [0xCC01, 0xCC02, 0xCC03]) t.observe(f1, id, NOW);
    const f2 = buildQuorumVerdict(0x02, 0xCC01, 0, 3, 50, 0, 0, 0);
    t.observe(f2, 0xCC01, NOW);
    t.observe(f2, 0xCC02, NOW); // only double
    const high = t.highConfidenceVerdicts();
    assertEquals(high.length, 1);
    assertEquals(high[0].digest, 0x01);
});

Deno.test("tracker: rejects non-quorum frame types", async () => {
    const t = new QuorumAgreementTracker();
    const hb = buildHeartbeat(GENESIS_HASH_V1_0, 1);
    assertThrows(() => t.observe(hb, 0xCC01, NOW));
});

Deno.test("tracker: capacity bound evicts oldest digest", async () => {
    const t = new QuorumAgreementTracker({ capacity: 2 });
    for (const d of [0x01, 0x02, 0x03]) {
        const f = buildQuorumVerdict(d, 0xCC01, 0, 3, 50, 0, 0, 0);
        t.observe(f, 0xCC01, NOW + d);
    }
    assertEquals(t.size(), 2);
    assertEquals(t.get(0x01), undefined);
    assert(t.get(0x02) !== undefined);
    assert(t.get(0x03) !== undefined);
});

Deno.test("tracker: adjudicators is sorted ascending", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 0, 0, 0);
    for (const id of [0x300, 0x100, 0x200]) t.observe(f, id, NOW);
    const rec = t.get(0xAA)!;
    assertEquals(rec.adjudicators, [0x100, 0x200, 0x300]);
});

Deno.test("tracker: configurable high_confidence_threshold", async () => {
    const t = new QuorumAgreementTracker({ high_confidence_threshold: 5 });
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 0, 0, 0);
    for (let i = 0; i < 4; i++) t.observe(f, 0xCC00 + i, NOW);
    assertEquals(t.get(0xAA)!.confidence, "double"); // 4 < 5 threshold
    t.observe(f, 0xCC04, NOW + 100);
    assertEquals(t.get(0xAA)!.confidence, "triple+"); // 5 hits threshold
});

Deno.test("tracker: invalid options throw", async () => {
    assertThrows(() => new QuorumAgreementTracker({ capacity: 0 }));
    assertThrows(() => new QuorumAgreementTracker({ high_confidence_threshold: 1 }));
});

Deno.test("tracker: clear empties everything", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 0, 0, 0);
    t.observe(f, 0xCC01, NOW);
    t.clear();
    assertEquals(t.size(), 0);
});

Deno.test("tracker: timestamps tracked across observations", async () => {
    const t = new QuorumAgreementTracker();
    const f = buildQuorumVerdict(0xAA, 0xCC01, 0, 3, 50, 0, 0, 0);
    t.observe(f, 0xCC01, 1000);
    t.observe(f, 0xCC02, 5000);
    const rec = t.get(0xAA)!;
    assertEquals(rec.first_seen_at_ms, 1000);
    assertEquals(rec.last_seen_at_ms, 5000);
});

Deno.test("frameFromQuorum: overlap_ratio rounded to integer percent", async () => {
    const res = quorumResult(0xAA);
    res.overlap_ratio = 0.667; // ≈66.7% → 67 rounded
    const frame = frameFromQuorum(res, 0xCC01, NOW);
    const decoded = decodeQuorumFrame(frame)!;
    assertEquals(decoded.overlap_pct, 67);
});

Deno.test("FRAME_TYPE_QUORUM_VERDICT constant matches Rust", async () => {
    assertEquals(FRAME_TYPE_QUORUM_VERDICT, 7);
});
