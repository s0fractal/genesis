// WGSL ↔ Rust `species_advantage` semantics lock.
//
// This test exists because of a measured divergence (audit 2026-08-06). Both
// sides guard `genome == 0` with the sentinel 0x12345678, but they applied it
// differently:
//
//   Rust  (agent.rs)               WGSL (compute_toroidal.wgsl, before)
//   ha = if g == 0 { SENTINEL }    ha = g; if (ha == 0) { ha = SENTINEL; }
//        else { xorshift32(g) }    ha = xorshift32(ha);   // hashes SENTINEL too
//
// For genome 0 that is 0x12345678 on one substrate and 0x87985AA5 on the other,
// which flips the sign of the predator/prey advantage — ±5 ATP per neighbour
// per tick, in the consensus energy path, silently, on two substrates that are
// supposed to be bit-identical.
//
// `wgsl_golden_trace_test.ts` cannot catch it: `ignite_big_bang` draws genomes
// from xorshift, so it never generates 0, and that test also self-disables
// without a GPU. This is a SOURCE-STRUCTURE lock, not a behavioural proof — it
// asserts the shader keeps the sentinel out of the hash. A real behavioural
// check needs a GPU and a zero-genome fixture in the golden trace.
import { assert, assertEquals } from "jsr:@std/assert";

const SHADER = new URL(
  "../src/lens/shaders/compute_toroidal.wgsl",
  import.meta.url,
);
const AGENT_RS = new URL("../omega_v2/src/agent.rs", import.meta.url);

const SENTINEL = "0x12345678";

/** Body of `fn species_advantage(...) -> i32 { ... }`, comments stripped. */
async function shaderFnBody(): Promise<string> {
  const src = await Deno.readTextFile(SHADER);
  const start = src.indexOf("fn species_advantage");
  assert(start >= 0, "compute_toroidal.wgsl has no species_advantage fn");
  // Brace-match from the first `{` after the signature.
  let i = src.indexOf("{", start);
  let depth = 0;
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(from, i + 1).replace(/\/\/[^\n]*/g, "");
}

Deno.test("both substrates still guard genome 0 with the same sentinel", async () => {
  const body = await shaderFnBody();
  const rust = await Deno.readTextFile(AGENT_RS);
  assert(
    body.includes(`${SENTINEL}u`),
    "shader lost the zero-genome sentinel entirely",
  );
  assert(
    rust.includes(SENTINEL),
    "agent.rs lost the zero-genome sentinel entirely",
  );
});

Deno.test("the shader does NOT feed the sentinel through xorshift32", async () => {
  const body = await shaderFnBody();

  // Every xorshift step must live in an `else` branch — i.e. be unreachable
  // once the sentinel has been substituted. Count the shift ops and the
  // else-branches that contain them.
  const shiftOps = body.match(/\^\s*\(\w+\s*<<\s*13u\)/g) ?? [];
  assertEquals(
    shiftOps.length,
    2,
    "expected exactly two xorshift32 chains (one per genome)",
  );

  // For each sentinel assignment, the text between it and the next shift op
  // must contain an `else` — otherwise the hash runs over the sentinel.
  const re = new RegExp(`${SENTINEL}u\\s*;([\\s\\S]*?)<<\\s*13u`, "g");
  const gaps = [...body.matchAll(re)];
  assertEquals(gaps.length, 2, "expected two sentinel→xorshift regions");
  for (const [, gap] of gaps) {
    assert(
      /\belse\b/.test(gap),
      "sentinel is assigned and then hashed — this is the exact 2026-08-06 " +
        "divergence: Rust returns the RAW sentinel for genome 0, so the " +
        "shader must not run xorshift32 over it",
    );
  }
});

Deno.test("the lock is actually looking at something", async () => {
  const body = await shaderFnBody();
  assert(body.length > 200, "parsed shader fn body is implausibly short");
  assert(
    body.includes("a_genome") && body.includes("b_genome"),
    "parsed the wrong function",
  );
});
