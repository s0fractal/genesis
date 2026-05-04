import { computeProposalHash } from "./src/network/warrant_issuance.ts";
import { ACTION_TERMINATE } from "./src/network/codeicide_law.ts";

const h = computeProposalHash(0xCAFE_BABE >>> 0, ACTION_TERMINATE, "reason");
console.log(`computeProposalHash(...) = 0x${(h >>> 0).toString(16).toUpperCase().padStart(8, '0')}`);
