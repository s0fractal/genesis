import { encode } from "npm:@toon-format/toon";
import { Tissue } from "./src/quine.ts";

function generateIMd(tissue: Record<string, any>): string {
  // 1. Prepare global nodes table
  const nodesArr = [];
  const entries = Object.entries(tissue);
  let currentLine = 12; // Estimate line where the first ### node will start based on our metadata block size

  let markdownBody = "";

  // Group nodes by "context_hash" which acts as our Field/Category
  const categories: Record<string, [string, any][]> = {};
  for (const [id, node] of entries) {
     const field = node.identity.context_hash || "Misc";
     if (!categories[field]) categories[field] = [];
     categories[field].push([id, node]);
  }

  for (const [field, nodes] of Object.entries(categories)) {
     markdownBody += `## ${field}\n\n`;
     // We added 2 lines for field header
     
     for (const [id, node] of nodes) {
        // Build the Markdown section for a node
        // ID
        let nodeBlock = `### ${id}\n`;
        // Identity
        nodeBlock += `#### Identity\n`;
        nodeBlock += `hash: ${node.identity.structural_hash}\n`;
        nodeBlock += `version: ${node.identity.version}\n`;
        if (node.identity.parents && node.identity.parents.length > 0) {
            nodeBlock += `parents: ${JSON.stringify(node.identity.parents)}\n`;
        }
        nodeBlock += `\n`;
        
        // IO
        nodeBlock += `#### IO\n`;
        // simple yaml representation
        const serializeIO = (ioObj: any, indent: string = "") => {
           let res = "";
           for (const [k, v] of Object.entries(ioObj)) {
               if (typeof v === 'object' && v !== null) {
                   res += `${indent}${k}:\n${serializeIO(v, indent + "  ")}`;
               } else {
                   res += `${indent}${k}: ${v}\n`;
               }
           }
           return res;
        };
        nodeBlock += serializeIO(node.io);
        nodeBlock += `\n`;

        // IR
        if (node.expr && node.expr.body) {
           nodeBlock += `#### IR\n`;
           
           if (typeof node.expr.body === "string" || Array.isArray(node.expr.body)) {
              nodeBlock += `\`\`\`json\n${JSON.stringify(node.expr.body, null, 2)}\n\`\`\`\n\n`;
           } else {
              nodeBlock += `\`\`\`json\n${JSON.stringify(node.expr.body, null, 2)}\n\`\`\`\n\n`;
           }
        }
        
        // Implementation
        if (node.implementation && Object.keys(node.implementation).length > 0) {
           nodeBlock += `#### Implementation\n`;
           for (const [lang, code] of Object.entries(node.implementation)) {
               nodeBlock += `\`\`\`${lang}\n${(code as string).trim()}\n\`\`\`\n\n`;
           }
        }

        markdownBody += nodeBlock + "---\n\n";

        // Create the matrix entry
        nodesArr.push({
           id,
           field,
           type: node.essence.type,
           substrate: node.essence.substrate,
           energy: node.physics ? node.physics.energy_cost : 0,
           stability: node.physics ? node.physics.stability : 1.0,
           link: `#${id}`
        });
     }
  }

  // 3. Now we need to pre-calculate line numbers. Let's do a fast generation then substitute.
  let headerTOON = "";
  headerTOON += `---\n`;
  headerTOON += `# TISSUE METADATA (TOON FORMAT)\n`;
  headerTOON += `# The Universal Registry of the System Runtime\n\n`;
  headerTOON += encode(nodesArr).replace(/\]:/, "]{id, field, type, substrate, energy, stability, link, line}:"); 
  headerTOON += `\n---\n\n# 🧬 THE TISSUE (ACTIVE CANON)\n\n`;
  
  // Actually, wait, tracking line numbers directly is easier by splitting markdownBody and counting
  // But let's build the full string first, find the indices, then inject them into the initial string
  
  let fullDoc = headerTOON + markdownBody;
  
  // Re-inject line numbers into the TOON table
  const lines = fullDoc.split("\n");
  for (let i = 0; i < lines.length; i++) {
     if (lines[i].startsWith("### ")) {
        const nodeId = lines[i].substring(4).trim();
        // find node in header array
        const searchStr = `${nodeId},`;
        for (let j = 0; j < Math.min(100, lines.length); j++) {
           if (lines[j].includes(searchStr) && !lines[j].includes("[nodes]")) {
               lines[j] = lines[j] + `, ${i + 1}`; // 1-based index
               break;
           }
        }
     }
  }

  // History Extraction (from tissue_history or mutation logs)
  let footer = `## History\n#### Event Log (Semantic Commits)\n`;
  if (tissue["tissue_history"]) {
     const historyAst = tissue["tissue_history"].expr.body;
     try {
         const epochs = JSON.parse(historyAst);
         const epochTable = epochs.map((ep: any) => ({
             timestamp: ep.timestamp,
             log_size: ep.operations ? ep.operations.length : 0
         }));
         footer += `\`\`\`toon\n${encode(epochTable)}\n\`\`\`\n`;
     } catch(e) {
         footer += `\`\`\`toon\n[]\n\`\`\`\n`;
     }
  } else {
     footer += `\`\`\`toon\n[0]{timestamp, log_size}:\n\`\`\`\n`;
  }
  
  const finalDoc = lines.join("\n") + footer;
  return finalDoc;
}

const md = generateIMd(Tissue);
Deno.writeTextFileSync("./I.md", md);
console.log("Written to I.md");
