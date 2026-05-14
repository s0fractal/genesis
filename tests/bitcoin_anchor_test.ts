import { assertEquals } from "jsr:@std/assert";
import { formatInscription } from "../src/network/genesis_inscription.ts";
import { fetchBitcoinTip, verifyGenesisInscription } from "../src/network/bitcoin_anchor.ts";

Deno.test("formatInscription matches canonical OMEGA-64 payload", async () => {
    // 0x549A6307
    const payload = formatInscription(0x549A6307);
    assertEquals(payload, "OMEGA1:549a6307");
});

Deno.test({
    name: "fetchBitcoinTip integration test (requires network)",
    ignore: true, // Only run manually or via explicit network flag
    fn: async () => {
        const tip = await fetchBitcoinTip();
        if (tip) {
            assertEquals(typeof tip.height, "number");
            assertEquals(typeof tip.hash, "string");
            assertEquals(tip.hash.length, 64);
        }
    }
});

Deno.test("verifyGenesisInscription parses mock mempool.space response successfully", async () => {
    // We mock the global fetch for this specific test
    const originalFetch = globalThis.fetch;
    const MOCK_TXID = "mock_txid_123";

    // "OMEGA1:549a6307" in hex is 4f4d454741313a3534396136333037
    globalThis.fetch = async (url: string | URL | Request) => {
        if (url.toString().includes(`api/tx/${MOCK_TXID}`)) {
            return new Response(JSON.stringify({
                vout: [
                    {
                        scriptpubkey_type: "p2pkh",
                        scriptpubkey_asm: "OP_DUP OP_HASH160 ... OP_EQUALVERIFY OP_CHECKSIG"
                    },
                    {
                        scriptpubkey_type: "op_return",
                        scriptpubkey_asm: "OP_RETURN OP_PUSHBYTES_15 4f4d454741313a3534396136333037"
                    }
                ]
            }), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
    };

    try {
        const valid = await verifyGenesisInscription(MOCK_TXID, 0x549A6307);
        assertEquals(valid, true);

        const invalid = await verifyGenesisInscription("wrong_txid", 0x549A6307);
        assertEquals(invalid, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
