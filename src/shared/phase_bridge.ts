import { buildProjectedBridgeSeed, CANONICAL_PHASE_SHAPE } from "./phase_canonical.ts";
import { wrapIndex, wrapTheta } from "./phase_lattice.ts";

const BRIDGE_FNV64_OFFSET_BASIS = 14695981039346656037n;
const BRIDGE_FNV64_PRIME = 1099511628211n;
const BRIDGE_FNV64_MASK = (1n << 64n) - 1n;
const BRIDGE_ZERO_LUT = new Int16Array(256);
const BRIDGE_DELTAS = [1, 2, 3, 4] as const;
const BRIDGE_MAX_OMEGA = 32;
const BRIDGE_PHASE_SCALE = Math.fround(Math.fround(Math.PI * 2) / 256);
const BRIDGE_ACTIVE_RADIAL_BINS = CANONICAL_PHASE_SHAPE.radialBins;
const BRIDGE_ADOPTION_RESONANCE_THRESHOLD = 0.6;
const BRIDGE_COHERENCE_ENERGY_GAIN = 6;
const BRIDGE_LOCK_PENALTY_DIVISOR = 64;
const BRIDGE_LOCK_GAIN = 8;
const BRIDGE_LOCK_DECAY = 4;
const BRIDGE_BOUNDARY_ENERGY_BONUS = 0;
const BRIDGE_BOUNDARY_LOCK_BONUS = 1;
const BRIDGE_DEPTH1_SUSTAINED_ENERGY_BONUS = 2;
const BRIDGE_DEPTH2_LOCK_THRESHOLD = Math.fround(2.5);


export interface BridgeField {
    width: number;
    height: number;
    thetaNow: Uint8Array;
    thetaF1: Uint8Array;
    thetaF2: Uint8Array;
    thetaF3: Uint8Array;
    omega: Uint8Array;
    energy: Uint8Array;
    plasmids: BigUint64Array;
    hebbianLocks: Uint8Array;
    oracleRequests: Uint32Array;
    oracleRequestCount: number;
    cellStatus: Uint8Array;
}

export function buildBridgeSeed(width: number, height: number): BridgeField {
    const size = width * height;
    const projected = buildProjectedBridgeSeed(width, height);
    const thetaNow = new Uint8Array(size);
    const thetaF1 = new Uint8Array(size);
    const thetaF2 = new Uint8Array(size);
    const thetaF3 = new Uint8Array(size);
    const omega = new Uint8Array(size);
    const energy = new Uint8Array(size);
    const plasmids = new BigUint64Array(size);
    const hebbianLocks = new Uint8Array(size);
    const oracleRequests = new Uint32Array(1024);
    const cellStatus = new Uint8Array(size);

    for (const cell of projected.cells) {
        const index = bridgeIndex(width, cell.sector, cell.rho);
        thetaNow[index] = cell.theta;
        omega[index] = encodeBridgeOmega(cell.omega);
        energy[index] = clampByte(cell.amplitude);
        hebbianLocks[index] = clampByte(cell.lock);
        cellStatus[index] = 0;
    }

    for (let rho = 0; rho < height; rho++) {
        for (let sector = 0; sector < width; sector++) {
            const index = bridgeIndex(width, sector, rho);
            const leftIndex = bridgeIndex(width, wrapIndex(sector - 1, width), rho);
            const rightIndex = bridgeIndex(width, wrapIndex(sector + 1, width), rho);

            thetaF1[index] = thetaNow[leftIndex];
            thetaF2[index] = thetaNow[rightIndex];
            thetaF3[index] = thetaNow[index];
        }
    }

    return {
        width,
        height,
        thetaNow,
        thetaF1,
        thetaF2,
        thetaF3,
        omega,
        energy,
        plasmids,
        hebbianLocks,
        oracleRequests,
        oracleRequestCount: 0,
        cellStatus,
    };
}

export function cloneBridgeField(field: BridgeField): BridgeField {
    return {
        width: field.width,
        height: field.height,
        thetaNow: new Uint8Array(field.thetaNow),
        thetaF1: new Uint8Array(field.thetaF1),
        thetaF2: new Uint8Array(field.thetaF2),
        thetaF3: new Uint8Array(field.thetaF3),
        omega: new Uint8Array(field.omega),
        energy: new Uint8Array(field.energy),
        plasmids: new BigUint64Array(field.plasmids),
        hebbianLocks: new Uint8Array(field.hebbianLocks),
        oracleRequests: new Uint32Array(field.oracleRequests),
        oracleRequestCount: field.oracleRequestCount,
        cellStatus: new Uint8Array(field.cellStatus),
    };
}

export function rotateBridgeField(field: BridgeField, delta: number): BridgeField {
    const rotated = cloneBridgeField(field);
    const size = field.width * field.height;
    rotated.thetaNow = new Uint8Array(size);
    rotated.thetaF1 = new Uint8Array(size);
    rotated.thetaF2 = new Uint8Array(size);
    rotated.thetaF3 = new Uint8Array(size);
    rotated.omega = new Uint8Array(size);
    rotated.energy = new Uint8Array(size);
    rotated.hebbianLocks = new Uint8Array(size);
    rotated.plasmids = new BigUint64Array(size);
    rotated.cellStatus = new Uint8Array(size);

    for (let rho = 0; rho < field.height; rho++) {
        for (let sector = 0; sector < field.width; sector++) {
            const source = bridgeIndex(field.width, sector, rho);
            const targetSector = wrapIndex(sector + delta, field.width);
            const target = bridgeIndex(field.width, targetSector, rho);

            rotated.thetaNow[target] = field.thetaNow[source];
            rotated.thetaF1[target] = field.thetaF1[source];
            rotated.thetaF2[target] = field.thetaF2[source];
            rotated.thetaF3[target] = field.thetaF3[source];
            rotated.omega[target] = field.omega[source];
            rotated.energy[target] = field.energy[source];
            rotated.hebbianLocks[target] = field.hebbianLocks[source];
            rotated.plasmids[target] = field.plasmids[source];
            rotated.cellStatus[target] = field.cellStatus[source];
        }
    }

    return rotated;
}

export function stepBridgeField(field: BridgeField, lut: ArrayLike<number> = BRIDGE_ZERO_LUT): BridgeField {
    const next = cloneBridgeField(field);
    const size = field.width * field.height;
    const width = field.width;
    const height = field.height;
    const activeRadialBins = Math.max(1, Math.min(height, BRIDGE_ACTIVE_RADIAL_BINS));

    const thetaPrev = field.thetaNow;
    const thetaF3Prev = field.thetaF3;
    const omegaPrev = field.omega;
    const energyPrev = field.energy;
    const plasmidsPrev = field.plasmids;
    const locksPrev = field.hebbianLocks;
    const statusPrev = field.cellStatus;

    for (let index = 0; index < size; index++) {
        const currentStatus = statusPrev[index];
        if (currentStatus > 0) {
            next.cellStatus[index] = currentStatus - 1;
        }

        const sector = index % width;
        const rho = Math.trunc(index / width);
        const radialRho = Math.min(rho, activeRadialBins - 1);
        const boundaryDepth = Math.min(radialRho, activeRadialBins - 1 - radialRho);
        const boundaryBonus = boundaryDepth <= 1 ? 1 : 0;
        const leftIndex = bridgeIndex(width, wrapIndex(sector - 1, width), rho);
        const rightIndex = bridgeIndex(width, wrapIndex(sector + 1, width), rho);
        const innerIndex = bridgeIndex(width, sector, Math.max(0, radialRho - 1));
        const outerIndex = bridgeIndex(width, sector, Math.min(radialRho + 1, activeRadialBins - 1));
        const antipodeIndex = width % 2 === 0 ? bridgeIndex(width, (sector + width / 2) % width, rho) : index;
        const syntheticPeerTheta = thetaF3Prev[index];

        const rawEnergy = energyPrev[index];
        const localTargetValue = localTarget(
            lut,
            thetaPrev,
            [leftIndex, rightIndex, innerIndex, outerIndex],
            index,
            false,
        );

        let bestEnergy = rawEnergy;
        let bestScore = 32767;
        for (const delta of BRIDGE_DELTAS) {
            const mutatedPhase = (thetaPrev[index] + delta) & 0xff;
            const val = lut[mutatedPhase] ?? 0;
            const mutatedVal = generatedBiologyFastAbs(val);
            const nextEnergy = rawEnergy + mutatedVal;
            const score = Math.abs(nextEnergy - localTargetValue);
            if (score < bestScore) {
                bestScore = score;
                bestEnergy = nextEnergy;
            }
        }

        let kuramoto = f32(0);
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[leftIndex]));
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[rightIndex]));
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[innerIndex]));
        kuramoto = f32(kuramoto + phaseSin(thetaPrev[index], thetaPrev[outerIndex]));
        kuramoto = f32(kuramoto + f32(phaseSin(thetaPrev[index], syntheticPeerTheta) * 0.5));

        let coherence = f32(0);
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[leftIndex]));
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[rightIndex]));
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[innerIndex]));
        coherence = f32(coherence + phaseCos(thetaPrev[index], thetaPrev[outerIndex]));
        coherence = f32(coherence + f32(phaseCos(thetaPrev[index], syntheticPeerTheta) * 0.5));

        const sustainedCoherenceBonus =
            boundaryDepth === 1 && plasmidsPrev[index] === 0n && locksPrev[index] >= 64 && coherence >= 3
                ? BRIDGE_DEPTH1_SUSTAINED_ENERGY_BONUS
                : 0;

        const nextOmega = clampBridgeOmega(decodeBridgeOmega(omegaPrev[index]) + roundTiesAwayFromZero(kuramoto));
        const nextTheta = wrapTheta(thetaPrev[index] + nextOmega);
        const coupledEnergy =
            clampByte(
                bestEnergy +
                roundTiesAwayFromZero(f32(coherence * BRIDGE_COHERENCE_ENERGY_GAIN)) +
                sustainedCoherenceBonus +
                boundaryBonus * BRIDGE_BOUNDARY_ENERGY_BONUS -
                Math.trunc(locksPrev[index] / BRIDGE_LOCK_PENALTY_DIVISOR),
            );

        next.thetaNow[index] = nextTheta;
        next.omega[index] = encodeBridgeOmega(nextOmega);
        next.energy[index] = coupledEnergy;
        next.thetaF1[index] = thetaPrev[leftIndex];
        next.thetaF2[index] = thetaPrev[rightIndex];
        next.thetaF3[index] = thetaPrev[index];

        if (coherence >= 3 && coupledEnergy > 200) {
            next.plasmids[index] =
                BigInt(next.thetaNow[index]) |
                (BigInt(next.omega[index]) << 8n) |
                (BigInt(next.hebbianLocks[index]) << 16n) |
                (BigInt(coupledEnergy) << 24n);
        }

        if (bestScore > 100 && coupledEnergy < 240) {
            const neighbors = [leftIndex, rightIndex, innerIndex, outerIndex, antipodeIndex];
            let adopted = false;
            let bestResonance = f32(-2);
            let donorPlasmid = 0n;

            for (const neighborIndex of neighbors) {
                const candidatePlasmid = plasmidsPrev[neighborIndex];
                if (candidatePlasmid === 0n) {
                    continue;
                }
                const candidateResonance = phaseCos(thetaPrev[index], thetaPrev[neighborIndex]);
                if (candidateResonance > bestResonance) {
                    bestResonance = candidateResonance;
                    donorPlasmid = candidatePlasmid;
                }
            }

            if (donorPlasmid !== 0n && bestResonance > BRIDGE_ADOPTION_RESONANCE_THRESHOLD) {
                next.thetaNow[index] = Number(donorPlasmid & 0xffn);
                const donorOmega = decodeBridgeOmega(Number((donorPlasmid >> 8n) & 0xffn));
                next.omega[index] = encodeBridgeOmega(clampBridgeOmega(donorOmega));
                next.plasmids[index] = donorPlasmid;
                adopted = true;
            }

            if (!adopted && bestScore > 160 && next.oracleRequestCount < next.oracleRequests.length) {
                if (currentStatus === 0) {
                    next.oracleRequests[next.oracleRequestCount] = index;
                    next.oracleRequestCount += 1;
                    next.cellStatus[index] = 240;
                }
            }
        }

        const lockThreshold = boundaryDepth === 2 ? BRIDGE_DEPTH2_LOCK_THRESHOLD : f32(3.0);
        next.hebbianLocks[index] =
            coherence >= lockThreshold
                ? saturatingAddByte(locksPrev[index], BRIDGE_LOCK_GAIN + boundaryBonus * BRIDGE_BOUNDARY_LOCK_BONUS)
                : saturatingSubByte(locksPrev[index], BRIDGE_LOCK_DECAY);

        if (coupledEnergy < 15 && next.plasmids[index] !== 0n && next.thetaNow[index] % 4 === 0) {
            next.plasmids[index] = 0n;
        }
    }

    return next;
}

export function runBridgeField(field: BridgeField, ticks: number, lut: ArrayLike<number> = BRIDGE_ZERO_LUT): BridgeField {
    let current = cloneBridgeField(field);
    for (let tick = 0; tick < ticks; tick++) {
        current = stepBridgeField(current, lut);
    }
    return current;
}

export function bridgeFieldSignature(field: BridgeField): string {
    let hash = BRIDGE_FNV64_OFFSET_BASIS;
    const size = field.width * field.height;

    for (let index = 0; index < size; index++) {
        mix(BigInt(index));
        mix(BigInt(field.thetaNow[index]));
        mix(BigInt(field.thetaF1[index]));
        mix(BigInt(field.thetaF2[index]));
        mix(BigInt(field.thetaF3[index]));
        mix(BigInt(field.omega[index]));
        mix(BigInt(field.energy[index]));
        mix(BigInt(field.hebbianLocks[index]));
        mix(field.plasmids[index] & BRIDGE_FNV64_MASK);
        mix(BigInt(field.cellStatus[index]));
    }

    return hash.toString(16).padStart(16, "0");

    function mix(value: bigint): void {
        hash ^= value;
        hash = (hash * BRIDGE_FNV64_PRIME) & BRIDGE_FNV64_MASK;
    }
}

export function bridgeTotalEnergy(field: BridgeField): number {
    return field.energy.reduce((sum, value) => sum + value, 0);
}

export function bridgeTotalLocks(field: BridgeField): number {
    return field.hebbianLocks.reduce((sum, value) => sum + value, 0);
}

export function bridgeTotalPlasmids(field: BridgeField): number {
    let count = 0;
    for (const value of field.plasmids) {
        if (value !== 0n) {
            count += 1;
        }
    }
    return count;
}

export function bridgeOmegaSpan(field: BridgeField): string {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const raw of field.omega) {
        const omega = decodeBridgeOmega(raw);
        min = Math.min(min, omega);
        max = Math.max(max, omega);
    }

    return `${min}..${max}`;
}

export function bridgeFieldsEqual(left: BridgeField, right: BridgeField): boolean {
    if (
        left.width !== right.width ||
        left.height !== right.height ||
        left.oracleRequestCount !== right.oracleRequestCount
    ) {
        return false;
    }

    const size = left.width * left.height;
    for (let index = 0; index < size; index++) {
        if (
            left.thetaNow[index] !== right.thetaNow[index] ||
            left.thetaF1[index] !== right.thetaF1[index] ||
            left.thetaF2[index] !== right.thetaF2[index] ||
            left.thetaF3[index] !== right.thetaF3[index] ||
            left.omega[index] !== right.omega[index] ||
            left.energy[index] !== right.energy[index] ||
            left.hebbianLocks[index] !== right.hebbianLocks[index] ||
            left.plasmids[index] !== right.plasmids[index] ||
            left.cellStatus[index] !== right.cellStatus[index]
        ) {
            return false;
        }
    }

    for (let index = 0; index < left.oracleRequestCount; index++) {
        if (left.oracleRequests[index] !== right.oracleRequests[index]) {
            return false;
        }
    }

    return true;
}

function bridgeIndex(width: number, sector: number, rho: number): number {
    return rho * width + sector;
}

function decodeBridgeOmega(raw: number): number {
    return raw > 127 ? raw - 256 : raw;
}

function encodeBridgeOmega(value: number): number {
    return value & 0xff;
}

function clampBridgeOmega(value: number): number {
    return clamp(value, -BRIDGE_MAX_OMEGA, BRIDGE_MAX_OMEGA);
}

function clampByte(value: number): number {
    return clamp(value, 0, 255);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.trunc(value)));
}

function saturatingAddByte(value: number, delta: number): number {
    return clampByte(value + delta);
}

function saturatingSubByte(value: number, delta: number): number {
    return clampByte(value - delta);
}

function generatedBiologyFastAbs(value: number): number {
    return Math.trunc(value * 18);
}

function localTarget(
    lut: ArrayLike<number>,
    thetaPrev: Uint8Array,
    neighborhood: readonly number[],
    antipodeIndex: number,
    includeAntipode: boolean,
): number {
    let total = 0;
    let count = 0;

    for (const index of neighborhood) {
        total += lut[thetaPrev[index]] ?? 0;
        count += 1;
    }

    if (includeAntipode) {
        total += Math.trunc((lut[thetaPrev[antipodeIndex]] ?? 0) / 2);
        count += 1;
    }

    return count === 0 ? 0 : Math.trunc(total / count);
}

function signedPhaseDelta(fromTheta: number, toTheta: number): number {
    const raw = wrapTheta(toTheta - fromTheta);
    return raw > 128 ? raw - 256 : raw;
}

function phaseRadians(fromTheta: number, toTheta: number): number {
    return f32(f32(signedPhaseDelta(fromTheta, toTheta)) * BRIDGE_PHASE_SCALE);
}

function phaseSin(fromTheta: number, toTheta: number): number {
    return f32(Math.sin(phaseRadians(fromTheta, toTheta)));
}

function phaseCos(fromTheta: number, toTheta: number): number {
    return f32(Math.cos(phaseRadians(fromTheta, toTheta)));
}

function roundTiesAwayFromZero(value: number): number {
    return value < 0 ? -Math.round(-value) : Math.round(value);
}

function f32(value: number): number {
    return Math.fround(value);
}
