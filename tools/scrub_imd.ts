import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

async function scrub() {
    for await (const entry of walk(".", { exts: [".md"], skip: [/node_modules/, /.git/] })) {
        if (!entry.isFile) continue;
        const content = await Deno.readTextFile(entry.path);
        if (content.includes("I.md")) {
            const updated = content.replace(/`I\.md`/g, "`legacy_text_substrate`")
                                   .replace(/\bI\.md\b/g, "legacy_text_substrate");
            await Deno.writeTextFile(entry.path, updated);
            console.log(`Scrubbed: ${entry.path}`);
        }
    }
}

scrub();
