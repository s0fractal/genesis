import { parseTissueFromMarkdown } from "./src/quine.ts";
const content = await Deno.readTextFile("./I.md");
const lines = content.split("\n");
lines.forEach((l, i) => {
   if (l.includes("atomic_pulse") || l.includes("fast_abs")) {
      console.log(`${i}: ${l}`);
   }
});
