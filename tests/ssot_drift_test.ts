// The SSoT and its generated output had nothing binding them together.
//
// `CANONICAL_PHASE_ALPHA` — the constant introduced to close the T3 crack,
// where a ZK rollup proof was generated under `alpha: 0` while the lattice ran
// at 64 — existed ONLY in `omega_v2/src/constants.rs`. That file's first line
// says AUTO-GENERATED, DO NOT EDIT. It was never added to `genesis_ssot.ts`, so
// the source of truth and its output disagreed for months in silence, and the
// next `deno run -A tools/build_ssot.ts` would have deleted the constant along
// with the paragraph explaining it, breaking four call sites across omega_v2
// and omega_zk_host. The anti-drift constant was one regeneration from gone.
//
// This test is the binding. It compares VALUES, not bytes, so it survives
// formatting differences while catching the thing that actually matters: a
// generated file that no longer matches the SSoT that generates it.

import { assertEquals } from "jsr:@std/assert@1";
import { resolveConstants } from "../tools/build_ssot.ts";

const RS_PATH = new URL("../omega_v2/src/constants.rs", import.meta.url);
const TS_PATH = new URL(
  "../src/shared/generated_constants.ts",
  import.meta.url,
);

/** Parse `pub const NAME: type = value;` out of the generated Rust. */
function parseRust(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (
    const m of src.matchAll(/^pub const ([A-Z0-9_]+):\s*\w+\s*=\s*(.+?);$/gm)
  ) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Parse `export const NAME = value;` out of the generated TS. */
function parseTs(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^export const ([A-Z0-9_]+)\s*=\s*(.+?);$/gm)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

const ssot = resolveConstants();
const rust = parseRust(Deno.readTextFileSync(RS_PATH));
const ts = parseTs(Deno.readTextFileSync(TS_PATH));

Deno.test("every SSoT constant reaches the generated Rust with the same value", () => {
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const [name, { value }] of ssot) {
    const emitted = rust.get(name);
    if (emitted === undefined) {
      missing.push(name);
      continue;
    }
    const expected = typeof value === "bigint"
      ? value.toString()
      : String(value);
    if (emitted !== expected) wrong.push(`${name}: ${emitted} != ${expected}`);
  }
  assertEquals(missing, [], "SSoT constants absent from constants.rs");
  assertEquals(wrong, [], "SSoT constants emitted with a different value");
});

Deno.test("every SSoT constant reaches the generated TS with the same value", () => {
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const [name, { value }] of ssot) {
    const emitted = ts.get(name);
    if (emitted === undefined) {
      missing.push(name);
      continue;
    }
    const expected = typeof value === "bigint"
      ? value.toString() + "n"
      : String(value);
    if (emitted !== expected) wrong.push(`${name}: ${emitted} != ${expected}`);
  }
  assertEquals(
    missing,
    [],
    "SSoT constants absent from generated_constants.ts",
  );
  assertEquals(wrong, [], "SSoT constants emitted with a different value");
});

Deno.test("REGRESSION: no constant exists in a generated file without an SSoT entry", () => {
  // This is the direction that actually failed. A constant hand-written into a
  // generated file looks completely normal to every consumer — it compiles, it
  // has a doc comment, call sites resolve — right up until regeneration erases
  // it. If this fails, someone edited a DO-NOT-EDIT file: move the constant
  // into src/ontology/genesis_ssot.ts, with its explanation in `note`.
  const orphanRust = [...rust.keys()].filter((n) => !ssot.has(n));
  const orphanTs = [...ts.keys()].filter((n) => !ssot.has(n));
  assertEquals(
    orphanRust,
    [],
    "constants.rs holds constants the SSoT does not",
  );
  assertEquals(
    orphanTs,
    [],
    "generated_constants.ts holds constants the SSoT does not",
  );
});

Deno.test("the doc comment for a noted constant survives into both languages", () => {
  // The mechanism that makes the fix stick: `note` is emitted, so meaning no
  // longer has to be smuggled into the generated file to be written down.
  const noted = [...ssot].filter(([, c]) => c.note);
  assertEquals(
    noted.length > 0,
    true,
    "expected at least one documented constant",
  );
  const rustSrc = Deno.readTextFileSync(RS_PATH);
  const tsSrc = Deno.readTextFileSync(TS_PATH);
  for (const [name] of noted) {
    const rustDoc = new RegExp(
      `///[^\\n]*\\n(?:///[^\\n]*\\n)*pub const ${name}\\b`,
    );
    const tsDoc = new RegExp(`\\*/\\s*\\nexport const ${name}\\b`);
    assertEquals(rustDoc.test(rustSrc), true, `${name} lost its Rust doc`);
    assertEquals(tsDoc.test(tsSrc), true, `${name} lost its TS doc`);
  }
});

Deno.test("CANONICAL_PHASE_ALPHA is sourced from the SSoT, not hand-written", () => {
  // The specific casualty, pinned. Four call sites depend on it: topology.rs,
  // lib.rs, and twice in omega_zk_host/src/main.rs.
  assertEquals(ssot.get("CANONICAL_PHASE_ALPHA")?.value, 64);
  assertEquals(rust.get("CANONICAL_PHASE_ALPHA"), "64");
  assertEquals(ts.get("CANONICAL_PHASE_ALPHA"), "64");
});
