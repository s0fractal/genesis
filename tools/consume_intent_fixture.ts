import { crypto } from "jsr:@std/crypto";
import { encodeHex } from "jsr:@std/encoding/hex";

const INPUT_PATH = Deno.args[0] || "phi_intent_fixture.json";
const OUTPUT_PATH = Deno.args[1] || "phi_receipt_fixture.json";

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return encodeHex(hashBuffer);
}

// Emulate Genesis physics: deterministic resonance and phase acceptance.
async function processIntent() {
  const rawIntent = await Deno.readTextFile(INPUT_PATH);
  const intentObj = JSON.parse(rawIntent);

  if (intentObj.type !== "PHI_INTENT") {
    throw new Error("Invalid input: not a PHI_INTENT");
  }

  const intentHash = await sha256(rawIntent);

  // Deterministic transformation in 16-bit integer space (Genesis domain logic)
  const basePhase = intentObj.z_intent_phase;
  // Apply a deterministic phase shift (e.g., resonance check against Genesis anchors)
  // Let's assume a static +1000 degree topological shift
  const derivedPhase = (basePhase + 1000) % 65536;

  // The physics consensus gate allows this intent through.
  const receipt = {
    type: "PHI_RECEIPT",
    version: "0.1",
    intent_hash: intentHash,
    status: "ACCEPTED",
    derived_phase: derivedPhase,
    timestamp: 1715000000001, // Deterministic timestamp
  };

  // Sign the receipt (simulate cryptographic proof generation in Genesis)
  const receiptStr = JSON.stringify(receipt);
  const signature = await sha256(receiptStr);
  const signedReceipt = {
    ...receipt,
    receipt_signature: signature
  };

  await Deno.writeTextFile(OUTPUT_PATH, JSON.stringify(signedReceipt, null, 2));
  console.log(`[Genesis] Processed PHI_INTENT. Output receipt to ${OUTPUT_PATH}`);
  console.log(`[Genesis] Receipt hash: ${signature}`);
}

processIntent().catch(console.error);
