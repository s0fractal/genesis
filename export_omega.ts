import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const OUTPUT_FILE = "OMEGA_EXPORT.md";

const TARGET_EXTS = [".ts", ".rs", ".wgsl", ".toml", ".html"];
const EXCLUDE_DIRS = [/node_modules/, /target/, /pkg/, /\.git/, /\.gemini/, /dist/];

async function main() {
  const chunks: string[] = [];
  chunks.push("# OMEGA-64 | ONTOLOGY 17 ABSOLUTE EXPORT\n");
  chunks.push("This document contains the entire architectural core of the Genesis Spore, including the TS genetic transpiler, the Rust WASM SIMD execution threads, and the Biological Context Substrate (`I.md`).\n\n---\n");

  const addFile = async (path: string) => {
    try {
      const content = await Deno.readTextFile(path);
      const ext = path.split('.').pop() || "text";
      chunks.push(`## \`${path}\``);
      chunks.push(`\`\`\`${ext}\n${content}\n\`\`\`\n`);
      console.log(`✅ Included: ${path}`);
    } catch(e) {
      console.error(`❌ Failed: ${path}`);
    }
  };

  // Root essentials
  await addFile("I.md");
  await addFile("index.html");
  await addFile("vite.config.ts");
  await addFile("omega_core/Cargo.toml");
  
  // Walk TS Source
  console.log("\nSweeping src/ ...");
  for await (const entry of walk("src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })) {
    if (entry.isFile) await addFile(entry.path);
  }
  
  // Walk Rust Core
  console.log("\nSweeping omega_core/src/ ...");
  for await (const entry of walk("omega_core/src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })) {
    if (entry.isFile) await addFile(entry.path);
  }

  await Deno.writeTextFile(OUTPUT_FILE, chunks.join("\n"));
  console.log(`\n🎉 Successfully exported all core OMEGA-64 files to ${OUTPUT_FILE}`);
}

main();
