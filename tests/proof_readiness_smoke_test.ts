import { assert, assertEquals } from "jsr:@std/assert";

// Honesty gate (omega's own discipline, the substrate-court boundary): the status
// organ's ZK claims must match what is actually in the tree — in BOTH directions.
// It may not claim a completed cpu STARK proof it does not have, and it may not
// deny one it does.
//
// WHY THE SECOND DIRECTION EXISTS NOW
// ----------------------------------
// This test used to assert `zk_cpu_proof_executed === false` as a constant, with
// the instruction "if a real proof is ever landed, flip it deliberately, in the
// same change that lands the proof". Three real proofs landed on 2026-07-07. The
// flip never happened, so from that day until 2026-08-02 this gate — written to
// keep the project honest — was enforcing a false statement, and it did so from
// inside a green test suite. A gate that pins a constant outlives the fact it
// encodes.
//
// So nothing here is pinned any more. The claim is compared against the files it
// is a claim about, which is the only version of this test that cannot go stale.
Deno.test("omega status surfaces honest proof_readiness — the claim matches the tree", async () => {
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

  // Ground truth, read independently of the organ being tested.
  const root = new URL("../", import.meta.url).pathname;
  const exists = async (p: string) => {
    try {
      await Deno.stat(root + p);
      return true;
    } catch {
      return false;
    }
  };
  const bundles = ["selftest_cpu", "arbitrary_cpu", "rollup_cpu"];
  let onDisk = 0;
  for (const b of bundles) {
    if (await exists(`omega_zk_host/proofs/${b}.json`)) onDisk++;
  }

  assertEquals(
    pr.zk_checked_in_proofs,
    onDisk,
    "the reported proof count must equal the bundles actually in the tree",
  );
  assertEquals(
    pr.zk_cpu_proof_executed,
    onDisk > 0,
    onDisk > 0
      ? "proofs are checked in — omega must not deny them"
      : "no proof bundles exist — omega must not claim one",
  );

  // The program of record must be present, or the bundles attest a program that
  // cannot be produced: verification would be impossible for anyone who did not
  // build the guest on the prover's own platform.
  assertEquals(
    pr.zk_guest_elf_committed,
    await exists("omega_zk_guest/elf/omega_zk_guest"),
    "the committed guest ELF claim must match the tree",
  );
  if (onDisk > 0) {
    assert(
      pr.zk_guest_elf_committed,
      "proofs are checked in without the guest ELF they attest — nobody can verify them",
    );
  }

  // A local build artifact is not the program of record; the boundary must keep
  // them as separate facts so "I built it here" is never read as the latter.
  assert(
    "zk_guest_elf_built_locally" in pr,
    "local build state must stay a distinct field from the committed program",
  );
  assertEquals(
    pr.zk_ci_host_tests_prover,
    "mock",
    "host unit tests run under the mock prover, stated plainly",
  );
  assertEquals(
    pr.zk_ci_verifies_checked_in_proofs,
    "cpu",
    "checked-in bundles are re-verified with the REAL prover — a mock verifier " +
      "would accept anything, which would make the CI gate a decoration",
  );
  assert(pr.zk_guest_present, "the ZK guest source must be present");
});
