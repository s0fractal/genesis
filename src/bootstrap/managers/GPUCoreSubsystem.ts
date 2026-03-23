import { ISubsystem } from "./orchestrator.ts";
import { PhaseLatticeField } from "@wasm";
import { PhaseComputeEngine } from "../../lens/phase_compute.ts";
import { PhaseWebGPUObserver } from "../../lens/phase_webgpu.ts";

export class GPUCoreSubsystem implements ISubsystem {
    constructor(
        public device: GPUDevice,
        public field: PhaseLatticeField,
        public engine: PhaseComputeEngine,
        public observer: PhaseWebGPUObserver
    ) {}

    async init() {
        await this.engine.init();
        await this.observer.init();
    }

    tick() {
        this.engine.tick();
        this.observer.render(this.engine.getActiveBuffer());
    }
}
