import { walk } from "jsr:@std/fs/walk";

const MACRO_GROUPS = [
  "EXISTENCE (Буття)",
  "COGNITION (Пізнання)",
  "POWER (Сила)",
  "UNION (Єдність)",
  "CREATION (Творіння)",
  "EXCHANGE (Обмін)",
  "ORDER (Порядок)",
  "TRANSCENDENCE"
];

function computeOctetGeometry(address: string) {
  const parts = address.replace("oct:", "").split(".").map(Number);
  const depth = parts.length;
  const phase = parts[parts.length - 1];
  let angle = 0;
  for (let i = 0; i < depth; i++) {
    angle += (parts[i] * 360) / Math.pow(8, i + 1);
  }
  return { depth, phase, angle_deg: angle, width_deg: 360 / Math.pow(8, depth), slot: parts[0] };
}

async function syncMap() {
  console.log("%c🌌 OMEGA-64 Octet Map Sync...", "color: magenta; font-weight: bold");
  
  const targetDirs = ["omega_v2", "src", "tasks", "docs", "tests"];
  const regex = /@oct\s+([0-7.]+)(?:\s+(.*))?/g;
  
  const newNodes: any[] = [];
  
  for (const dir of targetDirs) {
    try {
      for await (const entry of walk(dir, { exts: [".rs", ".ts", ".wgsl", ".md"] })) {
        if (!entry.isFile) continue;
        const content = await Deno.readTextFile(entry.path);
        let match;
        while ((match = regex.exec(content)) !== null) {
          const rawAddress = match[1];
          const titleHint = match[2]?.trim() || "Dynamic Semantic Node";
          const address = rawAddress.startsWith("oct:") ? rawAddress : `oct:${rawAddress}`;
          
          const geom = computeOctetGeometry(address);
          
          const title = geom.depth === 1 
            ? `${MACRO_GROUPS[geom.slot]} / ${titleHint}`
            : titleHint;

          newNodes.push({
            record_type: "node",
            address,
            depth: geom.depth,
            slot: geom.slot,
            phase: geom.phase,
            angle_deg: geom.angle_deg,
            width_deg: geom.width_deg,
            energy: 0.5, // Default for auto-discovered
            kind: "auto",
            title,
            path: entry.path,
            refs: [],
            status: "experimental-map",
            notes: "Auto-discovered via @oct pragma"
          });
        }
      }
    } catch (e) {
      console.warn(`Could not walk directory ${dir}`);
    }
  }

  // Load existing map
  const indexPath = "tasks/octet-index.ndjson";
  let existingLines: string[] = [];
  try {
    existingLines = (await Deno.readTextFile(indexPath)).split("\n").filter(Boolean);
  } catch (e) {
    console.warn("No existing octet-index.ndjson found, creating new.");
  }

  const existingNodes = new Map();
  let metaLine = "";
  
  for (const line of existingLines) {
    const obj = JSON.parse(line);
    if (obj.record_type === "meta") {
      metaLine = line;
    } else {
      existingNodes.set(obj.address, obj);
    }
  }

  // Merge new nodes
  let added = 0;
  for (const node of newNodes) {
    // If it exists, we just update the path/title, but keep existing notes/energy/kind if it's manual
    if (existingNodes.has(node.address)) {
      const existing = existingNodes.get(node.address);
      if (existing.kind !== "auto") {
         // Keep the manual one, but maybe update path if it was empty
         if (!existing.path) existing.path = node.path;
         existingNodes.set(node.address, existing);
      } else {
         existingNodes.set(node.address, node);
      }
    } else {
      existingNodes.set(node.address, node);
      added++;
    }
  }

  const outputLines = [metaLine || JSON.stringify({
    record_type: "meta",
    schema: "OMEGA-64_OCTET_INDEX",
    version: "0.1.0",
    status: "experimental",
    updated_at_utc: new Date().toISOString()
  })];

  for (const node of existingNodes.values()) {
    outputLines.push(JSON.stringify(node));
  }

  await Deno.writeTextFile(indexPath, outputLines.join("\n") + "\n");
  console.log(`%c✅ Sync complete. Discovered ${newNodes.length} pragmas. Added ${added} new nodes.`, "color: green");
}

syncMap();
