import { walk } from "jsr:@std/fs/walk";
import { join } from "jsr:@std/path";

async function main() {
  const tasksDir = "tasks";
  let count = 0;

  for await (const entry of walk(tasksDir, { exts: [".md"], maxDepth: 1 })) {
    if (!entry.isFile) continue;

    const content = await Deno.readTextFile(entry.path);

    // Skip if it already has YAML frontmatter
    if (content.startsWith("---")) {
      console.log(`Skipping ${entry.name} (already has frontmatter)`);
      continue;
    }

    const filename = entry.name;
    const taskIdStr = filename.split(".")[0];
    const taskIdMatch = taskIdStr.match(/^0*(\d+)/);

    // Ignore files that are not strictly numbered tasks (e.g., tasks starting with non-numbers)
    if (!taskIdMatch && !filename.match(/^\d+_/)) {
      console.log(`Skipping ${entry.name} (not a standard task file)`);
      continue;
    }

    let numericId = 0;
    if (taskIdMatch) {
      numericId = parseInt(taskIdMatch[1], 10);
    } else {
      const parts = filename.split("_");
      numericId = parseInt(parts[0], 10);
    }

    let state = "SEED";

    if (numericId <= 193) {
      // Legacy completed tasks
      state = "ORGAN";
    } else {
      // Check for checkboxes
      const hasUnchecked = content.includes("- [ ]");
      const hasChecked = content.includes("- [x]");

      if (!hasUnchecked && hasChecked) {
        state = "ORGAN";
      } else if (hasUnchecked && hasChecked) {
        state = "TISSUE";
      } else if (!hasUnchecked && !hasChecked) {
        // No checkboxes at all
        state = "SEED";
      } else {
        // Only unchecked
        state = "SEED";
      }
    }

    const baseTaskId = filename.split(".")[0];

    const frontmatter = `---
task_id: "${baseTaskId}"
idea_id: "legacy-${baseTaskId}"
state: "${state}"
origin:
  substrate: "local"
  uri: "tasks/${filename}"
phase_vector:
  consensus: 0
  kinematics: 0
  codeicide: 0
warrant_required: false
---

`;

    await Deno.writeTextFile(entry.path, frontmatter + content);
    console.log(`Migrated ${entry.name} to state: ${state}`);
    count++;
  }

  console.log(`\nMigration complete. Processed ${count} files.`);
}

if (import.meta.main) {
  main().catch(console.error);
}
