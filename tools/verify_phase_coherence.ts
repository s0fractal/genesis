import {
    assertFieldBounds,
    clonePhaseField,
    fieldSignature,
    fieldsEqual,
    projectCellToCartesian,
    rotateAngularAddress,
    rotateGlobalPhase,
    runPhaseField,
    structuralSignature,
    sumAmplitude,
    sumEntanglement,
} from "../src/shared/phase_lattice.ts";
import { PHASE_CONSTANTS } from "../src/shared/constants.ts";
import { buildReferenceSeed } from "./phase_golden_common.ts";
import type { PhaseField, PhaseFieldShape } from "../src/shared/phase_lattice.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function verifyDeterministicReplay(seed: PhaseField, ticks: number): void {
    const left = runPhaseField(seed, ticks);
    const right = runPhaseField(seed, ticks);
    assert(fieldsEqual(left, right), "Deterministic replay failed");
}

function verifyGlobalPhaseRotation(seed: PhaseField, ticks: number, deltaTheta: number): void {
    const rotatedSeed = clonePhaseField(seed);
    rotateGlobalPhase(rotatedSeed, deltaTheta);
    const left = runPhaseField(rotatedSeed, ticks);
    
    const right = runPhaseField(seed, ticks);
    rotateGlobalPhase(right, deltaTheta);
    assert(fieldsEqual(left, right), "Global phase rotation equivariance failed");
}

function verifyAngularAddressRotation(seed: PhaseField, ticks: number, deltaSector: number): void {
    const rotatedSeed = clonePhaseField(seed);
    rotateAngularAddress(rotatedSeed, deltaSector);
    const left = runPhaseField(rotatedSeed, ticks);
    
    const right = runPhaseField(seed, ticks);
    rotateAngularAddress(right, deltaSector);
    assert(fieldsEqual(left, right), "Angular address rotation equivariance failed");
}

function verifyWraparound(seed: PhaseField): void {
    const fullPhaseTurn = clonePhaseField(seed);
    rotateGlobalPhase(fullPhaseTurn, PHASE_CONSTANTS.LUT_SIZE);
    
    const fullAddressTurn = clonePhaseField(seed);
    rotateAngularAddress(fullAddressTurn, seed.shape.sectors);
    
    assert(fieldsEqual(seed, fullPhaseTurn), "Phase wraparound identity failed");
    assert(fieldsEqual(seed, fullAddressTurn), "Angular address wraparound identity failed");
}

function verifyProjection(seed: PhaseField): void {
    const inner = new Float32Array(2);
    projectCellToCartesian(0, 0, seed.shape, 2, inner);
    const outerRho = Math.min(1, seed.shape.radialBins - 1);
    const outer = new Float32Array(2);
    projectCellToCartesian(0, outerRho, seed.shape, 2, outer);
    const innerRadius = Math.hypot(inner[0], inner[1]);
    const outerRadius = Math.hypot(outer[0], outer[1]);

    assert(Number.isFinite(inner[0]) && Number.isFinite(inner[1]), "Inner projection must be finite");
    assert(Number.isFinite(outer[0]) && Number.isFinite(outer[1]), "Outer projection must be finite");
    assert(outerRadius >= innerRadius, "Projection radius must grow with rho");
}

function verifyBoundedDrift(seed: PhaseField, ticks: number): void {
    const field = runPhaseField(seed, ticks);
    assertFieldBounds(field);
}

function main(): void {
    const shape: PhaseFieldShape = {
        tauDepth: 4,
        sectors: 32,
        radialBins: 6,
        harmonics: 3,
    };
    const ticks = 24;
    const seed = buildReferenceSeed(shape);

    verifyDeterministicReplay(seed, ticks);
    verifyGlobalPhaseRotation(seed, ticks, 37);
    verifyAngularAddressRotation(seed, ticks, 5);
    verifyWraparound(seed);
    verifyProjection(seed);
    verifyBoundedDrift(seed, 128);

    const output = runPhaseField(seed, ticks);

    console.log("=== Genesis verify:phase-coherence ===");
    console.log(`shape=${shape.sectors} sectors x ${shape.radialBins} rings x ${shape.harmonics} harmonics`);
    console.log(`ticks=${ticks}`);
    console.log(`seed_legacy_signature=${fieldSignature(seed)}`);
    console.log(`seed_structural_signature=${structuralSignature(seed)}`);
    console.log(`output_legacy_signature=${fieldSignature(output)}`);
    console.log(`output_structural_signature=${structuralSignature(output)}`);
    console.log(`total_amplitude=${sumAmplitude(output)}`);
    console.log(`total_entanglement=${sumEntanglement(output)}`);
    console.log("status=PASS");
}

main();
