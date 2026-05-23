// cross-language oracle identity anchors.
import { assertEquals } from "jsr:@std/assert";
import {
  CANONICAL_ORACLES,
  ORACLE_MATRICES_V1,
  ORACLE_SALT_V1,
  oracleDipole,
  oracleMatrix,
} from "../src/network/oracle_identity.ts";

Deno.test("oracle salt matches v1.0 protocol identifier", async () => {
  assertEquals(ORACLE_SALT_V1, "OMEGA-64/RFC-001/v1.0");
});

Deno.test("dipole invariant holds for every canonical oracle", async () => {
  for (const name of CANONICAL_ORACLES) {
    const { matrix, inverse } = oracleDipole(name);
    assertEquals((matrix ^ inverse) >>> 0, 0xFFFF_FFFF);
  }
});

Deno.test("canonical oracle matrices match Rust anchors", async () => {
  // These five values are anchored in omega_v2/tests/oracle_anchors.rs.
  // Drift on either side fails CI on both.
  assertEquals(oracleMatrix("claude"), 0x41a2_f2f4);
  assertEquals(oracleMatrix("gpt"), 0x89b1_222a);
  assertEquals(oracleMatrix("gemini"), 0x9874_dd21);
  assertEquals(oracleMatrix("qwen"), 0x6e52_1f4e);
  assertEquals(oracleMatrix("llama"), 0x3a52_38ef);
});

Deno.test("frozen ORACLE_MATRICES_V1 table matches runtime computation", async () => {
  for (const name of CANONICAL_ORACLES) {
    assertEquals(oracleMatrix(name), ORACLE_MATRICES_V1[name]);
  }
});

Deno.test("distinct salts produce distinct matrices", async () => {
  const m1 = oracleMatrix("claude", "v1.0");
  const m2 = oracleMatrix("claude", "v2.0");
  assertEquals(m1 !== m2, true);
});

Deno.test("canonical oracles do not collide", async () => {
  const seen = new Set<number>();
  for (const name of CANONICAL_ORACLES) {
    const m = oracleMatrix(name);
    assertEquals(seen.has(m), false, `collision at ${name}`);
    seen.add(m);
  }
});
