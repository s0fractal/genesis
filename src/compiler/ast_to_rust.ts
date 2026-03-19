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
