import {
    PHASE_BRIDGE_GOLDEN,
    PHASE_COHERENCE_GOLDEN,
    buildPhaseBridgeGolden,
    buildPhaseCoherenceGolden,
    initOmegaWasm,
    readGolden,
} from "./phase_golden_common.ts";
import type { BridgeTraceEntry, PhaseBridgeGolden, PhaseCoherenceGolden, PhaseTraceEntry, PhaseWasmTraceEntry } from "./phase_golden_common.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTraceEntry<T extends Record<string, number | string>>(label: string, actual: T, expected: T): void {
    const keys = Object.keys(expected);
    for (const key of keys) {
        assert(
            actual[key] === expected[key],
            `${label} mismatch at ${key}: expected=${expected[key]} actual=${actual[key]}`,
        );
    }
}

function compareTrace<T extends Record<string, number | string>>(
    label: string,
    actual: T[],
    expected: T[],
): void {
    assert(actual.length === expected.length, `${label} length mismatch: expected=${expected.length} actual=${actual.length}`);
    for (let i = 0; i < expected.length; i++) {
        compareTraceEntry(`${label}[${i}]`, actual[i], expected[i]);
    }
}

function verifyPhaseCoherence(actual: PhaseCoherenceGolden, expected: PhaseCoherenceGolden): void {
    assert(actual.schemaVersion === expected.schemaVersion, "phase_coherence schemaVersion mismatch");
    assert(actual.ticks === expected.ticks, "phase_coherence ticks mismatch");
    assert(actual.shape.sectors === expected.shape.sectors, "phase_coherence sectors mismatch");
    assert(actual.shape.radialBins === expected.shape.radialBins, "phase_coherence radialBins mismatch");
    assert(actual.shape.harmonics === expected.shape.harmonics, "phase_coherence harmonics mismatch");

    compareTrace<PhaseTraceEntry>("phase_coherence.referenceTrace", actual.referenceTrace, expected.referenceTrace);
    compareTrace<PhaseWasmTraceEntry>("phase_coherence.wasmTrace", actual.wasmTrace, expected.wasmTrace);
    compareTraceEntry("phase_coherence.invariants", actual.invariants, expected.invariants);
}

function verifyPhaseBridge(actual: PhaseBridgeGolden, expected: PhaseBridgeGolden): void {
    assert(actual.schemaVersion === expected.schemaVersion, "phase_bridge schemaVersion mismatch");
    assert(actual.ticks === expected.ticks, "phase_bridge ticks mismatch");
    assert(actual.width === expected.width, "phase_bridge width mismatch");
    assert(actual.height === expected.height, "phase_bridge height mismatch");

    compareTrace<BridgeTraceEntry>("phase_bridge.referenceTrace", actual.referenceTrace, expected.referenceTrace);
    compareTrace<BridgeTraceEntry>("phase_bridge.wasmTrace", actual.wasmTrace, expected.wasmTrace);
    compareTraceEntry("phase_bridge.invariants", actual.invariants, expected.invariants);
}

async function main(): Promise<void> {
    await initOmegaWasm();

    const expectedCoherence = await readGolden<PhaseCoherenceGolden>(PHASE_COHERENCE_GOLDEN);
    const expectedBridge = await readGolden<PhaseBridgeGolden>(PHASE_BRIDGE_GOLDEN);
    const actualCoherence = buildPhaseCoherenceGolden();
    const actualBridge = buildPhaseBridgeGolden();

    verifyPhaseCoherence(actualCoherence, expectedCoherence);
    verifyPhaseBridge(actualBridge, expectedBridge);

    console.log("=== Genesis verify:phase-goldens ===");
    console.log(`phase_coherence_signature=${actualCoherence.wasmTrace.at(-1)?.structuralSignature ?? "missing"}`);
    console.log(`phase_bridge_signature=${actualBridge.wasmTrace.at(-1)?.signature ?? "missing"}`);
    console.log(`phase_coherence_ticks=${actualCoherence.ticks}`);
    console.log(`phase_bridge_ticks=${actualBridge.ticks}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
