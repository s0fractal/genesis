import {
    Field,
    execute_phase_bridge_tick,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    seed_phase_bridge_pattern,
} from "../../omega_core/pkg/omega_core.js";
import {
    clamp,
    createPhaseField,
    getCell,
    structuralSignature,
    wrapTheta,
} from "../shared/phase_lattice.ts";
import type { PhaseField } from "../shared/phase_lattice.ts";

export interface HybridReplayTraceEntry {
    tick: number;
    signature: string;
    totalEnergy: number;
    totalLocks: number;
    totalPlasmids: number;
    omegaSpan: string;
    runLength?: number;
}

export interface HybridReplayGolden {
    schemaVersion: 1;
    width: number;
    height: number;
    ticks: number;
    wasmTrace: HybridReplayTraceEntry[];
    invariants: {
        seedSignature: string;
        rotatedSignature: string;
    };
}

export interface HybridReplayDataset {
    golden: HybridReplayGolden;
    snapshots: PhaseField[];
}

const phaseBridgeGoldenUrl = new URL("../../tools/goldens/phase_bridge_golden.json", import.meta.url);

export async function loadHybridReplayDataset(wasm: WebAssembly.Exports): Promise<HybridReplayDataset> {
    const response = await fetch(phaseBridgeGoldenUrl);
    if (!response.ok) {
        throw new Error(`Failed to load hybrid replay golden: ${response.status} ${response.statusText}`);
    }

    const golden = await response.json() as HybridReplayGolden;
    assertValidGolden(golden);

    const field = new Field(golden.width, golden.height);
    seed_phase_bridge_pattern(field);

    const snapshots: PhaseField[] = [];
    snapshots.push(snapshotHybridField(field, wasm));
    
    let currentTraceIdx = 0;
    let ticksInCurrentRun = 0;
    
    validateHybridSnapshot(field, golden.wasmTrace[currentTraceIdx], 0);
    ticksInCurrentRun++;

    for (let tick = 1; tick <= golden.ticks; tick++) {
        execute_phase_bridge_tick(field, 0);
        snapshots.push(snapshotHybridField(field, wasm));
        
        const currentEntry = golden.wasmTrace[currentTraceIdx];
        const runLength = currentEntry.runLength ?? 1;
        
        if (ticksInCurrentRun >= runLength) {
            currentTraceIdx++;
            ticksInCurrentRun = 0;
        }
        
        validateHybridSnapshot(field, golden.wasmTrace[currentTraceIdx], tick);
        ticksInCurrentRun++;
    }

    return {
        golden,
        snapshots,
    };
}

export function cropPhaseField(field: PhaseField, radialBins: number): PhaseField {
    const boundedBins = Math.max(1, Math.min(radialBins, field.shape.radialBins));
    if (boundedBins === field.shape.radialBins) {
        return field;
    }

    return createPhaseField(
        {
            sectors: field.shape.sectors,
            radialBins: boundedBins,
            harmonics: field.shape.harmonics,
        },
        ({ sector, rho, harmonic }) => {
            const cell = getCell(field, sector, rho, harmonic);
            return {
                theta: cell.theta,
                omega: cell.omega,
                amplitude: cell.amplitude,
                lock: cell.lock,
                entanglement: cell.entanglement,
                cellStatus: cell.cellStatus,
                plasmids: cell.plasmids,
            };
        },
    );
}

export function collapsePhaseField(field: PhaseField, radialBins = field.shape.radialBins): PhaseField {
    const boundedBins = Math.max(1, Math.min(radialBins, field.shape.radialBins));
    return createPhaseField(
        {
            sectors: field.shape.sectors,
            radialBins: boundedBins,
            harmonics: 1,
        },
        ({ sector, rho }) => {
            let sumX = 0;
            let sumY = 0;
            let sumAmplitude = 0;
            let sumLock = 0;
            let sumOmega = 0;
            let maxEntanglement = 0;

            for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
                const cell = getCell(field, sector, rho, harmonic);
                const weight = Math.max(1, cell.amplitude);
                const radians = (cell.theta / 256) * Math.PI * 2;
                sumX += Math.cos(radians) * weight;
                sumY += Math.sin(radians) * weight;
                sumAmplitude += cell.amplitude;
                sumLock += cell.lock;
                sumOmega += cell.omega;
                maxEntanglement = Math.max(maxEntanglement, cell.entanglement);
            }

            const meanAngle = Math.atan2(sumY, sumX);
            const normalizedAngle = meanAngle < 0 ? meanAngle + Math.PI * 2 : meanAngle;
            const harmonicCount = field.shape.harmonics;

            return {
                theta: wrapTheta(Math.round((normalizedAngle / (Math.PI * 2)) * 256)),
                omega: Math.round(sumOmega / harmonicCount),
                amplitude: clamp(Math.round(sumAmplitude / harmonicCount), 0, 255),
                lock: clamp(Math.round(sumLock / harmonicCount), 0, 255),
                entanglement: maxEntanglement,
                cellStatus: 0,
                plasmids: 0n,
            };
        },
    );
}

export function hybridSnapshotSignature(field: PhaseField): string {
    return structuralSignature(field);
}

export function snapshotHybridField(field: Field, wasm: WebAssembly.Exports): PhaseField {
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const cellCount = field.width * field.height;
    const theta = new Uint8Array(memory.buffer, field.ptr_theta_now(), cellCount);
    const omega = new Uint8Array(memory.buffer, field.ptr_omega(), cellCount);
    const energy = new Uint8Array(memory.buffer, field.ptr_energy(), cellCount);
    const locks = new Uint8Array(memory.buffer, field.ptr_hebbian_locks(), cellCount);
    const plasmids = new BigUint64Array(memory.buffer, field.ptr_plasmids(), cellCount);

    return createPhaseField(
        {
            sectors: field.width,
            radialBins: field.height,
            harmonics: 1,
        },
        ({ sector, rho }) => {
            const index = rho * field.width + sector;
            return {
                theta: theta[index],
                omega: decodeBridgeOmega(omega[index]),
                amplitude: energy[index],
                lock: locks[index],
                // Bridge mode has no direct antipodal field, so plasmid presence becomes a view-only proxy.
                entanglement: plasmids[index] === 0n ? 0 : clamp(96 + locks[index], 0, 255),
                cellStatus: 0,
                plasmids: plasmids[index],
            };
        },
    );
}

export function snapshotHybridComparableField(field: Field, wasm: WebAssembly.Exports): PhaseField {
    const memory = wasm.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM memory export is unavailable");
    }

    const cellCount = field.width * field.height;
    const theta = new Uint8Array(memory.buffer, field.ptr_theta_now(), cellCount);
    const omega = new Uint8Array(memory.buffer, field.ptr_omega(), cellCount);
    const energy = new Uint8Array(memory.buffer, field.ptr_energy(), cellCount);
    const locks = new Uint8Array(memory.buffer, field.ptr_hebbian_locks(), cellCount);

    return createPhaseField(
        {
            sectors: field.width,
            radialBins: field.height,
            harmonics: 1,
        },
        ({ sector, rho }) => {
            const index = rho * field.width + sector;
            return {
                theta: theta[index],
                omega: decodeBridgeOmega(omega[index]),
                amplitude: energy[index],
                lock: locks[index],
                // Cross-mode admission should compare only registers that actually exist in bridge mode.
                entanglement: 0,
                cellStatus: 0,
                plasmids: 0n,
            };
        },
    );
}

function validateHybridSnapshot(field: Field, trace: HybridReplayTraceEntry, actualTick: number): void {
    const signature = field_signature(field);
    if (signature !== trace.signature) {
        throw new Error(
            `Hybrid replay signature mismatch at tick=${actualTick} (RLE chunk=${trace.tick}): expected=${trace.signature} actual=${signature}`,
        );
    }
    if (field_total_energy(field) !== trace.totalEnergy) {
        throw new Error(`Hybrid replay energy mismatch at tick=${actualTick} (RLE chunk=${trace.tick})`);
    }
    if (field_total_locks(field) !== trace.totalLocks) {
        throw new Error(`Hybrid replay lock mismatch at tick=${actualTick} (RLE chunk=${trace.tick})`);
    }
    if (field_total_plasmids(field) !== trace.totalPlasmids) {
        throw new Error(`Hybrid replay plasmid mismatch at tick=${actualTick} (RLE chunk=${trace.tick})`);
    }
}

function decodeBridgeOmega(raw: number): number {
    const signed = raw > 127 ? raw - 256 : raw;
    return clamp(signed, -32, 32);
}

function assertValidGolden(value: unknown): asserts value is HybridReplayGolden {
    if (!value || typeof value !== "object") {
        throw new Error("Hybrid replay golden is not an object");
    }

    const golden = value as Partial<HybridReplayGolden>;
    if (golden.schemaVersion !== 1) {
        throw new Error(`Unsupported hybrid replay schemaVersion: ${String(golden.schemaVersion)}`);
    }
    if (!Array.isArray(golden.wasmTrace)) {
        throw new Error("Hybrid replay golden is missing wasmTrace");
    }
    if (typeof golden.width !== "number" || typeof golden.height !== "number" || typeof golden.ticks !== "number") {
        throw new Error("Hybrid replay golden is missing dimensions");
    }
    // RLE compression prevents strict len == ticks check.
}
