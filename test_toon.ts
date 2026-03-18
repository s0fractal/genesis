import { encode, decode } from "npm:@toon-format/toon";

const ir = {
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

const encoded = encode(ir);
console.log("=== TOON ENCODED AST ===");
console.log(encoded);

const decoded = decode(encoded);
console.log("\n=== DECODED AST PARITY ===");
console.log(JSON.stringify(decoded) === JSON.stringify(ir) ? "SUCCESS" : "FAIL");
