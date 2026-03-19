import { readFile } from "node:fs/promises";
import initWasm, {
    PhaseLatticeField,
    execute_phase_lattice_tick,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude,
    phase_lattice_total_entanglement,
} from "../omega_core/pkg/omega_core.js";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function tick(field: PhaseLatticeField, ticks: number): void {
    for (let i = 0; i < ticks; i++) {
        execute_phase_lattice_tick(field);
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    await initWasm({ module_or_path: wasmBytes });

    const ticks = 24;

    const left = new PhaseLatticeField(32, 6, 3);
    const right = new PhaseLatticeField(32, 6, 3);
    tick(left, ticks);
    tick(right, ticks);
    assert(phase_lattice_signature(left) === phase_lattice_signature(right), "WASM deterministic replay failed");

    const rotatedPhase = new PhaseLatticeField(32, 6, 3);
    const baselinePhase = new PhaseLatticeField(32, 6, 3);
    rotatedPhase.rotate_global_phase(37);
    tick(rotatedPhase, ticks);
    tick(baselinePhase, ticks);
    baselinePhase.rotate_global_phase(37);
    assert(phase_lattice_signature(rotatedPhase) === phase_lattice_signature(baselinePhase), "WASM global phase rotation equivariance failed");

    const rotatedAddress = new PhaseLatticeField(32, 6, 3);
    const baselineAddress = new PhaseLatticeField(32, 6, 3);
    rotatedAddress.rotate_angular_address(5);
    tick(rotatedAddress, ticks);
    tick(baselineAddress, ticks);
    baselineAddress.rotate_angular_address(5);
    assert(phase_lattice_signature(rotatedAddress) === phase_lattice_signature(baselineAddress), "WASM angular address rotation equivariance failed");

    console.log("=== Genesis verify:phase-coherence:wasm ===");
    console.log(`ticks=${ticks}`);
    console.log(`structural_signature=${phase_lattice_signature(left)}`);
    console.log(`total_amplitude=${phase_lattice_total_amplitude(left)}`);
    console.log(`total_entanglement=${phase_lattice_total_entanglement(left)}`);
    console.log(`omega_span=${phase_lattice_omega_span(left)}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
