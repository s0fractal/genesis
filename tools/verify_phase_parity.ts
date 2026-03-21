import {
    PhaseLatticeField,
    execute_phase_lattice_tick,
    execute_phase_lattice_fossilization,
    phase_lattice_signature,
} from "../omega_core/pkg/omega_core.js";
import {
    buildReferenceSeed,
    snapshotPhaseWasmState,
    initOmegaWasm,
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
        const count = shape.sectors * shape.radialBins * shape.harmonics;
        assert(count === wasmState.length, `cell count mismatch at tick=${tick}`);
        const offset = reference.currentTau * count;

        for (let index = 0; index < count; index++) {
            const refIdx = offset + index;
            const actual = wasmState[index];

            if (
                reference.theta[refIdx] !== actual.theta ||
                reference.omega[refIdx] !== actual.omega ||
                reference.amplitude[refIdx] !== actual.amplitude ||
                reference.lock[refIdx] !== actual.lock ||
                reference.entanglement[refIdx] !== actual.entanglement
            ) {
                const harmonic = Math.floor(index / (shape.radialBins * shape.sectors));
                const rho = Math.floor((index % (shape.radialBins * shape.sectors)) / shape.sectors);
                const sector = index % shape.sectors;

                throw new Error(
                    [
                        `Phase parity mismatch at tick=${tick} index=${index}`,
                        `address=sector:${sector} rho:${rho} harmonic:${harmonic}`,
                    `reference=${JSON.stringify({
                        theta: reference.theta[refIdx],
                        omega: reference.omega[refIdx],
                        amplitude: reference.amplitude[refIdx],
                        lock: reference.lock[refIdx],
                        entanglement: reference.entanglement[refIdx],
                    })}`,
                    `wasm=${JSON.stringify(actual, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`,
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
    const wasm = await initOmegaWasm();

    const shape: PhaseFieldShape = {
        tauDepth: 4,
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
