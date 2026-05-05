// 🌌 OMEGA-64: Era 2070 — Diagnostic Organ (Homeostasis Policy)
//
// "The vegetative nervous system of the swarm."
// This module provides read-only telemetry and an 'Organism Readiness Score'.
// It explicitly CANNOT mutate the physical lattice directly. It operates
// purely as an advisory layer for the visualization HUD and future
// cross-mesh signaling.

export type HomeostasisAction =
    | "STABLE"
    | "COOL_DOWN_MUTATION"
    | "ENTER_CONSERVATION"
    | "QUARANTINE_FOREIGN_PLASMIDS"
    | "REQUEST_SENATE_REVIEW"
    | "COMPRESS_TRANSLATION_POLICY";

export interface SystemMetrics {
    invariantHealth: number;       // [0.0 - 1.0]
    mitosisValidity: number;       // [0.0 - 1.0]
    homeostasisStability: number;  // [0.0 - 1.0]
    meshCoherence: number;         // [0.0 - 1.0]
    oracleDiversity: number;       // [0.0 - 1.0]
    attractorBalance: number;      // [0.0 - 1.0]
    replayability: number;         // [0.0 - 1.0]
}

export class HomeostasisPolicy {
    private lastScore: number = 1.0;
    private currentAction: HomeostasisAction = "STABLE";

    /**
     * Era 2070: Calculate the readiness score based on the unified formula.
     */
    public calculateReadinessScore(metrics: SystemMetrics): number {
        const score = 
            0.20 * Math.max(0, Math.min(1, metrics.invariantHealth)) +
            0.20 * Math.max(0, Math.min(1, metrics.mitosisValidity)) +
            0.15 * Math.max(0, Math.min(1, metrics.homeostasisStability)) +
            0.15 * Math.max(0, Math.min(1, metrics.meshCoherence)) +
            0.10 * Math.max(0, Math.min(1, metrics.oracleDiversity)) +
            0.10 * Math.max(0, Math.min(1, metrics.attractorBalance)) +
            0.10 * Math.max(0, Math.min(1, metrics.replayability));
            
        this.lastScore = score;
        this.updateAdvisoryState(score);
        return score;
    }

    private updateAdvisoryState(score: number) {
        if (score >= 0.90) {
            this.currentAction = "STABLE";
        } else if (score >= 0.75) {
            this.currentAction = "COOL_DOWN_MUTATION";
        } else if (score >= 0.60) {
            this.currentAction = "ENTER_CONSERVATION";
        } else if (score >= 0.40) {
            this.currentAction = "QUARANTINE_FOREIGN_PLASMIDS";
        } else if (score >= 0.20) {
            this.currentAction = "REQUEST_SENATE_REVIEW";
        } else {
            this.currentAction = "COMPRESS_TRANSLATION_POLICY";
        }
    }

    public getAdvisoryState(): HomeostasisAction {
        return this.currentAction;
    }

    public getLastReadinessScore(): number {
        return this.lastScore;
    }
}
