import { linearToPhase, phaseShiftAdd, calculateResonance, phaseToLinear } from "../src/phase_aware_interpreter.ts";

console.log("=== OMEGA-64 | Resonance Testing ===");

// Value 100 has Phase 100 on Cycle 0
const p1 = linearToPhase(100);
console.log(`P1 (100) -> Phase: ${p1.angle}, Cycle: ${p1.radius}`);

// Value 200 has Phase 200 on Cycle 0
const p2 = linearToPhase(200);
console.log(`P2 (200) -> Phase: ${p2.angle}, Cycle: ${p2.radius}`);

// 100 + 200 = 300, which is Phase 44 on Cycle 1
const p3 = phaseShiftAdd(p1, p2);
console.log(`Shift(P1, P2) -> Phase: ${p3.angle}, Cycle: ${p3.radius} (Expected Linear: 300, Got: ${phaseToLinear(p3)})`);

// Resonance Test
const rParallel = calculateResonance(p1, p1);
console.log(`Resonance (P1, P1) -> ${rParallel} (Expected 1.0)`);

const pOrthogonal = linearToPhase(100 + 64); // 64 is a 90 degree shift on a 256 cycle (PI/2)
const rOrthogonal = calculateResonance(p1, pOrthogonal);
console.log(`Resonance (100, 164) -> ${rOrthogonal.toFixed(3)} (Expected 0.0)`);

const pOpposite = linearToPhase(100 + 128); // 128 is a 180 degree shift on a 256 cycle (PI)
const rOpposite = calculateResonance(p1, pOpposite);
console.log(`Resonance (100, 228) -> ${rOpposite.toFixed(3)} (Expected -1.0)`);
