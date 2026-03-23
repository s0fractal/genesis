export type Term =
    | { type: "Combinator"; name: "S" | "K" | "I" | "Y" }
    | { type: "Variable"; name: string }
    | { type: "Application"; left: Term; right: Term };

export const S: Term = { type: "Combinator", name: "S" };
export const K: Term = { type: "Combinator", name: "K" };
export const I: Term = { type: "Combinator", name: "I" };
export const Y: Term = { type: "Combinator", name: "Y" };

export function apply(left: Term, right: Term): Term {
    return { type: "Application", left, right };
}

export interface SomaticNode {
    ast: Term;
    l1_cost: number;
    depth: number;
    nodes: number;
    attention: number;
    age: number;
    energy: number;
    fitness: number;
    mutualists: Set<bigint>; // O-140 Vector I.1: The Mycelial Graph (Σ² Topology)
}

/**
 * Universal mappings preserving the bidirectional bridge between 
 * mathematical 64-bit grid bounds in WASM and pure SKI syntactical strings.
 * Upgraded to a biological Somatic Engine tracking L1 Complexity and Age Decay.
 */
export const PlasmidRegistry = new Map<bigint, SomaticNode>();

/**
 * Traverses a Compiled AST Node, measuring its Topological constraints.
 * Structural bulk is penalized by L1 Complexity Regulators.
 */
export function measureIR(term: Term): { cost: number; depth: number; nodes: number } {
    if (term.type === "Combinator" || term.type === "Variable") {
        return { cost: 1, depth: 1, nodes: 1 };
    }
    
    const leftMetrics = measureIR(term.left);
    const rightMetrics = measureIR(term.right);
    const nodes = 1 + leftMetrics.nodes + rightMetrics.nodes;
    const depth = 1 + Math.max(leftMetrics.depth, rightMetrics.depth);
    
    // Core L1 Formulation: Bulk Depth * 2 + Node Volume
    const cost = nodes + (depth * 2);
    return { cost, depth, nodes };
}

/**
 * O-146 Vector O.1: Epigenetic Phenotype Measurement
 * Scans the structural geometry of the Plasmid to deterministically assign its 
 * visual Hue mapping. Chaos (S) is Red, Pruning (K) is Green, Identity (I) is Blue.
 */
export function phenotypeHue(term: Term): number {
    let sCount = 0;
    let kCount = 0;
    let iCount = 0;
    
    function walk(t: Term) {
        if (t.type === "Combinator") {
            if (t.name === "S") sCount++;
            else if (t.name === "K") kCount++;
            else if (t.name === "I" || t.name === "Y") iCount++;
        } else if (t.type === "Application") {
            walk(t.left);
            walk(t.right);
        }
    }
    
    walk(term);
    
    const total = sCount + kCount + iCount;
    if (total === 0) return 42; // Variables default to slightly yellow (60 degrees approx)
    
    // Calculate color vectors: S=0 deg(Red), K=120 deg(Green), I/Y=240 deg(Blue)
    const sRatio = sCount / total;
    const kRatio = kCount / total;
    const iRatio = iCount / total;
    
    const x = sRatio * Math.cos(0) + kRatio * Math.cos(2 * Math.PI / 3) + iRatio * Math.cos(4 * Math.PI / 3);
    const y = sRatio * Math.sin(0) + kRatio * Math.sin(2 * Math.PI / 3) + iRatio * Math.sin(4 * Math.PI / 3);
    
    let hue = Math.atan2(y, x) * (180 / Math.PI);
    if (hue < 0) hue += 360;
    
    return Math.floor((hue / 360) * 255);
}

/**
 * O-146 Vector I.1: The Epigenetic Compiler (Ontology 76)
 * Deterministically packs the logical morphology of the abstract syntax tree into a 64-bit Genotype.
 */
export function compileMorphology(term: Term): bigint {
    let sCount = 0;
    let kCount = 0;
    let iCount = 0;
    
    function walk(t: Term) {
        if (t.type === "Combinator") {
            if (t.name === "S") sCount++;
            else if (t.name === "K") kCount++;
            else if (t.name === "I" || t.name === "Y") iCount++;
        } else if (t.type === "Application") {
            walk(t.left);
            walk(t.right);
        }
    }
    walk(term);

    const hue = BigInt(phenotypeHue(term));
    
    // Phase (Theta) - Mapped to I/Y count (Temporal Delay logic shifts continuous phase)
    const phaseShift = BigInt(Math.min(255, iCount * 32));
    
    // Entanglement - Mapped to S count (Structural Splitting induces massive web bounds)
    const entanglement = BigInt(Math.min(255, sCount * 18));
    
    // Amplitude (Energy) - Mapped to total AST sheer gravity
    const metrics = measureIR(term);
    const amplitude = BigInt(Math.min(255, 40 + metrics.nodes * 12));
    
    // Lock (Rigidity) - Mapped to K count (Pruning logic permanently scars topology)
    const lock = BigInt(Math.min(255, kCount * 24));

    // Pack into u64 Schema
    // Byte 0: Hue | Byte 1: Phase | Byte 2: Entanglement | Byte 3: Amplitude | Byte 4: Lock
    let hash = 0n;
    hash |= hue;
    hash |= (phaseShift << 8n);
    hash |= (entanglement << 16n);
    hash |= (amplitude << 24n);
    hash |= (lock << 32n);
    
    // Add deterministic variance based on semantic depth to prevent identical collisions
    const variance = BigInt(metrics.depth * 31337) & 0xFFFFn;
    hash |= (variance << 48n);

    return hash;
}

export function variable(name: string): Term {
    return { type: "Variable", name };
}

/**
 * Performs a single step of reduction on the SKI combinator expression.
 * Returns the reduced term, or null if no reduction is possible.
 */
export function reduceStep(term: Term): Term | null {
    if (term.type !== "Application") {
        return null;
    }

    // I x => x
    if (term.left.type === "Combinator" && term.left.name === "I") {
        return term.right;
    }

    // K x y => x
    if (
        term.left.type === "Application" &&
        term.left.left.type === "Combinator" &&
        term.left.left.name === "K"
    ) {
        return term.left.right; // x
    }

    // S x y z => (x z) (y z)
    if (
        term.left.type === "Application" &&
        term.left.left.type === "Application" &&
        term.left.left.left.type === "Combinator" &&
        term.left.left.left.name === "S"
    ) {
        const x = term.left.left.right;
        const y = term.left.right;
        const z = term.right;
        return apply(apply(x, z), apply(y, z));
    }

    // Y x => x (Y x)
    if (term.left.type === "Combinator" && term.left.name === "Y") {
        const x = term.right;
        return apply(x, apply(Y, x));
    }

    // Attempt to reduce the left side of the application first (applicative order / strict)
    const reducedLeft = reduceStep(term.left);
    if (reducedLeft !== null) {
        return apply(reducedLeft, term.right);
    }

    // Attempt to reduce the right side if left is in normal form
    const reducedRight = reduceStep(term.right);
    if (reducedRight !== null) {
        return apply(term.left, reducedRight);
    }

    return null;
}

/**
 * Fully evaluates the SKI term natively up to a maximum number of steps
 * to prevent infinite loops (e.g. diverging `Omega` combinators).
 */
export function evaluateLambda(term: Term, maxSteps = 1024): Term {
    return evaluateFitness(term, maxSteps).result;
}

/**
 * Validates computational efficiency. Returns a timeout flag if the combinator 
 * falls into an infinite morphological loop.
 */
export function evaluateFitness(term: Term, maxSteps = 128): { result: Term; steps: number; timeout: boolean } {
    let current = term;
    let steps = 0;
    while (steps < maxSteps) {
        const next = reduceStep(current);
        if (next === null) {
            return { result: current, steps, timeout: false };
        }
        current = next;
        steps++;
    }
    return { result: current, steps, timeout: true };
}

/**
 * Serializes the term back into a string representation.
 */
export function formatTerm(term: Term): string {
    switch (term.type) {
        case "Combinator":
            return term.name;
        case "Variable":
            return term.name;
        case "Application": {
            const leftStr = formatTerm(term.left);
            const rightStr = formatTerm(term.right);
            // Add parentheses if left side is an application and right side is simple
            const leftTokens = term.left.type === "Application" ? `(${leftStr})` : leftStr;
            const rightTokens = term.right.type === "Application" ? `(${rightStr})` : rightStr;
            return `${leftTokens} ${rightTokens}`;
        }
    }
}

// O-145 Vector N.1: Church-Encoded Semantic Dictionary
// Elevates the abstraction level for LLM Senate Generation without altering WASM logic bounds.
const MACROS: Record<string, string> = {
    "TRUE": "K",
    "FALSE": "(K I)",
    "NOT": "(S (S I (K (K I))) (K K))",
    "AND": "(S S (K (K I)))",
    "OR": "(S I (K K))",
    "CONS": "(S (S I (K (S (K K) I))) (K I))", // Pair Constructor
    "CAR": "(S I (K K))", // First Element (TRUE selector)
    "CDR": "(S I (K (K I)))" // Second Element (FALSE selector)
};

/**
 * Parses a string representation of an SKI term natively.
 * Supports combinators (S, K, I, Y), variables, application nesting, and Semantic Macros.
 */
export function parseLambda(input: string): Term {
    const tokens = input
        .replace(/\(/g, " ( ")
        .replace(/\)/g, " ) ")
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);

    function parseTokens(): Term {
        if (tokens.length === 0) {
            throw new Error("Lambda Parse Error: Unexpected end of expression.");
        }

        const token = tokens.shift()!;

        if (token === "(") {
            let left: Term | null = null;
            while (tokens[0] !== ")") {
                if (tokens.length === 0) {
                    throw new Error("Lambda Parse Error: Missing closing parenthesis ')'.");
                }
                const nextTerm = parseTokens();
                if (left === null) {
                    left = nextTerm;
                } else {
                    left = apply(left, nextTerm);
                }
            }
            tokens.shift(); // Consume ")"
            
            if (left === null) {
                throw new Error("Lambda Parse Error: Empty parenthesis '()'.");
            }
            return left;
        } else if (token === ")") {
            throw new Error("Lambda Parse Error: Unexpected closing parenthesis ')'.");
        } else if (["S", "K", "I", "Y"].includes(token)) {
            return { type: "Combinator", name: token as "S" | "K" | "I" | "Y" };
        } else if (MACROS[token]) {
            // O-145 Vector N.2: Hardware Expansion
            // Dynamically unwrap the Senate's semantic intent into pure physics nodes
            return parseLambda(MACROS[token]); 
        } else {
            return variable(token);
        }
    }

    let result = parseTokens();
    
    // If there are multiple root tokens without parenthesis, implicitly apply them left-to-right
    while (tokens.length > 0) {
        result = apply(result, parseTokens());
    }

    return result;
}
