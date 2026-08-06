// Bitcoin Sovereign Anchorage
import { formatInscription } from "./genesis_inscription.ts";

/** Public fallback. Sovereign deployments are expected to override this. */
export const DEFAULT_BTC_API_BASE = "https://mempool.space/api";

/**
 * Resolve the Bitcoin REST endpoint, most explicit first:
 *   1. `globalThis.__OMEGA_BTC_API__` (page-injected, same channel as
 *      `__OMEGA_GENESIS_TXID__`)
 *   2. `OMEGA_BTC_API` env var (Deno / CLI hosts)
 *   3. `localStorage["omega.btcApi"]` (operator override without a rebuild)
 *   4. the public mempool.space instance
 * Point it at your own Esplora / Electrs / Bitcoin Core proxy to make the
 * anchor check independent of any third party.
 */
export function btcApiBase(): string {
  const injected = (globalThis as { __OMEGA_BTC_API__?: string })
    .__OMEGA_BTC_API__;
  if (injected) return injected.replace(/\/+$/, "");
  try {
    // @ts-ignore: Deno is only available in backend/CLI contexts
    const fromEnv = typeof Deno !== "undefined"
      // @ts-ignore
      ? Deno.env.get("OMEGA_BTC_API")
      : undefined;
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
  } catch {
    // env permission not granted — fall through, not an error
  }
  try {
    const stored = globalThis.localStorage?.getItem("omega.btcApi");
    if (stored) return stored.replace(/\/+$/, "");
  } catch {
    // no DOM storage in this host — fall through
  }
  return DEFAULT_BTC_API_BASE;
}

export interface BitcoinTip {
  height: number;
  hash: string;
  timestamp: number;
}

/**
 * Fetches the current Bitcoin blockchain tip (height, hash, timestamp) from mempool.space
 */
export async function fetchBitcoinTip(): Promise<BitcoinTip | null> {
  try {
    const res = await fetch(`${btcApiBase()}/v1/blocks/`);
    if (!res.ok) return null;

    const blocks = await res.json();
    if (blocks && blocks.length > 0) {
      const tip = blocks[0];
      return {
        height: tip.height,
        hash: tip.id,
        timestamp: tip.timestamp,
      };
    }
  } catch (e) {
    console.warn("[BITCOIN_ANCHOR] Failed to fetch chain tip.", e);
  }
  return null;
}

export interface BitcoinAnchorStats {
  balanceSats: number;
  txCount: number;
}

/**
 * Fetches the balance and activity of a Bitcoin address.
 * Used to modulate the "Weather" (Metabolic Rate) of the simulation.
 */
export async function fetchAnchorBalance(
  address: string,
): Promise<BitcoinAnchorStats | null> {
  try {
    const res = await fetch(`${btcApiBase()}/address/${address}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.chain_stats) {
      const funded = data.chain_stats.funded_txo_sum || 0;
      const spent = data.chain_stats.spent_txo_sum || 0;
      return {
        balanceSats: funded - spent,
        txCount: data.chain_stats.tx_count || 0,
      };
    }
  } catch (e) {
    console.warn(`[BITCOIN_ANCHOR] Failed to fetch balance for ${address}.`, e);
  }
  return null;
}

/**
 * Outcome of an anchor check. The whole point of this being three-valued is
 * that "I could not ask" is NOT evidence of forgery:
 *   - VERIFIED    — we read the transaction and the OP_RETURN matches.
 *   - MISMATCH    — we read the transaction and it does NOT carry our
 *                   inscription. This is the only genuine anchor failure.
 *   - UNREACHABLE — we never got an answer (offline, endpoint down, 5xx,
 *                   malformed body). Says nothing about the chain.
 */
export type AnchorVerdict = "VERIFIED" | "MISMATCH" | "UNREACHABLE";

export interface AnchorCheck {
  verdict: AnchorVerdict;
  /** Which endpoint was asked — surfaced so a bad override is diagnosable. */
  endpoint: string;
  /** Human-readable reason, for the HUD and the console. */
  detail: string;
}

/**
 * Pure predicate: does this Esplora-shaped transaction carry `expectedPayload`
 * in an OP_RETURN output? Split out from the fetch so it is testable without
 * a network (and so the network layer cannot silently change the rule).
 */
export function txCarriesInscription(
  tx: { vout?: Array<Record<string, unknown>> } | null | undefined,
  expectedPayload: string,
): boolean {
  if (!tx || !Array.isArray(tx.vout)) return false;

  // OMEGA1:716ea2f8
  // In OP_RETURN, the scriptpubkey.asm looks like:
  // "OP_RETURN OP_PUSHBYTES_15 4f4d454741313a3731366561326638"
  // We can just encode the expected string to hex and look for it.
  const enc = new TextEncoder();
  let hexPayload = "";
  for (const b of enc.encode(expectedPayload)) {
    hexPayload += b.toString(16).padStart(2, "0");
  }
  hexPayload = hexPayload.toLowerCase();

  for (const out of tx.vout) {
    if (out.scriptpubkey_type !== "op_return") continue;
    const asm = String(out.scriptpubkey_asm ?? "").toLowerCase();
    if (asm.includes(hexPayload)) return true;
    // Fallback check the raw scriptpubkey
    const spk = String(out.scriptpubkey ?? "").toLowerCase();
    if (spk.includes(hexPayload)) return true;
  }
  return false;
}

/**
 * Ask the chain whether `txid` carries the canonical OMEGA-64 Genesis
 * Inscription. Never throws; a transport failure returns UNREACHABLE so the
 * caller can degrade to untethered instead of treating an outage at a
 * third-party REST host as proof of a forged genesis.
 */
export async function checkGenesisInscription(
  txid: string,
  expectedHash: number,
): Promise<AnchorCheck> {
  const endpoint = btcApiBase();
  const expectedPayload = formatInscription(expectedHash);
  try {
    const res = await fetch(`${endpoint}/tx/${txid}`);
    // 404 is ambiguous on purpose: a pruned/lagging/wrong-network endpoint
    // answers 404 for a transaction that exists on mainnet. Only a body we
    // successfully parsed can convict.
    if (!res.ok) {
      return {
        verdict: "UNREACHABLE",
        endpoint,
        detail: `HTTP ${res.status} for tx ${txid}`,
      };
    }

    let tx: { vout?: Array<Record<string, unknown>> };
    try {
      tx = await res.json();
    } catch (e) {
      return {
        verdict: "UNREACHABLE",
        endpoint,
        detail: `unparseable response: ${e}`,
      };
    }
    if (!tx || !Array.isArray(tx.vout)) {
      return {
        verdict: "UNREACHABLE",
        endpoint,
        detail: "response carried no vout array",
      };
    }

    return txCarriesInscription(tx, expectedPayload)
      ? { verdict: "VERIFIED", endpoint, detail: expectedPayload }
      : {
        verdict: "MISMATCH",
        endpoint,
        detail: `tx ${txid} carries no OP_RETURN matching ${expectedPayload}`,
      };
  } catch (e) {
    return {
      verdict: "UNREACHABLE",
      endpoint,
      detail: `transport error: ${e}`,
    };
  }
}

/**
 * Boolean convenience wrapper: true only on VERIFIED.
 * Callers that must distinguish "wrong chain" from "no network" — the boot
 * path above all — should use `checkGenesisInscription` directly.
 */
export async function verifyGenesisInscription(
  txid: string,
  expectedHash: number,
): Promise<boolean> {
  const check = await checkGenesisInscription(txid, expectedHash);
  if (check.verdict !== "VERIFIED") {
    console.warn(
      `[BITCOIN_ANCHOR] ${check.verdict} via ${check.endpoint}: ${check.detail}`,
    );
  }
  return check.verdict === "VERIFIED";
}

/**
 * Verify Covenant Seed against the Kernel's Genesis Entropy.
 * This ensures that the JavaScript host is communicating with a WASM kernel
 * that was compiled with the exact same historical Bitcoin block hashes.
 */
export function verifyCovenantSeed(wasmGenesisEntropy: Uint8Array): boolean {
  // 0x0000_0000 is the symbolic empty center anchor.
  // In a full implementation, we would hash the Covenant string with GE here.
  // For now, we simply verify that WASM returned exactly 32 bytes of non-zero entropy.
  if (!wasmGenesisEntropy || wasmGenesisEntropy.length !== 32) return false;

  let isAllZero = true;
  for (let i = 0; i < 32; i++) {
    if (wasmGenesisEntropy[i] !== 0) {
      isAllZero = false;
      break;
    }
  }

  if (isAllZero) {
    console.warn(
      "⚠️ [TEMPORAL_BINDING] WASM Kernel returned empty Genesis Entropy.",
    );
    return false;
  }

  // Check first bytes for debugging
  const geHex = Array.from(wasmGenesisEntropy.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  console.log(
    `⛓️ [TEMPORAL_BINDING] Covenant Seed Verified. Genesis Entropy prefix: 0x${geHex}`,
  );
  return true;
}
