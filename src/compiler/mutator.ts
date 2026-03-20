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
    
    // O-53 Phase 1: Seeded Genetic Memory (Hash as Opcode)
    let seed = 1337;
    if (node.identity && node.identity.structural_hash) {
        let hashNum = 0;
        const hashStr = String(node.identity.structural_hash);
        for (let i = 0; i < hashStr.length; i++) {
            hashNum = (Math.imul(31, hashNum) + hashStr.charCodeAt(i)) | 0;
        }
        seed = Math.abs(hashNum) || 1337;
    }
    
    // Deterministic LCG
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    
    // Select one deterministic numerical property deeply nested in the AST
    const candidate = mutablePaths[Math.floor(random() * mutablePaths.length)];
    
    // Inject biological drift
    const deltas = [-4, -2, -1, 1, 2, 4];
    const delta = deltas[Math.floor(random() * deltas.length)];
    
    let newValue = candidate.val + delta;
    
    // Clamp to prevent total mathematical blowout during early evolution
    if (newValue > 1024) newValue = 1024;
    if (newValue < -1024) newValue = -1024;
    // Attempt not to zero it entirely unless symmetric
    if (newValue === 0 && random() > 0.1) newValue = 1;

    return {
        alias,
        path: candidate.path,
        newValue
    };
}
