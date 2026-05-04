import { fetchBitcoinTip } from "./bitcoin_anchor.ts";
import { OmegaV2Engine } from "../environment/v2_bridge.ts";

export const NETWORK_BTC = 0;
export const NETWORK_ETH = 1;
export const NETWORK_SOL = 2;

/**
 * Deterministically folds any string (hex, base58, etc.) into a 64-bit integer
 * for the Rust FFI.
 */
export function foldStringToU64(str: string): bigint {
    let folded = 14695981039346656037n; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        folded = folded ^ BigInt(str.charCodeAt(i));
        folded = (folded * 1099511628211n) & 0xFFFFFFFFFFFFFFFFn;
    }
    return folded;
}

export async function fetchEthereumTip(): Promise<string | null> {
    try {
        const res = await fetch("https://cloudflare-eth.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBlockByNumber",
                params: ["latest", false],
                id: 1
            })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.result && data.result.hash) {
            return data.result.hash;
        }
    } catch (e) {
        console.warn("[ETH_ANCHOR] Failed to fetch tip", e);
    }
    return null;
}

export async function fetchSolanaTip(): Promise<string | null> {
    try {
        const res = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getLatestBlockhash",
                params: [ { commitment: "confirmed" } ]
            })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.result && data.result.value && data.result.value.blockhash) {
            return data.result.value.blockhash;
        }
    } catch (e) {
        console.warn("[SOL_ANCHOR] Failed to fetch tip", e);
    }
    return null;
}

export class MultiAnchorPoller {
    private engine: OmegaV2Engine;
    private lastBtcHash: string | null = null;
    private lastEthHash: string | null = null;
    private lastSolHash: string | null = null;

    constructor(engine: OmegaV2Engine) {
        this.engine = engine;
    }

    public async pollAll() {
        // BTC
        const btcTip = await fetchBitcoinTip();
        if (btcTip && btcTip.hash !== this.lastBtcHash) {
            this.lastBtcHash = btcTip.hash;
            this.engine.ingestNetworkBlock(NETWORK_BTC, foldStringToU64(btcTip.hash));
            // console.log(`[ANCHOR] BTC Tip updated: ${btcTip.hash}`);
        }

        // ETH
        const ethHash = await fetchEthereumTip();
        if (ethHash && ethHash !== this.lastEthHash) {
            this.lastEthHash = ethHash;
            this.engine.ingestNetworkBlock(NETWORK_ETH, foldStringToU64(ethHash));
            // console.log(`[ANCHOR] ETH Tip updated: ${ethHash}`);
        }

        // SOL
        const solHash = await fetchSolanaTip();
        if (solHash && solHash !== this.lastSolHash) {
            this.lastSolHash = solHash;
            this.engine.ingestNetworkBlock(NETWORK_SOL, foldStringToU64(solHash));
            // console.log(`[ANCHOR] SOL Tip updated: ${solHash}`);
        }
    }
}
