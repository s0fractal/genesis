/**
 * OMEGA-64 | Ontology 7.0
 * The Polar Phase-Aware Computing Medium (LUT-256)
 * 
 * In this paradigm, computation is geometric. 
 * Values are not linear magnitudes; they are positions in a cyclic phase space.
 * Math operations are phase translations and interference alignments.
 */

export interface PhaseVector {
    angle: number;   // 0..255 (Position on the cyclic LUT)
    radius: number;  // Floor(Value / 256) (Energy Cycle / Ring Magnitude)
}

/**
 * Transforms a linear value (i32) into a Geometric Phase Vector.
 */
export function linearToPhase(value: number): PhaseVector {
    // Handling negative numbers by wrapping them cyclically
    const angle = ((value % 256) + 256) % 256; 
    const radius = Math.floor(value / 256);
    return { angle, radius };
}

/**
 * Collapses a Geometric Phase Vector back into a linear value (i32).
 * Often only used for external IO edges.
 */
export function phaseToLinear(vector: PhaseVector): number {
    return vector.angle + (vector.radius * 256);
}

/**
 * Geometric `add`: Translating a phase forward by another phase's magnitude.
 * If the angle completes a full rotation (> 255), the cycle (radius) increases.
 */
export function phaseShiftAdd(a: PhaseVector, b: PhaseVector): PhaseVector {
    const rawAngle = a.angle + b.angle;
    const newAngle = rawAngle % 256;
    
    // Cycle increases based on full rotations made, plus existing cycles
    const orbitStep = Math.floor(rawAngle / 256);
    const newRadius = a.radius + b.radius + orbitStep;
    
    return { angle: newAngle, radius: newRadius };
}

/**
 * Semantic Resonance (Coupling).
 * Determines the topological attraction or interference between two vectors.
 * A score of 1.0 means perfect alignment (same angle).
 * A score of -1.0 means complete destructive interference (opposite sides of the circle).
 */
export function calculateResonance(a: PhaseVector, b: PhaseVector): number {
    const phaseDiff = Math.abs(a.angle - b.angle);
    
    // Map the 0-255 difference into a radian value (0 - PI)
    const radians = (phaseDiff / 256) * Math.PI * 2;
    
    // The coupling is the cosine of the phase difference.
    return Math.cos(radians);
}

/**
 * AST Execution Engine (Phase Shift Simulator).
 * Recursively runs an expression tree geometry within the Phase Space constraints.
 */
export function executePhaseGeometricAST(ir: any, env: Record<string, PhaseVector>): PhaseVector {
    if (ir.kind === "const") {
        return linearToPhase(ir.value);
    }
    
    if (ir.kind === "var") {
        if (!env[ir.name]) throw new Error(`Geometrical Variable ${ir.name} not supplied in Phase environment.`);
        return env[ir.name];
    }
    
    if (ir.kind === "op") {
        // Geometric Translation
        if (ir.op === "add") {
            const left = executePhaseGeometricAST(ir.args[0], env);
            const right = executePhaseGeometricAST(ir.args[1], env);
            return phaseShiftAdd(left, right);
        }
        
        // Advanced Orbits
        if (ir.op === "mul") {
            const left = executePhaseGeometricAST(ir.args[0], env);
            const right = executePhaseGeometricAST(ir.args[1], env);
            const linearOut = phaseToLinear(left) * phaseToLinear(right);
            return linearToPhase(linearOut); 
        }
    }
    
    throw new Error(`Unhandled Geometric Configuration: ${ir.kind}`);
}
