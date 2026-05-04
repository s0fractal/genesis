// Era 1040 Phase 2: cross-check the TS log reader against the same byte
// layout the Rust kernel emits.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    drainMitosisLog,
    MITOSIS_LOG_CAPACITY,
    MITOSIS_RECEIPT_SIZE,
} from "../src/network/mitosis_log_reader.ts";
import { childReceiptHash, deriveMitosisChild } from "../src/network/mitosis_proof.ts";

function makeLog(): Uint8Array {
    return new Uint8Array(16 + MITOSIS_LOG_CAPACITY * MITOSIS_RECEIPT_SIZE);
}

function writeAgent(view: DataView, off: number, a: {
    phase: number; energy: number; base_freq: number; state_flags: number;
    genome: number; memory: [number, number, number];
}) {
    view.setUint32(off + 0, a.phase >>> 0, true);
    view.setUint32(off + 4, a.energy >>> 0, true);
    view.setInt32(off + 8, a.base_freq | 0, true);
    view.setUint32(off + 12, a.state_flags >>> 0, true);
    view.setUint32(off + 16, a.genome >>> 0, true);
    view.setUint32(off + 20, a.memory[0] >>> 0, true);
    view.setUint32(off + 24, a.memory[1] >>> 0, true);
    view.setUint32(off + 28, a.memory[2] >>> 0, true);
}

Deno.test("drainMitosisLog: empty log produces no receipts", async () => {
    const buf = makeLog();
    const { receipts, nowSeen } = drainMitosisLog(buf, 0);
    assertEquals(receipts.length, 0);
    assertEquals(nowSeen, 0);
});

Deno.test("drainMitosisLog: single receipt round-trips", async () => {
    const buf = makeLog();
    const view = new DataView(buf.buffer);
    // Header: head=1, total=1.
    view.setUint32(0, 1, true);
    view.setUint32(4, 1, true);
    // Slot 0.
    const slotOff = 16;
    const parent = {
        phase: 64, energy: 3000, base_freq: 7, state_flags: 0,
        genome: 0xCAFE_BABE >>> 0,
        memory: [0xDEAD_BEEF >>> 0, 1, 2] as [number, number, number],
    };
    const child = deriveMitosisChild(parent, [], 7);
    writeAgent(view, slotOff + 0, parent);
    writeAgent(view, slotOff + 32, child);
    // Empty attractor array (count=0).
    view.setUint32(slotOff + 64, 0, true);
    // q_phase + receipt_hash + tick.
    view.setUint32(slotOff + 144, 7, true);
    const _h1 = await childReceiptHash(child);
    for (let i=0; i<32; i++) view.setUint8(slotOff + 148 + i, parseInt(_h1.slice(i*2, i*2+2), 16));
    view.setUint32(slotOff + 180, 100, true);

    const { receipts, nowSeen } = drainMitosisLog(buf, 0);
    assertEquals(receipts.length, 1);
    assertEquals(nowSeen, 1);
    const r = receipts[0];
    assertEquals(r.parent.energy, 3000);
    assertEquals(r.parent.genome, 0xCAFE_BABE >>> 0);
    assertEquals(r.child.phase, child.phase);
    assertEquals(r.child.genome, child.genome);
    assertEquals(r.qPhase, 7);
    assertEquals(r.receiptHash, await childReceiptHash(child));
    assertEquals(r.tick, 100);
    assertEquals(r.attractors.length, 0);

    // Round-trip verification: re-derive must match.
    const rederived = deriveMitosisChild(r.parent, r.attractors, r.qPhase);
    assertEquals(rederived.genome, r.child.genome);
});

Deno.test("drainMitosisLog: lastSeen suppresses already-drained entries", async () => {
    const buf = makeLog();
    const view = new DataView(buf.buffer);
    view.setUint32(0, 3, true);  // head = 3
    view.setUint32(4, 3, true);  // total = 3
    for (let i = 0; i < 3; i++) {
        const off = 16 + i * MITOSIS_RECEIPT_SIZE;
        writeAgent(view, off + 0, {
            phase: 1, energy: 100 + i, base_freq: 0, state_flags: 0,
            genome: 0xAA00 + i, memory: [0, 0, 0],
        });
        writeAgent(view, off + 32, {
            phase: 2, energy: 1000, base_freq: 0, state_flags: 0,
            genome: i, memory: [0, 0, 0],
        });
        view.setUint32(off + 64, 0, true);
        view.setUint32(off + 144, 7, true);
        view.setUint32(off + 148, 0, true);
        view.setUint32(off + 180, i, true);
    }
    const { receipts, nowSeen } = drainMitosisLog(buf, 2);
    assertEquals(receipts.length, 1);
    assertEquals(receipts[0].child.genome, 2);
    assertEquals(nowSeen, 3);
});

Deno.test("drainMitosisLog: writer overflow drops oldest entries", async () => {
    const buf = makeLog();
    const view = new DataView(buf.buffer);
    // Simulate writer that pushed 50 entries — only last 32 are recoverable.
    view.setUint32(0, 50 % MITOSIS_LOG_CAPACITY, true);
    view.setUint32(4, 50, true);
    // Fill all 32 slots with sequential genomes 18..49.
    for (let slot = 0; slot < MITOSIS_LOG_CAPACITY; slot++) {
        const off = 16 + slot * MITOSIS_RECEIPT_SIZE;
        // Map slot back to logical index: head = 50 % 32 = 18, so slot 18 was written
        // most recently as logical idx 49. Generally: logical = total - lookback,
        // where lookback = (head - slot - 1) mod CAPACITY + 1. We just write the
        // identifying integer into genome at agent[1].genome.
        const lookback = ((50 % MITOSIS_LOG_CAPACITY) - slot - 1 + MITOSIS_LOG_CAPACITY) % MITOSIS_LOG_CAPACITY + 1;
        const logical = 50 - lookback;
        writeAgent(view, off + 0, {
            phase: 0, energy: 0, base_freq: 0, state_flags: 0,
            genome: logical, memory: [0, 0, 0],
        });
        writeAgent(view, off + 32, {
            phase: 0, energy: 0, base_freq: 0, state_flags: 0,
            genome: logical, memory: [0, 0, 0],
        });
        view.setUint32(off + 64, 0, true);
        view.setUint32(off + 144, 7, true);
        view.setUint32(off + 148, 0, true);
        view.setUint32(off + 180, logical, true);
    }
    // Reader thinks it has seen 5; actual range starts at 18.
    const { receipts } = drainMitosisLog(buf, 5);
    assertEquals(receipts.length, MITOSIS_LOG_CAPACITY);
    // Receipts must come back in monotonic order: 18, 19, ..., 49.
    for (let i = 0; i < receipts.length; i++) {
        assertEquals(receipts[i].tick, 18 + i, `out-of-order at i=${i}`);
    }
});

Deno.test("drainMitosisLog: attractor snapshot round-trips", async () => {
    const buf = makeLog();
    const view = new DataView(buf.buffer);
    view.setUint32(0, 1, true);
    view.setUint32(4, 1, true);
    const off = 16;
    writeAgent(view, off + 0, {
        phase: 0, energy: 0, base_freq: 0, state_flags: 0,
        genome: 0, memory: [0, 0, 0],
    });
    writeAgent(view, off + 32, {
        phase: 0, energy: 0, base_freq: 0, state_flags: 0,
        genome: 0, memory: [0, 0, 0],
    });
    // 2 attractors.
    view.setUint32(off + 64, 2, true);
    // Slot 0.
    view.setUint32(off + 80, 0xABCD_1234, true);
    view.setUint32(off + 84, ~0xABCD_1234 >>> 0, true);
    view.setUint32(off + 88, 256, true);
    view.setUint32(off + 92, 512, true);
    // Slot 1.
    view.setUint32(off + 96, 0xDEAD_BEEF, true);
    view.setUint32(off + 100, ~0xDEAD_BEEF >>> 0, true);
    view.setUint32(off + 104, 100, true);
    view.setUint32(off + 108, 200, true);
    view.setUint32(off + 144, 7, true);
    view.setUint32(off + 148, 0, true);
    view.setUint32(off + 180, 0, true);

    const { receipts } = drainMitosisLog(buf, 0);
    assertEquals(receipts.length, 1);
    assertEquals(receipts[0].attractors.length, 2);
    assertEquals(receipts[0].attractors[0].matrix, 0xABCD_1234 >>> 0);
    assertEquals(receipts[0].attractors[1].matrix, 0xDEAD_BEEF >>> 0);
    assert((receipts[0].attractors[0].matrix ^ receipts[0].attractors[0].inverse) >>> 0 === 0xFFFFFFFF);
});
