import {
    lambda_parse,
    lambda_evaluate_fitness,
    lambda_measure_ir,
    lambda_format_term
} from "@wasm";

export {
    lambda_decompose_ast as decomposeAST,
    lambda_phenotype_hue as phenotypeHue,
    lambda_compile_morphology as compileMorphology,
    lambda_decode_morphology as decodeMorphology,
    lambda_parse as variable,
    lambda_parse as parseLambda,
    lambda_format_term as formatTerm,
    lambda_evaluate_fitness as evaluateLambda
} from "@wasm";

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

export function measureIR(term: Term): { cost: number; depth: number; nodes: number } {
    const res = lambda_measure_ir(term);
    return { cost: res[0], depth: res[1], nodes: res[2] };
}

export function evaluateFitness(term: Term, maxSteps = 128): { result: Term; steps: number; timeout: boolean } {
    const res = lambda_evaluate_fitness(term, maxSteps) as unknown as Uint32Array;
    // WASM evaluate returns [result_idx, steps_taken, timeout_flag]
    return { result: res[0], steps: res[1], timeout: res[2] === 1 };
}
