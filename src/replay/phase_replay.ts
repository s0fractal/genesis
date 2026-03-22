import {
    clonePhaseField,
    stepPhaseField,
    structuralSignature,
    sumAmplitude,
    sumEntanglement,
} from "../shared/phase_lattice.ts";
import { phaseDistance } from "../shared/topology_core.ts";
import { buildCanonicalPhaseSeed } from "../shared/phase_canonical.ts";

export type ReplayCompareMode = "none" | "seed" | "previous";

export interface ReplayReferenceTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
}

export interface ReplayWasmTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
    omegaSpan: string;
}

export interface PhaseReplayGolden {
    schemaVersion: 1;
    shape: PhaseFieldShape;
    ticks: number;
    referenceTrace: ReplayReferenceTraceEntry[];
    wasmTrace: ReplayWasmTraceEntry[];
    invariants: {
        referenceSeedLegacySignature: string;
        referenceSeedStructuralSignature: string;
        wasmSeedStructuralSignature: string;
        rotatedPhaseStructuralSignature: string;
        rotatedAddressStructuralSignature: string;
    };
}

export interface PhaseReplayDataset {
    golden: PhaseReplayGolden;
    snapshots: PhaseField[];
}

export interface PhaseReplayDiffSummary {
    changedCells: number;
    totalAmplitudeDelta: number;
    totalLockDelta: number;
    totalEntanglementDelta: number;
    maxPhaseDistance: number;
    parityLocked: boolean;
    referenceStructuralSignature: string;
    wasmStructuralSignature: string;
}

const phaseCoherenceGoldenUrl = new URL("../../tools/goldens/phase_coherence_golden.json", import.meta.url);

export async function loadPhaseReplayDataset(): Promise<PhaseReplayDataset> {
    const response = await fetch(phaseCoherenceGoldenUrl);
    if (!response.ok) {
        throw new Error(`Failed to load phase replay golden: ${response.status} ${response.statusText}`);
    }

    const golden = await response.json() as PhaseReplayGolden;
    assertValidGolden(golden);

    const snapshots: PhaseField[] = [];
    let current = buildCanonicalPhaseSeed(golden.shape);
    snapshots.push(clonePhaseField(current));
    validateReferenceSnapshot(current, golden.referenceTrace[0]);

    for (let tick = 1; tick <= golden.ticks; tick++) {
        stepPhaseField(current);

        snapshots.push(clonePhaseField(current));
        validateReferenceSnapshot(current, golden.referenceTrace[tick]);
    }

    return {
        golden,
        snapshots,
    };
}

export function getReplaySnapshot(dataset: PhaseReplayDataset, tick: number): PhaseField {
    const boundedTick = clampTick(tick, dataset.golden.ticks);
    return dataset.snapshots[boundedTick];
}

export function getReplayComparison(
    dataset: PhaseReplayDataset,
    tick: number,
    compareMode: ReplayCompareMode,
): PhaseField | null {
    const boundedTick = clampTick(tick, dataset.golden.ticks);
    if (compareMode === "none") {
        return null;
    }
    if (compareMode === "seed") {
        return dataset.snapshots[0];
    }
    if (boundedTick === 0) {
        return null;
    }
    return dataset.snapshots[boundedTick - 1];
}

export function summarizeReplayDiff(
    dataset: PhaseReplayDataset,
    tick: number,
    compareMode: ReplayCompareMode,
): PhaseReplayDiffSummary {
    const boundedTick = clampTick(tick, dataset.golden.ticks);
    const current = dataset.snapshots[boundedTick];
    const compare = getReplayComparison(dataset, boundedTick, compareMode);
    const referenceTrace = dataset.golden.referenceTrace[boundedTick];
    const wasmTrace = dataset.golden.wasmTrace[boundedTick];
    return buildDiffSummary(
        current,
        compare,
        referenceTrace.structuralSignature,
        wasmTrace.structuralSignature,
        referenceTrace.structuralSignature === wasmTrace.structuralSignature,
    );
}

export function buildDiffSummary(
    current: PhaseField,
    compare: PhaseField | null,
    referenceStructuralSignature: string,
    wasmStructuralSignature: string,
    parityLocked: boolean,
): PhaseReplayDiffSummary {
    let changedCells = 0;
    let totalAmplitudeDelta = 0;
    let totalLockDelta = 0;
    let totalEntanglementDelta = 0;
    let maxPhaseDistance = 0;

    if (compare) {
        for (let harmonic = 0; harmonic < current.shape.harmonics; harmonic++) {
            for (let rho = 0; rho < current.shape.radialBins; rho++) {
                for (let sector = 0; sector < current.shape.sectors; sector++) {
                    const index = harmonic * current.shape.radialBins * current.shape.sectors + rho * current.shape.sectors + sector;
                    
                    const amplitudeDelta = current.amplitude[index] - compare.amplitude[index];
                    const lockDelta = current.lock[index] - compare.lock[index];
                    const entanglementDelta = current.entanglement[index] - compare.entanglement[index];
                    const thetaDelta = phaseDistance(current.theta[index], compare.theta[index]);
        
                    if (
                        amplitudeDelta !== 0 ||
                        lockDelta !== 0 ||
                        entanglementDelta !== 0 ||
                        thetaDelta !== 0 ||
                        current.omega[index] !== compare.omega[index]
                    ) {
                        changedCells++;
                    }
        
                    totalAmplitudeDelta += amplitudeDelta;
                    totalLockDelta += lockDelta;
                    totalEntanglementDelta += entanglementDelta;
                    maxPhaseDistance = Math.max(maxPhaseDistance, thetaDelta);
                }
            }
        }
    }

    return {
        changedCells,
        totalAmplitudeDelta,
        totalLockDelta,
        totalEntanglementDelta,
        maxPhaseDistance,
        parityLocked,
        referenceStructuralSignature,
        wasmStructuralSignature,
    };
}

function clampTick(value: number, maxTick: number): number {
    return Math.max(0, Math.min(maxTick, Math.trunc(value)));
}

function validateReferenceSnapshot(field: PhaseField, trace: ReplayReferenceTraceEntry): void {
    const signature = structuralSignature(field);
    const amplitude = sumAmplitude(field);
    const entanglement = sumEntanglement(field);

    if (signature !== trace.structuralSignature) {
        throw new Error(
            `Phase replay structural mismatch at tick=${trace.tick}: expected=${trace.structuralSignature} actual=${signature}`,
        );
    }
    if (amplitude !== trace.totalAmplitude) {
        throw new Error(
            `Phase replay amplitude mismatch at tick=${trace.tick}: expected=${trace.totalAmplitude} actual=${amplitude}`,
        );
    }
    if (entanglement !== trace.totalEntanglement) {
        throw new Error(
            `Phase replay entanglement mismatch at tick=${trace.tick}: expected=${trace.totalEntanglement} actual=${entanglement}`,
        );
    }
}

function assertValidGolden(value: unknown): asserts value is PhaseReplayGolden {
    if (!value || typeof value !== "object") {
        throw new Error("Phase replay golden is not an object");
    }

    const golden = value as Partial<PhaseReplayGolden>;
    if (golden.schemaVersion !== 1) {
        throw new Error(`Unsupported phase replay schemaVersion: ${String(golden.schemaVersion)}`);
    }
    if (!golden.shape || typeof golden.shape !== "object") {
        throw new Error("Phase replay golden is missing shape");
    }
    if (!Array.isArray(golden.referenceTrace) || !Array.isArray(golden.wasmTrace)) {
        throw new Error("Phase replay golden is missing traces");
    }
    if (typeof golden.ticks !== "number") {
        throw new Error("Phase replay golden is missing ticks");
    }
    if (golden.referenceTrace.length !== golden.ticks + 1 || golden.wasmTrace.length !== golden.ticks + 1) {
        throw new Error("Phase replay golden trace length does not match ticks");
    }
}
