// OMEGA-64 Legacy V1 Stub
// omega_core is frozen legacy; v2 (omega_v2 bare-metal) is the active kernel.
// This stub satisfies the @wasm import alias so that Deno type-checking
// and Vite bundling do not fail when legacy modules are imported.

export default function initWasm(): Promise<void>;

export class PhaseLatticeField {
    constructor(width: number, height: number);
}

export function phase_lattice_omega_span(field: PhaseLatticeField): number;
export function execute_phase_lattice_tick(field: PhaseLatticeField): void;
export function phase_lattice_shannon_entropy(field: PhaseLatticeField): number;

export function fnv1a_64(input: string): bigint;

export function lambda_parse(source: string): number;
export function lambda_evaluate_fitness(index: number): number;
export function lambda_evaluate_fitness_stochastic(index: number): number;
export function lambda_measure_ir(index: number): number;
export function lambda_format_term(index: number): string;
export function lambda_decompose_ast(index: number): number[];
export function lambda_phenotype_hue(index: number): number;
export function lambda_compile_morphology(index: number): string;
export function lambda_decode_morphology(morphology: string): number;
