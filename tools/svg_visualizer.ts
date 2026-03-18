import { parseTissueFromMarkdown, State, Sigma3Node } from "../src/quine.ts";

const TISSUE_FILE = "./I.md";
const OUTPUT_FILE = "./world.svg";

// Layout engine constants
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 1500;
const PADDING_X = 250;
const PADDING_Y = 200;

interface NodeRenderData {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  rotationDuration: string;
  node: Sigma3Node;
}

const COLORS = {
  bg: "#0d1117",
  text: "#c9d1d9",
  pure_fn: "#58a6ff", // TS blue
  meta_fn: "#8b949e", // Subdued grey
  module: "#d2a8ff",  // Purple
  data: "#3fb950",    // Green
  link: "#30363d",    // Dark grey
};

function getShapeColor(node: Sigma3Node): string {
  if (node.essence.substrate === "rust") return "#f78166"; // Rust orange
  switch (node.essence.type) {
    case "pure_fn": return COLORS.pure_fn;
    case "meta_fn": return COLORS.meta_fn;
    case "module": return COLORS.module;
    default: return COLORS.data;
  }
}

import { encodeHex } from "jsr:@std/encoding/hex";

// Phase Engine Logic embedded directly or pseudo-linked
function hashToPhase(hashString: string): number {
  if (!hashString || hashString === "init") return 0;
  // Deterministic angle derived from first 4 characters of hash
  const sliced = hashString.substring(0, 4);
  const num = parseInt(sliced, 16);
  return num % 256;
}

function getRadius(node: Sigma3Node): number {
  const energy = node.physics?.energy_cost || 10;
  // Floor(Value/256) conceptually maps to Energy
  const scaled = Math.max(80, Math.min(300, energy * 8));
  return scaled;
}

function getCycle(node: Sigma3Node): number {
  const energy = node.physics?.energy_cost || 10;
  return Math.floor(energy / 10);
}

// 3D Topology (Z-Axis Matrix)
function getZIndex(node: Sigma3Node): number {
  if (node.essence.substrate === "rust" || node.essence.substrate === "wasm") return 0; // The deep core
  switch (node.essence.type) {
    case "pure_fn": return 100;
    case "meta_fn": return 200;
    case "module": return 300;
    default: return 50;
  }
}

// Temporal Frequency (Spinning Cloud)
function getRotationSpeed(z: number): string {
  if (z === 0) return "0.5s"; // Blur electrons
  if (z <= 100) return "5s"; // Swift pure math
  if (z <= 200) return "30s"; // Deliberate orbit
  return "600s"; // The bitcoin clock
}

// Polar Phase Space + 2.5D Projection
function performLayout(state: State): NodeRenderData[] {
  let renderedNodes: NodeRenderData[] = [];
  const entries = Object.entries(state);
  
  const CENTER_X = CANVAS_WIDTH / 2;
  const CENTER_Y = CANVAS_HEIGHT / 2;
  const FOCAL_LENGTH = 300; // Determines projection depth distortion

  for (const [id, node] of entries) {
    const phase = hashToPhase(node.identity.structural_hash);
    const cycle = getCycle(node);
    const z = getZIndex(node);
    const rotationDuration = getRotationSpeed(z);
    
    // Convert 0-255 phase into 0-2PI radians
    const angleRad = (phase / 256) * Math.PI * 2;
    // Map cycle to distance from absolute center
    const distance = 100 + (cycle * 250);

    // 2D Polar
    const rawX = distance * Math.cos(angleRad);
    const rawY = distance * Math.sin(angleRad);
    
    // 2.5D Perspective Scaling
    const scaleZ = FOCAL_LENGTH / (FOCAL_LENGTH + z);
    
    // The deeper the Z, the smaller it is, and the lower it drops visually
    const projectedX = CENTER_X + (rawX * scaleZ);
    const projectedY = CENTER_Y + (rawY * scaleZ) - (z * 1.5); // Parallax Shift

    renderedNodes.push({
      id,
      node,
      z,
      rotationDuration,
      x: projectedX,
      y: projectedY,
      radius: Math.max(10, Math.min(80, (node.physics?.energy_cost || 10) * scaleZ * 1.5))
    });
  }
  
  // CRITICAL: Sort by Z Ascending to achieve DOM depth (Deepest nodes rendered first, overlaid by highest nodes)
  renderedNodes = renderedNodes.sort((a, b) => a.z - b.z);

  return renderedNodes;
}


function renderEdges(nodes: NodeRenderData[]): string {
  let edgesSvg = "";
  
  // Minimal dependency parsing: if node.id is in parents string, connect them.
  // In later versions, we will parse latent_edges or IO directly.
  for (const source of nodes) {
    for (const target of nodes) {
      if (source.id === target.id) continue;
      
      const targetHash = target.node.identity.structural_hash;
      const parents = source.node.identity.parents || [];
      
      // If source depends on target, draw a line from target -> source
      if (parents.includes(targetHash)) {
          edgesSvg += `<path d="M ${target.x} ${target.y} L ${source.x} ${source.y}" stroke="${COLORS.link}" stroke-width="2" marker-end="url(#arrow)" fill="none" opacity="0.6"/>\n`;
      }
    }
  }
  return edgesSvg;
}

function renderNodes(nodes: NodeRenderData[]): string {
  return nodes.map((data) => {
    const { x, y, z, rotationDuration, radius, id, node } = data;
    const color = getShapeColor(node);
    // Darken and blur deeper Z-index elements minimally to imply distance 
    const depthShadowing = Math.max(0.3, 1.0 - (z / 800));
    const opacity = (node.physics?.stability || 1.0) * depthShadowing;
    
    // Inject the raw IR as a data payload into the group so Deno/JS can read it, but browsers ignore it
    const payload = JSON.stringify(node, null, 2)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    
    let shape = "";
    if (node.essence.type === "pure_fn") {
        shape = `<circle cx="0" cy="0" r="${radius}" fill="${color}" fill-opacity="${opacity}" stroke="#ffffff" stroke-width="2" />`;
    } else if (node.essence.type === "meta_fn") {
        shape = `<rect x="${-radius}" y="${-radius}" width="${radius * 2}" height="${radius * 2}" fill="${color}" fill-opacity="${opacity}" stroke="#ffffff" stroke-width="2" rx="${radius/4}" />`;
    } else {
        shape = `<polygon points="${0},${-radius} ${radius},${0} ${0},${radius} ${-radius},${0}" fill="${color}" fill-opacity="${opacity}" stroke="#ffffff" stroke-width="2" />`;
    }

    // CSS Rotating transform + XY translation wrapper
    return `
    <g transform="translate(${x}, ${y})">
      <g id="${id}" data-hash="${node.identity.structural_hash}" data-ir-id="${id}" data-kind="${node.essence.type}" data-substrate="${node.essence.substrate}" data-z="${z}">
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="${rotationDuration}" repeatCount="indefinite" />
        <desc type="application/json">${payload}</desc>
        ${shape}
        <text x="0" y="${-radius - 10}" fill="${COLORS.text}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${Math.max(8, 16 - z/100)}">${id}</text>
        <text x="0" y="${-radius - 22}" fill="#777" text-anchor="middle" font-family="monospace" font-size="${Math.max(6, 10 - z/100)}">${node.essence.type} | Z:${z}</text>
      </g>
    </g>`;
  }).join("\n");
}

async function main() {
  console.log(`[SVG Visualizer] Reading Ontology from ${TISSUE_FILE}...`);
  const state = await parseTissueFromMarkdown(TISSUE_FILE);
  const nodes = performLayout(state);
  
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="background-color: ${COLORS.bg}; font-family: sans-serif;">
  <defs>
    <!-- Arrowhead for dependency lines -->
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${COLORS.link}" />
    </marker>
  </defs>

  <!-- Topology Graph Edges (Latent Links & Dependencies) -->
  <g id="tissue-edges">
    ${renderEdges(nodes)}
  </g>

  <!-- Ontology Neurons (Geometry mapped to ASTs) -->
  <g id="tissue-nodes">
    ${renderNodes(nodes)}
  </g>
</svg>
`;

  await Deno.writeTextFile(OUTPUT_FILE, svgContent);
  console.log(`[SVG Visualizer] 🌍 V1 Spatial Graph generated: ${OUTPUT_FILE}`);
}

if (import.meta.main) {
  main().catch(console.error);
}
