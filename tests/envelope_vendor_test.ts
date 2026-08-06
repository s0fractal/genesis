// omega/tests/envelope_vendor_test.ts — the vendored ReceiptEnvelope encoder
// (src/shared/{canonical_cbor,envelope}.ts) must keep producing self-consistent
// envelopes so omega's substrate_tag:omega witness verifies in the trinity
// Substrate Court. Gated by `deno task test:unit`.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ENVELOPE_SCHEMA, wrap } from "../src/shared/envelope.ts";
import {
  encodeCanonical,
  multihashSha256,
} from "../src/shared/canonical_cbor.ts";

Deno.test("vendored wrap — produces a schema-correct, content-addressed envelope", async () => {
  // A deliberately synthetic law hash. This test is about the ENVELOPE — its
  // schema, its content addressing — and pinning omega's real value here would
  // read as a law assertion while testing none, and would go stale silently the
  // next time an era is bumped. The real pin lives in tests/law_hash_test.ts.
  const LAW = "0x0badc0de";
  const body = {
    type: "SubstrateHealth",
    substrate: "omega",
    law_hash: LAW,
    overall: "healthy",
  };
  const env = await wrap(body, "substrate_health", "omega", { law_hash: LAW });
  assertEquals(env.schema, ENVELOPE_SCHEMA);
  assertEquals(env.substrate_tag, "omega");
  assertEquals(env.body_kind, "substrate_health");
  assertEquals(env.law_hash, LAW);
  assert(env.envelope_id.length > 0);
  assert(env.body_hash.length > 0);
});

Deno.test("vendored wrap — body_hash matches the court's recompute (self-consistent)", async () => {
  // This is exactly what the trinity Substrate Court does to omega's witness:
  // re-encode the body canonically and hash it. If this drifts, the court
  // raises self_inconsistent_body_hash on omega's envelope.
  const body = { type: "SubstrateHealth", substrate: "omega", n: 7 };
  const env = await wrap(body, "substrate_health", "omega", {});
  const recomputed = await multihashSha256(encodeCanonical(body));
  assertEquals(env.body_hash, recomputed);
});
