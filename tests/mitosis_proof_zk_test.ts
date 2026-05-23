import { assertEquals } from "jsr:@std/assert";

Deno.test({
  name: "SP1 Mitosis Proof generation via zk_prove_mitosis.ts",
  // This test actually builds/runs the SP1 mock prover which can take a few seconds
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const cmd = new Deno.Command("deno", {
      args: ["run", "-A", "tools/zk_prove_mitosis.ts", "--self-test"],
      stdout: "piped",
      stderr: "inherit",
    });

    const output = await cmd.output();
    assertEquals(output.success, true, "zk_prove_mitosis failed");

    const outStr = new TextDecoder().decode(output.stdout);

    try {
      const parsed = JSON.parse(outStr.trim());

      assertEquals(parsed.kind, "soft");
      assertEquals(parsed.verified, true);

      // The receipt hash is now a 32-byte SHA-256 string (64 chars + '0x' = 66)
      assertEquals(parsed.receiptHash.length, 66);
    } catch (e) {
      console.error("Failed to parse zk_prove_mitosis output:", outStr);
      throw e;
    }
  },
});
