// 🌌 OMEGA-64 — Spore Witness Bridge (Era 0212)
//
// This edge tool reads hardware Spore telemetry from stdin (typically
// piped from UART, BLE, or QEMU), wraps the raw 32-byte SporeFrames,
// and bridges them directly into the global OMEGA-64 WebSocket signaling mesh.
// Browser Museum clients will automatically see these hardware nodes.
//
// Usage:
//   deno run --allow-read --allow-net tools/spore_bridge.ts
//   # Then paste/pipe binary frame bytes to stdin.

import {
    SPORE_FRAME_BYTES,
    findSync,
    frameFromBytes,
} from "../src/network/spore_frame.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const SIGNALING_URL = Deno.env.get("OMEGA_SIGNALING") || "wss://omega-federation.deno.dev";

async function streamToWebSocket() {
    let ws: WebSocket;
    let wsOpen = false;

    function connect() {
        console.log(`[SporeBridge] Connecting to Federation Mesh: ${SIGNALING_URL}`);
        ws = new WebSocket(SIGNALING_URL);
        
        ws.onopen = () => {
            console.log(`[SporeBridge] 🚀 Connected. Ready to bridge hardware frames.`);
            wsOpen = true;
        };

        ws.onclose = () => {
            console.log(`[SporeBridge] ❌ Connection lost. Reconnecting in 3s...`);
            wsOpen = false;
            setTimeout(connect, 3000);
        };

        ws.onerror = (e) => {
            console.warn(`[SporeBridge] WebSocket Error:`, e);
        };
    }

    connect();

    const reader = Deno.stdin.readable.getReader();
    let scratch = new Uint8Array(0);
    let framesBridged = 0;

    console.log("[SporeBridge] Listening on stdin for SporeFrames...");

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        
        // Append to scratch buffer.
        const merged = new Uint8Array(scratch.length + value.length);
        merged.set(scratch, 0);
        merged.set(value, scratch.length);
        scratch = merged;
        
        // Drain whole frames
        while (true) {
            const sync = findSync(scratch);
            if (sync === null || scratch.length - sync < SPORE_FRAME_BYTES) break;
            
            const candidate = scratch.subarray(sync, sync + SPORE_FRAME_BYTES);
            const frame = frameFromBytes(candidate);
            
            if (!frame) {
                // Skip 1 byte and try again — magic match was a false positive.
                scratch = scratch.subarray(sync + 1);
                continue;
            }
            
            // Frame is valid! Bridge it!
            const sporeId = `spore-${frame.payloadB.toString(16).padStart(8, "0")}`;
            const base64Frame = encodeBase64(candidate);

            if (wsOpen && ws.readyState === WebSocket.OPEN) {
                const msg = JSON.stringify({
                    type: "SPORE_TELEMETRY",
                    sporeId,
                    frameBase64: base64Frame
                });
                ws.send(msg);
                framesBridged++;
                
                if (framesBridged % 10 === 0) {
                    console.log(`[SporeBridge] 📡 Bridged ${framesBridged} frames to mesh... (latest: ${sporeId})`);
                }
            }

            // Consume the parsed frame
            scratch = scratch.subarray(sync + SPORE_FRAME_BYTES);
        }
    }
}

if (import.meta.main) {
    await streamToWebSocket();
}
