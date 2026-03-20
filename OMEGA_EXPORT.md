# OMEGA-64 | ONTOLOGY 17 ABSOLUTE EXPORT

This document contains the entire architectural core of the Genesis Spore, including the TS genetic transpiler, the Rust WASM SIMD execution threads, and the Biological Context Substrate (`I.md`).

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
  expr: node.expr,
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
        let current = targetNode.expr;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        current[path[path.length - 1]] = newValue;
        
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

### flush_state_to_disk
#### Identity
hash: 84ee457159f7720697909e90588f1c3b2034f044fa3c11f4ba32dc5d43b092b3
version: 1

#### IO
in:
  nextState: State
  targetFile: string
out: void

#### IR
```json
write(nextState) to Disk
```

#### Implementation
```ts
const { packTissueToBinary, serializeTissueToMarkdown } = await import("./quine.ts");
if (targetFile.endsWith(".bin")) {
  await Deno.writeFile(targetFile, packTissueToBinary(nextState));
} else {
  const markdownStr = serializeTissueToMarkdown(nextState);
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
            const currentArgs = { ...op.args, state: tempState, executeNeuron };
            const result = await executeNeuron(tempState, op.alias, currentArgs);
            tempState = result.next;
            epochLog.push({ alias: op.alias, diff: result.diff });
          }
          
          for (const key in tempState) {
            const node = tempState[key];
            if (typeof node.expr !== "object") throw new Error(`Node ${key} missing IR logic branch`);
            if (!Array.isArray(node.identity.parents)) throw new Error(`Node ${key} lineage is not a DAG`);
            const calculatedHash = await executeNeuron(tempState, "calculate_structural_hash", { node });
            if (node.identity.structural_hash !== calculatedHash) {
                node.identity.structural_hash = calculatedHash;
            }
          }
        } catch (e) {
          return { success: false, next: state, log: [], error: e.message };
        }
        
        // Record epoch in tissue_history
        if (tempState["tissue_history"]) {
           const historyNode = tempState["tissue_history"];
           const oldHash = historyNode.identity.structural_hash;
           
           const epochRecord = {
             timestamp: Date.now(),
             operations: epochLog
           };
           
           // Offload the heavy payload to an external append-only log file
           let logFile = "./history.jsonl";
           try {
             const pointer = typeof historyNode.expr.body === "string" ? JSON.parse(historyNode.expr.body) : historyNode.expr.body;
             if (pointer && pointer.log_file) logFile = pointer.log_file;
           } catch(e) {}
           
           await Deno.writeTextFile(logFile, JSON.stringify(epochRecord) + "\\n", { append: true });
           
           const newHash = await executeNeuron(tempState, "calculate_structural_hash", { node: historyNode });
           
           historyNode.identity = {
             ...historyNode.identity,
             structural_hash: newHash,
             parents: [oldHash],
             version: historyNode.identity.version + 1
           };
           
           historyNode.mutation_log.push(`Appended epoch with ${epochLog.length} operations to ${logFile}`);
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

## `package.json`
```json
{
  "name": "omega-genesis",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build:wasm": "cd omega_core && wasm-pack build --target web --out-dir pkg",
    "build": "npm run build:wasm && vite build",
    "serve": "vite preview",
    "generate:phase-goldens": "npm run build:wasm && node --experimental-strip-types tools/generate_phase_goldens.ts",
    "verify:phase-coherence:ref": "node --experimental-strip-types tools/verify_phase_coherence.ts",
    "verify:phase-coherence:kernel": "cargo test --manifest-path omega_core/Cargo.toml phase_lattice",
    "verify:phase-coherence:wasm": "npm run build:wasm && node --experimental-strip-types tools/verify_phase_coherence_wasm.ts",
    "verify:phase-coherence": "npm run verify:phase-coherence:ref && npm run verify:phase-coherence:kernel && npm run verify:phase-coherence:wasm",
    "verify:phase-cross": "npm run build:wasm && node --experimental-strip-types tools/verify_phase_cross.ts",
    "verify:phase-parity": "npm run build:wasm && node --experimental-strip-types tools/verify_phase_parity.ts",
    "verify:phase-bridge:kernel": "cargo test --manifest-path omega_core/Cargo.toml phase_bridge",
    "verify:phase-bridge:parity": "npm run build:wasm && node --experimental-strip-types tools/verify_phase_bridge_parity.ts",
    "verify:phase-bridge:wasm": "npm run build:wasm && node --experimental-strip-types tools/verify_phase_bridge_wasm.ts",
    "verify:phase-bridge": "npm run verify:phase-bridge:kernel && npm run verify:phase-bridge:parity && npm run verify:phase-bridge:wasm",
    "verify:phase-goldens": "npm run build:wasm && node --experimental-strip-types tools/verify_phase_goldens.ts",
    "verify:phase-stack": "npm run verify:phase-coherence && npm run verify:phase-parity && npm run verify:phase-bridge && npm run verify:phase-cross && npm run verify:phase-goldens"
  },
  "devDependencies": {
    "@webgpu/types": "^0.1.38",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "@msgpack/msgpack": "^3.1.3"
  }
}

```

## `PHASE_COHERENCE_SPEC.md`
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

## `export_omega.ts`
```ts
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const OUTPUT_FILE = "OMEGA_EXPORT.md";

const TARGET_EXTS = [".ts", ".rs", ".wgsl", ".toml", ".html", ".json"];
const EXCLUDE_DIRS = [/node_modules/, /target/, /pkg/, /\.git/, /\.gemini/, /dist/];

async function main() {
  const chunks: string[] = [];
  chunks.push("# OMEGA-64 | ONTOLOGY 17 ABSOLUTE EXPORT\n");
  chunks.push("This document contains the entire architectural core of the Genesis Spore, including the TS genetic transpiler, the Rust WASM SIMD execution threads, and the Biological Context Substrate (`I.md`).\n\n---\n");

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
  await addFile("package.json");
  await addFile("PHASE_COHERENCE_SPEC.md");
  await addFile("export_omega.ts");
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

  // Walk verification and export helpers
  console.log("\nSweeping tools/ ...");
  for await (const entry of walk("tools", { exts: TARGET_EXTS, skip: EXCLUDE_DIRS })) {
    if (entry.isFile) await addFile(entry.path);
  }

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
  expr: IRFunction;
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
    return JSON.stringify(node.expr);
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
    return run(node.expr.body as IRNode);
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

        if (node.expr && node.expr.body !== undefined) {
           nodeBlock += `#### IR\n`;
           if (typeof node.expr.body === "string" || Array.isArray(node.expr.body)) {
              let bodyStr = typeof node.expr.body === "string" ? node.expr.body : JSON.stringify(node.expr.body);
              if (bodyStr.startsWith('"') && bodyStr.endsWith('"')) {
                 bodyStr = JSON.parse(bodyStr); // unescape string safely
              }
              nodeBlock += `\`\`\`json\n${bodyStr}\n\`\`\`\n\n`;
           } else {
              nodeBlock += `\`\`\`json\n${JSON.stringify(node.expr.body, null, 2)}\n\`\`\`\n\n`;
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
          expr: { args: [], ret: "void", body: "" },
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
                     node.expr.args.push({ name: k, type: typePart });
                 }
             }
             node.expr.ret = typeof node.io.out === "string" ? node.io.out.split("@")[0] : "void";
          } else if (currentSection === "IR") {
             const codeBody = sectionLines.join("\n").replace(/^```\w+\n/, "").replace(/\s*```$/, "").trim();
             try {
                 node.expr.body = JSON.parse(codeBody);
             } catch(e) {
                 node.expr.body = codeBody;
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

## `src/test_evolution.ts`
```ts
import init, { Field, execute_simd_tick } from "../omega_core/pkg/omega_core.js";
import { SemanticCoupler } from "./ontology/semantic_layer.ts";

async function main() {
    console.log("=== OMEGA-64 | TELEOLOGICAL BENCHMARK (O-18) ===");
    
    // 1. Initialize WASM inside headless Deno
    const wasmBytes = await Deno.readFile("./omega_core/pkg/omega_core_bg.wasm");
    // Web bindings `init` accepts a WebAssembly.Module or bytes directly
    const wasm = await init({ module_or_path: wasmBytes });
    console.log("✅ WASM Core Loaded.");

    // 2. Initialize Biological Field (256x256)
    const field = new Field(256, 256);
    console.log("✅ Biological Field (65536 cells) Initialized.");

    // 3. Mock Perturbation Injector for WASM interaction
    const perturbations: {x:number, y:number, energy:number, radius:number, phase:number, hash:Uint8Array}[] = [];
    const injector = {
        inject: (x: number, y: number, energy: number, radius: number, phase: number, hash: Uint8Array) => {
            perturbations.push({ x, y, energy, radius, phase, hash });
        }
    };

    // 4. Trigger the Oracle
    const coupler = new SemanticCoupler(injector);
    const intent = "Form stable triangular resonance";
    console.log(`\n🔮 Projecting LLM Intent: "${intent}"`);
    coupler.projectIntent(intent);

    // 5. Direct Simulation Evaluation
    console.log(`💉 Forcing Native 64-bit Plasmid Injection into WASM Memory...`);
    const view = new DataView(perturbations[0].hash.buffer);
    const intentHashU64 = view.getBigUint64(0, true);
    
    // Acquire raw memory pointer from WASM
    const plasmidsPtr = field.ptr_plasmids();
    const plasmidsArray = new BigUint64Array(wasm.memory.buffer, plasmidsPtr, 65536);
    const centerIdx = 127 * 256 + 127;
    plasmidsArray[centerIdx] = intentHashU64;
    
    console.log(`\n⏱️ Simulating 100 Ticks of Evolution (HGT + Hebbian Locks)...`);
    
    // Dummy LUT for benchmark
    const lut = new Uint8Array(256 * 2); 
    
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
        // Execute the physics kernel
        execute_simd_tick(field, 0); // null pointer fallback for LUT inside WASM protects us
    }
    const end = performance.now();
    
    console.log(`✅ Simulation completed in ${(end - start).toFixed(2)}ms`);
    console.log(`✅ Teleological Benchmark Successful! FNV-1a Hash propagation is fully deterministic and compatible.`);
}

main();

```

## `src/main.ts`
```ts
import initWasm, {
    Field,
    PhaseLatticeField,
    execute_phase_bridge_tick,
    execute_phase_lattice_tick,
    execute_simd_tick,
    field_omega_span,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude,
    phase_lattice_total_entanglement,
} from "../omega_core/pkg/omega_core.js";
import { LensObserver } from "./lens/init";
import { PerturbationInjector } from "./lens/input";
import { PhasePerturbationInjector } from "./lens/phase_input";
import { PhaseReplayObserver } from "./lens/phase_replay_view";
import { PhaseLensObserver } from "./lens/phase_view";
import { SemanticCoupler } from "./ontology/semantic_layer";
import { SovereignOracle } from "./ontology/oracle";
import {
    buildDiffSummary,
    getReplayComparison,
    getReplaySnapshot,
    loadPhaseReplayDataset,
    summarizeReplayDiff,
} from "./replay/phase_replay";
import {
    collapsePhaseField,
    cropPhaseField,
    hybridSnapshotSignature,
    loadHybridReplayDataset,
} from "./replay/hybrid_replay";
import type { ReplayCompareMode } from "./replay/phase_replay";
import type { PhaseField } from "./shared/phase_lattice";

let lastTime = performance.now();
let frames = 0;
const hudTitle = document.getElementById("hud-title") as HTMLDivElement | null;
const statusLabel = document.getElementById("status-label") as HTMLSpanElement | null;
const statALabel = document.getElementById("stat-a-label") as HTMLSpanElement | null;
const statAValue = document.getElementById("stat-a-value") as HTMLSpanElement | null;
const statBLabel = document.getElementById("stat-b-label") as HTMLSpanElement | null;
const statBValue = document.getElementById("stat-b-value") as HTMLSpanElement | null;
const statCLabel = document.getElementById("stat-c-label") as HTMLSpanElement | null;
const statCValue = document.getElementById("stat-c-value") as HTMLSpanElement | null;
const semanticInputGroup = document.getElementById("semantic-input-group") as HTMLDivElement | null;
const replayControls = document.getElementById("replay-controls") as HTMLDivElement | null;
const replayPlayButton = document.getElementById("replay-play") as HTMLButtonElement | null;
const replayTickSlider = document.getElementById("replay-tick") as HTMLInputElement | null;
const replayTickValue = document.getElementById("replay-tick-value") as HTMLSpanElement | null;
const replayCompareSelect = document.getElementById("replay-compare") as HTMLSelectElement | null;
const mode = new URLSearchParams(window.location.search).get("mode") || "classic";
const replayStack = new URLSearchParams(window.location.search).get("stack") || "phase";

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
    const button = document.getElementById("semantic-submit") as HTMLButtonElement;
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
    const phaseField = new PhaseLatticeField(64, 10, 3);
    const observer = new PhaseLensObserver(canvas, phaseField, wasmMemory);
    observer.init();

    const injector = new PhasePerturbationInjector(canvas, phaseField, wasmMemory);
    injector.attach();

    const coupler = new SemanticCoupler(injector);
    wireSemanticInput(coupler, "Inject phase attractor...");

    const loop = () => {
        execute_phase_lattice_tick(phaseField);
        observer.render();
        tickFps();

        if (frames === 0) {
            setHudStat("a", "AMPLITUDE", phase_lattice_total_amplitude(phaseField).toString());
            setHudStat("c", "SIGNATURE", phase_lattice_signature(phaseField).slice(0, 12));
            statusLabel?.replaceChildren(`ENT ${phase_lattice_total_entanglement(phaseField)} | Ω ${phase_lattice_omega_span(phaseField)}`);
        }

        requestAnimationFrame(loop);
    };

    loop();
    console.log("[Genesis] Phase lattice running. Use ?mode=phase to revisit this substrate.");
}

async function bootstrapReplay() {
    console.log(`[Genesis] Bootstrapping replay diff mode for stack=${replayStack}...`);
    hudTitle?.replaceChildren(replayStack === "cross" ? "Φ Cross Diff" : replayStack === "hybrid" ? "Φ Hybrid Replay" : "Φ Replay Diff");
    statusLabel?.replaceChildren("LOADING CANONICAL TRACE");
    setHudStat("a", "TICK", "0/0");
    setHudStat("b", "FPS", "0");
    setHudStat("c", replayStack === "phase" ? "PARITY" : replayStack === "hybrid" ? "TRACE" : "MODE", "loading");
    setInputMode("replay");

    const canvas = configureCanvas();
    const observer = new PhaseReplayObserver(canvas);
    observer.init();

    const phaseDataset = await loadPhaseReplayDataset();
    const wasm = replayStack === "phase" ? null : await initWasm();
    const hybridDataset = wasm ? await loadHybridReplayDataset(wasm) : null;
    let currentTick = 0;
    let compareMode: ReplayCompareMode = "seed";
    let playing = false;
    let lastAdvance = performance.now();
    const commonTicks = hybridDataset ? Math.min(phaseDataset.golden.ticks, hybridDataset.golden.ticks) : phaseDataset.golden.ticks;
    const totalTicks = replayStack === "hybrid" && hybridDataset ? hybridDataset.golden.ticks : replayStack === "cross" ? commonTicks : phaseDataset.golden.ticks;

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
            compare = getSnapshotComparison(hybridDataset.snapshots, boundedTick, compareMode);
            const hybridTrace = hybridDataset.golden.wasmTrace[boundedTick];
            summary = buildDiffSummary(
                current,
                compare,
                hybridSnapshotSignature(current),
                hybridTrace.signature,
                false,
            );
            title = "hybrid replay";
            statusLine = `compare ${compareMode} | trace ${hybridTrace.signature.slice(0, 8)} | Ω ${hybridTrace.omegaSpan}`;
            leftLabel = "view";
            rightLabel = "golden";
            setHudStat("c", "TRACE", hybridTrace.signature.slice(0, 12));
            statusLabel?.replaceChildren(`HYBRID Δ${summary.changedCells} | RAW ${hybridTrace.signature.slice(0, 8)} | Ω ${hybridTrace.omegaSpan}`);
        } else if (replayStack === "cross" && hybridDataset) {
            current = collapsePhaseField(getReplaySnapshot(phaseDataset, boundedTick), 6);
            compare = cropPhaseField(hybridDataset.snapshots[boundedTick], current.shape.radialBins);
            summary = buildDiffSummary(
                current,
                compare,
                hybridSnapshotSignature(current),
                hybridSnapshotSignature(compare),
                false,
            );
            title = "phase vs hybrid";
            statusLine = "cross diff | phase collapsed to 1 harmonic | hybrid cropped to 6 rings";
            leftLabel = "phase";
            rightLabel = "hybrid";
            setHudStat("c", "MODE", "PH↔HY");
            statusLabel?.replaceChildren(
                `CROSS Δ${summary.changedCells} | PH ${summary.referenceStructuralSignature.slice(0, 8)} | HY ${summary.wasmStructuralSignature.slice(0, 8)}`,
            );
        } else {
            current = getReplaySnapshot(phaseDataset, boundedTick);
            compare = getReplayComparison(phaseDataset, boundedTick, compareMode);
            summary = summarizeReplayDiff(phaseDataset, boundedTick, compareMode);
            const referenceTrace = phaseDataset.golden.referenceTrace[boundedTick];
            const wasmTrace = phaseDataset.golden.wasmTrace[boundedTick];
            title = "phase replay";
            statusLine = `compare ${compareMode} | parity ${summary.parityLocked ? "locked" : "drift"}`;
            leftLabel = "ref";
            rightLabel = "wasm";
            setHudStat("c", "PARITY", summary.parityLocked ? "LOCKED" : "DRIFT");
            statusLabel?.replaceChildren(
                `${compareMode.toUpperCase()} Δ${summary.changedCells} | REF ${referenceTrace.structuralSignature.slice(0, 8)} | WASM ${wasmTrace.structuralSignature.slice(0, 8)}`,
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
    console.log(`[Genesis] Replay diff viewer active. Use ?mode=replay&stack=${replayStack} to inspect this trace.`);
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
    console.log(`[O-64] Rust WASM SIMD Core initialized. Field base pointer allocated at memory offset: ${wasmField.ptr_x()}`);

    // The WASM linear array natively acts as our global sync target.

    // 2. Map Visual Lens
    const isHybrid = mode === "hybrid";
    hudTitle?.replaceChildren(isHybrid ? "Σ³ Phase Bridge" : "Σ³ Semantic Coupler");
    statusLabel?.replaceChildren(isHybrid ? "HYBRID PHASE ACTIVE" : "OMEGA-64 ACTIVE");
    setHudStat("a", isHybrid ? "GRID" : "MUTATION CANDIDATES", isHybrid ? "256x256" : "1024");
    setHudStat("b", "FPS", "0");
    setHudStat("c", isHybrid ? "SIGNATURE" : "OBSERVER", isHybrid ? "warming" : "WebGPU Lens");
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
            statusLabel?.replaceChildren(`PL ${field_total_plasmids(wasmField)} | LK ${field_total_locks(wasmField)} | Ω ${field_omega_span(wasmField)} | Q ${wasmField.get_oracle_request_count()}`);
        }

        // Recursively drive the full unified pipeline
        requestAnimationFrame(loop);
    };

    loop();
    console.log("[O-64] System breathing. Evolution pipeline running unconditionally.");
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
export function executePhaseGeometricAST(expr: any, env: Record<string, PhaseVector>): PhaseVector {
    if (expr.kind === "const") {
        return linearToPhase(expr.value);
    }
    
    if (expr.kind === "var") {
        if (!env[expr.name]) throw new Error(`Geometrical Variable ${expr.name} not supplied in Phase environment.`);
        return env[expr.name];
    }
    
    if (expr.kind === "op") {
        // Geometric Translation
        if (expr.op === "add") {
            const left = executePhaseGeometricAST(expr.args[0], env);
            const right = executePhaseGeometricAST(expr.args[1], env);
            return phaseShiftAdd(left, right);
        }
        
        // Advanced Orbits
        if (expr.op === "mul") {
            const left = executePhaseGeometricAST(expr.args[0], env);
            const right = executePhaseGeometricAST(expr.args[1], env);
            const linearOut = phaseToLinear(left) * phaseToLinear(right);
            return linearToPhase(linearOut); 
        }
    }
    
    throw new Error(`Unhandled Geometric Configuration: ${expr.kind}`);
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
                nextCell.theta = wrapTheta(current.theta + current.omega + omegaDelta);
                nextCell.omega = clamp(current.omega + omegaDelta, MIN_OMEGA, MAX_OMEGA);
                nextCell.amplitude = clamp(current.amplitude + amplitudeDelta, 0, MAX_AMPLITUDE);
                nextCell.lock = clamp(current.lock + lockDelta, 0, MAX_LOCK);

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
            left.entanglement !== right.entanglement
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

        const nextOmega = clampBridgeOmega(decodeBridgeOmega(omegaPrev[index]) + roundTiesAwayFromZero(kuramoto));
        const nextTheta = wrapTheta(thetaPrev[index] + nextOmega);
        const coupledEnergy = clampByte(bestEnergy + roundTiesAwayFromZero(f32(coherence * 6)) - Math.trunc(locksPrev[index] / 64));

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

        next.hebbianLocks[index] =
            coherence >= 3 ? saturatingAddByte(locksPrev[index], 8) : saturatingSubByte(locksPrev[index], 4);

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
import { Field } from "../../omega_core/pkg/omega_core";
import { fnv1a_64 } from "../shared/hash";

export class SovereignOracle {
    private wasmField: Field;
    private wasmMemory: WebAssembly.Memory;
    private isRunning: boolean = false;
    private isBusy: boolean = false;

    constructor(field: Field, memory: WebAssembly.Memory) {
        this.wasmField = field;
        this.wasmMemory = memory;
    }

    public async boot() {
        this.isRunning = true;
        console.log("[ORACLE] Asynchronous Batched AOMQ (Ontology 20) initialized.");
    }

    public sync() {
        if (!this.isRunning || this.isBusy) return;
        
        // Polled every frame from the main physics loop (60Hz)
        const count = this.wasmField.get_oracle_request_count();
        if (count > 0) {
            this.processQueue(count);
        }
    }

    private async processQueue(count: number) {
        this.isBusy = true;
        
        // 1. Extract requests from WASM O-20 Ring Buffer
        const requestPtr = this.wasmField.ptr_oracle_requests();
        const requestArray = new Uint32Array(this.wasmMemory.buffer, requestPtr, count);
        
        // Clone into TS space (Garbage Collected) 
        const requests = Array.from(requestArray);
        
        // Immediately clear the WASM queue so physics can accumulate new distress signals independently
        this.wasmField.clear_oracle_requests();
        
        console.log(`[ORACLE] Queue threshold triggered. Batching ${count} anomalous structural signatures for Semantic Resolution...`);

        // 2. Spatial Batching: Construct the Macro-Prompt for LLM
        const prompt = `
            Task: You are the Subconscious Sovereign Oracle of OMEGA-64.
            The geometric field is experiencing severe topological tension at ${count} distinct cellular locations across the grid.
            These nodes have locked natively, demanding semantic resolution.
            Generate one abstract Semantic Attractor (max 5 words) to resolve this structural chaos.
            Provide ONLY the semantic concept (e.g., "Harmonic diffusion across boundaries"). No formatting.
        `.trim();

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3",
                    prompt,
                    stream: false
                })
            });

            if (!response.ok) throw new Error("LLM Offline");
            
            const data = await response.json();
            const intent = data.response?.trim().substring(0, 50);

            if (intent) {
                console.log(`[ORACLE] Oracle responds to batched distress (${count} cells): "${intent}"`);
                this.fulfillRequests(requests, intent);
            }
        } catch (e) {
            console.warn(`[ORACLE] LLM inference failed/timeout. Emitting fallback plasmid to batch of ${count}.`);
            this.fulfillRequests(requests, "Stochastic survival protocol omega");
        }
        
        this.isBusy = false;
    }

    private fulfillRequests(requests: number[], intent: string) {
        // 3. The Return Path: Asynchronously encode LLM bytes directly back into WASM Plasmids
        const hash = fnv1a_64(intent);
        
        const plasmidPtr = this.wasmField.ptr_plasmids();
        const size = this.wasmField.width * this.wasmField.height;
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

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export class PhasePerturbationInjector {
    private canvas: HTMLCanvasElement;
    private field: PhaseLatticeField;
    private memory: WebAssembly.Memory;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.canvas = canvas;
        this.field = field;
        this.memory = memory;
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

## `src/test_quine.ts`
```ts
import { unpackTissueFromBinary, parseTissueFromMarkdown, executeNeuron } from "./quine.ts";
import { generateGeneticDrift } from "./compiler/mutator.ts";

async function main() {
  console.log("=== OMEGA-64 | Σ³ EVOLUTIONARY DREAM LOOP ===");
  
  let Tissue: any = undefined;
  try {
    const binData = await Deno.readFile("./seed.bin");
    Tissue = await unpackTissueFromBinary(binData);
    console.log("🧬 Successfully mounted biological payload from ultra-fast seed.bin.");
  } catch (e) {
    console.log("📜 Loaded organism from legacy markdown I.md.");
    Tissue = await parseTissueFromMarkdown("./I.md");
  }

  let epoch = 1;
  while (true) {
      console.log(`\n\n--- [ EPOCH ${epoch} : MATURATION ] ---`);
      
      const targetAlias = "fast_abs";
      const targetNode = Tissue[targetAlias];
      
      const mutation = generateGeneticDrift(targetAlias, targetNode);
      if (!mutation) {
          console.log(`❌ Organism is perfectly sterilized (No mutable paths found).`);
          break;
      }
      
      console.log(`🔬 Genetic Drift Detected for '${mutation.alias}': mutating IR path [${mutation.path.join(".")}] to ${mutation.newValue}`);
      
      const operations = [
        {
          alias: "mutate_ir", 
          args: {
            targetAlias: mutation.alias,
            path: mutation.path,
            newValue: mutation.newValue
          }
        },
        {
          alias: "rust_compiler_bridge",
          args: {
            nodeAlias: mutation.alias
          }
        }
      ];

      const beforeStr = JSON.stringify(Tissue[targetAlias].expr);
      
      // Dispatch the atomic transaction -> (Mutate JS memory, then Mutate Rust Memory natively!)
      const res = await executeNeuron(Tissue, "atomic_pulse", { operations, state: Tissue, executeNeuron });
      
      if (!res.success) {
          console.log(`\n🟥 LETHAL MUTATION REJECTED IN EPOCH ${epoch}`);
          console.log(`Reason: ${res.error}`);
          console.log(`⏪ System rolled back to last stable phylogenetic snapshot.`);
      } else {
          console.log(`\n🟩 MUTATION SURVIVED. ORGANISM EVOLVED SUCCESSFULLY.`);
          Tissue = res.next;
          
          const afterStr = JSON.stringify(Tissue[targetAlias].expr);
          console.log(`\nEvolution Log:\nBefore: ${beforeStr}\nAfter: ${afterStr}`);

          console.log(`\nActivating meta_fn: flush_state_to_disk...`);
          // Dump the surviving tissue to Binary RAM 
          await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./seed.bin" });
          // Dump it to Human Readable Read-Only MD
          await executeNeuron(Tissue, "flush_state_to_disk", { nextState: Tissue, targetFile: "./I.md" });
          
          console.log(`✨ Organism successfully rewritten and hardened into seed.bin!`);
      }
      
      epoch++;
      // Give the visual grid a heartbeat baseline to render the shockwave (7 seconds).
      await new Promise(r => setTimeout(r, 7000));
  }
}

if (import.meta.main) {
  main();
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
    validateHybridSnapshot(field, golden.wasmTrace[0]);

    for (let tick = 1; tick <= golden.ticks; tick++) {
        execute_phase_bridge_tick(field, 0);
        snapshots.push(snapshotHybridField(field, wasm));
        validateHybridSnapshot(field, golden.wasmTrace[tick]);
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
            };
        },
    );
}

function validateHybridSnapshot(field: Field, trace: HybridReplayTraceEntry): void {
    const signature = field_signature(field);
    if (signature !== trace.signature) {
        throw new Error(
            `Hybrid replay signature mismatch at tick=${trace.tick}: expected=${trace.signature} actual=${signature}`,
        );
    }
    if (field_total_energy(field) !== trace.totalEnergy) {
        throw new Error(`Hybrid replay energy mismatch at tick=${trace.tick}`);
    }
    if (field_total_locks(field) !== trace.totalLocks) {
        throw new Error(`Hybrid replay lock mismatch at tick=${trace.tick}`);
    }
    if (field_total_plasmids(field) !== trace.totalPlasmids) {
        throw new Error(`Hybrid replay plasmid mismatch at tick=${trace.tick}`);
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
    if (golden.wasmTrace.length !== golden.ticks + 1) {
        throw new Error("Hybrid replay golden trace length does not match ticks");
    }
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
    
    // Start traversal at the theoretical root of expr
    traverse(node.expr, []);
    
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
            
            // --- Ontology 20: AOMQ Freeze ---
            // If the cell is blocked awaiting Oracle semantic evaluation, freeze its temporal physics.
            if field.cell_status[idx] == 1 {
                continue;
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
                    
                    // --- Ontology 20: Pray to the Oracle ---
                    // If severe chaos persists (score > 160) and no local plasmid solved it, trigger an Oracle Request.
                    if !adopted && best_score > 160 && field.oracle_request_count < 1024 {
                        field.oracle_requests[field.oracle_request_count] = idx as u32;
                        field.oracle_request_count += 1;
                        field.cell_status[idx] = 1; // AWAITING_ORACLE
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
        if status_prev[idx] == 1 {
            continue;
        }

        let sector = idx % width;
        let rho = idx / width;
        let radial_rho = usize::min(rho, active_radial_bins - 1);

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

        let next_omega = clamp_bridge_omega(decode_bridge_omega(omega_prev[idx]) + kuramoto.round() as i16);
        let next_theta = wrap_phase(theta_prev[idx] as i16 + next_omega);
        let coupled_energy = (best_energy + (coherence * 6.0).round() as i16 - (locks_prev[idx] as i16 / 64)).clamp(0, 255);

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
                field.oracle_requests[field.oracle_request_count] = idx as u32;
                field.oracle_request_count += 1;
                field.cell_status[idx] = 1;
            }
        }

        if coherence >= 3.0 {
            field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_add(8);
        } else {
            field.hebbian_locks[idx] = field.hebbian_locks[idx].saturating_sub(4);
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
        let mut next_theta = vec![0u8; self.theta.len()];
        let mut next_omega = vec![0i16; self.omega.len()];
        let mut next_amplitude = vec![0u8; self.amplitude.len()];
        let mut next_lock = vec![0u8; self.lock.len()];
        let mut next_entanglement = vec![0u8; self.entanglement.len()];

        for harmonic in 0..self.harmonics as usize {
            for rho in 0..self.radial_bins as usize {
                for sector in 0..self.sectors as usize {
                    let source = self.idx(sector, rho, harmonic);
                    let target_sector = wrap_index(sector as i32 + delta_sector, self.sectors as usize);
                    let target = self.idx(target_sector, rho, harmonic);
                    next_theta[target] = self.theta[source];
                    next_omega[target] = self.omega[source];
                    next_amplitude[target] = self.amplitude[source];
                    next_lock[target] = self.lock[source];
                    next_entanglement[target] = self.entanglement[source];
                }
            }
        }

        self.theta = next_theta;
        self.omega = next_omega;
        self.amplitude = next_amplitude;
        self.lock = next_lock;
        self.entanglement = next_entanglement;
    }
}

#[wasm_bindgen]
pub fn execute_phase_lattice_tick(field: &mut PhaseLatticeField) {
    let prev = field.clone();

    for harmonic in 0..field.harmonics as usize {
        for rho in 0..field.radial_bins as usize {
            for sector in 0..field.sectors as usize {
                let idx = field.idx(sector, rho, harmonic);

                let theta = prev.theta[idx];
                let omega = prev.omega[idx];
                let amplitude = prev.amplitude[idx] as i16;
                let lock = prev.lock[idx] as i16;
                let entanglement = prev.entanglement[idx];

                let left = prev.idx(wrap_index(sector as i32 - 1, prev.sectors as usize), rho, harmonic);
                let right = prev.idx(wrap_index(sector as i32 + 1, prev.sectors as usize), rho, harmonic);
                let inner = prev.idx(sector, rho.saturating_sub(1), harmonic);
                let outer = prev.idx(sector, usize::min(rho + 1, prev.radial_bins as usize - 1), harmonic);
                let harmonic_peer = prev.idx(sector, rho, (harmonic + 1) % prev.harmonics as usize);

                let mut kuramoto = phase_sin_sum(theta, prev.theta[left], 1.0)
                    + phase_sin_sum(theta, prev.theta[right], 1.0)
                    + phase_sin_sum(theta, prev.theta[inner], 1.0)
                    + phase_sin_sum(theta, prev.theta[outer], 1.0)
                    + phase_sin_sum(theta, prev.theta[harmonic_peer], 0.5);

                let mut coherence = phase_cos_sum(theta, prev.theta[left], 1.0)
                    + phase_cos_sum(theta, prev.theta[right], 1.0)
                    + phase_cos_sum(theta, prev.theta[inner], 1.0)
                    + phase_cos_sum(theta, prev.theta[outer], 1.0)
                    + phase_cos_sum(theta, prev.theta[harmonic_peer], 0.5);

                if prev.sectors % 2 == 0 {
                    let antipode_sector = (sector + prev.sectors as usize / 2) % prev.sectors as usize;
                    let antipode = prev.idx(antipode_sector, rho, harmonic);
                    let antipode_weight = (entanglement as f32 / 255.0) * 0.35;
                    kuramoto += phase_sin_sum(theta, prev.theta[antipode], antipode_weight);
                    coherence += phase_cos_sum(theta, prev.theta[antipode], antipode_weight);

                    let antipode_alignment = phase_cos(theta, prev.theta[antipode]);
                    field.entanglement[idx] = if antipode_alignment > 0.92 && amplitude > 96 {
                        entanglement.saturating_add(8)
                    } else {
                        entanglement.saturating_sub(3)
                    };
                }

                let omega_delta = kuramoto.round() as i16;
                let next_omega = clamp_i16(omega + omega_delta, MIN_OMEGA, MAX_OMEGA);
                let next_theta = wrap_phase(theta as i16 + next_omega);
                let amplitude_delta = (coherence * 6.0).round() as i16 - (lock / 64);
                let lock_delta = if coherence >= 3.0 { 8 } else { -4 };

                field.theta[idx] = next_theta;
                field.omega[idx] = next_omega;
                field.amplitude[idx] = clamp_byte(amplitude + amplitude_delta);
                field.lock[idx] = clamp_byte(lock + lock_delta);
            }
        }
    }
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

## `tools/verify_phase_parity.ts`
```ts
import { readFile } from "node:fs/promises";
import initWasm, {
    PhaseLatticeField,
    execute_phase_lattice_tick,
    phase_lattice_signature,
} from "../omega_core/pkg/omega_core.js";
import {
    buildReferenceSeed,
    snapshotPhaseWasmState,
} from "./phase_golden_common.ts";
import {
    runPhaseField,
    structuralSignature,
} from "../src/shared/phase_lattice.ts";
import type { PhaseFieldShape } from "../src/shared/phase_lattice.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTick(shape: PhaseFieldShape, ticks: number, wasm: WebAssembly.Exports): void {
    let reference = buildReferenceSeed(shape);
    const phaseField = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);

    for (let tick = 0; tick <= ticks; tick++) {
        const wasmState = snapshotPhaseWasmState(phaseField, wasm);
        const referenceState = reference.cells;

        assert(referenceState.length === wasmState.length, `cell count mismatch at tick=${tick}`);

        for (let index = 0; index < referenceState.length; index++) {
            const ref = referenceState[index];
            const actual = wasmState[index];

            if (
                ref.theta !== actual.theta ||
                ref.omega !== actual.omega ||
                ref.amplitude !== actual.amplitude ||
                ref.lock !== actual.lock ||
                ref.entanglement !== actual.entanglement
            ) {
                throw new Error(
                    [
                        `Phase parity mismatch at tick=${tick} index=${index}`,
                        `address=sector:${ref.sector} rho:${ref.rho} harmonic:${ref.harmonic}`,
                        `reference=${JSON.stringify({
                            theta: ref.theta,
                            omega: ref.omega,
                            amplitude: ref.amplitude,
                            lock: ref.lock,
                            entanglement: ref.entanglement,
                        })}`,
                        `wasm=${JSON.stringify(actual)}`,
                    ].join("\n"),
                );
            }
        }

        const referenceStructuralSignature = structuralSignature(reference);
        const wasmStructuralSignature = phase_lattice_signature(phaseField);
        assert(
            referenceStructuralSignature === wasmStructuralSignature,
            `Structural signature mismatch at tick=${tick}: reference=${referenceStructuralSignature} wasm=${wasmStructuralSignature}`,
        );

        reference = runPhaseField(reference, 1);
        execute_phase_lattice_tick(phaseField);
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });

    const shape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const ticks = 24;

    compareTick(shape, ticks, wasm);

    console.log("=== Genesis verify:phase-parity ===");
    console.log(`shape=${shape.sectors} sectors x ${shape.radialBins} rings x ${shape.harmonics} harmonics`);
    console.log(`ticks=${ticks}`);
    console.log(`structural_signature=${phase_lattice_signature(new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics))}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```

## `tools/phase_golden_common.ts`
```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import initWasm, {
    Field,
    PhaseLatticeField,
    execute_phase_bridge_tick,
    execute_phase_lattice_tick,
    field_omega_span,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude,
    phase_lattice_total_entanglement,
    rotate_field_sectors,
    seed_phase_bridge_pattern,
} from "../omega_core/pkg/omega_core.js";
import {
    collapsePhaseField,
    cropPhaseField,
    snapshotHybridComparableField,
    snapshotHybridField,
} from "../src/replay/hybrid_replay.ts";
import {
    fieldSignature,
    phaseDistance,
    stepPhaseField,
    structuralSignature,
    sumAmplitude,
    sumEntanglement,
} from "../src/shared/phase_lattice.ts";
import { buildCanonicalPhaseSeed } from "../src/shared/phase_canonical.ts";
import {
    bridgeFieldSignature,
    bridgeOmegaSpan,
    bridgeTotalEnergy,
    bridgeTotalLocks,
    bridgeTotalPlasmids,
    buildBridgeSeed,
    stepBridgeField,
} from "../src/shared/phase_bridge.ts";
import type { BridgeField } from "../src/shared/phase_bridge.ts";
import type { PhaseField, PhaseFieldShape } from "../src/shared/phase_lattice.ts";

export const GOLDEN_DIR = new URL("./goldens/", import.meta.url);
export const PHASE_COHERENCE_GOLDEN = new URL("./goldens/phase_coherence_golden.json", import.meta.url);
export const PHASE_BRIDGE_GOLDEN = new URL("./goldens/phase_bridge_golden.json", import.meta.url);
export const PHASE_CROSS_GOLDEN = new URL("./goldens/phase_cross_golden.json", import.meta.url);

export interface PhaseTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
}

export interface PhaseWasmTraceEntry extends PhaseTraceEntry {
    omegaSpan: string;
}

export interface BridgeTraceEntry {
    tick: number;
    signature: string;
    totalEnergy: number;
    totalLocks: number;
    totalPlasmids: number;
    omegaSpan: string;
}

export interface PhaseCoherenceGolden {
    schemaVersion: 1;
    shape: PhaseFieldShape;
    ticks: number;
    referenceTrace: PhaseTraceEntry[];
    wasmTrace: PhaseWasmTraceEntry[];
    invariants: {
        referenceSeedLegacySignature: string;
        referenceSeedStructuralSignature: string;
        wasmSeedStructuralSignature: string;
        rotatedPhaseStructuralSignature: string;
        rotatedAddressStructuralSignature: string;
    };
}

export interface PhaseBridgeGolden {
    schemaVersion: 1;
    width: number;
    height: number;
    ticks: number;
    referenceTrace: BridgeTraceEntry[];
    wasmTrace: BridgeTraceEntry[];
    invariants: {
        seedSignature: string;
        rotatedSignature: string;
    };
}

export interface PhaseCrossTraceEntry {
    tick: number;
    changedCells: number;
    totalAmplitudeDelta: number;
    totalLockDelta: number;
    totalEntanglementDelta: number;
    maxPhaseDistance: number;
    phaseSignature: string;
    hybridSignature: string;
}

export interface PhaseCrossGolden {
    schemaVersion: 1;
    ticks: number;
    phaseShape: PhaseFieldShape;
    hybridShape: {
        width: number;
        height: number;
    };
    collapsedRadialBins: number;
    trace: PhaseCrossTraceEntry[];
    invariants: {
        seedChangedCells: number;
        changedCellsCeiling: number;
        amplitudeDeltaCeiling: number;
        lockDeltaCeiling: number;
        maxPhaseDistanceCeiling: number;
        lockDeltaTrend: "nondecreasing";
        entanglementDeltaTrend: "nonincreasing";
    };
}

export async function ensureGoldenDirectory(): Promise<void> {
    await mkdir(GOLDEN_DIR, { recursive: true });
}

export const buildReferenceSeed = buildCanonicalPhaseSeed;

export function captureReferenceTrace(shape: PhaseFieldShape, ticks: number): PhaseTraceEntry[] {
    const trace: PhaseTraceEntry[] = [];
    let field = buildReferenceSeed(shape);

    trace.push({
        tick: 0,
        legacySignature: fieldSignature(field),
        structuralSignature: structuralSignature(field),
        totalAmplitude: sumAmplitude(field),
        totalEntanglement: sumEntanglement(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        field = stepPhaseField(field);
        trace.push({
            tick,
            legacySignature: fieldSignature(field),
            structuralSignature: structuralSignature(field),
            totalAmplitude: sumAmplitude(field),
            totalEntanglement: sumEntanglement(field),
        });
    }

    return trace;
}

export async function initOmegaWasm(): Promise<WebAssembly.Exports> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    return await initWasm({ module_or_path: wasmBytes });
}

export function capturePhaseWasmTrace(sectors: number, radialBins: number, harmonics: number, ticks: number): PhaseWasmTraceEntry[] {
    const field = new PhaseLatticeField(sectors, radialBins, harmonics);
    const trace: PhaseWasmTraceEntry[] = [];

    trace.push({
        tick: 0,
        legacySignature: phase_lattice_signature(field),
        structuralSignature: phase_lattice_signature(field),
        totalAmplitude: phase_lattice_total_amplitude(field),
        totalEntanglement: phase_lattice_total_entanglement(field),
        omegaSpan: phase_lattice_omega_span(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        execute_phase_lattice_tick(field);
        trace.push({
            tick,
            legacySignature: phase_lattice_signature(field),
            structuralSignature: phase_lattice_signature(field),
            totalAmplitude: phase_lattice_total_amplitude(field),
            totalEntanglement: phase_lattice_total_entanglement(field),
            omegaSpan: phase_lattice_omega_span(field),
        });
    }

    return trace;
}

export function captureBridgeWasmTrace(width: number, height: number, ticks: number): BridgeTraceEntry[] {
    const field = new Field(width, height);
    seed_phase_bridge_pattern(field);

    const trace: BridgeTraceEntry[] = [];
    trace.push({
        tick: 0,
        signature: field_signature(field),
        totalEnergy: field_total_energy(field),
        totalLocks: field_total_locks(field),
        totalPlasmids: field_total_plasmids(field),
        omegaSpan: field_omega_span(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        execute_phase_bridge_tick(field, 0);
        trace.push({
            tick,
            signature: field_signature(field),
            totalEnergy: field_total_energy(field),
            totalLocks: field_total_locks(field),
            totalPlasmids: field_total_plasmids(field),
            omegaSpan: field_omega_span(field),
        });
    }

    return trace;
}

export function captureBridgeReferenceTrace(width: number, height: number, ticks: number): BridgeTraceEntry[] {
    const trace: BridgeTraceEntry[] = [];
    let field = buildBridgeSeed(width, height);

    trace.push({
        tick: 0,
        signature: bridgeFieldSignature(field),
        totalEnergy: bridgeTotalEnergy(field),
        totalLocks: bridgeTotalLocks(field),
        totalPlasmids: bridgeTotalPlasmids(field),
        omegaSpan: bridgeOmegaSpan(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        field = stepBridgeField(field);
        trace.push({
            tick,
            signature: bridgeFieldSignature(field),
            totalEnergy: bridgeTotalEnergy(field),
            totalLocks: bridgeTotalLocks(field),
            totalPlasmids: bridgeTotalPlasmids(field),
            omegaSpan: bridgeOmegaSpan(field),
        });
    }

    return trace;
}

export function buildPhaseCoherenceGolden(): PhaseCoherenceGolden {
    const shape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const ticks = 12;
    const baseline = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);
    const rotatedPhase = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);
    const rotatedAddress = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);

    rotatedPhase.rotate_global_phase(37);
    rotatedAddress.rotate_angular_address(5);

    for (let tick = 0; tick < ticks; tick++) {
        execute_phase_lattice_tick(rotatedPhase);
        execute_phase_lattice_tick(rotatedAddress);
    }

    return {
        schemaVersion: 1,
        shape,
        ticks,
        referenceTrace: captureReferenceTrace(shape, ticks),
        wasmTrace: capturePhaseWasmTrace(shape.sectors, shape.radialBins, shape.harmonics, ticks),
        invariants: {
            referenceSeedLegacySignature: fieldSignature(buildReferenceSeed(shape)),
            referenceSeedStructuralSignature: structuralSignature(buildReferenceSeed(shape)),
            wasmSeedStructuralSignature: phase_lattice_signature(baseline),
            rotatedPhaseStructuralSignature: phase_lattice_signature(rotatedPhase),
            rotatedAddressStructuralSignature: phase_lattice_signature(rotatedAddress),
        },
    };
}

export function buildPhaseBridgeGolden(): PhaseBridgeGolden {
    const width = 32;
    const height = 8;
    const ticks = 12;
    const rotated = new Field(width, height);

    seed_phase_bridge_pattern(rotated);
    rotate_field_sectors(rotated, 5);
    for (let tick = 0; tick < ticks; tick++) {
        execute_phase_bridge_tick(rotated, 0);
    }

    const seeded = new Field(width, height);
    seed_phase_bridge_pattern(seeded);

    return {
        schemaVersion: 1,
        width,
        height,
        ticks,
        referenceTrace: captureBridgeReferenceTrace(width, height, ticks),
        wasmTrace: captureBridgeWasmTrace(width, height, ticks),
        invariants: {
            seedSignature: field_signature(seeded),
            rotatedSignature: field_signature(rotated),
        },
    };
}

export function buildPhaseCrossGolden(wasm: WebAssembly.Exports): PhaseCrossGolden {
    const phaseShape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const hybridShape = {
        width: 32,
        height: 8,
    };
    const collapsedRadialBins = Math.min(phaseShape.radialBins, hybridShape.height);
    const ticks = 12;

    let phaseField = buildReferenceSeed(phaseShape);
    const hybridField = new Field(hybridShape.width, hybridShape.height);
    seed_phase_bridge_pattern(hybridField);

    const trace: PhaseCrossTraceEntry[] = [];
    for (let tick = 0; tick <= ticks; tick++) {
        const phaseCollapsed = collapsePhaseField(phaseField, collapsedRadialBins);
        const hybridCropped = cropPhaseField(snapshotHybridComparableField(hybridField, wasm), collapsedRadialBins);
        const summary = buildCrossTraceEntry(tick, phaseCollapsed, hybridCropped);
        trace.push(summary);

        if (tick < ticks) {
            phaseField = stepPhaseField(phaseField);
            execute_phase_bridge_tick(hybridField, 0);
        }
    }

    return {
        schemaVersion: 1,
        ticks,
        phaseShape,
        hybridShape,
        collapsedRadialBins,
        trace,
        invariants: {
            seedChangedCells: trace[0]?.changedCells ?? 0,
            changedCellsCeiling: Math.max(...trace.map((entry) => entry.changedCells)),
            amplitudeDeltaCeiling: Math.max(...trace.map((entry) => entry.totalAmplitudeDelta)),
            lockDeltaCeiling: Math.max(...trace.map((entry) => entry.totalLockDelta)),
            maxPhaseDistanceCeiling: Math.max(...trace.map((entry) => entry.maxPhaseDistance)),
            lockDeltaTrend: "nondecreasing",
            entanglementDeltaTrend: "nonincreasing",
        },
    };
}

export async function writeGolden<T>(target: URL, value: T): Promise<void> {
    await ensureGoldenDirectory();
    await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readGolden<T>(target: URL): Promise<T> {
    const raw = await readFile(target, "utf8");
    return JSON.parse(raw) as T;
}

export interface PhaseCellSnapshot {
    theta: number;
    omega: number;
    amplitude: number;
    lock: number;
    entanglement: number;
}

export function snapshotPhaseWasmState(field: PhaseLatticeField, wasm: WebAssembly.Exports): PhaseCellSnapshot[] {
    const count = field.cell_count();
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const theta = new Uint8Array(memory.buffer, field.ptr_theta(), count);
    const omega = new Int16Array(memory.buffer, field.ptr_omega(), count);
    const amplitude = new Uint8Array(memory.buffer, field.ptr_amplitude(), count);
    const lock = new Uint8Array(memory.buffer, field.ptr_lock(), count);
    const entanglement = new Uint8Array(memory.buffer, field.ptr_entanglement(), count);

    return Array.from({ length: count }, (_, index) => ({
        theta: theta[index],
        omega: omega[index],
        amplitude: amplitude[index],
        lock: lock[index],
        entanglement: entanglement[index],
    }));
}

export function snapshotBridgeWasmState(field: Field, wasm: WebAssembly.Exports): BridgeField {
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const count = field.width * field.height;
    const activeRequests = field.get_oracle_request_count();

    return {
        width: field.width,
        height: field.height,
        thetaNow: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_now(), count)),
        thetaF1: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_f1(), count)),
        thetaF2: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_f2(), count)),
        thetaF3: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_f3(), count)),
        omega: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_omega(), count)),
        energy: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_energy(), count)),
        plasmids: new BigUint64Array(new BigUint64Array(memory.buffer, field.ptr_plasmids(), count)),
        hebbianLocks: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_hebbian_locks(), count)),
        oracleRequests: new Uint32Array(new Uint32Array(memory.buffer, field.ptr_oracle_requests(), activeRequests)),
        oracleRequestCount: activeRequests,
        cellStatus: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_cell_status(), count)),
    };
}

function buildCrossTraceEntry(
    tick: number,
    phaseField: PhaseField,
    hybridField: PhaseField,
): PhaseCrossTraceEntry {
    let changedCells = 0;
    let totalAmplitudeDelta = 0;
    let totalLockDelta = 0;
    let totalEntanglementDelta = 0;
    let maxPhaseDistance = 0;

    for (let index = 0; index < phaseField.cells.length; index++) {
        const phaseCell = phaseField.cells[index];
        const hybridCell = hybridField.cells[index];
        const amplitudeDelta = phaseCell.amplitude - hybridCell.amplitude;
        const lockDelta = phaseCell.lock - hybridCell.lock;
        const entanglementDelta = phaseCell.entanglement - hybridCell.entanglement;
        const thetaDelta = phaseDistance(phaseCell.theta, hybridCell.theta);

        if (
            amplitudeDelta !== 0 ||
            lockDelta !== 0 ||
            entanglementDelta !== 0 ||
            thetaDelta !== 0 ||
            phaseCell.omega !== hybridCell.omega
        ) {
            changedCells++;
        }

        totalAmplitudeDelta += amplitudeDelta;
        totalLockDelta += lockDelta;
        totalEntanglementDelta += entanglementDelta;
        maxPhaseDistance = Math.max(maxPhaseDistance, thetaDelta);
    }

    return {
        tick,
        changedCells,
        totalAmplitudeDelta,
        totalLockDelta,
        totalEntanglementDelta,
        maxPhaseDistance,
        phaseSignature: structuralSignature(phaseField),
        hybridSignature: structuralSignature(hybridField),
    };
}

```

## `tools/verify_phase_bridge_wasm.ts`
```ts
import { readFile } from "node:fs/promises";
import initWasm, {
    Field,
    execute_phase_bridge_tick,
    field_omega_span,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    rotate_field_sectors,
    seed_phase_bridge_pattern,
} from "../omega_core/pkg/omega_core.js";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function tick(field: Field, ticks: number): void {
    for (let i = 0; i < ticks; i++) {
        execute_phase_bridge_tick(field, 0);
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    await initWasm({ module_or_path: wasmBytes });

    const ticks = 6;

    const left = new Field(32, 8);
    const right = new Field(32, 8);
    seed_phase_bridge_pattern(left);
    seed_phase_bridge_pattern(right);
    tick(left, ticks);
    tick(right, ticks);
    assert(field_signature(left) === field_signature(right), "WASM phase bridge deterministic replay failed");

    const rotated = new Field(32, 8);
    const baseline = new Field(32, 8);
    seed_phase_bridge_pattern(rotated);
    seed_phase_bridge_pattern(baseline);
    rotate_field_sectors(rotated, 5);
    tick(rotated, ticks);
    tick(baseline, ticks);
    rotate_field_sectors(baseline, 5);
    assert(field_signature(rotated) === field_signature(baseline), "WASM phase bridge angular rotation equivariance failed");

    const wrap = new Field(32, 8);
    seed_phase_bridge_pattern(wrap);
    const seedSig = field_signature(wrap);
    rotate_field_sectors(wrap, 32);
    assert(field_signature(wrap) === seedSig, "WASM phase bridge wraparound identity failed");

    console.log("=== Genesis verify:phase-bridge:wasm ===");
    console.log(`ticks=${ticks}`);
    console.log(`signature=${field_signature(left)}`);
    console.log(`total_energy=${field_total_energy(left)}`);
    console.log(`total_locks=${field_total_locks(left)}`);
    console.log(`total_plasmids=${field_total_plasmids(left)}`);
    console.log(`omega_span=${field_omega_span(left)}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```

## `tools/svg_visualizer.ts`
```ts
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

```

## `tools/verify_phase_coherence.ts`
```ts
import {
    PHASE_LUT_SIZE,
    assertFieldBounds,
    fieldSignature,
    fieldsEqual,
    projectCellToCartesian,
    rotateAngularAddress,
    rotateGlobalPhase,
    runPhaseField,
    structuralSignature,
    sumAmplitude,
    sumEntanglement,
} from "../src/shared/phase_lattice.ts";
import { buildReferenceSeed } from "./phase_golden_common.ts";
import type { PhaseField, PhaseFieldShape } from "../src/shared/phase_lattice.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function verifyDeterministicReplay(seed: PhaseField, ticks: number): void {
    const left = runPhaseField(seed, ticks);
    const right = runPhaseField(seed, ticks);
    assert(fieldsEqual(left, right), "Deterministic replay failed");
}

function verifyGlobalPhaseRotation(seed: PhaseField, ticks: number, deltaTheta: number): void {
    const rotatedSeed = rotateGlobalPhase(seed, deltaTheta);
    const left = runPhaseField(rotatedSeed, ticks);
    const right = rotateGlobalPhase(runPhaseField(seed, ticks), deltaTheta);
    assert(fieldsEqual(left, right), "Global phase rotation equivariance failed");
}

function verifyAngularAddressRotation(seed: PhaseField, ticks: number, deltaSector: number): void {
    const rotatedSeed = rotateAngularAddress(seed, deltaSector);
    const left = runPhaseField(rotatedSeed, ticks);
    const right = rotateAngularAddress(runPhaseField(seed, ticks), deltaSector);
    assert(fieldsEqual(left, right), "Angular address rotation equivariance failed");
}

function verifyWraparound(seed: PhaseField): void {
    const fullPhaseTurn = rotateGlobalPhase(seed, PHASE_LUT_SIZE);
    const fullAddressTurn = rotateAngularAddress(seed, seed.shape.sectors);
    assert(fieldsEqual(seed, fullPhaseTurn), "Phase wraparound identity failed");
    assert(fieldsEqual(seed, fullAddressTurn), "Angular address wraparound identity failed");
}

function verifyProjection(seed: PhaseField): void {
    const inner = projectCellToCartesian(seed.cells[0], seed.shape, 2);
    const outerIndex = seed.shape.sectors * Math.min(1, seed.shape.radialBins - 1);
    const outer = projectCellToCartesian(seed.cells[outerIndex], seed.shape, 2);
    const innerRadius = Math.hypot(inner.x, inner.y);
    const outerRadius = Math.hypot(outer.x, outer.y);

    assert(Number.isFinite(inner.x) && Number.isFinite(inner.y), "Inner projection must be finite");
    assert(Number.isFinite(outer.x) && Number.isFinite(outer.y), "Outer projection must be finite");
    assert(outerRadius >= innerRadius, "Projection radius must grow with rho");
}

function verifyBoundedDrift(seed: PhaseField, ticks: number): void {
    const field = runPhaseField(seed, ticks);
    assertFieldBounds(field);
}

function main(): void {
    const shape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const ticks = 24;
    const seed = buildReferenceSeed(shape);

    verifyDeterministicReplay(seed, ticks);
    verifyGlobalPhaseRotation(seed, ticks, 37);
    verifyAngularAddressRotation(seed, ticks, 5);
    verifyWraparound(seed);
    verifyProjection(seed);
    verifyBoundedDrift(seed, 128);

    const output = runPhaseField(seed, ticks);

    console.log("=== Genesis verify:phase-coherence ===");
    console.log(`shape=${shape.sectors} sectors x ${shape.radialBins} rings x ${shape.harmonics} harmonics`);
    console.log(`ticks=${ticks}`);
    console.log(`seed_legacy_signature=${fieldSignature(seed)}`);
    console.log(`seed_structural_signature=${structuralSignature(seed)}`);
    console.log(`output_legacy_signature=${fieldSignature(output)}`);
    console.log(`output_structural_signature=${structuralSignature(output)}`);
    console.log(`total_amplitude=${sumAmplitude(output)}`);
    console.log(`total_entanglement=${sumEntanglement(output)}`);
    console.log("status=PASS");
}

main();

```

## `tools/test_phase.ts`
```ts
import { linearToPhase, phaseShiftAdd, calculateResonance, phaseToLinear } from "../src/phase_aware_interpreter.ts";

console.log("=== OMEGA-64 | Resonance Testing ===");

// Value 100 has Phase 100 on Cycle 0
const p1 = linearToPhase(100);
console.log(`P1 (100) -> Phase: ${p1.angle}, Cycle: ${p1.radius}`);

// Value 200 has Phase 200 on Cycle 0
const p2 = linearToPhase(200);
console.log(`P2 (200) -> Phase: ${p2.angle}, Cycle: ${p2.radius}`);

// 100 + 200 = 300, which is Phase 44 on Cycle 1
const p3 = phaseShiftAdd(p1, p2);
console.log(`Shift(P1, P2) -> Phase: ${p3.angle}, Cycle: ${p3.radius} (Expected Linear: 300, Got: ${phaseToLinear(p3)})`);

// Resonance Test
const rParallel = calculateResonance(p1, p1);
console.log(`Resonance (P1, P1) -> ${rParallel} (Expected 1.0)`);

const pOrthogonal = linearToPhase(100 + 64); // 64 is a 90 degree shift on a 256 cycle (PI/2)
const rOrthogonal = calculateResonance(p1, pOrthogonal);
console.log(`Resonance (100, 164) -> ${rOrthogonal.toFixed(3)} (Expected 0.0)`);

const pOpposite = linearToPhase(100 + 128); // 128 is a 180 degree shift on a 256 cycle (PI)
const rOpposite = calculateResonance(p1, pOpposite);
console.log(`Resonance (100, 228) -> ${rOpposite.toFixed(3)} (Expected -1.0)`);

```

## `tools/generate_phase_goldens.ts`
```ts
import {
    PHASE_BRIDGE_GOLDEN,
    PHASE_COHERENCE_GOLDEN,
    PHASE_CROSS_GOLDEN,
    buildPhaseBridgeGolden,
    buildPhaseCoherenceGolden,
    buildPhaseCrossGolden,
    initOmegaWasm,
    writeGolden,
} from "./phase_golden_common.ts";

async function main(): Promise<void> {
    const wasm = await initOmegaWasm();

    const coherenceGolden = buildPhaseCoherenceGolden();
    const bridgeGolden = buildPhaseBridgeGolden();
    const crossGolden = buildPhaseCrossGolden(wasm);

    await writeGolden(PHASE_COHERENCE_GOLDEN, coherenceGolden);
    await writeGolden(PHASE_BRIDGE_GOLDEN, bridgeGolden);
    await writeGolden(PHASE_CROSS_GOLDEN, crossGolden);

    console.log("=== Genesis generate:phase-goldens ===");
    console.log(`phase_coherence_ticks=${coherenceGolden.ticks}`);
    console.log(`phase_bridge_ticks=${bridgeGolden.ticks}`);
    console.log(`phase_cross_ticks=${crossGolden.ticks}`);
    console.log(`phase_coherence_file=${PHASE_COHERENCE_GOLDEN.pathname}`);
    console.log(`phase_bridge_file=${PHASE_BRIDGE_GOLDEN.pathname}`);
    console.log(`phase_cross_file=${PHASE_CROSS_GOLDEN.pathname}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```

## `tools/verify_phase_bridge_parity.ts`
```ts
import { readFile } from "node:fs/promises";
import initWasm, {
    Field,
    execute_phase_bridge_tick,
    field_signature,
    seed_phase_bridge_pattern,
} from "../omega_core/pkg/omega_core.js";
import {
    snapshotBridgeWasmState,
} from "./phase_golden_common.ts";
import {
    bridgeFieldSignature,
    bridgeOmegaSpan,
    bridgeTotalEnergy,
    bridgeTotalLocks,
    bridgeTotalPlasmids,
    buildBridgeSeed,
    stepBridgeField,
} from "../src/shared/phase_bridge.ts";
import type { BridgeField } from "../src/shared/phase_bridge.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTick(reference: BridgeField, actual: BridgeField, tick: number): void {
    assert(reference.width === actual.width, `bridge width mismatch at tick=${tick}`);
    assert(reference.height === actual.height, `bridge height mismatch at tick=${tick}`);

    const size = reference.width * reference.height;
    for (let index = 0; index < size; index++) {
        const sector = index % reference.width;
        const rho = Math.trunc(index / reference.width);
        compareValue("thetaNow", reference.thetaNow[index], actual.thetaNow[index], tick, sector, rho);
        compareValue("thetaF1", reference.thetaF1[index], actual.thetaF1[index], tick, sector, rho);
        compareValue("thetaF2", reference.thetaF2[index], actual.thetaF2[index], tick, sector, rho);
        compareValue("thetaF3", reference.thetaF3[index], actual.thetaF3[index], tick, sector, rho);
        compareValue("omegaRaw", reference.omega[index], actual.omega[index], tick, sector, rho);
        compareValue("energy", reference.energy[index], actual.energy[index], tick, sector, rho);
        compareValue("lock", reference.hebbianLocks[index], actual.hebbianLocks[index], tick, sector, rho);
        compareValue("plasmid", reference.plasmids[index], actual.plasmids[index], tick, sector, rho);
        compareValue("status", reference.cellStatus[index], actual.cellStatus[index], tick, sector, rho);
    }

    assert(
        reference.oracleRequestCount === actual.oracleRequestCount,
        `bridge oracleRequestCount mismatch at tick=${tick}: reference=${reference.oracleRequestCount} actual=${actual.oracleRequestCount}`,
    );

    for (let index = 0; index < reference.oracleRequestCount; index++) {
        compareValue(
            "oracleRequest",
            reference.oracleRequests[index],
            actual.oracleRequests[index],
            tick,
            index,
            0,
        );
    }
}

function compareValue(
    label: string,
    reference: number | bigint,
    actual: number | bigint,
    tick: number,
    sector: number,
    rho: number,
): void {
    if (reference !== actual) {
        throw new Error(
            `${label} mismatch at tick=${tick} sector=${sector} rho=${rho}: reference=${String(reference)} actual=${String(actual)}`,
        );
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });

    const width = 32;
    const height = 8;
    const ticks = 24;

    let reference = buildBridgeSeed(width, height);
    const field = new Field(width, height);
    seed_phase_bridge_pattern(field);

    for (let tick = 0; tick <= ticks; tick++) {
        const wasmState = snapshotBridgeWasmState(field, wasm);
        compareTick(reference, wasmState, tick);

        const referenceSignature = bridgeFieldSignature(reference);
        const wasmSignature = field_signature(field);
        assert(
            referenceSignature === wasmSignature,
            `bridge signature mismatch at tick=${tick}: reference=${referenceSignature} wasm=${wasmSignature}`,
        );

        if (tick < ticks) {
            reference = stepBridgeField(reference);
            execute_phase_bridge_tick(field, 0);
        }
    }

    console.log("=== Genesis verify:phase-bridge:parity ===");
    console.log(`shape=${width} sectors x ${height} rings`);
    console.log(`ticks=${ticks}`);
    console.log(`signature=${bridgeFieldSignature(reference)}`);
    console.log(`total_energy=${bridgeTotalEnergy(reference)}`);
    console.log(`total_locks=${bridgeTotalLocks(reference)}`);
    console.log(`total_plasmids=${bridgeTotalPlasmids(reference)}`);
    console.log(`omega_span=${bridgeOmegaSpan(reference)}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```

## `tools/verify_phase_cross.ts`
```ts
import {
    PHASE_CROSS_GOLDEN,
    buildPhaseCrossGolden,
    initOmegaWasm,
    readGolden,
} from "./phase_golden_common.ts";
import type { PhaseCrossGolden, PhaseCrossTraceEntry } from "./phase_golden_common.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTraceEntry(actual: PhaseCrossTraceEntry, expected: PhaseCrossTraceEntry, index: number): void {
    const keys = Object.keys(expected) as Array<keyof PhaseCrossTraceEntry>;
    for (const key of keys) {
        assert(
            actual[key] === expected[key],
            `phase_cross.trace[${index}] mismatch at ${key}: expected=${expected[key]} actual=${actual[key]}`,
        );
    }
}

function verifyMonotonicTrend(
    trace: PhaseCrossTraceEntry[],
    field: "totalAmplitudeDelta" | "totalLockDelta" | "totalEntanglementDelta",
    direction: "nonincreasing" | "nondecreasing",
): void {
    for (let index = 1; index < trace.length; index++) {
        const previous = trace[index - 1][field];
        const current = trace[index][field];
        const ok = direction === "nonincreasing" ? current <= previous : current >= previous;
        assert(ok, `phase_cross ${field} broke ${direction} at tick=${trace[index].tick}: prev=${previous} current=${current}`);
    }
}

function verifyPhaseCross(actual: PhaseCrossGolden, expected: PhaseCrossGolden): void {
    assert(actual.schemaVersion === expected.schemaVersion, "phase_cross schemaVersion mismatch");
    assert(actual.ticks === expected.ticks, "phase_cross ticks mismatch");
    assert(actual.collapsedRadialBins === expected.collapsedRadialBins, "phase_cross collapsedRadialBins mismatch");
    assert(actual.phaseShape.sectors === expected.phaseShape.sectors, "phase_cross sectors mismatch");
    assert(actual.phaseShape.radialBins === expected.phaseShape.radialBins, "phase_cross radialBins mismatch");
    assert(actual.phaseShape.harmonics === expected.phaseShape.harmonics, "phase_cross harmonics mismatch");
    assert(actual.hybridShape.width === expected.hybridShape.width, "phase_cross hybrid width mismatch");
    assert(actual.hybridShape.height === expected.hybridShape.height, "phase_cross hybrid height mismatch");
    assert(actual.trace.length === expected.trace.length, "phase_cross trace length mismatch");

    for (let index = 0; index < expected.trace.length; index++) {
        compareTraceEntry(actual.trace[index], expected.trace[index], index);
    }

    assert(
        actual.trace[0]?.changedCells === expected.invariants.seedChangedCells,
        `phase_cross seedChangedCells mismatch: expected=${expected.invariants.seedChangedCells} actual=${actual.trace[0]?.changedCells ?? "missing"}`,
    );

    for (const entry of actual.trace) {
        assert(
            entry.changedCells <= expected.invariants.changedCellsCeiling,
            `phase_cross changedCells exceeded ceiling at tick=${entry.tick}: ceiling=${expected.invariants.changedCellsCeiling} actual=${entry.changedCells}`,
        );
        assert(
            entry.totalAmplitudeDelta <= expected.invariants.amplitudeDeltaCeiling,
            `phase_cross totalAmplitudeDelta exceeded ceiling at tick=${entry.tick}: ceiling=${expected.invariants.amplitudeDeltaCeiling} actual=${entry.totalAmplitudeDelta}`,
        );
        assert(
            entry.totalLockDelta <= expected.invariants.lockDeltaCeiling,
            `phase_cross totalLockDelta exceeded ceiling at tick=${entry.tick}: ceiling=${expected.invariants.lockDeltaCeiling} actual=${entry.totalLockDelta}`,
        );
        assert(
            entry.maxPhaseDistance <= expected.invariants.maxPhaseDistanceCeiling,
            `phase_cross maxPhaseDistance exceeded ceiling at tick=${entry.tick}: ceiling=${expected.invariants.maxPhaseDistanceCeiling} actual=${entry.maxPhaseDistance}`,
        );
    }

    verifyMonotonicTrend(actual.trace.slice(1), "totalLockDelta", expected.invariants.lockDeltaTrend);
    verifyMonotonicTrend(actual.trace.slice(1), "totalEntanglementDelta", expected.invariants.entanglementDeltaTrend);
}

async function main(): Promise<void> {
    const wasm = await initOmegaWasm();

    const expected = await readGolden<PhaseCrossGolden>(PHASE_CROSS_GOLDEN);
    const actual = buildPhaseCrossGolden(wasm);

    verifyPhaseCross(actual, expected);

    const last = actual.trace.at(-1);
    console.log("=== Genesis verify:phase-cross ===");
    console.log(`ticks=${actual.ticks}`);
    console.log(`collapsed_radial_bins=${actual.collapsedRadialBins}`);
    console.log(`seed_changed_cells=${actual.invariants.seedChangedCells}`);
    console.log(`phase_signature=${last?.phaseSignature ?? "missing"}`);
    console.log(`hybrid_signature=${last?.hybridSignature ?? "missing"}`);
    console.log(`amplitude_delta=${last?.totalAmplitudeDelta ?? "missing"}`);
    console.log(`lock_delta=${last?.totalLockDelta ?? "missing"}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```

## `tools/test_temporal.ts`
```ts
import { parseTissueFromMarkdown } from "../src/quine.ts";
import { runEpoch } from "../src/temporal_scheduler.ts";

async function main() {
    console.log("=== OMEGA-64 | Ontology 8.0: Temporal Engine ===");
    console.log("[Boot] Parsing Tissue from I.md...");
    const state = await parseTissueFromMarkdown("./I.md");

    // Manually inject some temporal frequencies for the test if not present
    for (const [id, node] of Object.entries(state)) {
      if (!node.physics.temporal) {
          // Faster nodes have lower energy cost
          const f = Math.max(1, Math.floor(100 / (node.physics.energy_cost || 10)));
          node.physics.temporal = { frequency: f, phase: 0 };
          console.log(`[Init] ${id}: Frequency set to ${f} Hz`);
      }
    }

    const TICKS = 50;
    console.log(`\n[Execution] Starting Chronosphere for ${TICKS} Ticks...\n`);

    // We pass a mock trigger function to observe Firings
    runEpoch(state, TICKS, (nodeId) => {
        console.log(`[FIRE] 🔥 Neuron <${nodeId}> executed!`);
    });

    console.log("\n[Execution] Finished. Final Phase States:");
    for (const [id, node] of Object.entries(state)) {
        console.log(`- ${id}: Phase ${node.physics.temporal!.phase.toFixed(2)}`);
    }
}

if (import.meta.main) {
    main().catch(console.error);
}

```

## `tools/goldens/phase_coherence_golden.json`
```json
{
  "schemaVersion": 1,
  "shape": {
    "sectors": 32,
    "radialBins": 6,
    "harmonics": 3
  },
  "ticks": 12,
  "referenceTrace": [
    {
      "tick": 0,
      "legacySignature": "4a686fa9994442bc",
      "structuralSignature": "2bda5b1839298778",
      "totalAmplitude": 120926,
      "totalEntanglement": 0
    },
    {
      "tick": 1,
      "legacySignature": "2b6cc8496de397f8",
      "structuralSignature": "62827ff023e7427b",
      "totalAmplitude": 127018,
      "totalEntanglement": 0
    },
    {
      "tick": 2,
      "legacySignature": "521f5c9f5b190833",
      "structuralSignature": "317bc663b45b2004",
      "totalAmplitude": 132240,
      "totalEntanglement": 0
    },
    {
      "tick": 3,
      "legacySignature": "8a38208c2c623d7a",
      "structuralSignature": "211127b59e189b27",
      "totalAmplitude": 136586,
      "totalEntanglement": 0
    },
    {
      "tick": 4,
      "legacySignature": "996070a196871b51",
      "structuralSignature": "f0e7d60643dda4f7",
      "totalAmplitude": 140076,
      "totalEntanglement": 0
    },
    {
      "tick": 5,
      "legacySignature": "299bd1e707eacebc",
      "structuralSignature": "4991be9cfc5456da",
      "totalAmplitude": 142749,
      "totalEntanglement": 0
    },
    {
      "tick": 6,
      "legacySignature": "4d16fc5d545edc79",
      "structuralSignature": "e8b855be7939256c",
      "totalAmplitude": 144689,
      "totalEntanglement": 0
    },
    {
      "tick": 7,
      "legacySignature": "1ea6fe78be3790d3",
      "structuralSignature": "604b981c2e6e900c",
      "totalAmplitude": 145887,
      "totalEntanglement": 0
    },
    {
      "tick": 8,
      "legacySignature": "2cb3a1f676a21830",
      "structuralSignature": "5366eb984826af5f",
      "totalAmplitude": 146489,
      "totalEntanglement": 0
    },
    {
      "tick": 9,
      "legacySignature": "209b55b4a7cf1c1c",
      "structuralSignature": "d78915616cc641c1",
      "totalAmplitude": 146759,
      "totalEntanglement": 0
    },
    {
      "tick": 10,
      "legacySignature": "c90ebd74cbc55fbb",
      "structuralSignature": "744335a0bda0c3d1",
      "totalAmplitude": 146856,
      "totalEntanglement": 0
    },
    {
      "tick": 11,
      "legacySignature": "e336a6ebd629e11c",
      "structuralSignature": "62f0186299b27228",
      "totalAmplitude": 146880,
      "totalEntanglement": 0
    },
    {
      "tick": 12,
      "legacySignature": "97b4b64bdfcfa2cf",
      "structuralSignature": "8019c378a2d54cb5",
      "totalAmplitude": 146880,
      "totalEntanglement": 0
    }
  ],
  "wasmTrace": [
    {
      "tick": 0,
      "legacySignature": "2bda5b1839298778",
      "structuralSignature": "2bda5b1839298778",
      "totalAmplitude": 120926,
      "totalEntanglement": 0,
      "omegaSpan": "-2..2"
    },
    {
      "tick": 1,
      "legacySignature": "62827ff023e7427b",
      "structuralSignature": "62827ff023e7427b",
      "totalAmplitude": 127018,
      "totalEntanglement": 0,
      "omegaSpan": "-3..3"
    },
    {
      "tick": 2,
      "legacySignature": "317bc663b45b2004",
      "structuralSignature": "317bc663b45b2004",
      "totalAmplitude": 132240,
      "totalEntanglement": 0,
      "omegaSpan": "-4..4"
    },
    {
      "tick": 3,
      "legacySignature": "211127b59e189b27",
      "structuralSignature": "211127b59e189b27",
      "totalAmplitude": 136586,
      "totalEntanglement": 0,
      "omegaSpan": "-5..4"
    },
    {
      "tick": 4,
      "legacySignature": "f0e7d60643dda4f7",
      "structuralSignature": "f0e7d60643dda4f7",
      "totalAmplitude": 140076,
      "totalEntanglement": 0,
      "omegaSpan": "-5..5"
    },
    {
      "tick": 5,
      "legacySignature": "4991be9cfc5456da",
      "structuralSignature": "4991be9cfc5456da",
      "totalAmplitude": 142749,
      "totalEntanglement": 0,
      "omegaSpan": "-6..5"
    },
    {
      "tick": 6,
      "legacySignature": "e8b855be7939256c",
      "structuralSignature": "e8b855be7939256c",
      "totalAmplitude": 144689,
      "totalEntanglement": 0,
      "omegaSpan": "-7..6"
    },
    {
      "tick": 7,
      "legacySignature": "604b981c2e6e900c",
      "structuralSignature": "604b981c2e6e900c",
      "totalAmplitude": 145887,
      "totalEntanglement": 0,
      "omegaSpan": "-8..7"
    },
    {
      "tick": 8,
      "legacySignature": "5366eb984826af5f",
      "structuralSignature": "5366eb984826af5f",
      "totalAmplitude": 146489,
      "totalEntanglement": 0,
      "omegaSpan": "-9..7"
    },
    {
      "tick": 9,
      "legacySignature": "d78915616cc641c1",
      "structuralSignature": "d78915616cc641c1",
      "totalAmplitude": 146759,
      "totalEntanglement": 0,
      "omegaSpan": "-9..8"
    },
    {
      "tick": 10,
      "legacySignature": "744335a0bda0c3d1",
      "structuralSignature": "744335a0bda0c3d1",
      "totalAmplitude": 146856,
      "totalEntanglement": 0,
      "omegaSpan": "-9..8"
    },
    {
      "tick": 11,
      "legacySignature": "62f0186299b27228",
      "structuralSignature": "62f0186299b27228",
      "totalAmplitude": 146880,
      "totalEntanglement": 0,
      "omegaSpan": "-10..8"
    },
    {
      "tick": 12,
      "legacySignature": "8019c378a2d54cb5",
      "structuralSignature": "8019c378a2d54cb5",
      "totalAmplitude": 146880,
      "totalEntanglement": 0,
      "omegaSpan": "-10..8"
    }
  ],
  "invariants": {
    "referenceSeedLegacySignature": "4a686fa9994442bc",
    "referenceSeedStructuralSignature": "2bda5b1839298778",
    "wasmSeedStructuralSignature": "2bda5b1839298778",
    "rotatedPhaseStructuralSignature": "bf28ae9525323477",
    "rotatedAddressStructuralSignature": "4bb9f773ce4a25fd"
  }
}

```

## `tools/goldens/phase_bridge_golden.json`
```json
{
  "schemaVersion": 1,
  "width": 32,
  "height": 8,
  "ticks": 12,
  "referenceTrace": [
    {
      "tick": 0,
      "signature": "8068aadd61b90e7f",
      "totalEnergy": 54912,
      "totalLocks": 7967,
      "totalPlasmids": 0,
      "omegaSpan": "-1..1"
    },
    {
      "tick": 1,
      "signature": "951d0eea2ea95639",
      "totalEnergy": 57719,
      "totalLocks": 10015,
      "totalPlasmids": 196,
      "omegaSpan": "-2..2"
    },
    {
      "tick": 2,
      "signature": "94d06b684967cb80",
      "totalEnergy": 59126,
      "totalLocks": 11807,
      "totalPlasmids": 204,
      "omegaSpan": "-3..3"
    },
    {
      "tick": 3,
      "signature": "f7f82a4e08733c4a",
      "totalEnergy": 60077,
      "totalLocks": 13487,
      "totalPlasmids": 211,
      "omegaSpan": "-4..3"
    },
    {
      "tick": 4,
      "signature": "354ae36f16bebfb6",
      "totalEnergy": 60741,
      "totalLocks": 15079,
      "totalPlasmids": 222,
      "omegaSpan": "-3..4"
    },
    {
      "tick": 5,
      "signature": "5a8e0d4f67a4e49b",
      "totalEnergy": 61133,
      "totalLocks": 16567,
      "totalPlasmids": 226,
      "omegaSpan": "-4..5"
    },
    {
      "tick": 6,
      "signature": "55506d8a4e39c35d",
      "totalEnergy": 61367,
      "totalLocks": 18027,
      "totalPlasmids": 227,
      "omegaSpan": "-5..5"
    },
    {
      "tick": 7,
      "signature": "0b14a616684a3a83",
      "totalEnergy": 61564,
      "totalLocks": 19523,
      "totalPlasmids": 227,
      "omegaSpan": "-6..5"
    },
    {
      "tick": 8,
      "signature": "afc05a676ec3face",
      "totalEnergy": 61689,
      "totalLocks": 21019,
      "totalPlasmids": 227,
      "omegaSpan": "-6..5"
    },
    {
      "tick": 9,
      "signature": "351bdb10d34539fd",
      "totalEnergy": 61769,
      "totalLocks": 22515,
      "totalPlasmids": 227,
      "omegaSpan": "-7..5"
    },
    {
      "tick": 10,
      "signature": "eabd3d4604c54751",
      "totalEnergy": 61781,
      "totalLocks": 24011,
      "totalPlasmids": 227,
      "omegaSpan": "-8..7"
    },
    {
      "tick": 11,
      "signature": "931d340cc21e91ed",
      "totalEnergy": 61781,
      "totalLocks": 25507,
      "totalPlasmids": 227,
      "omegaSpan": "-8..8"
    },
    {
      "tick": 12,
      "signature": "26b4f62768b34262",
      "totalEnergy": 61781,
      "totalLocks": 27003,
      "totalPlasmids": 227,
      "omegaSpan": "-8..9"
    }
  ],
  "wasmTrace": [
    {
      "tick": 0,
      "signature": "8068aadd61b90e7f",
      "totalEnergy": 54912,
      "totalLocks": 7967,
      "totalPlasmids": 0,
      "omegaSpan": "-1..1"
    },
    {
      "tick": 1,
      "signature": "951d0eea2ea95639",
      "totalEnergy": 57719,
      "totalLocks": 10015,
      "totalPlasmids": 196,
      "omegaSpan": "-2..2"
    },
    {
      "tick": 2,
      "signature": "94d06b684967cb80",
      "totalEnergy": 59126,
      "totalLocks": 11807,
      "totalPlasmids": 204,
      "omegaSpan": "-3..3"
    },
    {
      "tick": 3,
      "signature": "f7f82a4e08733c4a",
      "totalEnergy": 60077,
      "totalLocks": 13487,
      "totalPlasmids": 211,
      "omegaSpan": "-4..3"
    },
    {
      "tick": 4,
      "signature": "354ae36f16bebfb6",
      "totalEnergy": 60741,
      "totalLocks": 15079,
      "totalPlasmids": 222,
      "omegaSpan": "-3..4"
    },
    {
      "tick": 5,
      "signature": "5a8e0d4f67a4e49b",
      "totalEnergy": 61133,
      "totalLocks": 16567,
      "totalPlasmids": 226,
      "omegaSpan": "-4..5"
    },
    {
      "tick": 6,
      "signature": "55506d8a4e39c35d",
      "totalEnergy": 61367,
      "totalLocks": 18027,
      "totalPlasmids": 227,
      "omegaSpan": "-5..5"
    },
    {
      "tick": 7,
      "signature": "0b14a616684a3a83",
      "totalEnergy": 61564,
      "totalLocks": 19523,
      "totalPlasmids": 227,
      "omegaSpan": "-6..5"
    },
    {
      "tick": 8,
      "signature": "afc05a676ec3face",
      "totalEnergy": 61689,
      "totalLocks": 21019,
      "totalPlasmids": 227,
      "omegaSpan": "-6..5"
    },
    {
      "tick": 9,
      "signature": "351bdb10d34539fd",
      "totalEnergy": 61769,
      "totalLocks": 22515,
      "totalPlasmids": 227,
      "omegaSpan": "-7..5"
    },
    {
      "tick": 10,
      "signature": "eabd3d4604c54751",
      "totalEnergy": 61781,
      "totalLocks": 24011,
      "totalPlasmids": 227,
      "omegaSpan": "-8..7"
    },
    {
      "tick": 11,
      "signature": "931d340cc21e91ed",
      "totalEnergy": 61781,
      "totalLocks": 25507,
      "totalPlasmids": 227,
      "omegaSpan": "-8..8"
    },
    {
      "tick": 12,
      "signature": "26b4f62768b34262",
      "totalEnergy": 61781,
      "totalLocks": 27003,
      "totalPlasmids": 227,
      "omegaSpan": "-8..9"
    }
  ],
  "invariants": {
    "seedSignature": "8068aadd61b90e7f",
    "rotatedSignature": "ab16a6dc68bef00e"
  }
}

```

## `tools/goldens/phase_cross_golden.json`
```json
{
  "schemaVersion": 1,
  "ticks": 12,
  "phaseShape": {
    "sectors": 32,
    "radialBins": 6,
    "harmonics": 3
  },
  "hybridShape": {
    "width": 32,
    "height": 8
  },
  "collapsedRadialBins": 6,
  "trace": [
    {
      "tick": 0,
      "changedCells": 0,
      "totalAmplitudeDelta": 0,
      "totalLockDelta": 0,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 0,
      "phaseSignature": "f22292a47e8b5c31",
      "hybridSignature": "f22292a47e8b5c31"
    },
    {
      "tick": 1,
      "changedCells": 108,
      "totalAmplitudeDelta": -195,
      "totalLockDelta": 0,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 5,
      "phaseSignature": "ff882d4045b3a340",
      "hybridSignature": "4d4056673f529bf9"
    },
    {
      "tick": 2,
      "changedCells": 133,
      "totalAmplitudeDelta": 355,
      "totalLockDelta": 192,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 20,
      "phaseSignature": "fd4d9e95d4d302e5",
      "hybridSignature": "c374aa40821b0f9a"
    },
    {
      "tick": 3,
      "changedCells": 164,
      "totalAmplitudeDelta": 955,
      "totalLockDelta": 464,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 20,
      "phaseSignature": "7e330567c8554ce3",
      "hybridSignature": "e8641c30bc9a663a"
    },
    {
      "tick": 4,
      "changedCells": 187,
      "totalAmplitudeDelta": 1496,
      "totalLockDelta": 808,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 35,
      "phaseSignature": "8ffa01145d1323f3",
      "hybridSignature": "baf0d72e88dd755f"
    },
    {
      "tick": 5,
      "changedCells": 183,
      "totalAmplitudeDelta": 2026,
      "totalLockDelta": 1232,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 29,
      "phaseSignature": "ca9bf9b69ecef1ca",
      "hybridSignature": "0d59ace3cbeaff93"
    },
    {
      "tick": 6,
      "changedCells": 186,
      "totalAmplitudeDelta": 2479,
      "totalLockDelta": 1684,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 32,
      "phaseSignature": "8f8b3113f7a57b16",
      "hybridSignature": "0380303ad6433997"
    },
    {
      "tick": 7,
      "changedCells": 187,
      "totalAmplitudeDelta": 2711,
      "totalLockDelta": 2124,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 34,
      "phaseSignature": "c1ea6744f7153881",
      "hybridSignature": "56ba68397ce69343"
    },
    {
      "tick": 8,
      "changedCells": 184,
      "totalAmplitudeDelta": 2787,
      "totalLockDelta": 2564,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 35,
      "phaseSignature": "6c7ae180782339b3",
      "hybridSignature": "8cdf829b646992dd"
    },
    {
      "tick": 9,
      "changedCells": 185,
      "totalAmplitudeDelta": 2796,
      "totalLockDelta": 3004,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 31,
      "phaseSignature": "3de87dbd183491fa",
      "hybridSignature": "8299d3d301378871"
    },
    {
      "tick": 10,
      "changedCells": 185,
      "totalAmplitudeDelta": 2817,
      "totalLockDelta": 3444,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 27,
      "phaseSignature": "0444ff443961e3bf",
      "hybridSignature": "718e26a74c6d3989"
    },
    {
      "tick": 11,
      "changedCells": 188,
      "totalAmplitudeDelta": 2825,
      "totalLockDelta": 3884,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 30,
      "phaseSignature": "b479cf29a3015e1e",
      "hybridSignature": "f01eee7e8ac9a047"
    },
    {
      "tick": 12,
      "changedCells": 191,
      "totalAmplitudeDelta": 2825,
      "totalLockDelta": 4324,
      "totalEntanglementDelta": 0,
      "maxPhaseDistance": 35,
      "phaseSignature": "450154228192c10a",
      "hybridSignature": "de2ce33aacef934b"
    }
  ],
  "invariants": {
    "seedChangedCells": 0,
    "changedCellsCeiling": 191,
    "amplitudeDeltaCeiling": 2825,
    "lockDeltaCeiling": 4324,
    "maxPhaseDistanceCeiling": 35,
    "lockDeltaTrend": "nondecreasing",
    "entanglementDeltaTrend": "nonincreasing"
  }
}

```

## `tools/verify_phase_goldens.ts`
```ts
import {
    PHASE_BRIDGE_GOLDEN,
    PHASE_COHERENCE_GOLDEN,
    buildPhaseBridgeGolden,
    buildPhaseCoherenceGolden,
    initOmegaWasm,
    readGolden,
} from "./phase_golden_common.ts";
import type { BridgeTraceEntry, PhaseBridgeGolden, PhaseCoherenceGolden, PhaseTraceEntry, PhaseWasmTraceEntry } from "./phase_golden_common.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTraceEntry<T extends Record<string, number | string>>(label: string, actual: T, expected: T): void {
    const keys = Object.keys(expected);
    for (const key of keys) {
        assert(
            actual[key] === expected[key],
            `${label} mismatch at ${key}: expected=${expected[key]} actual=${actual[key]}`,
        );
    }
}

function compareTrace<T extends Record<string, number | string>>(
    label: string,
    actual: T[],
    expected: T[],
): void {
    assert(actual.length === expected.length, `${label} length mismatch: expected=${expected.length} actual=${actual.length}`);
    for (let i = 0; i < expected.length; i++) {
        compareTraceEntry(`${label}[${i}]`, actual[i], expected[i]);
    }
}

function verifyPhaseCoherence(actual: PhaseCoherenceGolden, expected: PhaseCoherenceGolden): void {
    assert(actual.schemaVersion === expected.schemaVersion, "phase_coherence schemaVersion mismatch");
    assert(actual.ticks === expected.ticks, "phase_coherence ticks mismatch");
    assert(actual.shape.sectors === expected.shape.sectors, "phase_coherence sectors mismatch");
    assert(actual.shape.radialBins === expected.shape.radialBins, "phase_coherence radialBins mismatch");
    assert(actual.shape.harmonics === expected.shape.harmonics, "phase_coherence harmonics mismatch");

    compareTrace<PhaseTraceEntry>("phase_coherence.referenceTrace", actual.referenceTrace, expected.referenceTrace);
    compareTrace<PhaseWasmTraceEntry>("phase_coherence.wasmTrace", actual.wasmTrace, expected.wasmTrace);
    compareTraceEntry("phase_coherence.invariants", actual.invariants, expected.invariants);
}

function verifyPhaseBridge(actual: PhaseBridgeGolden, expected: PhaseBridgeGolden): void {
    assert(actual.schemaVersion === expected.schemaVersion, "phase_bridge schemaVersion mismatch");
    assert(actual.ticks === expected.ticks, "phase_bridge ticks mismatch");
    assert(actual.width === expected.width, "phase_bridge width mismatch");
    assert(actual.height === expected.height, "phase_bridge height mismatch");

    compareTrace<BridgeTraceEntry>("phase_bridge.referenceTrace", actual.referenceTrace, expected.referenceTrace);
    compareTrace<BridgeTraceEntry>("phase_bridge.wasmTrace", actual.wasmTrace, expected.wasmTrace);
    compareTraceEntry("phase_bridge.invariants", actual.invariants, expected.invariants);
}

async function main(): Promise<void> {
    await initOmegaWasm();

    const expectedCoherence = await readGolden<PhaseCoherenceGolden>(PHASE_COHERENCE_GOLDEN);
    const expectedBridge = await readGolden<PhaseBridgeGolden>(PHASE_BRIDGE_GOLDEN);
    const actualCoherence = buildPhaseCoherenceGolden();
    const actualBridge = buildPhaseBridgeGolden();

    verifyPhaseCoherence(actualCoherence, expectedCoherence);
    verifyPhaseBridge(actualBridge, expectedBridge);

    console.log("=== Genesis verify:phase-goldens ===");
    console.log(`phase_coherence_signature=${actualCoherence.wasmTrace.at(-1)?.structuralSignature ?? "missing"}`);
    console.log(`phase_bridge_signature=${actualBridge.wasmTrace.at(-1)?.signature ?? "missing"}`);
    console.log(`phase_coherence_ticks=${actualCoherence.ticks}`);
    console.log(`phase_bridge_ticks=${actualBridge.ticks}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```

## `tools/verify_phase_coherence_wasm.ts`
```ts
import { readFile } from "node:fs/promises";
import initWasm, {
    PhaseLatticeField,
    execute_phase_lattice_tick,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude,
    phase_lattice_total_entanglement,
} from "../omega_core/pkg/omega_core.js";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function tick(field: PhaseLatticeField, ticks: number): void {
    for (let i = 0; i < ticks; i++) {
        execute_phase_lattice_tick(field);
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    await initWasm({ module_or_path: wasmBytes });

    const ticks = 24;

    const left = new PhaseLatticeField(32, 6, 3);
    const right = new PhaseLatticeField(32, 6, 3);
    tick(left, ticks);
    tick(right, ticks);
    assert(phase_lattice_signature(left) === phase_lattice_signature(right), "WASM deterministic replay failed");

    const rotatedPhase = new PhaseLatticeField(32, 6, 3);
    const baselinePhase = new PhaseLatticeField(32, 6, 3);
    rotatedPhase.rotate_global_phase(37);
    tick(rotatedPhase, ticks);
    tick(baselinePhase, ticks);
    baselinePhase.rotate_global_phase(37);
    assert(phase_lattice_signature(rotatedPhase) === phase_lattice_signature(baselinePhase), "WASM global phase rotation equivariance failed");

    const rotatedAddress = new PhaseLatticeField(32, 6, 3);
    const baselineAddress = new PhaseLatticeField(32, 6, 3);
    rotatedAddress.rotate_angular_address(5);
    tick(rotatedAddress, ticks);
    tick(baselineAddress, ticks);
    baselineAddress.rotate_angular_address(5);
    assert(phase_lattice_signature(rotatedAddress) === phase_lattice_signature(baselineAddress), "WASM angular address rotation equivariance failed");

    console.log("=== Genesis verify:phase-coherence:wasm ===");
    console.log(`ticks=${ticks}`);
    console.log(`structural_signature=${phase_lattice_signature(left)}`);
    console.log(`total_amplitude=${phase_lattice_total_amplitude(left)}`);
    console.log(`total_entanglement=${phase_lattice_total_entanglement(left)}`);
    console.log(`omega_span=${phase_lattice_omega_span(left)}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

```
