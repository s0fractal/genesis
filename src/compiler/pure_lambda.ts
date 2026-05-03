/**
 * ============================================================================
 * [ OMEGA-64 PROTOCOL: V1.0 FROZEN ]
 * ============================================================================
 * WARNING: This module (and the underlying `omega_core` WASM) is considered
 * legacy and frozen as of V1.0. Do not modify or extend this codebase. 
 * It is preserved purely to maintain backwards compatibility for the
 * `debug_console.ts` utilities and the pure lambda evaluation layer.
 * All new physics and state calculations should happen in `omega_v2`.
 * ============================================================================
 */
import {
    lambda_parse,
    lambda_evaluate_fitness,
    lambda_evaluate_fitness_stochastic,
    lambda_measure_ir,
    lambda_format_term
} from "@wasm";

export {
    lambda_decompose_ast,
    lambda_phenotype_hue,
    lambda_compile_morphology,
    lambda_decode_morphology,
    lambda_parse,
    lambda_format_term,
    lambda_evaluate_fitness,
    lambda_evaluate_fitness_stochastic
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

export function evaluateFitness(term: Term, maxSteps = 128, entropySeed = 0): { result: Term; steps: number; timeout: boolean } {
    const res = lambda_evaluate_fitness_stochastic(term, maxSteps, entropySeed) as unknown as Uint32Array;
    // WASM evaluate returns [result_idx, steps_taken, timeout_flag]
    return { result: res[0], steps: res[1], timeout: res[2] === 1 };
}
// Era 234: Biological Sonification (The Toroidal Synth)
export function astToFrequencies(astStr: string): number[] {
    const freqs: number[] = [];
    const tokens = astStr.replace(/\(/g, "").replace(/\)/g, "").split(" ");
    
    let currentFreq = 54.0; // Sub-octave 432Hz Root
    freqs.push(currentFreq);
    
    for (const t of tokens) {
        if (t === "S") currentFreq *= 1.5; // Perfect 5th
        else if (t === "K") currentFreq *= 1.33333; // Perfect 4th
        else if (t === "I") currentFreq *= 1.25; // Major 3rd
        else if (t === "Y" || t === "W") currentFreq *= 0.5; // Octave down
        else if (t === "C" || t === "B") currentFreq *= 2.0; // Octave up
        
        while (currentFreq > 2000) currentFreq *= 0.5;
        while (currentFreq < 40) currentFreq *= 2.0;
        
        freqs.push(currentFreq);
    }
    
    const unique = Array.from(new Set(freqs.map(f => Math.round(f * 10) / 10)));
    return unique.slice(0, 4);
}

// O-234.2: Consonance Fitness Calculation
// Rewards Plasmids whose frequencies align with exact integer ratios
export function calculateConsonanceBonus(astStr: string): number {
    const freqs = astToFrequencies(astStr);
    if (freqs.length < 2) return 0.0;
    
    let bonus = 0.0;
    for (let i = 0; i < freqs.length; i++) {
        for (let j = i + 1; j < freqs.length; j++) {
            const f1 = freqs[i];
            const f2 = freqs[j];
            const ratio = Math.max(f1, f2) / Math.min(f1, f2);
            
            const intervals = [
                1.5, // Perfect 5th (3:2)
                1.33333, // Perfect 4th (4:3)
                1.25, // Major 3rd (5:4)
                1.2, // Minor 3rd (6:5)
                1.66667, // Major 6th (5:3)
                2.0 // Octave (2:1)
            ];
            
            // HIGH-5 FIX: log-tolerance replaces arithmetic tolerance.
            // Log-tolerance is frequency-invariant: same perceptual consonance
            // regardless of absolute frequency.
            const LOG_TOLERANCE = 0.07; // ≈ 5% in log2 space
            for (const target of intervals) {
                if (Math.abs(Math.log2(ratio) - Math.log2(target)) < LOG_TOLERANCE) {
                    bonus += 10.0; // Huge evolutionary ATP reward for physical harmony
                }
            }
        }
    }
    return bonus;
}

// Era 237: The Interaction Surface (Mycelial API)
// Extracts an explicit conversational vector from a pure Lambda Calculus term structure.
export function extractInteractionSignal(astStr: string): number | null {
    const sCount = (astStr.match(/S/g) || []).length;
    const kCount = (astStr.match(/K/g) || []).length;
    
    // Abstract Signal Delta: 
    // Highly entangled (S-dominant) Genomes broadcast a Positive Signal (Expansion / Offer)
    // Highly rigid (K-dominant) Genomes broadcast a Negative Signal (Contraction / Request)
    const delta = sCount - kCount;
    
    // Filter noise: A differential of 5 is required to break the semantic threshold and emit a true Signal.
    if (Math.abs(delta) >= 5) {
        return delta;
    }
    
    return null; // Silent Entity
}
