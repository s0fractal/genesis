import { readFile } from "node:fs/promises";
import initWasm, {
    PhaseLatticeField,
    execute_phase_lattice_tick,
    execute_phase_lattice_fossilization,
    phase_lattice_signature,
} from "../omega_core/pkg/omega_core.js";
import {
    buildReferenceSeed,
    snapshotPhaseWasmState,
} from "./phase_golden_common.ts";
import {
    runPhaseField,
    fossilizePhaseField,
    structuralSignature,
} from "../src/shared/phase_lattice.ts";
import type { PhaseFieldShape } from "../src/shared/phase_lattice.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTick(shape: PhaseFieldShape, ticks: number, wasm: WebAssembly.Exports): void {
    let reference = buildReferenceSeed(shape);
    const phaseField = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);

    for (let tick = 0; tick <= ticks; tick++) {
        const wasmState = snapshotPhaseWasmState(phaseField, wasm);
        const referenceState = reference.cells;

        assert(referenceState.length === wasmState.length, `cell count mismatch at tick=${tick}`);

        for (let index = 0; index < referenceState.length; index++) {
            const ref = referenceState[index];
            const actual = wasmState[index];

            if (
                ref.theta !== actual.theta ||
                ref.omega !== actual.omega ||
                ref.amplitude !== actual.amplitude ||
                ref.lock !== actual.lock ||
                ref.entanglement !== actual.entanglement
            ) {
                throw new Error(
                    [
                        `Phase parity mismatch at tick=${tick} index=${index}`,
                        `address=sector:${ref.sector} rho:${ref.rho} harmonic:${ref.harmonic}`,
                        `reference=${JSON.stringify({
                            theta: ref.theta,
                            omega: ref.omega,
                            amplitude: ref.amplitude,
                            lock: ref.lock,
                            entanglement: ref.entanglement,
                        })}`,
                        `wasm=${JSON.stringify(actual)}`,
                    ].join("\n"),
                );
            }
        }

        const referenceStructuralSignature = structuralSignature(reference);
        const wasmStructuralSignature = phase_lattice_signature(phaseField);
        assert(
            referenceStructuralSignature === wasmStructuralSignature,
            `Structural signature mismatch at tick=${tick}: reference=${referenceStructuralSignature} wasm=${wasmStructuralSignature}`,
        );

        reference = runPhaseField(reference, 1);
        execute_phase_lattice_tick(phaseField);
        
        const currentTick = tick + 1;
        if (currentTick % 24 === 0) {
            reference = fossilizePhaseField(reference);
            execute_phase_lattice_fossilization(phaseField);
        }
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });

    const shape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const ticks = 24;

    compareTick(shape, ticks, wasm);

    console.log("=== Genesis verify:phase-parity ===");
    console.log(`shape=${shape.sectors} sectors x ${shape.radialBins} rings x ${shape.harmonics} harmonics`);
    console.log(`ticks=${ticks}`);
    console.log(`structural_signature=${phase_lattice_signature(new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics))}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
