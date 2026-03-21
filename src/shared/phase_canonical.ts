import { createPhaseField, getCell, wrapTheta } from "./phase_lattice.ts";
import { clamp, wrapIndex } from "./topology_core.ts";
import type { PhaseField, PhaseFieldShape } from "./phase_lattice.ts";

export const CANONICAL_PHASE_SHAPE: PhaseFieldShape = {
    tauDepth: 4,
    sectors: 32,
    radialBins: 6,
    harmonics: 16,
};

export function buildCanonicalPhaseSeed(shape: PhaseFieldShape = CANONICAL_PHASE_SHAPE): PhaseField {
    return createPhaseField(shape, ({ tau, sector, rho, harmonic }) => ({
        theta: tau * 3 + sector * 7 + rho * 19 + harmonic * 23,
        omega: ((tau + sector + rho + harmonic) % 5) - 2,
        amplitude: clamp(tau * 11 + sector * 13 + rho * 17 + harmonic * 29, 0, 255),
        lock: (tau * 7 + sector * 5 + rho * 11 + harmonic * 3) % 64,
        entanglement: 0,
        cellStatus: 0,
        plasmids: 0n,
    }));
}

export function buildProjectedBridgeSeed(
    bridgeWidth: number,
    bridgeHeight: number,
    shape: PhaseFieldShape = CANONICAL_PHASE_SHAPE,
): PhaseField {
    const canonical = buildCanonicalPhaseSeed(shape);
    return createPhaseField(
        {
            tauDepth: 4,
            sectors: bridgeWidth,
            radialBins: bridgeHeight,
            harmonics: 1,
        },
        ({ sector, rho }) => collapseCanonicalBridgeCell(canonical, bridgeWidth, bridgeHeight, sector, rho),
    );
}

function collapseCanonicalBridgeCell(
    canonical: PhaseField,
    bridgeWidth: number,
    bridgeHeight: number,
    sector: number,
    rho: number,
) {
    const sourceSector = projectSectorIndex(sector, bridgeWidth, canonical.shape.sectors);
    const sourceRho = projectRadialIndex(rho, bridgeHeight, canonical.shape.radialBins);
    let sumX = 0;
    let sumY = 0;
    let sumAmplitude = 0;
    let sumLock = 0;
    let sumOmega = 0;
    let maxEntanglement = 0;
    let fallbackTheta = 0;

    for (let harmonic = 0; harmonic < canonical.shape.harmonics; harmonic++) {
        const cell = getCell(canonical, 0, sourceSector, sourceRho, harmonic);
        const weight = Math.max(1, cell.amplitude);
        const radians = (cell.theta / 256) * Math.PI * 2;
        sumX += Math.cos(radians) * weight;
        sumY += Math.sin(radians) * weight;
        sumAmplitude += cell.amplitude;
        sumLock += cell.lock;
        sumOmega += cell.omega;
        maxEntanglement = Math.max(maxEntanglement, cell.entanglement);
        fallbackTheta = cell.theta;
    }

    const harmonicCount = canonical.shape.harmonics;
    const meanAngle = sumX === 0 && sumY === 0 ? (fallbackTheta / 256) * Math.PI * 2 : Math.atan2(sumY, sumX);
    const normalizedAngle = meanAngle < 0 ? meanAngle + Math.PI * 2 : meanAngle;

    return {
        theta: wrapTheta(Math.round((normalizedAngle / (Math.PI * 2)) * 256)),
        omega: Math.round(sumOmega / harmonicCount),
        amplitude: clamp(Math.round(sumAmplitude / harmonicCount), 0, 255),
        lock: clamp(Math.round(sumLock / harmonicCount), 0, 255),
        entanglement: maxEntanglement,
        cellStatus: 0,
        plasmids: 0n,
    };
}

function projectSectorIndex(targetSector: number, targetSectors: number, sourceSectors: number): number {
    if (targetSectors <= 0 || sourceSectors <= 0) {
        return 0;
    }
    return wrapIndex(Math.floor((targetSector * sourceSectors) / targetSectors), sourceSectors);
}

function projectRadialIndex(targetRho: number, targetBins: number, sourceBins: number): number {
    if (sourceBins <= 0) {
        return 0;
    }
    if (targetBins >= sourceBins) {
        return Math.min(targetRho, sourceBins - 1);
    }
    return Math.min(Math.floor((targetRho * sourceBins) / targetBins), sourceBins - 1);
}
