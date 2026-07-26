import { assertEquals, assertExists } from "jsr:@std/assert";

Deno.test({
  name: "SP1 Physics Tick Rollup generation via zk_host",
  ignore: Deno.env.get("CI") === "true", // Requires real SP1 CLI/Prover locally
  async fn() {
    const cmd = new Deno.Command("cargo", {
      args: ["run", "--release", "--", "--rollup-test"],
      cwd: "omega_zk_host",
      // Pin the mock prover: the host default is `cpu` (prover_mode()), which
      // would emit "stark-cpu-rollup" and need real proving. The test targets
      // the fast mock path, so request it explicitly.
      env: { SP1_PROVER: "mock" },
      stdout: "piped",
      stderr: "piped",
    });

    const output = await cmd.output();
    const stdoutStr = new TextDecoder().decode(output.stdout);
    const stderrStr = new TextDecoder().decode(output.stderr);

    if (!output.success) {
      console.error(stderrStr);
      throw new Error("zk_host rollup failed");
    }

    const bundle = JSON.parse(stdoutStr);
    assertEquals(bundle.kind, "stark-mock-rollup");
    assertEquals(bundle.verified, true);
    assertExists(bundle.proof_bytes);
    assertExists(bundle.public_values);
  },
});
