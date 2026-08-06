import { assertEquals } from "jsr:@std/assert";
import { formatInscription } from "../src/network/genesis_inscription.ts";
import {
  btcApiBase,
  checkGenesisInscription,
  DEFAULT_BTC_API_BASE,
  fetchBitcoinTip,
  txCarriesInscription,
  verifyGenesisInscription,
} from "../src/network/bitcoin_anchor.ts";

Deno.test("formatInscription matches canonical OMEGA-64 payload", async () => {
  // 0x716EA2F8
  const payload = formatInscription(0x716EA2F8);
  assertEquals(payload, "OMEGA1:716ea2f8");
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
  },
});

Deno.test("verifyGenesisInscription parses mock mempool.space response successfully", async () => {
  // We mock the global fetch for this specific test
  const originalFetch = globalThis.fetch;
  const MOCK_TXID = "mock_txid_123";

  // "OMEGA1:716ea2f8" in hex is 4f4d454741313a3731366561326638
  globalThis.fetch = async (url: string | URL | Request) => {
    if (url.toString().includes(`api/tx/${MOCK_TXID}`)) {
      return new Response(
        JSON.stringify({
          vout: [
            {
              scriptpubkey_type: "p2pkh",
              scriptpubkey_asm:
                "OP_DUP OP_HASH160 ... OP_EQUALVERIFY OP_CHECKSIG",
            },
            {
              scriptpubkey_type: "op_return",
              scriptpubkey_asm:
                "OP_RETURN OP_PUSHBYTES_15 4f4d454741313a3731366561326638",
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response("Not found", { status: 404 });
  };

  try {
    const valid = await verifyGenesisInscription(MOCK_TXID, 0x716EA2F8);
    assertEquals(valid, true);

    const invalid = await verifyGenesisInscription("wrong_txid", 0x716EA2F8);
    assertEquals(invalid, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// REGRESSION: the boot path used to treat a boolean false as "forged genesis"
// and abort with FATAL. A transport failure and a wrong chain are now
// distinguishable, because only one of them is evidence of anything.
Deno.test("anchor check separates MISMATCH (chain disagrees) from UNREACHABLE (no answer)", async () => {
  const originalFetch = globalThis.fetch;
  const responders: Record<string, () => Response | Promise<Response>> = {
    good: () =>
      new Response(
        JSON.stringify({
          vout: [{
            scriptpubkey_type: "op_return",
            scriptpubkey_asm:
              "OP_RETURN OP_PUSHBYTES_15 4f4d454741313a3731366561326638",
          }],
        }),
        { status: 200 },
      ),
    // Reached the chain, read the tx, our inscription is simply not in it.
    wrongchain: () =>
      new Response(
        JSON.stringify({
          vout: [{
            scriptpubkey_type: "op_return",
            scriptpubkey_asm: "OP_RETURN OP_PUSHBYTES_15 deadbeef",
          }],
        }),
        { status: 200 },
      ),
    down: () => new Response("bad gateway", { status: 502 }),
    // A pruned or wrong-network endpoint answers 404 for a live mainnet tx.
    missing: () => new Response("Not found", { status: 404 }),
    garbage: () => new Response("<html>captive portal</html>", { status: 200 }),
    offline: () => {
      throw new TypeError("Failed to fetch");
    },
  };

  globalThis.fetch = ((url: string | URL | Request) => {
    const key = url.toString().split("/tx/")[1] ?? "down";
    return Promise.resolve(responders[key]!());
  }) as typeof fetch;

  try {
    assertEquals(
      (await checkGenesisInscription("good", 0x716EA2F8)).verdict,
      "VERIFIED",
    );
    assertEquals(
      (await checkGenesisInscription("wrongchain", 0x716EA2F8)).verdict,
      "MISMATCH",
    );
    for (const unreachable of ["down", "missing", "garbage", "offline"]) {
      assertEquals(
        (await checkGenesisInscription(unreachable, 0x716EA2F8)).verdict,
        "UNREACHABLE",
        `${unreachable} must not convict the genesis`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("txCarriesInscription is pure and total over malformed input", () => {
  const payload = formatInscription(0x716EA2F8);
  assertEquals(txCarriesInscription(null, payload), false);
  assertEquals(txCarriesInscription({}, payload), false);
  assertEquals(txCarriesInscription({ vout: [] }, payload), false);
  // A non-OP_RETURN output that happens to contain the bytes must not count.
  assertEquals(
    txCarriesInscription({
      vout: [{
        scriptpubkey_type: "p2pkh",
        scriptpubkey: "4f4d454741313a3731366561326638",
      }],
    }, payload),
    false,
  );
  assertEquals(
    txCarriesInscription({
      vout: [{
        scriptpubkey_type: "op_return",
        scriptpubkey: "4F4D454741313A3731366561326638",
      }],
    }, payload),
    true,
  );
});

Deno.test("btcApiBase honours the injected override and strips trailing slashes", () => {
  const g = globalThis as { __OMEGA_BTC_API__?: string };
  const prev = g.__OMEGA_BTC_API__;
  try {
    delete g.__OMEGA_BTC_API__;
    assertEquals(btcApiBase(), DEFAULT_BTC_API_BASE);
    g.__OMEGA_BTC_API__ = "http://127.0.0.1:3002/api//";
    assertEquals(btcApiBase(), "http://127.0.0.1:3002/api");
  } finally {
    if (prev === undefined) delete g.__OMEGA_BTC_API__;
    else g.__OMEGA_BTC_API__ = prev;
  }
});
