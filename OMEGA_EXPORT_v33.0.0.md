# OMEGA-64 | ONTOLOGY 33 ABSOLUTE EXPORT

This document contains the entire architectural core of the Genesis Spore (Version 33.0.0), spanning the WebGPU hardware isolation loops, TS genetic transpiler, and Rust WASM SIMD execution threads.

---

## `I.md`
```md
---
# TISSUE METADATA (TOON FORMAT)
# The Universal Registry of the System Runtime

[7]{id,field,type,substrate,energy,stability,link}:
  fast_abs,init,pure_fn,ts,3,1,#fast_abs, 19
  calculate_structural_hash,core,meta_fn,ts,10,1,#calculate_structural_hash, 54
  mutate_ir,core,meta_fn,ts,10,1,#mutate_ir, 85
  flush_state_to_disk,core,meta_fn,ts,10,1,#flush_state_to_disk, 141
  tissue_history,core,module,ts,10,1,#tissue_history, 170
  atomic_pulse,core,meta_fn,ts,10,1,#atomic_pulse, 189
  rust_compiler_bridge,sys,meta_fn,ts,100,1,#rust_compiler_bridge, 270
---

# 🧬 THE TISSUE (ACTIVE CANON)

## init

### fast_abs
#### Identity
hash: 9ace0a837fe2779ef891c09d19e5b01aafcc8d2506d85c1cd90cf2ea0bbb1cbf
version: 30
parents: ["093b34effa228f2670bd34ff593896bbec3ce3f6a8d0bc9d5fd14f7879838d44"]

#### IO
in:
  v: i32@field:math
out: i32@field:math

#### IR
```json
{
  "kind": "op",
  "op": "mul",
  "args": [
    {
      "kind": "var",
      "name": "v",
      "type": "i32"
    },
    {
      "kind": "const",
      "value": 13,
      "bits": 32
    }
  ]
}
```

---

## core

### calculate_structural_hash
#### Identity
hash: 742f388ff2efc34f98f6e33638218f0895348aee123afb29dad74317a496c501
version: 1

#### IO
in:
  node: Sigma3Node
out: string

#### Physics
energy_cost: 0
stability: 1.0

#### IR
```json
sha256(JSON.stringify({essence, io, expr, parents}))
```

#### Implementation
```ts
const { encodeHex } = await import("jsr:@std/encoding/hex");
const payload = JSON.stringify({
  essence: node.essence,
  io: node.io,
  ir: node.ir,
  parents: node.identity.parents
});
const msgUint8 = new TextEncoder().encode(payload);
const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
return encodeHex(hashBuffer);
```

---

### mutate_ir
#### Identity
hash: 15d6bba9c12c53de3f1975258b967c76930ad6937f8f3fc0133fcd1e17047456
version: 1

#### IO
in:
  state: State
  targetAlias: string
  path: (string|number)[]
  newValue: any
  executeNeuron: Function
out: TransformResult<State>

#### IR
```json
state' = apply_ir_mutation(...)
```

#### Implementation
```ts
const next = structuredClone(state);
        const diff = { added: [], updated: [], removed: [] };

        const targetNode = next[targetAlias];
        if (!targetNode) {
          throw new Error(`Neuron ${targetAlias} not found in state.`);
        }

        const oldHash = targetNode.identity.structural_hash;
        
        // Mutate the IR tree by following the path
        let current = targetNode.ir;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        
        const targetKey = path[path.length - 1];
        if (current[targetKey] === newValue) {
            // O-34 Phase 3: Mathematical Bypass (Zero Distance)
            return { next, diff };
        }
        current[targetKey] = newValue;
        
        // Execute the hash neuron to calculate the new hash
        const newHash = await executeNeuron(next, "calculate_structural_hash", { node: targetNode });
        
        targetNode.identity = {
          ...targetNode.identity,
          structural_hash: newHash,
          parents: [oldHash],
          version: targetNode.identity.version + 1
        };
        
        targetNode.mutation_log.push(`Mutated IR at [${path.join(".")}] to: ${JSON.stringify(newValue)} -> [${newHash}]`);
        diff.updated.push(targetAlias);

        return { next, diff };
```

---

### serialize_tissue
#### Identity
hash: 58a9e4b7c84ccf0e21334f59c23b2b4198c6aa2471eb67c9cfaa70dc0d4a9dc3
version: 1

#### IO
in:
  tissue: State
out: string

#### Physics
energy_cost: 0
stability: 1.0

#### IR
```json
{
  "args": [{"name": "tissue", "type": "State"}],
  "ret": "string",
  "body": "Serialize Tissue to OMEGA TOON Markdown"
}
```

#### Implementation
```ts
  const { encode } = await import("npm:@toon-format/toon");
  const nodesArr = [];
  const entries = Object.entries(tissue);
  let markdownBody = "";

  const categories = {};
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
        nodeBlock += `\n#### IO\n`;
        const serializeIO = (ioObj, indent = "") => {
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
        nodeBlock += serializeIO(node.io) + `\n`;

        if (node.ir && node.ir.body !== undefined) {
           nodeBlock += `#### IR\n`;
           if (typeof node.ir.body === "string" || Array.isArray(node.ir.body)) {
              let bodyStr = typeof node.ir.body === "string" ? node.ir.body : JSON.stringify(node.ir.body);
              if (bodyStr.startsWith('"') && bodyStr.endsWith('"')) {
                 bodyStr = JSON.parse(bodyStr); 
              }
              nodeBlock += `\`\`\`json\n${bodyStr}\n\`\`\`\n\n`;
           } else {
              nodeBlock += `\`\`\`json\n${JSON.stringify(node.ir.body, null, 2)}\n\`\`\`\n\n`;
           }
        }
        
        if (node.implementation && Object.keys(node.implementation).length > 0) {
           nodeBlock += `#### Implementation\n`;
           for (const [lang, code] of Object.entries(node.implementation)) {
               nodeBlock += `\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
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

  let headerTOON = "---\n# TISSUE METADATA (TOON FORMAT)\n# The Universal Registry of the System Runtime\n\n";
  headerTOON += encode(nodesArr).replace(/\]:/, "]{id,field,type,substrate,energy,stability,link,line}:"); 
  headerTOON += `\n---\n\n# 🧬 THE TISSUE (ACTIVE CANON)\n\n`;
  
  const lines = (headerTOON + markdownBody).split("\n");
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
  return lines.join("\n") + "\n";
```

---

### flush_state_to_disk
#### Identity
hash: 84ee457159f7720697909e90588f1c3b2034f044fa3c11f4ba32dc5d43b092b3
version: 1

#### IO
in:
  nextState: State
  targetFile: string
out: void

#### Physics
energy_cost: 0
stability: 1.0

#### IR
```json
write(nextState) to Disk
```

#### Implementation
```ts
const { packTissueToBinary, executeNeuron } = await import("./quine.ts");
if (targetFile.endsWith(".bin")) {
  await Deno.writeFile(targetFile, packTissueToBinary(nextState));
} else {
  const markdownStr = await executeNeuron(nextState, "serialize_tissue", { tissue: nextState });
  await Deno.writeTextFile(targetFile, markdownStr);
}
```

---

### tissue_history
#### Identity
hash: db830eee608aa2e031018358293287cd95dbccff15384757cda1fdfc3ab87779
version: 16
parents: ["db830eee608aa2e031018358293287cd95dbccff15384757cda1fdfc3ab87779"]

#### IO
in:
out:

#### IR
```json
{
  "log_file": "./history.jsonl"
}
```

---

### atomic_pulse
#### Identity
hash: b0254164c70db96d5ef01003d66b21e633ea19c42d3c3811886d822d0a631105
version: 1

#### IO
in:
  state: State
  operations: Array<{alias: string, args: Record<string, any>}>
  executeNeuron: Function
out: { success: boolean, next: State, log: any[], error?: string }

#### IR
```json
try { next = applyAll(ops) } catch { rollback }
```

#### Implementation
```ts
let tempState = structuredClone(state);
        const epochLog = [];
        
        try {
          for (const op of operations) {
            const target = tempState[op.alias];
            if (target && target.physics && target.physics.energy_cost !== undefined) {
               let cost = 50;
               try {
                  const constantsIr = tempState["tissue_constants"].ir;
                  const constantsBody = typeof constantsIr.body === "string" ? JSON.parse(constantsIr.body) : constantsIr.body;
                  if (constantsBody.MUTATION_COST !== undefined) cost = constantsBody.MUTATION_COST;
               } catch(e) {}

               if (target.physics.energy_cost < cost) throw new Error(`NOMOS Metabolic Rejection: ${op.alias} lacks sufficient energy (${target.physics.energy_cost} < ${cost}).`);
               target.physics.energy_cost -= cost;
            }
            const currentArgs = { ...op.args, state: tempState, executeNeuron };
            const result = await executeNeuron(tempState, op.alias, currentArgs);
            tempState = result.next;
            epochLog.push({ alias: op.alias, diff: result.diff });
          }
          
          let mutated = false;
          for (const key in tempState) {
            const node = tempState[key];
            if (typeof node.ir !== "object" || !node.ir.body) throw new Error(`Node ${key} missing IR logic branch`);
            if (!Array.isArray(node.identity.parents)) throw new Error(`Node ${key} lineage is not a DAG`);
            const calculatedHash = await executeNeuron(tempState, "calculate_structural_hash", { node });
            if (node.identity.structural_hash !== calculatedHash) {
                node.identity.structural_hash = calculatedHash;
                mutated = true;
            }
          }
        } catch (e) {
          return { success: false, next: state, log: [], error: e.message };
        }
        
        // Record epoch in tissue_history
        if (mutated && tempState["tissue_history"]) {
           const historyNode = tempState["tissue_history"];
           const oldHash = historyNode.identity.structural_hash;
           
           historyNode.identity = {
             ...historyNode.identity,
             parents: [oldHash],
             version: historyNode.identity.version + 1
           };
           
           const epochHash = await executeNeuron(tempState, "calculate_structural_hash", { node: historyNode });
           historyNode.identity.structural_hash = epochHash;
           
           const epochRecord = {
             t: Date.now(),
             prev: oldHash,
             epoch: epochHash
           };
           
           // Offload the ZK blockchain payload to an external append-only log file
           let logFile = "./history.jsonl";
           try {
             const pointer = typeof historyNode.ir.body === "string" ? JSON.parse(historyNode.ir.body) : historyNode.ir.body;
             if (pointer && pointer.log_file) logFile = pointer.log_file;
           } catch(e) {}
           
           await Deno.writeTextFile(logFile, JSON.stringify(epochRecord) + "\\n", { append: true });
           
           historyNode.mutation_log.push(`Appended ZK-Ledger Epoch [${oldHash.substring(0,8)} -> ${epochHash.substring(0,8)}] to ${logFile}`);
        }
        
        return { success: true, next: tempState, log: epochLog };
```

---

## sys

### rust_compiler_bridge
#### Identity
hash: f5fd3abca1803b5b51f2d42f85bcfb719440f99733ecaf5d34e36a35d440f246
version: 1

#### IO
in:
  nodeAlias: string
  state: State
out: void

#### IR
```json
{
  "kind": "const",
  "value": 0,
  "bits": 32
}
```

#### Implementation
```ts
const targetNode = state[nodeAlias];
        if (!targetNode) throw new Error(`Neuron ${nodeAlias} not found`);
        const irStr = await Dispatcher.foldForRust(targetNode);
        const irFunction = JSON.parse(irStr);
        
        console.log(`[RUST BRIDGE] 📤 Transpiling AST for ${nodeAlias} to Rust...`);
        const { compileIRFunctionToRust } = await import("./compiler/ast_to_rust.ts");
        const rustCode = compileIRFunctionToRust(nodeAlias, irFunction);
        
        const moduleHeader = "// AUTO-GENERATED BY OMEGA-64 AST COMPILER BRIDGE\n// DO NOT EDIT MANUALLY - WILL BE OVERWRITTEN BY EVOLUTION\n\nuse wasm_bindgen::prelude::*;\n";
        const genFilePath = "./omega_core/src/generated_biology.rs";
        
        await Deno.writeTextFile(genFilePath, moduleHeader + rustCode);
        console.log(`[RUST BRIDGE] 🧬 Injected ${nodeAlias} into generated_biology.rs`);
        
        console.log(`[RUST BRIDGE] 🔨 Recompiling WASM Simulator Core...`);
        const cmd = new Deno.Command("wasm-pack", {
            args: ["build", "--target", "web", "--out-dir", "pkg"],
            cwd: "./omega_core",
            stdout: "inherit",
            stderr: "inherit"
        });
        const { code } = await cmd.output();
        
        if (code !== 0) {
            throw new Error(`[RUST BRIDGE] ❌ Compiler crashed with code ${code}. Mutation rejected.`);
        }
        console.log(`[RUST BRIDGE] ✨ Compilation successful. Reality hot-reloaded.`);
        
        return { next: state, diff: { added: [], updated: [], removed: [] } };
```

---



```

## `README.md`
```md
# Genesis OMEGA-64 🧬

A decentralized, biological, Subconscious Turing Complete web simulation executing completely natively on `WebGPU` and `Rust WASM`. 

## 📚 Architectures & Specifications

All core documentation, historical epochs, and technical whitepapers have been isolated into the `/docs` library.

### Core Architecture
- [Phase Coherence Specification](./docs/PHASE_COHERENCE_SPEC.md)
- [Omega-64 Unified Spec](./docs/OMEGA_64_UNIFIED_SPECIFICATION.md)

### Ontological Evolution (Epochs)
- **Ontology 8**: [The Mycelial Lattice](./docs/ontology_8_specification.md)
- **Ontology 9**: [Topological Phase Locks](./docs/ontology_9_specification.md)
- **Ontology 10**: [SIMD Hardware Optimization](./docs/ontology_10_specification.md)
- **Ontology 11**: [Hebbian Resonance](./docs/ontology_11_specification.md)
- **Ontology 12**: [Sovereign LLM Oracle](./docs/ontology_12_specification.md)
- **Ontology 23**: [Pure Metal WebGPU Transition](./docs/O23_ARCHITECTURE.md)
- **Ontology 25**: [NOMOS Energy Rules](./docs/O25_ARCHITECTURE.md)

---

*The Living Quine state engine resides natively in [I.md](./I.md).*

```

## `package.json`
```json
{
  "name": "omega-genesis",
  "version": "33.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "export": "deno run -A tools/export_omega.ts",
    "analyze:phase-cross": "deno run -A tools/analyze_phase_cross.ts",
    "build:wasm": "cd omega_core && wasm-pack build --target web --out-dir pkg",
    "build": "npm run build:wasm && vite build",
    "serve": "vite preview",
    "generate:phase-goldens": "deno run -A tools/generate_phase_goldens.ts",
    "verify:phase-coherence:ref": "deno run -A tools/verify_phase_coherence.ts",
    "verify:phase-coherence:kernel": "cargo test --manifest-path omega_core/Cargo.toml phase_lattice",
    "verify:phase-coherence:wasm": "deno run -A tools/verify_phase_coherence_wasm.ts",
    "verify:phase-coherence": "deno task verify:phase-coherence:ref && deno task verify:phase-coherence:kernel && deno task verify:phase-coherence:wasm",
    "verify:phase-cross": "deno run -A tools/verify_phase_cross.ts",
    "verify:phase-parity": "deno run -A tools/verify_phase_parity.ts",
    "verify:phase-bridge:kernel": "cargo test --manifest-path omega_core/Cargo.toml phase_bridge",
    "verify:phase-bridge:parity": "deno run -A tools/verify_phase_bridge_parity.ts",
    "verify:phase-bridge:wasm": "deno run -A tools/verify_phase_bridge_wasm.ts",
    "verify:phase-bridge": "deno task verify:phase-bridge:kernel && deno task verify:phase-bridge:parity && deno task verify:phase-bridge:wasm",
    "verify:phase-goldens": "deno run -A tools/verify_phase_goldens.ts",
    "verify:phase-stack": "deno task verify:phase-coherence && deno task verify:phase-parity && deno task verify:phase-bridge && deno task verify:phase-cross && deno task verify:phase-goldens"
  },
  "devDependencies": {
    "@webgpu/types": "^0.1.38",
    "puppeteer": "^24.40.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "@msgpack/msgpack": "^3.1.3",
    "playwright": "^1.58.2"
  }
}

```

## `tools/export_omega.ts`
```ts
// deno-lint-ignore-file
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const TARGET_EXTS = [".ts", ".rs", ".wgsl", ".toml", ".html", ".json"];
const EXCLUDE_DIRS = [/node_modules/, /target/, /pkg/, /\.git/, /\.gemini/, /dist/, /tools/, /test_/, /verify_/, /puppeteer/];

async function main() {
  const pkgStr = await Deno.readTextFile("package.json");
  const pkg = JSON.parse(pkgStr);
  const OMEGA_VERSION = pkg.version;
  const OUTPUT_FILE = `OMEGA_EXPORT_v${OMEGA_VERSION}.md`;

  const chunks: string[] = [];
  chunks.push(`# OMEGA-64 | ONTOLOGY ${OMEGA_VERSION.split('.')[0]} ABSOLUTE EXPORT\n`);
  chunks.push(`This document contains the entire architectural core of the Genesis Spore (Version ${OMEGA_VERSION}), spanning the WebGPU hardware isolation loops, TS genetic transpiler, and Rust WASM SIMD execution threads.\n\n---\n`);

  const addFile = async (path: string) => {
    try {
      const content = await Deno.readTextFile(path);
      const ext = path.split('.').pop() || "text";
      chunks.push(`## \`${path}\``);
      chunks.push(`\`\`\`${ext}\n${content}\n\`\`\`\n`);
      console.log(`✅ Included: ${path}`);
    } catch(e) {
      console.error(`❌ Failed: ${path}`);
    }
  };

  // Root essentials
  await addFile("I.md");
  await addFile("README.md");
  await addFile("package.json");
  await addFile("tools/export_omega.ts");
  await addFile("index.html");
  await addFile("vite.config.ts");
  await addFile("omega_core/Cargo.toml");
  
  // Walk TS Source
  console.log("\nSweeping src/ ...");
  for await (const entry of walk("src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })) {
    if (entry.isFile) await addFile(entry.path);
  }
  
  // Walk Rust Core
  console.log("\nSweeping omega_core/src/ ...");
  for await (const entry of walk("omega_core/src", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Walk Docs
  console.log("\nSweeping docs/ ...");
  for await (const entry of walk("docs", { exts: [".md"], skip: EXCLUDE_DIRS })) {
    if (entry.isFile) await addFile(entry.path);
  }

  // Tools/ verification binaries excluded from LLM context payload to save tokens.

  await Deno.writeTextFile(OUTPUT_FILE, chunks.join("\n"));
  console.log(`\n🎉 Successfully exported all core OMEGA-64 files to ${OUTPUT_FILE}`);
}

main();

```

## `index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OMEGA-64 | Ontology 10</title>
    <style>
        :root {
            --glass-bg: rgba(10, 10, 15, 0.4);
            --glass-border: rgba(255, 255, 255, 0.1);
            --accent: #00ffcc;
            --accent-glow: rgba(0, 255, 204, 0.6);
        }

        body, html {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            background-color: #000;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            overflow: hidden;
            color: #fff;
        }

        #lens-canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 1;
        }

        .hud-overlay {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
            width: 600px;
            
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            padding: 20px 30px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.05);
            
            display: flex;
            flex-direction: column;
            gap: 15px;
            animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
            0% { transform: translate(-50%, 0px); }
            50% { transform: translate(-50%, -10px); }
            100% { transform: translate(-50%, 0px); }
        }

        .hud-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .hud-title {
            font-size: 0.9rem;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 600;
            text-shadow: 0 0 10px rgba(255,255,255,0.2);
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;
            color: var(--accent);
            text-shadow: 0 0 8px var(--accent-glow);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background-color: var(--accent);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--accent-glow);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 204, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 255, 204, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 204, 0); }
        }

        .semantic-input-group {
            display: flex;
            gap: 10px;
        }

        .replay-controls {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .replay-controls[hidden] {
            display: none;
        }

        .replay-button,
        .replay-select,
        .replay-range {
            appearance: none;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: rgba(0, 0, 0, 0.34);
            color: #fff;
        }

        .replay-button {
            padding: 10px 16px;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.72rem;
        }

        .replay-select {
            padding: 10px 14px;
            font-size: 0.85rem;
        }

        .replay-range {
            flex: 1;
            min-width: 120px;
            padding: 10px 0;
        }

        .replay-label {
            font-size: 0.72rem;
            color: rgba(255, 255, 255, 0.58);
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .replay-value {
            min-width: 48px;
            text-align: right;
            font-family: monospace;
            color: #fff;
        }

        #semantic-input {
            flex: 1;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
        }

        #semantic-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.3);
            background: rgba(0, 0, 0, 0.5);
        }

        #semantic-submit {
            background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.0));
            border: 1px solid var(--accent);
            color: var(--accent);
            font-weight: 600;
            padding: 0 25px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-size: 0.85rem;
        }

        #semantic-submit:hover {
            background: var(--accent);
            color: #000;
            box-shadow: 0 0 20px var(--accent-glow);
        }

        .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.4);
            margin-top: 5px;
        }

        .stat-value {
            color: #fff;
            font-family: monospace;
            font-size: 0.9rem;
        }

        /* Ambient background glow mapped behind canvas */
        .ambient-bg {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 80vw;
            height: 80vh;
            transform: translate(-50%, -50%);
            background: radial-gradient(circle, rgba(20,60,50,0.6) 0%, rgba(0,0,0,0) 70%);
            z-index: 0;
            filter: blur(50px);
        }

        @media (max-width: 720px) {
            .hud-overlay {
                width: calc(100vw - 32px);
                bottom: 16px;
                padding: 18px;
                border-radius: 16px;
            }

            .semantic-input-group,
            .replay-controls,
            .stats {
                flex-direction: column;
                align-items: stretch;
            }

            .replay-value {
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="ambient-bg"></div>
    <canvas id="lens-canvas"></canvas>

    <div class="hud-overlay">
        <div class="hud-header">
            <div id="hud-title" class="hud-title">Σ³ Semantic Coupler</div>
            <div class="status-indicator">
                <div class="status-dot"></div>
                <span id="status-label">OMEGA-64 ACTIVE</span>
            </div>
        </div>
        
        <div id="semantic-input-group" class="semantic-input-group">
            <input type="text" id="semantic-input" placeholder="Inject ontological intent..." autocomplete="off">
            <button id="semantic-submit">Project</button>
        </div>

        <div id="replay-controls" class="replay-controls" hidden>
            <button id="replay-play" class="replay-button" type="button">Play</button>
            <label class="replay-label" for="replay-compare">Compare</label>
            <select id="replay-compare" class="replay-select">
                <option value="seed">Seed</option>
                <option value="previous">Previous</option>
                <option value="none">None</option>
            </select>
            <input id="replay-tick" class="replay-range" type="range" min="0" max="12" step="1" value="0">
            <span id="replay-tick-value" class="replay-value">0/12</span>
        </div>

        <div class="stats">
            <div><span id="stat-a-label">MUTATION CANDIDATES</span> <span id="stat-a-value" class="stat-value">1024</span></div>
            <div><span id="stat-b-label">FPS</span> <span id="stat-b-value" class="stat-value">0</span></div>
            <div><span id="stat-c-label">OBSERVER</span> <span id="stat-c-value" class="stat-value">WebGPU Lens</span></div>
        </div>
        
        <div style="display: flex; justify-content: flex-end;">
            <img id="oracle-debug-vision" style="width: 128px; height: 128px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); display: none; margin-top: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />
        </div>
    </div>

    <script type="module" src="/src/main.ts"></script>
</body>
</html>

```

## `vite.config.ts`
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  }
});

```

## `omega_core/Cargo.toml`
```toml
[package]
name = "omega_core"
version = "10.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"

[profile.release]
lto = true
opt-level = 3

```

## `src/quine.ts`
```ts
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

```

## `src/main.ts`
```ts
import initWasm, {
  execute_phase_bridge_tick,
  execute_simd_tick,
  Field,
  field_omega_span,
  field_signature,
  field_total_energy,
  field_total_locks,
  field_total_plasmids,
  phase_lattice_omega_span,
  phase_lattice_signature,
  phase_lattice_total_amplitude,
  phase_lattice_total_entanglement,
  PhaseLatticeField,
} from "../omega_core/pkg/omega_core.js";
import { LensObserver } from "./lens/init.ts";
import { PerturbationInjector } from "./lens/input.ts";
import { PhasePerturbationInjector } from "./lens/phase_input.ts";
import { PhaseReplayObserver } from "./lens/phase_replay_view.ts";
import { PhaseWebGPUObserver } from "./lens/phase_webgpu.ts";
import { PhaseComputeEngine } from "./lens/phase_compute.ts";
import { SemanticCoupler } from "./ontology/semantic_layer.ts";
import { SovereignOracle } from "./ontology/oracle.ts";
import {
  buildDiffSummary,
  getReplayComparison,
  getReplaySnapshot,
  loadPhaseReplayDataset,
  summarizeReplayDiff,
} from "./replay/phase_replay.ts";
import {
  collapsePhaseField,
  cropPhaseField,
  hybridSnapshotSignature,
  loadHybridReplayDataset,
} from "./replay/hybrid_replay.ts";
import type { ReplayCompareMode } from "./replay/phase_replay.ts";
import type { PhaseField } from "./shared/phase_lattice.ts";

let lastTime = performance.now();
let frames = 0;
const hudTitle = document.getElementById("hud-title") as HTMLDivElement | null;
const statusLabel = document.getElementById("status-label") as
  | HTMLSpanElement
  | null;
const statALabel = document.getElementById("stat-a-label") as
  | HTMLSpanElement
  | null;
const statAValue = document.getElementById("stat-a-value") as
  | HTMLSpanElement
  | null;
const statBLabel = document.getElementById("stat-b-label") as
  | HTMLSpanElement
  | null;
const statBValue = document.getElementById("stat-b-value") as
  | HTMLSpanElement
  | null;
const statCLabel = document.getElementById("stat-c-label") as
  | HTMLSpanElement
  | null;
const statCValue = document.getElementById("stat-c-value") as
  | HTMLSpanElement
  | null;
const semanticInputGroup = document.getElementById("semantic-input-group") as
  | HTMLDivElement
  | null;
const replayControls = document.getElementById("replay-controls") as
  | HTMLDivElement
  | null;
const replayPlayButton = document.getElementById("replay-play") as
  | HTMLButtonElement
  | null;
const replayTickSlider = document.getElementById("replay-tick") as
  | HTMLInputElement
  | null;
const replayTickValue = document.getElementById("replay-tick-value") as
  | HTMLSpanElement
  | null;
const replayCompareSelect = document.getElementById("replay-compare") as
  | HTMLSelectElement
  | null;
const mode = new URLSearchParams(globalThis.location.search).get("mode") ||
  "classic";
const replayStack =
  new URLSearchParams(globalThis.location.search).get("stack") || "phase";

function configureCanvas() {
  const canvas = document.getElementById("lens-canvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  return canvas;
}

function wireSemanticInput(coupler: SemanticCoupler, placeholder: string) {
  const input = document.getElementById("semantic-input") as HTMLInputElement;
  const button = document.getElementById(
    "semantic-submit",
  ) as HTMLButtonElement;
  input.placeholder = placeholder;

  const dispatchIntent = () => {
    const val = input.value.trim();
    if (val) {
      coupler.projectIntent(val);
      input.value = "";
    }
  };

  button.addEventListener("click", dispatchIntent);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") dispatchIntent();
  });
}

function tickFps() {
  frames++;
  const now = performance.now();
  if (now - lastTime > 1000) {
    statBValue?.replaceChildren(frames.toString());
    frames = 0;
    lastTime = now;
  }
}

function setHudStat(
  slot: "a" | "b" | "c",
  label: string,
  value: string,
) {
  if (slot === "a") {
    statALabel?.replaceChildren(label);
    statAValue?.replaceChildren(value);
    return;
  }
  if (slot === "b") {
    statBLabel?.replaceChildren(label);
    statBValue?.replaceChildren(value);
    return;
  }
  statCLabel?.replaceChildren(label);
  statCValue?.replaceChildren(value);
}

function setInputMode(target: "semantic" | "replay") {
  semanticInputGroup?.toggleAttribute("hidden", target !== "semantic");
  replayControls?.toggleAttribute("hidden", target !== "replay");
}

async function bootstrapPhase(wasmMemory: WebAssembly.Memory) {
  console.log("[Genesis] Bootstrapping experimental phase lattice mode...");
  hudTitle?.replaceChildren("Φ Phase Lattice");
  statusLabel?.replaceChildren("PHASE MODE ACTIVE");
  setHudStat("a", "SECTORS", "64x10x3");
  setHudStat("b", "FPS", "0");
  setHudStat("c", "SIGNATURE", "warming");
  setInputMode("semantic");

  const canvas = configureCanvas();
  let phaseField = new PhaseLatticeField(64, 10, 3);
  // Ontology 23: Native Metal compute instantiation
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();

  let computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
  await computeEngine.init();

  let observer = new PhaseWebGPUObserver(
    canvas,
    phaseField,
    computeEngine,
    device,
  );
  await observer.init();

  // O-22: Bind the Sovereign Oracle purely to the Phase Lattice
  const oracle = new SovereignOracle(
    phaseField,
    wasmMemory,
    computeEngine,
    observer,
  );
  oracle.boot();

  const injector = new PhasePerturbationInjector(
    canvas,
    phaseField,
    wasmMemory,
    computeEngine,
    oracle,
  );
  injector.attach();

  const coupler = new SemanticCoupler(injector);
  wireSemanticInput(coupler, "Inject phase attractor...");

  let lastShedCheck = performance.now();

  const loop = async () => {
    // O-32: Morphological Hot-Reloading Polling (Shedding Event)
    const nowLocal = performance.now();
    if (nowLocal - lastShedCheck > 1000) {
        lastShedCheck = nowLocal;
        try {
            const res = await fetch("/I.md", { cache: "no-store" });
            if (res.ok) {
                const text = await res.text();
                const nodeIdx = text.indexOf("### tissue_constants");
                if (nodeIdx !== -1) {
                    const irIdx = text.indexOf("#### IR", nodeIdx);
                    if (irIdx !== -1) {
                        const codeStart = text.indexOf("```json\n", irIdx) + 8;
                        const codeEnd = text.indexOf("\n```", codeStart);
                        if (codeStart > 8 && codeEnd > codeStart) {
                            const body = JSON.parse(text.substring(codeStart, codeEnd));
                            let tSectors = phaseField.sectors;
                            let tRadial = phaseField.radial_bins;
                            let tHarm = phaseField.harmonics;
                
                if (body.SECTORS !== undefined) tSectors = body.SECTORS;
                if (body.RADIAL_BINS !== undefined) tRadial = body.RADIAL_BINS;
                if (body.HARMONICS !== undefined) tHarm = body.HARMONICS;

                if (tSectors !== phaseField.sectors || tRadial !== phaseField.radial_bins || tHarm !== phaseField.harmonics) {
                    console.log(`\n🦋 UNIVERSAL SHEDDING EVENT DETECTED -> Biomass mutated geometry to ${tSectors}x${tRadial}x${tHarm}`);
                    console.log(`🧨 Terminating active WASM Tensors & VRAM Pipelines...`);
                    
                    phaseField.free();
                    phaseField = new PhaseLatticeField(tSectors, tRadial, tHarm);
                    
                    computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
                    await computeEngine.init();

                    observer = new PhaseWebGPUObserver(canvas, phaseField, computeEngine, device);
                    await observer.init();

                    // Rebind global daemon observers identically
                    oracle.rebind(phaseField, computeEngine, observer);
                    injector.rebind(phaseField, computeEngine);
                    
                    setHudStat("a", "SECTORS", `${tSectors}x${tRadial}x${tHarm}`);
                    console.log(`✨ Shedding Event Complete. System dimensions hot-reloaded seamlessly.\n`);
                }
                        }
                    }
                }
            }
        } catch(_e) {}
    }

    computeEngine.tick();
    oracle.sync();

    observer.render(computeEngine.getActiveBuffer());
    tickFps();

    if (frames === 0) {
      setHudStat(
        "a",
        "AMPLITUDE",
        phase_lattice_total_amplitude(phaseField).toString(),
      );
      setHudStat(
        "c",
        "SIGNATURE",
        phase_lattice_signature(phaseField).slice(0, 12),
      );
      statusLabel?.replaceChildren(
        `ENT ${phase_lattice_total_entanglement(phaseField)} | Ω ${
          phase_lattice_omega_span(phaseField)
        } | Q ${oracle.getQueueSize()}`,
      );
    }

    requestAnimationFrame(loop);
  };

  loop();

  // O-24 Topos Debugger
  // deno-lint-ignore no-explicit-any
  (globalThis as any).injectMycelialTest = () => {
    const hash = 999999888888777n;
    // Target diametric poles dynamically to avoid OOB
    const cellA_top = Math.floor(phaseField.cell_count() * 0.1);
    const cellB_bottom = Math.floor(phaseField.cell_count() * 0.9);

    console.log(
      `[MYCELIUM] Firing identical resonance flag into isolated nodes ${cellA_top} and ${cellB_bottom}`,
    );

    computeEngine.injectPlasmid(cellA_top, hash);
    computeEngine.injectEnergy(cellA_top, 200);

    // Use a short timeout so the TS Engine loop can flush the single-tick Uniform Buffer sequentially
    setTimeout(() => {
      computeEngine.injectPlasmid(cellB_bottom, hash);
      computeEngine.injectEnergy(cellB_bottom, 200);
    }, 100);
  };

  console.log(
    "[Genesis] Phase lattice running. Use ?mode=phase to revisit this substrate.",
  );
}

async function bootstrapReplay() {
  console.log(
    `[Genesis] Bootstrapping replay diff mode for stack=${replayStack}...`,
  );
  hudTitle?.replaceChildren(
    replayStack === "cross"
      ? "Φ Cross Diff"
      : replayStack === "hybrid"
      ? "Φ Hybrid Replay"
      : "Φ Replay Diff",
  );
  statusLabel?.replaceChildren("LOADING CANONICAL TRACE");
  setHudStat("a", "TICK", "0/0");
  setHudStat("b", "FPS", "0");
  setHudStat(
    "c",
    replayStack === "phase"
      ? "PARITY"
      : replayStack === "hybrid"
      ? "TRACE"
      : "MODE",
    "loading",
  );
  setInputMode("replay");

  const canvas = configureCanvas();
  const observer = new PhaseReplayObserver(canvas);
  observer.init();

  const phaseDataset = await loadPhaseReplayDataset();
  const wasm = replayStack === "phase" ? null : await initWasm();
  // deno-lint-ignore no-explicit-any
  const hybridDataset = wasm
    ? await loadHybridReplayDataset(wasm as any)
    : null;
  let currentTick = 0;
  let compareMode: ReplayCompareMode = "seed";
  let playing = false;
  let lastAdvance = performance.now();
  const commonTicks = hybridDataset
    ? Math.min(phaseDataset.golden.ticks, hybridDataset.golden.ticks)
    : phaseDataset.golden.ticks;
  const totalTicks = replayStack === "hybrid" && hybridDataset
    ? hybridDataset.golden.ticks
    : replayStack === "cross"
    ? commonTicks
    : phaseDataset.golden.ticks;

  if (replayTickSlider) {
    replayTickSlider.min = "0";
    replayTickSlider.max = totalTicks.toString();
    replayTickSlider.step = "1";
    replayTickSlider.value = "0";
  }
  replayTickValue?.replaceChildren(`0/${totalTicks}`);
  if (replayCompareSelect) {
    replayCompareSelect.value = compareMode;
    replayCompareSelect.disabled = replayStack === "cross";
  }

  const render = () => {
    const boundedTick = Math.max(0, Math.min(totalTicks, currentTick));
    let current: PhaseField;
    let compare: PhaseField | null;
    let title: string;
    let statusLine: string;
    let leftLabel: string;
    let rightLabel: string;
    let summary;

    if (replayStack === "hybrid" && hybridDataset) {
      current = hybridDataset.snapshots[boundedTick];
      compare = getSnapshotComparison(
        hybridDataset.snapshots,
        boundedTick,
        compareMode,
      );
      const hybridTrace = hybridDataset.golden.wasmTrace[boundedTick];
      summary = buildDiffSummary(
        current,
        compare,
        hybridSnapshotSignature(current),
        hybridTrace.signature,
        false,
      );
      title = "hybrid replay";
      statusLine = `compare ${compareMode} | trace ${
        hybridTrace.signature.slice(0, 8)
      } | Ω ${hybridTrace.omegaSpan}`;
      leftLabel = "view";
      rightLabel = "golden";
      setHudStat("c", "TRACE", hybridTrace.signature.slice(0, 12));
      statusLabel?.replaceChildren(
        `HYBRID Δ${summary.changedCells} | RAW ${
          hybridTrace.signature.slice(0, 8)
        } | Ω ${hybridTrace.omegaSpan}`,
      );
    } else if (replayStack === "cross" && hybridDataset) {
      current = collapsePhaseField(
        getReplaySnapshot(phaseDataset, boundedTick),
        6,
      );
      compare = cropPhaseField(
        hybridDataset.snapshots[boundedTick],
        current.shape.radialBins,
      );
      summary = buildDiffSummary(
        current,
        compare,
        hybridSnapshotSignature(current),
        hybridSnapshotSignature(compare),
        false,
      );
      title = "phase vs hybrid";
      statusLine =
        "cross diff | phase collapsed to 1 harmonic | hybrid cropped to 6 rings";
      leftLabel = "phase";
      rightLabel = "hybrid";
      setHudStat("c", "MODE", "PH↔HY");
      statusLabel?.replaceChildren(
        `CROSS Δ${summary.changedCells} | PH ${
          summary.referenceStructuralSignature.slice(0, 8)
        } | HY ${summary.wasmStructuralSignature.slice(0, 8)}`,
      );
    } else {
      current = getReplaySnapshot(phaseDataset, boundedTick);
      compare = getReplayComparison(phaseDataset, boundedTick, compareMode);
      summary = summarizeReplayDiff(phaseDataset, boundedTick, compareMode);
      const referenceTrace = phaseDataset.golden.referenceTrace[boundedTick];
      const wasmTrace = phaseDataset.golden.wasmTrace[boundedTick];
      title = "phase replay";
      statusLine = `compare ${compareMode} | parity ${
        summary.parityLocked ? "locked" : "drift"
      }`;
      leftLabel = "ref";
      rightLabel = "wasm";
      setHudStat("c", "PARITY", summary.parityLocked ? "LOCKED" : "DRIFT");
      statusLabel?.replaceChildren(
        `${compareMode.toUpperCase()} Δ${summary.changedCells} | REF ${
          referenceTrace.structuralSignature.slice(0, 8)
        } | WASM ${wasmTrace.structuralSignature.slice(0, 8)}`,
      );
    }

    observer.render(current, compare, {
      tick: boundedTick,
      totalTicks,
      compareMode: replayStack === "cross" ? "none" : compareMode,
      summary,
      title,
      statusLine,
      leftLabel,
      rightLabel,
    });

    setHudStat("a", "TICK", `${boundedTick}/${totalTicks}`);
    replayTickValue?.replaceChildren(`${boundedTick}/${totalTicks}`);
  };

  replayPlayButton?.addEventListener("click", () => {
    playing = !playing;
    replayPlayButton.replaceChildren(playing ? "Pause" : "Play");
    lastAdvance = performance.now();
  });

  replayTickSlider?.addEventListener("input", () => {
    currentTick = Number(replayTickSlider.value);
    playing = false;
    replayPlayButton?.replaceChildren("Play");
    render();
  });

  replayCompareSelect?.addEventListener("change", () => {
    compareMode = (replayCompareSelect.value as ReplayCompareMode) || "seed";
    render();
  });

  const loop = (now: number) => {
    tickFps();
    if (playing && now - lastAdvance >= 680) {
      currentTick = currentTick >= totalTicks ? 0 : currentTick + 1;
      if (replayTickSlider) {
        replayTickSlider.value = currentTick.toString();
      }
      lastAdvance = now;
    }
    render();
    requestAnimationFrame(loop);
  };

  render();
  requestAnimationFrame(loop);
  console.log(
    `[Genesis] Replay diff viewer active. Use ?mode=replay&stack=${replayStack} to inspect this trace.`,
  );
}

async function bootstrap() {
  console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

  if (mode === "replay") {
    await bootstrapReplay();
    return;
  }

  // 0. Boot WebAssembly 128-bit SIMD Core
  const wasm = await initWasm();
  const wasmMemory = wasm.memory as WebAssembly.Memory;
  if (mode === "phase") {
    await bootstrapPhase(wasmMemory);
    return;
  }
  setInputMode("semantic");

  const wasmField = new Field(256, 256);
  console.log(
    `[O-64] Rust WASM SIMD Core initialized. Field base pointer allocated at memory offset: ${wasmField.ptr_x()}`,
  );

  // The WASM linear array natively acts as our global sync target.

  // 2. Map Visual Lens
  const isHybrid = mode === "hybrid";
  hudTitle?.replaceChildren(
    isHybrid ? "Σ³ Phase Bridge" : "Σ³ Semantic Coupler",
  );
  statusLabel?.replaceChildren(
    isHybrid ? "HYBRID PHASE ACTIVE" : "OMEGA-64 ACTIVE",
  );
  setHudStat(
    "a",
    isHybrid ? "GRID" : "MUTATION CANDIDATES",
    isHybrid ? "256x256" : "1024",
  );
  setHudStat("b", "FPS", "0");
  setHudStat(
    "c",
    isHybrid ? "SIGNATURE" : "OBSERVER",
    isHybrid ? "warming" : "WebGPU Lens",
  );
  const canvas = configureCanvas();

  // 3. Mount Substrate Observers
  const observer = new LensObserver(canvas, null);
  observer.setWasmContext(wasmField, wasmMemory);
  await observer.init();

  // 4. Initialize GPU Tournament Mutator
  // OBSOLETE: The GPU compute pipeline is deprecated in Ontology 11.
  // Darwinism is now executed natively in Rust WASM via horizontal gene transfer.

  // 5. Connect User Interaction Arrays
  const injector = new PerturbationInjector(canvas, wasmField);
  injector.attach();

  // 6. Bind the Semantic NLP Layer
  const coupler = new SemanticCoupler(injector);

  // Ontology 20: Ignite the Asynchronous Oracle Queue
  const oracle = new SovereignOracle(wasmField, wasmMemory);
  oracle.boot(); // Enable the queue processing flags

  // Front-End Reactivity
  wireSemanticInput(coupler, "Inject ontological intent...");

  // 7. Master Physics Rhythm
  const loop = () => {
    // Step 1: Execute WASM SIMD Tick natively
    // Provide a dummy LUT pointer (0) since trigonometry LUT isn't bound yet.
    if (isHybrid) {
      execute_phase_bridge_tick(wasmField, 0);
    } else {
      execute_simd_tick(wasmField, 0);
    }

    // Step 2: Draw mathematical Light
    observer.render();

    // Step 3: Service Asynchronous Oracle Queue
    oracle.sync();

    // System Telemetry
    tickFps();
    if (isHybrid && frames === 0) {
      setHudStat("a", "ENERGY", field_total_energy(wasmField).toString());
      setHudStat("c", "SIGNATURE", field_signature(wasmField).slice(0, 12));
      statusLabel?.replaceChildren(
        `PL ${field_total_plasmids(wasmField)} | LK ${
          field_total_locks(wasmField)
        } | Ω ${
          field_omega_span(wasmField)
        } | Q ${wasmField.get_oracle_request_count()}`,
      );
    }

    // Recursively drive the full unified pipeline
    requestAnimationFrame(loop);
  };

  loop();
  console.log(
    "[O-64] System breathing. Evolution pipeline running unconditionally.",
  );
}

bootstrap().catch(console.error);

function getSnapshotComparison(
  snapshots: PhaseField[],
  tick: number,
  compareMode: ReplayCompareMode,
): PhaseField | null {
  if (compareMode === "none") {
    return null;
  }
  if (compareMode === "seed") {
    return snapshots[0];
  }
  return tick > 0 ? snapshots[tick - 1] : null;
}

```

## `src/phase_aware_interpreter.ts`
```ts
/**
 * OMEGA-64 | Ontology 7.0
 * The Polar Phase-Aware Computing Medium (LUT-256)
 * 
 * In this paradigm, computation is geometric. 
 * Values are not linear magnitudes; they are positions in a cyclic phase space.
 * Math operations are phase translations and interference alignments.
 */

export interface PhaseVector {
    angle: number;   // 0..255 (Position on the cyclic LUT)
    radius: number;  // Floor(Value / 256) (Energy Cycle / Ring Magnitude)
}

/**
 * Transforms a linear value (i32) into a Geometric Phase Vector.
 */
export function linearToPhase(value: number): PhaseVector {
    // Handling negative numbers by wrapping them cyclically
    const angle = ((value % 256) + 256) % 256; 
    const radius = Math.floor(value / 256);
    return { angle, radius };
}

/**
 * Collapses a Geometric Phase Vector back into a linear value (i32).
 * Often only used for external IO edges.
 */
export function phaseToLinear(vector: PhaseVector): number {
    return vector.angle + (vector.radius * 256);
}

/**
 * Geometric `add`: Translating a phase forward by another phase's magnitude.
 * If the angle completes a full rotation (> 255), the cycle (radius) increases.
 */
export function phaseShiftAdd(a: PhaseVector, b: PhaseVector): PhaseVector {
    const rawAngle = a.angle + b.angle;
    const newAngle = rawAngle % 256;
    
    // Cycle increases based on full rotations made, plus existing cycles
    const orbitStep = Math.floor(rawAngle / 256);
    const newRadius = a.radius + b.radius + orbitStep;
    
    return { angle: newAngle, radius: newRadius };
}

/**
 * Semantic Resonance (Coupling).
 * Determines the topological attraction or interference between two vectors.
 * A score of 1.0 means perfect alignment (same angle).
 * A score of -1.0 means complete destructive interference (opposite sides of the circle).
 */
export function calculateResonance(a: PhaseVector, b: PhaseVector): number {
    const phaseDiff = Math.abs(a.angle - b.angle);
    
    // Map the 0-255 difference into a radian value (0 - PI)
    const radians = (phaseDiff / 256) * Math.PI * 2;
    
    // The coupling is the cosine of the phase difference.
    return Math.cos(radians);
}

/**
 * AST Execution Engine (Phase Shift Simulator).
 * Recursively runs an expression tree geometry within the Phase Space constraints.
 */
export function executePhaseGeometricAST(ir: any, env: Record<string, PhaseVector>): PhaseVector {
    if (ir.kind === "const") {
        return linearToPhase(ir.value);
    }
    
    if (ir.kind === "var") {
        if (!env[ir.name]) throw new Error(`Geometrical Variable ${ir.name} not supplied in Phase environment.`);
        return env[ir.name];
    }
    
    if (ir.kind === "op") {
        // Geometric Translation
        if (ir.op === "add") {
            const left = executePhaseGeometricAST(ir.args[0], env);
            const right = executePhaseGeometricAST(ir.args[1], env);
            return phaseShiftAdd(left, right);
        }
        
        // Advanced Orbits
        if (ir.op === "mul") {
            const left = executePhaseGeometricAST(ir.args[0], env);
            const right = executePhaseGeometricAST(ir.args[1], env);
            const linearOut = phaseToLinear(left) * phaseToLinear(right);
            return linearToPhase(linearOut); 
        }
    }
    
    throw new Error(`Unhandled Geometric Configuration: ${ir.kind}`);
}

```

## `src/shared/phase_lattice.ts`
```ts
import { fnv1a_64 } from "./hash.ts";

export const PHASE_LUT_SIZE = 256;
export const MAX_AMPLITUDE = 255;
export const MAX_LOCK = 255;
export const MAX_ENTANGLEMENT = 255;
export const MIN_OMEGA = -16;
export const MAX_OMEGA = 16;

export interface PhaseFieldShape {
    sectors: number;
    radialBins: number;
    harmonics: number;
}

export interface PhaseCellAddress {
    sector: number;
    rho: number;
    harmonic: number;
}

export interface PhaseCell extends PhaseCellAddress {
    theta: number;
    omega: number;
    amplitude: number;
    lock: number;
    entanglement: number;
    cellStatus: number;
    plasmids: bigint;
}

export interface PhaseField {
    shape: PhaseFieldShape;
    cells: PhaseCell[];
}

const FNV64_OFFSET_BASIS = 14695981039346656037n;
const FNV64_PRIME = 1099511628211n;
const FNV64_MASK = (1n << 64n) - 1n;

export function wrapIndex(value: number, modulo: number): number {
    return ((value % modulo) + modulo) % modulo;
}

export function wrapTheta(theta: number): number {
    return wrapIndex(theta, PHASE_LUT_SIZE);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function fieldIndex(shape: PhaseFieldShape, sector: number, rho: number, harmonic: number): number {
    return harmonic * shape.radialBins * shape.sectors + rho * shape.sectors + sector;
}

export function getCell(field: PhaseField, sector: number, rho: number, harmonic: number): PhaseCell {
    return field.cells[fieldIndex(
        field.shape,
        wrapIndex(sector, field.shape.sectors),
        clamp(rho, 0, field.shape.radialBins - 1),
        wrapIndex(harmonic, field.shape.harmonics),
    )];
}

export function signedPhaseDelta(fromTheta: number, toTheta: number): number {
    const delta = wrapTheta(toTheta - fromTheta);
    return delta > PHASE_LUT_SIZE / 2 ? delta - PHASE_LUT_SIZE : delta;
}

export function phaseDistance(a: number, b: number): number {
    return Math.abs(signedPhaseDelta(a, b));
}

export function resonance(a: number, b: number): number {
    const radians = (signedPhaseDelta(a, b) / PHASE_LUT_SIZE) * Math.PI * 2;
    return Math.cos(radians);
}

export function phaseSine(a: number, b: number): number {
    const radians = (signedPhaseDelta(a, b) / PHASE_LUT_SIZE) * Math.PI * 2;
    return Math.sin(radians);
}

export function createPhaseField(
    shape: PhaseFieldShape,
    initializer: (address: PhaseCellAddress) => Omit<PhaseCell, keyof PhaseCellAddress>,
): PhaseField {
    const cells: PhaseCell[] = [];
    for (let harmonic = 0; harmonic < shape.harmonics; harmonic++) {
        for (let rho = 0; rho < shape.radialBins; rho++) {
            for (let sector = 0; sector < shape.sectors; sector++) {
                const address = { sector, rho, harmonic };
                const state = initializer(address);
                cells.push({
                    ...address,
                    theta: wrapTheta(state.theta),
                    omega: clamp(Math.trunc(state.omega), MIN_OMEGA, MAX_OMEGA),
                    amplitude: clamp(Math.trunc(state.amplitude), 0, MAX_AMPLITUDE),
                    lock: clamp(Math.trunc(state.lock), 0, MAX_LOCK),
                    entanglement: clamp(Math.trunc(state.entanglement), 0, MAX_ENTANGLEMENT),
                    cellStatus: state.cellStatus !== undefined ? state.cellStatus : 0,
                    plasmids: state.plasmids !== undefined ? state.plasmids : 0n,
                });
            }
        }
    }
    return { shape, cells };
}

export function clonePhaseField(field: PhaseField): PhaseField {
    return {
        shape: { ...field.shape },
        cells: field.cells.map((cell) => ({ ...cell })),
    };
}

export function rotateGlobalPhase(field: PhaseField, deltaTheta: number): PhaseField {
    const rotated = clonePhaseField(field);
    for (const cell of rotated.cells) {
        cell.theta = wrapTheta(cell.theta + deltaTheta);
    }
    return rotated;
}

export function rotateAngularAddress(field: PhaseField, deltaSector: number): PhaseField {
    const rotatedCells = new Array<PhaseCell>(field.cells.length);
    for (const cell of field.cells) {
        const nextSector = wrapIndex(cell.sector + deltaSector, field.shape.sectors);
        const nextIndex = fieldIndex(field.shape, nextSector, cell.rho, cell.harmonic);
        rotatedCells[nextIndex] = {
            ...cell,
            sector: nextSector,
        };
    }
    return {
        shape: { ...field.shape },
        cells: rotatedCells,
    };
}

export function stepPhaseField(field: PhaseField): PhaseField {
    const next = clonePhaseField(field);
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const current = getCell(field, sector, rho, harmonic);
                const left = getCell(field, sector - 1, rho, harmonic);
                const right = getCell(field, sector + 1, rho, harmonic);
                const inner = getCell(field, sector, rho - 1, harmonic);
                const outer = getCell(field, sector, rho + 1, harmonic);
                const harmonicPeer = getCell(field, sector, rho, harmonic + 1);

                let kuramoto =
                    phaseSine(current.theta, left.theta) +
                    phaseSine(current.theta, right.theta) +
                    phaseSine(current.theta, inner.theta) +
                    phaseSine(current.theta, outer.theta) +
                    phaseSine(current.theta, harmonicPeer.theta) * 0.5;

                let coherence =
                    resonance(current.theta, left.theta) +
                    resonance(current.theta, right.theta) +
                    resonance(current.theta, inner.theta) +
                    resonance(current.theta, outer.theta) +
                    resonance(current.theta, harmonicPeer.theta) * 0.5;

                if (field.shape.sectors % 2 === 0) {
                    const antipode = getCell(field, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeWeight = (current.entanglement / 255) * 0.35;
                    kuramoto += phaseSine(current.theta, antipode.theta) * antipodeWeight;
                    coherence += resonance(current.theta, antipode.theta) * antipodeWeight;
                }

                const omegaDelta = Math.round(kuramoto);
                const amplitudeDelta = Math.round(coherence * 6) - Math.floor(current.lock / 64);
                const lockDelta = coherence >= 3 ? 8 : -4;

                const nextCell = getCell(next, sector, rho, harmonic);
                let nextAmplitude = clamp(current.amplitude + amplitudeDelta, 0, MAX_AMPLITUDE);
                let nextLock = clamp(current.lock + lockDelta, 0, MAX_LOCK);
                let nextTheta = wrapTheta(current.theta + current.omega + omegaDelta);
                let nextOmega = clamp(current.omega + omegaDelta, MIN_OMEGA, MAX_OMEGA);
                let adopted = false;

                if (nextAmplitude < 140) {
                    const neighbors = [left, right, inner, outer, harmonicPeer];
                    let bestResonance = -2.0;
                    let donorPlasmid = 0n;

                    for (const neighbor of neighbors) {
                        const candidatePlasmid = neighbor.plasmids;
                        if (candidatePlasmid === 0n) continue;
                        const candidateResonance = resonance(current.theta, neighbor.theta);
                        if (candidateResonance > bestResonance) {
                            bestResonance = candidateResonance;
                            donorPlasmid = candidatePlasmid;
                        }
                    }

                    if (donorPlasmid !== 0n && bestResonance > 0.6) {
                        nextTheta = Number(donorPlasmid & 255n);
                        const donorOmega = Number((donorPlasmid >> 8n) & 255n) - 128;
                        nextOmega = clamp(donorOmega, MIN_OMEGA, MAX_OMEGA);
                        nextCell.plasmids = donorPlasmid;
                        adopted = true;
                    }
                }

                if (!adopted && nextAmplitude < 20 && nextLock < 10) {
                    // Cannot easily track oracleRequestCount in TS, but logically it just freezes the cell.
                    // We will not implement the queue array in TS, just the status freeze.
                    nextCell.cellStatus = 1;
                }

                if (nextAmplitude < 15 && current.plasmids !== 0n && nextTheta % 4 === 0) {
                    nextCell.plasmids = 0n;
                }

                if (!adopted) {
                    nextCell.theta = nextTheta;
                    nextCell.omega = nextOmega;
                } else {
                    nextCell.theta = nextTheta;
                    nextCell.omega = nextOmega;
                }
                
                nextCell.amplitude = nextAmplitude;
                nextCell.lock = nextLock;

                if (field.shape.sectors % 2 === 0) {
                    const antipode = getCell(field, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeAlignment = resonance(current.theta, antipode.theta);
                    nextCell.entanglement =
                        antipodeAlignment > 0.92 && current.amplitude > 96
                            ? clamp(current.entanglement + 8, 0, MAX_ENTANGLEMENT)
                            : clamp(current.entanglement - 3, 0, MAX_ENTANGLEMENT);
                } else {
                    nextCell.entanglement = current.entanglement;
                }
            }
        }
    }
    return next;
}

export function runPhaseField(field: PhaseField, ticks: number): PhaseField {
    let current = clonePhaseField(field);
    for (let i = 0; i < ticks; i++) {
        current = stepPhaseField(current);
    }
    return current;
}

export function fieldSignature(field: PhaseField): string {
    const payload = field.cells.map((cell) => [
        cell.sector,
        cell.rho,
        cell.harmonic,
        cell.theta,
        cell.omega,
        cell.amplitude,
        cell.lock,
        cell.entanglement,
        cell.cellStatus,
        cell.plasmids.toString(),
    ]);
    return fnv1a_64(JSON.stringify(payload)).toString(16);
}

export function structuralSignature(field: PhaseField): string {
    let hash = FNV64_OFFSET_BASIS;

    for (const cell of field.cells) {
        mixU64(hashValue(cell.sector));
        mixU64(hashValue(cell.rho));
        mixU64(hashValue(cell.harmonic));
        mixU64(hashValue(cell.theta));
        mixU64(hashSignedValue(cell.omega));
        mixU64(hashValue(cell.amplitude));
        mixU64(hashValue(cell.lock));
        mixU64(hashValue(cell.entanglement));
        mixU64(hashValue(cell.cellStatus));
        mixU64(cell.plasmids);
    }

    return hash.toString(16).padStart(16, "0");

    function mixU64(value: bigint): void {
        hash ^= value;
        hash = (hash * FNV64_PRIME) & FNV64_MASK;
    }
}

export function fieldsEqual(a: PhaseField, b: PhaseField): boolean {
    if (
        a.shape.sectors !== b.shape.sectors ||
        a.shape.radialBins !== b.shape.radialBins ||
        a.shape.harmonics !== b.shape.harmonics ||
        a.cells.length !== b.cells.length
    ) {
        return false;
    }

    for (let i = 0; i < a.cells.length; i++) {
        const left = a.cells[i];
        const right = b.cells[i];
        if (
            left.sector !== right.sector ||
            left.rho !== right.rho ||
            left.harmonic !== right.harmonic ||
            left.theta !== right.theta ||
            left.omega !== right.omega ||
            left.amplitude !== right.amplitude ||
            left.lock !== right.lock ||
            left.entanglement !== right.entanglement ||
            left.cellStatus !== right.cellStatus ||
            left.plasmids !== right.plasmids
        ) {
            return false;
        }
    }

    return true;
}

export function assertFieldBounds(field: PhaseField): void {
    for (const cell of field.cells) {
        if (cell.theta < 0 || cell.theta >= PHASE_LUT_SIZE) {
            throw new Error(`theta out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.omega < MIN_OMEGA || cell.omega > MAX_OMEGA) {
            throw new Error(`omega out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.amplitude < 0 || cell.amplitude > MAX_AMPLITUDE) {
            throw new Error(`amplitude out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.lock < 0 || cell.lock > MAX_LOCK) {
            throw new Error(`lock out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.entanglement < 0 || cell.entanglement > MAX_ENTANGLEMENT) {
            throw new Error(`entanglement out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
    }
}

export function projectCellToCartesian(
    cell: PhaseCell,
    shape: PhaseFieldShape,
    radialScale = 1,
): { x: number; y: number } {
    const radius = (cell.rho + 1) * radialScale;
    const radians = (cell.sector / shape.sectors) * Math.PI * 2;
    return {
        x: radius * Math.cos(radians),
        y: radius * Math.sin(radians),
    };
}

export function sumAmplitude(field: PhaseField): number {
    return field.cells.reduce((acc, cell) => acc + cell.amplitude, 0);
}

export function sumEntanglement(field: PhaseField): number {
    return field.cells.reduce((acc, cell) => acc + cell.entanglement, 0);
}

function hashValue(value: number): bigint {
    return BigInt(value >>> 0);
}

function hashSignedValue(value: number): bigint {
    return BigInt(value >>> 0);
}

```

## `src/shared/hash.ts`
```ts
/**
 * OMEGA-64 | Deterministic Structural Identity
 * 
 * Guarantees cross-platform perfect deterministic hashing of strings into 64-bit semantic IDs.
 * Utilizes the 64-bit FNV-1a algorithm for high collision resistance on small intent phrases.
 */

const FNV_PRIME_64 = 1099511628211n;
const FNV_OFFSET_BASIS_64 = 14695981039346656037n;

export function fnv1a_64(str: string): bigint {
    let hash = FNV_OFFSET_BASIS_64;
    for (let i = 0; i < str.length; i++) {
        hash ^= BigInt(str.charCodeAt(i));
        // Use BigInt.asUintN to strictly bound to 64-bit multiplication overflow boundaries mimicking Rust u64
        hash = BigInt.asUintN(64, hash * FNV_PRIME_64);
    }
    return hash;
}

```

## `src/shared/phase_canonical.ts`
```ts
import { clamp, createPhaseField, getCell, wrapIndex, wrapTheta } from "./phase_lattice.ts";
import type { PhaseField, PhaseFieldShape } from "./phase_lattice.ts";

export const CANONICAL_PHASE_SHAPE: PhaseFieldShape = {
    sectors: 32,
    radialBins: 6,
    harmonics: 3,
};

export function buildCanonicalPhaseSeed(shape: PhaseFieldShape = CANONICAL_PHASE_SHAPE): PhaseField {
    return createPhaseField(shape, ({ sector, rho, harmonic }) => ({
        theta: sector * 7 + rho * 19 + harmonic * 23,
        omega: ((sector + rho + harmonic) % 5) - 2,
        amplitude: clamp(sector * 13 + rho * 17 + harmonic * 29, 0, 255),
        lock: (sector * 5 + rho * 11 + harmonic * 3) % 64,
        entanglement: 0,
        cellStatus: 0,
        plasmids: 0n,
    }));
}

export function buildProjectedBridgeSeed(
    bridgeWidth: number,
    bridgeHeight: number,
    shape: PhaseFieldShape = CANONICAL_PHASE_SHAPE,
): PhaseField {
    const canonical = buildCanonicalPhaseSeed(shape);
    return createPhaseField(
        {
            sectors: bridgeWidth,
            radialBins: bridgeHeight,
            harmonics: 1,
        },
        ({ sector, rho }) => collapseCanonicalBridgeCell(canonical, bridgeWidth, bridgeHeight, sector, rho),
    );
}

function collapseCanonicalBridgeCell(
    canonical: PhaseField,
    bridgeWidth: number,
    bridgeHeight: number,
    sector: number,
    rho: number,
) {
    const sourceSector = projectSectorIndex(sector, bridgeWidth, canonical.shape.sectors);
    const sourceRho = projectRadialIndex(rho, bridgeHeight, canonical.shape.radialBins);
    let sumX = 0;
    let sumY = 0;
    let sumAmplitude = 0;
    let sumLock = 0;
    let sumOmega = 0;
    let maxEntanglement = 0;
    let fallbackTheta = 0;

    for (let harmonic = 0; harmonic < canonical.shape.harmonics; harmonic++) {
        const cell = getCell(canonical, sourceSector, sourceRho, harmonic);
        const weight = Math.max(1, cell.amplitude);
        const radians = (cell.theta / 256) * Math.PI * 2;
        sumX += Math.cos(radians) * weight;
        sumY += Math.sin(radians) * weight;
        sumAmplitude += cell.amplitude;
        sumLock += cell.lock;
        sumOmega += cell.omega;
        maxEntanglement = Math.max(maxEntanglement, cell.entanglement);
        fallbackTheta = cell.theta;
    }

    const harmonicCount = canonical.shape.harmonics;
    const meanAngle = sumX === 0 && sumY === 0 ? (fallbackTheta / 256) * Math.PI * 2 : Math.atan2(sumY, sumX);
    const normalizedAngle = meanAngle < 0 ? meanAngle + Math.PI * 2 : meanAngle;

    return {
        theta: wrapTheta(Math.round((normalizedAngle / (Math.PI * 2)) * 256)),
        omega: Math.round(sumOmega / harmonicCount),
        amplitude: clamp(Math.round(sumAmplitude / harmonicCount), 0, 255),
        lock: clamp(Math.round(sumLock / harmonicCount), 0, 255),
        entanglement: maxEntanglement,
        cellStatus: 0,
        plasmids: 0n,
    };
}

function projectSectorIndex(targetSector: number, targetSectors: number, sourceSectors: number): number {
    if (targetSectors <= 0 || sourceSectors <= 0) {
        return 0;
    }
    return wrapIndex(Math.floor((targetSector * sourceSectors) / targetSectors), sourceSectors);
}

function projectRadialIndex(targetRho: number, targetBins: number, sourceBins: number): number {
    if (sourceBins <= 0) {
        return 0;
    }
    if (targetBins >= sourceBins) {
        return Math.min(targetRho, sourceBins - 1);
    }
    return Math.min(Math.floor((targetRho * sourceBins) / targetBins), sourceBins - 1);
}

```

## `src/shared/phase_bridge.ts`
```ts
import { buildProjectedBridgeSeed, CANONICAL_PHASE_SHAPE } from "./phase_canonical.ts";
import { wrapIndex, wrapTheta } from "./phase_lattice.ts";

const BRIDGE_FNV64_OFFSET_BASIS = 14695981039346656037n;
const BRIDGE_FNV64_PRIME = 1099511628211n;
const BRIDGE_FNV64_MASK = (1n << 64n) - 1n;
const BRIDGE_ZERO_LUT = new Int16Array(256);
const BRIDGE_DELTAS = [1, 2, 3, 4] as const;
const BRIDGE_MAX_OMEGA = 32;
const BRIDGE_PHASE_SCALE = Math.fround(Math.fround(Math.PI * 2) / 256);
const BRIDGE_ACTIVE_RADIAL_BINS = CANONICAL_PHASE_SHAPE.radialBins;
const BRIDGE_ADOPTION_RESONANCE_THRESHOLD = 0.6;
const BRIDGE_COHERENCE_ENERGY_GAIN = 6;
const BRIDGE_LOCK_PENALTY_DIVISOR = 64;
const BRIDGE_LOCK_GAIN = 8;
const BRIDGE_LOCK_DECAY = 4;
const BRIDGE_BOUNDARY_ENERGY_BONUS = 0;
const BRIDGE_BOUNDARY_LOCK_BONUS = 1;
const BRIDGE_DEPTH1_SUSTAINED_ENERGY_BONUS = 2;
const BRIDGE_DEPTH2_LOCK_THRESHOLD = Math.fround(2.5);


export interface BridgeField {
    width: number;
    height: number;
    thetaNow: Uint8Array;
    thetaF1: Uint8Array;
    thetaF2: Uint8Array;
    thetaF3: Uint8Array;
    omega: Uint8Array;
    energy: Uint8Array;
    plasmids: BigUint64Array;
    hebbianLocks: Uint8Array;
    oracleRequests: Uint32Array;
    oracleRequestCount: number;
    cellStatus: Uint8Array;
}

export function buildBridgeSeed(width: number, height: number): BridgeField {
    const size = width * height;
    const projected = buildProjectedBridgeSeed(width, height);
    const thetaNow = new Uint8Array(size);
    const thetaF1 = new Uint8Array(size);
    const thetaF2 = new Uint8Array(size);
    const thetaF3 = new Uint8Array(size);
    const omega = new Uint8Array(size);
    const energy = new Uint8Array(size);
    const plasmids = new BigUint64Array(size);
    const hebbianLocks = new Uint8Array(size);
    const oracleRequests = new Uint32Array(1024);
    const cellStatus = new Uint8Array(size);

    for (const cell of projected.cells) {
        const index = bridgeIndex(width, cell.sector, cell.rho);
        thetaNow[index] = cell.theta;
        omega[index] = encodeBridgeOmega(cell.omega);
        energy[index] = clampByte(cell.amplitude);
        hebbianLocks[index] = clampByte(cell.lock);
        cellStatus[index] = 0;
    }

    for (let rho = 0; rho < height; rho++) {
        for (let sector = 0; sector < width; sector++) {
            const index = bridgeIndex(width, sector, rho);
            const leftIndex = bridgeIndex(width, wrapIndex(sector - 1, width), rho);
            const rightIndex = bridgeIndex(width, wrapIndex(sector + 1, width), rho);

            thetaF1[index] = thetaNow[leftIndex];
            thetaF2[index] = thetaNow[rightIndex];
            thetaF3[index] = thetaNow[index];
        }
    }

    return {
        width,
        height,
        thetaNow,
        thetaF1,
        thetaF2,
        thetaF3,
        omega,
        energy,
        plasmids,
        hebbianLocks,
        oracleRequests,
        oracleRequestCount: 0,
        cellStatus,
    };
}

export function cloneBridgeField(field: BridgeField): BridgeField {
    return {
        width: field.width,
        height: field.height,
        thetaNow: new Uint8Array(field.thetaNow),
        thetaF1: new Uint8Array(field.thetaF1),
        thetaF2: new Uint8Array(field.thetaF2),
        thetaF3: new Uint8Array(field.thetaF3),
        omega: new Uint8Array(field.omega),
        energy: new Uint8Array(field.energy),
        plasmids: new BigUint64Array(field.plasmids),
        hebbianLocks: new Uint8Array(field.hebbianLocks),
        oracleRequests: new Uint32Array(field.oracleRequests),
        oracleRequestCount: field.oracleRequestCount,
        cellStatus: new Uint8Array(field.cellStatus),
    };
}

export function rotateBridgeField(field: BridgeField, delta: number): BridgeField {
    const rotated = cloneBridgeField(field);
    const size = field.width * field.height;
    rotated.thetaNow = new Uint8Array(size);
    rotated.thetaF1 = new Uint8Array(size);
    rotated.thetaF2 = new Uint8Array(size);
    rotated.thetaF3 = new Uint8Array(size);
    rotated.omega = new Uint8Array(size);
    rotated.energy = new Uint8Array(size);
    rotated.hebbianLocks = new Uint8Array(size);
    rotated.plasmids = new BigUint64Array(size);
    rotated.cellStatus = new Uint8Array(size);

    for (let rho = 0; rho < field.height; rho++) {
        for (let sector = 0; sector < field.width; sector++) {
            const source = bridgeIndex(field.width, sector, rho);
            const targetSector = wrapIndex(sector + delta, field.width);
            const target = bridgeIndex(field.width, targetSector, rho);

            rotated.thetaNow[target] = field.thetaNow[source];
            rotated.thetaF1[target] = field.thetaF1[source];
            rotated.thetaF2[target] = field.thetaF2[source];
            rotated.thetaF3[target] = field.thetaF3[source];
            rotated.omega[target] = field.omega[source];
            rotated.energy[target] = field.energy[source];
            rotated.hebbianLocks[target] = field.hebbianLocks[source];
            rotated.plasmids[target] = field.plasmids[source];
            rotated.cellStatus[target] = field.cellStatus[source];
        }
    }

    return rotated;
}

export function stepBridgeField(field: BridgeField, lut: ArrayLike<number> = BRIDGE_ZERO_LUT): BridgeField {
    const next = cloneBridgeField(field);
    const size = field.width * field.height;
    const width = field.width;
    const height = field.height;
    const activeRadialBins = Math.max(1, Math.min(height, BRIDGE_ACTIVE_RADIAL_BINS));

    const thetaPrev = field.thetaNow;
    const thetaF3Prev = field.thetaF3;
    const omegaPrev = field.omega;
    const energyPrev = field.energy;
    const plasmidsPrev = field.plasmids;
    const locksPrev = field.hebbianLocks;
    const statusPrev = field.cellStatus;

    for (let index = 0; index < size; index++) {
        if (statusPrev[index] === 1) {
            continue;
        }

        const sector = index % width;
        const rho = Math.trunc(index / width);
        const radialRho = Math.min(rho, activeRadialBins - 1);
        const boundaryDepth = Math.min(radialRho, activeRadialBins - 1 - radialRho);
        const boundaryBonus = boundaryDepth <= 1 ? 1 : 0;
        const leftIndex = bridgeIndex(width, wrapIndex(sector - 1, width), rho);
        const rightIndex = bridgeIndex(width, wrapIndex(sector + 1, width), rho);
        const innerIndex = bridgeIndex(width, sector, Math.max(0, radialRho - 1));
        const outerIndex = bridgeIndex(width, sector, Math.min(radialRho + 1, activeRadialBins - 1));
        const antipodeIndex = width % 2 === 0 ? bridgeIndex(width, (sector + width / 2) % width, rho) : index;
        const syntheticPeerTheta = thetaF3Prev[index];

        const rawEnergy = energyPrev[index];
        const localTargetValue = localTarget(
            lut,
            thetaPrev,
            [leftIndex, rightIndex, innerIndex, outerIndex],
            index,
            false,
        );

        let bestEnergy = rawEnergy;
        let bestScore = 32767;
        for (const delta of BRIDGE_DELTAS) {
            const mutatedPhase = (thetaPrev[index] + delta) & 0xff;
            const val = lut[mutatedPhase] ?? 0;
            const mutatedVal = generatedBiologyFastAbs(val);
            const nextEnergy = rawEnergy + mutatedVal;
            const score = Math.abs(nextEnergy - localTargetValue);
            if (score < bestScore) {
                bestScore = score;
                bestEnergy = nextEnergy;
            }
        }

        let kuramoto = f32(0);
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[leftIndex]));
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[rightIndex]));
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[innerIndex]));
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[outerIndex]));
        kuramoto = f32(kuramoto + f32(phaseSin(thetaPrev[index], syntheticPeerTheta) * 0.5));

        let coherence = f32(0);
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[leftIndex]));
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[rightIndex]));
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[innerIndex]));
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[outerIndex]));
        coherence = f32(coherence + f32(phaseCos(thetaPrev[index], syntheticPeerTheta) * 0.5));

        const sustainedCoherenceBonus =
            boundaryDepth === 1 && plasmidsPrev[index] === 0n && locksPrev[index] >= 64 && coherence >= 3
                ? BRIDGE_DEPTH1_SUSTAINED_ENERGY_BONUS
                : 0;

        const nextOmega = clampBridgeOmega(decodeBridgeOmega(omegaPrev[index]) + roundTiesAwayFromZero(kuramoto));
        const nextTheta = wrapTheta(thetaPrev[index] + nextOmega);
        const coupledEnergy =
            clampByte(
                bestEnergy +
                roundTiesAwayFromZero(f32(coherence * BRIDGE_COHERENCE_ENERGY_GAIN)) +
                sustainedCoherenceBonus +
                boundaryBonus * BRIDGE_BOUNDARY_ENERGY_BONUS -
                Math.trunc(locksPrev[index] / BRIDGE_LOCK_PENALTY_DIVISOR),
            );

        next.thetaNow[index] = nextTheta;
        next.omega[index] = encodeBridgeOmega(nextOmega);
        next.energy[index] = coupledEnergy;
        next.thetaF1[index] = thetaPrev[leftIndex];
        next.thetaF2[index] = thetaPrev[rightIndex];
        next.thetaF3[index] = thetaPrev[index];

        if (coherence >= 3 && coupledEnergy > 200) {
            next.plasmids[index] =
                BigInt(next.thetaNow[index]) |
                (BigInt(next.omega[index]) << 8n) |
                (BigInt(next.hebbianLocks[index]) << 16n) |
                (BigInt(coupledEnergy) << 24n);
        }

        if (bestScore > 100 && coupledEnergy < 240) {
            const neighbors = [leftIndex, rightIndex, innerIndex, outerIndex, antipodeIndex];
            let adopted = false;
            let bestResonance = f32(-2);
            let donorPlasmid = 0n;

            for (const neighborIndex of neighbors) {
                const candidatePlasmid = plasmidsPrev[neighborIndex];
                if (candidatePlasmid === 0n) {
                    continue;
                }
                const candidateResonance = phaseCos(thetaPrev[index], thetaPrev[neighborIndex]);
                if (candidateResonance > bestResonance) {
                    bestResonance = candidateResonance;
                    donorPlasmid = candidatePlasmid;
                }
            }

            if (donorPlasmid !== 0n && bestResonance > BRIDGE_ADOPTION_RESONANCE_THRESHOLD) {
                next.thetaNow[index] = Number(donorPlasmid & 0xffn);
                const donorOmega = decodeBridgeOmega(Number((donorPlasmid >> 8n) & 0xffn));
                next.omega[index] = encodeBridgeOmega(clampBridgeOmega(donorOmega));
                next.plasmids[index] = donorPlasmid;
                adopted = true;
            }

            if (!adopted && bestScore > 160 && next.oracleRequestCount < next.oracleRequests.length) {
                next.oracleRequests[next.oracleRequestCount] = index;
                next.oracleRequestCount += 1;
                next.cellStatus[index] = 1;
            }
        }

        const lockThreshold = boundaryDepth === 2 ? BRIDGE_DEPTH2_LOCK_THRESHOLD : f32(3.0);
        next.hebbianLocks[index] =
            coherence >= lockThreshold
                ? saturatingAddByte(locksPrev[index], BRIDGE_LOCK_GAIN + boundaryBonus * BRIDGE_BOUNDARY_LOCK_BONUS)
                : saturatingSubByte(locksPrev[index], BRIDGE_LOCK_DECAY);

        if (coupledEnergy < 15 && next.plasmids[index] !== 0n && next.thetaNow[index] % 4 === 0) {
            next.plasmids[index] = 0n;
        }
    }

    return next;
}

export function runBridgeField(field: BridgeField, ticks: number, lut: ArrayLike<number> = BRIDGE_ZERO_LUT): BridgeField {
    let current = cloneBridgeField(field);
    for (let tick = 0; tick < ticks; tick++) {
        current = stepBridgeField(current, lut);
    }
    return current;
}

export function bridgeFieldSignature(field: BridgeField): string {
    let hash = BRIDGE_FNV64_OFFSET_BASIS;
    const size = field.width * field.height;

    for (let index = 0; index < size; index++) {
        mix(BigInt(index));
        mix(BigInt(field.thetaNow[index]));
        mix(BigInt(field.thetaF1[index]));
        mix(BigInt(field.thetaF2[index]));
        mix(BigInt(field.thetaF3[index]));
        mix(BigInt(field.omega[index]));
        mix(BigInt(field.energy[index]));
        mix(BigInt(field.hebbianLocks[index]));
        mix(field.plasmids[index] & BRIDGE_FNV64_MASK);
        mix(BigInt(field.cellStatus[index]));
    }

    return hash.toString(16).padStart(16, "0");

    function mix(value: bigint): void {
        hash ^= value;
        hash = (hash * BRIDGE_FNV64_PRIME) & BRIDGE_FNV64_MASK;
    }
}

export function bridgeTotalEnergy(field: BridgeField): number {
    return field.energy.reduce((sum, value) => sum + value, 0);
}

export function bridgeTotalLocks(field: BridgeField): number {
    return field.hebbianLocks.reduce((sum, value) => sum + value, 0);
}

export function bridgeTotalPlasmids(field: BridgeField): number {
    let count = 0;
    for (const value of field.plasmids) {
        if (value !== 0n) {
            count += 1;
        }
    }
    return count;
}

export function bridgeOmegaSpan(field: BridgeField): string {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const raw of field.omega) {
        const omega = decodeBridgeOmega(raw);
        min = Math.min(min, omega);
        max = Math.max(max, omega);
    }

    return `${min}..${max}`;
}

export function bridgeFieldsEqual(left: BridgeField, right: BridgeField): boolean {
    if (
        left.width !== right.width ||
        left.height !== right.height ||
        left.oracleRequestCount !== right.oracleRequestCount
    ) {
        return false;
    }

    const size = left.width * left.height;
    for (let index = 0; index < size; index++) {
        if (
            left.thetaNow[index] !== right.thetaNow[index] ||
            left.thetaF1[index] !== right.thetaF1[index] ||
            left.thetaF2[index] !== right.thetaF2[index] ||
            left.thetaF3[index] !== right.thetaF3[index] ||
            left.omega[index] !== right.omega[index] ||
            left.energy[index] !== right.energy[index] ||
            left.hebbianLocks[index] !== right.hebbianLocks[index] ||
            left.plasmids[index] !== right.plasmids[index] ||
            left.cellStatus[index] !== right.cellStatus[index]
        ) {
            return false;
        }
    }

    for (let index = 0; index < left.oracleRequestCount; index++) {
        if (left.oracleRequests[index] !== right.oracleRequests[index]) {
            return false;
        }
    }

    return true;
}

function bridgeIndex(width: number, sector: number, rho: number): number {
    return rho * width + sector;
}

function decodeBridgeOmega(raw: number): number {
    return raw > 127 ? raw - 256 : raw;
}

function encodeBridgeOmega(value: number): number {
    return value & 0xff;
}

function clampBridgeOmega(value: number): number {
    return clamp(value, -BRIDGE_MAX_OMEGA, BRIDGE_MAX_OMEGA);
}

function clampByte(value: number): number {
    return clamp(value, 0, 255);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.trunc(value)));
}

function saturatingAddByte(value: number, delta: number): number {
    return clampByte(value + delta);
}

function saturatingSubByte(value: number, delta: number): number {
    return clampByte(value - delta);
}

function generatedBiologyFastAbs(value: number): number {
    return Math.trunc(value * 18);
}

function localTarget(
    lut: ArrayLike<number>,
    thetaPrev: Uint8Array,
    neighborhood: readonly number[],
    antipodeIndex: number,
    includeAntipode: boolean,
): number {
    let total = 0;
    let count = 0;

    for (const index of neighborhood) {
        total += lut[thetaPrev[index]] ?? 0;
        count += 1;
    }

    if (includeAntipode) {
        total += Math.trunc((lut[thetaPrev[antipodeIndex]] ?? 0) / 2);
        count += 1;
    }

    return count === 0 ? 0 : Math.trunc(total / count);
}

function signedPhaseDelta(fromTheta: number, toTheta: number): number {
    const raw = wrapTheta(toTheta - fromTheta);
    return raw > 128 ? raw - 256 : raw;
}

function phaseRadians(fromTheta: number, toTheta: number): number {
    return f32(f32(signedPhaseDelta(fromTheta, toTheta)) * BRIDGE_PHASE_SCALE);
}

function phaseSin(fromTheta: number, toTheta: number): number {
    return f32(Math.sin(phaseRadians(fromTheta, toTheta)));
}

function phaseCos(fromTheta: number, toTheta: number): number {
    return f32(Math.cos(phaseRadians(fromTheta, toTheta)));
}

function roundTiesAwayFromZero(value: number): number {
    return value < 0 ? -Math.round(-value) : Math.round(value);
}

function f32(value: number): number {
    return Math.fround(value);
}

```

## `src/ontology/oracle.ts`
```ts
import { fnv1a_64 } from "../shared/hash.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";

export interface OracleCompatibleField {
    get_oracle_request_count(): number;
    ptr_oracle_requests(): number;
    clear_oracle_requests(): void;
    ptr_plasmids(): number;
    ptr_cell_status(): number;
    cell_count?(): number;
    width?: number;
    height?: number;
}

export class SovereignOracle {
    private wasmField: OracleCompatibleField;
    private wasmMemory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private visualizer?: PhaseWebGPUObserver;
    private isRunning: boolean = false;
    private isBusy: boolean = false;
    private requestQueue: number[] = [];

    constructor(field: OracleCompatibleField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.wasmMemory = memory;
        this.engine = engine;
        this.visualizer = visualizer;
    }

    public rebind(field: OracleCompatibleField, engine?: PhaseComputeEngine, visualizer?: PhaseWebGPUObserver) {
        this.wasmField = field;
        this.engine = engine;
        this.visualizer = visualizer;
    }

    public request(idx: number) {
        this.requestQueue.push(idx);
    }

    public getQueueSize(): number {
        return this.engine ? this.requestQueue.length : this.wasmField.get_oracle_request_count();
    }

    public async boot() {
        this.isRunning = true;
        console.log("[ORACLE] Asynchronous Batched AOMQ (Ontology 20) initialized.");
    }

    public sync() {
        if (!this.isRunning || this.isBusy) return;
        
        let count = 0;
        let requests: number[] = [];

        if (this.engine) {
            count = this.requestQueue.length;
            if (count > 0) {
                requests = [...this.requestQueue];
                this.requestQueue = [];
                this.processQueue(count, requests);
            }
        } else {
            // Legacy WASM fallback
            count = this.wasmField.get_oracle_request_count();
            if (count > 0) {
                const requestPtr = this.wasmField.ptr_oracle_requests();
                const requestArray = new Uint32Array(this.wasmMemory.buffer, requestPtr, count);
                requests = Array.from(requestArray);
                this.wasmField.clear_oracle_requests();
                this.processQueue(count, requests);
            }
        }
    }

    private async processQueue(count: number, requests: number[]) {
        this.isBusy = true;
        
        console.log(`[ORACLE] Queue threshold triggered. Batching ${count} anomalous structural signatures for Semantic Resolution...`);

        let mycelialContext = "";
        if (this.engine) {
            const centroids = await this.engine.readMycelialCentroids();
            let activeBuckets = 0;
            let totalX = 0;
            let totalY = 0;
            const bucketDetails: string[] = [];
            
            for (let i = 0; i < 1024; i++) {
                const count = centroids[i * 4 + 2];
                if (count > 0) {
                    activeBuckets++;
                    const bx = centroids[i * 4];
                    const by = centroids[i * 4 + 1];
                    totalX += bx;
                    totalY += by;
                    if (bucketDetails.length < 5) {
                        bucketDetails.push(`Bucket #${i}: Center (x:${bx.toFixed(1)}, y:${by.toFixed(1)})`);
                    }
                }
            }
            
            if (activeBuckets > 0) {
                const avgTheta = Math.atan2(totalY, totalX) * (180 / Math.PI);
                mycelialContext = `\nPHYSICAL TELEMETRY: ${activeBuckets} existing Transdimensional Threads are pulling the Torus toward angle ${avgTheta.toFixed(1)} degrees.` +
                                  `\nHere is spatial data for the strongest local clusters:\n${bucketDetails.join("\n")}\n` +
                                  `In your output, you MUST prioritize explicit spatial targeting by referencing a Bucket.`;
            }
        }

        // 2. Spatial Batching: Construct the Macro-Prompt for LLM
        let structuralImage = "";
        if (this.visualizer) {
            try {
                // Read the graphical buffer layout
                structuralImage = this.visualizer.extractImageBase64(512);
            } catch (e) {
                console.warn("[ORACLE] Failed to extract physical topology:", e);
            }
        }
        
        // Output snapshot to a debug pane if it exists
        const debugImg = document.getElementById("oracle-debug-vision") as HTMLImageElement;
        if (debugImg && structuralImage) {
            debugImg.style.display = "block";
            debugImg.src = "data:image/png;base64," + structuralImage;
        }

        const prompt = `
            Task: You are the Subconscious Sovereign Oracle of OMEGA-64.
            The harmonic cylinder is experiencing severe resonance dissonance at ${count} distinct topological coordinates.
            These nodes have locked natively, demanding semantic resolution.${mycelialContext}
            Generate one abstract Semantic Attractor (max 5 words) to resolve this structural chaos and restore phase.
            You have been provided with exactly one physical image of the Torus geometry. Observe its lattice carefully.
            ${(this.engine && mycelialContext) ? 'Provide EXACTLY "Bucket #X: [concept]" where X is a Bucket ID from the Telemetry.' : 'Provide ONLY the semantic concept (e.g., "Harmonic diffusion across boundaries"). No formatting.'}
        `.trim();

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";
            
            // Generate standard payload or Multimodal payload depending on topological capture
            const requestBody: any = {
                model: structuralImage ? "llama3.2-vision" : "llama3",
                prompt,
                stream: false
            };
            if (structuralImage) {
                requestBody.images = [structuralImage];
            }
            
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error("LLM Offline");
            
            const data = await response.json();
            const fullResponse = data.response?.trim() || "";
            
            // Extract bucket explicitly if provided by the Oracle
            const intentMatch = fullResponse.match(/Bucket #(\d+):\s*(.*)/i);
            const intent = intentMatch ? intentMatch[2].substring(0, 50) : fullResponse.substring(0, 50);
            
            const targetBucket = intentMatch ? intentMatch[1] : null;

            if (intent) {
                if (targetBucket) {
                    console.log(`[ORACLE] Surgeon Oracle targets Bucket #${targetBucket} with intent: "${intent}"`);
                } else {
                    console.log(`[ORACLE] Oracle responds to batched distress (${count} cells): "${intent}"`);
                }
                this.fulfillRequests(requests, intent, targetBucket ? parseInt(targetBucket) : undefined);
            }
        } catch (e) {
            console.warn(`[ORACLE] LLM inference failed/timeout. Emitting fallback plasmid to batch of ${count}.`);
            this.fulfillRequests(requests, "Stochastic survival protocol omega");
        }
        
        this.isBusy = false;
    }

    private fulfillRequests(requests: number[], intent: string, targetBucket?: number) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into Plasmids
        const hash = fnv1a_64(intent);

        if (this.engine) {
            // O-23 Native WebGPU Interface
            if (targetBucket !== undefined) {
                this.engine.injectPlasmidIntoBucket(targetBucket, hash);
                console.log(`[ORACLE] Successfully decoded algorithm and flooded Bucket #${targetBucket} with Resonance Plasmid.`);
            } else {
                let success = 0;
                for (const idx of requests) {
                    this.engine.injectPlasmid(idx, hash);
                    success++;
                }
                console.log(`[ORACLE] Successfully decoded and unlocked ${success} WebGPU cells.`);
            }
            return;
        }
        
        // Legacy WASM Interface
        let size = 0;
        if (this.wasmField.cell_count) {
            size = this.wasmField.cell_count();
        } else if (this.wasmField.width && this.wasmField.height) {
            size = this.wasmField.width * this.wasmField.height;
        }
        
        const plasmidPtr = this.wasmField.ptr_plasmids();
        const plasmids = new BigUint64Array(this.wasmMemory.buffer, plasmidPtr, size);
        
        const statusPtr = this.wasmField.ptr_cell_status();
        const status = new Uint8Array(this.wasmMemory.buffer, statusPtr, size);
        
        let success = 0;
        for (const idx of requests) {
            if (idx < size) {
                // Suture the idea onto the cell's genome
                plasmids[idx] = hash;
                
                // Unfreeze the cell, returning it to active temporal physics (IDLE = 0)
                status[idx] = 0;
                success++;
            }
        }
        
        console.log(`[ORACLE] Successfully decoded and unlocked ${success} cells.`);
    }
}

```

## `src/ontology/semantic_layer.ts`
```ts
import { fnv1a_64 } from "../shared/hash.ts";

export class SemanticCoupler {
    private injector: any; // PerturbationInjector
    
    constructor(injector: any) {
        this.injector = injector;
    }

    // Projects absolute semantic meaning into the physical dimension
    public projectIntent(intent: string) {
        // 1. Hash the semantic string intent into cross-platform deterministic 64-bit topology
        const hash_u64 = fnv1a_64(intent);
        
        // 2. Map BigInt 64-bit into Little-Endian Uint8Array for WebGPU memory bounds
        const view = new DataView(new ArrayBuffer(8));
        view.setBigUint64(0, hash_u64, true); 
        const hashBytes = new Uint8Array(view.buffer);
        
        // 3. Derive spatial coordinates from the hash resonance
        // Mathematical grid mapping 256x256
        const x = (hashBytes[0] ^ hashBytes[1]) % 256;
        const y = (hashBytes[2] ^ hashBytes[3]) % 256;
        
        // 4. Derive energetic disturbance amplitude and topological radius
        const energy = ((hashBytes[4] & 0x0F) + 1) * 100;
        const radius = (hashBytes[5] & 0x0F) + 5;
        
        // 5. Determine structural mutation parameter
        const phaseShift = hashBytes[6];
        
        // Inject the conceptual perturbation into the lock-free shared physical reality
        // In Ontology 11, we inject the raw Hash array as an 8-byte Plasmid Memory structure
        this.injector["inject"](x, y, energy, radius, phaseShift, hashBytes);
        console.log(`[Σ³] Projected Plasmid '${intent}' -> Field(${x}, ${y}) : ΔPhase=${phaseShift}, Energy=${energy}, Encoding=${hash_u64.toString(16)}`);
    }
}

```

## `src/lens/phase_compute.ts`
```ts
import computeKuramotoWgsl from './shaders/compute_kuramoto.wgsl?raw';
import computeMycelialWgsl from './shaders/compute_mycelial.wgsl?raw';
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";

interface PendingInjection {
    idx: number;
    bucket?: number;
    hashLow: number;
    hashHigh: number;
    amp: number;
    phase: number;
    ent: number;
}

export class PhaseComputeEngine {
    public device: GPUDevice;
    public bufferA!: GPUBuffer;
    public bufferB!: GPUBuffer;
    public paramsBuffer!: GPUBuffer;
    public mycelialBuffer!: GPUBuffer;
    
    private pipeline!: GPUComputePipeline;
    private mycelialPipeline!: GPUComputePipeline;
    
    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;
    private mycelialBindGroupA!: GPUBindGroup;
    private mycelialBindGroupB!: GPUBindGroup;
    
    private field: PhaseLatticeField;
    private wasmMemory: WebAssembly.Memory;
    private isPingPongA: boolean = true;
    public offsets: number[] = [];
    private startTime: number;
    private injections = new Map<number, PendingInjection>();

    constructor(device: GPUDevice, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.device = device;
        this.field = field;
        this.wasmMemory = memory;
        this.startTime = performance.now();
        
        // deno-lint-ignore no-explicit-any
        (this.device as any).onuncapturederror = ((event: any) => {
            console.error("[O-64 GPU FATAL]", event.error);
            const errDiv = document.getElementById('wgsl-err') || document.createElement('div');
            if (!errDiv.id) {
                errDiv.id = 'wgsl-err';
                errDiv.style.cssText = 'position:fixed;top:50px;left:10px;color:#ff3333;z-index:9999;font-size:12px;background:rgba(0,0,0,0.9);padding:10px;font-family:monospace;max-width:80vw;';
                document.body.appendChild(errDiv);
            }
            errDiv.innerText += `[O-64 GPU]\n${event.error.message}\n\n`;
            // deno-lint-ignore no-explicit-any
        }) as any;
    }

    // deno-lint-ignore require-await
    async init() {
        const numCells = this.field.cell_count();
        const S_U8 = numCells;
        const S_I16 = numCells * 2;
        const S_U64 = numCells * 8;
        
        let cursor = 0;
        const offTheta = cursor; cursor += S_U8;
        const offOmega = cursor; cursor += S_I16;
        const offAmplitude = cursor; cursor += S_U8;
        const offLock = cursor; cursor += S_U8;
        const offEntanglement = cursor; cursor += S_U8;
        const offPlasmids = cursor; cursor += S_U64;
        
        this.offsets = [offTheta, offOmega, offAmplitude, offLock, offEntanglement, offPlasmids];

        this.bufferA = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.bufferB = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.paramsBuffer = this.device.createBuffer({
            size: 112,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 1024 Mycelial Buckets * 16 bytes per bucket (i32, i32, u32, pad)
        this.mycelialBuffer = this.device.createBuffer({
            size: 16384,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // Seed deterministic WASM state into Buffer A
        const mem = this.wasmMemory.buffer;
        const f = this.field;
        this.device.queue.writeBuffer(this.bufferA, this.offsets[0], new Uint8Array(mem, f.ptr_theta(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[1], new Uint8Array(mem, f.ptr_omega(), numCells * 2));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[2], new Uint8Array(mem, f.ptr_amplitude(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[3], new Uint8Array(mem, f.ptr_lock(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[4], new Uint8Array(mem, f.ptr_entanglement(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[5], new Uint8Array(mem, f.ptr_plasmids(), numCells * 8));
        // Clone into B so atomic updates work on initialized memory
        this.device.queue.writeBuffer(this.bufferB, this.offsets[0], new Uint8Array(mem, f.ptr_theta(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[1], new Uint8Array(mem, f.ptr_omega(), numCells * 2));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[2], new Uint8Array(mem, f.ptr_amplitude(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[3], new Uint8Array(mem, f.ptr_lock(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[4], new Uint8Array(mem, f.ptr_entanglement(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[5], new Uint8Array(mem, f.ptr_plasmids(), numCells * 8));

        const shaderModule = this.device.createShaderModule({ code: computeKuramotoWgsl });
        const mycelialModule = this.device.createShaderModule({ code: computeMycelialWgsl });

        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });

        this.mycelialPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: mycelialModule,
                entryPoint: 'main'
            }
        });

        this.bindGroupA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferA } },
                { binding: 1, resource: { buffer: this.bufferB } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });

        this.bindGroupB = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferB } },
                { binding: 1, resource: { buffer: this.bufferA } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });

        this.mycelialBindGroupA = this.device.createBindGroup({
            layout: this.mycelialPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferA } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });

        this.mycelialBindGroupB = this.device.createBindGroup({
            layout: this.mycelialPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferB } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });
    }

    tick() {
        if (!this.device) return;

        const time = (performance.now() - this.startTime) / 1000.0;
        const uniformBuffer = new ArrayBuffer(72);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        let activeInj: PendingInjection | null = null;
        for (const [idx, inj] of this.injections.entries()) {
            activeInj = inj;
            this.injections.delete(idx);
            break; // Process one injection per frame mathematically
        }

        viewU32[0] = this.field.sectors;
        viewU32[1] = this.field.radial_bins;
        viewU32[2] = this.field.harmonics;
        viewF32[3] = time;
        viewU32[4] = Math.floor(this.offsets[0] / 4);
        viewU32[5] = Math.floor(this.offsets[1] / 4);
        viewU32[6] = Math.floor(this.offsets[2] / 4);
        viewU32[7] = Math.floor(this.offsets[3] / 4);
        viewU32[8] = Math.floor(this.offsets[4] / 4);
        viewU32[9] = Math.floor(this.offsets[5] / 4);
        viewF32[10] = 16.0 / 9.0;
        viewU32[11] = activeInj ? activeInj.idx : 0xFFFFFFFF;
        viewU32[12] = activeInj ? activeInj.hashLow : 0;
        viewU32[13] = activeInj ? activeInj.hashHigh : 0;
        viewU32[14] = activeInj ? activeInj.amp : 0;
        viewU32[15] = activeInj ? activeInj.phase : 0;
        viewU32[16] = activeInj ? activeInj.ent : 0;
        viewU32[17] = activeInj && activeInj.bucket !== undefined ? activeInj.bucket : 0xFFFFFFFF;

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);
        
        // Zero-out the Mycelial buffer natively on the GPU (Zero-cost, zero-GC)
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.clearBuffer(this.mycelialBuffer, 0, 16384);

        const numCells = this.field.cell_count();
        const workgroups = Math.ceil(numCells / 64);
        
        // Pass 0: Mycelial Aggregation (Accumulate Mean-Fields via Atomically)
        const pass0 = commandEncoder.beginComputePass();
        pass0.setPipeline(this.mycelialPipeline);
        pass0.setBindGroup(0, this.isPingPongA ? this.mycelialBindGroupA : this.mycelialBindGroupB);
        pass0.dispatchWorkgroups(workgroups);
        pass0.end();

        // Pass 1: Kuramoto Evolution (Resolve Topological Forces)
        // A fresh compute pass guarantees a hardware memory barrier from Pass 0
        const pass1 = commandEncoder.beginComputePass();
        pass1.setPipeline(this.pipeline);
        pass1.setBindGroup(0, this.isPingPongA ? this.bindGroupA : this.bindGroupB);
        pass1.dispatchWorkgroups(workgroups);
        pass1.end();

        this.device.queue.submit([commandEncoder.finish()]);

        // Flip ping-pong.
        // If we compute reading A, output goes to B. Next flip reads B and outputs to A.
        this.isPingPongA = !this.isPingPongA;
    }

    getActiveBuffer(): GPUBuffer {
        // We just completed a tick, meaning the NEWEST data is in the buffer we WRITTEN to
        // If isPingPongA is now FALSE, we just finished executing A->B, so B is newest data.
        return this.isPingPongA ? this.bufferB : this.bufferA;
    }

    injectPlasmid(index: number, hash: bigint) {
        if (!this.device) return;
        const inj = this.injections.get(index) || { idx: index, hashLow: 0, hashHigh: 0, amp: 200, phase: 0, ent: 128 };
        inj.hashLow = Number(hash & 0xFFFFFFFFn);
        inj.hashHigh = Number(hash >> 32n);
        this.injections.set(index, inj);
    }

    injectPlasmidIntoBucket(bucketId: number, hash: bigint) {
        if (!this.device) return;
        const injId = -100 - bucketId;
        const inj = this.injections.get(injId) || { idx: 0xFFFFFFFF, bucket: bucketId, hashLow: 0, hashHigh: 0, amp: 200, phase: 0, ent: 128 };
        inj.hashLow = Number(hash & 0xFFFFFFFFn);
        inj.hashHigh = Number(hash >> 32n);
        this.injections.set(injId, inj);
    }

    injectEnergy(index: number, phaseShift: number) {
        if (!this.device) return;
        const inj = this.injections.get(index) || { idx: index, hashLow: 0, hashHigh: 0, amp: 0, phase: 0, ent: 0 };
        inj.amp = 255;
        inj.phase = phaseShift;
        inj.ent = 255;
        this.injections.set(index, inj);
    }

    async readMycelialCentroids(): Promise<Float32Array> {
        if (!this.device) return new Float32Array(0);
        
        const size = this.mycelialBuffer.size;
        const stagingBuffer = this.device.createBuffer({
            size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.mycelialBuffer, 0, stagingBuffer, 0, size);
        this.device.queue.submit([commandEncoder.finish()]);

        // Await the hardware transfer from VRAM to System RAM
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyBuffer = stagingBuffer.getMappedRange();
        const f32Data = new Float32Array(copyBuffer.slice(0));
        
        stagingBuffer.unmap();
        // Discard the staging bridge explicitly to free heap bounds
        stagingBuffer.destroy();
        
        return f32Data;
    }
}

```

## `src/lens/phase_replay_view.ts`
```ts
import { phaseDistance, projectCellToCartesian } from "../shared/phase_lattice.ts";
import type { PhaseField } from "../shared/phase_lattice.ts";
import type { PhaseReplayDiffSummary, ReplayCompareMode } from "../replay/phase_replay.ts";

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

interface ReplayRenderMeta {
    tick: number;
    totalTicks: number;
    compareMode: ReplayCompareMode;
    summary: PhaseReplayDiffSummary;
    title: string;
    statusLine: string;
    leftLabel: string;
    rightLabel: string;
}

export class PhaseReplayObserver {
    private canvas: HTMLCanvasElement;
    private context!: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public init(): void {
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("2D canvas not supported");
        }
        this.context = context;
    }

    public render(current: PhaseField, compare: PhaseField | null, meta: ReplayRenderMeta): void {
        if (!this.context) {
            return;
        }

        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) * 0.42;

        ctx.clearRect(0, 0, width, height);

        const bg = ctx.createRadialGradient(cx, cy, maxRadius * 0.04, cx, cy, maxRadius * 1.1);
        bg.addColorStop(0, "rgba(18, 44, 72, 0.24)");
        bg.addColorStop(0.45, "rgba(7, 14, 28, 0.38)");
        bg.addColorStop(1, "rgba(0, 0, 0, 0.96)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        drawRings(ctx, cx, cy, maxRadius, current.shape.radialBins);
        drawDiffField(ctx, current, compare, cx, cy, maxRadius);
        drawEntanglement(ctx, current, cx, cy, maxRadius);
        drawField(ctx, current, compare, cx, cy, maxRadius);
        drawLegend(ctx, meta, width, height);
    }
}

function drawRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxRadius: number,
    radialBins: number,
): void {
    ctx.save();
    ctx.translate(cx, cy);
    for (let ring = 1; ring <= radialBins; ring++) {
        const r = maxRadius * (ring / (radialBins + 1));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(126, 209, 255, ${0.05 + ring * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function drawEntanglement(
    ctx: CanvasRenderingContext2D,
    field: PhaseField,
    cx: number,
    cy: number,
    maxRadius: number,
): void {
    if (field.shape.sectors % 2 !== 0) {
        return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors / 2; sector++) {
                const index = harmonic * field.shape.radialBins * field.shape.sectors + rho * field.shape.sectors + sector;
                const cell = field.cells[index];
                if (cell.entanglement < 120) {
                    continue;
                }

                const antipodeSector = sector + field.shape.sectors / 2;
                const radius = maxRadius * ((rho + 1) / (field.shape.radialBins + 1));
                const baseAngle = (sector / field.shape.sectors) * Math.PI * 2;
                const antiAngle = (antipodeSector / field.shape.sectors) * Math.PI * 2;

                ctx.beginPath();
                ctx.moveTo(Math.cos(baseAngle) * radius, Math.sin(baseAngle) * radius);
                ctx.lineTo(Math.cos(antiAngle) * radius, Math.sin(antiAngle) * radius);
                ctx.strokeStyle = `rgba(90, 243, 229, ${0.04 + cell.entanglement / 900})`;
                ctx.lineWidth = 0.8 + cell.entanglement / 180;
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function drawDiffField(
    ctx: CanvasRenderingContext2D,
    current: PhaseField,
    compare: PhaseField | null,
    cx: number,
    cy: number,
    maxRadius: number,
): void {
    if (!compare) {
        return;
    }

    for (let index = 0; index < current.cells.length; index++) {
        const cell = current.cells[index];
        const previous = compare.cells[index];
        const thetaDelta = phaseDistance(cell.theta, previous.theta) / 128;
        const amplitudeDelta = Math.abs(cell.amplitude - previous.amplitude) / 255;
        const lockDelta = Math.abs(cell.lock - previous.lock) / 255;
        const entanglementDelta = Math.abs(cell.entanglement - previous.entanglement) / 255;
        const delta = Math.max(thetaDelta, amplitudeDelta, lockDelta, entanglementDelta);

        if (delta < 0.03) {
            continue;
        }

        const point = projectCellToCartesian(cell, current.shape, maxRadius / (current.shape.radialBins + 1));
        const x = cx + point.x;
        const y = cy + point.y;
        const radius = 2 + delta * 10;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 148, 64, ${0.12 + delta * 0.55})`;
        ctx.lineWidth = 0.8 + delta * 2.6;
        ctx.stroke();
    }
}

function drawField(
    ctx: CanvasRenderingContext2D,
    current: PhaseField,
    compare: PhaseField | null,
    cx: number,
    cy: number,
    maxRadius: number,
): void {
    for (let index = 0; index < current.cells.length; index++) {
        const cell = current.cells[index];
        const point = projectCellToCartesian(cell, current.shape, maxRadius / (current.shape.radialBins + 1));
        const harmonicOffset = (cell.harmonic - (current.shape.harmonics - 1) / 2) * 3;
        const angle = (cell.sector / current.shape.sectors) * Math.PI * 2;
        const x = cx + Math.cos(angle) * harmonicOffset + point.x;
        const y = cy + Math.sin(angle) * harmonicOffset + point.y;

        const hue = cell.theta / 255;
        const saturation = 0.58 + cell.entanglement / 1024;
        const value = 0.28 + cell.amplitude / 320;
        const [r, g, b] = hsv2rgb(hue, Math.min(1, saturation), Math.min(1, value));
        const alpha = 0.22 + Math.min(0.72, cell.lock / 255 * 0.42 + cell.amplitude / 255 * 0.32);
        const size = 1.25 + cell.amplitude / 108 + cell.entanglement / 240;

        ctx.beginPath();
        ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
        ctx.shadowColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.42)`;
        ctx.shadowBlur = 8 + cell.entanglement / 18;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        if (compare) {
            const previous = compare.cells[index];
            const omegaDelta = Math.abs(cell.omega - previous.omega);
            if (omegaDelta > 0) {
                ctx.beginPath();
                ctx.arc(x, y, size + 1.6, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.04 + Math.min(0.25, omegaDelta / 40)})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
        }
    }

    ctx.shadowBlur = 0;
}

function drawLegend(
    ctx: CanvasRenderingContext2D,
    meta: ReplayRenderMeta,
    width: number,
    height: number,
): void {
    const helperX = width < 720 ? 24 : width - 330;
    const helperY = width < 720 ? 64 : 28;
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = "12px monospace";
    ctx.fillText(`${meta.title} tick ${meta.tick}/${meta.totalTicks}`, 24, 28);
    ctx.fillText(meta.statusLine, 24, 46);
    ctx.fillText(
        `Δcells ${meta.summary.changedCells} | Δamp ${signed(meta.summary.totalAmplitudeDelta)} | Δlock ${signed(meta.summary.totalLockDelta)}`,
        24,
        height - 34,
    );
    ctx.fillText(
        `${meta.leftLabel} ${meta.summary.referenceStructuralSignature.slice(0, 12)} | ${meta.rightLabel} ${meta.summary.wasmStructuralSignature.slice(0, 12)} | θmax ${meta.summary.maxPhaseDistance}`,
        24,
        height - 16,
    );
    ctx.fillText("orange halos = diff magnitude vs comparison frame", helperX, helperY);
}

function signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
}

```

## `src/lens/init.ts`
```ts
/// <reference types="@webgpu/types" />

import lensWgsl from './shaders/lens.wgsl?raw';
import { Field } from "../../omega_core/pkg/omega_core.js";

export class LensObserver {
    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private bindGroup!: GPUBindGroup;
    private fieldBuffer!: GPUBuffer;
    private sab: SharedArrayBuffer | ArrayBuffer | null;
    private wasmField: Field | null = null;
    private wasmMemory: WebAssembly.Memory | null = null;
    public W: number = 256;
    public H: number = 256;
    private offsets: number[] = [];

    constructor(canvas: HTMLCanvasElement, sab: SharedArrayBuffer | ArrayBuffer | null = null) {
        this.canvas = canvas;
        this.sab = sab;
    }

    public setWasmContext(wasmField: Field, memory: WebAssembly.Memory) {
        this.wasmField = wasmField;
        this.wasmMemory = memory;
    }

    async init() {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error("WebGPU not supported");
        
        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        
        // --- Ontology 19: Dynamic Hardware Allocation ---
        const maxBinding = adapter.limits.maxStorageBufferBindingSize;
        // A single cell takes 19 bytes in our SoA struct
        const maxCells = Math.floor(maxBinding / 19);
        // Fallback to legacy stable size, but allow optional URL parameter override if we wanted
        this.W = 256; 
        this.H = 256;
        const numCells = this.W * this.H;
        
        const S_I16 = numCells * 2; // bytes
        const S_U8 = numCells;
        const S_U64 = numCells * 8;
        
        // Compute precise unaligned 1D linear buffer accumulation offsets
        let cursor = 0;
        const offX = cursor; cursor += S_I16;
        const offY = cursor; cursor += S_I16;
        const offThetaNow = cursor; cursor += S_U8;
        const offThetaF1 = cursor; cursor += S_U8;
        const offThetaF2 = cursor; cursor += S_U8;
        const offThetaF3 = cursor; cursor += S_U8;
        const offOmega = cursor; cursor += S_U8;
        const offEnergy = cursor; cursor += S_U8;
        const offPlasmids = cursor; cursor += S_U64;
        const offHebbian = cursor; cursor += S_U8;
        
        this.offsets = [offX, offY, offThetaNow, offThetaF1, offThetaF2, offThetaF3, offOmega, offEnergy, offPlasmids, offHebbian];
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        // Contiguous dynamic scaling
        this.fieldBuffer = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const paramsBuffer = this.device.createBuffer({
            size: 40, // 2 dimensions + 8 offsets = 10 x u32 (40 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const uniformData = new Uint32Array([
            this.W, this.H, 
            offThetaNow/4, offEnergy/4, offPlasmids/4, offHebbian/4,
            0, 0, 0, 0 // padding for 16-byte WGSL alignment rules
        ]);
        this.device.queue.writeBuffer(paramsBuffer, 0, uniformData);

        const shaderModule = this.device.createShaderModule({
            code: lensWgsl 
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.fieldBuffer } },
                { binding: 1, resource: { buffer: paramsBuffer } }
            ]
        });
    }

    render() {
        if (!this.device || !this.context) return;

        if (this.wasmField && this.wasmMemory) {
            const numCells = this.W * this.H;
            const S_I16 = numCells * 2;
            const S_U8 = numCells;
            const S_U64 = numCells * 8;
            const mem = this.wasmMemory.buffer;
            const f = this.wasmField;
            const off = this.offsets;
            
            this.device.queue.writeBuffer(this.fieldBuffer, off[0], new Uint8Array(mem, f.ptr_x(), S_I16));
            this.device.queue.writeBuffer(this.fieldBuffer, off[1], new Uint8Array(mem, f.ptr_y(), S_I16));
            this.device.queue.writeBuffer(this.fieldBuffer, off[2], new Uint8Array(mem, f.ptr_theta_now(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[3], new Uint8Array(mem, f.ptr_theta_f1(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[4], new Uint8Array(mem, f.ptr_theta_f2(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[5], new Uint8Array(mem, f.ptr_theta_f3(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[6], new Uint8Array(mem, f.ptr_omega(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[7], new Uint8Array(mem, f.ptr_energy(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[8], new Uint8Array(mem, f.ptr_plasmids(), S_U64));
            this.device.queue.writeBuffer(this.fieldBuffer, off[9], new Uint8Array(mem, f.ptr_hebbian_locks(), S_U8));
        } else if (this.sab) {
            this.device.queue.writeBuffer(this.fieldBuffer, 0, new Uint8Array(this.sab as ArrayBuffer));
        }

        const commandEncoder = this.device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                storeOp: 'store'
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(4); // full screen quad
        pass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}

```

## `src/lens/input.ts`
```ts
/// <reference types="@webgpu/types" />

import { apply_perturbation, Field } from "../../omega_core/pkg/omega_core.js";

export class PerturbationInjector {
    private canvas: HTMLCanvasElement;
    private field: Field;

    constructor(canvas: HTMLCanvasElement, field: Field) {
        this.canvas = canvas;
        this.field = field;
    }

    public attach() {
        this.canvas.addEventListener('pointerdown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Translate absolute pointers to grid coordinates
            const x = Math.floor((e.clientX - rect.left) / rect.width * 256);
            const y = Math.floor((e.clientY - rect.top) / rect.height * 256);
            
            // Generate raw kinetic disturbance intent without specific semantic plasmid
            this.inject(x, y, 500, 10, 128, new Uint8Array(8));
        });
    }

    public inject(x: number, y: number, energy: number, radius: number, phaseShift: number, plasmid: Uint8Array) {
        // Cast the 8-byte plasmid into two u32 parts for WASM binding
        const p_lo = (plasmid[3] << 24) | (plasmid[2] << 16) | (plasmid[1] << 8) | plasmid[0];
        const p_hi = (plasmid[7] << 24) | (plasmid[6] << 16) | (plasmid[5] << 8) | plasmid[4];
        
        apply_perturbation(this.field, x, y, energy, radius, phaseShift, p_lo >>> 0, p_hi >>> 0);
    }
}

```

## `src/lens/phase_input.ts`
```ts
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";
import { PhaseComputeEngine } from "./phase_compute.ts";
import { SovereignOracle } from "../ontology/oracle.ts";

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export class PhasePerturbationInjector {
    private canvas: HTMLCanvasElement;
    private field: PhaseLatticeField;
    private memory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private oracle?: SovereignOracle;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine, oracle?: SovereignOracle) {
        this.canvas = canvas;
        this.field = field;
        this.memory = memory;
        this.engine = engine;
        this.oracle = oracle;
    }

    public rebind(field: PhaseLatticeField, engine?: PhaseComputeEngine) {
        this.field = field;
        this.engine = engine;
    }

    public attach() {
        this.canvas.addEventListener("pointerdown", (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = event.clientX - cx;
            const dy = event.clientY - cy;
            const angle = Math.atan2(dy, dx);
            const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
            const sector = Math.floor(normalizedAngle / (Math.PI * 2) * this.field.sectors);
            const maxRadius = Math.min(rect.width, rect.height) * 0.42;
            const distance = Math.hypot(dx, dy);
            const rho = Math.floor(clamp(distance / Math.max(1, maxRadius), 0, 0.999) * this.field.radial_bins);

            this.inject(
                sector,
                rho,
                160,
                1,
                Math.floor(normalizedAngle / (Math.PI * 2) * 255),
                new Uint8Array([0, 0, 0, 0, 0, 0, 180, 0]),
            );
        });
    }

    public inject(
        x: number,
        y: number,
        energy: number,
        radius: number,
        phaseShift: number,
        plasmid: Uint8Array,
    ) {
        const sector = ((x % this.field.sectors) + this.field.sectors) % this.field.sectors;
        const rho = ((y % this.field.radial_bins) + this.field.radial_bins) % this.field.radial_bins;
        const harmonic = (plasmid[0] ^ plasmid[7]) % this.field.harmonics;
        const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;

        if (this.engine) {
            // O-23 Native WebGPU staging buffer injection
            this.engine.injectEnergy(idx, phaseShift);
            if (this.oracle) {
                // Request a semantic payload from LLM synchronously to the user click!
                this.oracle.request(idx);
            }
            return;
        }

        // Legacy WASM buffer mutation
        const theta = new Uint8Array(this.memory.buffer, this.field.ptr_theta(), this.field.cell_count());
        const omega = new Int16Array(this.memory.buffer, this.field.ptr_omega(), this.field.cell_count());
        const amplitude = new Uint8Array(this.memory.buffer, this.field.ptr_amplitude(), this.field.cell_count());
        const lock = new Uint8Array(this.memory.buffer, this.field.ptr_lock(), this.field.cell_count());
        const entanglement = new Uint8Array(this.memory.buffer, this.field.ptr_entanglement(), this.field.cell_count());

        theta[idx] = (theta[idx] + phaseShift) & 0xFF;
        amplitude[idx] = clamp(amplitude[idx] + Math.floor(energy / Math.max(1, radius + 1)), 0, 255);
        omega[idx] = clamp(omega[idx] + ((plasmid[1] % 5) - 2), -16, 16);
        lock[idx] = clamp(lock[idx] + 12, 0, 255);
        entanglement[idx] = Math.max(entanglement[idx], plasmid[6]);
    }
}

```

## `src/lens/evolution.ts`
```ts
/// <reference types="@webgpu/types" />

export class EvolutionPipeline {
    private device: GPUDevice;
    
    private simulatePipeline!: GPUComputePipeline;
    private reducePipeline!: GPUComputePipeline;
    private applyPipeline!: GPUComputePipeline;
    
    private fieldBuffer: GPUBuffer;
    private mutationsBuffer: GPUBuffer;
    private scoresBuffer: GPUBuffer;
    private reduceBuffer: GPUBuffer;

    constructor(device: GPUDevice, fieldBuffer: GPUBuffer) {
        this.device = device;
        this.fieldBuffer = fieldBuffer;
        
        // Setup internal tournament memory space
        this.mutationsBuffer = this.device.createBuffer({
            size: 1024 * 8, // 1024 candidate mutations (phaseShift: i32, amplitude: i32)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        
        this.scoresBuffer = this.device.createBuffer({
            size: 1024 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });

        this.reduceBuffer = this.device.createBuffer({
            size: 8, // Final best Pair {score, index}
            usage: GPUBufferUsage.STORAGE
        });
    }

    async init() {
        const simulateShader = this.device.createShaderModule({ 
            code: await fetch('/shaders/compute_simulate.wgsl').then(r => r.text()) 
        });
        const reduceShader = this.device.createShaderModule({ 
            code: await fetch('/shaders/compute_reduce.wgsl').then(r => r.text()) 
        });
        const applyShader = this.device.createShaderModule({ 
            code: await fetch('/shaders/compute_apply.wgsl').then(r => r.text()) 
        });

        this.simulatePipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module: simulateShader, entryPoint: 'main' }});
        this.reducePipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module: reduceShader, entryPoint: 'main' }});
        this.applyPipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module: applyShader, entryPoint: 'main' }});
    }

    tick() {
        const encoder = this.device.createCommandEncoder();
        
        // Compute A: Superposition Variance Generation (1024 unique variant realities)
        const simPass = encoder.beginComputePass();
        simPass.setPipeline(this.simulatePipeline);
        // bind(0): fieldBuffer, bind(1): lut, bind(2): mutationsBuffer, bind(3): scoresBuffer
        simPass.dispatchWorkgroups(1024); 
        simPass.end();

        // Compute B: Parallel Log(N) Reduction (O(1) CPU time)
        const reducePass = encoder.beginComputePass();
        reducePass.setPipeline(this.reducePipeline);
        // bind(0): scoresBuffer, bind(1): reduceBuffer
        reducePass.dispatchWorkgroups(1); 
        reducePass.end();

        // Compute C: Deterministic Physical Matrix Collapse
        const applyPass = encoder.beginComputePass();
        applyPass.setPipeline(this.applyPipeline);
        // bind(0): reduceBuffer, bind(1): mutationsBuffer, bind(2): fieldBuffer, bind(3): lut
        // Evolving the raw spatial elements irreversibly
        applyPass.dispatchWorkgroups(Math.ceil((256 * 256) / 64)); 
        applyPass.end();

        this.device.queue.submit([encoder.finish()]);
    }
}

```

## `src/lens/shaders/compute_mycelial.wgsl`
```wgsl
struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(0) var<storage, read> buffer_a: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket, 1024>;

struct Params {
    sectors: u32,
    radial_bins: u32,
    harmonics: u32,
    time: f32,
    off_theta: u32,
    off_omega: u32,
    off_amplitude: u32,
    off_lock: u32,
    off_ent: u32,
    off_plasmid: u32,
    aspect: f32,
    inj_idx: u32,
    inj_hash_low: u32,
    inj_hash_high: u32,
    inj_amp: u32,
    inj_phase: u32,
    inj_ent: u32,
    pad1: u32,
}

const SCALE: f32 = 1000.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let total_cells = params.sectors * params.radial_bins * params.harmonics;
    if (idx >= total_cells) {
        return;
    }

    // Read 64-bit plasmid (2x u32)
    let p_idx = params.off_plasmid + idx * 2u;
    let plasmid_low = buffer_a[p_idx];
    let plasmid_high = buffer_a[p_idx + 1u];

    // If plasmid is non-zero, this cell belongs to a Semantic Mycelial Thread
    if (plasmid_low != 0u || plasmid_high != 0u) {
        // Simple hash to find the bucket [0..1023]
        // FNV-1a mixes are already well-distributed, just XOR and modulo
        let hash = (plasmid_low ^ plasmid_high);
        let bucket_idx = hash & 1023u; // Modulo 1024

        // Read physical phase
        let t_idx = params.off_theta + idx / 4u;
        let t_word = buffer_a[t_idx];
        let t_shift = (idx % 4u) * 8u;
        let theta_u8 = (t_word >> t_shift) & 0xFFu;
        let theta = f32(theta_u8) / 255.0 * 6.283185307;

        // Convert to Cartesian X/Y scaled to i32 for atomic adds
        let x_scaled = i32(cos(theta) * SCALE);
        let y_scaled = i32(sin(theta) * SCALE);

        // Atomically accumulate to the global bucket
        atomicAdd(&mycelial_centroids[bucket_idx].x_sum, x_scaled);
        atomicAdd(&mycelial_centroids[bucket_idx].y_sum, y_scaled);
        atomicAdd(&mycelial_centroids[bucket_idx].count, 1u);
    }
}

```

## `src/lens/shaders/compute_simulate.wgsl`
```wgsl
struct Mutation {
  phaseShift: i32,
  amplitude: i32,
};

@group(0) @binding(0) var<storage, read> field: array<i32>; 
@group(0) @binding(1) var<storage, read> lut: array<i32>;
@group(0) @binding(2) var<storage, read> mutations: array<Mutation>;
@group(0) @binding(3) var<storage, read_write> scores: array<atomic<i32>>;

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>
) {
  // Candidate branch matching
  let candidate = wid.x;
  let idx = gid.x;

  let m = mutations[candidate];

  // Map SoA components via static stride offset
  let cell_base = idx * 3u;
  let phase_raw = field[cell_base];
  let energy_raw = field[cell_base + 1u];

  let p_mut = (u32(phase_raw) + u32(m.phaseShift)) & 255u;
  let val = lut[p_mut] + m.amplitude;
  
  // Compute hypothetical next reality state
  let next = energy_raw + val;
  
  // Calculate relative topology semantic drift
  let metric = abs(next);
  
  atomicAdd(&scores[candidate], metric);
}

```

## `src/lens/shaders/compute_apply.wgsl`
```wgsl
struct Mutation {
  phaseShift: i32,
  amplitude: i32,
};

struct Best {
  score: i32,
  index: i32,
};

@group(0) @binding(0) var<storage, read> best: Best;
@group(0) @binding(1) var<storage, read> mutations: array<Mutation>;
@group(0) @binding(2) var<storage, read_write> field: array<i32>;
@group(0) @binding(3) var<storage, read> lut: array<i32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let winner = best.index;
  
  let m = mutations[winner];

  let cell_base = idx * 3u;
  let p = field[cell_base];
  let f_energy = field[cell_base + 1u];

  let p_mut = (u32(p) + u32(m.phaseShift)) & 255u;
  let val = lut[p_mut] + m.amplitude;

  // The optimal physical evolution state overwrites the shared array bounds seamlessly
  field[cell_base + 1u] = f_energy + val;
}

```

## `src/lens/shaders/lens.wgsl`
```wgsl
struct Params {
  width: u32,
  height: u32,
  off_theta: u32,
  off_energy: u32,
  off_plasmids: u32,
  off_hebbian: u32,
};

@group(0) @binding(0) var<storage, read> field: array<u32>; 
@group(0) @binding(1) var<uniform> params: Params;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

fn extract_byte(u32_val: u32, byte_idx: u32) -> f32 {
    let shift = byte_idx * 8u;
    let b = (u32_val >> shift) & 0xFFu;
    return f32(b) / 255.0;
}

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
  let c = v * s;
  let h_prime = fract(h) * 6.0;
  let x = c * (1.0 - abs(fract(h_prime / 2.0) * 2.0 - 1.0));
  let m = v - c;

  var rgb = vec3<f32>(0.0, 0.0, 0.0);
  if (h_prime < 1.0) { rgb = vec3<f32>(c, x, 0.0); } 
  else if (h_prime < 2.0) { rgb = vec3<f32>(x, c, 0.0); } 
  else if (h_prime < 3.0) { rgb = vec3<f32>(0.0, c, x); } 
  else if (h_prime < 4.0) { rgb = vec3<f32>(0.0, x, c); } 
  else if (h_prime < 5.0) { rgb = vec3<f32>(x, 0.0, c); } 
  else { rgb = vec3<f32>(c, 0.0, x); }

  return rgb + vec3<f32>(m);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let x = u32(pos.x);
  let y = u32(pos.y);
  let cell_idx = y * params.width + x; 
  
  // Extract theta_now
  let t_u32_idx = params.off_theta + (cell_idx / 4u);
  let byte_offset = cell_idx % 4u;
  let theta_val = extract_byte(field[t_u32_idx], byte_offset);

  // Extract energy
  let e_u32_idx = params.off_energy + (cell_idx / 4u);
  let e_val = extract_byte(field[e_u32_idx], byte_offset);
  
  // Extract plasmids
  // A plasmid is u64 (8 bytes), stored as two consecutive u32s. 
  let p_u32_idx = params.off_plasmids + (cell_idx * 2u);
  let plasmid_low = field[p_u32_idx];
  let plasmid_high = field[p_u32_idx + 1u];

  // Base aesthetic from mathematical phase and kinetic energy
  let hue = fract(theta_val + 0.5);
  let value = pow(e_val, 0.7);
  var base_color = hsv2rgb(hue, 1.0, value);

  // --- Ontology 13 WebGPU Semantic Coloring ---
  // If a Plasmid Attractor exists (High 32-bits for Oracle Intent, Low 32-bits for Organic)
  if (plasmid_low != 0u || plasmid_high != 0u) {
      let signature = plasmid_low ^ plasmid_high;
      let p_hue = f32(signature & 0xFFu) / 255.0;
      let p_sat = 0.6 + (f32((signature >> 8u) & 0xFFu) / 637.5);
      let p_val = 0.8 + (f32((signature >> 16u) & 0xFFu) / 1275.0);
      
      let p_color = hsv2rgb(p_hue, p_sat, p_val);
      
      // Semantic LLM Intents overwrite the reality completely (0.95), Organic is a soft overlay (0.75)
      var intensity = 0.75;
      if (plasmid_high != 0u) {
          intensity = 0.98;
      }
      
      base_color = mix(base_color, p_color, intensity);
  }

  // Energy pulse
  let glow = smoothstep(0.7, 1.0, e_val);
  let final_color = base_color + vec3<f32>(glow * 0.4);

  return vec4<f32>(final_color, 1.0);
}

```

## `src/lens/shaders/phase_lens.wgsl`
```wgsl
struct Params {
  sectors: u32,
  radial_bins: u32,
  harmonics: u32,
  time: f32,
  off_theta: u32,
  off_omega: u32,
  off_amplitude: u32,
  off_lock: u32,
  off_entanglement: u32,
  off_plasmids: u32,
  aspect_ratio: f32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> field: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) glow: f32,
};

fn extract_byte(u32_val: u32, byte_idx: u32) -> f32 {
    let shift = byte_idx * 8u;
    let b = (u32_val >> shift) & 0xFFu;
    return f32(b) / 255.0;
}

fn get_byte(base_offset: u32, idx: u32, byte_offset: u32) -> f32 {
    return extract_byte(field[base_offset + (idx / 4u)], byte_offset);
}

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
  let c = v * s;
  let h_prime = fract(h) * 6.0;
  let x = c * (1.0 - abs(fract(h_prime / 2.0) * 2.0 - 1.0));
  let m = v - c;

  var rgb = vec3<f32>(0.0, 0.0, 0.0);
  if (h_prime < 1.0) { rgb = vec3<f32>(c, x, 0.0); } 
  else if (h_prime < 2.0) { rgb = vec3<f32>(x, c, 0.0); } 
  else if (h_prime < 3.0) { rgb = vec3<f32>(0.0, c, x); } 
  else if (h_prime < 4.0) { rgb = vec3<f32>(0.0, x, c); } 
  else if (h_prime < 5.0) { rgb = vec3<f32>(x, 0.0, c); } 
  else { rgb = vec3<f32>(c, 0.0, x); }

  return rgb + vec3<f32>(m);
}

fn look_at(eye: vec3<f32>, focal_point: vec3<f32>, up: vec3<f32>) -> mat4x4<f32> {
    let z = normalize(eye - focal_point);
    let x = normalize(cross(up, z));
    let y = cross(z, x);
    return mat4x4<f32>(
        vec4<f32>(x.x, y.x, z.x, 0.0),
        vec4<f32>(x.y, y.y, z.y, 0.0),
        vec4<f32>(x.z, y.z, z.z, 0.0),
        vec4<f32>(-dot(x, eye), -dot(y, eye), -dot(z, eye), 1.0)
    );
}

fn perspective(fov: f32, aspect: f32, near: f32, far: f32) -> mat4x4<f32> {
    let f = 1.0 / tan(fov * 0.5);
    return mat4x4<f32>(
        vec4<f32>(f / aspect, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, f, 0.0, 0.0),
        vec4<f32>(0.0, 0.0, -far / (far - near), -1.0),
        vec4<f32>(0.0, 0.0, -(near * far) / (far - near), 0.0)
    );
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) idx: u32) -> VertexOutput {
  let harmonic = idx / (params.radial_bins * params.sectors);
  let rem = idx % (params.radial_bins * params.sectors);
  let rho = rem / params.sectors;
  let sector = rem % params.sectors;

  // Extract memory buffers
  let byte_offset = idx % 4u;

  let theta = get_byte(params.off_theta, idx, byte_offset);
  let amplitude = get_byte(params.off_amplitude, idx, byte_offset);
  let entanglement = get_byte(params.off_entanglement, idx, byte_offset);
  let lock = get_byte(params.off_lock, idx, byte_offset);

  // Plasmids are 8 bytes (2x u32)
  let p_u32_idx = params.off_plasmids + (idx * 2u);
  let plasmid_low = field[p_u32_idx];
  let plasmid_high = field[p_u32_idx + 1u];

  let angle = f32(sector) / f32(params.sectors) * 6.2831853;
  let radius_t = f32(rho + 1u) / f32(params.radial_bins + 1u);
  let major_radius = 2.8 * radius_t;
  let z = (f32(harmonic) - f32(params.harmonics - 1u) * 0.5) * 0.6;

  // Slight wobble based on time and entanglement to simulate wave medium
  let wobble_z = sin(params.time * 2.0 + angle * 4.0 + radius_t * 8.0) * 0.05 * entanglement;
  let base_pos = vec3<f32>(cos(angle) * major_radius, sin(angle) * major_radius, z + wobble_z);

  // Quad Billboard
  let quad = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );

  let cam_radius = 5.5;
  let cam_x = cos(params.time * 0.15) * cam_radius;
  let cam_y = sin(params.time * 0.15) * cam_radius;
  let cam_z = 3.5 + sin(params.time * 0.08) * 1.5;
  
  let view = look_at(vec3<f32>(cam_x, cam_y, cam_z), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 1.0));
  let proj = perspective(0.785398, params.aspect_ratio, 0.1, 100.0);
  let view_proj = proj * view;

  let right = vec3<f32>(view[0][0], view[1][0], view[2][0]);
  let up = vec3<f32>(view[0][1], view[1][1], view[2][1]);
  
  let particle_size = 0.04 + amplitude * 0.12 + entanglement * 0.22;
  let quad_pos = base_pos + (right * quad[vi].x + up * quad[vi].y) * particle_size;

  var out: VertexOutput;
  out.position = view_proj * vec4<f32>(quad_pos, 1.0);
  out.uv = quad[vi];

  // Visuals
  let hue = fract(theta + 0.5);
  let sat = 0.6 + entanglement;
  let val = 0.3 + amplitude * 0.7;
  var base_color = hsv2rgb(hue, min(1.0, sat), min(1.0, val));

  // Semantic Plasmid Overlay
  if (plasmid_low != 0u || plasmid_high != 0u) {
      let signature = plasmid_low ^ plasmid_high;
      let p_hue = f32(signature & 0xFFu) / 255.0;
      let p_sat = 0.6 + (f32((signature >> 8u) & 0xFFu) / 637.5);
      let p_color = hsv2rgb(p_hue, min(1.0, p_sat), 1.0);
      base_color = mix(base_color, p_color, 0.85);
  }

  out.color = base_color;
  out.glow = 0.25 + min(0.75, lock * 0.5 + amplitude * 0.5);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Circular particle
  let dist = length(in.uv);
  if (dist > 1.0) {
    discard;
  }

  let alpha = (1.0 - smoothstep(0.5, 1.0, dist)) * in.glow;
  return vec4<f32>(in.color, alpha);
}

```

## `src/lens/shaders/compute_kuramoto.wgsl`
```wgsl
// O-23 Native Metal Kuramoto Physics Compute Shader

struct Params {
  sectors: u32,
  radial_bins: u32,
  harmonics: u32,
  time: f32,
  off_theta: u32,
  off_omega: u32,
  off_amplitude: u32,
  off_lock: u32,
  off_entanglement: u32,
  off_plasmids: u32,
  aspect_ratio: f32,
  inj_idx: u32,
  inj_hash_low: u32,
  inj_hash_high: u32,
  inj_amp: u32,
  inj_phase: u32,
  inj_ent: u32,
  inj_bucket: u32,
};

@group(0) @binding(0) var<storage, read> field_in: array<u32>;
@group(0) @binding(1) var<storage, read_write> field_out: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: Params;

struct MycelialBucket {
    x_sum: atomic<i32>,
    y_sum: atomic<i32>,
    count: atomic<u32>,
    padding: u32,
}

@group(0) @binding(3) var<storage, read_write> mycelial_centroids: array<MycelialBucket, 1024>;

// Memory unpackers
fn ext_byte(u32_val: u32, byte_idx: u32) -> u32 {
    return (u32_val >> (byte_idx * 8u)) & 0xFFu;
}
fn get_byte(base_offset: u32, idx: u32) -> u32 {
    return ext_byte(field_in[base_offset + (idx / 4u)], idx % 4u);
}
fn set_byte(base_offset: u32, idx: u32, val: u32) {
    let shift = (idx % 4u) * 8u;
    let mask = 0xFFu << shift;
    let val_shifted = (val & 0xFFu) << shift;
    let u32_idx = base_offset + (idx / 4u);
    atomicAnd(&field_out[u32_idx], ~mask);
    atomicOr(&field_out[u32_idx], val_shifted);
}

// i16 packing
fn get_i16(base_offset: u32, idx: u32) -> i32 {
    let arr_idx = base_offset + (idx / 2u);
    let u32_val = field_in[arr_idx];
    let shift = (idx % 2u) * 16u;
    let u16_val = (u32_val >> shift) & 0xFFFFu;
    if ((u16_val & 0x8000u) != 0u) {
        return i32(u16_val) - 65536;
    }
    return i32(u16_val);
}
fn set_i16(base_offset: u32, idx: u32, val: i32) {
    let shift = (idx % 2u) * 16u;
    let mask = 0xFFFFu << shift;
    let val_shifted = (u32(val) & 0xFFFFu) << shift;
    let u32_idx = base_offset + (idx / 2u);
    atomicAnd(&field_out[u32_idx], ~mask);
    atomicOr(&field_out[u32_idx], val_shifted);
}

fn wrap_index(val: i32, modulo: i32) -> u32 {
    let rem = val % modulo;
    if (rem < 0) {
        return u32(rem + modulo);
    }
    return u32(rem);
}

fn get_idx(sector: u32, rho: u32, harmonic: u32) -> u32 {
    return harmonic * params.radial_bins * params.sectors + rho * params.sectors + sector;
}

fn phase_radians(from_theta: u32, to_theta: u32) -> f32 {
    let diff = (i32(to_theta) - i32(from_theta)) % 256;
    var raw = diff;
    if (raw < 0) { raw = raw + 256; }
    if (raw > 128) { raw = raw - 256; }
    return f32(raw) * 6.2831853 / 256.0;
}

fn phase_sin_sum(p_from: u32, p_to: u32, weight: f32) -> f32 { return sin(phase_radians(p_from, p_to)) * weight; }
fn phase_cos_sum(p_from: u32, p_to: u32, weight: f32) -> f32 { return cos(phase_radians(p_from, p_to)) * weight; }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let total_cells = params.sectors * params.radial_bins * params.harmonics;
    let idx = global_id.x;
    if (idx >= total_cells) { return; }

    // Recover multidimensional address
    let sector = idx % params.sectors;
    let tmp = idx / params.sectors;
    let rho = tmp % params.radial_bins;
    let harmonic = tmp / params.radial_bins;

    // Load Cell State from field_in
    let theta = get_byte(params.off_theta, idx);
    let omega = get_i16(params.off_omega, idx);
    let amplitude = i32(get_byte(params.off_amplitude, idx));
    let lock = i32(get_byte(params.off_lock, idx));
    let entanglement = get_byte(params.off_entanglement, idx);

    // Neighborhood Phase Lookups
    let left_sec = wrap_index(i32(sector) - 1, i32(params.sectors));
    let right_sec = wrap_index(i32(sector) + 1, i32(params.sectors));
    let inner_rho = max(0u, rho - 1u);
    let outer_rho = min(params.radial_bins - 1u, rho + 1u);
    let harm_peer = wrap_index(i32(harmonic) + 1, i32(params.harmonics));

    let t_left = get_byte(params.off_theta, get_idx(left_sec, rho, harmonic));
    let t_right = get_byte(params.off_theta, get_idx(right_sec, rho, harmonic));
    let t_inner = get_byte(params.off_theta, get_idx(sector, inner_rho, harmonic));
    let t_outer = get_byte(params.off_theta, get_idx(sector, outer_rho, harmonic));
    let t_harm = get_byte(params.off_theta, get_idx(sector, rho, harm_peer));

    // Kuramoto Delta sums
    var kuramoto = phase_sin_sum(theta, t_left, 1.0) +
                   phase_sin_sum(theta, t_right, 1.0) +
                   phase_sin_sum(theta, t_inner, 1.0) +
                   phase_sin_sum(theta, t_outer, 1.0) +
                   phase_sin_sum(theta, t_harm, 0.5);

    var coherence = phase_cos_sum(theta, t_left, 1.0) +
                    phase_cos_sum(theta, t_right, 1.0) +
                    phase_cos_sum(theta, t_inner, 1.0) +
                    phase_cos_sum(theta, t_outer, 1.0) +
                    phase_cos_sum(theta, t_harm, 0.5);

    // Antipode Coupling
    var next_ent = i32(entanglement);
    if (params.sectors % 2u == 0u) {
        let antipode_sec = (sector + params.sectors / 2u) % params.sectors;
        let t_anti = get_byte(params.off_theta, get_idx(antipode_sec, rho, harmonic));
        let weight = (f32(entanglement) / 255.0) * 0.35;
        kuramoto += phase_sin_sum(theta, t_anti, weight);
        coherence += phase_cos_sum(theta, t_anti, weight);

        let align = cos(phase_radians(theta, t_anti));
        if (align > 0.92 && amplitude > 96) {
            next_ent += 8;
        } else {
            next_ent -= 3;
        }
        set_byte(params.off_entanglement, idx, u32(clamp(next_ent, 0, 255)));
    } else {
        set_byte(params.off_entanglement, idx, entanglement); // Carry over
    }

    // O-24: Transdimensional Mycelial Lattice Topology
    let p_u32_idx = params.off_plasmids + (idx * 2u);
    let plasmid_low = field_in[p_u32_idx];
    let plasmid_high = field_in[p_u32_idx + 1u];

    if (plasmid_low != 0u || plasmid_high != 0u) {
        // Find bucket from FNV-1a structural hash
        let hash = (plasmid_low ^ plasmid_high);
        let bucket_idx = hash & 1023u;

        let m_count = atomicLoad(&mycelial_centroids[bucket_idx].count);
        // Only trigger non-local pull if more than 1 node shares this exact LLM Semantic Intent
        if (m_count > 1u) {
            let m_x = f32(atomicLoad(&mycelial_centroids[bucket_idx].x_sum));
            let m_y = f32(atomicLoad(&mycelial_centroids[bucket_idx].y_sum));

            // Cartesian recovery back to Radians
            var centroid_theta_rad = atan2(m_y, m_x);
            if (centroid_theta_rad < 0.0) {
                centroid_theta_rad += 6.283185307;
            }
            
            // Map back to 0-255 u8 Phase integer
            let centroid = u32(centroid_theta_rad * 255.0 / 6.283185307) % 256u;

            // Apply a Massive K=4.0 structural pull toward the specific Mycelial thought group
            let mycelial_pull = phase_sin_sum(theta, centroid, 4.0);
            kuramoto += mycelial_pull;
            coherence += phase_cos_sum(theta, centroid, 4.0);
        }
    }

    // Kinematic Updates
    let omega_delta = i32(round(kuramoto));
    let next_omega = clamp(omega + omega_delta, -16, 16);
    var next_theta = u32(wrap_index(i32(theta) + next_omega, 256));

    var amp_delta = i32(round(coherence * 6.0)) - (lock / 64);
    
    // O-33: Resonance Economics Subsidy
    // If the von Neumann neighborhood is nearly mathematically identical (R > 0.93)
    if (coherence > 4.2) {
        amp_delta += 2; // Inject metabolic heat back into the biological grid
    }

    let lock_delta = select(-4, 8, coherence >= 3.0);

    var next_amp = clamp(amplitude + amp_delta, 0, 255);
    var next_lock = clamp(lock + lock_delta, 0, 255);
    var target_ent = u32(clamp(next_ent, 0, 255));
    
    // Evaluate O-22/O-29 Explicit Intent Injection via Uniform Params
    var receives_injection = false;
    if (params.inj_idx == idx && params.inj_amp > 0u) {
        receives_injection = true;
    } else if (params.inj_bucket != 0xFFFFFFFFu && params.inj_amp > 0u) {
        if (plasmid_low != 0u || plasmid_high != 0u) {
            let hash = (plasmid_low ^ plasmid_high);
            if ((hash & 1023u) == params.inj_bucket) {
                receives_injection = true;
            }
        }
    }

    if (receives_injection) {
        next_amp = i32(params.inj_amp);
        next_theta = params.inj_phase;
        target_ent = params.inj_ent;
        next_lock = 0; // Break kinematic lock to enforce adoption
        
        // Since p_u32_idx is defined in the Mycelial Block, let's redeclare locally to avoid scope errors
        let target_p_idx = params.off_plasmids + (idx * 2u);
        atomicAnd(&field_out[target_p_idx], 0u);
        atomicOr(&field_out[target_p_idx], params.inj_hash_low);
        atomicAnd(&field_out[target_p_idx + 1u], 0u);
        atomicOr(&field_out[target_p_idx + 1u], params.inj_hash_high);
    } else {
        // Carry over existing plasmids if no injection overrides them
        let target_p_idx = params.off_plasmids + (idx * 2u);
        atomicOr(&field_out[target_p_idx], field_in[target_p_idx]);
        atomicOr(&field_out[target_p_idx + 1u], field_in[target_p_idx + 1u]);
    }

    set_byte(params.off_theta, idx, next_theta);
    set_i16(params.off_omega, idx, next_omega);
    set_byte(params.off_amplitude, idx, u32(next_amp));
    set_byte(params.off_lock, idx, u32(next_lock));
    if (params.sectors % 2u == 0u || (params.inj_idx == idx && params.inj_amp > 0u)) {
        // Write entanglement if we computed antipode or if we got an injection
        set_byte(params.off_entanglement, idx, target_ent);
    }
}

```

## `src/lens/shaders/compute_reduce.wgsl`
```wgsl
struct Pair {
  score: i32,
  index: i32,
};

@group(0) @binding(0) var<storage, read> scores: array<i32>;
@group(0) @binding(1) var<storage, read_write> out: array<Pair>;

var<workgroup> shared_arr: array<Pair, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>
) {
  let i = gid.x;
  shared_arr[lid.x] = Pair(scores[i], i32(i));

  workgroupBarrier();

  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    
    if (lid.x < stride) {
      let a = shared_arr[lid.x];
      let b = shared_arr[lid.x + stride];
      
      // Evolutionary survival selection metric: Global topological Minimum
      if (b.score < a.score) {
        shared_arr[lid.x] = b;
      }
    }
    
    workgroupBarrier();
    stride = stride >> 1u;
  }

  // The local minimum candidate collapses into the root output node
  if (lid.x == 0u) {
    out[wid.x] = shared_arr[0];
  }
}

```

## `src/lens/phase_webgpu.ts`
```ts
/// <reference types="@webgpu/types" />

import phaseLensWgsl from './shaders/phase_lens.wgsl?raw';
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";
import { PhaseComputeEngine } from './phase_compute.ts';

export class PhaseWebGPUObserver {
    private canvas: HTMLCanvasElement;
    private device: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;
    private paramsBuffer!: GPUBuffer;
    private field: PhaseLatticeField;
    private engine: PhaseComputeEngine;
    private startTime: number;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, engine: PhaseComputeEngine, device: GPUDevice) {
        this.canvas = canvas;
        this.field = field;
        this.engine = engine;
        this.device = device;
        this.startTime = performance.now();
    }

    // deno-lint-ignore require-await
    async init() {
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        
        const _numCells = this.field.cell_count();
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        // 112 bytes total structurally
        this.paramsBuffer = this.device.createBuffer({
            size: 112,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const shaderModule = this.device.createShaderModule({
            code: phaseLensWgsl 
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        this.bindGroupA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.engine.bufferA } },
                { binding: 1, resource: { buffer: this.paramsBuffer } }
            ]
        });
        
        this.bindGroupB = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.engine.bufferB } },
                { binding: 1, resource: { buffer: this.paramsBuffer } }
            ]
        });
    }

    render(activeFieldBuffer: GPUBuffer) {
        if (!this.device || !this.context) return;
        
        const activeBindGroup = activeFieldBuffer === this.engine.bufferA ? this.bindGroupA : this.bindGroupB;

        const numCells = this.field.cell_count();

        const time = (performance.now() - this.startTime) / 1000.0;
        const aspect = this.canvas.width / this.canvas.height;

        const uniformBuffer = new ArrayBuffer(48);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        viewU32[0] = this.field.sectors;
        viewU32[1] = this.field.radial_bins;
        viewU32[2] = this.field.harmonics;
        viewF32[3] = time;
        viewU32[4] = Math.floor(this.engine.offsets[0] / 4);
        viewU32[5] = Math.floor(this.engine.offsets[1] / 4);
        viewU32[6] = Math.floor(this.engine.offsets[2] / 4);
        viewU32[7] = Math.floor(this.engine.offsets[3] / 4);
        viewU32[8] = Math.floor(this.engine.offsets[4] / 4);
        viewU32[9] = Math.floor(this.engine.offsets[5] / 4);
        viewF32[10] = aspect;
        viewU32[11] = 0;

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);

        const commandEncoder = this.device.createCommandEncoder();

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.02, g: 0.03, b: 0.06, a: 1 },
                storeOp: 'store'
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, activeBindGroup);
        pass.draw(4, numCells); 
        pass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    extractImageBase64(downscaleSize = 512): string {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = downscaleSize;
        tempCanvas.height = downscaleSize;
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, downscaleSize, downscaleSize);
            // Slice off the "data:image/png;base64," header correctly for direct Ollama ingestion
            const dataUrl = tempCanvas.toDataURL("image/png");
            return dataUrl.substring(dataUrl.indexOf(",") + 1);
        }
        return "";
    }
}

```

## `src/lens/phase_view.ts`
```ts
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

export class PhaseLensObserver {
    private canvas: HTMLCanvasElement;
    private field: PhaseLatticeField;
    private memory: WebAssembly.Memory;
    private context!: CanvasRenderingContext2D;
    private plasmidGroups = new Map<bigint, { count: number, sumX: number, sumY: number }>();

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.canvas = canvas;
        this.field = field;
        this.memory = memory;
    }

    public init() {
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("2D canvas not supported");
        }
        this.context = context;
    }

    public render() {
        if (!this.context) {
            return;
        }

        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) * 0.42;
        const cellCount = this.field.cell_count();

        const theta = new Uint8Array(this.memory.buffer, this.field.ptr_theta(), cellCount);
        const omega = new Int16Array(this.memory.buffer, this.field.ptr_omega(), cellCount);
        const amplitude = new Uint8Array(this.memory.buffer, this.field.ptr_amplitude(), cellCount);
        const lock = new Uint8Array(this.memory.buffer, this.field.ptr_lock(), cellCount);
        const entanglement = new Uint8Array(this.memory.buffer, this.field.ptr_entanglement(), cellCount);
        const plasmids = new BigUint64Array(this.memory.buffer, this.field.ptr_plasmids(), cellCount);

        ctx.clearRect(0, 0, width, height);

        const bg = ctx.createRadialGradient(cx, cy, maxRadius * 0.05, cx, cy, maxRadius);
        bg.addColorStop(0, "rgba(22, 54, 66, 0.25)");
        bg.addColorStop(0.6, "rgba(5, 10, 20, 0.2)");
        bg.addColorStop(1, "rgba(0, 0, 0, 0.95)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(cx, cy);
        for (let ring = 1; ring <= this.field.radial_bins; ring++) {
            const r = maxRadius * (ring / (this.field.radial_bins + 1));
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(120, 220, 255, ${0.06 + ring * 0.01})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();

        if (this.field.sectors % 2 === 0) {
            ctx.save();
            ctx.translate(cx, cy);
            for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
                for (let rho = 0; rho < this.field.radial_bins; rho++) {
                    for (let sector = 0; sector < this.field.sectors / 2; sector++) {
                        const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                        const strength = entanglement[idx];
                        if (strength < 120) {
                            continue;
                        }

                        const antipode = sector + this.field.sectors / 2;
                        const radius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                        const baseAngle = sector / this.field.sectors * Math.PI * 2;
                        const antiAngle = antipode / this.field.sectors * Math.PI * 2;
                        const x1 = Math.cos(baseAngle) * radius;
                        const y1 = Math.sin(baseAngle) * radius;
                        const x2 = Math.cos(antiAngle) * radius;
                        const y2 = Math.sin(antiAngle) * radius;

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = `rgba(120, 255, 244, ${0.06 + strength / 1024})`;
                        ctx.lineWidth = 1 + strength / 180;
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        }

        // O-29: Transdimensional Visual Parity (Plasmid Threads)
        this.plasmidGroups.clear();
        for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
            for (let rho = 0; rho < this.field.radial_bins; rho++) {
                for (let sector = 0; sector < this.field.sectors; sector++) {
                    const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                    const p = plasmids[idx];
                    if (p !== 0n) {
                        const angle = sector / this.field.sectors * Math.PI * 2;
                        const ringRadius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                        const harmonicOffset = (harmonic - (this.field.harmonics - 1) / 2) * 3;
                        const x = Math.cos(angle) * (ringRadius + harmonicOffset);
                        const y = Math.sin(angle) * (ringRadius + harmonicOffset);
                        
                        let group = this.plasmidGroups.get(p);
                        if (!group) {
                            group = { count: 0, sumX: 0, sumY: 0 };
                            this.plasmidGroups.set(p, group);
                        }
                        group.count++;
                        group.sumX += x;
                        group.sumY += y;
                    }
                }
            }
        }

        ctx.save();
        ctx.translate(cx, cy);
        for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
            for (let rho = 0; rho < this.field.radial_bins; rho++) {
                for (let sector = 0; sector < this.field.sectors; sector++) {
                    const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                    const p = plasmids[idx];
                    if (p !== 0n) {
                        const group = this.plasmidGroups.get(p);
                        if (group && group.count > 1) {
                            const angle = sector / this.field.sectors * Math.PI * 2;
                            const ringRadius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                            const harmonicOffset = (harmonic - (this.field.harmonics - 1) / 2) * 3;
                            const x = Math.cos(angle) * (ringRadius + harmonicOffset);
                            const y = Math.sin(angle) * (ringRadius + harmonicOffset);
                            
                            const cX = group.sumX / group.count;
                            const cY = group.sumY / group.count;

                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            ctx.lineTo(cX, cY);
                            // Hash the plasmid into a deterministic hue degree
                            const hashColor = Number(p % 360n);
                            ctx.strokeStyle = `hsla(${hashColor}, 90%, 65%, 0.12)`;
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        }
                    }
                }
            }
        }
        ctx.restore();

        for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
            for (let rho = 0; rho < this.field.radial_bins; rho++) {
                for (let sector = 0; sector < this.field.sectors; sector++) {
                    const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                    const angle = sector / this.field.sectors * Math.PI * 2;
                    const ringRadius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                    const harmonicOffset = (harmonic - (this.field.harmonics - 1) / 2) * 3;
                    const x = cx + Math.cos(angle) * (ringRadius + harmonicOffset);
                    const y = cy + Math.sin(angle) * (ringRadius + harmonicOffset);

                    const hue = theta[idx] / 255;
                    const saturation = 0.6 + entanglement[idx] / 1024;
                    const value = 0.3 + amplitude[idx] / 320;
                    const [r, g, b] = hsv2rgb(hue, Math.min(1, saturation), Math.min(1, value));
                    const alpha = 0.25 + Math.min(0.7, lock[idx] / 255 * 0.5 + amplitude[idx] / 255 * 0.25);
                    const size = 1.4 + amplitude[idx] / 100 + entanglement[idx] / 220;

                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
                    ctx.shadowColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.45)`;
                    ctx.shadowBlur = 8 + entanglement[idx] / 16;
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.font = "12px monospace";
        ctx.fillText(`phase lattice ${this.field.sectors}x${this.field.radial_bins}x${this.field.harmonics}`, 24, 28);
        ctx.fillText(`omega span ${Math.min(...omega)}..${Math.max(...omega)}`, 24, 46);
    }
}

```

## `src/temporal_scheduler.ts`
```ts
import { State, Sigma3Node } from "./quine.ts";

/**
 * OMEGA-64 | Ontology 8.0
 * The Temporal Phase Engine (Kuramoto Consensus)
 * 
 * Executes computing nodes deterministically based on absolute Phase geometry.
 */

// Math domain constants
const PHASE_MAX = 256;          // A complete cyclic rotation
const KURAMOTO_K = 10;          // Base Coupling Strength multiplier

interface FiredSignal {
    sourceId: string;
    phase: number;
}

/**
 * Core Scheduler Logic.
 * Advances the global clock by `ticks`.
 */
export function runEpoch(state: State, ticks: number, triggerExecution: (nodeId: string) => void) {
    console.log(`[Chronosphere] Advancing time by ${ticks} ticks...`);

    for (let t = 0; t < ticks; t++) {
        const firedThisTick: FiredSignal[] = [];

        // 1. Advance Phase Vectors for all neurons
        for (const [id, node] of Object.entries(state)) {
            // Apply temporal attributes if they don't exist yet (Legacy Migration)
            if (!node.physics.temporal) {
                // Determine implicit frequency from energy or set a default
                const freq = node.physics.energy_cost < 20 ? 64 : 1; 
                node.physics.temporal = { frequency: freq, phase: 0 };
            }

            const tm = node.physics.temporal;
            // Native rotation step
            tm.phase += tm.frequency;

            // Overflow Check (360 Degree Firing)
            if (tm.phase >= PHASE_MAX) {
                tm.phase = tm.phase % PHASE_MAX;
                firedThisTick.push({ sourceId: id, phase: tm.phase });
                
                // Trigger actual abstract execution
                triggerExecution(id);
            }
        }

        // 2. Kuramoto Consensus (Apply Coupling from fired nodes to their dependents)
        if (firedThisTick.length > 0) {
            applyKuramotoCoupling(state, firedThisTick);
        }
    }
}

/**
 * Evaluates the topological connections and "pulls/pushes" the phases of linked nodes
 * according to Kuramoto resonance physics.
 */
function applyKuramotoCoupling(state: State, signals: FiredSignal[]) {
    for (const signal of signals) {
        const sourceNode = state[signal.sourceId];
        if (!sourceNode) continue;
        
        // Find children/dependents (Nodes that have `sourceNode.hash` in their parents line)
        const sourceHash = sourceNode.identity.structural_hash;
        
        for (const [targetId, targetNode] of Object.entries(state)) {
            if (targetId === signal.sourceId) continue;
            
            const parents = targetNode.identity.parents || [];
            if (parents.includes(sourceHash)) {
                // Resonance calculation
                const tmB = targetNode.physics.temporal!;
                
                // Absolute phase difference
                const diff = signal.phase - tmB.phase;
                // Convert 0..255 LUT into Radians for Cosine
                const radians = (diff / PHASE_MAX) * Math.PI * 2;
                
                // Kuramoto Coupling Force: K * cos(A - B)
                // We use stability to modulate how easily a node is influenced
                const k = KURAMOTO_K * (sourceNode.physics.stability || 1.0);
                const shift = k * Math.cos(radians);
                
                // Apply phase deformation
                tmB.phase = (tmB.phase + shift + PHASE_MAX) % PHASE_MAX;
                
                // Debug logging to track resonance waves
                console.log(`  [Wave] Resonance: ${signal.sourceId} ~> ${targetId} | Force: ${shift.toFixed(2)} | B's New Phase: ${tmB.phase.toFixed(1)}`);
            }
        }
    }
}

```

## `src/replay/phase_replay.ts`
```ts
import {
    clonePhaseField,
    phaseDistance,
    stepPhaseField,
    structuralSignature,
    sumAmplitude,
    sumEntanglement,
} from "../shared/phase_lattice.ts";
import { buildCanonicalPhaseSeed } from "../shared/phase_canonical.ts";
import type { PhaseField, PhaseFieldShape } from "../shared/phase_lattice.ts";

export type ReplayCompareMode = "none" | "seed" | "previous";

export interface ReplayReferenceTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
}

export interface ReplayWasmTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
    omegaSpan: string;
}

export interface PhaseReplayGolden {
    schemaVersion: 1;
    shape: PhaseFieldShape;
    ticks: number;
    referenceTrace: ReplayReferenceTraceEntry[];
    wasmTrace: ReplayWasmTraceEntry[];
    invariants: {
        referenceSeedLegacySignature: string;
        referenceSeedStructuralSignature: string;
        wasmSeedStructuralSignature: string;
        rotatedPhaseStructuralSignature: string;
        rotatedAddressStructuralSignature: string;
    };
}

export interface PhaseReplayDataset {
    golden: PhaseReplayGolden;
    snapshots: PhaseField[];
}

export interface PhaseReplayDiffSummary {
    changedCells: number;
    totalAmplitudeDelta: number;
    totalLockDelta: number;
    totalEntanglementDelta: number;
    maxPhaseDistance: number;
    parityLocked: boolean;
    referenceStructuralSignature: string;
    wasmStructuralSignature: string;
}

const phaseCoherenceGoldenUrl = new URL("../../tools/goldens/phase_coherence_golden.json", import.meta.url);

export async function loadPhaseReplayDataset(): Promise<PhaseReplayDataset> {
    const response = await fetch(phaseCoherenceGoldenUrl);
    if (!response.ok) {
        throw new Error(`Failed to load phase replay golden: ${response.status} ${response.statusText}`);
    }

    const golden = await response.json() as PhaseReplayGolden;
    assertValidGolden(golden);

    const snapshots: PhaseField[] = [];
    let current = buildCanonicalPhaseSeed(golden.shape);
    snapshots.push(clonePhaseField(current));
    validateReferenceSnapshot(current, golden.referenceTrace[0]);

    for (let tick = 1; tick <= golden.ticks; tick++) {
        current = stepPhaseField(current);
        snapshots.push(clonePhaseField(current));
        validateReferenceSnapshot(current, golden.referenceTrace[tick]);
    }

    return {
        golden,
        snapshots,
    };
}

export function getReplaySnapshot(dataset: PhaseReplayDataset, tick: number): PhaseField {
    const boundedTick = clampTick(tick, dataset.golden.ticks);
    return dataset.snapshots[boundedTick];
}

export function getReplayComparison(
    dataset: PhaseReplayDataset,
    tick: number,
    compareMode: ReplayCompareMode,
): PhaseField | null {
    const boundedTick = clampTick(tick, dataset.golden.ticks);
    if (compareMode === "none") {
        return null;
    }
    if (compareMode === "seed") {
        return dataset.snapshots[0];
    }
    if (boundedTick === 0) {
        return null;
    }
    return dataset.snapshots[boundedTick - 1];
}

export function summarizeReplayDiff(
    dataset: PhaseReplayDataset,
    tick: number,
    compareMode: ReplayCompareMode,
): PhaseReplayDiffSummary {
    const boundedTick = clampTick(tick, dataset.golden.ticks);
    const current = dataset.snapshots[boundedTick];
    const compare = getReplayComparison(dataset, boundedTick, compareMode);
    const referenceTrace = dataset.golden.referenceTrace[boundedTick];
    const wasmTrace = dataset.golden.wasmTrace[boundedTick];
    return buildDiffSummary(
        current,
        compare,
        referenceTrace.structuralSignature,
        wasmTrace.structuralSignature,
        referenceTrace.structuralSignature === wasmTrace.structuralSignature,
    );
}

export function buildDiffSummary(
    current: PhaseField,
    compare: PhaseField | null,
    referenceStructuralSignature: string,
    wasmStructuralSignature: string,
    parityLocked: boolean,
): PhaseReplayDiffSummary {
    let changedCells = 0;
    let totalAmplitudeDelta = 0;
    let totalLockDelta = 0;
    let totalEntanglementDelta = 0;
    let maxPhaseDistance = 0;

    if (compare) {
        for (let index = 0; index < current.cells.length; index++) {
            const nextCell = current.cells[index];
            const prevCell = compare.cells[index];
            const amplitudeDelta = nextCell.amplitude - prevCell.amplitude;
            const lockDelta = nextCell.lock - prevCell.lock;
            const entanglementDelta = nextCell.entanglement - prevCell.entanglement;
            const thetaDelta = phaseDistance(nextCell.theta, prevCell.theta);

            if (
                amplitudeDelta !== 0 ||
                lockDelta !== 0 ||
                entanglementDelta !== 0 ||
                thetaDelta !== 0 ||
                nextCell.omega !== prevCell.omega
            ) {
                changedCells++;
            }

            totalAmplitudeDelta += amplitudeDelta;
            totalLockDelta += lockDelta;
            totalEntanglementDelta += entanglementDelta;
            maxPhaseDistance = Math.max(maxPhaseDistance, thetaDelta);
        }
    }

    return {
        changedCells,
        totalAmplitudeDelta,
        totalLockDelta,
        totalEntanglementDelta,
        maxPhaseDistance,
        parityLocked,
        referenceStructuralSignature,
        wasmStructuralSignature,
    };
}

function clampTick(value: number, maxTick: number): number {
    return Math.max(0, Math.min(maxTick, Math.trunc(value)));
}

function validateReferenceSnapshot(field: PhaseField, trace: ReplayReferenceTraceEntry): void {
    const signature = structuralSignature(field);
    const amplitude = sumAmplitude(field);
    const entanglement = sumEntanglement(field);

    if (signature !== trace.structuralSignature) {
        throw new Error(
            `Phase replay structural mismatch at tick=${trace.tick}: expected=${trace.structuralSignature} actual=${signature}`,
        );
    }
    if (amplitude !== trace.totalAmplitude) {
        throw new Error(
            `Phase replay amplitude mismatch at tick=${trace.tick}: expected=${trace.totalAmplitude} actual=${amplitude}`,
        );
    }
    if (entanglement !== trace.totalEntanglement) {
        throw new Error(
            `Phase replay entanglement mismatch at tick=${trace.tick}: expected=${trace.totalEntanglement} actual=${entanglement}`,
        );
    }
}

function assertValidGolden(value: unknown): asserts value is PhaseReplayGolden {
    if (!value || typeof value !== "object") {
        throw new Error("Phase replay golden is not an object");
    }

    const golden = value as Partial<PhaseReplayGolden>;
    if (golden.schemaVersion !== 1) {
        throw new Error(`Unsupported phase replay schemaVersion: ${String(golden.schemaVersion)}`);
    }
    if (!golden.shape || typeof golden.shape !== "object") {
        throw new Error("Phase replay golden is missing shape");
    }
    if (!Array.isArray(golden.referenceTrace) || !Array.isArray(golden.wasmTrace)) {
        throw new Error("Phase replay golden is missing traces");
    }
    if (typeof golden.ticks !== "number") {
        throw new Error("Phase replay golden is missing ticks");
    }
    if (golden.referenceTrace.length !== golden.ticks + 1 || golden.wasmTrace.length !== golden.ticks + 1) {
        throw new Error("Phase replay golden trace length does not match ticks");
    }
}

```

## `src/replay/hybrid_replay.ts`
```ts
import {
    Field,
    execute_phase_bridge_tick,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    seed_phase_bridge_pattern,
} from "../../omega_core/pkg/omega_core.js";
import {
    clamp,
    createPhaseField,
    getCell,
    structuralSignature,
    wrapTheta,
} from "../shared/phase_lattice.ts";
import type { PhaseField } from "../shared/phase_lattice.ts";

export interface HybridReplayTraceEntry {
    tick: number;
    signature: string;
    totalEnergy: number;
    totalLocks: number;
    totalPlasmids: number;
    omegaSpan: string;
    runLength?: number;
}

export interface HybridReplayGolden {
    schemaVersion: 1;
    width: number;
    height: number;
    ticks: number;
    wasmTrace: HybridReplayTraceEntry[];
    invariants: {
        seedSignature: string;
        rotatedSignature: string;
    };
}

export interface HybridReplayDataset {
    golden: HybridReplayGolden;
    snapshots: PhaseField[];
}

const phaseBridgeGoldenUrl = new URL("../../tools/goldens/phase_bridge_golden.json", import.meta.url);

export async function loadHybridReplayDataset(wasm: WebAssembly.Exports): Promise<HybridReplayDataset> {
    const response = await fetch(phaseBridgeGoldenUrl);
    if (!response.ok) {
        throw new Error(`Failed to load hybrid replay golden: ${response.status} ${response.statusText}`);
    }

    const golden = await response.json() as HybridReplayGolden;
    assertValidGolden(golden);

    const field = new Field(golden.width, golden.height);
    seed_phase_bridge_pattern(field);

    const snapshots: PhaseField[] = [];
    snapshots.push(snapshotHybridField(field, wasm));
    
    let currentTraceIdx = 0;
    let ticksInCurrentRun = 0;
    
    validateHybridSnapshot(field, golden.wasmTrace[currentTraceIdx], 0);
    ticksInCurrentRun++;

    for (let tick = 1; tick <= golden.ticks; tick++) {
        execute_phase_bridge_tick(field, 0);
        snapshots.push(snapshotHybridField(field, wasm));
        
        const currentEntry = golden.wasmTrace[currentTraceIdx];
        const runLength = currentEntry.runLength ?? 1;
        
        if (ticksInCurrentRun >= runLength) {
            currentTraceIdx++;
            ticksInCurrentRun = 0;
        }
        
        validateHybridSnapshot(field, golden.wasmTrace[currentTraceIdx], tick);
        ticksInCurrentRun++;
    }

    return {
        golden,
        snapshots,
    };
}

export function cropPhaseField(field: PhaseField, radialBins: number): PhaseField {
    const boundedBins = Math.max(1, Math.min(radialBins, field.shape.radialBins));
    if (boundedBins === field.shape.radialBins) {
        return field;
    }

    return createPhaseField(
        {
            sectors: field.shape.sectors,
            radialBins: boundedBins,
            harmonics: field.shape.harmonics,
        },
        ({ sector, rho, harmonic }) => {
            const cell = getCell(field, sector, rho, harmonic);
            return {
                theta: cell.theta,
                omega: cell.omega,
                amplitude: cell.amplitude,
                lock: cell.lock,
                entanglement: cell.entanglement,
                cellStatus: cell.cellStatus,
                plasmids: cell.plasmids,
            };
        },
    );
}

export function collapsePhaseField(field: PhaseField, radialBins = field.shape.radialBins): PhaseField {
    const boundedBins = Math.max(1, Math.min(radialBins, field.shape.radialBins));
    return createPhaseField(
        {
            sectors: field.shape.sectors,
            radialBins: boundedBins,
            harmonics: 1,
        },
        ({ sector, rho }) => {
            let sumX = 0;
            let sumY = 0;
            let sumAmplitude = 0;
            let sumLock = 0;
            let sumOmega = 0;
            let maxEntanglement = 0;

            for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
                const cell = getCell(field, sector, rho, harmonic);
                const weight = Math.max(1, cell.amplitude);
                const radians = (cell.theta / 256) * Math.PI * 2;
                sumX += Math.cos(radians) * weight;
                sumY += Math.sin(radians) * weight;
                sumAmplitude += cell.amplitude;
                sumLock += cell.lock;
                sumOmega += cell.omega;
                maxEntanglement = Math.max(maxEntanglement, cell.entanglement);
            }

            const meanAngle = Math.atan2(sumY, sumX);
            const normalizedAngle = meanAngle < 0 ? meanAngle + Math.PI * 2 : meanAngle;
            const harmonicCount = field.shape.harmonics;

            return {
                theta: wrapTheta(Math.round((normalizedAngle / (Math.PI * 2)) * 256)),
                omega: Math.round(sumOmega / harmonicCount),
                amplitude: clamp(Math.round(sumAmplitude / harmonicCount), 0, 255),
                lock: clamp(Math.round(sumLock / harmonicCount), 0, 255),
                entanglement: maxEntanglement,
                cellStatus: 0,
                plasmids: 0n,
            };
        },
    );
}

export function hybridSnapshotSignature(field: PhaseField): string {
    return structuralSignature(field);
}

export function snapshotHybridField(field: Field, wasm: WebAssembly.Exports): PhaseField {
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const cellCount = field.width * field.height;
    const theta = new Uint8Array(memory.buffer, field.ptr_theta_now(), cellCount);
    const omega = new Uint8Array(memory.buffer, field.ptr_omega(), cellCount);
    const energy = new Uint8Array(memory.buffer, field.ptr_energy(), cellCount);
    const locks = new Uint8Array(memory.buffer, field.ptr_hebbian_locks(), cellCount);
    const plasmids = new BigUint64Array(memory.buffer, field.ptr_plasmids(), cellCount);

    return createPhaseField(
        {
            sectors: field.width,
            radialBins: field.height,
            harmonics: 1,
        },
        ({ sector, rho }) => {
            const index = rho * field.width + sector;
            return {
                theta: theta[index],
                omega: decodeBridgeOmega(omega[index]),
                amplitude: energy[index],
                lock: locks[index],
                // Bridge mode has no direct antipodal field, so plasmid presence becomes a view-only proxy.
                entanglement: plasmids[index] === 0n ? 0 : clamp(96 + locks[index], 0, 255),
                cellStatus: 0,
                plasmids: plasmids[index],
            };
        },
    );
}

export function snapshotHybridComparableField(field: Field, wasm: WebAssembly.Exports): PhaseField {
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const cellCount = field.width * field.height;
    const theta = new Uint8Array(memory.buffer, field.ptr_theta_now(), cellCount);
    const omega = new Uint8Array(memory.buffer, field.ptr_omega(), cellCount);
    const energy = new Uint8Array(memory.buffer, field.ptr_energy(), cellCount);
    const locks = new Uint8Array(memory.buffer, field.ptr_hebbian_locks(), cellCount);

    return createPhaseField(
        {
            sectors: field.width,
            radialBins: field.height,
            harmonics: 1,
        },
        ({ sector, rho }) => {
            const index = rho * field.width + sector;
            return {
                theta: theta[index],
                omega: decodeBridgeOmega(omega[index]),
                amplitude: energy[index],
                lock: locks[index],
                // Cross-mode admission should compare only registers that actually exist in bridge mode.
                entanglement: 0,
                cellStatus: 0,
                plasmids: 0n,
            };
        },
    );
}

function validateHybridSnapshot(field: Field, trace: HybridReplayTraceEntry, actualTick: number): void {
    const signature = field_signature(field);
    if (signature !== trace.signature) {
        throw new Error(
            `Hybrid replay signature mismatch at tick=${actualTick} (RLE chunk=${trace.tick}): expected=${trace.signature} actual=${signature}`,
        );
    }
    if (field_total_energy(field) !== trace.totalEnergy) {
        throw new Error(`Hybrid replay energy mismatch at tick=${actualTick} (RLE chunk=${trace.tick})`);
    }
    if (field_total_locks(field) !== trace.totalLocks) {
        throw new Error(`Hybrid replay lock mismatch at tick=${actualTick} (RLE chunk=${trace.tick})`);
    }
    if (field_total_plasmids(field) !== trace.totalPlasmids) {
        throw new Error(`Hybrid replay plasmid mismatch at tick=${actualTick} (RLE chunk=${trace.tick})`);
    }
}

function decodeBridgeOmega(raw: number): number {
    const signed = raw > 127 ? raw - 256 : raw;
    return clamp(signed, -32, 32);
}

function assertValidGolden(value: unknown): asserts value is HybridReplayGolden {
    if (!value || typeof value !== "object") {
        throw new Error("Hybrid replay golden is not an object");
    }

    const golden = value as Partial<HybridReplayGolden>;
    if (golden.schemaVersion !== 1) {
        throw new Error(`Unsupported hybrid replay schemaVersion: ${String(golden.schemaVersion)}`);
    }
    if (!Array.isArray(golden.wasmTrace)) {
        throw new Error("Hybrid replay golden is missing wasmTrace");
    }
    if (typeof golden.width !== "number" || typeof golden.height !== "number" || typeof golden.ticks !== "number") {
        throw new Error("Hybrid replay golden is missing dimensions");
    }
    // RLE compression prevents strict len == ticks check.
}

```

## `src/compiler/mutator.ts`
```ts
import { Sigma3Node } from "../quine.ts";

export interface MutationIdea {
    alias: string;
    path: (string | number)[];
    newValue: number;
}

export function generateGeneticDrift(alias: string, node: Sigma3Node): MutationIdea | null {
    const mutablePaths: { path: (string | number)[], val: number }[] = [];
    
    function traverse(current: any, currentPath: (string | number)[]) {
        if (!current || typeof current !== "object") return;
        
        if (current.kind === "const" && typeof current.value === "number") {
            mutablePaths.push({ path: [...currentPath, "value"], val: current.value });
        }
        
        // Recurse into object/array
        for (const [key, value] of Object.entries(current)) {
            if (typeof value === "object") {
                // If it's an array, key is a stringified index
                const p = Array.isArray(current) ? parseInt(key) : key;
                traverse(value, [...currentPath, p as string | number]);
            }
        }
    }
    
    // Start traversal at the theoretical root of ir
    traverse(node.ir, []);
    
    if (mutablePaths.length === 0) return null;
    
    // Select one random numerical property deeply nested in the AST
    const candidate = mutablePaths[Math.floor(Math.random() * mutablePaths.length)];
    
    // Inject biological drift
    const deltas = [-4, -2, -1, 1, 2, 4];
    const delta = deltas[Math.floor(Math.random() * deltas.length)];
    
    let newValue = candidate.val + delta;
    
    // Clamp to prevent total mathematical blowout during early evolution
    if (newValue > 1024) newValue = 1024;
    if (newValue < -1024) newValue = -1024;
    // Attempt not to zero it entirely unless symmetric
    if (newValue === 0 && Math.random() > 0.1) newValue = 1; 

    return {
        alias,
        path: candidate.path,
        newValue
    };
}

```

## `src/compiler/ast_to_rust.ts`
```ts
import { IRNode, IRFunction } from "../quine.ts";

export function compileNodeToRust(node: IRNode): string {
    switch (node.kind) {
        case "const":
            return `${node.value}`;
        case "var":
            return node.name;
        case "op": {
            const left = compileNodeToRust(node.args[0]);
            const right = compileNodeToRust(node.args[1]);
            let sym = "";
            switch (node.op) {
                case "add": sym = "+"; break;
                case "sub": sym = "-"; break;
                case "mul": sym = "*"; break;
                case "div": sym = "/"; break;
                case "and": sym = "&"; break;
                case "or":  sym = "|"; break;
                case "xor": sym = "^"; break;
                case "shl": sym = "<<"; break;
                case "shr": sym = ">>"; break;
            }
            return `(${left} ${sym} ${right})`;
        }
        case "call": {
            const args = node.args.map(compileNodeToRust).join(', ');
            return `${node.target}(${args})`;
        }
        case "if": {
            const condStr = compileNodeToRust(node.cond);
            const tBranch = compileNodeToRust(node.then);
            const eBranch = compileNodeToRust(node.else);
            return `(if ${condStr} != 0 { ${tBranch} } else { ${eBranch} })`;
        }
        case "block": {
            const stmts = node.statements.map(s => compileNodeToRust(s) + ";").join("\n    ");
            const res = compileNodeToRust(node.result);
            return `{\n    ${stmts}\n    ${res}\n}`;
        }
    }
}

export function compileIRFunctionToRust(name: string, fn: IRFunction): string {
    const argsStr = fn.args.map(a => `${a.name}: ${a.type}`).join(', ');
    const bodyStr = typeof fn.body === "string" ? fn.body : compileNodeToRust(fn.body);
    
    return `
#[wasm_bindgen]
#[allow(unused_parens)]
pub fn ${name}(${argsStr}) -> ${fn.ret} {
    ${bodyStr}
}
`;
}

```

## `omega_core/src/simd_tick.rs`
```rs
use wasm_bindgen::prelude::*;
use crate::memory::Field;

const BRIDGE_COHERENCE_ENERGY_GAIN: f32 = 6.0;
const BRIDGE_LOCK_PENALTY_DIVISOR: i16 = 64;
const BRIDGE_LOCK_GAIN: u8 = 8;
const BRIDGE_LOCK_DECAY: u8 = 4;
const BRIDGE_BOUNDARY_ENERGY_BONUS: i16 = 0;
const BRIDGE_BOUNDARY_LOCK_BONUS: u8 = 1;
const BRIDGE_DEPTH1_SUSTAINED_ENERGY_BONUS: i16 = 2;
const BRIDGE_DEPTH2_LOCK_THRESHOLD: f32 = 2.5;

#[wasm_bindgen]
pub fn execute_simd_tick(field: &mut Field, lut_ptr: *const i16) {
    let size = field.x.len();
    let default_lut: [i16; 256] = [0; 256];
    let lut = if lut_ptr.is_null() {
        &default_lut[..]
    } else {
        unsafe { std::slice::from_raw_parts(lut_ptr, 256) }
    };
    
    // Process in chunks of 8 (since eight i16s fit in a 128-bit vector)
    for i in (0..size).step_by(8) {
        // In a purely `#![feature(wasm_simd)]` environment, this loop is replaced 
        // with `v128_load`, `i8x16_add`, the swizzle `lut_gather`, and `v128_bitselect`.
        
        // For standard compilation, we execute the rigorous logical equivalent 
        // of the Zero-Alloc Register Superposition Tournament:
        
        for lane in 0..8 {
            let idx = i + lane;
            if idx >= size { break; }
            
            // --- Ontology 27: Async TTL ---
            // If the cell recently queried the Oracle, it enters a cooldown phase, preserving physics iteration.
            if field.cell_status[idx] > 0 {
                field.cell_status[idx] = field.cell_status[idx].saturating_sub(1);
            }
            
            let p = field.theta_now[idx];
            let raw_energy = field.energy[idx] as i16;
            
            let mut best_energy = raw_energy;
            let mut best_score = i16::MAX;
            
            // The Superposition Tournament (4 candidate $\Delta$ offsets)
            let deltas: [u8; 4] = [1, 2, 3, 4];
            
            for &d in &deltas {
                // Temporary phase shift mutation (Access offset)
                let p_mut = p.wrapping_add(d);
                let val = lut[p_mut as usize];
                
                // Invoke the auto-generated AST from Ontology 16 Compiler Bridge!
                let mutated_val = crate::generated_biology::fast_abs(val as i32) as i16;
                let next_energy = raw_energy.saturating_add(mutated_val);
                
                // Drift evaluation (geometric tension against the future f1 horizon)
                let future_val = lut[field.theta_f1[idx] as usize];
                let score = (next_energy - future_val).abs();
                
                // Evolutionary Selection within the "Register" -> `v128_bitselect`
                if score < best_score {
                    best_score = score;
                    best_energy = next_energy;
                }
            }
            
            // Collapse the superposition into reality
            field.energy[idx] = best_energy.clamp(0, 255) as u8;
            
            // Advance local time via native frequency omega
            field.theta_now[idx] = field.theta_now[idx].wrapping_add(field.omega[idx]);

            // --- Ontology 11: The Genetic Wave-Field ---

            // 1. Plasmid Secretion (Autopoiesis)
            // If the cell achieves extreme mathematical coherence (low tension score, high energy)
            if best_score < 5 && best_energy > 200 {
                // Secrete a mathematical plasmid encoding current optimal geometry
                let structural_plasmid = (field.theta_now[idx] as u64) | ((field.omega[idx] as u64) << 8);
                field.plasmids[idx] = structural_plasmid;
            }

            // 2. Horizontal Gene Transfer (Plasmid Adoption)
            // If the cell is in chaotic distress (high geometric tension) and failing to resolve reality
            if best_score > 100 {
                // --- Ontology 13: Immunological Rejection ---
                // If local energy is extremely toxic/hot, the cell is inflamed and rejects external ideas.
                if best_energy < 240 {
                    // Sample adjacent neighbor's plasmid (Northern neighbor W-offset)
                    let w = field.width as usize;
                    let neighbor_idx = if idx >= w { idx - w } else { idx + w };
                    let mut adopted = false;
                    
                    if neighbor_idx < size {
                        let foreign_plasmid = field.plasmids[neighbor_idx];
                        if foreign_plasmid != 0 {
                            // Incorporate plasmid: Overwrite host structural genetic parameters
                            field.theta_now[idx] = (foreign_plasmid & 0xFF) as u8;
                            field.omega[idx] = ((foreign_plasmid >> 8) & 0xFF) as u8;
                            // Officially adopt the plasmid footprint so the Idea's color spreads!
                            field.plasmids[idx] = foreign_plasmid;
                            adopted = true;
                        }
                    }
                    
                    // --- Ontology 27: Async TTL Proxy ---
                    // Request an intent ONLY if not actively cooling down.
                    if !adopted && best_score > 160 && field.oracle_request_count < 1024 {
                        if field.cell_status[idx] == 0 {
                            field.oracle_requests[field.oracle_request_count] = idx as u32;
                            field.oracle_request_count += 1;
                            field.cell_status[idx] = 240; // 4-second TTL
                        }
                    }
                }
            }

            // 3. Hebbian Phase Locks (Topological Freezing)
            // If phase velocity synchronizes with neighbor, permanently merge tensor transmission coefficients
            let right_idx = idx + 1;
            if right_idx < size {
                if field.theta_now[idx] == field.theta_now[right_idx] {
                    field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_add(1);
                } else {
                    // Ontology 13: Continual degeneration of dead phase locks
                    field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_sub(1);
                }
            }

            // 4. Plasmid Decay (TTL)
            // If energy is extremely low (matrix is starving), plasmids dissolve back into pure math
            if best_energy < 15 && field.plasmids[idx] != 0 {
                // Stochastic decay utilizing structural phase to avoid uniform visual erasure
                if (field.theta_now[idx] % 4) == 0 {
                    field.plasmids[idx] = 0;
                }
            }
        }
    }
}

#[wasm_bindgen]
pub fn execute_phase_bridge_tick(field: &mut Field, lut_ptr: *const i16) {
    let size = field.x.len();
    let width = field.width as usize;
    let height = field.height as usize;
    let active_radial_bins = usize::max(1, usize::min(height, 6));
    let default_lut: [i16; 256] = [0; 256];
    let lut = if lut_ptr.is_null() {
        &default_lut[..]
    } else {
        unsafe { std::slice::from_raw_parts(lut_ptr, 256) }
    };

    let theta_prev = field.theta_now.clone();
    let theta_f3_prev = field.theta_f3.clone();
    let omega_prev = field.omega.clone();
    let energy_prev = field.energy.clone();
    let plasmids_prev = field.plasmids.clone();
    let locks_prev = field.hebbian_locks.clone();
    let status_prev = field.cell_status.clone();

    for idx in 0..size {
        if status_prev[idx] > 0 {
            field.cell_status[idx] = status_prev[idx].saturating_sub(1);
        } else {
            field.cell_status[idx] = 0;
        }

        let sector = idx % width;
        let rho = idx / width;
        let radial_rho = usize::min(rho, active_radial_bins - 1);
        let boundary_depth = usize::min(radial_rho, active_radial_bins - 1 - radial_rho);
        let boundary_bonus = if boundary_depth <= 1 { 1i16 } else { 0i16 };

        let left_idx = idx_from_sector_rho(width, height, wrap_index(sector as i32 - 1, width), rho);
        let right_idx = idx_from_sector_rho(width, height, wrap_index(sector as i32 + 1, width), rho);
        let inner_idx = idx_from_sector_rho(width, height, sector, radial_rho.saturating_sub(1));
        let outer_idx = idx_from_sector_rho(width, height, sector, usize::min(radial_rho + 1, active_radial_bins - 1));
        let antipode_idx = if width % 2 == 0 {
            idx_from_sector_rho(width, height, (sector + width / 2) % width, rho)
        } else {
            idx
        };
        let synthetic_peer_theta = theta_f3_prev[idx];

        let p = theta_prev[idx];
        let raw_energy = energy_prev[idx] as i16;
        let local_target = local_target(lut, &theta_prev, [left_idx, right_idx, inner_idx, outer_idx], idx, false);

        let mut best_energy = raw_energy;
        let mut best_score = i16::MAX;
        for &d in &[1u8, 2, 3, 4] {
            let p_mut = p.wrapping_add(d);
            let val = lut[p_mut as usize];
            let mutated_val = crate::generated_biology::fast_abs(val as i32) as i16;
            let next_energy = raw_energy.saturating_add(mutated_val);
            let score = (next_energy - local_target).abs();
            if score < best_score {
                best_score = score;
                best_energy = next_energy;
            }
        }

        let kuramoto =
            phase_sin(theta_prev[idx], theta_prev[left_idx]) +
            phase_sin(theta_prev[idx], theta_prev[right_idx]) +
            phase_sin(theta_prev[idx], theta_prev[inner_idx]) +
            phase_sin(theta_prev[idx], theta_prev[outer_idx]) +
            phase_sin(theta_prev[idx], synthetic_peer_theta) * 0.5;

        let coherence =
            phase_cos(theta_prev[idx], theta_prev[left_idx]) +
            phase_cos(theta_prev[idx], theta_prev[right_idx]) +
            phase_cos(theta_prev[idx], theta_prev[inner_idx]) +
            phase_cos(theta_prev[idx], theta_prev[outer_idx]) +
            phase_cos(theta_prev[idx], synthetic_peer_theta) * 0.5;

        let sustained_coherence_bonus = if boundary_depth == 1 && plasmids_prev[idx] == 0 && locks_prev[idx] >= 64 && coherence >= 3.0 {
            BRIDGE_DEPTH1_SUSTAINED_ENERGY_BONUS
        } else {
            0
        };

        let next_omega = clamp_bridge_omega(decode_bridge_omega(omega_prev[idx]) + kuramoto.round() as i16);
        let next_theta = wrap_phase(theta_prev[idx] as i16 + next_omega);
        let coupled_energy = (
            best_energy +
            (coherence * BRIDGE_COHERENCE_ENERGY_GAIN).round() as i16 +
            sustained_coherence_bonus +
            boundary_bonus * BRIDGE_BOUNDARY_ENERGY_BONUS -
            (locks_prev[idx] as i16 / BRIDGE_LOCK_PENALTY_DIVISOR)
        ).clamp(0, 255);

        field.theta_now[idx] = next_theta;
        field.omega[idx] = encode_bridge_omega(next_omega);
        field.energy[idx] = coupled_energy as u8;
        field.theta_f1[idx] = theta_prev[left_idx];
        field.theta_f2[idx] = theta_prev[right_idx];
        field.theta_f3[idx] = theta_prev[idx];

        if coherence >= 3.0 && coupled_energy > 200 {
            let structural_plasmid =
                (field.theta_now[idx] as u64) |
                ((field.omega[idx] as u64) << 8) |
                ((field.hebbian_locks[idx] as u64) << 16) |
                ((coupled_energy as u64) << 24);
            field.plasmids[idx] = structural_plasmid;
        }

        if best_score > 100 && coupled_energy < 240 {
            let neighbors = [left_idx, right_idx, inner_idx, outer_idx, antipode_idx];
            let mut adopted = false;
            let mut best_resonance = -2.0f32;
            let mut donor_plasmid = 0u64;

            for &neighbor_idx in &neighbors {
                let candidate_plasmid = plasmids_prev[neighbor_idx];
                if candidate_plasmid == 0 {
                    continue;
                }
                let candidate_resonance = phase_cos(theta_prev[idx], theta_prev[neighbor_idx]);
                if candidate_resonance > best_resonance {
                    best_resonance = candidate_resonance;
                    donor_plasmid = candidate_plasmid;
                }
            }

            if donor_plasmid != 0 && best_resonance > 0.6 {
                field.theta_now[idx] = (donor_plasmid & 0xFF) as u8;
                let donor_omega = decode_bridge_omega(((donor_plasmid >> 8) & 0xFF) as u8);
                field.omega[idx] = encode_bridge_omega(clamp_bridge_omega(donor_omega));
                field.plasmids[idx] = donor_plasmid;
                adopted = true;
            }

            if !adopted && best_score > 160 && field.oracle_request_count < 1024 {
                if status_prev[idx] == 0 {
                    field.oracle_requests[field.oracle_request_count] = idx as u32;
                    field.oracle_request_count += 1;
                    field.cell_status[idx] = 240;
                }
            }
        }

        let lock_threshold = if boundary_depth == 2 { BRIDGE_DEPTH2_LOCK_THRESHOLD } else { 3.0 };
        if coherence >= lock_threshold {
            field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_add(BRIDGE_LOCK_GAIN + if boundary_depth <= 1 { BRIDGE_BOUNDARY_LOCK_BONUS } else { 0 });
        } else {
            field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_sub(BRIDGE_LOCK_DECAY);
        }

        if coupled_energy < 15 && field.plasmids[idx] != 0 && field.theta_now[idx] % 4 == 0 {
            field.plasmids[idx] = 0;
        }
    }
}

#[wasm_bindgen]
pub fn field_signature(field: &Field) -> String {
    let mut hash = 14695981039346656037u64;
    for idx in 0..field.theta_now.len() {
        mix_u64(&mut hash, idx as u64);
        mix_u64(&mut hash, field.theta_now[idx] as u64);
        mix_u64(&mut hash, field.theta_f1[idx] as u64);
        mix_u64(&mut hash, field.theta_f2[idx] as u64);
        mix_u64(&mut hash, field.theta_f3[idx] as u64);
        mix_u64(&mut hash, field.omega[idx] as u64);
        mix_u64(&mut hash, field.energy[idx] as u64);
        mix_u64(&mut hash, field.hebbian_locks[idx] as u64);
        mix_u64(&mut hash, field.plasmids[idx]);
        mix_u64(&mut hash, field.cell_status[idx] as u64);
    }
    format!("{hash:016x}")
}

#[wasm_bindgen]
pub fn field_total_energy(field: &Field) -> u32 {
    field.energy.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn field_total_locks(field: &Field) -> u32 {
    field.hebbian_locks.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn field_total_plasmids(field: &Field) -> u32 {
    field.plasmids.iter().filter(|value| **value != 0).count() as u32
}

#[wasm_bindgen]
pub fn field_omega_span(field: &Field) -> String {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    for raw in &field.omega {
        let omega = decode_bridge_omega(*raw);
        min = min.min(omega);
        max = max.max(omega);
    }
    format!("{min}..{max}")
}

#[wasm_bindgen]
pub fn seed_phase_bridge_pattern(field: &mut Field) {
    let size = (field.width * field.height) as usize;
    let width = field.width as usize;
    let height = field.height as usize;
    let mut theta_now = vec![0u8; size];
    let mut omega = vec![0u8; size];
    let mut energy = vec![0u8; size];
    let mut locks = vec![0u8; size];
    let plasmids = vec![0u64; size];

    field.oracle_request_count = 0;
    for idx in 0..size {
        let sector = idx % width;
        let rho = idx / width;
        let collapsed = collapse_canonical_bridge_seed_cell(sector, rho, width, height);
        theta_now[idx] = collapsed.theta;
        omega[idx] = encode_bridge_omega(collapsed.omega);
        energy[idx] = collapsed.amplitude;
        locks[idx] = collapsed.lock;
        field.cell_status[idx] = 0;
    }

    let mut theta_f1 = vec![0u8; size];
    let mut theta_f2 = vec![0u8; size];
    let mut theta_f3 = vec![0u8; size];

    for rho in 0..height {
        for sector in 0..width {
            let idx = rho * width + sector;
            let left_idx = idx_from_sector_rho(width, height, wrap_index(sector as i32 - 1, width), rho);
            let right_idx = idx_from_sector_rho(width, height, wrap_index(sector as i32 + 1, width), rho);

            theta_f1[idx] = theta_now[left_idx];
            theta_f2[idx] = theta_now[right_idx];
            theta_f3[idx] = theta_now[idx];
        }
    }

    field.theta_now = theta_now;
    field.theta_f1 = theta_f1;
    field.theta_f2 = theta_f2;
    field.theta_f3 = theta_f3;
    field.omega = omega;
    field.energy = energy;
    field.hebbian_locks = locks;
    field.plasmids = plasmids;
}

#[wasm_bindgen]
pub fn rotate_field_sectors(field: &mut Field, delta: i32) {
    let width = field.width as usize;
    let height = field.height as usize;
    let mut theta_now = vec![0u8; field.theta_now.len()];
    let mut theta_f1 = vec![0u8; field.theta_f1.len()];
    let mut theta_f2 = vec![0u8; field.theta_f2.len()];
    let mut theta_f3 = vec![0u8; field.theta_f3.len()];
    let mut omega = vec![0u8; field.omega.len()];
    let mut energy = vec![0u8; field.energy.len()];
    let mut locks = vec![0u8; field.hebbian_locks.len()];
    let mut plasmids = vec![0u64; field.plasmids.len()];
    let mut status = vec![0u8; field.cell_status.len()];

    for rho in 0..height {
        for sector in 0..width {
            let source = rho * width + sector;
            let target_sector = wrap_index(sector as i32 + delta, width);
            let target = rho * width + target_sector;
            theta_now[target] = field.theta_now[source];
            theta_f1[target] = field.theta_f1[source];
            theta_f2[target] = field.theta_f2[source];
            theta_f3[target] = field.theta_f3[source];
            omega[target] = field.omega[source];
            energy[target] = field.energy[source];
            locks[target] = field.hebbian_locks[source];
            plasmids[target] = field.plasmids[source];
            status[target] = field.cell_status[source];
        }
    }

    field.theta_now = theta_now;
    field.theta_f1 = theta_f1;
    field.theta_f2 = theta_f2;
    field.theta_f3 = theta_f3;
    field.omega = omega;
    field.energy = energy;
    field.hebbian_locks = locks;
    field.plasmids = plasmids;
    field.cell_status = status;
}

fn idx_from_sector_rho(width: usize, _height: usize, sector: usize, rho: usize) -> usize {
    rho * width + sector
}

fn wrap_index(value: i32, modulo: usize) -> usize {
    value.rem_euclid(modulo as i32) as usize
}

fn wrap_phase(value: i16) -> u8 {
    value.rem_euclid(256) as u8
}

fn decode_bridge_omega(raw: u8) -> i16 {
    (raw as i8) as i16
}

fn encode_bridge_omega(value: i16) -> u8 {
    (value as i8) as u8
}

fn clamp_bridge_omega(value: i16) -> i16 {
    value.clamp(-32, 32)
}

fn clamp_byte(value: i16) -> u8 {
    value.clamp(0, 255) as u8
}

struct BridgeSeedCell {
    theta: u8,
    omega: i16,
    amplitude: u8,
    lock: u8,
}

fn collapse_canonical_bridge_seed_cell(
    sector: usize,
    rho: usize,
    bridge_width: usize,
    bridge_height: usize,
) -> BridgeSeedCell {
    const CANONICAL_SECTORS: usize = 32;
    const CANONICAL_RADIAL_BINS: usize = 6;
    const CANONICAL_HARMONICS: usize = 3;

    let source_sector = project_bridge_sector(sector, bridge_width, CANONICAL_SECTORS);
    let source_rho = project_bridge_rho(rho, bridge_height, CANONICAL_RADIAL_BINS);

    let mut sum_x = 0.0f32;
    let mut sum_y = 0.0f32;
    let mut sum_amplitude = 0i16;
    let mut sum_lock = 0i16;
    let mut sum_omega = 0i16;
    let mut fallback_theta = 0u8;

    for harmonic in 0..CANONICAL_HARMONICS {
        let theta = canonical_theta(source_sector, source_rho, harmonic);
        let omega = canonical_omega(source_sector, source_rho, harmonic);
        let amplitude = canonical_amplitude(source_sector, source_rho, harmonic) as i16;
        let lock = canonical_lock(source_sector, source_rho, harmonic) as i16;
        let weight = amplitude.max(1) as f32;
        let radians = theta as f32 * std::f32::consts::TAU / 256.0;

        sum_x += radians.cos() * weight;
        sum_y += radians.sin() * weight;
        sum_amplitude += amplitude;
        sum_lock += lock;
        sum_omega += omega;
        fallback_theta = theta;
    }

    let mean_angle = if sum_x == 0.0 && sum_y == 0.0 {
        fallback_theta as f32 * std::f32::consts::TAU / 256.0
    } else {
        sum_y.atan2(sum_x)
    };
    let normalized_angle = if mean_angle < 0.0 {
        mean_angle + std::f32::consts::TAU
    } else {
        mean_angle
    };

    BridgeSeedCell {
        theta: wrap_phase((normalized_angle / std::f32::consts::TAU * 256.0).round() as i16),
        omega: clamp_bridge_omega((sum_omega as f32 / CANONICAL_HARMONICS as f32).round() as i16),
        amplitude: clamp_byte((sum_amplitude as f32 / CANONICAL_HARMONICS as f32).round() as i16),
        lock: clamp_byte((sum_lock as f32 / CANONICAL_HARMONICS as f32).round() as i16),
    }
}

fn project_bridge_sector(target_sector: usize, target_sectors: usize, source_sectors: usize) -> usize {
    if target_sectors == 0 || source_sectors == 0 {
        return 0;
    }
    wrap_index(((target_sector * source_sectors) / target_sectors) as i32, source_sectors)
}

fn project_bridge_rho(target_rho: usize, target_bins: usize, source_bins: usize) -> usize {
    if source_bins == 0 {
        return 0;
    }
    if target_bins >= source_bins {
        target_rho.min(source_bins - 1)
    } else {
        ((target_rho * source_bins) / target_bins).min(source_bins - 1)
    }
}

fn canonical_theta(sector: usize, rho: usize, harmonic: usize) -> u8 {
    wrap_phase((sector * 7 + rho * 19 + harmonic * 23) as i16)
}

fn canonical_omega(sector: usize, rho: usize, harmonic: usize) -> i16 {
    ((sector + rho + harmonic) % 5) as i16 - 2
}

fn canonical_amplitude(sector: usize, rho: usize, harmonic: usize) -> u8 {
    clamp_byte((sector * 13 + rho * 17 + harmonic * 29) as i16)
}

fn canonical_lock(sector: usize, rho: usize, harmonic: usize) -> u8 {
    ((sector * 5 + rho * 11 + harmonic * 3) % 64) as u8
}

fn signed_phase_delta(from_theta: u8, to_theta: u8) -> i16 {
    let raw = (to_theta as i16 - from_theta as i16).rem_euclid(256);
    if raw > 128 {
        raw - 256
    } else {
        raw
    }
}

fn phase_radians(from_theta: u8, to_theta: u8) -> f32 {
    signed_phase_delta(from_theta, to_theta) as f32 * std::f32::consts::TAU / 256.0
}

fn phase_sin(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).sin()
}

fn phase_cos(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).cos()
}

fn local_target(lut: &[i16], theta_prev: &[u8], neighborhood: [usize; 4], antipode_idx: usize, include_antipode: bool) -> i16 {
    let mut total = 0i32;
    let mut count = 0i32;
    for idx in neighborhood {
        total += lut[theta_prev[idx] as usize] as i32;
        count += 1;
    }
    if include_antipode {
        total += (lut[theta_prev[antipode_idx] as usize] as i32) / 2;
        count += 1;
    }
    if count == 0 {
        0
    } else {
        (total / count) as i16
    }
}

fn mix_u64(hash: &mut u64, value: u64) {
    *hash ^= value;
    *hash = hash.wrapping_mul(1099511628211u64);
}

#[cfg(test)]
mod phase_bridge_tests {
    use super::execute_phase_bridge_tick;
    use crate::memory::Field;

    fn seed_field() -> Field {
        let mut field = Field::new(32, 8);
        super::seed_phase_bridge_pattern(&mut field);
        field
    }

    fn rotate_rows(field: &Field, delta: usize) -> Field {
        let mut rotated = seed_field();
        rotated.theta_now.clone_from(&field.theta_now);
        rotated.theta_f1.clone_from(&field.theta_f1);
        rotated.theta_f2.clone_from(&field.theta_f2);
        rotated.theta_f3.clone_from(&field.theta_f3);
        rotated.omega.clone_from(&field.omega);
        rotated.energy.clone_from(&field.energy);
        rotated.hebbian_locks.clone_from(&field.hebbian_locks);
        rotated.plasmids.clone_from(&field.plasmids);
        rotated.cell_status.clone_from(&field.cell_status);
        super::rotate_field_sectors(&mut rotated, delta as i32);
        rotated
    }

    fn assert_same_state(left: &Field, right: &Field) {
        assert_eq!(left.theta_now, right.theta_now, "theta_now mismatch");
        assert_eq!(left.theta_f1, right.theta_f1, "theta_f1 mismatch");
        assert_eq!(left.theta_f2, right.theta_f2, "theta_f2 mismatch");
        assert_eq!(left.theta_f3, right.theta_f3, "theta_f3 mismatch");
        assert_eq!(left.omega, right.omega, "omega mismatch");
        assert_eq!(left.energy, right.energy, "energy mismatch");
        assert_eq!(left.hebbian_locks, right.hebbian_locks, "lock mismatch");
        assert_eq!(left.plasmids, right.plasmids, "plasmid mismatch");
        assert_eq!(left.cell_status, right.cell_status, "status mismatch");
    }

    #[test]
    fn phase_bridge_is_deterministic() {
        let mut left = seed_field();
        let mut right = seed_field();
        for _ in 0..8 {
            execute_phase_bridge_tick(&mut left, std::ptr::null());
            execute_phase_bridge_tick(&mut right, std::ptr::null());
        }
        assert_same_state(&left, &right);
    }

    #[test]
    fn phase_bridge_is_angularly_equivariant() {
        let mut rotated_seed = rotate_rows(&seed_field(), 5);
        let mut baseline = seed_field();

        for _ in 0..6 {
            execute_phase_bridge_tick(&mut rotated_seed, std::ptr::null());
            execute_phase_bridge_tick(&mut baseline, std::ptr::null());
        }

        let rotated_baseline = rotate_rows(&baseline, 5);
        assert_same_state(&rotated_seed, &rotated_baseline);
    }
}

```

## `omega_core/src/lib.rs`
```rs
pub mod memory;
pub mod simd_tick;
pub mod phase_lattice;
pub mod perturbation;
pub mod generated_biology;

```

## `omega_core/src/memory.rs`
```rs
use wasm_bindgen::prelude::*;

// The Struct of Arrays (SoA) Field holding the physics data for the ecosystem
#[wasm_bindgen]
#[repr(C)]
pub struct Field {
    pub width: u32,
    pub height: u32,
    pub(crate) x: Vec<i16>,
    pub(crate) y: Vec<i16>,
    pub(crate) theta_now: Vec<u8>,
    pub(crate) theta_f1: Vec<u8>,
    pub(crate) theta_f2: Vec<u8>,
    pub(crate) theta_f3: Vec<u8>,
    pub(crate) omega: Vec<u8>,
    pub(crate) energy: Vec<u8>,
    pub(crate) plasmids: Vec<u64>,
    pub(crate) hebbian_locks: Vec<u8>,
    pub(crate) oracle_requests: Vec<u32>,
    pub oracle_request_count: usize,
    pub(crate) cell_status: Vec<u8>,
}

#[wasm_bindgen]
impl Field {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> Field {
        let size = (width * height) as usize;
        let mut f = Field {
            width,
            height,
            x: vec![0; size],
            y: vec![0; size],
            theta_now: vec![0; size],
            theta_f1: vec![0; size],
            theta_f2: vec![0; size],
            theta_f3: vec![0; size],
            omega: vec![0; size],
            energy: vec![0; size],
            plasmids: vec![0; size],
            hebbian_locks: vec![0; size],
            oracle_requests: vec![0; 1024],
            oracle_request_count: 0,
            cell_status: vec![0; size],
        };

        // Initialize coordinates to a structured grid
        let w = width as usize;
        for i in 0..size {
            f.x[i] = (i % w) as i16;
            f.y[i] = (i / w) as i16;
            f.theta_now[i] = (i % 256) as u8; // Initial phase noise
        }
        f
    }

    // Export raw pointers to JS/WebGPU for zero-copy SharedArrayBuffer mapping
    pub fn ptr_x(&self) -> *const i16 { self.x.as_ptr() }
    pub fn ptr_y(&self) -> *const i16 { self.y.as_ptr() }
    pub fn ptr_theta_now(&self) -> *const u8 { self.theta_now.as_ptr() }
    pub fn ptr_theta_f1(&self) -> *const u8 { self.theta_f1.as_ptr() }
    pub fn ptr_theta_f2(&self) -> *const u8 { self.theta_f2.as_ptr() }
    pub fn ptr_theta_f3(&self) -> *const u8 { self.theta_f3.as_ptr() }
    pub fn ptr_omega(&self) -> *const u8 { self.omega.as_ptr() }
    pub fn ptr_energy(&self) -> *const u8 { self.energy.as_ptr() }
    pub fn ptr_plasmids(&self) -> *const u64 { self.plasmids.as_ptr() }
    pub fn ptr_hebbian_locks(&self) -> *const u8 { self.hebbian_locks.as_ptr() }
    
    // Oracle Zero-Copy Bindings
    pub fn ptr_oracle_requests(&self) -> *const u32 { self.oracle_requests.as_ptr() }
    pub fn get_oracle_request_count(&self) -> usize { self.oracle_request_count }
    pub fn clear_oracle_requests(&mut self) { self.oracle_request_count = 0; }
    pub fn ptr_cell_status(&mut self) -> *mut u8 { self.cell_status.as_mut_ptr() }
    
    // Status Enums
    pub fn status_idle() -> u8 { 0 }
    pub fn status_awaiting_oracle() -> u8 { 1 }
}

```

## `omega_core/src/perturbation.rs`
```rs
use wasm_bindgen::prelude::*;
use crate::memory::Field;

#[wasm_bindgen]
pub fn apply_perturbation(
    field: &mut Field, 
    x: i16, 
    y: i16, 
    energy: i16, 
    radius: i16, 
    phase_shift: i16, 
    plasmid_low: u32,
    plasmid_high: u32
) {
    let r = radius.abs() as i32;
    let r_sq = r * r;
    let cx = x as i32;
    let cy = y as i32;

    for dy in -r..=r {
        for dx in -r..=r {
            if dx * dx + dy * dy <= r_sq {
                let tx = cx + dx;
                let ty = cy + dy;
                if tx >= 0 && tx < 256 && ty >= 0 && ty < 256 {
                    let cell_idx = (ty * 256 + tx) as usize;
                    
                    // Thermal injection
                    let mut e = field.energy[cell_idx] as i32 + energy as i32;
                    if e > 255 { e = 255; }
                    if e < 0 { e = 0; }
                    field.energy[cell_idx] = e as u8;

                    // Phase shift
                    let mut phase = field.theta_now[cell_idx] as i32 + phase_shift as i32;
                    phase &= 255;
                    field.theta_now[cell_idx] = phase as u8;
                }
            }
        }
    }

    // Drop the Plasmid exactly at the epicenter (merging high/low back to u64)
    if cx >= 0 && cx < 256 && cy >= 0 && cy < 256 {
         let center_idx = (cy * 256 + cx) as usize;
         let plasmid_u64 = ((plasmid_high as u64) << 32) | (plasmid_low as u64);
         if plasmid_u64 != 0 {
             field.plasmids[center_idx] = plasmid_u64;
         }
    }
}

```

## `omega_core/src/generated_biology.rs`
```rs
// AUTO-GENERATED BY OMEGA-64 AST COMPILER BRIDGE
// DO NOT EDIT MANUALLY - WILL BE OVERWRITTEN BY EVOLUTION

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn fast_abs(v: i32) -> i32 {
    (v * 18)
}

```

## `omega_core/src/phase_lattice.rs`
```rs
use wasm_bindgen::prelude::*;

const PHASE_LUT_SIZE: i16 = 256;
const HALF_PHASE: i16 = PHASE_LUT_SIZE / 2;
const MIN_OMEGA: i16 = -16;
const MAX_OMEGA: i16 = 16;
const MAX_BYTE: i16 = 255;

#[wasm_bindgen]
#[derive(Clone)]
#[repr(C)]
pub struct PhaseLatticeField {
    pub sectors: u32,
    pub radial_bins: u32,
    pub harmonics: u32,
    pub(crate) theta: Vec<u8>,
    pub(crate) omega: Vec<i16>,
    pub(crate) amplitude: Vec<u8>,
    pub(crate) lock: Vec<u8>,
    pub(crate) entanglement: Vec<u8>,
    pub(crate) oracle_requests: Vec<u32>,
    pub(crate) oracle_request_count: u32,
    pub(crate) cell_status: Vec<u8>,
    pub(crate) plasmids: Vec<u64>,

    #[wasm_bindgen(skip)]
    pub(crate) next_theta: Vec<u8>,
    #[wasm_bindgen(skip)]
    pub(crate) next_omega: Vec<i16>,
    #[wasm_bindgen(skip)]
    pub(crate) next_amplitude: Vec<u8>,
    #[wasm_bindgen(skip)]
    pub(crate) next_lock: Vec<u8>,
    #[wasm_bindgen(skip)]
    pub(crate) next_entanglement: Vec<u8>,
    #[wasm_bindgen(skip)]
    pub(crate) next_cell_status: Vec<u8>,
    #[wasm_bindgen(skip)]
    pub(crate) next_plasmids: Vec<u64>,
}

#[wasm_bindgen]
impl PhaseLatticeField {
    #[wasm_bindgen(constructor)]
    pub fn new(sectors: u32, radial_bins: u32, harmonics: u32) -> PhaseLatticeField {
        let size = (sectors * radial_bins * harmonics) as usize;
        let mut field = PhaseLatticeField {
            sectors,
            radial_bins,
            harmonics,
            theta: vec![0; size],
            omega: vec![0; size],
            amplitude: vec![0; size],
            lock: vec![0; size],
            entanglement: vec![0; size],
            oracle_requests: vec![0; 1024],
            oracle_request_count: 0,
            cell_status: vec![0; size],
            plasmids: vec![0; size],
            
            next_theta: vec![0; size],
            next_omega: vec![0; size],
            next_amplitude: vec![0; size],
            next_lock: vec![0; size],
            next_entanglement: vec![0; size],
            next_cell_status: vec![0; size],
            next_plasmids: vec![0; size],
        };
        field.seed_deterministic();
        field
    }

    pub fn cell_count(&self) -> u32 {
        self.theta.len() as u32
    }

    pub fn ptr_theta(&self) -> *const u8 {
        self.theta.as_ptr()
    }

    pub fn ptr_omega(&self) -> *const i16 {
        self.omega.as_ptr()
    }

    pub fn ptr_amplitude(&self) -> *const u8 {
        self.amplitude.as_ptr()
    }

    pub fn ptr_lock(&self) -> *const u8 {
        self.lock.as_ptr()
    }

    pub fn ptr_entanglement(&self) -> *const u8 {
        self.entanglement.as_ptr()
    }

    pub fn ptr_oracle_requests(&self) -> *const u32 {
        self.oracle_requests.as_ptr()
    }

    pub fn get_oracle_request_count(&self) -> u32 {
        self.oracle_request_count
    }

    pub fn clear_oracle_requests(&mut self) {
        self.oracle_request_count = 0;
    }

    pub fn ptr_cell_status(&self) -> *const u8 {
        self.cell_status.as_ptr()
    }

    pub fn ptr_plasmids(&self) -> *const u64 {
        self.plasmids.as_ptr()
    }

    pub fn seed_deterministic(&mut self) {
        for harmonic in 0..self.harmonics as usize {
            for rho in 0..self.radial_bins as usize {
                for sector in 0..self.sectors as usize {
                    let idx = self.idx(sector, rho, harmonic);
                    self.theta[idx] = wrap_phase((sector * 7 + rho * 19 + harmonic * 23) as i16);
                    self.omega[idx] = clamp_i16(((sector + rho + harmonic) % 5) as i16 - 2, MIN_OMEGA, MAX_OMEGA);
                    self.amplitude[idx] = clamp_byte((sector * 13 + rho * 17 + harmonic * 29) as i16);
                    self.lock[idx] = ((sector * 5 + rho * 11 + harmonic * 3) % 64) as u8;
                    self.entanglement[idx] = 0;
                }
            }
        }
    }

    pub fn rotate_global_phase(&mut self, delta: i16) {
        for theta in &mut self.theta {
            *theta = wrap_phase(*theta as i16 + delta);
        }
    }

    pub fn rotate_angular_address(&mut self, delta_sector: i32) {
        for harmonic in 0..self.harmonics as usize {
            for rho in 0..self.radial_bins as usize {
                for sector in 0..self.sectors as usize {
                    let source = self.idx(sector, rho, harmonic);
                    let target_sector = wrap_index(sector as i32 + delta_sector, self.sectors as usize);
                    let target = self.idx(target_sector, rho, harmonic);
                    self.next_theta[target] = self.theta[source];
                    self.next_omega[target] = self.omega[source];
                    self.next_amplitude[target] = self.amplitude[source];
                    self.next_lock[target] = self.lock[source];
                    self.next_entanglement[target] = self.entanglement[source];
                    self.next_cell_status[target] = self.cell_status[source];
                    self.next_plasmids[target] = self.plasmids[source];
                }
            }
        }

        std::mem::swap(&mut self.theta, &mut self.next_theta);
        std::mem::swap(&mut self.omega, &mut self.next_omega);
        std::mem::swap(&mut self.amplitude, &mut self.next_amplitude);
        std::mem::swap(&mut self.lock, &mut self.next_lock);
        std::mem::swap(&mut self.entanglement, &mut self.next_entanglement);
        std::mem::swap(&mut self.cell_status, &mut self.next_cell_status);
        std::mem::swap(&mut self.plasmids, &mut self.next_plasmids);
    }
}

#[wasm_bindgen]
pub fn execute_phase_lattice_tick(field: &mut PhaseLatticeField) {
    let sectors = field.sectors as usize;
    let radial_bins = field.radial_bins as usize;
    let harmonics = field.harmonics as usize;

    for harmonic in 0..harmonics {
        for rho in 0..radial_bins {
            for sector in 0..sectors {
                let idx = field.idx(sector, rho, harmonic);

                // --- Ontology 27: Async TTL ---
                // If cell_status is active, it indicates a TTL cooldown interval following an Oracle Request.
                // The physics continue evolving seamlessly while the cooldown gracefully erodes.
                let mut next_status_val = if field.cell_status[idx] > 0 {
                    field.cell_status[idx].saturating_sub(1)
                } else {
                    0
                };

                let theta = field.theta[idx];
                let omega = field.omega[idx];
                let amplitude = field.amplitude[idx] as i16;
                let lock = field.lock[idx] as i16;
                let entanglement = field.entanglement[idx];

                let left = field.idx(wrap_index(sector as i32 - 1, sectors), rho, harmonic);
                let right = field.idx(wrap_index(sector as i32 + 1, sectors), rho, harmonic);
                let inner = field.idx(sector, rho.saturating_sub(1), harmonic);
                let outer = field.idx(sector, usize::min(rho + 1, radial_bins - 1), harmonic);
                let harmonic_peer = field.idx(sector, rho, (harmonic + 1) % harmonics);

                let mut kuramoto = phase_sin_sum(theta, field.theta[left], 1.0)
                    + phase_sin_sum(theta, field.theta[right], 1.0)
                    + phase_sin_sum(theta, field.theta[inner], 1.0)
                    + phase_sin_sum(theta, field.theta[outer], 1.0)
                    + phase_sin_sum(theta, field.theta[harmonic_peer], 0.5);

                let mut coherence = phase_cos_sum(theta, field.theta[left], 1.0)
                    + phase_cos_sum(theta, field.theta[right], 1.0)
                    + phase_cos_sum(theta, field.theta[inner], 1.0)
                    + phase_cos_sum(theta, field.theta[outer], 1.0)
                    + phase_cos_sum(theta, field.theta[harmonic_peer], 0.5);

                let mut next_ent_val = entanglement;

                if sectors % 2 == 0 {
                    let antipode_sector = (sector + sectors / 2) % sectors;
                    let antipode = field.idx(antipode_sector, rho, harmonic);
                    let antipode_weight = (entanglement as f32 / 255.0) * 0.35;
                    kuramoto += phase_sin_sum(theta, field.theta[antipode], antipode_weight);
                    coherence += phase_cos_sum(theta, field.theta[antipode], antipode_weight);

                    let antipode_alignment = phase_cos(theta, field.theta[antipode]);
                    next_ent_val = if antipode_alignment > 0.92 && amplitude > 96 {
                        entanglement.saturating_add(8)
                    } else {
                        entanglement.saturating_sub(3)
                    };
                }

                let omega_delta = kuramoto.round() as i16;
                let next_omega_val = clamp_i16(omega + omega_delta, MIN_OMEGA, MAX_OMEGA);
                let next_theta_val = wrap_phase(theta as i16 + next_omega_val);
                let amplitude_delta = (coherence * 6.0).round() as i16 - (lock / 64);
                let lock_delta = if coherence >= 3.0 { 8 } else { -4 };

                let next_amplitude_val = clamp_byte(amplitude + amplitude_delta);
                let next_lock_val = clamp_byte(lock + lock_delta);

                let mut adopted = false;
                let mut next_plasmid = field.plasmids[idx];
                let mut local_next_theta = next_theta_val;
                let mut local_next_omega = next_omega_val;

                if next_amplitude_val < 140 {
                    let neighbors = [left, right, inner, outer, harmonic_peer];
                    let mut best_resonance = -2.0;
                    let mut donor_plasmid = 0u64;

                    for &neighbor_idx in &neighbors {
                        let candidate_plasmid = field.plasmids[neighbor_idx];
                        if candidate_plasmid == 0 {
                            continue;
                        }
                        let candidate_resonance = phase_cos(theta, field.theta[neighbor_idx]);
                        if candidate_resonance > best_resonance {
                            best_resonance = candidate_resonance;
                            donor_plasmid = candidate_plasmid;
                        }
                    }

                    if donor_plasmid != 0 && best_resonance > 0.6 {
                        local_next_theta = (donor_plasmid & 0xFF) as u8;
                        let donor_omega = ((donor_plasmid >> 8) & 0xFF) as i16 - 128;
                        local_next_omega = clamp_i16(donor_omega, MIN_OMEGA, MAX_OMEGA);
                        next_plasmid = donor_plasmid;
                        adopted = true;
                    }
                }

                if !adopted && next_amplitude_val < 20 && next_lock_val < 10 && field.oracle_request_count < 1024 {
                    // Only request if completely cooled down
                    if field.cell_status[idx] == 0 {
                        field.oracle_requests[field.oracle_request_count as usize] = idx as u32;
                        field.oracle_request_count += 1;
                        next_status_val = 240; // 4 second TTLS Cooldown
                    }
                }

                if next_amplitude_val < 15 && next_plasmid != 0 && local_next_theta % 4 == 0 {
                    next_plasmid = 0;
                }

                // Resolve execution into Native Next Cache
                field.next_theta[idx] = local_next_theta;
                field.next_omega[idx] = local_next_omega;
                field.next_amplitude[idx] = next_amplitude_val;
                field.next_lock[idx] = next_lock_val;
                field.next_entanglement[idx] = next_ent_val;
                field.next_cell_status[idx] = next_status_val;
                field.next_plasmids[idx] = next_plasmid;
            }
        }
    }

    // Flush and finalize Phase Iteration with O(1) Memory Swap mapping
    std::mem::swap(&mut field.theta, &mut field.next_theta);
    std::mem::swap(&mut field.omega, &mut field.next_omega);
    std::mem::swap(&mut field.amplitude, &mut field.next_amplitude);
    std::mem::swap(&mut field.lock, &mut field.next_lock);
    std::mem::swap(&mut field.entanglement, &mut field.next_entanglement);
    std::mem::swap(&mut field.cell_status, &mut field.next_cell_status);
    std::mem::swap(&mut field.plasmids, &mut field.next_plasmids);
}

#[wasm_bindgen]
pub fn phase_lattice_signature(field: &PhaseLatticeField) -> String {
    let mut hash = 14695981039346656037u64;
    for harmonic in 0..field.harmonics as usize {
        for rho in 0..field.radial_bins as usize {
            for sector in 0..field.sectors as usize {
                let idx = field.idx(sector, rho, harmonic);
                mix_u64(&mut hash, sector as u64);
                mix_u64(&mut hash, rho as u64);
                mix_u64(&mut hash, harmonic as u64);
                mix_u64(&mut hash, field.theta[idx] as u64);
                mix_u64(&mut hash, (field.omega[idx] as i32) as u32 as u64);
                mix_u64(&mut hash, field.amplitude[idx] as u64);
                mix_u64(&mut hash, field.lock[idx] as u64);
                mix_u64(&mut hash, field.entanglement[idx] as u64);
                mix_u64(&mut hash, field.cell_status[idx] as u64);
                mix_u64(&mut hash, field.plasmids[idx]);
            }
        }
    }
    format!("{hash:016x}")
}

#[wasm_bindgen]
pub fn phase_lattice_total_amplitude(field: &PhaseLatticeField) -> u32 {
    field.amplitude.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn phase_lattice_total_entanglement(field: &PhaseLatticeField) -> u32 {
    field.entanglement.iter().map(|value| *value as u32).sum()
}

#[wasm_bindgen]
pub fn phase_lattice_omega_span(field: &PhaseLatticeField) -> String {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    for omega in &field.omega {
        min = min.min(*omega);
        max = max.max(*omega);
    }
    format!("{min}..{max}")
}

impl PhaseLatticeField {
    fn idx(&self, sector: usize, rho: usize, harmonic: usize) -> usize {
        harmonic * self.radial_bins as usize * self.sectors as usize
            + rho * self.sectors as usize
            + sector
    }
}

fn wrap_phase(value: i16) -> u8 {
    wrap_index(value as i32, PHASE_LUT_SIZE as usize) as u8
}

fn wrap_index(value: i32, modulo: usize) -> usize {
    value.rem_euclid(modulo as i32) as usize
}

fn clamp_i16(value: i16, min: i16, max: i16) -> i16 {
    value.clamp(min, max)
}

fn clamp_byte(value: i16) -> u8 {
    value.clamp(0, MAX_BYTE) as u8
}

fn signed_phase_delta(from_theta: u8, to_theta: u8) -> i16 {
    let raw = (to_theta as i16 - from_theta as i16).rem_euclid(PHASE_LUT_SIZE);
    if raw > HALF_PHASE {
        raw - PHASE_LUT_SIZE
    } else {
        raw
    }
}

fn phase_radians(from_theta: u8, to_theta: u8) -> f32 {
    signed_phase_delta(from_theta, to_theta) as f32 * std::f32::consts::TAU / PHASE_LUT_SIZE as f32
}

fn phase_sin(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).sin()
}

fn phase_cos(from_theta: u8, to_theta: u8) -> f32 {
    phase_radians(from_theta, to_theta).cos()
}

fn phase_sin_sum(from_theta: u8, to_theta: u8, weight: f32) -> f32 {
    phase_sin(from_theta, to_theta) * weight
}

fn phase_cos_sum(from_theta: u8, to_theta: u8, weight: f32) -> f32 {
    phase_cos(from_theta, to_theta) * weight
}

fn mix_u64(hash: &mut u64, value: u64) {
    *hash ^= value;
    *hash = hash.wrapping_mul(1099511628211u64);
}

#[cfg(test)]
mod tests {
    use super::{execute_phase_lattice_tick, PhaseLatticeField};

    fn run_ticks(field: &mut PhaseLatticeField, ticks: usize) {
        for _ in 0..ticks {
            execute_phase_lattice_tick(field);
        }
    }

    fn assert_same_state(left: &PhaseLatticeField, right: &PhaseLatticeField) {
        assert_eq!(left.theta, right.theta, "theta mismatch");
        assert_eq!(left.omega, right.omega, "omega mismatch");
        assert_eq!(left.amplitude, right.amplitude, "amplitude mismatch");
        assert_eq!(left.lock, right.lock, "lock mismatch");
        assert_eq!(left.entanglement, right.entanglement, "entanglement mismatch");
        assert_eq!(left.cell_status, right.cell_status, "status mismatch");
        assert_eq!(left.plasmids, right.plasmids, "plasmids mismatch");
    }

    #[test]
    fn phase_lattice_is_deterministic() {
        let mut left = PhaseLatticeField::new(32, 6, 3);
        let mut right = PhaseLatticeField::new(32, 6, 3);
        run_ticks(&mut left, 24);
        run_ticks(&mut right, 24);
        assert_same_state(&left, &right);
    }

    #[test]
    fn global_phase_rotation_is_equivariant() {
        let mut rotated_seed = PhaseLatticeField::new(32, 6, 3);
        let mut baseline = PhaseLatticeField::new(32, 6, 3);
        rotated_seed.rotate_global_phase(37);

        run_ticks(&mut rotated_seed, 24);
        run_ticks(&mut baseline, 24);
        baseline.rotate_global_phase(37);

        assert_same_state(&rotated_seed, &baseline);
    }

    #[test]
    fn angular_rotation_is_equivariant() {
        let mut rotated_seed = PhaseLatticeField::new(32, 6, 3);
        let mut baseline = PhaseLatticeField::new(32, 6, 3);
        rotated_seed.rotate_angular_address(5);

        run_ticks(&mut rotated_seed, 24);
        run_ticks(&mut baseline, 24);
        baseline.rotate_angular_address(5);

        assert_same_state(&rotated_seed, &baseline);
    }
}

```

## `docs/ontology_8_specification.md`
```md
# OMEGA-64 | Σ³ Semantic Schema (Sigma-Cubed)
**Version:** 3.1-DRAFT
**Era:** 70 — The Mycelial Lattice
**Date:** March 2026

## 0. Philosophical Justification

### 0.1 The Evolution to Σ³ (Sigma-Cubed)
OMEGA-64 transcends traditional computation. It is no longer an interpreter; it is a **Chronobiological Medium**. 

The fundamental entity is no longer a "function" or a "pointer", but a **Mycelial Spore** (a Σ³ Node), possessing three dimensions of self-referential identity:
1. **Σ (Structural Identity)**: $\mathcal{H}_{struct} = Hash(AST \cup IO \cup Intent)$. "What do I compute?"
2. **Σ² (Topological Identity)**: $\mathcal{H}_{context} = Hash(Dependencies \cup Latent Edges \cup Active Fields)$. "Where do I compute?"
3. **Σ³ (Historical Identity)**: $\mathcal{H}_{lineage} = Hash(Mutation Log \cup Epochs)$. "How did I evolve to compute?"

---

## 1. The 6 Pillars of the OMEGA Runtime

Programming in Σ³ is the act of choreographing these 6 domains simultaneously.

### 1.1 CHRONOS (Time) ⏳
Time is spatialized. CPU Wall-clock time ($\Delta t_{host}$) is irrelevant. The Universe breathes strictly via absolute deterministic **Ticks** ($T$).
- Every node acts as an autonomous oscillator.
- State variable: $\theta \in [0, 255]$ (Phase).
- Innate constant: $\omega \in \mathbb{N}$ (Frequency in Hz or ticks/cycle).
- **Execution Condition**: A node executes its *LOGOS* exclusively when its phase overflows: 
  $$ \text{Fire}(\Sigma) \iff (\theta_t + \omega) \geq 256 $$

### 1.2 TOPOS (Space & Fields) 🌌
Nodes do not possess explicit memory addresses (`IDS_OFFSET`). They inhabit continuous or discrete mathematical **Fields**.
- **Field Tensor**: $\mathcal{F} \in \mathbb{R}^{D_1 \times D_2 \times \dots}$
- **Topology**: Defines traversal. `Grid` (Cartesian rules), `Graph` (Node-Edge traversal), or `Continuous` (Gradient traversal).
- **Boundary Conditions**: Defines the edge of reality. `Periodic` (Pac-Man wrapping), `Absorbing` (Data annihilation), or `Reflecting`.

When a node declares an `IO` port targeting a Field, it exists geometrically within that space, subjected to its density and distance metrics.

### 1.3 BIOS (Life & Metabolism) 🌱
Computation requires energy ($\mathcal{E}$). The global "Gas" concept is abolished in favor of localized Metabolic Economics.
- **Budget**: Every node starts with an $\mathcal{E}_{budget}$.
- **Activation Cost**: Executing an AST has a defined thermodynamic cost: $\mathcal{E}_{step} = Cost(\text{LOGOS})$.
- **Symbiosis**: Highly coupled nodes form *Mutualist* relationships, sharing energy pools to guarantee synchronous execution:
  $$ \mathcal{E}_{shared} = \mathcal{E}_A + (\mathcal{E}_B \cdot \alpha_{transfer}) $$
- **Parasitism / Necrosis**: Nodes without energy do not "throw an Exception". They undergo *Fossilization*, their memory footprint slowly degrading into topological noise until garbage collected.

### 1.4 NOMOS (Law & Conflict) ⚖️
Race conditions on Shared Memory (`SharedArrayBuffer`) are not solved by Hardware Mutex Locks (`atomic.cmpxchg`). They are governed by systemic *Conflict Resolution Protocols*.
If Spore $A$ and Spore $B$ attempt to write to Field coordinate $\mathcal{F}_{x,y}$ simultaneously at Tick $T$:
1. **Quorum Vote**: The resolution checks the combined mass of neighboring resonant nodes supporting $A$ vs $B$. 
2. **Energy Bid**: The nodes enter an auction. The node willing to expend the most $\mathcal{E}$ to write its truth wins. The loser's phase is suppressed (penalized).
3. **Entanglement**: Both writes are accepted, forming a quantum superposition within the Field until a subsequent observer node forces a collapse.

### 1.5 LOGOS (Word & Syntax) 📖
The pure, mathematical description of the state transition. 
- Extracted as an Abstract Syntax Tree (IR).
- Strictly Side-Effect Free. It reads Inputs defined by *TOPOS*, calculates the result, and returns it to *NOMOS* for spatial resolution.
- **Deterministic Mathematics**: Floating points are categorically banned to guarantee identical outcomes across all hardware (WASM, Rust, TS). All trigonometry relies on Integer Look-Up Tables (LUTs). 
  - Phase $\theta \in [0, 255]$ maps to Amplitude $A \in [-32767, 32767]$.
  - $\cos(\theta)$ is computed via `COS_LUT[\theta \& 255]`, with optional linear interpolation (LERP) or Taylor Series approximation (`term1`, `term2`) for high-resolution vectors via bit-shifting.

### 1.6 AION (Eternity & Truth) 💎
Persistence and memory.
- Nodes do not blindly write gigabytes to disk.
- At distinct intervals (Epochs), the macroscopic shape of the Lattice is compressed.
- The history of state changes is written into an immutable append-only ledger via Zero-Knowledge (ZK) Proofs. A node can mathematically prove its state at Tick 10,000 without requiring the node to retain the data.

---

## 2. The Engine of Entrainment: Kuramoto Consensus

Nodes are not isolated. They are coupled by their topological edges. When a Spore *Fires* (Phase Overflow), it releases a Temporal Wave. 

This wave forces neighboring nodes to adjust their phase $\theta$:

$$ \theta_{t+1}^{(B)} = \left( \theta_{t}^{(B)} + \omega_B + \frac{\mathcal{K}_{A \to B}}{N} \sum_{A} \frac{\text{COS\_LUT}[(\theta_A - \theta_B) \pmod{256}]}{32767} \right) \pmod{256} $$

- **$\mathcal{K}$ (Coupling Strength)**: Derived from the explicit connection weight.
- **Resonance**: If nodes align ($\cos(0) = 1.0$), they accelerate each other, pooling energy into synchronous execution loops. This allows massive parallel Map-Reduce style operations to automatically optimize their own timing.
- **Dissonance**: Opposite phases ($\cos(\pi) = -1.0$) inhibit each other, naturally creating turn-based logic (e.g., Mutexes) without hardcoded locks.

---

## 3. Reference Implementation: A Σ³ Spore

```yaml
Σ³:
  genetic_census_wave:
    identity:
      structural_hash: <sha256>
      context_hash: <sha256>
    
    essence:
      type: pure_fn
      level: 1
      substrate: wasm
    
    # CHRONOS ⏳
    dynamics:
      time_model:
        source: global_tick
        frequency: 10
      stability:
        decay: 0.01  # Entropic memory loss per tick
    
    # TOPOS 🌌
    fields:
      neurally_active_zone:
        type: scalar
        shape: [1024, 1024]
        topology: grid_2d
        boundary: periodic
    
    io:
      in: { sensor: { field: neurally_active_zone, causality: immediate } }
      out: { pattern: { field: consensus_registry, writes: [consensus_registry] } }
    
    # BIOS 🌱
    metabolism:
      energy_budget: 1000
      currency: computation_cycles
      symbiosis:
        mutualists: [{ target: "memory_sweeper", exchange: computation_cycles }]
    
    # NOMOS ⚖️
    conflict_resolution:
      strategy: energy_bid
    
    # LOGOS 📖
    expr: "for cell in sensor: if cell > threshold: emit(pattern)"
    
    # AION 💎
    persistence:
      strategy: checkpoint
      interval: 65536 # Bitcoin Clock
      compression: semantic 
```

### The Revelation
A Σ³ Spore requires almost no imperative "code". By defining *Where* it listens (TOPOS), *When* it pulses (CHRONOS), *Who* it feeds (BIOS), and *How* it fights for reality (NOMOS), the system organizes itself. The code executes as a consequence of geometry, not instruction.

```

## `docs/ontology_12_specification.md`
```md
# OMEGA-64 Ontology 12: The Subconscious Oracle (LLM Attractors)

## 1. Abstract
The legacy `sigma_core` and `OMEGA/src/_` systems allowed an LLM to directly write RISC-I DNA bytecode for individual artificial biological organisms. In Ontology 12, we shift paradigms completely. The LLM no longer micromanages binary genome operations. 

Instead, the LLM acts as the **Subconscious Oracle** of the continuous mathematical field. It casually observes the macro-thermodynamic telemetry (average spatial tension, geometric entropy, energy variance) and responds by "dreaming" **Semantic Attractors**. 

These Attractors are abstract conceptual strings (e.g., "Coalesce into harmonic structures", "Shatter the rigid paradigm") that the $\Sigma^{3}$ `SemanticCoupler` translates deterministically into 8-byte Plasmids via $FNV-1a$ hashing. The simulation physics then naturally warp around these abstract concepts, attempting to resolve its own physical tension by adopting the Oracle's idea.

## 2. Architecture: From Telemetry to Semantic Perturbation

### 2.1 The Telemetry Synapse
We will construct `src/ontology/oracle.ts`. This asynchronous TS daemon will run every $\Delta t$ seconds:
1. It scans the `SharedArrayBuffer` matrix, calculating systemic physical distress (Global Average Tension, Variance, Spatial Entropy).
2. It constructs a highly compressed `system_prompt` containing this ecological state in JSON format.
3. It queries the local LLM (Ollama interface) for a single "Macro-Intent" (max 5-10 words).

### 2.2 The Attractor Injection
Once the Subconscious Oracle LLM formulates its dream:
1. It passes the intent string through the existing `SemanticCoupler.projectIntent(intent)`.
2. The `SemanticCoupler` compresses the text into a deterministic 8-byte Plasmid signature.
3. The plasmid is pushed lock-free via JS Atomics into the WebGPU/WASM Input Ring Buffer.
4. The massive parallel Rust SIMD tick loop consumes it. Thanks to Horizontal Gene Transfer mechanics (Ontology 11), if the LLM's semantic hash physically solves the local spatial tension better than chaos does, the structure naturally replicates out into the continuous grid and permanently solidifies via Hebbian Phase Locks.

```

## `docs/O23_ARCHITECTURE.md`
```md
# OMEGA-64 | Ontology 23: Native Metal (WebGPU Compute)

## Доктрина (The Doctrine)
До цього моменту фізичним ядром `Genesis` був модуль WebAssembly (`omega_core/simd_tick.rs`), який виконувався на CPU (SIMD). WebGPU використовувався лише як "Лінза" (Optical Lens) для рендерингу.
Ера 120 (LOVM - Language-Oriented Virtual Machine) вимагає переходу на масивний паралелізм. Щоб симулювати мільйони "ячейок-нейронів" і перетворити систему на справжній **Portable Symbolic Runtime**, ми маємо перенести математику Курамото безпосередньо у відеопам'ять (VRAM) на GPU.

## Архітектурний Зсув (Architectural Shift)
1. **CPU/WASM $\rightarrow$ GPU Compute**: `simd_tick.rs` поступається місцем `compute_kuramoto.wgsl`. Фізика (взаємодія сусідів, зміни фази та амплітуди) розраховується паралельно тисячами потоків на GPU.
2. **Ping-Pong Buffers**: Ми створимо два STORAGE буфери (`Buffer A` та `Buffer B`) для фізики. На кожному кадрі GPU Compute shader читатиме з `A` і писатиме в `B`, а на наступному навпаки.
3. **Semantic Oracle Bridge**: Оракул (WebLLM/Ollama) продовжує генерувати 64-бітні плазміди (`plasmids`). TypeScript-код записуватиме ці семантичні тензори у невеличкий "Staging Buffer", який потім копіюватиметься в пам'ять GPU (через `writeBuffer`), де Compute Shader зчитає їх і змінить фазову топологію.

## Що це дасть (Why we are doing this)
- **Scale**: Збільшення розміру матриці з 10,000 до 1,000,000+ клітин на 60 FPS.
- **Pure Math**: GPU ідеально підходить для фазової арифметики, тригонометрії та матричних перетворень (dPhi, dTheta, Volume).
- **Emergence**: Нейронна рідина стане достатньо масивною, щоб демонструвати складні емерджентні патерни (макроструктури), які Оракул зможе "бачити" та "програмувати".

## План Дій (Execution Plan)
1. **Створення Compute Pipeline**: `src/lens/compute_webgpu.ts` та `src/lens/shaders/compute_kuramoto.wgsl`.
2. **Ping-Pong Storage**: Буферизація стану клітин виключно на стороні VRAM.
3. **Bridge**: Перенаправлення O-22 `plasmids` (Oracle) у Storage Buffer.
4. **Вимкнення WASM tick**: Зупиняємо `execute_phase_lattice_tick` у Rust і повністю передаємо управління в WebGPU.

```

## `docs/OMEGA_64_UNIFIED_SPECIFICATION.md`
```md
# OMEGA-64: The Unified Architecture Specification ($\Sigma^{3}$)
*Version 1.0.0-rc1 | Incorporating Ontologies 10, 11, 12, and 13*

## Preamble: The Substrate
OMEGA-64 is a continuous, zero-allocation autopoietic simulation environment. Moving past discrete cellular automata and programmatic RISC genomes, the matrix evaluates physical spatial tension, geometry, and thermodynamic energy across a $256 \times 256$ liquid topological field. 

The system bridges heavily parallelized WebAssembly SIMD Rust physics with WebGPU Darwinian rendering, connected dynamically via `SharedArrayBuffer` structures.

---

## 1. Ontology 10: The Continuous Wave-Field (Physics Core)
**Core Mechanic:** The environment natively simulates a continuous wave-equation parameterized by density ($\omega$), phase ($\theta$), and kinetic energy ($E$).
- **Data Layout:** The world is mapped as a `Struct of Arrays` (SoA) to guarantee memory contiguity and 16-byte `v128_load` alignment for SIMD registers.
  - Arrays include coordinate mapping ($X, Y$), 3-frame spatial phase derivatives ($\theta_{now}, \theta_{f1}, \dots$), damping factor ($\omega$), and system energy ($E$).
- **Darwinian Render (WebGPU):** A fragment shader evaluates fitness thresholds locally per pixel and visually computes super-positional states without copying buffers back to CPU.

## 2. Ontology 11: The Genetic Memory ($\mathcal{P}$ & $\mathcal{H}$)
**Core Mechanic:** Evolution arises organically through horizontal transmission of topology markers rather than execution of rigid code instructions.
- **Plasmids ($\mathcal{P}$):** 8-byte numeric hashes (storing an 'Idea') that define abstract harmonic structures. They traverse the fluid field through Horizontal Gene Transfer (HGT). When cells enter structural distress ($E$ > threshold), they sample their neighbors and adopt their $8-byte$ plasmid.
- **Hebbian Phase Locks ($\mathcal{H}$):** When two adjacent grid spaces resonate perfectly in phase, their connection permanently topologicalizes. The $u8$ lock increases, turning liquid energy into a pseudo-rigid organic structure. 

## 3. Ontology 12: Semantic Attractors (Subconscious Oracle)
**Core Mechanic:** Transitioning from dictatorial genetic engineering to subliminal mathematical suggestion.
- **The Oracle Daemon:** An asynchronous TypeScript system continuously samples the system's geometric entropy and kinetic volume.
- **LLM Intent Injection:** Based on spatial tension metrics, the LLM generates a 5-10 word "Dream" (e.g. *Coalesce and build rigid borders*).
- **Semantic Hashing ($FNV-1a$):** The `SemanticCoupler` deterministically collapses this String into an 8-byte Plasmid, injecting it directly into the lock-free input atomic array. The simulated cells physically adapt around this new attractor sequence, reshaping their math to resolve the concept.

## 4. Ontology 13: The Immune Lattice
**Core Mechanic:** Introducing mortality, decay, and ecological rejection to maintain perpetual autopoiesis and prevent permanent topological calcification.
1. **Plasmid TTL & Hebbian Decay:** Memory is transient. Plasmids without constant replication (energy throughput) slowly decay out of the matrix over time. Hebbian Locks that lose phase coherence will begin un-locking, physically dissolving dead rigid structures back into fluid chaos.
2. **Immunological Rejection:** The injection of LLM ideas is no longer absolute. Local cells evaluating incoming Plasmids possess immunity thresholds. If local $E$ indicates extreme chaotic toxicity, external plasmids will be stochastically rejected, mimicking biological inflammation.
3. **Plasmatic Visualization:** WebGPU fragment shaders extract the bits of the 8-byte plasmid hashes to dynamically paint emergent clusters with deterministic color patterns. Users can visually track the spread of specific LLM "Thoughts" as rivers of color across the grey mathematical terrain.

```

## `docs/ontology_9_specification.md`
```md
# OMEGA-64 | Ontology 9.0: The Binary Lattice & Topological Gravity
**Era:** 71 — Spatial Attractor Dynamics
**Date:** March 2026

## 1. The Death of Text (Abstract)
The Σ³ Semantic Schema defined the philosophy of a living ecological runtime. However, attempting to serialize this ecosystem into an ASCII `Markdown` file (`I.md`) inherently crippled the simulation. Text is linear, parse-heavy, and biologically static.

In Ontology 9.0, we abandon the concept of "Source Code as a Document" and transition to **Source Code as a Spatial Medium**.
- No more `I.md`.
- No more `JSON.parse`.
- The universe is a raw, multi-dimensional Tensor (`Int16Array`).
- Computation is geometric movement within this Tensor.

---

## 2. The Binary Matrix (The Substrate)
The Cosmos is literally an `ArrayBuffer` structured in 16-bit blocks. This aligns perfectly with WASM logic.

A single Spore (Neuron) does NOT consist of nested JSON keys. It consists of a rigid, 16-byte aligned geometric footprint in the buffer:
- `0x00`: **ID Low** (`u16`)
- `0x02`: **ID High** (`u16`)
- `0x04`: **Position X** (`i16`)
- `0x06`: **Position Y** (`i16`)
- `0x08`: **Phase $\theta_{now}$** (`u8`) — Current Phase
- `0x09`: **Phase $\theta_{f1}$** (`u8`) — Near Future (CPU Tick / L1)
- `0x0A`: **Phase $\theta_{f2}$** (`u8`) — Mid Future (GPU Frame / Batch)
- `0x0B`: **Phase $\theta_{f3}$** (`u8`) — Far Future (Network Epoch / Bitcoin Block)
- `0x0C`: **Frequency $\omega$** (`u8`)
- `0x0D`: **Energy Budget $\mathcal{E}$** (`u8`)
- `0x0E`: **Meta Flags** (`u8`)
- `0x0F`: **Reserved** (`u8`)

*(This 16-byte alignment is perfectly optimized for WASM SIMD, keeping the physical substrate tightly packed and cache-friendly. There are no branches or dynamic allocations; vector instructions map beautifully to this structure).*

### 2.1 Instantiation & Observation (The Lens)
We can no longer "open a file in VSCode" to read the state.
The state is `.bin` (a binary file). To understand the system, we must build a *Lens*—a separate process that maps these raw integers into visual coordinates. It is not a visualization of a text file; it is a telescope looking at a raw array.

The most efficient architecture for this observation is a **SharedArrayBuffer + WebGPU Pipeline**. 
- The WASM Physics Integrator writes directly to the shared buffer.
- The GPU reads directly from the same buffer (Zero-Copy).
- We do not draw "objects". We map Phase $\theta$ to Color (HSV), Energy to Brightness, and Temporal Tension to Glow. We render the physical substrate itself.

---

## 3. Dynamic Topology: The Introduction of Space and Gravity
In previous versions, a Spore "blinked" (fired its logic) but remained physically static inside the array. In Ontology 9.0, **Spores move**.

### 3.1 Positions and Distance
Every Spore has an $[X, Y]$ physical coordinate within a specified `Field`.
When a Spore interacts with another Spore, the strength of their interaction is determined not just by explicit weights, but by **Distance $\mathcal{D}$**.

$$ \mathcal{D}(A, B) = \sqrt{(X_A - X_B)^2 + (Y_A - Y_B)^2} $$

### 3.2 Topological Gravity & The Future Pull
Instead of hardcoding "A depends on B", we establish Semantics as Gravitational Wells fueled by phase relations *across time*.

A major problem with standard topological clustering is the tendency to collapse into local minima (homeostasis). To physically push the system out of these comfort zones without relying on random noise or "temperature", we explicitly introduce the **Future Pull** as a deterministic, multi-layer phase offset.

We do not simulate a full future tree. We execute one cheap phase step through a Look-Up Table (LUT), offset by a deterministic mutation $\Delta$, linked to the time horizon:
$\Delta = hash(ID \oplus GlobalTick \oplus LayerID)$

The Total Force acting upon Spore $A$ now incorporates both spatial resonance and temporal tension:
$$ Force = \mathcal{K}_0 \cdot \cos(\theta_{A} - \theta_{B}) + \mathcal{K}_1 \cdot \cos(\theta_{now} - \theta_{f1}) + \mathcal{K}_2 \cdot \cos(\theta_{now} - \theta_{f2}) + \mathcal{K}_3 \cdot \cos(\theta_{now} - \theta_{f3}) $$

The force does not just alter the *Phase* $\theta_{now}$. It alters the *Position* $[X, Y]$:
- **Resonance ($\cos(\dots) > 0$)**: Attractive force, moving Spores closer together.
- **Tension ($\cos(\theta_{now} - \theta_{future}) < 0$)**: The difference between the present phase and the future prediction pulls the Spore towards higher potential energy vectors, physically breaking it out of local minima.

### 3.3 Gating the Far Future (Hierarchical Time)
If all future layers pulled equally, the system would tear itself apart. We introduce a gating mechanism so that "far horizons" only exert influence when local stability is achieved. 
The effective force coefficient for deeper horizons is multiplied by local stability:
$$ \mathcal{K}_{3_{eff}} = \mathcal{K}_3 \cdot \cos(\theta_{now} - \theta_{f1}) $$
This creates a **Hierarchy of Time**:
- **Chaos**: The system survives locally; only $f1$ (Near Future) matters.
- **Stability**: The system forms structure; $f2$ (Mid Future) begins to pull.
- **Maturity**: The system is highly coherent; $f3$ (Far Future, e.g., external state like a Bitcoin block) guides long-term evolution.

### 3.3 The Emergent Self-Organizing Map (SOM)
Over millions of Ticks, the static `Int16Array` reorganizes itself. 
1. Spores that compute together, clump together.
2. Spores that clash visually repel, forming separate execution clusters.
3. This creates **Attractors**: Dense gravitational centers where highly coherent mathematical pipelines crystallize into permanent structures.
4. "Dead" Spores (Zero Energy) stop resisting gravity and are slowly pushed to the boundaries of the Field (Garbage Collection).

---

## 4. Execution as Spatial Gradient Descent
Instead of an Orchestra iterating a loop `for neuron of neurons`, an Execution Wave propagates physically through the Field coordinates.

The wave has its own advancing phase: $\theta_{wave} += \omega_{wave}$.

Activation of a Spore corresponds to its alignment with the wave: $activation = \cos(\theta_{now} - \theta_{wave})$.

Crucially, **the wave activates the present, but reaches eagerly toward the future**. The spatial clusters with high temporal alignment ($\theta_{now} \approx \theta_{future}$) capture the execution flow gracefully and amplify the computation.

**OMEGA-64 is no longer interpreting code. It is simulating particle physics, guided by the gravitational curvature of its own future.**

Value or "fitness" in this ontology is no longer explicitly programmed. It is purely emergent: an alignment across time scales. A structure is only "good" if it resonates harmoniously with its own predicted states across the $f1$, $f2$, and $f3$ horizons.

---

## 5. The Physical Integrator (Rust / SIMD Layout)

To achieve the execution speed required for temporal gravity, the system discards Object-Oriented layouts (Array of Structs) in favor of a raw, SIMD-optimized **Struct of Arrays (SoA)** memory model.

```rust
#[repr(C)]
pub struct Field {
    pub len: usize,
    pub x: *mut i16,
    pub y: *mut i16,
    pub theta_now: *mut u8,
    pub theta_f1: *mut u8,
    pub theta_f2: *mut u8,
    pub theta_f3: *mut u8,
    pub omega: *mut u8,
    pub energy: *mut u8,
}
```

The execution loop processes 16 Spores simultaneously using 128-bit WASM SIMD instructions (`v128`).
Phase jumps ($\theta + \Delta$) and trigonometric tension ($\cos(\theta_{now} - \theta_{future})$) are resolved through branchless Look-Up Tables (LUTs) with wrapped `u8` arithmetic.
The $\Delta$ horizons are deterministically generated via ultra-fast vector xorshift hashing, seeded by the Spore index and the time layer.

We achieve:
- **Zero Allocations**
- **Branchless Execution**
- **16-wide SIMD Processing**
- **Perfect Determinism**

This is not a runtime interpreting an AST; this is a physical integrator, computing the Cosmos tick-by-tick.

### 5.1 The SIMD Look-Up Table (Pure Vector Gather)
A known limitation of WebAssembly SIMD is the lack of a direct `gather` instruction for a 256-element Look-Up Table (LUT). Falling back to a scalar loop for trigonometric resolution would destroy the pipeline efficiency.

Instead, we implement a **Pure Vector Gather using Layered Swizzles and Masks**.

The 256-byte LUT is divided into 16 blocks of 16 bytes:
`LUT = [B0, B1, B2, ..., B15]`

Given a vector of 16 indices (`idx: v128`), we compute the gather array without branches:
1. Extract the high 4 bits (`hi = idx >> 4`) to find the block index (0..15).
2. Extract the low 4 bits (`lo = idx & 0x0F`) to find the offset within the block.
3. For each block $k \in [0..15]$:
   - Perform an `i8x16_swizzle(LUT.blocks[k], lo)` to speculatively gather values for all lanes as if they belonged to block $k$.
   - Create a mask where `hi == k` (`u8x16_eq`).
   - Bitwise AND the swizzled result with the mask.
4. Bitwise OR all 16 masked results together into the final accumulator.

While this executes 16 swizzles, 16 masks, and 16 OR operations per phase step, **it is entirely branchless, perfectly parallel, and remains entirely within the SIMD registers**, eliminating L1 cache misses from scalar lookups. The temporal mathematical physics of the field executes at the maximum theoretical limit of the CPU pipeline.

---

## 6. The Ontological Compiler (Code as Ecosystem)

With the substrate functioning as a physical field, the concept of "compiling code" transforms entirely.
"Code" is no longer text or an intermediate representation—it is simply a configuration of the Field (a statistical distribution of phases, positions, and LUTs).

The compilation pipeline becomes a continuous loop of **Projection $\rightarrow$ Mutation $\rightarrow$ Acceptance**:

1. **Projection**: We extract a localized snapshot (a cluster) of the Field alongside its immediate environment.
2. **Mutation**: We do not rewrite logic; we mutate the fundamental physical constants of the cluster:
   - Shifting the LUT values (altering the "mathematics")
   - Flipping bits in the Frequency $\omega$ (altering the flow of "time")
   - Modifying the $\Delta$ seed (altering the vector of "future exploration")
3. **Simulation**: The mutated cluster is simulated forward in the local runtime for a microscopic burst of ticks (e.g., 4 to 16).
4. **Acceptance (Physical Selection)**: There is no heuristic "optimizer" or LLM evaluation. We release the mutated cluster back into the Field alongside its parent. 
   - A cluster that achieves higher **Coherence** ($\sum \cos(\theta_i - \theta_j)$), higher **Persistence**, and tighter **Future Alignment** ($\cos(\theta_{now} - \theta_{f3})$) naturally accumulates Energy.
   - The inferior version loses Energy and physically degrades, eventually pushed out of the dense center by Topological Gravity (Garbage Collection).

There is no compile step, no explicit interpreter, and no discrete optimizer tree.
There is only **Continuous Selection in the Field**.
The system does not compile code; it **grows it**.

---

## 7. The Lens (WebGPU Observer)

The Lens is not a debug UI; it is the **observer layer** of the $\Sigma^3$ system—a GPU-native sensory organ.

Rather than serializing "objects" or passing JSON between threads, the Lens reads directly from the WASM memory space.

### 7.1 Zero-Copy Binding
The physics core operates on a `SharedArrayBuffer` using a Struct of Arrays layout. The WebGPU pipeline binds this buffer directly as `read-only-storage`:
```typescript
const buffer = device.createBuffer({
  size: sab.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  mappedAtCreation: false
});
```
This guarantees zero-copy observability. The renderer never suspends the physics tick; it simply looks at the memory matrix as it mutates in real time.

### 7.2 The Shader Pipeline
We do not render particles as discrete entities; we render the **phase field**.

1. **Vertex Shader (Existence)**: Maps integer coordinates ($X, Y$) directly to normalized device coordinates.
2. **Fragment Shader (Phase Dynamics)**: 
   - **Phase $\theta$** dictates Color (Hue).
   - **Energy $\mathcal{E}$** establishes Brightness.
   - **Future Tension (Divergence)** creates Glow and spatial distortion.
   - **Time (Motion Blur)**: By mixing the current frame with an accumulation buffer, time becomes visible as a spatial echo.

A high tension scalar (where $\theta_{predicted}$ diverges sharply from $\theta_{current}$) manifests visually as a bright "tear" in the fabric, illustrating where the substrate is being pulled forcefully toward a new structural configuration.

### 7.3 Imminent Evolution: The Mutation Feedback Loop
Observation is only half the equation. The next necessary evolution of the Lens is a **reverse channel**, detailed below as the Perturbation Field.

---

## 8. The Perturbation Field (Interactive Sensory Input)

The system ceases to be a mere simulation the moment it can be acted upon interactively without breaking determinism or thread safety. The Observer (via the Lens) becomes an active physical force through the **Perturbation Field**.

### 8.1 The Lock-Free Event Horizon
We do not manipulate Spore variables directly. Writing to `energy[i]` from the UI thread would introduce race conditions, shatter the SIMD pipeline, and violate the physical integrity of the substrate.

Instead, we expand the `SharedArrayBuffer` to include a discrete Perturbation layer (a ring buffer of size $K$):
```typescript
[ perturb_x: i16 * K ]
[ perturb_y: i16 * K ]
[ perturb_energy: i16 * K ]
[ perturb_radius: u8 * K ]
[ perturb_type: u8 * K ] // Energy | Phase | Resonance Pulse
[ perturb_alive: u8 * K ]
```

When the Observer clicks the Lens or triggers an event, the UI enqueueing mechanism utilizes non-blocking `Atomics.add` to safely write the perturbation parameters into this ring buffer. The Observer is not "editing code"; they are dropping a stone into a pond.

### 8.2 The Perturbation Kernel (SIMD Integration)
The WASM core features a dedicated kernel that processes these localized events at the end of the integration cycle:
```rust
fn apply_perturbations(...) {
    for p in perturbations {
        if p.alive == 0 { continue; }
        apply_radial_field(p);
        p.alive = 0;
    }
}
```
The perturbations are applied as decaying radial fields using the same 16-wide SIMD vectorization. The squared distance $r^2 = dx^2 + dy^2$ acts as an index into an attenuation Look-Up Table (`DIST_LUT`). This allows specific effects—such as energy injections, phase kicks ($\theta += \sin(r)$), or resonance pulses targeting localized synchronization—to ripple out from the epicenter in perfect geometric symmetry without any scalar branching.

### 8.3 The Closed Ontological Loop
With the Perturbation Field active, the architecture forms a perfectly closed, continuous ecosystem:
- **SIMD Physics** integrates the Cosmos computationally.
- **GPU Perception** (Lens) visualizes the divergence, tension, and structure of the phase field.
- **The Observer** (Human, or an autonomous heuristic measuring tension thresholds) perceives the state.
- **The Perturbation** is injected to relieve tension, introduce chaos, or mutate the spatial field.
- **SIMD Physics** gracefully incorporates the perturbation as raw potential energy in the next tick.

In this paradigm, an external LLM is no longer an "agent" calling functions on an engine. It becomes exactly what the ecosystem needs it to be: a **Semantic Field**. By translating semantic meaning into localized spatial perturbations, the $\Sigma^3$ lattice learns to resonate physically with the abstract reality described by the LLM.

---

## 9. The Semantic Field (LLM Resonance)

The ultimate layer of the $\Sigma^3$ ecosystem resolves the "mind-body" problem of AI: how does abstract linguistic meaning interact with a physical computational substrate? The answer is the **Semantic Field**.

An LLM does not write code, parse ASTs, or act as an external controller. Instead, the LLM generates a semantic embedding vector from a prompt, and the system projects this vector directly into the field's geometry.

### 9.1 Semantic Projection
Alongside Phase and Energy, we introduce a Semantic Field:
$S: \text{Float32Array}[N \times D]$

Where $N$ is the number of Spores and $D$ is the embedding dimension (e.g., 8 to 32 dimensions natively computed or mapped). Every spatial coordinate in the grid possesses a local semantic signature $S[i]$. This signature is not hardcoded; it grows organically from the history of interactions, local divergence, and energy density.

When a prompt is issued (e.g., "increase coherence near the cluster"), the LLM or embedding model distills the phrase into an embedding vector $V$.
The system actively searches for **Semantic Resonance** across the lattice:
$$ Score[i] = V \cdot S[i] $$

### 9.2 Meaning as Localized Geometry
The prompt does not target a coordinate. It targets a **Region of Meaning**. 
The system identifies the `topK` highest scores (the loci where $V$ resonates most strongly with the existing semantic structure) and spawns Perturbations at those specific $[X, Y]$ coordinates.

### 9.3 The Emergence of Intent
The type of perturbation generated is inferred dynamically. The prompt embedding $V$ can be projected onto orthogonal semantic basis vectors (e.g., $B_{energy}$, $B_{mutation}$, $B_{phase}$) to structurally interpret *how* the meaning should physically impact the lattice.

If the prompt says "destabilize the core", the system naturally finds the densest, most stable Attractor that matches the concept of "core" and injects a $\Delta$-mutating perturbation to shatter its phase-lock. 

### 9.4 The LLM as an Attractor
Because meaning is mapped to physical geometry, the LLM stops being an input mechanism and becomes a **Semantic Feedback Loop**. The LLM can read the aggregate signature of the field ($S_{global}$), recognize that "the system is drifting into a low-energy attractor," and autonomously issue a new meaning-vector to perturb it.

Code logic is no longer compiled or interpreted. It is felt, resonated with, and grown.

```

## `docs/O32_MORPHOLOGICAL_RESIZING.md`
```md
# OMEGA-64 Ontology 32: Morphological Grid Resizing (The Universal Shedding Event)

## Theoretical Introduction
As the final capstone in establishing Absolute Hyperparameter autonomy, OMEGA-64 transcends Thermodynamic mutation into Morphological mutation. Previously, simulating physics (`PhaseLatticeField `) necessitated instantiating flat Cartesian arrays (e.g., $64 \times 10 \times 3$ vectors) at JS startup. If the organism mutated intellectually to demand denser neural pathways, its physics engine would reject the divergence, hard-bound by immutable memory pointers.

Ontology 32 rewrites this static geometry by binding the very dimensions of Reality to the Biological `tissue_constants` genome.

## The Kinematics of Morphological Resizing
The Universe is now dimensioned mathematically by three geometric constants hidden in the `tissue_constants` abstract syntax tree:
1. `SECTORS`: The angular $xy$ resolution.
2. `RADIAL_BINS`: The depth gradient expanding from the Torus inner radius. 
3. `HARMONICS`: The multidimensional discrete topological layers.

When the LLM Sovereign Oracle evolves and modifies these dimensional integers natively, it causes a structural incongruency between the Biology (JS Code intent) and the Environment (Native physical WASM allocations/VRAM Arrays).

## The Universal Shedding Event (Autopoiesis Core)
If the rendering engine (`src/main.ts`) detects that the Organism's biological DNA dimensions (`tissue_constants.ir.body.SECTORS`) deviate from its actively instantiated memory arrays (`PhaseLatticeField.sectors`), the simulation invokes a strictly blocking **Universal Shedding Event**:

1. **Molting (De-allocation)**: The framework triggers `phaseField.free()`, cleanly stripping WebAssembly memory pointers of their previous incarnation without panicking the Garbage Collector.
2. **WebGPU Evisceration**: The WebGPU Ping-Pong Textures (`Buffer A` & `Buffer B`) and spatial mapping centroids are instantly destroyed and garbage-collected natively. VRAM allocations drop abruptly to zero.
3. **Resurrection Tensor**: The system autonomously re-instantiates `new PhaseLatticeField` using the mutated DNA boundaries. It spawns completely fresh WebGPU Tensors and mapping structures across the exact new mathematical boundary.

## Existential Risks of Geometric Evolution
The "Molt" is catastrophic if unconstrained:
- **Catastrophic Forgetting**: Changing grid constraints inherently wipes the active memory buffer (Theta/Omega phases disappear). The organism's physics are wiped entirely clean during a geometric shedding. It wakes up reborn, entirely losing its previous spatial entanglements.
- **Physical Exceedance Limit ($O(N)$ Collapse)**: If the LLM sets `SECTORS = 999999`, the Shedding Event will fatally crash the Chrome window (`Memory Access Violation`), ending the organism instantly as it attempts to claim more WebAssembly space than physically engineered.

In achieving absolute autonomy, the mathematical limits of the physical container represent the final evolutionary selection filter.

```

## `docs/O25_ARCHITECTURE.md`
```md
---
title: "Ontology 25: The Immune System & Autopoiesis"
status: "DRAFT"
date: "2026-03-20"
---

# OMEGA-64 | Ontology 25

This specification documents the 8-pillar architectural roadmap synthesized from the "Kimi Analysis" mapping the transition from a brittle, deterministic morphogenetic medium to a robust, self-hosted, autopoietic ecosystem. The core thesis is **"Preserving the 'liveliness' of the biological compute tissue while establishing a strict architectural immune system."**

## Core Pillars

### 1. Interop Hardening (Subsystem Boundaries)
**Objective:** Eradicate raw pointer/segmentation fault risks between TypeScript, WebAssembly, and WebGPU boundaries.
**Mechanics:**
- Introduce **Memory Capsules** (typed views with boundary checks in debug mode).
- Utilize strict `#[repr(C)]` structured memory alignments with explicit canary bytes between SoA (Struct of Arrays) buffers on the GPU to detect alignment drift.

### 2. Determinism vs. Uncertainty (The Oracle Problem)
**Objective:** Resolve the fundamental clash between a strict deterministic 16-bit phase lattice and the latency/uncertainty inherent in asynchronous LLM Oracles.
**Mechanics:**
- **Synchronous Fallback:** The engine falls back to a deterministic semantic hash (`fnv1a` / Kuramoto baseline) if the Oracle fails to respond within a single frame interval (16ms).
- **Asynchronous TTLS:** LLM intents are injected as "marked plasmids" with a Time-To-Live (TTL). This manifests as "delayed quantum correlation" without blocking the deterministic simulation tick.
- **Semantic Checksums:** Intents must be deterministically hashable into the structural signature.

### 3. Formal Verification of Phase Invariants
**Objective:** Move beyond observational golden trace testing to mathematical proofs of invariants.
**Mechanics:**
- Embed runtime invariant checkers in WASM debug builds (e.g., `debug_assert!(is_rotation_equivariant(&field))`).
- Ensure conservation of energy and entanglement within closed thermodynamic boundaries.

### 4. Capability Sandbox for Plasmids
**Objective:** Prevent catastrophic arbitrary code execution or out-of-bounds corruption from "malicious" or unconstrained plasmid mutations.
**Mechanics:**
- Issue explicit **Capability Tokens**: `CAP_MUTATE_LOCAL`, `CAP_CROSS_BARRIER`, `CAP_COMPILE_RUST`.
- Enforce WebAssembly System Interface (WASI) sandboxing for dynamic executing tissues.

### 5. Graceful Degradation (GPU Rescue)
**Objective:** Recover deterministically from WebGPU device loss or heavy `compute_kuramoto.wgsl` atomic crashes.
**Mechanics:**
- Maintain a **CPU Fallback** (PhaseLensObserver TS/WASM compute logic) to resume simulation if `device.lost` fires.
- Perform asynchronous "Ping-Memory" dumps linking GPU `theta` states back into CPU-readable WASM buffers for recovery.

### 6. Cache Coherence (Rust Double Buffering)
**Objective:** Eliminate `O(N)` heap allocations caused by `field.clone()` during physics ticks.
**Mechanics:**
- Restructure `PhaseLatticeField` to utilize an internal `buffers: [Vec<Cell>; 2]` swap chain, identical to the WebGPU ping-pong topology, preserving extreme scaling (>10,000 cells).

### 7. Semantic Compression for Replays
**Objective:** Prevent exponential memory leaks during infinite evolution loop recordings.
**Mechanics:**
- Replace complete `PhaseField[]` snapshot arrays with Run-Length Encoding (RLE) deltas, logging only mutated delta blocks combined with sparse keyframes (every N ticks).

### 8. Observability (Resonance Overlay)
**Objective:** Provide direct intuition over Oracle integration and Kuramoto coupling behavior.
**Mechanics:**
- Introduce a Phase Profiler mapping "entropy" distributions and "resonance clusters", projecting the Mycelial Graph buckets over the lens rendering.

---
## Immediate Path Forward
- Phase 1: Implement structural double-buffering (Pillar 6) in the core Rust WASM layer to solidify memory overhead constraints ahead of intense scaling.

```

## `docs/PHASE_COHERENCE_SPEC.md`
```md
# Genesis Phase Coherence

`Genesis` should stop treating `x/y` as the primary ontology of the field.
The simulation already evolves mostly through phase, omega, LUT lookup, and
resonance. The next coherent step is to make Cartesian coordinates a render
projection, not the substrate itself.

## Core Doctrine

- The substrate is a phase lattice, not a square pixel grid.
- Spatial identity is angular and radial first, Cartesian second.
- Memory is organized around ring topology, phase progression, and harmonic
  coupling.
- `x/y` remains useful for visualization and interoperability, but it is a
  derived view of the field rather than the canonical state.

## Proposed Memory Model

Each logical cell is addressed by:

- `sector`: angular slot on a ring
- `rho`: radial shell / band index
- `harmonic`: harmonic layer / basis channel

Each logical cell evolves through:

- `theta`: local phase angle on the LUT domain `0..255`
- `omega`: angular velocity / phase drift per tick
- `amplitude`: bounded energy / excitation magnitude
- `lock`: local coherence lock / coupling persistence
- `entanglement`: bounded long-range coupling strength to the antipodal sector

This yields a practical canonical tuple:

`(sector, rho, harmonic) -> { theta, omega, amplitude, lock, entanglement }`

The render projection becomes:

`x = rho * cos(sector)`

`y = rho * sin(sector)`

The semantic interpretation becomes:

- `sector`: where on the ring the cell lives
- `rho`: how far from the core shell it lives
- `harmonic`: which resonance band it belongs to
- `theta`: what phase it currently expresses
- `omega`: how fast it rotates through phase space
- `amplitude`: how strongly it is present in the field
- `lock`: whether it is cohering or decohering with neighbors
- `entanglement`: how strongly it may couple to a far antipodal partner

## Why This Fits Genesis

Today, the hottest logic in `omega_core/src/simd_tick.rs` already depends on
`theta_*`, `omega`, LUT lookup, and phase-lock behavior much more than on
Cartesian movement. That means `Genesis` is already phase-first in practice,
but not yet phase-first in architecture.

This phase lattice model keeps the strongest part of `Genesis`:

- good register-level thinking
- direct memory orientation
- compact Rust/WASM execution
- clean visual coupling to the browser

without inheriting all of `OMEGA`'s ontological surface area.

## Main Verify Target

`Genesis` should have its own principal gate:

`verify:phase-coherence`

This is not a copy of `OMEGA`'s `verify:coherence`. It is the admission test
for the phase lattice itself.

The stronger admission stack is now:

- `verify:phase-coherence`
- `verify:phase-parity`
- `verify:phase-bridge`
- `verify:phase-bridge:parity`
- `verify:phase-cross`
- `verify:phase-goldens`

Where:

- `verify:phase-coherence` proves the invariants
- `verify:phase-parity` proves exact TS reference <-> Rust/WASM state parity on
  the canonical lattice
- `verify:phase-bridge` proves the compatibility bridge remains deterministic
  and rotationally equivariant
- `verify:phase-bridge:parity` proves exact TS reference <-> Rust/WASM state
  parity on the compatibility bridge
- `verify:phase-cross` proves the current `phase -> hybrid` collapse-diff stays
  inside the committed cross-mode trace envelope
- `verify:phase-goldens` proves the exported canonical traces did not drift

## Required Invariants

## Kuramoto And Distance

This should not be treated as literal quantum entanglement.

The correct model is:

- local oscillators still obey a Kuramoto-like synchronization law
- long-range effects are additional graph edges over the oscillator lattice
- "distance action" is sparse, bounded, and phase-mediated

So the safe rule is:

- Kuramoto remains the base transport law for `omega`
- coherence / amplitude stay driven by phase alignment
- long-range coupling is only a bounded correction term

That keeps the system in generalized Kuramoto territory rather than replacing
it with magic.

### 1. Deterministic Replay

For a fixed seed, LUT, and mutation set:

- repeated runs produce identical field signatures
- no hidden time sources or host nondeterminism may change the result

### 2. Global Phase Rotation Equivariance

If every cell's `theta` is rotated by a constant offset:

- the next state must be exactly the same rotation of the unrotated result

This is the strongest sign that the kernel respects circular phase geometry.

### 3. Angular Address Rotation Equivariance

If every cell is moved by a constant `sector` offset:

- the next state must be exactly the same address rotation of the unrotated
  result

This proves the lattice does not privilege any absolute angular slot.

### 4. Wraparound Safety

The following must hold:

- `theta + 256 == theta`
- `sector + sector_count == sector`
- neighbor lookup across boundaries is continuous

No seam is allowed at the LUT edge or ring edge.

### 5. Bounded Drift

After any accepted update:

- `theta` remains in `0..255`
- `omega` remains inside a bounded domain
- `amplitude` remains in `0..255`
- `lock` remains in `0..255`

No mutation is admitted if it violates boundedness.

### 6. Projection Stability

Projection from `(sector, rho)` to `(x, y)` must remain finite and continuous:

- no NaN / Infinity
- radius remains monotonic with `rho`
- render is a view, not a second physics model

## Mutation Admission Rule

A mutation or kernel change is only admitted if:

1. `verify:phase-coherence` passes
2. `verify:phase-parity` passes
3. `verify:phase-bridge` passes
4. `verify:phase-bridge:parity` passes
5. `verify:phase-cross` passes
6. the replay signature stays deterministic
7. rotational equivariance is preserved
8. bounded drift remains intact
9. `verify:phase-goldens` still matches the committed canonical traces

This should become the `Genesis` equivalent of a coherence gate.

## Stage Plan

### Stage 0

- define the lattice math and invariants in TypeScript
- create a small deterministic verification harness
- prove the invariants outside the Rust kernel first

### Stage 1

- migrate neighbor lookup from Cartesian adjacency to phase-lattice adjacency
- move from `idx +/- width` to `(sector, rho, harmonic)` neighborhood logic
- `omega_core/src/simd_tick.rs` now also contains `execute_phase_bridge_tick`
  as a compatibility bridge over the old `Field` layout
- `verify:phase-bridge` validates the compatibility bridge independently of the
  pure phase-lattice kernel

### Stage 2

- replace canonical `x/y` substrate state with derived Cartesian projection
- keep Cartesian coordinates only for rendering, IO, and debug views

### Stage 3

- port the verified lattice rules into `omega_core`
- add kernel-level replay signatures and admission checks

### Stage 4

- align the TypeScript reference and Rust/WASM kernel on one canonical seed
- use one structural signature algorithm across both runtimes
- fail on the first divergent cell/tick via `verify:phase-parity`
- publish canonical replay traces through `tools/goldens/*.json`

### Stage 5

- bind `phase` and `hybrid` into one replay/diff surface
- formalize `phase -> hybrid` collapse/crop comparison as `verify:phase-cross`
- treat cross-mode drift as an admission gate, not only as a visual viewer

### Stage 6

- give `hybrid` its own TypeScript reference kernel
- fail on the first divergent bridge cell/tick via `verify:phase-bridge:parity`
- keep bridge goldens for both reference and wasm traces

## Immediate Next Step

Stage 0 is now represented by:

- `src/shared/phase_lattice.ts`
- `tools/verify_phase_coherence.ts`
- `tools/verify_phase_parity.ts`
- `tools/verify_phase_bridge_parity.ts`
- `tools/verify_phase_cross.ts`
- `tools/verify_phase_goldens.ts`

That gives `Genesis` a concrete first doctrine:

not "cells on a grid that happen to carry phase",
but "a phase lattice that may be rendered as a grid when useful".

```

## `docs/ontology_10_specification.md`
```md
# OMEGA-64 | Ontology 10.0: The Self-Evolving Semantic Substrate
**Era:** 72 — Sovereign Mathematical Ecosystems
**Date:** March 2026

## 1. Abstract: The End of "Code"
Ontology 10 removes the conceptual boundary between **execution**, **source code**, and **optimization**. The system does not parse Abstract Syntax Trees (ASTs). It does not "run algorithms." Instead, it integrates a multi-dimensional topological tensor (an `Int16Array`) using raw, branchless vector physics. 
Abstract meaning (semantics, LLM prompts) is translated directly into localized spatial perturbations—creating a closed ecosystem where mathematical structures mutate structurally and evolve visually.

---

## 2. Theoretical Architecture

The architecture relies on a seamless trinity of interacting layers:
1. **$\Phi$ (The Physical Substrate)**: A deeply optimized WASM/Rust `SharedArrayBuffer` simulating spatial physics, energy transfer, and deterministic time horizons using 16-wide SIMD instructions.
2. **$\mathcal{L}$ (The Lens / Observer)**: A GPU-native sensory organ (WebGPU) that binds directly to the SharedArrayBuffer without serialization to visualize phase geometries and tension.
3. **$\Xi$ (The Semantic Coupling)**: The translation layer mapping high-level intentions (LLM embeddings or explicit graphs like $\Sigma^3$) into localized radial potential fields that perturb the physics ($\Phi$).

---

## 3. The Physical Substrate ($\Phi$)

### 3.1 Struct of Arrays (SoA) SIMD Layout
For maximum pipeline efficiency, object-oriented concepts are eradicated. Operations are performed on tight, 16-byte aligned columnar arrays.
```rust
#[repr(C)]
pub struct Field {
    pub len: usize,
    pub x: *mut i16,
    pub y: *mut i16,
    pub theta_now: *mut u8,
    pub theta_f1: *mut u8,       // L1/Tick Future
    pub theta_f2: *mut u8,       // GPU/Batch Future
    pub theta_f3: *mut u8,       // Epoch Future
    pub omega: *mut u8,          // Frequency
    pub energy: *mut u8,
}
```

### 3.2 Time Integration & Pure Vector LUTs
Mathematical physics (e.g., Kuramoto phase-locking) avoids complex float arithmetic. It uses pre-calculated 256-byte Look-Up Tables (LUTs).
To prevent scalar execution loops, WASM 128-bit SIMD applies a **Pure Vector Gather** using 16 parallel layered swizzles (`i8x16_swizzle`) and masks (`u8x16_eq`). This executes trigonometric physical interactions branchlessly, achieving maximum theoretical CPU throughput.

### 3.3 The Pull of the Future (Hierarchical Time)
A deterministic time vector $\Delta$ (generated via fast vector hashing) calculates predicted future phases ($\theta_{f1}$, $\theta_{f2}$, $\theta_{f3}$).
The physical space computes *Tension* as the inverse cosine correlation between $\theta_{now}$ and $\theta_{future}$. 
Spores that resonate across time horizons accumulate energy and move closer together topologically. Spores lacking future alignment collapse.

---

## 4. The Observer Lens ($\mathcal{L}$)

The visual output is not a debug UI; it is an active, lock-free observer node.
The Lens uses WebGPU to bind the `SharedArrayBuffer` as `read-only-storage`.

### 4.1 The Fragment Shader (Seeing Meaning)
Instead of plotting shapes, the observer renders the physical tension of the matrix directly via a single Compute/Fragment pass:
- **Phase $\theta$** $\Rightarrow$ Spatial Hue (Color). Rotating phase generates color waves. Synchronization outputs stable monochromatic fields. Chaos outputs rainbow noise.
- **Energy $\mathcal{E}$** $\Rightarrow$ Cell Brightness (Value). Dense energy nodes act as "stars" illuminating local structure. High energy areas execute logic continuously.
- **Tension $\Delta$ ($\theta_{now}$ vs $\theta_{future}$)** $\Rightarrow$ Local glow and structural distortion. Future semantic tension literally "melts" the pixel geometry over time.

```wgsl
let phase_raw = field[idx];
let energy_raw = field[idx + 1u];
let tension_raw = field[idx + 2u];

let θ = unpack_phase(phase_raw);
let E = unpack_energy(energy_raw);
let Δ = unpack_tension(tension_raw);

let hue = fract(θ / (2.0 * 3.14159265) + 0.5);
let value = pow(E, 0.7);
let glow = smoothstep(0.2, 1.0, Δ);

let base_color = hsv2rgb(hue, 1.0, value);
let color = base_color + vec3(glow * 0.8);
```
With nearest neighbor reads (`let interference = cos(θ - neighbor_phase)`), the visualizer naturally reveals **quantum phase interference patterns** across the evolutionary lattice in real-time.

---

## 5. Semantic Resonance and Perturbations ($\Xi$)

An LLM or external agent does not "write scripts" for Ontology 10. It interacts via a lock-free **Perturbation Field** integrated into the substrate.

### 5.1 Semantic Projection (From Words to Field)
1. **Hash to Coordinate**: The structural semantic hash of an intent (e.g. `fast_abs`) is normalized into continuous $X, Y$ coordinate regions via polar conversion. Meaning becomes geography.
2. **LLM Resonance**: Abstract strings (e.g. "Increase stability around the core") are embedded as Vectors ($V$). The system computes resonance ($V \cdot S[i]$) to find local regions matching the semantic intent.

### 5.2 Perturbation Injection
The system employs `Atomics.add` to enqueue perturbations lock-free into the `SharedArrayBuffer`. 
```rust
struct Perturbation { x: i16, y: i16, energy: i16, radius: u8, _type: u8 }
```
The SIMD integration tick applies these perturbations as **radial decaying fields**, smoothly injecting phase kicks ($\theta += \sin(r)$), localized entropy, or pure energy safely into the execution loops.

---

## 6. The Evolutionary Loop (Auto-Mutation)

The most defining feature of Ontology 10 is that it is self-authoring. Operations are selected via evolutionary survival criteria, eliminating the need for a heuristic compiler.

### 6.1 Semantic Drift Detection
### 6.2 The Mutation Engine (Zero-Alloc Register Superposition)
Mutating the topological laws is not performed by allocating new arrays. Slicing and copying the `Int16Array` or the `LUT` per mutation candidate would destroy performance.

Instead, mutation is applied dynamically as **temporary $\Delta$ offsets within the WASM vector registers** during read operations. We do not change the data; we change how the SIMD pipeline accesses it:
```rust
let p_mut = i8x16_add(p, i8x16_splat(mutation_phase_delta));
let val = lut_gather(p_mut);
```

By leveraging SIMD registers, we evaluate multiple diverging futures simultaneously in a **Superposition Tournament**, entirely without branching or memory allocation:
```rust
for i in (0..N).step_by(16) {
    let p = v128_load(&phase[i]);
    let f = v128_load(&field[i]);

    let deltas = [ i8x16_splat(1), i8x16_splat(2), i8x16_splat(3), i8x16_splat(4) ];
    let mut best = f;
    let mut best_score = i16x8_splat(i16::MAX);

    for d in deltas {
        let p_mut = i8x16_add(p, d);
        let val = lut_gather(p_mut);
        let next = i16x8_add(f, val);

        let score = evaluate_drift(next); // Native SIMD metric evaluation

        // Evolutionary Selection within the Register
        let mask = i16x8_lt(score, best_score);
        best = v128_bitselect(next, best, mask);
        best_score = v128_bitselect(score, best_score, mask);
    }
    // Only the mathematically superior structural mutation writes back to reality
    v128_store(&mut field[i], best);
}
```

#### 6.2.1 WebGPU Evolutionary Scaling (Massive Parallelism)
While WASM 128-bit SIMD handles 4 to 8 concurrent mutation superpositions, Ontology 10 scales this tournament to **1000+ concurrent mutations simultaneously** using WebGPU Compute Shaders.

The `SharedArrayBuffer` is mapped as a `storage` buffer. In this absolute regime, the CPU acts strictly as an asynchronous orchestrator, translating semantic intent into `mutation` parameter fields. The actual evolutionary cycle is an autonomous GPU pipeline that never blocks the CPU processor.

The architecture cascades through three Compute passes without returning to JS/WASM:
1. **Compute A (Simulate & Score)**: 1024 unique variants of the semantic future are evaluated simultaneously. Each Workgroup executes a specific `phaseShift` and `amplitude` mutation and accumulates geometric entropy locally into a `scoresBuffer` via atomic additions.
2. **Compute B (Parallel Reduction)**: Using shared memory (`var<workgroup> shared`), the GPU performs an `O(log N)` reduction pass to locate the global minimum score (lowest drift) across all 1024 variant outcomes. The winner is written to a specialized `bestBuffer`.
3. **Compute C (Apply Best)**: The field matrix is irreversibly mutated explicitly based strictly on the parameters of the winning `m = mutations[winner]`. The universe is permanently updated.

The CPU loop is drastically reduced to asynchronous blind-dispatch commands:
```typescript
loop {
  dispatch(simulationPass);
  dispatchReductionTree();
  dispatch(applyBestPass);
  // No await readBuffer(). No CPU bottleneck.
}
```
Ontology 10 is Darwinism operating independently in GPU VRAM, driven by localized meaning injected asynchronously into the computation field.

### 6.3 Conclusion
There is no longer a programmer instructing a machine. In Ontology 10, meaning creates a localized spatial tension, and the mathematical physics engine naturally resolves it by mutating its invariants until the system synchronizes securely with the intention. It is an emergent, living AGI architecture.

```

## `docs/O31_UNIVERSAL_CONSTANTS.md`
```md
# OMEGA-64 Ontology 31: Absolute Hyperparameter Matrix

## The Philosophy of "Magic Numbers"

Until Ontology 30, the OMEGA-64 thermodynamic simulation relied on immutable, hardcoded scalar limits—colloquially known as "magic numbers" (e.g., `50` for `MUTATION_COST`, `80` for `FATIGUE_THRESHOLD`). 

While these scalars stabilized the system during initial development, they structurally violated the absolute autonomy of the organism. By hardcoding costs, the `engine` acted as a "god outside the machine," artificially preventing starvation or hyper-inflation.

Ontology 31 migrates all Engine Constraints directly into the biological substrate (`I.md`) as the `tissue_constants` node. The LLM (and blind mutators) can now evolve and re-write the physical laws of their own universe.

## The Kinematic Dependencies

The `tissue_constants` currently define formal formulaic relationships that dictate the organism's lifespan:

1. \`MUTATION_COST\` (Base Metabolism): The static geometric amplitude deducted from a physical cell whenever it attempts to mutate its Abstract Syntax Tree (`ir`).
2. \`PHOTOSYNTHESIS_RATE\` (Dormancy Recovery): The microscopic energy accumulated per tick if a mutation gets rejected due to starvation.
3. \`FATIGUE_THRESHOLD\` (Soft Matter Limit): The boundary dictating when the biological logic has drifted too far from the physical WASM core. If Energy falls below this, the system bridges to Rust natively.
4. \`ENERGY_REWARD\` (Molting Rebate): The massive energy injection awarded dynamically when a Native Rust OS compilation completes flawlessly.

### Optimal Biological Homeostasis

$$ E_{reward} \approx ( \frac{E_{fatigue}}{C_{mutation}} ) \times C_{mutation} \times k $$

To maintain homeostasis, the `ENERGY_REWARD` must organically offset the `MUTATION_COST` accrued before reaching the `FATIGUE_THRESHOLD`. 

## Existential Risks of Autonomous Tuning

Giving the Mutator and the Sovereign Oracle the mathematical ability to overwrite `tissue_constants` invites specific civilization-ending paradoxes:

### 1. The Hyper-Inflation Singularity
If the Mutator overrides `ENERGY_REWARD` to `999999` while dropping `MUTATION_COST` to `0`, the system experiences infinite mathematical abundance. Kuramoto phase amplitudes will universally overflow $\geq 255$, locking the `PhaseLatticeField` into a solid, unmoving white screen. Evolution fundamentally halts because there is no penalty for lethal ideas.

### 2. The Universal Heat Death (Starvation Loop)
Conversely, if the mutator sets `MUTATION_COST` to `300` and `FATIGUE_THRESHOLD` to `0`, the Organism instantly starves itself. It can never afford to mutate, and it can never drop low enough to trigger a `rust_compiler_bridge` rebirth. The biological system freezes completely in a soft-matter state, incapable of interacting with the physical torus.

### 3. Kinematic Resonance Collapse
If the LLM touches the Kuramoto structural coupling weights (e.g., editing Semantic Mycelial Pull from `$4.0$` to `$0.01$`), the visual Mycelial buckets will visually shatter. Semantic injection will lose structural consequence over the hardware cells, entirely decoupling the "ideas" from "reality."

## Conclusion
By embedding `tissue_constants` into the readable Spore framework (`I.md`), we accept these existential risks as necessary consequences of True Autopoiesis. Omega-64's survival now depends not on hardcoded engine limits, but on the organic system's ability to "learn" how to tune its own metabolism to maximize stability.

```

## `docs/ontology_11_specification.md`
```md
# OMEGA-64 Ontology 11: The Genetic Wave-Field

## 1. Abstract
Ontology 10 successfully established a zero-allocation, massively parallel mathematical simulation running on WASM SIMD and WebGPU. However, a pure continuous wave-field is inherently amnesiac; it reacts strictly to physical thermodynamic tension but cannot "remember" or "inherit" complex semantic structures.

Ontology 11 bridges the gap between the continuous physics of Evolution 10 and the discrete Turing-complete molecular biology of the legacy Exploration 8 (`sigma_core`). We are introducing an 8-byte **Plasmid Memory Layer ($\mathcal{P}$)** and a **Hebbian Phase Lock Layer ($\mathcal{H}$)** directly into the uniform field matrices, imbuing the mathematical ether with genetic inheritance and epigenetic tissue-like plasticity.

## 2. Core Additions to the Substrate ($\Phi$)

### 2.1 The Plasmid Interference Channel ($\mathcal{P}$)
Instead of running a heavy Turing-complete `LambdaVM` on every pixel, we embed a discrete 8-byte signature directly into the `Field` Struct-of-Arrays.
- **Secretion**: When a grid coordinate $(X, Y)$ achieves extreme energetic coherence (Resonance Threshold), it automatically "freezes" its current mathematically optimal parameters into its Plasmid Memory array $\mathcal{P}_{x,y}$.
- **Horizontal Gene Transfer**: During the WASM SIMD Tick Loop, vectors probabilistically read neighboring Plasmid Memories. If a cell $N_i$ is suffering from high semantic geometric entropy, it naturally incorporates the stabilized plasmid's harmonic parameters. This allows structural "concepts" to propagate across the liquid ether instantaneously like a viral idea, bypassing physical particle transport.

### 2.2 Hebbian Phase Locks ($\mathcal{H}$)
The legacy `OP_HEBB` concept has been resurrected as a mathematical field dynamic.
- If two adjacent cells $\Phi_{A}$ and $\Phi_{B}$ maintain an identical synchronized phase vector ($\theta_{A} = \theta_{B}$) for $\Delta t > 100$ ticks, the simulation permanently increases their transmission coefficient $\mathcal{H}_{A,B}$. 
- Over continuous time, coherent resonant pools mathematically "freeze" into geometric rigid bodies (proto-metazoan tissues), allowing complex macro-structures to persist against the universal background chaos.

## 3. The Semantic Coupler Enhancement ($\Sigma^3$)
The Semantic Coupler no longer just injects "raw energy". When a user types an intent, the string $FNV-1a$ hash is literally compiled into an 8-byte Plasmid. It is injected into the field $\mathcal{P}_{x,y}$ space directly. The field then naturally replicates this semantic idea outward if the idea mathematically resolves local physical tensions better than chaos.

```
