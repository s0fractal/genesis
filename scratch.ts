import * as bitcoin from "npm:bitcoinjs-lib";
import { ECPairFactory } from "npm:ecpair";
import * as ecc from "npm:tiny-secp256k1";

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

const keyPair = ECPair.makeRandom({ network });
const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network });

console.log("Address:", address);
const payload = new TextEncoder().encode("OMEGA1:549a6307");
const embed = bitcoin.payments.embed({ data: [payload] });
console.log("OP_RETURN Hex:", embed.output!.toString('hex'));
