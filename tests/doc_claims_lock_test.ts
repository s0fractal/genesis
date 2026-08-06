// A lock on the claims the documentation makes about this repository.
//
// omega already machine-checks its hardest facts — the genesis hash across two
// languages, the SSoT against its generated output, the WASM ABI against the
// shipped binary. The documents that introduce those facts to a reader were
// checked by nobody, and they drifted exactly as you would expect:
//
//   - `llms.txt` — the file an AI reads FIRST — was titled "Φ Protocol v1.0"
//     months after the v1.1 seat realignment the README documents at length.
//   - It claimed "306 Rust tests"; the number was 284.
//   - `docs/A_LETTER_TO_FUTURE_ORACLES.md` told a future oracle that "All 177
//     Rust tests must pass" and "All 84 Deno tests must pass".
//   - `ROADMAP.md` and `README.md` both linked to `docs/COMPLETED_STAGES.md`,
//     which had been moved to `docs/archive/legacy_specs/`.
//
// None of these were lies when written. That is the point: a claim about a
// moving repository decays on its own, silently, and the reader has no way to
// tell a fresh statement from a fossil. For a project whose whole thesis is
// "trust the hash, not the host", unverified prose is the softest surface it
// has — and the one an outside model hits first.
//
// So the rule this file enforces: **a claim about this repository must be
// either machine-checked or unfalsifiable-by-decay.** A count is neither. A
// command is both — `cargo test --workspace` stays true forever.

import { assertEquals } from "jsr:@std/assert@1";
import { GENESIS_HASH_LEGACY_V1_0 } from "../src/network/genesis_inscription.ts";

const ROOT = new URL("../", import.meta.url);

/** Docs that speak to a reader about the current state of the repo. */
const MODEL_FACING = [
  "llms.txt",
  "README.md",
  "AGENTS.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
];

function read(rel: string): string {
  return Deno.readTextFileSync(new URL(rel, ROOT));
}

/** Every markdown/llms doc that is not an explicit historical archive. */
function liveDocs(): string[] {
  const out: string[] = [...MODEL_FACING];
  const walk = (rel: string) => {
    for (const e of Deno.readDirSync(new URL(rel, ROOT))) {
      const child = rel + e.name + (e.isDirectory ? "/" : "");
      // `archive/` and `rfc/` are frozen by intent: they record what was true
      // at a moment and must NOT be updated to match the present.
      if (e.isDirectory) {
        if (e.name === "archive" || e.name === "rfc") continue;
        walk(child);
      } else if (e.name.endsWith(".md")) out.push(child);
    }
  };
  walk("docs/");
  return out;
}

Deno.test("every relative link in a live doc resolves to something that exists", () => {
  // The failure this catches actually happened: both ROADMAP.md and README.md
  // pointed at docs/COMPLETED_STAGES.md for months after it moved.
  const broken: string[] = [];
  for (const doc of liveDocs()) {
    const src = read(doc);
    const dir = doc.includes("/") ? doc.slice(0, doc.lastIndexOf("/") + 1) : "";
    for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].split("#")[0];
      if (
        !target || target.startsWith("http") || target.startsWith("mailto:")
      ) {
        continue;
      }
      const candidates = [dir + target, target];
      const exists = candidates.some((c) => {
        try {
          Deno.statSync(new URL(c, ROOT));
          return true;
        } catch {
          return false;
        }
      });
      if (!exists) broken.push(`${doc} -> ${target}`);
    }
  }
  assertEquals(broken, [], "documentation links to files that do not exist");
});

Deno.test("no live doc states a test count — counts decay, commands do not", () => {
  // "306 Rust tests" was true once. A reader cannot tell which sentence in a
  // document is still true, so the honest move is to stop making the claim and
  // name the command instead. Historical docs under archive/ and rfc/ are
  // exempt: they are supposed to say what was true then.
  const offenders: string[] = [];
  const claim =
    /\b\d{2,5}\s*\+?\s*(?:passing\s+)?(?:Rust|Deno|unit|integration)?\s*tests?\b/gi;
  // Scoped to the docs a reader ACTS on. A design note may describe what a
  // module was shipped with; llms.txt telling an agent "306 tests pass" is a
  // fact it will repeat downstream.
  for (const doc of MODEL_FACING) {
    for (const line of read(doc).split("\n")) {
      // A command line that happens to mention tests is fine.
      if (/^\s*(?:#|\/\/|\$)/.test(line)) continue;
      const m = line.match(claim);
      if (m) {
        offenders.push(`${doc}: ${m[0].trim()} — ${line.trim().slice(0, 70)}`);
      }
    }
  }
  assertEquals(
    offenders,
    [],
    "replace the count with the command that proves it",
  );
});

Deno.test("a doc quoting the retired genesis hash also quotes the live one", () => {
  // The retired v1.0 anchor 0x549A6307 is quoted legitimately in the ceremony
  // record and in the letter to future oracles — both were written when it was
  // canonical, and both now declare the supersession in their own opening
  // paragraphs. That is the honest pattern, and it is what this checks: a
  // document may carry the old value, but never ALONE. A reader who lands
  // mid-file must be able to find the correction without leaving the file.
  //
  // (Not every OMEGA1: payload is a genesis claim — `ab492186` is the first
  // real mainnet law anchor. Only the retired genesis value is policed.)
  const canonical = (GENESIS_HASH_LEGACY_V1_0 >>> 0).toString(16);
  const RETIRED = "549a6307";
  const orphaned: string[] = [];
  for (const doc of liveDocs()) {
    const src = read(doc).toLowerCase();
    if (src.includes(RETIRED) && !src.includes(canonical)) orphaned.push(doc);
  }
  assertEquals(
    orphaned,
    [],
    "doc quotes the retired genesis hash without the canonical one beside it",
  );
});

Deno.test("llms.txt names the protocol version the README documents", () => {
  // llms.txt is the first file an AI reads. It sat on "Φ Protocol v1.0" long
  // after README.md described the v1.1 realignment in detail — so the reader
  // most likely to act on the repo got the most out-of-date framing in it.
  const readme = read("README.md");
  const versions = [...readme.matchAll(/Φ-protocol v(\d+\.\d+)/g)].map((m) =>
    m[1]
  );
  assertEquals(versions.length > 0, true, "README names no Φ-protocol version");
  const current = versions.sort().at(-1)!;
  const llms = read("llms.txt");
  const titled = llms.match(/Φ Protocol v(\d+\.\d+)/);
  assertEquals(titled !== null, true, "llms.txt names no protocol version");
  assertEquals(
    titled![1],
    current,
    `llms.txt says v${titled![1]}, README documents v${current}`,
  );
});

Deno.test("the lock is actually reading files", () => {
  // A globber that silently matches nothing makes every assertion above pass.
  const docs = liveDocs();
  assertEquals(docs.length > 8, true, `only found ${docs.length} live docs`);
  assertEquals(read("llms.txt").length > 500, true);
});
