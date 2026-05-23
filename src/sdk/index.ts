/**
 * OMEGA-64 Φ-SDK (Minimal Read-Only Package)
 * This SDK allows external clients to interact with the OMEGA-64 mesh,
 * decode binary structures, and verify cryptographic traces without WebGPU/WASM.
 */

export { PhiClient } from "./phi_client.ts";
export type { PayloadHandler, WitnessData } from "./phi_client.ts";

export { PhaseAgentParser, SignalStoreParser } from "./phi_types.ts";
export type { PhaseAgentMinimal, SignalStore } from "./phi_types.ts";

export { calculateGoldenTrace, sha256_u32 } from "./phi_crypto.ts";
