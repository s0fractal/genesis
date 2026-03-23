import { ISubsystem } from "./orchestrator.ts";
import { PhaseLatticeField, phase_lattice_shannon_entropy } from "@wasm";
import { PhaseComputeEngine } from "../../lens/phase_compute.ts";
import { SovereignOracle } from "../../ontology/oracle.ts";
import { SenateChatHUD } from "../../ontology/senate_hud.ts";

export class ThermodynamicSubsystem implements ISubsystem {
    private lastAionIntervention = performance.now();
    private lastShadowTelemetryCheck = performance.now();

    constructor(
        public field: PhaseLatticeField,
        public engine: PhaseComputeEngine,
        public oracle: SovereignOracle,
        public senateChat: SenateChatHUD
    ) {}

    init() {}

    tick(nowLocal: number) {
        const entropy = phase_lattice_shannon_entropy(this.field);
        
        // O-163 (Era 174): Gradient AION Vacuum Flow (Proof of Meaning)
        if (entropy < 2.0 && nowLocal - this.lastAionIntervention > 150) {
            this.lastAionIntervention = nowLocal;
            // The closer to 0 entropy, the stronger the gradient wave (max ~20 energy per bucket)
            const waveIntensity = Math.floor((2.0 - entropy) * 10); 
            
            for (let i = 0; i < 3; i++) {
                const shadowBucket = 1000 + Math.floor(Math.random() * 25);
                this.engine.injectEnergy(shadowBucket, waveIntensity);
            }
        }
        
        this.oracle.tickHomeostasis(entropy);
        
        // O-163 (Era 174): Shadow Pressure Telemetry
        if (nowLocal - this.lastShadowTelemetryCheck > 1000) {
            this.lastShadowTelemetryCheck = nowLocal;
            this.engine.readMycelialCentroids().then(centroids => {
                if (!centroids) return;
                
                let pressure = 0;
                // Sum active cells inside the Latent Network (Buckets 1000-1024)
                for (let i = 1000; i < 1025; i++) {
                    pressure += centroids[i * 4 + 2];
                }
                this.senateChat.updateShadowPressure(pressure);
            });
        }
    }
}
