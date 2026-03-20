import { fnv1a_64 } from "./hash.ts";

export const PHASE_LUT_SIZE = 256;
export const MAX_AMPLITUDE = 255;
export const MAX_LOCK = 255;
export const MAX_ENTANGLEMENT = 255;
export const MIN_OMEGA = -16;
export const MAX_OMEGA = 16;

export interface PhaseFieldShape {
    sectors: number;
    radialBins: number;
    harmonics: number;
}

export interface PhaseCellAddress {
    sector: number;
    rho: number;
    harmonic: number;
}

export interface PhaseCell extends PhaseCellAddress {
    theta: number;
    omega: number;
    amplitude: number;
    lock: number;
    entanglement: number;
    cellStatus: number;
    plasmids: bigint;
}

export interface PhaseField {
    shape: PhaseFieldShape;
    cells: PhaseCell[];
}

const FNV64_OFFSET_BASIS = 14695981039346656037n;
const FNV64_PRIME = 1099511628211n;
const FNV64_MASK = (1n << 64n) - 1n;

export function wrapIndex(value: number, modulo: number): number {
    return ((value % modulo) + modulo) % modulo;
}

export function wrapTheta(theta: number): number {
    return wrapIndex(theta, PHASE_LUT_SIZE);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function fieldIndex(shape: PhaseFieldShape, sector: number, rho: number, harmonic: number): number {
    return harmonic * shape.radialBins * shape.sectors + rho * shape.sectors + sector;
}

export function getCell(field: PhaseField, sector: number, rho: number, harmonic: number): PhaseCell {
    return field.cells[fieldIndex(
        field.shape,
        wrapIndex(sector, field.shape.sectors),
        clamp(rho, 0, field.shape.radialBins - 1),
        wrapIndex(harmonic, field.shape.harmonics),
    )];
}

export function signedPhaseDelta(fromTheta: number, toTheta: number): number {
    const delta = wrapTheta(toTheta - fromTheta);
    return delta > PHASE_LUT_SIZE / 2 ? delta - PHASE_LUT_SIZE : delta;
}

export function phaseDistance(a: number, b: number): number {
    return Math.abs(signedPhaseDelta(a, b));
}

export function resonance(a: number, b: number): number {
    const radians = (signedPhaseDelta(a, b) / PHASE_LUT_SIZE) * Math.PI * 2;
    return Math.cos(radians);
}

export function phaseSine(a: number, b: number): number {
    const radians = (signedPhaseDelta(a, b) / PHASE_LUT_SIZE) * Math.PI * 2;
    return Math.sin(radians);
}

export function createPhaseField(
    shape: PhaseFieldShape,
    initializer: (address: PhaseCellAddress) => Omit<PhaseCell, keyof PhaseCellAddress>,
): PhaseField {
    const cells: PhaseCell[] = [];
    for (let harmonic = 0; harmonic < shape.harmonics; harmonic++) {
        for (let rho = 0; rho < shape.radialBins; rho++) {
            for (let sector = 0; sector < shape.sectors; sector++) {
                const address = { sector, rho, harmonic };
                const state = initializer(address);
                cells.push({
                    ...address,
                    theta: wrapTheta(state.theta),
                    omega: clamp(Math.trunc(state.omega), MIN_OMEGA, MAX_OMEGA),
                    amplitude: clamp(Math.trunc(state.amplitude), 0, MAX_AMPLITUDE),
                    lock: clamp(Math.trunc(state.lock), 0, MAX_LOCK),
                    entanglement: clamp(Math.trunc(state.entanglement), 0, MAX_ENTANGLEMENT),
                    cellStatus: state.cellStatus !== undefined ? state.cellStatus : 0,
                    plasmids: state.plasmids !== undefined ? state.plasmids : 0n,
                });
            }
        }
    }
    return { shape, cells };
}

export function clonePhaseField(field: PhaseField): PhaseField {
    return {
        shape: { ...field.shape },
        cells: field.cells.map((cell) => ({ ...cell })),
    };
}

export function rotateGlobalPhase(field: PhaseField, deltaTheta: number): PhaseField {
    const rotated = clonePhaseField(field);
    for (const cell of rotated.cells) {
        cell.theta = wrapTheta(cell.theta + deltaTheta);
    }
    return rotated;
}

export function rotateAngularAddress(field: PhaseField, deltaSector: number): PhaseField {
    const rotatedCells = new Array<PhaseCell>(field.cells.length);
    for (const cell of field.cells) {
        const nextSector = wrapIndex(cell.sector + deltaSector, field.shape.sectors);
        const nextIndex = fieldIndex(field.shape, nextSector, cell.rho, cell.harmonic);
        rotatedCells[nextIndex] = {
            ...cell,
            sector: nextSector,
        };
    }
    return {
        shape: { ...field.shape },
        cells: rotatedCells,
    };
}

export function stepPhaseField(field: PhaseField): PhaseField {
    const next = clonePhaseField(field);
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const current = getCell(field, sector, rho, harmonic);
                const left = getCell(field, sector - 1, rho, harmonic);
                const right = getCell(field, sector + 1, rho, harmonic);
                const inner = getCell(field, sector, rho - 1, harmonic);
                const outer = getCell(field, sector, rho + 1, harmonic);
                const harmonicPeer = getCell(field, sector, rho, harmonic + 1);

                let kuramoto =
                    phaseSine(current.theta, left.theta) +
                    phaseSine(current.theta, right.theta) +
                    phaseSine(current.theta, inner.theta) +
                    phaseSine(current.theta, outer.theta) +
                    phaseSine(current.theta, harmonicPeer.theta) * 0.5;

                let coherence =
                    resonance(current.theta, left.theta) +
                    resonance(current.theta, right.theta) +
                    resonance(current.theta, inner.theta) +
                    resonance(current.theta, outer.theta) +
                    resonance(current.theta, harmonicPeer.theta) * 0.5;

                if (field.shape.sectors % 2 === 0) {
                    const antipode = getCell(field, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeWeight = (current.entanglement / 255) * 0.35;
                    kuramoto += phaseSine(current.theta, antipode.theta) * antipodeWeight;
                    coherence += resonance(current.theta, antipode.theta) * antipodeWeight;
                }

                const omegaDelta = Math.round(kuramoto);
                const amplitudeDelta = Math.round(coherence * 6) - Math.floor(current.lock / 64);
                const lockDelta = coherence >= 3 ? 8 : -4;

                const nextCell = getCell(next, sector, rho, harmonic);
                let nextAmplitude = clamp(current.amplitude + amplitudeDelta, 0, MAX_AMPLITUDE);
                let nextLock = clamp(current.lock + lockDelta, 0, MAX_LOCK);
                let nextTheta = wrapTheta(current.theta + current.omega + omegaDelta);
                let nextOmega = clamp(current.omega + omegaDelta, MIN_OMEGA, MAX_OMEGA);
                let adopted = false;

                if (nextAmplitude < 140) {
                    const neighbors = [left, right, inner, outer, harmonicPeer];
                    let bestResonance = -2.0;
                    let donorPlasmid = 0n;

                    for (const neighbor of neighbors) {
                        const candidatePlasmid = neighbor.plasmids;
                        if (candidatePlasmid === 0n) continue;
                        const candidateResonance = resonance(current.theta, neighbor.theta);
                        if (candidateResonance > bestResonance) {
                            bestResonance = candidateResonance;
                            donorPlasmid = candidatePlasmid;
                        }
                    }

                    if (donorPlasmid !== 0n && bestResonance > 0.6) {
                        nextTheta = Number(donorPlasmid & 255n);
                        const donorOmega = Number((donorPlasmid >> 8n) & 255n) - 128;
                        nextOmega = clamp(donorOmega, MIN_OMEGA, MAX_OMEGA);
                        nextCell.plasmids = donorPlasmid;
                        adopted = true;
                    }
                }

                if (!adopted && nextAmplitude < 20 && nextLock < 10) {
                    // Cannot easily track oracleRequestCount in TS, but logically it just freezes the cell.
                    // We will not implement the queue array in TS, just the status freeze.
                    nextCell.cellStatus = 1;
                }

                if (nextAmplitude < 15 && current.plasmids !== 0n && nextTheta % 4 === 0) {
                    nextCell.plasmids = 0n;
                }

                if (!adopted) {
                    nextCell.theta = nextTheta;
                    nextCell.omega = nextOmega;
                } else {
                    nextCell.theta = nextTheta;
                    nextCell.omega = nextOmega;
                }
                
                nextCell.amplitude = nextAmplitude;
                nextCell.lock = nextLock;

                if (field.shape.sectors % 2 === 0) {
                    const antipode = getCell(field, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeAlignment = resonance(current.theta, antipode.theta);
                    nextCell.entanglement =
                        antipodeAlignment > 0.92 && current.amplitude > 96
                            ? clamp(current.entanglement + 8, 0, MAX_ENTANGLEMENT)
                            : clamp(current.entanglement - 3, 0, MAX_ENTANGLEMENT);
                } else {
                    nextCell.entanglement = current.entanglement;
                }
            }
        }
    }
    return next;
}

export function runPhaseField(field: PhaseField, ticks: number): PhaseField {
    let current = clonePhaseField(field);
    for (let i = 0; i < ticks; i++) {
        current = stepPhaseField(current);
    }
    return current;
}

export function fieldSignature(field: PhaseField): string {
    const payload = field.cells.map((cell) => [
        cell.sector,
        cell.rho,
        cell.harmonic,
        cell.theta,
        cell.omega,
        cell.amplitude,
        cell.lock,
        cell.entanglement,
        cell.cellStatus,
        cell.plasmids.toString(),
    ]);
    return fnv1a_64(JSON.stringify(payload)).toString(16);
}

export function structuralSignature(field: PhaseField): string {
    let hash = FNV64_OFFSET_BASIS;

    for (const cell of field.cells) {
        mixU64(hashValue(cell.sector));
        mixU64(hashValue(cell.rho));
        mixU64(hashValue(cell.harmonic));
        mixU64(hashValue(cell.theta));
        mixU64(hashSignedValue(cell.omega));
        mixU64(hashValue(cell.amplitude));
        mixU64(hashValue(cell.lock));
        mixU64(hashValue(cell.entanglement));
        mixU64(hashValue(cell.cellStatus));
        mixU64(cell.plasmids);
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
        a.cells.length !== b.cells.length
    ) {
        return false;
    }

    for (let i = 0; i < a.cells.length; i++) {
        const left = a.cells[i];
        const right = b.cells[i];
        if (
            left.sector !== right.sector ||
            left.rho !== right.rho ||
            left.harmonic !== right.harmonic ||
            left.theta !== right.theta ||
            left.omega !== right.omega ||
            left.amplitude !== right.amplitude ||
            left.lock !== right.lock ||
            left.entanglement !== right.entanglement ||
            left.cellStatus !== right.cellStatus ||
            left.plasmids !== right.plasmids
        ) {
            return false;
        }
    }

    return true;
}

export function assertFieldBounds(field: PhaseField): void {
    for (const cell of field.cells) {
        if (cell.theta < 0 || cell.theta >= PHASE_LUT_SIZE) {
            throw new Error(`theta out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.omega < MIN_OMEGA || cell.omega > MAX_OMEGA) {
            throw new Error(`omega out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.amplitude < 0 || cell.amplitude > MAX_AMPLITUDE) {
            throw new Error(`amplitude out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.lock < 0 || cell.lock > MAX_LOCK) {
            throw new Error(`lock out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.entanglement < 0 || cell.entanglement > MAX_ENTANGLEMENT) {
            throw new Error(`entanglement out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
    }
}

export function projectCellToCartesian(
    cell: PhaseCell,
    shape: PhaseFieldShape,
    radialScale = 1,
): { x: number; y: number } {
    const radius = (cell.rho + 1) * radialScale;
    const radians = (cell.sector / shape.sectors) * Math.PI * 2;
    return {
        x: radius * Math.cos(radians),
        y: radius * Math.sin(radians),
    };
}

export function sumAmplitude(field: PhaseField): number {
    return field.cells.reduce((acc, cell) => acc + cell.amplitude, 0);
}

export function sumEntanglement(field: PhaseField): number {
    return field.cells.reduce((acc, cell) => acc + cell.entanglement, 0);
}

function hashValue(value: number): bigint {
    return BigInt(value >>> 0);
}

function hashSignedValue(value: number): bigint {
    return BigInt(value >>> 0);
}
