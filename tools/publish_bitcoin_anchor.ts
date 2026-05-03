import * as bitcoin from "npm:bitcoinjs-lib";
import { ECPairFactory } from "npm:ecpair";
import * as ecc from "npm:tiny-secp256k1";

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

// Genesis Hash from src/network/genesis_inscription.ts
const GENESIS_PAYLOAD = "OMEGA1:549a6307";

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUTXOs(address: string): Promise<any[]> {
    const res = await fetch(`https://mempool.space/testnet/api/address/${address}/utxo`);
    if (!res.ok) throw new Error(`Failed to fetch UTXOs: ${res.statusText}`);
    return await res.json();
}

async function broadcastTx(hex: string): Promise<string> {
    const res = await fetch(`https://mempool.space/testnet/api/tx`, {
        method: "POST",
        body: hex
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Broadcast failed: ${text}`);
    }
    return await res.text();
}

async function getFeeRate(): Promise<number> {
    const res = await fetch("https://mempool.space/testnet/api/v1/fees/recommended");
    const fees = await res.json();
    return fees.fastestFee || 2;
}

async function main() {
    console.log("🌌 OMEGA-64: Autonomous Bitcoin Anchor Protocol (Testnet)");
    console.log("==========================================================");
    
    // 1. Generate local Ephemeral KeyPair
    const keyPair = ECPair.makeRandom({ network });
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network });
    
    console.log(`\n🔑 Ephemeral Anchor Address Generated: ${address}`);
    console.log(`\n⚠️  ACTION REQUIRED:`);
    console.log(`Please send at least 0.0001 tBTC to this address to fund the OP_RETURN.`);
    console.log(`You can use a free faucet like: https://coinfaucet.eu/en/btc-testnet/`);
    console.log(`\nWaiting for UTXOs (Polling mempool.space every 10s)...`);

    // 2. Wait for funding
    let utxos: any[] = [];
    while (true) {
        try {
            utxos = await fetchUTXOs(address!);
            if (utxos.length > 0) {
                console.log(`\n💸 Detected ${utxos.length} UTXO(s)!`);
                break;
            }
        } catch (err) {
            console.error(`Polling error: ${(err as Error).message}`);
        }
        await sleep(10000);
    }

    // 3. Select UTXO and build transaction
    const utxo = utxos[0];
    const feeRate = await getFeeRate();
    const estimatedFee = 200 * feeRate; // Roughly 200 bytes
    
    const amount = utxo.value;
    if (amount <= estimatedFee) {
        console.error(`Insufficient funds. Need at least ${estimatedFee} sats, got ${amount} sats.`);
        Deno.exit(1);
    }
    const change = amount - estimatedFee;

    console.log(`\n⚙️  Building Transaction...`);
    console.log(`- Input TXID: ${utxo.txid}`);
    console.log(`- Amount: ${amount} sats`);
    console.log(`- Fee: ${estimatedFee} sats`);
    console.log(`- Payload: ${GENESIS_PAYLOAD}`);

    const psbt = new bitcoin.Psbt({ network });
    
    // We need to fetch the raw tx to get the non-witness utxo hex for P2PKH
    const txRes = await fetch(`https://mempool.space/testnet/api/tx/${utxo.txid}/hex`);
    const rawTxHex = await txRes.text();

    psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(rawTxHex, 'hex'),
    });

    // Output 1: OP_RETURN
    const embed = bitcoin.payments.embed({ data: [Buffer.from(GENESIS_PAYLOAD, "utf8")] });
    psbt.addOutput({
        script: embed.output!,
        value: 0,
    });

    // Output 2: Change (return to sender)
    if (change > 546) { // Dust limit
        psbt.addOutput({
            address: address!,
            value: change,
        });
    }

    // 4. Sign and finalize
    psbt.signInput(0, keyPair);
    psbt.validateSignaturesOfInput(0, () => true);
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    console.log(`\n🚀 Broadcasting Transaction to Testnet...`);
    
    // 5. Broadcast
    try {
        const txid = await broadcastTx(txHex);
        console.log(`\n✅ ANCHOR SUCCESSFULLY PUBLISHED!`);
        console.log(`Transaction ID: ${txid}`);
        console.log(`View on Mempool.space: https://mempool.space/testnet/tx/${txid}`);
    } catch (err) {
        console.error(`\n❌ Failed to broadcast: ${(err as Error).message}`);
    }
}

if (import.meta.main) {
    main().catch(console.error);
}
