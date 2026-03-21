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

export const PHASE_SINE_LUT = new Int32Array([
    0, 25, 50, 75, 100, 125, 150, 175, 200, 224, 249, 273, 297, 321, 345, 369, 
    392, 415, 438, 460, 483, 505, 526, 548, 569, 590, 610, 630, 650, 669, 688, 706, 
    724, 742, 759, 775, 792, 807, 822, 837, 851, 865, 878, 891, 903, 915, 926, 936, 
    946, 955, 964, 972, 980, 987, 993, 999, 1004, 1009, 1013, 1016, 1019, 1021, 1023, 1024, 
    1024, 1024, 1023, 1021, 1019, 1016, 1013, 1009, 1004, 999, 993, 987, 980, 972, 964, 955, 
    946, 936, 926, 915, 903, 891, 878, 865, 851, 837, 822, 807, 792, 775, 759, 742, 
    724, 706, 688, 669, 650, 630, 610, 590, 569, 548, 526, 505, 483, 460, 438, 415, 
    392, 369, 345, 321, 297, 273, 249, 224, 200, 175, 150, 125, 100, 75, 50, 25, 
    0, -25, -50, -75, -100, -125, -150, -175, -200, -224, -249, -273, -297, -321, -345, -369, 
    -392, -415, -438, -460, -483, -505, -526, -548, -569, -590, -610, -630, -650, -669, -688, -706, 
    -724, -742, -759, -775, -792, -807, -822, -837, -851, -865, -878, -891, -903, -915, -926, -936, 
    -946, -955, -964, -972, -980, -987, -993, -999, -1004, -1009, -1013, -1016, -1019, -1021, -1023, -1024, 
    -1024, -1024, -1023, -1021, -1019, -1016, -1013, -1009, -1004, -999, -993, -987, -980, -972, -964, -955, 
    -946, -936, -926, -915, -903, -891, -878, -865, -851, -837, -822, -807, -792, -775, -759, -742, 
    -724, -706, -688, -669, -650, -630, -610, -590, -569, -548, -526, -505, -483, -460, -438, -415, 
    -392, -369, -345, -321, -297, -273, -249, -224, -200, -175, -150, -125, -100, -75, -50, -25
]);


export function phaseSine(a: number, b: number): number {
    return PHASE_SINE_LUT[wrapIndex(b - a, 256)];
}

export function phaseCosine(a: number, b: number): number {
    return PHASE_SINE_LUT[wrapIndex(b - a + 64, 256)];
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
