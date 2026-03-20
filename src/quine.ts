// deno-lint-ignore-file
import { encode } from "npm:@toon-format/toon";
import { encode as packMsgPack, decode as unpackMsgPack } from "npm:@msgpack/msgpack";

// --- TYPES (PHYSICS) ---

export type Delta = {
  added: string[];
  updated: string[];
  removed: string[];
};

export type TransformResult<T> = {
  next: T;
  diff: Delta;
};

export interface Identity {
  structural_hash: string;
  context_hash: string;
  parents: string[];
  version: number;
}

export interface Essence {
  type: "pure_fn" | "meta_fn" | "module" | "ontology_compiler";
  level: number;
  substrate: "ts" | "wasm" | "rust";
}

export interface Physics {
  energy_cost: number;
  stability: number;
  temporal?: {
    frequency: number; // Hz (Ticks per orbit)
    phase: number;     // 0..255 (Current Angle)
  };
}

export type IRNode = IRConst | IRVar | IROp | IRCall | IRIf | IRBlock;

export interface IRConst { kind: "const"; value: number; bits: 32 | 64; }
export interface IRVar { kind: "var"; name: string; type: "i32" | "i64"; }
export interface IROp {
  kind: "op";
  op: "add" | "sub" | "mul" | "div" | "and" | "or" | "xor" | "shl" | "shr";
  args: IRNode[];
}
export interface IRCall { kind: "call"; target: string; args: IRNode[]; }
export interface IRIf { kind: "if"; cond: IRNode; then: IRNode; else: IRNode; }
export interface IRBlock { kind: "block"; statements: IRNode[]; result: IRNode; }

export interface IRFunction {
  args: { name: string; type: string }[];
  ret: string;
  body: IRNode | string; 
}

export interface Sigma3Node {
  identity: Identity;
  essence: Essence;
  physics: Physics;
  io: Record<string, any>;
  ir: IRFunction;
  implementation?: {
    ts?: string;
    wasm?: string;
  };
  mutation_log: string[];
}

export type State = Record<string, Sigma3Node>;

// --- THE DISPATCHER (The Bridge to Big Compilers) ---

export const Dispatcher = {
  async foldForRust(node: Sigma3Node): Promise<string> {
    return JSON.stringify(node.ir);
  },

  executeInTs(node: Sigma3Node, args: Record<string, number>): number {
    const run = (ir: IRNode): number => {
      if (ir.kind === "const") return ir.value;
      if (ir.kind === "var") return args[ir.name] || 0;
      if (ir.kind === "op") {
        const [a, b] = ir.args.map(run);
        switch (ir.op) {
          case "add": return a + b;
          case "sub": return a - b;
          case "mul": return a * b;
          case "div": return b !== 0 ? a / b : 0;
          case "and": return a & b;
          case "or": return a | b;
          case "xor": return a ^ b;
          case "shl": return a << b;
          case "shr": return a >> b;
          default: return 0;
        }
      }
      return 0;
    };
    return run(node.ir.body as IRNode);
  },
  
  validateNodeIntegrity(node: Sigma3Node): boolean {
    return !!(
        node && 
        node.identity && 
        node.identity.context_hash && 
        node.ir && 
        node.physics && 
        node.physics.energy_cost !== undefined
    );
  }
};

// --- THE BOOTSTRAPPER (ACTUATOR) ---

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export async function executeNeuron(
  state: State, 
  alias: string, 
  args: Record<string, any> = {}
) {
  const neuron = state[alias];
  if (!neuron) {
    throw new Error(`Cannot execute neuron ${alias}: Not found in active state tissue.`);
  }
  
  if (!Dispatcher.validateNodeIntegrity(neuron)) {
      throw new Error(`Metabolic Reject: Neuron ${alias} failed structural validation. Structural execution denied.`);
  }
  
  const { essence } = neuron;
  
  const argNames = [...Object.keys(args), "Dispatcher"];
  const argValues = [...Object.values(args), Dispatcher];

  if (essence.substrate === "ts") {
    // Check if we use the fallback legacy string implementation for meta_neurons
    if (neuron.implementation?.ts && essence.type === "meta_fn") {
       const fn = new AsyncFunction(...argNames, neuron.implementation.ts);
       return await fn(...argValues);
    }
    
    // Otherwise route the AST to the Dispatcher (pure interpretation)
    return Dispatcher.executeInTs(neuron, args);
  } else if (essence.substrate === "wasm") {
    throw new Error(`Substrate Dispatcher: WASM execution for ${alias} not yet supported.`);
  } else if (essence.substrate === "rust") {
    throw new Error(`Substrate Dispatcher: RUST shared memory call for ${alias} not yet supported.`);
  } else {
    throw new Error(`Unknown substrate ${essence.substrate} for ${alias}`);
  }
}

// --- HYDRATION PROTOCOLS (Ontology 5.0) ---

export function serializeTissueToMarkdown(tissue: State): string {
  const nodesArr = [];
  const entries = Object.entries(tissue);
  let markdownBody = "";

  const categories: Record<string, [string, any][]> = {};
  for (const [id, node] of entries) {
     const field = node.identity.context_hash || "Misc";
     if (!categories[field]) categories[field] = [];
     categories[field].push([id, node]);
  }

  for (const [field, nodes] of Object.entries(categories)) {
     markdownBody += `## ${field}\n\n`;
     for (const [id, node] of nodes) {
        let nodeBlock = `### ${id}\n`;
        nodeBlock += `#### Identity\n`;
        nodeBlock += `hash: ${node.identity.structural_hash}\n`;
        nodeBlock += `version: ${node.identity.version}\n`;
        if (node.identity.parents && node.identity.parents.length > 0) {
            nodeBlock += `parents: ${JSON.stringify(node.identity.parents)}\n`;
        }
        nodeBlock += `\n`;
        
        nodeBlock += `#### IO\n`;
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

        if (node.ir && node.ir.body !== undefined) {
           nodeBlock += `#### IR\n`;
           if (typeof node.ir.body === "string" || Array.isArray(node.ir.body)) {
              let bodyStr = typeof node.ir.body === "string" ? node.ir.body : JSON.stringify(node.ir.body);
              if (bodyStr.startsWith('"') && bodyStr.endsWith('"')) {
                 bodyStr = JSON.parse(bodyStr); // unescape string safely
              }
              nodeBlock += `\`\`\`json\n${bodyStr}\n\`\`\`\n\n`;
           } else {
              nodeBlock += `\`\`\`json\n${JSON.stringify(node.ir.body, null, 2)}\n\`\`\`\n\n`;
           }
        }
        
        if (node.implementation && Object.keys(node.implementation).length > 0) {
           nodeBlock += `#### Implementation\n`;
           for (const [lang, code] of Object.entries(node.implementation)) {
               nodeBlock += `\`\`\`${lang}\n${(code as string).trim()}\n\`\`\`\n\n`;
           }
        }

        markdownBody += nodeBlock + "---\n\n";

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

  let headerTOON = "";
  headerTOON += `---\n`;
  headerTOON += `# TISSUE METADATA (TOON FORMAT)\n`;
  headerTOON += `# The Universal Registry of the System Runtime\n\n`;
  headerTOON += encode(nodesArr).replace(/\]:/, "]{id,field,type,substrate,energy,stability,link,line}:"); 
  headerTOON += `\n---\n\n# 🧬 THE TISSUE (ACTIVE CANON)\n\n`;
  
  let fullDoc = headerTOON + markdownBody;
  
  const lines = fullDoc.split("\n");
  for (let i = 0; i < lines.length; i++) {
     if (lines[i].startsWith("### ")) {
        const nodeId = lines[i].substring(4).trim();
        const searchStr = `${nodeId},`;
        for (let j = 0; j < Math.min(100, lines.length); j++) {
           if (lines[j].includes(searchStr) && !lines[j].includes("[nodes]")) {
               lines[j] = lines[j] + `, ${i + 1}`;
               break;
           }
        }
     }
  }

  let footer = `\n`;
  
  return lines.join("\n") + footer;
}

export async function parseTissueFromMarkdown(path: string): Promise<State> {
  const content = await Deno.readTextFile(path);
  const state: State = {};
  
  const lines = content.split("\n");
  let toonBlock = "";
  let capturingToon = false;
  
  for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("---") && i === 0) {
          capturingToon = true;
          continue;
      }
      if (lines[i].startsWith("---") && capturingToon) {
          break;
      }
      if (capturingToon) {
          toonBlock += lines[i] + "\n";
      }
  }

  // Parse TOON metadata nodes table via regex since it's highly structured CSV-like
  const nodePointers: Record<string, {line: number, field: string, type: any, substrate: any, energy: number, stability: number}> = {};
  const metaLines = toonBlock.split("\n");
  let inNodesTable = false;
  
  for (const line of metaLines) {
      if (line.includes("[]{id,") || line.includes("]{id,")) {
          inNodesTable = true;
          continue;
      }
      if (inNodesTable && line.startsWith("  ")) {
          const parts = line.trim().split(",").map(p => p.trim());
          if (parts.length >= 8) {
              const [id, field, type, substrate, energy, stability, link, lnr] = parts;
              nodePointers[id] = {
                  line: parseInt(lnr, 10),
                  field,
                  type,
                  substrate,
                  energy: parseInt(energy, 10),
                  stability: parseFloat(stability)
              };
          }
      } else if (inNodesTable && line.trim() === "") {
          inNodesTable = false;
      }
  }

  const parseYamlLike = (block: string[]) => {
      const result: any = {};
      const stack: {obj: any, indent: number}[] = [{obj: result, indent: -1}];
      
      for (const line of block) {
          if (!line.trim() || line.startsWith("####")) continue;
          const match = line.match(/^(\s*)([^:]+):(.*)$/);
          if (match) {
              const indent = match[1].length;
              const key = match[2].trim();
              const val = match[3].trim();
              
              while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                  stack.pop();
              }
              
              const curObj = stack[stack.length - 1].obj;
              
              if (val === "") {
                  curObj[key] = {};
                  stack.push({obj: curObj[key], indent});
              } else {
                  if (val.startsWith("[") && val.endsWith("]")) {
                      try { curObj[key] = JSON.parse(val); } catch(e) { curObj[key] = val; }
                  } else if (!isNaN(Number(val)) && key !== "hash") {
                      curObj[key] = Number(val);
                  } else {
                      curObj[key] = val;
                  }
              }
          }
      }
      return result;
  };

  // Extract blocks for each node
  for (const [id, pointer] of Object.entries(nodePointers)) {
      // Find the start line dynamically
      let startLine = -1;
      for (let i = 0; i < lines.length; i++) {
          if (lines[i] === `### ${id}`) {
              startLine = i;
              break;
          }
      }
      
      if (startLine === -1) {
          throw new Error(`Node ${id} found in metadata but missing '### ${id}' header in markdown body`);
      }

      // Find end
      let endLine = startLine + 1;
      while (endLine < lines.length) {
          if (lines[endLine].startsWith("### ") || lines[endLine].startsWith("## ") || lines[endLine].startsWith("---")) {
              break;
          }
          endLine++;
      }
      
      const nodeLines = lines.slice(startLine, endLine);
      
      const node: Sigma3Node = {
          identity: { structural_hash: "", context_hash: pointer.field, version: 1, parents: [] },
          essence: { type: pointer.type as any, level: 1, substrate: pointer.substrate as any },
          physics: { energy_cost: pointer.energy, stability: pointer.stability },
          io: {},
          ir: { args: [], ret: "void", body: "" },
          implementation: {},
          mutation_log: []
      };

      let currentSection = "";
      let sectionLines: string[] = [];
      let codeLang = "";
      let insideCode = false;

      const finishSection = () => {
          if (currentSection === "Identity") {
             const parsed = parseYamlLike(sectionLines);
             node.identity.structural_hash = parsed.hash || "0";
             node.identity.version = parsed.version || 1;
             node.identity.parents = parsed.parents || [];
          } else if (currentSection === "IO") {
             const parsed = parseYamlLike(sectionLines);
             node.io.in = parsed.in || {};
             node.io.out = parsed.out || "void";
             // Extract args and ret for IRFunction
             if (parsed.in) {
                 for (const [k, v] of Object.entries(parsed.in)) {
                     const typePart = (v as string).split("@")[0];
                     node.ir.args.push({ name: k, type: typePart });
                 }
             }
             node.ir.ret = typeof node.io.out === "string" ? node.io.out.split("@")[0] : "void";
          } else if (currentSection === "IR") {
             const codeBody = sectionLines.join("\n").replace(/^```\w+\n/, "").replace(/\s*```$/, "").trim();
             try {
                 node.ir.body = JSON.parse(codeBody);
             } catch(e) {
                 node.ir.body = codeBody;
             }
          } else if (currentSection === "Implementation") {
             const codeBody = sectionLines.join("\n").replace(/^```\w+\n/, "").replace(/\s*```$/, "").trim();
             if (codeLang === "ts" || codeLang === "typescript") {
                 node.implementation!.ts = codeBody;
             }
          }
          sectionLines = [];
      };

      for (const line of nodeLines) {
          if (line.startsWith("#### ")) {
              if (currentSection) finishSection();
              currentSection = line.substring(5).trim();
          } else if (currentSection) {
              if (line.startsWith("\`\`\`")) {
                  if (!insideCode) {
                      insideCode = true;
                      codeLang = line.replace("\`\`\`", "").trim();
                  } else {
                      insideCode = false;
                  }
              } else if (insideCode) {
                 sectionLines.push(line);
              } else {
                 sectionLines.push(line);
              }
          }
      }
      if (currentSection) finishSection();

      state[id] = node;
  }
  
  return state;
}

// --- BINARY SEED (LUCA) ---

export function packTissueToBinary(tissue: State): Uint8Array {
  // Ultra-fast deterministic AST packing
  return packMsgPack(tissue);
}

export async function unpackTissueFromBinary(buffer: Uint8Array): Promise<State> {
  // Ultra-fast AST unpacking
  return unpackMsgPack(buffer) as State;
}
