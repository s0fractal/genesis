import { State, Sigma3Node } from "./quine.ts";

/**
 * OMEGA-64 | Ontology 8.0
 * The Temporal Phase Engine (Kuramoto Consensus)
 * 
 * Executes computing nodes deterministically based on absolute Phase geometry.
 */

// Math domain constants
const PHASE_MAX = 256;          // A complete cyclic rotation
const KURAMOTO_K = 10;          // Base Coupling Strength multiplier

interface FiredSignal {
    sourceId: string;
    phase: number;
}

/**
 * Core Scheduler Logic.
 * Advances the global clock by `ticks`.
 */
export function runEpoch(state: State, ticks: number, triggerExecution: (nodeId: string) => void) {
    console.log(`[Chronosphere] Advancing time by ${ticks} ticks...`);

    for (let t = 0; t < ticks; t++) {
        const firedThisTick: FiredSignal[] = [];

        // 1. Advance Phase Vectors for all neurons
        for (const [id, node] of Object.entries(state)) {
            // Apply temporal attributes if they don't exist yet (Legacy Migration)
            if (!node.physics.temporal) {
                // Determine implicit frequency from energy or set a default
                const freq = node.physics.energy_cost < 20 ? 64 : 1; 
                node.physics.temporal = { frequency: freq, phase: 0 };
            }

            const tm = node.physics.temporal;
            // Native rotation step
            tm.phase += tm.frequency;

            // Overflow Check (360 Degree Firing)
            if (tm.phase >= PHASE_MAX) {
                tm.phase = tm.phase % PHASE_MAX;
                firedThisTick.push({ sourceId: id, phase: tm.phase });
                
                // Trigger actual abstract execution
                triggerExecution(id);
            }
        }

        // 2. Kuramoto Consensus (Apply Coupling from fired nodes to their dependents)
        if (firedThisTick.length > 0) {
            applyKuramotoCoupling(state, firedThisTick);
        }
    }
}

/**
 * Evaluates the topological connections and "pulls/pushes" the phases of linked nodes
 * according to Kuramoto resonance physics.
 */
function applyKuramotoCoupling(state: State, signals: FiredSignal[]) {
    for (const signal of signals) {
        const sourceNode = state[signal.sourceId];
        if (!sourceNode) continue;
        
        // Find children/dependents (Nodes that have `sourceNode.hash` in their parents line)
        const sourceHash = sourceNode.identity.structural_hash;
        
        for (const [targetId, targetNode] of Object.entries(state)) {
            if (targetId === signal.sourceId) continue;
            
            const parents = targetNode.identity.parents || [];
            if (parents.includes(sourceHash)) {
                // Resonance calculation
                const tmB = targetNode.physics.temporal!;
                
                // Absolute phase difference
                const diff = signal.phase - tmB.phase;
                // Convert 0..255 LUT into Radians for Cosine
                const radians = (diff / PHASE_MAX) * Math.PI * 2;
                
                // Kuramoto Coupling Force: K * cos(A - B)
                // We use stability to modulate how easily a node is influenced
                const k = KURAMOTO_K * (sourceNode.physics.stability || 1.0);
                const shift = k * Math.cos(radians);
                
                // Apply phase deformation
                tmB.phase = (tmB.phase + shift + PHASE_MAX) % PHASE_MAX;
                
                // Debug logging to track resonance waves
                console.log(`  [Wave] Resonance: ${signal.sourceId} ~> ${targetId} | Force: ${shift.toFixed(2)} | B's New Phase: ${tmB.phase.toFixed(1)}`);
            }
        }
    }
}
