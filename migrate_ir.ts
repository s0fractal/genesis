import { Tissue, State } from "./src/quine.ts";

function migrateTissue() {
  const newState: State = {};

  for (const [key, node] of Object.entries(Tissue)) {
    const newNode = structuredClone(node) as any;
    
    // Default fallback IRFunction structure
    let newExpr: any = {
      args: [],
      ret: "void",
      body: node.expr
    };

    if (key === "fast_abs") {
      newExpr = {
        args: [{ name: "v", type: "i32" }],
        ret: "i32",
        body: {
          kind: "op",
          op: "mul",
          args: [
            { kind: "var", name: "v", type: "i32" },
            { kind: "const", value: 16, bits: 32 }
          ]
        }
      };
    } else if (key === "calculate_structural_hash") {
      newExpr = {
        args: [{ name: "node", type: "Sigma3Node" }],
        ret: "string",
        body: node.expr
      };
    } else if (key === "mutate_expression") {
      newExpr = {
        args: [
          { name: "state", type: "State" },
          { name: "targetAlias", type: "string" },
          { name: "path", type: "(string|number)[]" },
          { name: "newValue", type: "any" },
          { name: "executeNeuron", type: "Function" }
        ],
        ret: "TransformResult<State>",
        body: "state' = apply_ir_mutation(...)"
      };
      
      newNode.io.in = {
        "state": "State",
        "targetAlias": "string",
        "path": "(string|number)[]",
        "newValue": "any",
        "executeNeuron": "Function"
      };

      newNode.implementation.ts = `
        const next = structuredClone(state);
        const diff = { added: [], updated: [], removed: [] };

        const targetNode = next[targetAlias];
        if (!targetNode) {
          throw new Error(\`Neuron \${targetAlias} not found in state.\`);
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
        
        targetNode.mutation_log.push(\`Mutated IR at [\${path.join(".")}] to: \${JSON.stringify(newValue)} -> [\${newHash}]\`);
        diff.updated.push(targetAlias);

        return { next, diff };
      `;
    } else if (key === "flush_state_to_disk") {
      newExpr = {
        args: [
          { name: "nextState", type: "State" },
          { name: "importMetaUrl", type: "string" }
        ],
        ret: "void",
        body: node.expr
      };
    } else if (key === "tissue_history") {
      newExpr = {
        args: [],
        ret: "[]",
        body: node.expr // keep stringified history as body for now
      };
    } else if (key === "atomic_pulse") {
      newExpr = {
        args: [
          { name: "state", type: "State" },
          { name: "operations", type: "Array<{alias: string, args: Record<string, any>}>" },
          { name: "executeNeuron", type: "Function" }
        ],
        ret: "{ success: boolean, next: State, log: any[], error?: string }",
        body: node.expr
      };
      
      // Update atomic pulse validate_state logic
      newNode.implementation.ts = newNode.implementation.ts.replace(
        /if \(typeof node\.expr !== "string"\) throw new Error\(\`Node \$\{key\} missing expr source of truth\`\);/g,
        'if (typeof node.expr !== "object" || !node.expr.body) throw new Error(`Node ${key} missing IRFunction expr source of truth`);'
      );
    }
    
    newNode.expr = newExpr;
    
    // Swap mutate_expression key to mutate_ir
    if (key === "mutate_expression") {
      newState["mutate_ir"] = newNode;
    } else {
      newState[key] = newNode;
    }
  }

  // Update history to match mutate_ir
  if (newState["tissue_history"]) {
      newState["tissue_history"].expr.body = newState["tissue_history"].expr.body.replace(/mutate_expression/g, "mutate_ir");
  }

  return newState;
}

const newState = migrateTissue();

const filePath = "./src/quine.ts";
let fileContent = await Deno.readTextFile(filePath);

const startMarker = "// --- THE TISSUE (ACTIVE STATE) ---";
const endMarker = "// --- END OF TISSUE ---";

const startIndex = fileContent.indexOf(startMarker);
const endIndex = fileContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  Deno.exit(1);
}

const stateString = JSON.stringify(newState, null, 2);
const newTissueBlock = `${startMarker}\n\nexport const Tissue: State = ${stateString};\n\n`;

const newFileContent = fileContent.slice(0, startIndex) + newTissueBlock + fileContent.slice(endIndex);

await Deno.writeTextFile(filePath, newFileContent);
console.log("Migration successful");
