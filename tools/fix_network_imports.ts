import { expandGlob } from "https://deno.land/std@0.224.0/fs/expand_glob.ts";

async function run() {
    for await (const entry of expandGlob("src/network/translation_policy/*.ts")) {
        if (!entry.isFile) continue;
        let content = await Deno.readTextFile(entry.path);

        content = content.replace(/from\s+["']\.\.\/\.\.\/bootstrap\/translation_policy_([^"']+)["']/g, 'from "../../bootstrap/translation_policy/translation_policy_$1"');
        
        await Deno.writeTextFile(entry.path, content);
    }
}
run().catch(console.error);
