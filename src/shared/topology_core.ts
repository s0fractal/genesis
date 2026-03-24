import { 
    PHASE_LUT_SIZE, PHASE_HALF_PHASE,
    PHASE_MIN_OMEGA, PHASE_MAX_OMEGA,
    PHASE_MAX_AMPLITUDE, PHASE_MAX_LOCK, PHASE_MAX_ENTANGLEMENT
} from "./constants.ts";

const FNV64_OFFSET_BASIS = 14695981039346656037n;
const FNV64_PRIME = 1099511628211n;
const FNV64_MASK = (1n << 64n) - 1n;

export function wrapIndex(value: number, modulo: number): number {
    return value & (modulo - 1);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function signedPhaseDelta(fromTheta: number, toTheta: number): number {
    const delta = wrapIndex(toTheta - fromTheta, PHASE_LUT_SIZE);
    return delta > PHASE_HALF_PHASE ? delta - PHASE_LUT_SIZE : delta;
}

export function phaseDistance(a: number, b: number): number {
    return Math.abs(signedPhaseDelta(a, b));
}

export function createTopology(config: LatticeConfig) {
    const { sectors, harmonics, wrapSectors } = config;

    const getOffset = (rho: number) => rho * harmonics * sectors;

    return {
        config,
        getIndex: (sector: number, rho: number, harmonic: number) => {
            const s = wrapSectors ? wrapIndex(sector, sectors) : clamp(sector, 0, sectors - 1);
            return getOffset(rho) + s + harmonic * sectors;
        }
    };
}

// -------------------------------------------------------------------------------- //
// ABSTRACTION OF WASM MEMORY INDEXING AND CARTESIAN PROJECTION MAPS
// -------------------------------------------------------------------------------- //

export function wrapTheta(theta: number): number {
    return wrapIndex(theta, 256);
}

export function fieldIndex(shape: PhaseFieldShape, tau: number, sector: number, rho: number, harmonic: number): number {
    const elementsPerLayer = shape.harmonics * shape.radialBins * shape.sectors;
    return tau * elementsPerLayer + harmonic * shape.radialBins * shape.sectors + rho * shape.sectors + sector;
}

export function getCellIndex(shape: PhaseFieldShape, tau: number, sector: number, rho: number, harmonic: number): number {
    return fieldIndex(
        shape,
        wrapIndex(tau, shape.tauDepth),
        wrapIndex(sector, shape.sectors),
        clamp(rho, 0, shape.radialBins - 1),
        wrapIndex(harmonic, shape.harmonics),
    );
}

export function projectCellToCartesian(
    sector: number,
    rho: number,
    shape: { sectors: number },
    radialScale: number,
    out: Float32Array
): void {
    const radius = (rho + 1) * radialScale;
    const radians = (sector / shape.sectors) * Math.PI * 2;
    out[0] = radius * Math.cos(radians);
    out[1] = radius * Math.sin(radians);
}

export function createPhaseField(
    shape: PhaseFieldShape,
    initializer: (tau: number, sector: number, rho: number, harmonic: number) => PhaseCell,
): PhaseField {
    const size = shape.tauDepth * shape.harmonics * shape.radialBins * shape.sectors;
    const field: PhaseField = {
        shape,
        currentTau: 0,
        theta: new Uint8Array(size),
        omega: new Int16Array(size),
        amplitude: new Uint8Array(size),
        lock: new Uint8Array(size),
        entanglement: new Uint8Array(size),
        cellStatus: new Uint8Array(size),
        plasmids: new BigUint64Array(size),
    };

    for (let tau = 0; tau < shape.tauDepth; tau++) {
        for (let harmonic = 0; harmonic < shape.harmonics; harmonic++) {
            for (let rho = 0; rho < shape.radialBins; rho++) {
                for (let sector = 0; sector < shape.sectors; sector++) {
                    const state = initializer(tau, sector, rho, harmonic);
                    const idx = fieldIndex(shape, tau, sector, rho, harmonic);
                    field.theta[idx] = wrapTheta(state.theta);
                    field.omega[idx] = clamp(Math.trunc(state.omega), PHASE_MIN_OMEGA, PHASE_MAX_OMEGA);
                    field.amplitude[idx] = clamp(Math.trunc(state.amplitude), 0, PHASE_MAX_AMPLITUDE);
                    field.lock[idx] = clamp(Math.trunc(state.lock), 0, PHASE_MAX_LOCK);
                    field.entanglement[idx] = clamp(Math.trunc(state.entanglement), 0, PHASE_MAX_ENTANGLEMENT);
                    field.cellStatus[idx] = state.cellStatus !== undefined ? state.cellStatus : 0;
                    field.plasmids[idx] = state.plasmids !== undefined ? state.plasmids : 0n;
                }
            }
        }
    }
    return field;
}

export function clonePhaseField(field: PhaseField): PhaseField {
    return {
        shape: { ...field.shape },
        currentTau: field.currentTau,
        theta: new Uint8Array(field.theta),
        omega: new Int16Array(field.omega),
        amplitude: new Uint8Array(field.amplitude),
        lock: new Uint8Array(field.lock),
        entanglement: new Uint8Array(field.entanglement),
        cellStatus: new Uint8Array(field.cellStatus),
        plasmids: new BigUint64Array(field.plasmids),
    };
}

export function sumAmplitude(field: PhaseField): number {
    let sum = 0;
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const idx = getCellIndex(field.shape, field.currentTau, sector, rho, harmonic);
                sum += field.amplitude[idx];
            }
        }
    }
    return sum;
}

export function sumEntanglement(field: PhaseField): number {
    let sum = 0;
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const idx = getCellIndex(field.shape, field.currentTau, sector, rho, harmonic);
                sum += field.entanglement[idx];
            }
        }
    }
    return sum;
}

function hashValue(value: number): bigint {
    return BigInt(value >>> 0);
}

function hashSignedValue(value: number): bigint {
    return BigInt(value >>> 0);
}

export function structuralSignature(field: PhaseField): string {
    let hash = FNV64_OFFSET_BASIS;

    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const idx = getCellIndex(field.shape, field.currentTau, sector, rho, harmonic);
                mixU64(hashValue(sector));
                mixU64(hashValue(rho));
                mixU64(hashValue(harmonic));
                mixU64(hashValue(field.theta[idx]));
                mixU64(hashSignedValue(field.omega[idx]));
                mixU64(hashValue(field.amplitude[idx]));
                mixU64(hashValue(field.lock[idx]));
                mixU64(hashValue(field.entanglement[idx]));
                mixU64(hashValue(field.cellStatus[idx]));
                mixU64(field.plasmids[idx]);
            }
        }
    }

    return hash.toString(16).padStart(16, "0");

    function mixU64(value: bigint): void {
        hash ^= value;
        hash = (hash * FNV64_PRIME) & FNV64_MASK;
    }
}

export function fieldsEqual(a: PhaseField, b: PhaseField): boolean {
    if (
        a.shape.sectors !== b.shape.sectors ||
        a.shape.radialBins !== b.shape.radialBins ||
        a.shape.harmonics !== b.shape.harmonics ||
        a.theta.length !== b.theta.length
    ) {
        return false;
    }

    for (let harmonic = 0; harmonic < a.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < a.shape.radialBins; rho++) {
            for (let sector = 0; sector < a.shape.sectors; sector++) {
                const aIdx = getCellIndex(a.shape, a.currentTau, sector, rho, harmonic);
                const bIdx = getCellIndex(b.shape, b.currentTau, sector, rho, harmonic);
                
                if (
                    a.theta[aIdx] !== b.theta[bIdx] ||
                    a.omega[aIdx] !== b.omega[bIdx] ||
                    a.amplitude[aIdx] !== b.amplitude[bIdx] ||
                    a.lock[aIdx] !== b.lock[bIdx] ||
                    a.entanglement[aIdx] !== b.entanglement[bIdx] ||
                    a.cellStatus[aIdx] !== b.cellStatus[bIdx] ||
                    a.plasmids[aIdx] !== b.plasmids[bIdx]
                ) {
                    return false;
                }
            }
        }
    }
    return true;
}

export function assertFieldBounds(field: PhaseField): void {
    for (let i = 0; i < field.theta.length; i++) {
        if (field.theta[i] < 0 || field.theta[i] >= PHASE_LUT_SIZE) {
            throw new Error(`theta out of bounds at index=${i}`);
        }
        if (field.omega[i] < PHASE_MIN_OMEGA || field.omega[i] > PHASE_MAX_OMEGA) {
            throw new Error(`omega out of bounds at index=${i}`);
        }
        if (field.amplitude[i] < 0 || field.amplitude[i] > PHASE_MAX_AMPLITUDE) {
            throw new Error(`amplitude out of bounds at index=${i}`);
        }
        if (field.lock[i] < 0 || field.lock[i] > PHASE_MAX_LOCK) {
            throw new Error(`lock out of bounds at index=${i}`);
        }
        if (field.entanglement[i] < 0 || field.entanglement[i] > PHASE_MAX_ENTANGLEMENT) {
            throw new Error(`entanglement out of bounds at index=${i}`);
        }
    }
}
