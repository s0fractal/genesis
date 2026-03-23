import { ISubsystem } from "./orchestrator.ts";
import { PhaseLatticeField } from "@wasm";
import { SovereignOracle } from "../../ontology/oracle.ts";
import { PhaseComputeEngine } from "../../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../../lens/phase_webgpu.ts";

export class GPUCoreSubsystem implements ISubsystem {
    constructor(
        public device: GPUDevice,
        public field: PhaseLatticeField,
        public engine: PhaseComputeEngine,
        public observer: PhaseWebGPUObserver,
        public oracle: SovereignOracle
    ) {}

    async init() {
        await this.engine.init();
        await this.observer.init();
    }

    tick() {
        // Era 216: The Kimi Vectors (Phase Lock Hysteresis)
        // Stall the Native WASM integration to prevent Thermodynamic Illusions when the Oracle is saturated.
        if (!this.oracle.isBusy) {
            this.engine.tick();
        }
        this.observer.render(this.engine.getActiveBuffer());
    }
}
