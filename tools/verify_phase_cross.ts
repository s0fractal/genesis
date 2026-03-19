import {
    PHASE_CROSS_GOLDEN,
    buildPhaseCrossGolden,
    initOmegaWasm,
    readGolden,
} from "./phase_golden_common.ts";
import type { PhaseCrossGolden, PhaseCrossTraceEntry } from "./phase_golden_common.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTraceEntry(actual: PhaseCrossTraceEntry, expected: PhaseCrossTraceEntry, index: number): void {
    const keys = Object.keys(expected) as Array<keyof PhaseCrossTraceEntry>;
    for (const key of keys) {
        assert(
            actual[key] === expected[key],
            `phase_cross.trace[${index}] mismatch at ${key}: expected=${expected[key]} actual=${actual[key]}`,
        );
    }
}

function verifyMonotonicTrend(
    trace: PhaseCrossTraceEntry[],
    field: "totalAmplitudeDelta" | "totalLockDelta" | "totalEntanglementDelta",
    direction: "nonincreasing" | "nondecreasing",
): void {
    for (let index = 1; index < trace.length; index++) {
        const previous = trace[index - 1][field];
        const current = trace[index][field];
        const ok = direction === "nonincreasing" ? current <= previous : current >= previous;
        assert(ok, `phase_cross ${field} broke ${direction} at tick=${trace[index].tick}: prev=${previous} current=${current}`);
    }
}

function verifyPhaseCross(actual: PhaseCrossGolden, expected: PhaseCrossGolden): void {
    assert(actual.schemaVersion === expected.schemaVersion, "phase_cross schemaVersion mismatch");
    assert(actual.ticks === expected.ticks, "phase_cross ticks mismatch");
    assert(actual.collapsedRadialBins === expected.collapsedRadialBins, "phase_cross collapsedRadialBins mismatch");
    assert(actual.phaseShape.sectors === expected.phaseShape.sectors, "phase_cross sectors mismatch");
    assert(actual.phaseShape.radialBins === expected.phaseShape.radialBins, "phase_cross radialBins mismatch");
    assert(actual.phaseShape.harmonics === expected.phaseShape.harmonics, "phase_cross harmonics mismatch");
    assert(actual.hybridShape.width === expected.hybridShape.width, "phase_cross hybrid width mismatch");
    assert(actual.hybridShape.height === expected.hybridShape.height, "phase_cross hybrid height mismatch");
    assert(actual.trace.length === expected.trace.length, "phase_cross trace length mismatch");

    for (let index = 0; index < expected.trace.length; index++) {
        compareTraceEntry(actual.trace[index], expected.trace[index], index);
    }

    assert(
        actual.trace[0]?.changedCells === expected.invariants.seedChangedCells,
        `phase_cross seedChangedCells mismatch: expected=${expected.invariants.seedChangedCells} actual=${actual.trace[0]?.changedCells ?? "missing"}`,
    );

    for (const entry of actual.trace) {
        assert(
            entry.totalAmplitudeDelta <= expected.invariants.amplitudeDeltaCeiling,
            `phase_cross totalAmplitudeDelta exceeded ceiling at tick=${entry.tick}: ceiling=${expected.invariants.amplitudeDeltaCeiling} actual=${entry.totalAmplitudeDelta}`,
        );
        assert(
            entry.maxPhaseDistance <= expected.invariants.maxPhaseDistanceCeiling,
            `phase_cross maxPhaseDistance exceeded ceiling at tick=${entry.tick}: ceiling=${expected.invariants.maxPhaseDistanceCeiling} actual=${entry.maxPhaseDistance}`,
        );
    }

    verifyMonotonicTrend(actual.trace.slice(1), "totalLockDelta", expected.invariants.lockDeltaTrend);
    verifyMonotonicTrend(actual.trace.slice(1), "totalEntanglementDelta", expected.invariants.entanglementDeltaTrend);
}

async function main(): Promise<void> {
    const wasm = await initOmegaWasm();

    const expected = await readGolden<PhaseCrossGolden>(PHASE_CROSS_GOLDEN);
    const actual = buildPhaseCrossGolden(wasm);

    verifyPhaseCross(actual, expected);

    const last = actual.trace.at(-1);
    console.log("=== Genesis verify:phase-cross ===");
    console.log(`ticks=${actual.ticks}`);
    console.log(`collapsed_radial_bins=${actual.collapsedRadialBins}`);
    console.log(`seed_changed_cells=${actual.invariants.seedChangedCells}`);
    console.log(`phase_signature=${last?.phaseSignature ?? "missing"}`);
    console.log(`hybrid_signature=${last?.hybridSignature ?? "missing"}`);
    console.log(`amplitude_delta=${last?.totalAmplitudeDelta ?? "missing"}`);
    console.log(`lock_delta=${last?.totalLockDelta ?? "missing"}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
