import { IRNode, IRFunction } from "../quine.ts";

export function compileNodeToWGSL(node: IRNode): string {
    switch (node.kind) {
        case "const":
            // WGSL wants explicit 'i32' matching for integers when parsing binary trees dynamically
            return `${node.value}i`;
        case "var":
            return node.name;
        case "op": {
            const left = compileNodeToWGSL(node.args[0]);
            const right = compileNodeToWGSL(node.args[1]);
            let sym = "";
            switch (node.op) {
                case "add": sym = "+"; break;
                case "sub": sym = "-"; break;
                case "mul": sym = "*"; break;
                case "div": sym = "/"; break;
                case "and": sym = "&"; break;
                case "or":  sym = "|"; break;
                case "xor": sym = "^"; break;
                // WGSL shifts require the right-hand operand to be a u32
                case "shl": return `(${left} << u32(${right}))`;
                case "shr": return `(${left} >> u32(${right}))`;
            }
            return `(${left} ${sym} ${right})`;
        }
        case "call": {
            const args = node.args.map(compileNodeToWGSL).join(', ');
            return `${node.target}(${args})`;
        }
        case "if": {
            const condStr = compileNodeToWGSL(node.cond);
            const tBranch = compileNodeToWGSL(node.then);
            const eBranch = compileNodeToWGSL(node.else);
            // WGSL does not have ternary operators or returning if-blocks mapped easily as expressions
            // To maintain compatibility with JS/Rust ASTs, we use select() mapping in WGSL
            return `select(${eBranch}, ${tBranch}, ${condStr} != 0i)`;
        }
        case "block": {
            const stmts = node.statements.map(s => compileNodeToWGSL(s) + ";").join("\n    ");
            const res = compileNodeToWGSL(node.result);
            return `{\n    ${stmts}\n    return ${res};\n}`;
        }
    }
}

function mapTSTypeToWGSL(tsType: string): string {
    if (tsType === "i32" || tsType === "number") return "i32";
    if (tsType === "u32") return "u32";
    if (tsType === "f32") return "f32";
    return "i32";
}

export function compileIRFunctionToWGSL(name: string, fn: IRFunction): string {
    const argsStr = fn.args.map(a => `${a.name}: ${mapTSTypeToWGSL(a.type)}`).join(', ');
    const retType = mapTSTypeToWGSL(fn.ret);
    
    // If the body is a direct block `{\n...}` we just embed it, else we wrap it
    let bodyStr = typeof fn.body === "string" ? fn.body : compileNodeToWGSL(fn.body);
    
    if (bodyStr.startsWith("{") && bodyStr.endsWith("}")) {
        // Nothing needed, block transpilation already handles internal returns if needed
    } else {
        bodyStr = `{\n    return ${bodyStr};\n}`;
    }
    
    return `
fn ${name}(${argsStr}) -> ${retType} ${bodyStr}
`;
}
