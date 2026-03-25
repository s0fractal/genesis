import { writeFile, mkdir } from "node:fs/promises";
import initWasm, { PhaseLatticeField, execute_phase_lattice_tick } from "../omega_core/pkg/omega_core.js";
import { readFile } from "node:fs/promises";
import { snapshotWasmPhaseField } from "../src/replay/phase_replay.ts";
import { structuralSignature, sumAmplitude, sumEntanglement } from "../src/shared/topology_core.ts";

async function generateGoldenBase() {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });

    const ticks = 24;
    const sectors = 32;
    const radialBins = 6;
    const harmonics = 3;
    const field = new PhaseLatticeField(sectors, radialBins, harmonics);

    const shape = { sectors, radialBins, harmonics, tauDepth: 4 };

    const referenceTrace = [];
    const wasmTrace = [];
    
    // Initial State
    let snap = snapshotWasmPhaseField(field, wasm, shape);
    let sig = structuralSignature(snap);
    let amp = sumAmplitude(snap);
    let ent = sumEntanglement(snap);
    
    let entry = { tick: 0, structuralSignature: sig, totalAmplitude: amp, totalEntanglement: ent };
    referenceTrace.push(entry);
    wasmTrace.push(entry);

    // Evolve
    for (let t = 1; t <= ticks; t++) {
        execute_phase_lattice_tick(field);
        snap = snapshotWasmPhaseField(field, wasm, shape);
        sig = structuralSignature(snap);
        amp = sumAmplitude(snap);
        ent = sumEntanglement(snap);
        
        entry = { tick: t, structuralSignature: sig, totalAmplitude: amp, totalEntanglement: ent };
        referenceTrace.push(entry);
        wasmTrace.push(entry);
    }

    const goldenPayload = {
        schemaVersion: 1,
        shape,
        ticks,
        referenceTrace,
        wasmTrace
    };

    await mkdir(new URL("./goldens", import.meta.url), { recursive: true });
    await writeFile(
        new URL("./goldens/phase_coherence_golden.json", import.meta.url),
        JSON.stringify(goldenPayload, null, 2)
    );
    console.log("Era 245 Golden Baseline Written.");
}

generateGoldenBase().catch(console.error);
