// deno-lint-ignore-file
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
];

async function main() {
  const pkgStr = await Deno.readTextFile("package.json");
  const pkg = JSON.parse(pkgStr);
  const OMEGA_VERSION = pkg.version;
  const ERA = pkg.era || "Unknown";
  const OUTPUT_FILE = `dist/OMEGA_EXPORT_v${OMEGA_VERSION}.md`;
  const chunks: string[] = [];

  chunks.push(
    `# OMEGA-64 | ONTOLOGY ${
      OMEGA_VERSION.split(".")[0]
    } FULL EXPORT | ERA: ${ERA}\n`,
  );
  chunks.push(
    `This document contains the full architecture of the Genesis Spore.\n\n---\n`,
  );

  const addFile = async (path: string) => {
    try {
      const content = await Deno.readTextFile(path);
      const ext = path.split(".").pop() || "text";
      const block = `## \`${path}\`\n\`\`\`${ext}\n${content}\n\`\`\`\n`;

      chunks.push(block);
      console.log(`✅ Included: ${path}`);
    } catch (e) {
      console.error(`❌ Failed: ${path}`);
    }
  };

  // Root essentials
  await addFile("README.md");
  await addFile("ROADMAP.md");
  await addFile("package.json");
  await addFile("tools/export_omega.ts");
  await addFile("index.html");
  await addFile("vite.config.ts");
  // Walk TS Source
  console.log("\nSweeping src/ ...");
  for await (
    const entry of walk("src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })
  ) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Walk V2 Bare-Metal Core
  console.log("\nSweeping omega_v2/src/ ...");
  await addFile("omega_v2/Cargo.toml");
  for await (
    const entry of walk("omega_v2/src", {
      exts: TARGET_EXTS,
      skip: EXCLUDE_DIRS,
    })
  ) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Walk ZK Guest Core
  console.log("\nSweeping omega_zk_guest/src/ ...");
  await addFile("omega_zk_guest/Cargo.toml");
  for await (
    const entry of walk("omega_zk_guest/src", {
      exts: TARGET_EXTS,
      skip: EXCLUDE_DIRS,
    })
  ) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Walk Docs
  console.log("\nSweeping docs/ ...");
  for await (
    const entry of walk("docs", { exts: [".md"], skip: EXCLUDE_DIRS })
  ) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Tools/ verification binaries excluded from LLM context payload to save tokens.

  await Deno.writeTextFile(OUTPUT_FILE, chunks.join("\n"));

  console.log(
    `\n🎉 Successfully exported OMEGA-64 to:\n -> ${OUTPUT_FILE}`,
  );
}

main();
