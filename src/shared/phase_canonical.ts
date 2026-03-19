import { clamp, createPhaseField } from "./phase_lattice.ts";
import type { PhaseField, PhaseFieldShape } from "./phase_lattice.ts";

export const CANONICAL_PHASE_SHAPE: PhaseFieldShape = {
    sectors: 32,
    radialBins: 6,
    harmonics: 3,
};

export function buildCanonicalPhaseSeed(shape: PhaseFieldShape = CANONICAL_PHASE_SHAPE): PhaseField {
    return createPhaseField(shape, ({ sector, rho, harmonic }) => ({
        theta: sector * 7 + rho * 19 + harmonic * 23,
        omega: ((sector + rho + harmonic) % 5) - 2,
        amplitude: clamp(sector * 13 + rho * 17 + harmonic * 29, 0, 255),
        lock: (sector * 5 + rho * 11 + harmonic * 3) % 64,
        entanglement: 0,
    }));
}
