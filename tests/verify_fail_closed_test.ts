// Falsifier for audit A5: verifyExternalProof must fail CLOSED. A browser cannot
// run SP1 STARK verification, and v2.ts applies a peer's physics rollup
// (renderer.overwriteGPUState) when verify returns true — so a fail-OPEN browser
// path (return true) lets a peer overwrite GPU state with an UNVERIFIED rollup.
// The unverifiable path must return false. RED on the old `return true`.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("A5: browser ZK verify fails closed (unverifiable proof is not accepted)", () => {
  const src = Deno.readTextFileSync(
    new URL("../src/network/zk_prover_bridge.ts", import.meta.url),
  );
  const fnStart = src.indexOf("verifyExternalProof");
  assert(fnStart >= 0, "verifyExternalProof not found");
  const fn = src.slice(fnStart);
  const branchStart = fn.indexOf('typeof Deno === "undefined"');
  assert(branchStart >= 0, "browser-detection branch not found");
  const branch = fn.slice(branchStart, fn.indexOf("try {", branchStart));
  assert(
    !/return\s+true/.test(branch),
    "browser ZK verify must NOT `return true` (fail-open) — it cannot verify SP1 STARK, so it must fail closed",
  );
  assert(
    /return\s+false/.test(branch),
    "browser ZK verify must `return false` (fail-closed)",
  );
});
