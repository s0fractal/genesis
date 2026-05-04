import { assertEquals, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { OmegaV2Engine } from "../src/environment/v2_bridge.ts";
import { foldStringToU64, NETWORK_BTC, NETWORK_ETH, NETWORK_SOL } from "../src/network/multi_anchor.ts";

Deno.test({
    name: "multi_anchor: deterministic folding to u64",
    fn: () => {
        const hash1 = "00000000000000000003b516b22f42dc0883d5a23078a6ffaf001fb14c3e80f9"; // BTC
        const hash2 = "0x8e83344b58ab4a92c040d341908bfdf800c0ec405a4b7c02bcf11d2e1bdfc08f"; // ETH
        const hash3 = "C5iH7N7dKh5U8UvR6NqTqX9uB4z5Uq5fP6yJmC6DXZ7f"; // SOL

        const u1 = foldStringToU64(hash1);
        const u2 = foldStringToU64(hash2);
        const u3 = foldStringToU64(hash3);

        assertNotEquals(u1, 0n);
        assertNotEquals(u2, 0n);
        assertNotEquals(u3, 0n);
        assertNotEquals(u1, u2);
        assertNotEquals(u2, u3);
    }
});

Deno.test({
    name: "multi_anchor: WASM engine integration",
    fn: async () => {
        const bytes = await Deno.readFile("dist/v2/omega_v2_core.wasm");
        const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
        const exports = instance.exports;

        const totalBlocksFn = exports.v2_anchor_total_blocks as CallableFunction;
        const initNetworkFn = exports.v2_anchor_init_network as CallableFunction;
        const ingestBlockFn = exports.v2_anchor_ingest_block as CallableFunction;
        
        // 1. Init empty
        assertEquals(totalBlocksFn(), 0n);
        
        // 2. Init BTC
        initNetworkFn(NETWORK_BTC, 1n, 2n, 3n, 4n, 5n, 6n);
        assertEquals(totalBlocksFn(), 6n);
        
        // 3. Ingest ETH
        ingestBlockFn(NETWORK_ETH, 100n);
        assertEquals(totalBlocksFn(), 7n);
        
        // 4. Ingest SOL
        ingestBlockFn(NETWORK_SOL, 200n);
        ingestBlockFn(NETWORK_SOL, 201n);
        assertEquals(totalBlocksFn(), 9n);
    }
});
