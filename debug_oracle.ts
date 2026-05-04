import { oracleMatrix, ORACLE_MATRICES_V1 } from "./src/network/oracle_identity.ts";

console.log("claude runtime:", oracleMatrix("claude").toString(16).toUpperCase());
console.log("claude frozen:", ORACLE_MATRICES_V1["claude"].toString(16).toUpperCase());
