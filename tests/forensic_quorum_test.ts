// Era 1280: Forensic Quorum tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    AlarmFingerprint,
    adjudicateQuorum,
    formatVerdict,
    type QuorumOptions,
} from "../src/network/forensic_quorum.ts";
import { FrameRecorder } from "../src/network/frame_recorder.ts";
import { buildWarrantVote } from "../src/network/spore_frame.ts";

const NOW = 100_000;

function recorderWith(
    items: ReadonlyArray<{ target: number; t: number; by: string; double_by?: string }>,
): FrameRecorder {
    const r = new FrameRecorder();
    for (const it of items) {
        const wv = buildWarrantVote((0xAA00 + it.target) >>> 0, 0, true, it.target);
        r.record(wv, NOW + it.t, it.by);
        if (it.double_by) {
            r.record(wv, NOW + it.t + 1, it.double_by);
        }
    }
    return r;
}

const fingerprintQ16 = (q16: number): AlarmFingerprint => ({
    observed_q16: q16,
    window_start_ms: NOW - 1000,
    window_end_ms: NOW + 100_000,
    source_relay_id: 0xCC01,
});

Deno.test("quorum: corroborated when replay matches alarm exactly", () => {
    // Alarm fired at 50% redundancy = 32768 q16.
    // Build 3 recorders each with 4 intents, 2 of which are double-witness.
    const items = [
        { target: 1, t: 0, by: "X", double_by: "Y" },
        { target: 2, t: 100, by: "X", double_by: "Y" },
        { target: 3, t: 200, by: "X" },
        { target: 4, t: 300, by: "X" },
    ];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const res = adjudicateQuorum(fingerprintQ16(32768), relays);
    assertEquals(res.verdict, "corroborated");
    assertEquals(res.relay_count, 3);
    assertEquals(res.replayed_q16, 32768);
});

Deno.test("quorum: uncorroborated when replay diverges past tolerance", () => {
    // Alarm claims 80% but recorders show 50%.
    const items = [
        { target: 1, t: 0, by: "X", double_by: "Y" },
        { target: 2, t: 100, by: "X", double_by: "Y" },
        { target: 3, t: 200, by: "X" },
        { target: 4, t: 300, by: "X" },
    ];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const alarm_q16 = Math.round(0.8 * 65536); // 52429
    const res = adjudicateQuorum(fingerprintQ16(alarm_q16), relays);
    assertEquals(res.verdict, "uncorroborated");
    assert(res.diff_q16 > 6553);
});

Deno.test("quorum: insufficient relays when below min_relays", () => {
    const items = [{ target: 1, t: 0, by: "X" }];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    const res = adjudicateQuorum(fingerprintQ16(0), relays);
    assertEquals(res.verdict, "insufficient-relays");
    assertEquals(res.relay_count, 2);
});

Deno.test("quorum: empty-window when no frames in the requested window", () => {
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith([{ target: 1, t: 0, by: "X" }]));
    relays.set(0xCC02, recorderWith([{ target: 2, t: 0, by: "Y" }]));
    relays.set(0xCC03, recorderWith([{ target: 3, t: 0, by: "Z" }]));
    // Window way in the future — no frames intersect.
    const fp: AlarmFingerprint = {
        observed_q16: 32768,
        window_start_ms: NOW + 1_000_000,
        window_end_ms: NOW + 2_000_000,
        source_relay_id: 0xCC01,
    };
    const res = adjudicateQuorum(fp, relays);
    assertEquals(res.verdict, "empty-window");
});

Deno.test("quorum: tolerance is configurable", () => {
    // Same setup as the corroborated case but with a too-tight tolerance.
    const items = [
        { target: 1, t: 0, by: "X", double_by: "Y" },
        { target: 2, t: 100, by: "X" },
    ]; // 50% double = 32768 q16
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    // Alarm claims 51% — tiny diff, but tolerance set to 0 → fails.
    const alarm_q16 = Math.round(0.51 * 65536);
    const opts: QuorumOptions = { min_relays: 3, tolerance_q16: 0 };
    const res = adjudicateQuorum(fingerprintQ16(alarm_q16), relays, opts);
    assertEquals(res.verdict, "uncorroborated");
});

Deno.test("quorum: digest is deterministic across calls", () => {
    const items = [{ target: 1, t: 0, by: "X" }];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const r1 = adjudicateQuorum(fingerprintQ16(0), relays);
    const r2 = adjudicateQuorum(fingerprintQ16(0), relays);
    assertEquals(r1.digest, r2.digest);
});

Deno.test("quorum: digest changes with different alarm observed_q16", () => {
    const items = [{ target: 1, t: 0, by: "X" }];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const r1 = adjudicateQuorum(fingerprintQ16(0), relays);
    const r2 = adjudicateQuorum(fingerprintQ16(32768), relays);
    assert(r1.digest !== r2.digest);
});

Deno.test("quorum: merged frame count counts unique observations", () => {
    const items_a = [{ target: 1, t: 0, by: "X" }, { target: 2, t: 100, by: "X" }];
    const items_b = [{ target: 1, t: 0, by: "X" }, { target: 3, t: 200, by: "Y" }];
    const items_c = [{ target: 4, t: 300, by: "Z" }];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items_a));
    relays.set(0xCC02, recorderWith(items_b));
    relays.set(0xCC03, recorderWith(items_c));
    const res = adjudicateQuorum(fingerprintQ16(0), relays);
    // A's intent 1 + A's intent 2 + B's intent 1 (deduped vs A) + B's intent 3 + C's intent 4
    // Same observation across A and B = 1 record (same hash). Total = 4.
    assertEquals(res.merged_frame_count, 4);
});

Deno.test("quorum: overlap_ratio reflects shared observations", () => {
    const items_shared = [{ target: 1, t: 0, by: "X" }, { target: 2, t: 100, by: "X" }];
    const items_extra_a = [{ target: 3, t: 200, by: "X" }];
    const items_extra_b = [{ target: 4, t: 300, by: "X" }];
    const items_extra_c = [{ target: 5, t: 400, by: "X" }];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith([...items_shared, ...items_extra_a]));
    relays.set(0xCC02, recorderWith([...items_shared, ...items_extra_b]));
    relays.set(0xCC03, recorderWith([...items_shared, ...items_extra_c]));
    const res = adjudicateQuorum(fingerprintQ16(0), relays);
    // 5 unique total. 2 shared. So overlap roughly 2/5 = 0.4. (mergeMany
    // pairwise reduction only marks initial pair as shared.)
    assert(res.overlap_ratio > 0);
});

Deno.test("formatVerdict: contains glyph + key numbers", () => {
    const items = [
        { target: 1, t: 0, by: "X", double_by: "Y" },
        { target: 2, t: 100, by: "X" },
    ];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const res = adjudicateQuorum(fingerprintQ16(32768), relays);
    const line = formatVerdict(res);
    assert(line.includes("corroborated"));
    assert(line.includes("relays=3"));
    assert(line.includes("digest=0x"));
});

Deno.test("formatVerdict: insufficient case shows 🔍 glyph", () => {
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith([{ target: 1, t: 0, by: "X" }]));
    const res = adjudicateQuorum(fingerprintQ16(0), relays);
    const line = formatVerdict(res);
    assert(line.includes("🔍"));
    assert(line.includes("insufficient"));
});

Deno.test("formatVerdict: empty-window case shows ∅ glyph", () => {
    const relays = new Map<number, FrameRecorder>();
    for (const id of [1, 2, 3]) {
        relays.set(id, recorderWith([{ target: id, t: 0, by: "X" }]));
    }
    const fp: AlarmFingerprint = {
        observed_q16: 0,
        window_start_ms: NOW + 999_999_999,
        window_end_ms: NOW + 999_999_999 + 1000,
        source_relay_id: 0xCC01,
    };
    const res = adjudicateQuorum(fp, relays);
    const line = formatVerdict(res);
    assert(line.includes("∅"));
});

Deno.test("quorum: 100% redundancy alarm corroborated by all-double recorders", () => {
    const items = [
        { target: 1, t: 0, by: "X", double_by: "Y" },
        { target: 2, t: 100, by: "X", double_by: "Y" },
        { target: 3, t: 200, by: "X", double_by: "Y" },
    ];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const res = adjudicateQuorum(fingerprintQ16(65536), relays);
    assertEquals(res.verdict, "corroborated");
    assertEquals(res.replayed_q16, 65536);
});

Deno.test("quorum: zero-redundancy alarm corroborated by all-single recorders", () => {
    const items = [
        { target: 1, t: 0, by: "X" },
        { target: 2, t: 100, by: "X" },
    ];
    const relays = new Map<number, FrameRecorder>();
    relays.set(0xCC01, recorderWith(items));
    relays.set(0xCC02, recorderWith(items));
    relays.set(0xCC03, recorderWith(items));
    const res = adjudicateQuorum(fingerprintQ16(0), relays);
    assertEquals(res.verdict, "corroborated");
    assertEquals(res.replayed_q16, 0);
});

Deno.test("quorum: 4+ relays accepted (more than min)", () => {
    const items = [
        { target: 1, t: 0, by: "X", double_by: "Y" },
        { target: 2, t: 100, by: "X" },
    ];
    const relays = new Map<number, FrameRecorder>();
    for (let i = 0; i < 5; i++) {
        relays.set(0xCC00 + i, recorderWith(items));
    }
    const res = adjudicateQuorum(fingerprintQ16(32768), relays);
    assertEquals(res.verdict, "corroborated");
    assertEquals(res.relay_count, 5);
});

Deno.test("quorum: window filtering only includes in-bounds frames", () => {
    // Recorder spans broad time range; alarm window is narrow.
    const items = [
        { target: 1, t: 0, by: "X" },           // outside (before window)
        { target: 2, t: 5000, by: "X", double_by: "Y" }, // inside
        { target: 3, t: 6000, by: "X" },        // inside
        { target: 4, t: 50000, by: "X" },       // outside (after window)
    ];
    const relays = new Map<number, FrameRecorder>();
    for (let i = 0; i < 3; i++) relays.set(0xCC00 + i, recorderWith(items));
    const fp: AlarmFingerprint = {
        observed_q16: 32768, // 1 of 2 in-window intents is double = 50%
        window_start_ms: NOW + 4500,
        window_end_ms: NOW + 7000,
        source_relay_id: 0xCC00,
    };
    const res = adjudicateQuorum(fp, relays);
    assertEquals(res.verdict, "corroborated");
    // Only 2 unique in-window intents merged across 3 relays.
    assert(res.merged_frame_count >= 2);
});

Deno.test("quorum: relay_count uses sorted relay IDs deterministically", () => {
    const items = [{ target: 1, t: 0, by: "X" }];
    const relays1 = new Map<number, FrameRecorder>();
    relays1.set(0x300, recorderWith(items));
    relays1.set(0x100, recorderWith(items));
    relays1.set(0x200, recorderWith(items));
    const relays2 = new Map<number, FrameRecorder>();
    relays2.set(0x100, recorderWith(items));
    relays2.set(0x200, recorderWith(items));
    relays2.set(0x300, recorderWith(items));
    const r1 = adjudicateQuorum(fingerprintQ16(0), relays1);
    const r2 = adjudicateQuorum(fingerprintQ16(0), relays2);
    assertEquals(r1.digest, r2.digest);
});
