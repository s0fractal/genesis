// WGSL ↔ Rust `species_advantage` semantics lock.
//
// This file used to guard a hash. Both substrates computed the advantage from
// `xorshift32(genome)` and both special-cased `genome == 0` with the sentinel
// 0x12345678 — but they applied it differently, one substituting the sentinel
// and the other substituting it and then hashing it anyway. That flipped the
// predator/prey sign for every zero-genome agent, ±5 ATP per neighbour per tick,
// in the consensus energy path, on two substrates that are supposed to be
// bit-identical.
//
// Era 973 removed the hash. The advantage is now a cyclic comparison of the
// predation trait — genome bits 8..15 — because the hash measured as a perfectly
// fair coin: every genome beat exactly half of any panel, and half of the actual
// living population too. There is no sentinel left to disagree about, and no
// branch for the two substrates to take differently.
//
// What still needs locking is what replaced it. `wgsl_golden_trace_test.ts`
// exercises the pair behaviourally but self-disables without a GPU, so this
// stays a SOURCE-STRUCTURE lock: it asserts both sides read the same byte and
// split the ring at the same place. Getting either wrong is silent and
// substrate-local, which is exactly the shape of the bug that made this file
// necessary in the first place.
import { assert } from "jsr:@std/assert";

const SHADER = new URL(
  "../src/lens/shaders/compute_toroidal.wgsl",
  import.meta.url,
);
const AGENT_RS = new URL("../omega_v2/src/agent.rs", import.meta.url);

/** Body of `fn species_advantage(...)`, comments stripped. */
async function fnBody(url: URL, sig: string): Promise<string> {
  const src = await Deno.readTextFile(url);
  const start = src.indexOf(sig);
  assert(start >= 0, `${url.pathname} has no ${sig}`);
  let i = src.indexOf("{", start);
  let depth = 0;
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(from, i + 1).replace(/\/\/[^\n]*/g, "");
}

Deno.test("both substrates read the same byte of the genome", async () => {
  const shader = await fnBody(SHADER, "fn species_advantage");
  const rust = await fnBody(AGENT_RS, "pub fn species_advantage");
  for (const [name, body] of [["shader", shader], ["agent.rs", rust]]) {
    assert(
      />>\s*8u?\)?\s*&\s*0xFF/.test(body),
      `${name} does not extract bits 8..15 — the predation trait moved, and a ` +
        `substrate reading a different byte plays a different food web`,
    );
  }
});

Deno.test("both substrates split the ring at the same place", async () => {
  const shader = await fnBody(SHADER, "fn species_advantage");
  const rust = await fnBody(AGENT_RS, "pub fn species_advantage");
  for (const [name, body] of [["shader", shader], ["agent.rs", rust]]) {
    assert(
      /delta\s*<\s*128/.test(body),
      `${name} does not split the 256-hand ring at 128 — an off-by-one here ` +
        `reverses who eats whom for one hand in every pairing`,
    );
    assert(
      /0xFF/.test(body),
      `${name} does not wrap the difference to the ring`,
    );
  }
});

Deno.test("the hash is gone from both, along with its sentinel", async () => {
  const shader = await fnBody(SHADER, "fn species_advantage");
  const rust = await fnBody(AGENT_RS, "pub fn species_advantage");
  for (const [name, body] of [["shader", shader], ["agent.rs", rust]]) {
    assert(
      !body.includes("0x12345678"),
      `${name} still carries the zero-genome sentinel; the hash it guarded is ` +
        `gone, so a leftover sentinel is a branch nothing else takes`,
    );
    assert(
      !/<<\s*13/.test(body),
      `${name} still hashes the genome — Era 973 replaced that with the ring ` +
        `because a hash beats exactly half of anything and cannot be climbed`,
    );
  }
});
