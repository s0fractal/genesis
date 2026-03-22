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
    snapshotHybridComparableField,
} from "../src/replay/hybrid_replay.ts";
import { phaseDistance, structuralSignature } from "../src/shared/topology_core.ts";
import { snapshotWasmPhaseField } from "../src/replay/phase_replay.ts";
import type { BridgeField, PhaseField, PhaseFieldShape } from "../src/shared/topology_core.ts";

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
    runLength?: number;
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
    runLength?: number;
}

export interface PhaseCoherenceGolden {
    schemaVersion: 1;
    shape: PhaseFieldShape;
    ticks: number;
    wasmTrace: PhaseWasmTraceEntry[];
    invariants: {
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
    runLength?: number;
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
        changedCellsCeiling: number;
        amplitudeDeltaCeiling: number;
        lockDeltaCeiling: number;
        maxPhaseDistanceCeiling: number;
        entanglementDeltaTrend: "nonincreasing";
    };
}

export async function ensureGoldenDirectory(): Promise<void> {
    await mkdir(GOLDEN_DIR, { recursive: true });
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initOmegaWasm(): Promise<any> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });
    return wasm;
}

export function capturePhaseWasmTrace(sectors: number, radialBins: number, harmonics: number, ticks: number): PhaseWasmTraceEntry[] {
    const field = new PhaseLatticeField(sectors, radialBins, harmonics);
    const trace: PhaseWasmTraceEntry[] = [];
    let lastEntry: PhaseWasmTraceEntry | null = null;

    for (let tick = 0; tick <= ticks; tick++) {
        if (tick > 0) execute_phase_lattice_tick(field);
        
        const current: PhaseWasmTraceEntry = {
            tick,
            legacySignature: phase_lattice_signature(field),
            structuralSignature: phase_lattice_signature(field),
            totalAmplitude: phase_lattice_total_amplitude(field),
            totalEntanglement: phase_lattice_total_entanglement(field),
            omegaSpan: phase_lattice_omega_span(field),
        };
        
        if (lastEntry &&
            lastEntry.legacySignature === current.legacySignature &&
            lastEntry.structuralSignature === current.structuralSignature &&
            lastEntry.totalAmplitude === current.totalAmplitude &&
            lastEntry.totalEntanglement === current.totalEntanglement &&
            lastEntry.omegaSpan === current.omegaSpan) {
            lastEntry.runLength = (lastEntry.runLength || 1) + 1;
        } else {
            current.runLength = 1;
            trace.push(current);
            lastEntry = current;
        }
    }

    return trace;
}

export function captureBridgeWasmTrace(width: number, height: number, ticks: number): BridgeTraceEntry[] {
    const field = new Field(width, height);
    seed_phase_bridge_pattern(field);

    const trace: BridgeTraceEntry[] = [];
    let lastEntry: BridgeTraceEntry | null = null;
    
    for (let tick = 0; tick <= ticks; tick++) {
        if (tick > 0) execute_phase_bridge_tick(field, 0);
        
        const current: BridgeTraceEntry = {
            tick,
            signature: field_signature(field),
            totalEnergy: field_total_energy(field),
            totalLocks: field_total_locks(field),
            totalPlasmids: field_total_plasmids(field),
            omegaSpan: field_omega_span(field),
        };
        
        if (lastEntry &&
            lastEntry.signature === current.signature &&
            lastEntry.totalEnergy === current.totalEnergy &&
            lastEntry.totalLocks === current.totalLocks &&
            lastEntry.totalPlasmids === current.totalPlasmids &&
            lastEntry.omegaSpan === current.omegaSpan) {
            lastEntry.runLength = (lastEntry.runLength || 1) + 1;
        } else {
            current.runLength = 1;
            trace.push(current);
            lastEntry = current;
        }
    }

    return trace;
}


export function buildPhaseCoherenceGolden(): PhaseCoherenceGolden {
    const shape: PhaseFieldShape = {
        tauDepth: 4,
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
        wasmTrace: capturePhaseWasmTrace(shape.sectors, shape.radialBins, shape.harmonics, ticks),
        invariants: {
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
        wasmTrace: captureBridgeWasmTrace(width, height, ticks),
        invariants: {
            seedSignature: field_signature(seeded),
            rotatedSignature: field_signature(rotated),
        },
    };
}

export function buildPhaseCrossGolden(wasm: WebAssembly.Exports): PhaseCrossGolden {
    const phaseShape: PhaseFieldShape = {
        tauDepth: 4,
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

    const phaseField = new PhaseLatticeField(phaseShape.sectors, phaseShape.radialBins, phaseShape.harmonics);
    const hybridField = new Field(hybridShape.width, hybridShape.height);
    seed_phase_bridge_pattern(hybridField);

    const trace: PhaseCrossTraceEntry[] = [];
    let lastEntry: PhaseCrossTraceEntry | null = null;

    for (let tick = 0; tick <= ticks; tick++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const phaseSnapshot = snapshotWasmPhaseField(phaseField, wasm as any, phaseShape);
        const phaseCollapsed = collapsePhaseField(phaseSnapshot, collapsedRadialBins);
        const hybridCropped = cropPhaseField(snapshotHybridComparableField(hybridField, wasm), collapsedRadialBins);
        const summary = buildCrossTraceEntry(tick, phaseCollapsed, hybridCropped);
        
        if (lastEntry &&
            lastEntry.changedCells === summary.changedCells &&
            lastEntry.totalAmplitudeDelta === summary.totalAmplitudeDelta &&
            lastEntry.totalLockDelta === summary.totalLockDelta &&
            lastEntry.totalEntanglementDelta === summary.totalEntanglementDelta &&
            lastEntry.maxPhaseDistance === summary.maxPhaseDistance &&
            lastEntry.phaseSignature === summary.phaseSignature &&
            lastEntry.hybridSignature === summary.hybridSignature) {
            lastEntry.runLength = (lastEntry.runLength || 1) + 1;
        } else {
            summary.runLength = 1;
            trace.push(summary);
            lastEntry = summary;
        }

        if (tick < ticks) {
            execute_phase_lattice_tick(phaseField);
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
            changedCellsCeiling: Math.max(...trace.map((entry) => entry.changedCells)),
            amplitudeDeltaCeiling: Math.max(...trace.map((entry) => entry.totalAmplitudeDelta)),
            lockDeltaCeiling: Math.max(...trace.map((entry) => entry.totalLockDelta)),
            maxPhaseDistanceCeiling: Math.max(...trace.map((entry) => entry.maxPhaseDistance)),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotPhaseWasmState(field: PhaseLatticeField, wasm: any): PhaseCellSnapshot[] {
    const count = field.cell_count();
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const offsetElements = field.get_current_tau() * count;

    const theta = new Uint8Array(memory.buffer, field.ptr_theta() + offsetElements * 1, count);
    const omega = new Int16Array(memory.buffer, field.ptr_omega() + offsetElements * 2, count);
    const amplitude = new Uint8Array(memory.buffer, field.ptr_amplitude() + offsetElements * 1, count);
    const lock = new Uint8Array(memory.buffer, field.ptr_lock() + offsetElements * 1, count);
    const entanglement = new Uint8Array(memory.buffer, field.ptr_entanglement() + offsetElements * 1, count);
    const cellStatus = new Uint8Array(memory.buffer, field.ptr_cell_status() + offsetElements * 1, count);
    const plasmids = new BigUint64Array(memory.buffer, field.ptr_plasmids() + offsetElements * 8, count);

    return Array.from({ length: count }, (_, index) => ({
        theta: theta[index],
        omega: omega[index],
        amplitude: amplitude[index],
        lock: lock[index],
        entanglement: entanglement[index],
        cellStatus: cellStatus[index],
        plasmids: plasmids[index],
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotBridgeWasmState(field: Field, wasm: any): BridgeField {
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

    for (let index = 0; index < phaseField.theta.length; index++) {
        const pAmplitude = phaseField.amplitude[index];
        const hAmplitude = hybridField.amplitude[index];
        const pLock = phaseField.lock[index];
        const hLock = hybridField.lock[index];
        const pEntanglement = phaseField.entanglement[index];
        const hEntanglement = hybridField.entanglement[index];
        const pTheta = phaseField.theta[index];
        const hTheta = hybridField.theta[index];
        const pOmega = phaseField.omega[index];
        const hOmega = hybridField.omega[index];

        const amplitudeDelta = pAmplitude - hAmplitude;
        const lockDelta = pLock - hLock;
        const entanglementDelta = pEntanglement - hEntanglement;
        const thetaDelta = phaseDistance(pTheta, hTheta);

        if (
            amplitudeDelta !== 0 ||
            lockDelta !== 0 ||
            entanglementDelta !== 0 ||
            thetaDelta !== 0 ||
            pOmega !== hOmega
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
