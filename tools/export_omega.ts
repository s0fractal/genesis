// deno-lint-ignore-file
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const TARGET_EXTS = [".ts", ".rs", ".wgsl", ".toml", ".html", ".json", ".proto"];
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
  const OUTPUT_FILE_V1 = `dist/OMEGA_EXPORT_v${OMEGA_VERSION}_V1.md`;
  const OUTPUT_FILE_V2 = `dist/OMEGA_EXPORT_v${OMEGA_VERSION}_V2.md`;

  const chunksV1: string[] = [];
  const chunksV2: string[] = [];

  chunksV1.push(
    `# OMEGA-64 | ONTOLOGY ${
      OMEGA_VERSION.split(".")[0]
    } LEGACY V1 EXPORT | ERA: ${ERA}\n`,
  );
  chunksV1.push(
    `This document contains the legacy Core V1 and ZK Guest architecture of the Genesis Spore.\n\n---\n`,
  );

  chunksV2.push(
    `# OMEGA-64 | ONTOLOGY ${
      OMEGA_VERSION.split(".")[0]
    } BARE-METAL V2 EXPORT | ERA: ${ERA}\n`,
  );
  chunksV2.push(
    `This document contains the bleeding edge V2 engine, encompassing the zero-copy WASM, WebGPU shaders, and Continuous Delta Networking.\n\n---\n`,
  );

  const addFile = async (path: string) => {
    try {
      const content = await Deno.readTextFile(path);
      const ext = path.split(".").pop() || "text";
      const block = `## \`${path}\`\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
      
      // Route files mathematically to V2 if they specifically belong there
      if (path.includes("v2") || path.includes("V2")) {
          chunksV2.push(block);
      } else {
          chunksV1.push(block);
      }
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
  await addFile("omega_core/Cargo.toml");

  // Walk TS Source
  console.log("\nSweeping src/ ...");
  for await (
    const entry of walk("src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })
  ) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Walk Rust Core
  console.log("\nSweeping omega_core/src/ ...");
  for await (
    const entry of walk("omega_core/src", {
      exts: TARGET_EXTS,
      skip: EXCLUDE_DIRS,
    })
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

  await Deno.writeTextFile(OUTPUT_FILE_V1, chunksV1.join("\n"));
  await Deno.writeTextFile(OUTPUT_FILE_V2, chunksV2.join("\n"));
  
  console.log(
    `\n🎉 Successfully exported OMEGA-64 to:\n -> ${OUTPUT_FILE_V1}\n -> ${OUTPUT_FILE_V2}`,
  );
}

main();
