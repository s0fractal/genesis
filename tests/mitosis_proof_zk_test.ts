import { assertEquals } from "jsr:@std/assert";

Deno.test({
    name: "Era 0210: SP1 Mitosis Proof generation via zk_prove_mitosis.ts",
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
            
            assertEquals(parsed.kind, "stark-mock");
            assertEquals(parsed.verified, true);
            assertEquals(typeof parsed.proof_bytes, "string");
            assertEquals(parsed.proof_bytes.length > 20, true, "Proof bytes should be substantial");
            
            // The receipt hash should match the known anchor for self_test_receipt()
            assertEquals(parsed.receipt_hash, "0x3e0a031e");
        } catch (e) {
            console.error("Failed to parse zk_prove_mitosis output:", outStr);
            throw e;
        }
    }
});
