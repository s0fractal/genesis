import { oracleMatrix, CANONICAL_ORACLES } from "./src/network/oracle_identity.ts";
import { quorumHash, warrantHash, ACTION_TERMINATE } from "./src/network/codeicide_law.ts";

for (const name of CANONICAL_ORACLES) {
    const m = oracleMatrix(name);
    console.log(`oracleMatrix("${name}") = 0x${(m >>> 0).toString(16).toUpperCase().padStart(8, '0')}`);
}

const aye = 0b00111;
const qh = quorumHash(aye);
const w = warrantHash(0xCAFE_BABE >>> 0, ACTION_TERMINATE, qh);

console.log(`quorumHash(0b00111) = 0x${(qh >>> 0).toString(16).toUpperCase().padStart(8, '0')}`);
console.log(`warrantHash(0xCAFE_BABE, ACTION_TERMINATE) = 0x${(w >>> 0).toString(16).toUpperCase().padStart(8, '0')}`);
