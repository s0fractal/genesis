// OMEGA-64 Legacy V1 Stub
// omega_core is frozen legacy; v2 (omega_v2 bare-metal) is the active kernel.
// This stub satisfies the @wasm import alias so that Deno type-checking
// and Vite bundling do not fail when legacy modules are imported.
// All functions throw if actually called — legacy code paths should not be
// reached in the v2 runtime.

function throwLegacy() {
    throw new Error("omega_core (V1) is frozen legacy and not loaded. Use omega_v2 bare-metal kernel instead.");
}

export default function initWasm() {
    console.warn("[omega_core stub] initWasm called — legacy V1 WASM is not available.");
    return Promise.resolve();
}

export class PhaseLatticeField {
    constructor() { throwLegacy(); }
}

export function phase_lattice_omega_span() { throwLegacy(); }
export function execute_phase_lattice_tick() { throwLegacy(); }
export function phase_lattice_shannon_entropy() { throwLegacy(); }

export function fnv1a_64(input) {
    // Minimal FNV-1a 64-bit fallback so non-critical legacy code doesn't crash
    let h = 0xCBF29CE484222325n;
    for (let i = 0; i < input.length; i++) {
        h = (h ^ BigInt(input.charCodeAt(i))) * 0x100000001B3n;
    }
    return h;
}

export function lambda_parse() { throwLegacy(); }
export function lambda_evaluate_fitness() { throwLegacy(); }
export function lambda_evaluate_fitness_stochastic() { throwLegacy(); }
export function lambda_measure_ir() { throwLegacy(); }
export function lambda_format_term() { throwLegacy(); }
export function lambda_decompose_ast() { throwLegacy(); }
export function lambda_phenotype_hue() { throwLegacy(); }
export function lambda_compile_morphology() { throwLegacy(); }
export function lambda_decode_morphology() { throwLegacy(); }
