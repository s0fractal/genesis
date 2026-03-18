import { parseTissueFromMarkdown } from "./src/quine.ts";
const t = await parseTissueFromMarkdown("./I.md");
console.log("Atomic Pulse Expr:", t.atomic_pulse.expr);
console.log("Fast Abs Expr:", t.fast_abs.expr);
