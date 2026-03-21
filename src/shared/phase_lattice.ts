import { fnv1a_64 } from "./hash.ts";
import { wrapIndex, clamp, phaseSine, phaseCosine as resonance } from "./topology_core.ts";
import { PHASE_CONSTANTS, KURAMOTO_COEFFICIENTS } from "./constants.ts";

export interface PhaseFieldShape {
    tauDepth: number;
    sectors: number;
    radialBins: number;
    harmonics: number;
}

export interface PhaseCellAddress {
    tau: number;
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
    currentTau: number;
    cells: PhaseCell[];
}

const FNV64_OFFSET_BASIS = 14695981039346656037n;
const FNV64_PRIME = 1099511628211n;
const FNV64_MASK = (1n << 64n) - 1n;

export function wrapTheta(theta: number): number {
    return wrapIndex(theta, PHASE_CONSTANTS.LUT_SIZE);
}

export function fieldIndex(shape: PhaseFieldShape, tau: number, sector: number, rho: number, harmonic: number): number {
    const elementsPerLayer = shape.harmonics * shape.radialBins * shape.sectors;
    return tau * elementsPerLayer + harmonic * shape.radialBins * shape.sectors + rho * shape.sectors + sector;
}

export function getCell(field: PhaseField, tau: number, sector: number, rho: number, harmonic: number): PhaseCell {
    return field.cells[fieldIndex(
        field.shape,
        wrapIndex(tau, field.shape.tauDepth),
        wrapIndex(sector, field.shape.sectors),
        clamp(rho, 0, field.shape.radialBins - 1),
        wrapIndex(harmonic, field.shape.harmonics),
    )];
}

export function createPhaseField(
    shape: PhaseFieldShape,
    initializer: (address: PhaseCellAddress) => Omit<PhaseCell, keyof PhaseCellAddress>,
): PhaseField {
    const cells: PhaseCell[] = [];
    for (let tau = 0; tau < shape.tauDepth; tau++) {
        for (let harmonic = 0; harmonic < shape.harmonics; harmonic++) {
            for (let rho = 0; rho < shape.radialBins; rho++) {
                for (let sector = 0; sector < shape.sectors; sector++) {
                    const address = { tau, sector, rho, harmonic };
                    const state = initializer(address);
                    cells.push({
                        ...address,
                        theta: wrapTheta(state.theta),
                        omega: clamp(Math.trunc(state.omega), PHASE_CONSTANTS.MIN_OMEGA, PHASE_CONSTANTS.MAX_OMEGA),
                        amplitude: clamp(Math.trunc(state.amplitude), 0, PHASE_CONSTANTS.MAX_AMPLITUDE),
                        lock: clamp(Math.trunc(state.lock), 0, PHASE_CONSTANTS.MAX_LOCK),
                        entanglement: clamp(Math.trunc(state.entanglement), 0, PHASE_CONSTANTS.MAX_ENTANGLEMENT),
                        cellStatus: state.cellStatus !== undefined ? state.cellStatus : 0,
                        plasmids: state.plasmids !== undefined ? state.plasmids : 0n,
                    });
                }
            }
        }
    }
    return { shape, currentTau: 0, cells };
}

export function clonePhaseField(field: PhaseField): PhaseField {
    return {
        shape: { ...field.shape },
        currentTau: field.currentTau,
        cells: field.cells.map((cell) => ({ ...cell })),
    };
}

export function rotateGlobalPhase(field: PhaseField, deltaTheta: number): PhaseField {
    const rotated = clonePhaseField(field);
    for (const cell of rotated.cells) {
        if (cell.tau === rotated.currentTau) {
            cell.theta = wrapTheta(cell.theta + deltaTheta);
        }
    }
    return rotated;
}

export function rotateAngularAddress(field: PhaseField, deltaSector: number): PhaseField {
    const rotatedCells = [...field.cells]; // Shallow copy array
    const nextTau = wrapIndex(field.currentTau + 1, field.shape.tauDepth);
    
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const currentCell = getCell(field, field.currentTau, sector, rho, harmonic);
                const nextSector = wrapIndex(sector + deltaSector, field.shape.sectors);
                const nextIndex = fieldIndex(field.shape, nextTau, nextSector, rho, harmonic);
                
                rotatedCells[nextIndex] = {
                    ...currentCell,
                    tau: nextTau,
                    sector: nextSector,
                };
            }
        }
    }
    return {
        shape: { ...field.shape },
        currentTau: nextTau,
        cells: rotatedCells,
    };
}

export function stepPhaseField(field: PhaseField): PhaseField {
    const next = clonePhaseField(field);
    const pastTau = field.currentTau;
    const nextTau = wrapIndex(field.currentTau + 1, field.shape.tauDepth);
    next.currentTau = nextTau;

    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        if (harmonic > 0) {
            // O-64 Execution Barrier: Fossilized Layers bypass thermodynamics entirely
            for (let rho = 0; rho < field.shape.radialBins; rho++) {
                for (let sector = 0; sector < field.shape.sectors; sector++) {
                    const pastCell = getCell(field, pastTau, sector, rho, harmonic);
                    const nextIndex = fieldIndex(field.shape, nextTau, sector, rho, harmonic);
                    next.cells[nextIndex] = { ...pastCell, tau: nextTau };
                }
            }
            continue;
        }

        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const current = getCell(field, pastTau, sector, rho, harmonic);
                const left = getCell(field, pastTau, sector - 1, rho, harmonic);
                const right = getCell(field, pastTau, sector + 1, rho, harmonic);
                const inner = getCell(field, pastTau, sector, rho - 1, harmonic);
                const outer = getCell(field, pastTau, sector, rho + 1, harmonic);
                const harmonicPeer = getCell(field, pastTau, sector, rho, harmonic + 1);

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
                    const antipode = getCell(field, pastTau, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeWeight = (current.entanglement / 255) * 0.35;
                    kuramoto += phaseSine(current.theta, antipode.theta) * antipodeWeight;
                    coherence += resonance(current.theta, antipode.theta) * antipodeWeight;
                }

                // O-130: Plasmid-Field Bridge
                if (current.plasmids !== 0n) {
                    const targetTheta = Number(current.plasmids & 255n);
                    kuramoto += phaseSine(current.theta, targetTheta) * KURAMOTO_COEFFICIENTS.COUPLING_PLASMID;
                    coherence += resonance(current.theta, targetTheta) * KURAMOTO_COEFFICIENTS.COUPLING_PLASMID;
                }

                const omegaDelta = Math.round(kuramoto);
                const amplitudeDelta = Math.round(coherence * 6) - Math.floor(current.lock / 64);
                const lockDelta = coherence >= 3 ? 8 : -4;

                const nextAmplitude = clamp(current.amplitude + amplitudeDelta, 0, PHASE_CONSTANTS.MAX_AMPLITUDE);
                const nextLock = clamp(current.lock + lockDelta, 0, PHASE_CONSTANTS.MAX_LOCK);
                let nextTheta = wrapTheta(current.theta + current.omega + omegaDelta);
                let nextOmega = clamp(current.omega + omegaDelta, PHASE_CONSTANTS.MIN_OMEGA, PHASE_CONSTANTS.MAX_OMEGA);
                let adopted = false;

                let nextPlasmid = current.plasmids;

                if (nextAmplitude < 40) {
                    nextPlasmid = 0n;
                }

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
                        nextOmega = clamp(donorOmega, PHASE_CONSTANTS.MIN_OMEGA, PHASE_CONSTANTS.MAX_OMEGA);
                        nextPlasmid = donorPlasmid;
                        adopted = true;
                    }
                }

                let nextCellStatus = current.cellStatus;
                if (!adopted && nextAmplitude < 20 && nextLock < 10) {
                    // Cannot easily track oracleRequestCount in TS, but logically it just freezes the cell.
                    // We will not implement the queue array in TS, just the status freeze.
                    nextCellStatus = 1;
                }

                let nextEntanglement = current.entanglement;
                if (field.shape.sectors % 2 === 0) {
                    const antipode = getCell(field, pastTau, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeAlignment = resonance(current.theta, antipode.theta);
                    nextEntanglement =
                        antipodeAlignment > 0.92 && current.amplitude > 96
                            ? clamp(current.entanglement + 8, 0, PHASE_CONSTANTS.MAX_ENTANGLEMENT)
                            : clamp(current.entanglement - 3, 0, PHASE_CONSTANTS.MAX_ENTANGLEMENT);
                }

                const nextIndex = fieldIndex(field.shape, nextTau, sector, rho, harmonic);
                next.cells[nextIndex] = {
                    ...current,
                    tau: nextTau,
                    theta: nextTheta,
                    omega: nextOmega,
                    amplitude: nextAmplitude,
                    lock: nextLock,
                    entanglement: nextEntanglement,
                    cellStatus: nextCellStatus,
                    plasmids: nextPlasmid
                };
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

    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const cell = getCell(field, field.currentTau, sector, rho, harmonic);
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
        a.cells.length !== b.cells.length
    ) {
        return false;
    }

    for (let harmonic = 0; harmonic < a.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < a.shape.radialBins; rho++) {
            for (let sector = 0; sector < a.shape.sectors; sector++) {
                const left = getCell(a, a.currentTau, sector, rho, harmonic);
                const right = getCell(b, b.currentTau, sector, rho, harmonic);
                
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
        }
    }

    return true;
}

export function assertFieldBounds(field: PhaseField): void {
    for (const cell of field.cells) {
        if (cell.theta < 0 || cell.theta >= PHASE_CONSTANTS.LUT_SIZE) {
            throw new Error(`theta out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.omega < PHASE_CONSTANTS.MIN_OMEGA || cell.omega > PHASE_CONSTANTS.MAX_OMEGA) {
            throw new Error(`omega out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.amplitude < 0 || cell.amplitude > PHASE_CONSTANTS.MAX_AMPLITUDE) {
            throw new Error(`amplitude out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.lock < 0 || cell.lock > PHASE_CONSTANTS.MAX_LOCK) {
            throw new Error(`lock out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
        if (cell.entanglement < 0 || cell.entanglement > PHASE_CONSTANTS.MAX_ENTANGLEMENT) {
            throw new Error(`entanglement out of bounds at sector=${cell.sector}, rho=${cell.rho}, harmonic=${cell.harmonic}`);
        }
    }
}

export function fossilizePhaseField(field: PhaseField): PhaseField {
    if (field.shape.harmonics <= 1) return field;
    
    const next = clonePhaseField(field);
    
    for (let harmonic = field.shape.harmonics - 1; harmonic > 0; harmonic--) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const source = getCell(field, field.currentTau, sector, rho, harmonic - 1);
                const nextIndex = fieldIndex(field.shape, field.currentTau, sector, rho, harmonic);
                const target = next.cells[nextIndex];
                
                target.theta = source.theta;
                target.omega = source.omega;
                target.amplitude = source.amplitude;
                target.lock = source.lock;
                target.entanglement = source.entanglement;
                target.plasmids = source.plasmids;
                target.cellStatus = source.cellStatus;
            }
        }
    }
    
    return next;
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
    let sum = 0;
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                sum += getCell(field, field.currentTau, sector, rho, harmonic).amplitude;
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
                sum += getCell(field, field.currentTau, sector, rho, harmonic).entanglement;
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
