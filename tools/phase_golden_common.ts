import { mkdir, readFile, writeFile } from "node:fs/promises";
import initWasm, {
    Field,
    PhaseLatticeField,
    execute_phase_bridge_tick,
    execute_phase_lattice_tick,
    field_omega_span,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude,
    phase_lattice_total_entanglement,
    rotate_field_sectors,
    seed_phase_bridge_pattern,
} from "../omega_core/pkg/omega_core.js";
import {
    collapsePhaseField,
    cropPhaseField,
    snapshotHybridField,
} from "../src/replay/hybrid_replay.ts";
import {
    fieldSignature,
    phaseDistance,
    stepPhaseField,
    structuralSignature,
    sumAmplitude,
    sumEntanglement,
} from "../src/shared/phase_lattice.ts";
import { buildCanonicalPhaseSeed } from "../src/shared/phase_canonical.ts";
import {
    bridgeFieldSignature,
    bridgeOmegaSpan,
    bridgeTotalEnergy,
    bridgeTotalLocks,
    bridgeTotalPlasmids,
    buildBridgeSeed,
    stepBridgeField,
} from "../src/shared/phase_bridge.ts";
import type { BridgeField } from "../src/shared/phase_bridge.ts";
import type { PhaseField, PhaseFieldShape } from "../src/shared/phase_lattice.ts";

export const GOLDEN_DIR = new URL("./goldens/", import.meta.url);
export const PHASE_COHERENCE_GOLDEN = new URL("./goldens/phase_coherence_golden.json", import.meta.url);
export const PHASE_BRIDGE_GOLDEN = new URL("./goldens/phase_bridge_golden.json", import.meta.url);
export const PHASE_CROSS_GOLDEN = new URL("./goldens/phase_cross_golden.json", import.meta.url);

export interface PhaseTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
}

export interface PhaseWasmTraceEntry extends PhaseTraceEntry {
    omegaSpan: string;
}

export interface BridgeTraceEntry {
    tick: number;
    signature: string;
    totalEnergy: number;
    totalLocks: number;
    totalPlasmids: number;
    omegaSpan: string;
}

export interface PhaseCoherenceGolden {
    schemaVersion: 1;
    shape: PhaseFieldShape;
    ticks: number;
    referenceTrace: PhaseTraceEntry[];
    wasmTrace: PhaseWasmTraceEntry[];
    invariants: {
        referenceSeedLegacySignature: string;
        referenceSeedStructuralSignature: string;
        wasmSeedStructuralSignature: string;
        rotatedPhaseStructuralSignature: string;
        rotatedAddressStructuralSignature: string;
    };
}

export interface PhaseBridgeGolden {
    schemaVersion: 1;
    width: number;
    height: number;
    ticks: number;
    referenceTrace: BridgeTraceEntry[];
    wasmTrace: BridgeTraceEntry[];
    invariants: {
        seedSignature: string;
        rotatedSignature: string;
    };
}

export interface PhaseCrossTraceEntry {
    tick: number;
    changedCells: number;
    totalAmplitudeDelta: number;
    totalLockDelta: number;
    totalEntanglementDelta: number;
    maxPhaseDistance: number;
    phaseSignature: string;
    hybridSignature: string;
}

export interface PhaseCrossGolden {
    schemaVersion: 1;
    ticks: number;
    phaseShape: PhaseFieldShape;
    hybridShape: {
        width: number;
        height: number;
    };
    collapsedRadialBins: number;
    trace: PhaseCrossTraceEntry[];
    invariants: {
        seedChangedCells: number;
        amplitudeDeltaCeiling: number;
        maxPhaseDistanceCeiling: number;
        lockDeltaTrend: "nondecreasing";
        entanglementDeltaTrend: "nonincreasing";
    };
}

export async function ensureGoldenDirectory(): Promise<void> {
    await mkdir(GOLDEN_DIR, { recursive: true });
}

export const buildReferenceSeed = buildCanonicalPhaseSeed;

export function captureReferenceTrace(shape: PhaseFieldShape, ticks: number): PhaseTraceEntry[] {
    const trace: PhaseTraceEntry[] = [];
    let field = buildReferenceSeed(shape);

    trace.push({
        tick: 0,
        legacySignature: fieldSignature(field),
        structuralSignature: structuralSignature(field),
        totalAmplitude: sumAmplitude(field),
        totalEntanglement: sumEntanglement(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        field = stepPhaseField(field);
        trace.push({
            tick,
            legacySignature: fieldSignature(field),
            structuralSignature: structuralSignature(field),
            totalAmplitude: sumAmplitude(field),
            totalEntanglement: sumEntanglement(field),
        });
    }

    return trace;
}

export async function initOmegaWasm(): Promise<WebAssembly.Exports> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    return await initWasm({ module_or_path: wasmBytes });
}

export function capturePhaseWasmTrace(sectors: number, radialBins: number, harmonics: number, ticks: number): PhaseWasmTraceEntry[] {
    const field = new PhaseLatticeField(sectors, radialBins, harmonics);
    const trace: PhaseWasmTraceEntry[] = [];

    trace.push({
        tick: 0,
        legacySignature: phase_lattice_signature(field),
        structuralSignature: phase_lattice_signature(field),
        totalAmplitude: phase_lattice_total_amplitude(field),
        totalEntanglement: phase_lattice_total_entanglement(field),
        omegaSpan: phase_lattice_omega_span(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        execute_phase_lattice_tick(field);
        trace.push({
            tick,
            legacySignature: phase_lattice_signature(field),
            structuralSignature: phase_lattice_signature(field),
            totalAmplitude: phase_lattice_total_amplitude(field),
            totalEntanglement: phase_lattice_total_entanglement(field),
            omegaSpan: phase_lattice_omega_span(field),
        });
    }

    return trace;
}

export function captureBridgeWasmTrace(width: number, height: number, ticks: number): BridgeTraceEntry[] {
    const field = new Field(width, height);
    seed_phase_bridge_pattern(field);

    const trace: BridgeTraceEntry[] = [];
    trace.push({
        tick: 0,
        signature: field_signature(field),
        totalEnergy: field_total_energy(field),
        totalLocks: field_total_locks(field),
        totalPlasmids: field_total_plasmids(field),
        omegaSpan: field_omega_span(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        execute_phase_bridge_tick(field, 0);
        trace.push({
            tick,
            signature: field_signature(field),
            totalEnergy: field_total_energy(field),
            totalLocks: field_total_locks(field),
            totalPlasmids: field_total_plasmids(field),
            omegaSpan: field_omega_span(field),
        });
    }

    return trace;
}

export function captureBridgeReferenceTrace(width: number, height: number, ticks: number): BridgeTraceEntry[] {
    const trace: BridgeTraceEntry[] = [];
    let field = buildBridgeSeed(width, height);

    trace.push({
        tick: 0,
        signature: bridgeFieldSignature(field),
        totalEnergy: bridgeTotalEnergy(field),
        totalLocks: bridgeTotalLocks(field),
        totalPlasmids: bridgeTotalPlasmids(field),
        omegaSpan: bridgeOmegaSpan(field),
    });

    for (let tick = 1; tick <= ticks; tick++) {
        field = stepBridgeField(field);
        trace.push({
            tick,
            signature: bridgeFieldSignature(field),
            totalEnergy: bridgeTotalEnergy(field),
            totalLocks: bridgeTotalLocks(field),
            totalPlasmids: bridgeTotalPlasmids(field),
            omegaSpan: bridgeOmegaSpan(field),
        });
    }

    return trace;
}

export function buildPhaseCoherenceGolden(): PhaseCoherenceGolden {
    const shape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const ticks = 12;
    const baseline = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);
    const rotatedPhase = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);
    const rotatedAddress = new PhaseLatticeField(shape.sectors, shape.radialBins, shape.harmonics);

    rotatedPhase.rotate_global_phase(37);
    rotatedAddress.rotate_angular_address(5);

    for (let tick = 0; tick < ticks; tick++) {
        execute_phase_lattice_tick(rotatedPhase);
        execute_phase_lattice_tick(rotatedAddress);
    }

    return {
        schemaVersion: 1,
        shape,
        ticks,
        referenceTrace: captureReferenceTrace(shape, ticks),
        wasmTrace: capturePhaseWasmTrace(shape.sectors, shape.radialBins, shape.harmonics, ticks),
        invariants: {
            referenceSeedLegacySignature: fieldSignature(buildReferenceSeed(shape)),
            referenceSeedStructuralSignature: structuralSignature(buildReferenceSeed(shape)),
            wasmSeedStructuralSignature: phase_lattice_signature(baseline),
            rotatedPhaseStructuralSignature: phase_lattice_signature(rotatedPhase),
            rotatedAddressStructuralSignature: phase_lattice_signature(rotatedAddress),
        },
    };
}

export function buildPhaseBridgeGolden(): PhaseBridgeGolden {
    const width = 32;
    const height = 8;
    const ticks = 12;
    const rotated = new Field(width, height);

    seed_phase_bridge_pattern(rotated);
    rotate_field_sectors(rotated, 5);
    for (let tick = 0; tick < ticks; tick++) {
        execute_phase_bridge_tick(rotated, 0);
    }

    const seeded = new Field(width, height);
    seed_phase_bridge_pattern(seeded);

    return {
        schemaVersion: 1,
        width,
        height,
        ticks,
        referenceTrace: captureBridgeReferenceTrace(width, height, ticks),
        wasmTrace: captureBridgeWasmTrace(width, height, ticks),
        invariants: {
            seedSignature: field_signature(seeded),
            rotatedSignature: field_signature(rotated),
        },
    };
}

export function buildPhaseCrossGolden(wasm: WebAssembly.Exports): PhaseCrossGolden {
    const phaseShape: PhaseFieldShape = {
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const hybridShape = {
        width: 32,
        height: 8,
    };
    const collapsedRadialBins = Math.min(phaseShape.radialBins, hybridShape.height);
    const ticks = 12;

    let phaseField = buildReferenceSeed(phaseShape);
    const hybridField = new Field(hybridShape.width, hybridShape.height);
    seed_phase_bridge_pattern(hybridField);

    const trace: PhaseCrossTraceEntry[] = [];
    for (let tick = 0; tick <= ticks; tick++) {
        const phaseCollapsed = collapsePhaseField(phaseField, collapsedRadialBins);
        const hybridCropped = cropPhaseField(snapshotHybridField(hybridField, wasm), collapsedRadialBins);
        const summary = buildCrossTraceEntry(tick, phaseCollapsed, hybridCropped);
        trace.push(summary);

        if (tick < ticks) {
            phaseField = stepPhaseField(phaseField);
            execute_phase_bridge_tick(hybridField, 0);
        }
    }

    return {
        schemaVersion: 1,
        ticks,
        phaseShape,
        hybridShape,
        collapsedRadialBins,
        trace,
        invariants: {
            seedChangedCells: trace[0]?.changedCells ?? 0,
            amplitudeDeltaCeiling: Math.max(...trace.map((entry) => entry.totalAmplitudeDelta)),
            maxPhaseDistanceCeiling: Math.max(...trace.map((entry) => entry.maxPhaseDistance)),
            lockDeltaTrend: "nondecreasing",
            entanglementDeltaTrend: "nonincreasing",
        },
    };
}

export async function writeGolden<T>(target: URL, value: T): Promise<void> {
    await ensureGoldenDirectory();
    await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readGolden<T>(target: URL): Promise<T> {
    const raw = await readFile(target, "utf8");
    return JSON.parse(raw) as T;
}

export interface PhaseCellSnapshot {
    theta: number;
    omega: number;
    amplitude: number;
    lock: number;
    entanglement: number;
}

export function snapshotPhaseWasmState(field: PhaseLatticeField, wasm: WebAssembly.Exports): PhaseCellSnapshot[] {
    const count = field.cell_count();
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const theta = new Uint8Array(memory.buffer, field.ptr_theta(), count);
    const omega = new Int16Array(memory.buffer, field.ptr_omega(), count);
    const amplitude = new Uint8Array(memory.buffer, field.ptr_amplitude(), count);
    const lock = new Uint8Array(memory.buffer, field.ptr_lock(), count);
    const entanglement = new Uint8Array(memory.buffer, field.ptr_entanglement(), count);

    return Array.from({ length: count }, (_, index) => ({
        theta: theta[index],
        omega: omega[index],
        amplitude: amplitude[index],
        lock: lock[index],
        entanglement: entanglement[index],
    }));
}

export function snapshotBridgeWasmState(field: Field, wasm: WebAssembly.Exports): BridgeField {
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const count = field.width * field.height;
    const activeRequests = field.get_oracle_request_count();

    return {
        width: field.width,
        height: field.height,
        thetaNow: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_now(), count)),
        thetaF1: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_f1(), count)),
        thetaF2: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_f2(), count)),
        thetaF3: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_theta_f3(), count)),
        omega: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_omega(), count)),
        energy: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_energy(), count)),
        plasmids: new BigUint64Array(new BigUint64Array(memory.buffer, field.ptr_plasmids(), count)),
        hebbianLocks: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_hebbian_locks(), count)),
        oracleRequests: new Uint32Array(new Uint32Array(memory.buffer, field.ptr_oracle_requests(), activeRequests)),
        oracleRequestCount: activeRequests,
        cellStatus: new Uint8Array(new Uint8Array(memory.buffer, field.ptr_cell_status(), count)),
    };
}

function buildCrossTraceEntry(
    tick: number,
    phaseField: PhaseField,
    hybridField: PhaseField,
): PhaseCrossTraceEntry {
    let changedCells = 0;
    let totalAmplitudeDelta = 0;
    let totalLockDelta = 0;
    let totalEntanglementDelta = 0;
    let maxPhaseDistance = 0;

    for (let index = 0; index < phaseField.cells.length; index++) {
        const phaseCell = phaseField.cells[index];
        const hybridCell = hybridField.cells[index];
        const amplitudeDelta = phaseCell.amplitude - hybridCell.amplitude;
        const lockDelta = phaseCell.lock - hybridCell.lock;
        const entanglementDelta = phaseCell.entanglement - hybridCell.entanglement;
        const thetaDelta = phaseDistance(phaseCell.theta, hybridCell.theta);

        if (
            amplitudeDelta !== 0 ||
            lockDelta !== 0 ||
            entanglementDelta !== 0 ||
            thetaDelta !== 0 ||
            phaseCell.omega !== hybridCell.omega
        ) {
            changedCells++;
        }

        totalAmplitudeDelta += amplitudeDelta;
        totalLockDelta += lockDelta;
        totalEntanglementDelta += entanglementDelta;
        maxPhaseDistance = Math.max(maxPhaseDistance, thetaDelta);
    }

    return {
        tick,
        changedCells,
        totalAmplitudeDelta,
        totalLockDelta,
        totalEntanglementDelta,
        maxPhaseDistance,
        phaseSignature: structuralSignature(phaseField),
        hybridSignature: structuralSignature(hybridField),
    };
}
