import { wrapIndex, clamp, phaseSine, phaseCosine as resonance } from "./topology_core.ts";
import { PHASE_CONSTANTS, KURAMOTO_COEFFICIENTS } from "./constants.ts";

export interface PhaseFieldShape {
    tauDepth: number;
    sectors: number;
    radialBins: number;
    harmonics: number;
}

export interface PhaseField {
    shape: PhaseFieldShape;
    currentTau: number;
    theta: Uint8Array;
    omega: Int16Array;
    amplitude: Uint8Array;
    lock: Uint8Array;
    entanglement: Uint8Array;
    cellStatus: Uint8Array;
    plasmids: BigUint64Array;
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

export function getCellIndex(shape: PhaseFieldShape, tau: number, sector: number, rho: number, harmonic: number): number {
    return fieldIndex(
        shape,
        wrapIndex(tau, shape.tauDepth),
        wrapIndex(sector, shape.sectors),
        clamp(rho, 0, shape.radialBins - 1),
        wrapIndex(harmonic, shape.harmonics),
    );
}

export function createPhaseField(
    shape: PhaseFieldShape,
    initializer: (tau: number, sector: number, rho: number, harmonic: number) => {
        theta: number;
        omega: number;
        amplitude: number;
        lock: number;
        entanglement: number;
        cellStatus?: number;
        plasmids?: bigint;
    },
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
                    field.omega[idx] = clamp(Math.trunc(state.omega), PHASE_CONSTANTS.MIN_OMEGA, PHASE_CONSTANTS.MAX_OMEGA);
                    field.amplitude[idx] = clamp(Math.trunc(state.amplitude), 0, PHASE_CONSTANTS.MAX_AMPLITUDE);
                    field.lock[idx] = clamp(Math.trunc(state.lock), 0, PHASE_CONSTANTS.MAX_LOCK);
                    field.entanglement[idx] = clamp(Math.trunc(state.entanglement), 0, PHASE_CONSTANTS.MAX_ENTANGLEMENT);
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


export function rotateGlobalPhase(field: PhaseField, deltaTheta: number): void {
    for (let i = 0; i < field.theta.length; i++) {
        field.theta[i] = wrapTheta(field.theta[i] + deltaTheta);
    }
}

export function rotateAngularAddress(field: PhaseField, deltaSector: number): void {
    const thetaClone = new Uint8Array(field.theta);
    const omegaClone = new Int16Array(field.omega);
    const amplitudeClone = new Uint8Array(field.amplitude);
    const lockClone = new Uint8Array(field.lock);
    const entanglementClone = new Uint8Array(field.entanglement);
    const cellStatusClone = new Uint8Array(field.cellStatus);
    const plasmidsClone = new BigUint64Array(field.plasmids);

    for (let tau = 0; tau < field.shape.tauDepth; tau++) {
        for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
            for (let rho = 0; rho < field.shape.radialBins; rho++) {
                for (let sector = 0; sector < field.shape.sectors; sector++) {
                    const source = getCellIndex(field.shape, tau, sector, rho, harmonic);
                    const targetSector = wrapIndex(sector + deltaSector, field.shape.sectors);
                    const target = getCellIndex(field.shape, tau, targetSector, rho, harmonic);

                    field.theta[target] = thetaClone[source];
                    field.omega[target] = omegaClone[source];
                    field.amplitude[target] = amplitudeClone[source];
                    field.lock[target] = lockClone[source];
                    field.entanglement[target] = entanglementClone[source];
                    field.cellStatus[target] = cellStatusClone[source];
                    field.plasmids[target] = plasmidsClone[source];
                }
            }
        }
    }
}

export function stepPhaseField(field: PhaseField): void {
    const pastTau = field.currentTau;
    const nextTau = wrapIndex(field.currentTau + 1, field.shape.tauDepth);
    field.currentTau = nextTau;

    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        if (harmonic > 0) {
            for (let rho = 0; rho < field.shape.radialBins; rho++) {
                for (let sector = 0; sector < field.shape.sectors; sector++) {
                    const pastIndex = getCellIndex(field.shape, pastTau, sector, rho, harmonic);
                    const nextIndex = getCellIndex(field.shape, nextTau, sector, rho, harmonic);
                    
                    field.theta[nextIndex] = field.theta[pastIndex];
                    field.omega[nextIndex] = field.omega[pastIndex];
                    field.amplitude[nextIndex] = field.amplitude[pastIndex];
                    field.lock[nextIndex] = field.lock[pastIndex];
                    field.entanglement[nextIndex] = field.entanglement[pastIndex];
                    field.cellStatus[nextIndex] = field.cellStatus[pastIndex];
                    field.plasmids[nextIndex] = field.plasmids[pastIndex];
                }
            }
            continue;
        }

        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const curIdx = getCellIndex(field.shape, pastTau, sector, rho, harmonic);
                const leftIdx = getCellIndex(field.shape, pastTau, sector - 1, rho, harmonic);
                const rightIdx = getCellIndex(field.shape, pastTau, sector + 1, rho, harmonic);
                const innerIdx = getCellIndex(field.shape, pastTau, sector, rho - 1, harmonic);
                const outerIdx = getCellIndex(field.shape, pastTau, sector, rho + 1, harmonic);
                const harmonicPeerIdx = getCellIndex(field.shape, pastTau, sector, rho, harmonic + 1);

                const historicalTau = (pastTau + field.shape.tauDepth - 1) % field.shape.tauDepth;
                const historicalPeerIdx = getCellIndex(field.shape, historicalTau, sector, rho, harmonic);

                const cTheta = field.theta[curIdx];
                const cOmega = field.omega[curIdx];
                const cAmplitude = field.amplitude[curIdx];
                const cLock = field.lock[curIdx];
                const cEntanglement = field.entanglement[curIdx];
                const cCellStatus = field.cellStatus[curIdx];
                const cPlasmids = field.plasmids[curIdx];

                let kuramoto = 0;
                kuramoto += phaseSine(cTheta, field.theta[leftIdx]);
                kuramoto += phaseSine(cTheta, field.theta[rightIdx]);
                kuramoto += phaseSine(cTheta, field.theta[innerIdx]);
                kuramoto += phaseSine(cTheta, field.theta[outerIdx]);
                kuramoto += Math.trunc(phaseSine(cTheta, field.theta[harmonicPeerIdx]) / 2);
                kuramoto += Math.trunc((phaseSine(cTheta, field.theta[historicalPeerIdx]) * 3) / 10);

                let coherence = 0;
                coherence += resonance(cTheta, field.theta[leftIdx]);
                coherence += resonance(cTheta, field.theta[rightIdx]);
                coherence += resonance(cTheta, field.theta[innerIdx]);
                coherence += resonance(cTheta, field.theta[outerIdx]);
                coherence += Math.trunc(resonance(cTheta, field.theta[harmonicPeerIdx]) / 2);
                coherence += Math.trunc((resonance(cTheta, field.theta[historicalPeerIdx]) * 3) / 10);

                if (field.shape.sectors % 2 === 0) {
                    const antipodeIdx = getCellIndex(field.shape, pastTau, sector + field.shape.sectors / 2, rho, harmonic);
                    kuramoto += Math.trunc((phaseSine(cTheta, field.theta[antipodeIdx]) * cEntanglement * 35) / 25500);
                    coherence += Math.trunc((resonance(cTheta, field.theta[antipodeIdx]) * cEntanglement * 35) / 25500);
                }

                // O-130: Plasmid-Field Bridge
                if (cPlasmids !== 0n) {
                    const targetTheta = Number(cPlasmids & 255n);
                    const couplingPlasmid1024 = Math.trunc(KURAMOTO_COEFFICIENTS.COUPLING_PLASMID * 1024);
                    kuramoto += Math.trunc((phaseSine(cTheta, targetTheta) * couplingPlasmid1024) / 1024);
                    coherence += Math.trunc((resonance(cTheta, targetTheta) * couplingPlasmid1024) / 1024);
                }

                const omegaDelta = Math.trunc(kuramoto / 1024);
                const amplitudeDelta = Math.trunc((coherence * 6) / 1024) - Math.floor(cLock / 64);
                const lockDelta = coherence >= 3072 ? 8 : -4;

                const nextAmplitude = clamp(cAmplitude + amplitudeDelta, 0, PHASE_CONSTANTS.MAX_AMPLITUDE);
                const nextLock = clamp(cLock + lockDelta, 0, PHASE_CONSTANTS.MAX_LOCK);
                let nextTheta = wrapTheta(cTheta + cOmega + omegaDelta);
                let nextOmega = clamp(cOmega + omegaDelta, PHASE_CONSTANTS.MIN_OMEGA, PHASE_CONSTANTS.MAX_OMEGA);
                let adopted = false;

                let nextPlasmid = cPlasmids;

                if (nextAmplitude < 40) {
                    nextPlasmid = 0n;
                }

                let bestResonance = -2048;
                
                if (nextAmplitude < 140) {
                    const neighborsIdx = [leftIdx, rightIdx, innerIdx, outerIdx, harmonicPeerIdx];
                    let donorPlasmid = 0n;

                    for (const neighborIdx of neighborsIdx) {
                        const candidatePlasmid = field.plasmids[neighborIdx];
                        if (candidatePlasmid === 0n) continue;
                        const candidateResonance = resonance(cTheta, field.theta[neighborIdx]);
                        if (candidateResonance > bestResonance) {
                            bestResonance = candidateResonance;
                            donorPlasmid = candidatePlasmid;
                        }
                    }

                    if (donorPlasmid !== 0n && bestResonance > 614) { // 0.6 * 1024
                        nextTheta = Number(donorPlasmid & 255n);
                        const donorOmega = Number((donorPlasmid >> 8n) & 255n) - 128;
                        nextOmega = clamp(donorOmega, PHASE_CONSTANTS.MIN_OMEGA, PHASE_CONSTANTS.MAX_OMEGA);
                        nextPlasmid = donorPlasmid;
                        adopted = true;
                    }
                }

                let nextCellStatus = cCellStatus > 0 ? cCellStatus - 1 : 0;
                if (!adopted && cCellStatus === 0 && kuramoto < 100 && bestResonance > 500) {
                    // field.oracleRequests[field.oracleRequestCount] = pastIndex; // This line is commented out in the original, but was in the snippet. Assuming it's not meant to be added.
                    // field.oracleRequestCount++; // Same as above.
                    nextCellStatus = 240;
                }

                if (nextAmplitude < 15 && nextPlasmid !== 0n) {
                    if (nextTheta % 4 === 0) {
                        nextPlasmid = 0n;
                    }
                }

                let nextEntanglement = cEntanglement;
                if (field.shape.sectors % 2 === 0) {
                    const antipodeIdx = getCellIndex(field.shape, pastTau, sector + field.shape.sectors / 2, rho, harmonic);
                    const antipodeAlignment = resonance(cTheta, field.theta[antipodeIdx]);
                    nextEntanglement =
                        antipodeAlignment > 942 && cAmplitude > 96 // 0.92 * 1024
                            ? clamp(cEntanglement + 8, 0, PHASE_CONSTANTS.MAX_ENTANGLEMENT)
                            : clamp(cEntanglement - 3, 0, PHASE_CONSTANTS.MAX_ENTANGLEMENT);
                }

                const nextIndex = fieldIndex(field.shape, nextTau, sector, rho, harmonic);
                
                field.theta[nextIndex] = nextTheta;
                field.omega[nextIndex] = nextOmega;
                field.amplitude[nextIndex] = nextAmplitude;
                field.lock[nextIndex] = nextLock;
                field.entanglement[nextIndex] = nextEntanglement;
                field.cellStatus[nextIndex] = nextCellStatus;
                field.plasmids[nextIndex] = nextPlasmid;
            }
        }
    }
}

export function runPhaseField(field: PhaseField, ticks: number): PhaseField {
    const current = clonePhaseField(field);

    for (let i = 0; i < ticks; i++) {
        stepPhaseField(current);
    }
    return current;
}

export function fieldSignature(field: PhaseField): string {
    let hash = FNV64_OFFSET_BASIS;

    for (let tau = 0; tau < field.shape.tauDepth; tau++) {
        for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
            for (let rho = 0; rho < field.shape.radialBins; rho++) {
                for (let sector = 0; sector < field.shape.sectors; sector++) {
                    const idx = fieldIndex(field.shape, tau, sector, rho, harmonic);
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
    }

    return hash.toString(16).padStart(16, "0");

    function mixU64(value: bigint): void {
        hash ^= value;
        hash = (hash * FNV64_PRIME) & FNV64_MASK;
    }
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
        if (field.theta[i] < 0 || field.theta[i] >= PHASE_CONSTANTS.LUT_SIZE) {
            throw new Error(`theta out of bounds at index=${i}`);
        }
        if (field.omega[i] < PHASE_CONSTANTS.MIN_OMEGA || field.omega[i] > PHASE_CONSTANTS.MAX_OMEGA) {
            throw new Error(`omega out of bounds at index=${i}`);
        }
        if (field.amplitude[i] < 0 || field.amplitude[i] > PHASE_CONSTANTS.MAX_AMPLITUDE) {
            throw new Error(`amplitude out of bounds at index=${i}`);
        }
        if (field.lock[i] < 0 || field.lock[i] > PHASE_CONSTANTS.MAX_LOCK) {
            throw new Error(`lock out of bounds at index=${i}`);
        }
        if (field.entanglement[i] < 0 || field.entanglement[i] > PHASE_CONSTANTS.MAX_ENTANGLEMENT) {
            throw new Error(`entanglement out of bounds at index=${i}`);
        }
    }
}

export function projectCellToCartesian(
    sector: number,
    rho: number,
    shape: PhaseFieldShape,
    radialScale: number,
    out: Float32Array
): void {
    const radius = (rho + 1) * radialScale;
    const radians = (sector / shape.sectors) * Math.PI * 2;
    out[0] = radius * Math.cos(radians);
    out[1] = radius * Math.sin(radians);
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

export function fossilizePhaseField(field: PhaseField): void {
    if (field.shape.harmonics <= 1) return;
    
    for (let harmonic = field.shape.harmonics - 1; harmonic > 0; harmonic--) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors; sector++) {
                const sourceIdx = getCellIndex(field.shape, field.currentTau, sector, rho, harmonic - 1);
                const nextIdx = fieldIndex(field.shape, field.currentTau, sector, rho, harmonic);
                
                field.theta[nextIdx] = field.theta[sourceIdx];
                field.omega[nextIdx] = field.omega[sourceIdx];
                field.amplitude[nextIdx] = field.amplitude[sourceIdx];
                field.lock[nextIdx] = field.lock[sourceIdx];
                field.entanglement[nextIdx] = field.entanglement[sourceIdx];
                field.plasmids[nextIdx] = field.plasmids[sourceIdx];
                field.cellStatus[nextIdx] = field.cellStatus[sourceIdx];
            }
        }
    }
}
