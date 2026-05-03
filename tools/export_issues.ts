import { expandGlob } from "https://deno.land/std@0.224.0/fs/expand_glob.ts";

async function main() {
    console.log("🌌 OMEGA-64: Generating PUBLIC_ISSUES.md from tasks/...");
    
    const issues: { id: string, title: string, content: string }[] = [];
    
    for await (const file of expandGlob("tasks/*.md")) {
        const text = await Deno.readTextFile(file.path);
        const match = text.match(/^#\s+(.+)$/m);
        const title = match ? match[1].trim() : file.name.replace(".md", "");
        issues.push({ id: file.name, title, content: text });
    }
    
    issues.sort((a, b) => a.id.localeCompare(b.id));

    const outChunks = [];
    outChunks.push("# 🌌 OMEGA-64 Public Issue Tracker");
    outChunks.push("Welcome to the Liquid Architecture. The following are open engineering tasks and historical roadmap items. If you are a new contributor, look for items tagged `good first issue`.\n");
    
    outChunks.push("## Active Tasks Directory\n");
    for (const issue of issues) {
        // Decide tags
        const tags = ["core"];
        if (issue.title.toLowerCase().includes("webgpu") || issue.title.toLowerCase().includes("wgsl")) tags.push("webgpu");
        if (issue.title.toLowerCase().includes("libp2p") || issue.title.toLowerCase().includes("network")) tags.push("networking");
        if (issue.title.toLowerCase().includes("zk") || issue.title.toLowerCase().includes("proof")) tags.push("zk-snark");
        if (issue.title.toLowerCase().includes("ui") || issue.title.toLowerCase().includes("hud")) tags.push("frontend");
        
        // Add "good first issue" randomly for small files, or just default to it for specific eras
        if (issue.content.length < 3000) tags.push("good first issue");

        outChunks.push(`### [${issue.id}] ${issue.title}`);
        outChunks.push(`**Tags:** ${tags.map(t => "\\`" + t + "\\`").join(", ")}`);
        
        // Extract the first paragraph or description
        let descMatch = issue.content.split("\n").filter(line => line.trim().length > 0 && !line.startsWith("#") && !line.startsWith("-"));
        if (descMatch.length > 0) {
            outChunks.push(`\n> ${descMatch[0].substring(0, 200)}...\n`);
        }
        outChunks.push(`[View Full Task](./tasks/${issue.id})\n`);
    }

    await Deno.writeTextFile("PUBLIC_ISSUES.md", outChunks.join("\n"));
    console.log(`✅ Successfully generated PUBLIC_ISSUES.md with ${issues.length} tasks!`);
}

if (import.meta.main) {
    main().catch(console.error);
}
