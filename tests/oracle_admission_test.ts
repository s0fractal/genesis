// ADD_ORACLE used to seat whatever a ratified proposal claimed.
//
// `handleSenateVote` parsed `ADD_ORACLE:<name>:<hexMatrix>`, checked only that
// the name was not already present, and wrote the proposal's own hex straight
// into `ORACLE_MATRICES_V1`. Two invariants leaked through that:
//
//   1. The registry's contract is `matrix = sha256_u32(name + ":" + salt)` —
//      computable by anyone from the public name. Accepting an asserted matrix
//      let a ratified proposal seat a name whose address contradicts the rule
//      that generates addresses, and `oracleAuthentic` then compares incoming
//      votes against that contradiction.
//   2. Authenticity needs an Ed25519 signature verified against ORACLE_PUBKEYS,
//      and ADD_ORACLE carries no key. Every dynamically-seated oracle was
//      therefore inert: present in CANONICAL_ORACLES, unable to cast a vote
//      that verifies. The governance action looked like it worked and did
//      nothing.

import { assertEquals } from "jsr:@std/assert@1";
import {
  admitOracle,
  CANONICAL_ORACLES,
  ORACLE_MATRICES_V1,
  oracleMatrix,
} from "../src/network/oracle_identity.ts";
import { hasOracleKey } from "../src/network/oracle_custody.ts";

Deno.test("REGRESSION: an asserted matrix is refused; only the derived one is admissible", () => {
  const name = "newvoice";
  const derived = oracleMatrix(name);

  // What the old handler would have accepted without a murmur.
  const forged = admitOracle(name, 0xDEAD_BEEF, { hasKey: () => true });
  assertEquals(forged.admitted, false);
  assertEquals(forged.refusal, "matrix-not-derived");
  assertEquals(forged.expectedMatrix, derived);

  const honest = admitOracle(name, derived, { hasKey: () => true });
  assertEquals(honest.admitted, true);
  assertEquals(honest.refusal, null);
});

Deno.test("REGRESSION: a seat with no registered key is refused rather than granted inert", () => {
  const name = "keyless";
  const admission = admitOracle(name, oracleMatrix(name), {
    hasKey: hasOracleKey,
  });
  assertEquals(admission.admitted, false);
  assertEquals(admission.refusal, "no-registered-key");
  // The point: without the gate this WOULD have been seated, and then every
  // vote it cast would have failed verifyOracleVote for want of a public key.
  assertEquals(hasOracleKey(name), false);
});

Deno.test("an already-seated name is refused before anything else is checked", () => {
  const admission = admitOracle("claude", oracleMatrix("claude"), {
    hasKey: hasOracleKey,
  });
  assertEquals(admission.admitted, false);
  assertEquals(admission.refusal, "already-seated");
});

Deno.test("every compiled-in seat satisfies the rule ADD_ORACLE now enforces", () => {
  // If a founding seat could not pass admission, the gate would be enforcing a
  // rule the registry itself violates.
  for (const name of CANONICAL_ORACLES) {
    assertEquals(
      ORACLE_MATRICES_V1[name],
      oracleMatrix(name),
      `${name}'s registry matrix is not its derived matrix`,
    );
    assertEquals(hasOracleKey(name), true, `${name} has no registered key`);
    const asIfNew = admitOracle(name, oracleMatrix(name), {
      seated: [],
      hasKey: hasOracleKey,
    });
    assertEquals(asIfNew.admitted, true, `${name} could not be re-admitted`);
  }
});

Deno.test("admission is pure: it never mutates the live registry", () => {
  const seatsBefore = [...CANONICAL_ORACLES];
  const matricesBefore = { ...ORACLE_MATRICES_V1 };
  admitOracle("probe", oracleMatrix("probe"), { hasKey: () => true });
  admitOracle("probe2", 0x1234, { hasKey: () => true });
  assertEquals([...CANONICAL_ORACLES], seatsBefore);
  assertEquals({ ...ORACLE_MATRICES_V1 }, matricesBefore);
});
