export interface NomosZKProof {
  morphology_hash: string;
  gas_used: number;
  proof_bytes: string;
  valid: boolean;
}

import { isProduction } from "../shared/config.ts";

export interface NomosProof {
  hash: string;
  gas_used: number;
  max_depth: number;
  op_count: number;
  valid: boolean;
}

export class NomosGate {
  /**
   * STARK Receipt Verification
   * In a production environment, this calls into SP1 WASM Verifier bindings
   * using the hardcoded verification key (vkey) of `omega_zk_guest`.
   */
  static verify_sp1_receipt(
    proof_bytes: string,
    public_values: any,
  ): NomosZKProof {
    if (isProduction()) {
      console.error(
        "[NomosGate] FATAL: SP1 Verification is mocked, but system is in PRODUCTION mode! Failing closed.",
      );
      return {
        morphology_hash: public_values.morphology || "0x0000000000000000",
        gas_used: public_values.steps || 0,
        proof_bytes,
        valid: false, // STRICTLY FAIL-CLOSED
      };
    }

    // Mock ZK implementation for architecture scaffolding
    console.warn(
      "[NomosGate] SP1 Verification explicitly mocked for Era 280 scaffolding.",
    );

    // STRICT: fail closed unless MOCK_ZK_VALID env flag is set.
    // No proof is valid without cryptographic verification.
    const mockEnabled = typeof Deno !== "undefined" &&
      Deno.env.get("MOCK_ZK_VALID") === "1";
    let valid = false;
    if (mockEnabled && proof_bytes && proof_bytes.length >= 32) {
      valid = true;
    }

    return {
      morphology_hash: public_values.morphology || "0x0000000000000000",
      gas_used: public_values.steps || 0,
      proof_bytes,
      valid,
    };
  }

  /**
   * Statically verifies an AST payload without executing it.
   * Mimics a ZK-SNARK verification circuit bounds testing logic constraints.
   */
  static verify_plasmid(astStr: string, gas_limit: number = 5000): NomosProof {
    const hash = this._hash_sha256_mock(astStr);
    let max_depth = 0;
    let current_depth = 0;
    let op_count = 0;
    let gas_used = 0;
    let valid = true;

    // Extremely rudimentary O(N) linear scan AST bounds-checker simulating structural complexity
    for (let i = 0; i < astStr.length; i++) {
      const char = astStr[i];
      if (char === "(") {
        current_depth++;
        if (current_depth > max_depth) max_depth = current_depth;
      } else if (char === ")") {
        current_depth--;
      }

      // Op Codes / Keywords roughly consume gas
      if (
        astStr.substring(i, i + 5) === "while" ||
        astStr.substring(i, i + 3) === "for"
      ) { // Loops are dangerous
        gas_used += 100;
        op_count++;
      } else if (astStr.substring(i, i + 2) === "if") {
        gas_used += 10;
        op_count++;
      } else if (astStr.substring(i, i + 4) === "math") {
        gas_used += 20;
        op_count++;
      }

      if (gas_used > gas_limit || current_depth > 50) {
        valid = false;
        break;
      }
    }

    // Must balance parentheses securely
    if (current_depth !== 0) {
      valid = false;
    }

    // Base structural cost
    gas_used += astStr.length * 2;

    if (gas_used > gas_limit) {
      valid = false;
    }

    return { hash, gas_used, max_depth, op_count, valid };
  }

  private static _hash_sha256_mock(payload: string): string {
    // Deterministic cypto-mock hash
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return "0x" + Math.abs(hash).toString(16).padStart(8, "0");
  }
}
