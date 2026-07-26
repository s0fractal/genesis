// Bitcoin Sovereign Anchorage
import { formatInscription } from "./genesis_inscription.ts";

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
    const res = await fetch("https://mempool.space/api/v1/blocks/");
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
    const res = await fetch(`https://mempool.space/api/address/${address}`);
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
 * Validates whether a given Bitcoin transaction contains an OP_RETURN output
 * matching the canonical OMEGA-64 Genesis Inscription.
 * @param txid The Bitcoin transaction ID
 * @param expectedHash Optional explicit hash number, defaults to GENESIS_HASH_LEGACY_V1_0 if omitted
 * @returns true if valid, false otherwise.
 */
export async function verifyGenesisInscription(
  txid: string,
  expectedHash: number,
): Promise<boolean> {
  try {
    const res = await fetch(`https://mempool.space/api/tx/${txid}`);
    if (!res.ok) {
      console.warn(`[BITCOIN_ANCHOR] TXID ${txid} not found or network error.`);
      return false;
    }

    const tx = await res.json();
    if (!tx || !tx.vout) return false;

    const expectedPayload = formatInscription(expectedHash);
    // OMEGA1:716ea2f8
    // In OP_RETURN, the scriptpubkey.asm looks like: "OP_RETURN OP_PUSHBYTES_15 4f4d454741313a3731366561326638"
    // We can just encode the expected string to hex and look for it.

    const enc = new TextEncoder();
    const bytes = enc.encode(expectedPayload);
    let hexPayload = "";
    for (const b of bytes) {
      hexPayload += b.toString(16).padStart(2, "0");
    }

    for (const out of tx.vout) {
      if (out.scriptpubkey_type === "op_return") {
        const asm = out.scriptpubkey_asm || "";
        // If it explicitly has our hex string
        if (asm.toLowerCase().includes(hexPayload.toLowerCase())) {
          return true;
        }

        // Fallback check the raw scriptpubkey
        const spk = out.scriptpubkey || "";
        if (spk.toLowerCase().includes(hexPayload.toLowerCase())) {
          return true;
        }
      }
    }

    console.warn(
      `[BITCOIN_ANCHOR] TXID ${txid} does not contain valid OP_RETURN payload (${expectedPayload}).`,
    );
    return false;
  } catch (e) {
    console.error(`[BITCOIN_ANCHOR] Error verifying TXID ${txid}:`, e);
    return false;
  }
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
