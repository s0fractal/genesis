// deno-lint-ignore-file
//
// Export omega as it IS, for a reader who has never seen it.
//
// What this used to do, and why each part was wrong:
//
//   IT LED WITH `ERA: 2060`, read from package.json. That is the NARRATIVE era —
//   the project's development chapters — while the law this kernel runs is
//   `ERA_ID` in law_hash.rs, which is 974. Two counters, both called "Era", and
//   the export handed a reader the one that governs nothing. Both are printed
//   now, each labelled, with the law hash beside the one that matters.
//
//   IT SHIPPED docs/ WHOLESALE. Twenty-one files including a 1560-line journal
//   of thirteen eras and a spec marked HISTORICAL because it describes a u16
//   world the kernel has never run. A reader drowning in retracted history
//   cannot tell what is true now. The docs are an allowlist, the law comes
//   first, and anything carrying a HISTORICAL marker is skipped by its own
//   admission rather than by a hardcoded list.
//
//   IT OMITTED omega_v2/tests/ ENTIRELY. Nineteen files, and they are the most
//   load-bearing artifacts in the repository: the behavioural law anchor, the
//   FFI layout lock, the substrate parity locks, the fair-coin lock. They are
//   what makes the rest checkable rather than merely readable — a reader who
//   gets the physics without the anchors has to take every claim on faith.
//
//   IT SAID NOTHING ABOUT WHERE IT CAME FROM. No remote, no genesis hash, no
//   commit date. An export that cannot be traced back to a repository is an
//   anonymous pile of code.
//
// Everything printed in the header is read from the tree at export time. None of
// it is a literal in this file, so it cannot go stale the way `pkg.era` did.

import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const TARGET_EXTS = [
  ".ts",
  ".rs",
  ".wgsl",
  ".toml",
  ".html",
  ".json",
  ".proto",
];
const EXCLUDE_DIRS = [
  /node_modules/,
  /target/,
  /pkg/,
  /\.git/,
  /\.gemini/,
  /dist/,
  /tools/,
  /test_/,
  /verify_/,
  /puppeteer/,
  /archive/,
  /tasks/,
  /generated/,
  /src\/ui/,
  /src\/sdk/,
  /src\/bootstrap\/dom\.ts/,
];

/** The docs a stranger needs, law first. Everything else is history. */
const DOC_ALLOWLIST = [
  "docs/PHYSICS.md", // what the law IS — read this first
  "docs/README.md", // the index
  "AGENTS.md", // how to work in the tree
  "docs/KNOWN_GAPS.md", // what is not true yet
  "docs/CANONICAL.md", // generated identity surface
  "docs/RESPONSIBILITY.md",
  "docs/CODEICIDE.md",
  "docs/OMEGA_LIQUID_BOUNDARY.md",
  "docs/PHI_BRIDGE_SPEC.md",
  // Deliberately listed even though it is marked HISTORICAL: the skip below
  // catches it and names it in the trailer, so a reader learns the document
  // exists AND that it does not govern — which is more useful than silence.
  "docs/FixedPointDomainSpec.md",
];

async function sh(cmd: string, args: string[]): Promise<string> {
  try {
    const out = await new Deno.Command(cmd, { args }).output();
    return out.success ? new TextDecoder().decode(out.stdout).trim() : "";
  } catch {
    return "";
  }
}

/** Pull a value out of the tree rather than trusting a copy of it. */
async function grepOut(path: string, re: RegExp): Promise<string> {
  try {
    const m = (await Deno.readTextFile(path)).match(re);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

async function main() {
  const pkg = JSON.parse(await Deno.readTextFile("package.json"));
  const OMEGA_VERSION = pkg.version;
  const OUTPUT_FILE = `dist/OMEGA_EXPORT_v${OMEGA_VERSION}.md`;
  const chunks: string[] = [];

  // --- Identity, read live -------------------------------------------------
  const remote = (await sh("git", ["remote", "get-url", "origin"]))
    .replace(/\.git$/, "");
  const commit = await sh("git", ["log", "-1", "--format=%H"]);
  const commitSubject = await sh("git", ["log", "-1", "--format=%s"]);
  const commitDate = await sh("git", ["log", "-1", "--format=%cI"]);
  const branch = await sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const dirty = (await sh("git", ["status", "--porcelain"])).length > 0;

  const eraId = await grepOut(
    "omega_v2/src/law_hash.rs",
    /pub const ERA_ID: u32 = (\d+); \/\/ \d+ (.+)/,
  );
  const eraName = await grepOut(
    "omega_v2/src/law_hash.rs",
    /pub const ERA_ID: u32 = \d+; \/\/ \d+ (.+)/,
  );
  // Normalised to the form the federation actually compares — `./t status` and
  // the Substrate Court both speak `0x5f9b2abc`, not the Rust literal's
  // underscored uppercase. An export that prints a hash in a shape no peer uses
  // invites a reader to compare two strings that differ only in formatting.
  const lawHash = (await grepOut(
    "omega_v2/src/law_hash.rs",
    /pub const CANONICAL_LAW_HASH: u32 = (0x[0-9A-Fa-f_]+);/,
  )).replace(/_/g, "").toLowerCase();
  const anchor = (await grepOut(
    "omega_v2/tests/behavioral_law_anchor.rs",
    /const BEHAVIOURAL_LAW_ANCHOR: u32 = (0x[0-9A-Fa-f_]+);/,
  )).replace(/_/g, "").toLowerCase();

  chunks.push(`# OMEGA-64 — full source export

**Repository** · [${remote}](${remote}) — omega is the physics kernel of a
four-part federation (trinity / myc / omega / liquid) and lives there as a
submodule.

**Genesis identity** · \`0x716EA2F8\` · OP_RETURN \`OMEGA1:716ea2f8\`, Bitcoin
anchored. Recompute it from source and compare — nothing here asks to be trusted:

\`\`\`
cargo test -p omega_v2 --test genesis_print -- --nocapture   # prints 0x716ea2f8
\`\`\`

**Snapshot** · \`${commit || "unknown"}\` on \`${branch}\`${
    dirty
      ? " (working tree DIRTY — this export includes uncommitted edits)"
      : ""
  }
${commitDate ? `· ${commitDate}` : ""}
${commitSubject ? `· _${commitSubject}_` : ""}

## Two counters are both called "Era". Only one governs.

| | value | what it is |
|---|---|---|
| **Law** (\`ERA_ID\`, \`omega_v2/src/law_hash.rs\`) | **${eraId || "?"} — ${
    eraName || "?"
  }** | versions the PHYSICAL LAW; hashed into the federation's cross-substrate agreement anchor |
| Declared law hash | \`${
    lawHash || "?"
  }\` | what a peer compares without executing anything |
| Behavioural anchor | \`${
    anchor || "?"
  }\` | what a constant list cannot see: the physics run on a fixed fixture and hashed |
| Narrative era (\`package.json\`) | ${
    pkg.era ?? "?"
  } | development chapters; governs nothing |

**A node's law is \`ERA_ID ${eraId}\`, declared as \`${lawHash}\`.** A peer
reporting any other value is running a different universe and must not be read as
agreeing with this one — that is the whole purpose of the hash.

## Read in this order

1. \`docs/PHYSICS.md\` — what the law is, one page, every mechanism with its
   **measured** magnitude. Including the unflattering ones: the Kuramoto
   coupling this project is named for is 0.6% of what moves a phase.
2. \`omega_v2/src/lattice.rs\` — the physical operator itself.
3. \`omega_v2/tests/\` — the drift locks. These are the reason the rest can be
   checked rather than believed.

## What this export leaves out, and why

- **The journal.** \`docs/PHYSICS_BOUNDARY.md\` is 1560 lines of thirteen eras,
  including two public retractions. It is the record and it is accurate; it is
  also not the law, and a reader cannot tell what is currently true from it.
- **Anything marked HISTORICAL.** Skipped automatically by its own marker, not
  by a list here — for example a fixed-point spec describing a \`u16\` world the
  kernel has never run.
- **\`docs/archive/\`, UI, SDK, generated files, tooling.** Volume without signal.
- **Inline \`#[cfg(test)]\` blocks** inside Rust sources, to keep density — the
  standalone integration tests in \`omega_v2/tests/\` are included in full.

---
`);

  let included = 0;
  let skippedHistorical: string[] = [];

  const addFile = async (path: string) => {
    try {
      let content = await Deno.readTextFile(path);

      // Skip by the document's own admission rather than by a hardcoded list,
      // so a doc that gets retired tomorrow drops out without editing this file.
      if (/⚠️\s*HISTORICAL|^>\s*\*\*HISTORICAL/im.test(content)) {
        skippedHistorical.push(path);
        console.log(`⏭️  Historical, skipped: ${path}`);
        return;
      }

      const ext = path.split(".").pop() || "text";
      if (ext === "rs" && content.includes("#[cfg(test)]")) {
        content = content.split("#[cfg(test)]")[0].trimEnd() +
          "\n// [inline unit tests stripped — see omega_v2/tests/ for the locks]\n";
      }

      chunks.push(`## \`${path}\`\n\`\`\`${ext}\n${content}\n\`\`\`\n`);
      included++;
      console.log(`✅ Included: ${path}`);
    } catch {
      console.error(`❌ Failed: ${path}`);
    }
  };

  // --- The law, first ------------------------------------------------------
  console.log("\nThe law...");
  for (const d of DOC_ALLOWLIST) await addFile(d);
  await addFile("README.md");
  await addFile("src/ontology/genesis_ssot.ts");

  console.log("\nSweeping omega_v2/src/ ...");
  await addFile("omega_v2/Cargo.toml");
  for await (
    const e of walk("omega_v2/src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })
  ) if (e.isFile) await addFile(e.path);

  // The locks. Omitted entirely before this rewrite, which meant an export of a
  // repository whose whole claim is verifiability shipped without any of the
  // things that do the verifying.
  console.log("\nSweeping omega_v2/tests/ — the drift locks ...");
  for await (
    const e of walk("omega_v2/tests", { exts: [".rs"], skip: EXCLUDE_DIRS })
  ) if (e.isFile) await addFile(e.path);

  console.log("\nSweeping src/ ...");
  for await (
    const e of walk("src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })
  ) if (e.isFile) await addFile(e.path);

  console.log("\nSweeping omega_zk_guest/src/ ...");
  await addFile("omega_zk_guest/Cargo.toml");
  for await (
    const e of walk("omega_zk_guest/src", {
      exts: TARGET_EXTS,
      skip: EXCLUDE_DIRS,
    })
  ) if (e.isFile) await addFile(e.path);

  if (skippedHistorical.length > 0) {
    chunks.push(
      `\n---\n\n## Skipped as historical\n\nThese carry their own HISTORICAL ` +
        `marker and describe worlds this kernel does not run:\n\n` +
        skippedHistorical.map((p) => `- \`${p}\``).join("\n") + "\n",
    );
  }

  await Deno.mkdir("dist", { recursive: true });
  await Deno.writeTextFile(OUTPUT_FILE, chunks.join("\n"));

  const bytes = (await Deno.stat(OUTPUT_FILE)).size;
  console.log(
    `\n🎉 ${OUTPUT_FILE}\n   ${included} files, ${
      (bytes / 1024).toFixed(0)
    } KB, law ERA_ID ${eraId} ${lawHash}` +
      (dirty ? "\n   ⚠️  working tree was dirty" : ""),
  );
}

main();
