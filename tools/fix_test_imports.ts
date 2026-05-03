import { expandGlob } from "https://deno.land/std@0.224.0/fs/expand_glob.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function run() {
    for await (const entry of expandGlob("tests/translation_policy/*.ts")) {
        if (!entry.isFile) continue;
        let content = await Deno.readTextFile(entry.path);

        content = content.replace(/from\s+["']\.\.\/\.\.\/src\/network\/translation_policy_([^"']+)["']/g, 'from "../../src/network/translation_policy/translation_policy_$1"');
        content = content.replace(/from\s+["']\.\.\/\.\.\/src\/bootstrap\/translation_policy_([^"']+)["']/g, 'from "../../src/bootstrap/translation_policy/translation_policy_$1"');
        
        await Deno.writeTextFile(entry.path, content);
    }
}
run().catch(console.error);
