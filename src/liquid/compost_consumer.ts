/**
 * Liquid Compost Consumer (Era 970+)
 *
 * Reads φ-messages from the OMEGA WASM kernel's PhiMessageBuffer,
 * filters COMPOST events (agent death), and transforms them into
 * Σ-neuron training vectors for the Liquid ontology layer.
 *
 * Architecture: OMEGA produces physics → Φ-Message Buffer → Liquid consumes semantics.
 */

import { OmegaV2Engine } from "../environment/v2_bridge.ts";

export interface CompostEvent {
    /** Agent index in the lattice (unique ID within tick). */
    agent_id: number;
    /** Genome at death — the "DNA" of the deceased agent. */
    genome: number;
    /** Phase angle φ at moment of death (Q-scale). */
    phase: number;
    /** Final energy ρ (ATP) — represents "life force" expended. */
    energy_at_death: number;
}

/**
 * Consumes COMPOST messages from the Φ-Message ring buffer.
 *
 * The buffer lives in WASM static memory (.bss) at the address returned by
 * `v2_phi_buffer_ptr()`. Layout (repr(C)):
 *   - offset 0..4095:   messages[0..255]  (256 × 16 bytes)
 *   - offset 4096:      write_head (u32)
 *   - offset 4100:      read_head  (u32)
 *   - offset 4104:      drops      (u32)
 *
 * Each PhiMessage is 16 bytes:
 *   - offset 0:  msg_type (u8)  — 1 = COMPOST
 *   - offset 1:  q_phase  (u8)
 *   - offset 2:  _pad     (u16)
 *   - offset 4:  phi      (u32)
 *   - offset 8:  energy   (u32)
 *   - offset 12: payload  (u64) — (agent_id << 32) | genome
 */
export class CompostConsumer {
    private engine: OmegaV2Engine;
    private lastWriteHead: number = 0;

    constructor(engine: OmegaV2Engine) {
        this.engine = engine;
    }

    /**
     * Harvests all new COMPOST events since the last call.
     * Non-destructive: does not advance the Rust read_head;
     * tracks position locally to avoid double-processing.
     */
    harvest(): CompostEvent[] {
        const bufPtr = this.engine.getPhiBufferPtr();
        const wasm = this.engine.wasm;
        if (!bufPtr || !wasm) return [];

        const mem = wasm.exports.memory as WebAssembly.Memory;
        const view = new DataView(mem.buffer, bufPtr);

        // Buffer metadata at the tail of the struct
        const WRITE_HEAD_OFFSET = 256 * 16;      // 4096
        const READ_HEAD_OFFSET = WRITE_HEAD_OFFSET + 4;  // 4100
        const PHI_MSG_COMPOST = 1;

        const writeHead = view.getUint32(WRITE_HEAD_OFFSET, true);
        const readHead = view.getUint32(READ_HEAD_OFFSET, true);

        // If write_head wrapped around u32, clamp to buffer capacity
        let newCount = (writeHead - this.lastWriteHead) >>> 0;
        if (newCount > 256) {
            newCount = 256;
        }

        const events: CompostEvent[] = [];
        for (let i = 0; i < newCount; i++) {
            const msgIdx = ((this.lastWriteHead + i) % 256);
            const msgOff = msgIdx * 16;

            const msgType = view.getUint8(msgOff);
            if (msgType !== PHI_MSG_COMPOST) {
                continue;
            }

            const phi = view.getUint32(msgOff + 4, true);
            const energy = view.getUint32(msgOff + 8, true);
            const payload = view.getBigUint64(msgOff + 12, true);

            // Decode payload: (agent_id << 32) | genome
            const genome = Number(payload & BigInt(0xFFFFFFFF));
            const agent_id = Number(payload >> BigInt(32));

            events.push({ agent_id, genome, phase: phi, energy_at_death: energy });
        }

        // Advance local watermark to avoid re-processing
        this.lastWriteHead = writeHead;

        if (events.length > 0) {
            console.log(`🍂 [LIQUID-COMPOST] Harvested ${events.length} death events for Σ-neuron training.`);
        }

        return events;
    }

    /**
     * Returns the number of dropped messages (buffer overflow counter).
     * Persistent drops indicate the consumer is too slow.
     */
    getDropCount(): number {
        return this.engine.getPhiBufferDrops();
    }

    /**
     * Returns the number of unread messages currently in the buffer.
     */
    getPendingCount(): number {
        return this.engine.getPhiBufferLen();
    }
}
