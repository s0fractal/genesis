import { expandGlob } from "https://deno.land/std@0.224.0/fs/expand_glob.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import {
  basename,
  dirname,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";

async function run() {
  const targets = [
    {
      pattern: "src/network/translation_policy_*.ts",
      dest: "src/network/translation_policy",
    },
    {
      pattern: "src/bootstrap/translation_policy_*.ts",
      dest: "src/bootstrap/translation_policy",
    },
    {
      pattern: "tests/translation_policy_*.ts",
      dest: "tests/translation_policy",
    },
  ];

  for (const { pattern, dest } of targets) {
    await ensureDir(dest);
    const files = [];
    for await (const entry of expandGlob(pattern)) {
      if (entry.isFile) files.push(entry);
    }

    for (const file of files) {
      const filename = basename(file.path);
      const newPath = join(Deno.cwd(), dest, filename);
      let content = await Deno.readTextFile(file.path);

      // Update relative imports
      content = content.replace(
        /from\s+["'](\.\/|\.\.\/)([^"']+)["']/g,
        (match, prefix, path) => {
          if (prefix === "./") {
            if (path.startsWith("translation_policy_")) {
              // Stays in the same folder
              return `from "./${path}"`;
            } else {
              // Goes one level up
              return `from "../${path}"`;
            }
          } else if (prefix === "../") {
            if (
              dest === "tests/translation_policy" && path.startsWith("tests/")
            ) {
              // Tests importing other tests
              return `from "../../${path}"`;
            }
            if (
              path.startsWith("network/translation_policy_") ||
              path.startsWith("bootstrap/translation_policy_")
            ) {
              // Cross-folder translation_policy imports
              // from "../network/translation_policy_foo.ts" in tests/translation_policy
              // needs to become "../../src/network/translation_policy/translation_policy_foo.ts"
              // Wait, Deno uses "../src/network/translation_policy_foo.ts" from tests.
              // Actually, let's just prepend "../" to any "../" import to go one level higher since we nested it by one folder.
              // Wait, what if tests/translation_policy_x_test.ts had `import "../src/network/translation_policy_y.ts"`?
              // Then it would become `import "../../src/network/translation_policy_y.ts"` which is correct, BUT we also moved translation_policy_y.ts to `src/network/translation_policy/`!
            }
            return `from "../${prefix}${path}"`;
          }
          return match;
        },
      );

      // Special handling for the move to translation_policy/ subdirectory.
      // If the old code imported `../src/network/translation_policy_...`, the new path has `translation_policy/` inserted.
      // For example: from "../../src/network/translation_policy_foo.ts"
      // becomes: from "../../src/network/translation_policy/translation_policy_foo.ts"
      content = content.replace(
        /from\s+["'](\.\.\/\.\.\/src\/network\/)translation_policy_([^"']+)["']/g,
        'from "$1translation_policy/translation_policy_$2"',
      );
      content = content.replace(
        /from\s+["'](\.\.\/network\/)translation_policy_([^"']+)["']/g,
        'from "$1translation_policy/translation_policy_$2"',
      );
      content = content.replace(
        /from\s+["'](\.\.\/bootstrap\/)translation_policy_([^"']+)["']/g,
        'from "$1translation_policy/translation_policy_$2"',
      );

      await Deno.writeTextFile(newPath, content);
      await Deno.remove(file.path);
      console.log(`Moved & Updated: ${filename}`);
    }
  }
}

run().catch(console.error);
