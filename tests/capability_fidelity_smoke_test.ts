import { assert } from "jsr:@std/assert";

// Honesty gate (omega's boundary, codex's organ thesis + the omega audit): the
// capability surface must declare a machine-readable fidelity for EVERY capability,
// and it must NOT silently re-introduce the Bitcoin-inscription over-claim —
// 0x549A6307 is a deterministic computed anchor, not an on-chain inscription.
Deno.test("omega capabilities surface honest fidelity, no Bitcoin-inscription over-claim", async () => {
  const path =
    new URL("../src/x4A00_capabilities.ts", import.meta.url).pathname;
  const out = await new Deno.Command("deno", {
    args: ["run", "-A", path, "--json"],
    stdout: "piped",
    stderr: "null",
  }).output();
  assert(out.success, "x4A00_capabilities must run");
  const r = JSON.parse(new TextDecoder().decode(out.stdout)) as {
    capabilities: Array<
      { name: string; fidelity: string; detail: string; caveat?: string }
    >;
    summary: { by_fidelity: Record<string, number> };
  };

  assert(
    Array.isArray(r.capabilities) && r.capabilities.length > 0,
    "must emit capabilities",
  );

  // every capability declares a known fidelity
  for (const c of r.capabilities) {
    assert(
      ["real", "wired_unproven", "mock"].includes(c.fidelity),
      `${c.name} must declare a known fidelity, got: ${c.fidelity}`,
    );
  }

  // no capability detail may positively claim 'inscribed' on Bitcoin
  for (const c of r.capabilities) {
    assert(
      !/inscribed/i.test(c.detail),
      `${c.name} detail must not claim 'inscribed' (Bitcoin over-claim): ${c.detail}`,
    );
  }

  // the genesis bootstrap must explicitly state it is NOT a Bitcoin inscription
  const genesis = r.capabilities.find((c) =>
    c.name.includes("Genesis Bootstrap")
  );
  assert(genesis, "genesis bootstrap capability must exist");
  assert(
    genesis.caveat != null && /not a bitcoin inscription/i.test(genesis.caveat),
    "genesis must state it is NOT a Bitcoin inscription — no silent on-chain over-claim",
  );

  // the ZK host is a real cpu prover wired by default — honestly wired_unproven
  // (real prover, but no completed STARK has run here: hardware-bound). It must
  // NOT regress to claiming a completed proof, nor under-claim itself as 'mock'
  // now that the mock-only backend is gone (AGENTS.md + omega_zk_host/src).
  const zkHost = r.capabilities.find((c) => c.name.includes("ZK Host"));
  assert(
    zkHost != null && zkHost.fidelity === "wired_unproven",
    "ZK host must be honestly wired_unproven (real cpu prover wired; full proof hardware-bound)",
  );
  assert(
    zkHost!.caveat != null && /hardware-bound|16 ?GB/i.test(zkHost!.caveat),
    "ZK host must keep its hardware-bound caveat — no silent 'completed proof' over-claim",
  );

  // the keyed cross-voice Senate is a REAL, exercised governance capability
  // (Φ-protocol v1.1 ratified by a real 3-of-5 quorum). Locks it from
  // regressing to a simulation claim.
  const senate = r.capabilities.find((c) => c.name.includes("Senate"));
  assert(
    senate != null && senate.fidelity === "real",
    "keyed Senate must be a real capability (exercised by a real quorum)",
  );

  // the summary surfaces the fidelity ratio so a consumer can gate on it
  assert(
    r.summary.by_fidelity.real >= 1,
    "by_fidelity must count real capabilities",
  );
});
