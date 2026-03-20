import { PHASE_CONSTANTS } from "./constants.ts";

export interface LatticeConfig {
    sectors: number;
    radialBins: number;
    harmonics: number;
    wrapSectors: boolean;
    hasAntipode: boolean;
}

export function wrapIndex(value: number, modulo: number): number {
    return ((value % modulo) + modulo) % modulo;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function signedPhaseDelta(fromTheta: number, toTheta: number): number {
    const delta = wrapIndex(toTheta - fromTheta, PHASE_CONSTANTS.LUT_SIZE);
    return delta > PHASE_CONSTANTS.HALF_PHASE ? delta - PHASE_CONSTANTS.LUT_SIZE : delta;
}

export function phaseDistance(a: number, b: number): number {
    return Math.abs(signedPhaseDelta(a, b));
}

export function phaseSine(a: number, b: number): number {
    return Math.sin((signedPhaseDelta(a, b) / PHASE_CONSTANTS.LUT_SIZE) * Math.PI * 2);
}

export function phaseCosine(a: number, b: number): number {
    return Math.cos((signedPhaseDelta(a, b) / PHASE_CONSTANTS.LUT_SIZE) * Math.PI * 2);
}

export function createTopology(config: LatticeConfig) {
    const { sectors, radialBins, harmonics, wrapSectors } = config;

    const getIndex = (sector: number, rho: number, harmonic: number): number => {
        const s = wrapSectors ? wrapIndex(sector, sectors) : clamp(sector, 0, sectors - 1);
        const r = clamp(rho, 0, radialBins - 1);
        const h = wrapIndex(harmonic, harmonics);
        return h * radialBins * sectors + r * sectors + s;
    };

    return {
        config,
        getIndex
    };
}
