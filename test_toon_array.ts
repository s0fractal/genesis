import { encode } from "npm:@toon-format/toon";
import { Tissue } from "./src/quine.ts";

const tissueArray = Object.entries(Tissue).map(([id, node]) => ({
  id,
  type: node.essence.type,
  substrate: node.essence.substrate,
  energy: node.physics.energy_cost,
  stability: node.physics.stability,
  structural_hash: node.identity.structural_hash,
  version: node.identity.version
}));

console.log("=== TOON TISSUE ARRAY TABLE ===");
console.log(encode(tissueArray));
