// Unit tests for the pure DIPOLE accounting extracted from libp2p_mesh.ts.
// Guards the Era 1050 odometer: valid unique receipts count once, duplicates
// and forgeries never do.

import { assertEquals } from "jsr:@std/assert";
import {
  DipoleAccountant,
  verifyDipoleAnnouncement,
} from "../src/network/dipole_accounting.ts";
import {
  AgentMinimal,
  deriveMitosisChild,
} from "../src/network/mitosis_proof.ts";

function makeParent(): AgentMinimal {
  return {
    phase: 64,
    energy: 3000,
    base_freq: 7,
    state_flags: 0,
    genome: 0xCAFE_BABE >>> 0,
    memory: [0xDEAD_BEEF >>> 0, 1, 2],
  };
}

function validAnnouncement(receiptHash?: string) {
  const parent = makeParent();
  const child = deriveMitosisChild(parent, [], 7);
  return {
    parent,
    claimedChild: child,
    attractors: [],
    qPhase: 7,
    receiptHash,
  };
}

Deno.test("verifyDipoleAnnouncement: honest birth verifies", () => {
  assertEquals(verifyDipoleAnnouncement(validAnnouncement()), true);
});

Deno.test("verifyDipoleAnnouncement: tampered child rejected", () => {
  const d = validAnnouncement();
  d.claimedChild = { ...d.claimedChild, genome: 0xAAAA_AAAA };
  assertEquals(verifyDipoleAnnouncement(d), false);
});

Deno.test("verifyDipoleAnnouncement: missing fields rejected", () => {
  assertEquals(verifyDipoleAnnouncement({}), false);
  assertEquals(verifyDipoleAnnouncement({ parent: makeParent() }), false);
});

Deno.test("DipoleAccountant: unique receipts count once, duplicates do not", () => {
  const acc = new DipoleAccountant();
  const d = validAnnouncement("0xdeadbeef");
  assertEquals(acc.process(d), "counted");
  assertEquals(acc.verifiedCount, 1);
  // Same receipt forwarded by another peer — must NOT double-count.
  assertEquals(acc.process({ ...d }), "duplicate");
  assertEquals(acc.verifiedCount, 1);
});

Deno.test("DipoleAccountant: invalid announcements never count", () => {
  const acc = new DipoleAccountant();
  const d = validAnnouncement();
  d.claimedChild = { ...d.claimedChild, energy: 1 };
  assertEquals(acc.process(d), "invalid");
  assertEquals(acc.verifiedCount, 0);
});

Deno.test("DipoleAccountant: fallback dedup key without receiptHash", () => {
  const acc = new DipoleAccountant();
  const d = validAnnouncement(); // no receiptHash
  assertEquals(acc.process(d), "counted");
  assertEquals(acc.process({ ...d }), "duplicate");
  assertEquals(acc.verifiedCount, 1);
});

Deno.test("DipoleAccountant: distinct births count separately", () => {
  const acc = new DipoleAccountant();
  const d1 = validAnnouncement("0xaaaa");
  const d2 = validAnnouncement("0xbbbb");
  assertEquals(acc.process(d1), "counted");
  assertEquals(acc.process(d2), "counted");
  assertEquals(acc.verifiedCount, 2);
});
