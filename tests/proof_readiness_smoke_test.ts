import { assert, assertEquals } from "jsr:@std/assert";

// Honesty gate (omega's own discipline, the substrate-court boundary): the status
// organ must keep the ZK proof debt VISIBLE — it may NOT silently claim a completed
// cpu STARK proof. If a real proof is ever landed, flip zk_cpu_proof_executed
// deliberately, in the same change that lands the proof. This guards the boundary
// projection that trinity (t court --live) reads to answer "omega's proof readiness".
Deno.test("omega status surfaces honest proof_readiness — cpu proof debt stays visible", async () => {
  const statusPath =
    new URL("../src/x2E00_status.ts", import.meta.url).pathname;
  const out = await new Deno.Command("deno", {
    args: ["run", "-A", statusPath],
    stdout: "piped",
    stderr: "null",
  }).output();
  assert(out.success, "x2E00_status must run");
  const r = JSON.parse(new TextDecoder().decode(out.stdout)) as {
    proof_readiness?: Record<string, unknown>;
  };
  const pr = r.proof_readiness;
  assert(pr, "status must surface proof_readiness at the boundary");
  assertEquals(
    pr.zk_cpu_proof_executed,
    false,
    "no completed cpu STARK proof exists — omega must not claim one",
  );
  assertEquals(
    pr.zk_ci_prover,
    "mock",
    "CI runs the mock prover, stated plainly",
  );
  assert(pr.zk_guest_present, "the ZK guest source must be present");
});
