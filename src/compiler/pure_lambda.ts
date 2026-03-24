import {
    lambda_parse,
    lambda_evaluate_fitness,
    lambda_measure_ir,
    lambda_decompose_ast,
    lambda_compile_morphology,
    lambda_decode_morphology,
    lambda_phenotype_hue,
    lambda_format_term
} from "@wasm";

export type Term = number;

let _S: number = -1;
let _K: number = -1;
let _I: number = -1;
let _Y: number = -1;
let _B: number = -1;
let _C: number = -1;
let _W: number = -1;

export const getS = (): Term => _S < 0 ? (_S = lambda_parse("S")) : _S;
export const getK = (): Term => _K < 0 ? (_K = lambda_parse("K")) : _K;
export const getI = (): Term => _I < 0 ? (_I = lambda_parse("I")) : _I;
export const getY = (): Term => _Y < 0 ? (_Y = lambda_parse("Y")) : _Y;
export const getB = (): Term => _B < 0 ? (_B = lambda_parse("B")) : _B;
export const getC = (): Term => _C < 0 ? (_C = lambda_parse("C")) : _C;
export const getW = (): Term => _W < 0 ? (_W = lambda_parse("W")) : _W;

// Era 221 specifies `apply(left, right)` natively via strings if accessed in TS
export function apply(left: Term, right: Term): Term {
    return lambda_parse(`${lambda_format_term(left)} ${lambda_format_term(right)}`);
}

export interface SomaticNode {
    ast: Term; // Era 221: WASM Arena Index (Zero Allocation)
    l1_cost: number;
    depth: number;
    nodes: number;
    attention: number;
    age: number;
    energy: number;
    fitness: number;
    mutualists: Set<bigint>; // O-140 Vector I.1: The Mycelial Graph (Σ² Topology)
    sector: number; // Era 206: Geographic Niche (0-63)
    temporal_credit: number; // Era 206: Asynchronous Time Dilation execution counter
    parents?: string[]; // Era 222: Causal Vector Clock History
    vectorClock?: Record<string, number>; // Era 222: Cryptographic causal lineage tracking
}

export function measureIR(term: Term): { cost: number; depth: number; nodes: number } {
    const res = lambda_measure_ir(term);
    return { cost: res[0], depth: res[1], nodes: res[2] };
}

export function decomposeAST(term: Term): number {
    return lambda_decompose_ast(term);
}

export function phenotypeHue(term: Term): number {
    return lambda_phenotype_hue(term);
}

export function compileMorphology(term: Term): bigint {
    return lambda_compile_morphology(term);
}

export function decodeMorphology(genotype: bigint): Term {
    return lambda_decode_morphology(genotype);
}

export function variable(name: string): Term {
    return lambda_parse(name);
}

export function evaluateLambda(term: Term, maxSteps = 1024): Term {
    return lambda_evaluate_fitness(term, maxSteps);
}

export function evaluateFitness(term: Term, maxSteps = 128): { result: Term; steps: number; timeout: boolean } {
    const res = lambda_evaluate_fitness(term, maxSteps) as unknown as Uint32Array;
    // WASM evaluate returns [result_idx, steps_taken, timeout_flag]
    return { result: res[0], steps: res[1], timeout: res[2] === 1 };
}

export function formatTerm(term: Term): string {
    return lambda_format_term(term);
}

export function parseLambda(input: string): Term {
    return lambda_parse(input);
}
