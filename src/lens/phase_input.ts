import { PhaseLatticeField } from "@wasm";
import { PhaseComputeEngine } from "./phase_compute.ts";
import { SovereignOracle } from "../ontology/oracle.ts";
import { clamp_i32 } from "../shared/constants.ts";

export class PhasePerturbationInjector {
    private canvas: HTMLCanvasElement;
    private field: PhaseLatticeField;
    private memory: WebAssembly.Memory;
    private engine?: PhaseComputeEngine;
    private oracle?: SovereignOracle;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, memory: WebAssembly.Memory, engine?: PhaseComputeEngine, oracle?: SovereignOracle) {
        this.canvas = canvas;
        this.field = field;
        this.memory = memory;
        this.engine = engine;
        this.oracle = oracle;
    }

    public rebind(field: PhaseLatticeField, engine?: PhaseComputeEngine) {
        this.field = field;
        this.engine = engine;
    }

    public attach() {
        this.canvas.addEventListener("pointerdown", (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = event.clientX - cx;
            const dy = event.clientY - cy;
            const angle = Math.atan2(dy, dx);
            const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
            const sector = Math.floor(normalizedAngle / (Math.PI * 2) * this.field.sectors);
            const maxRadius = Math.min(rect.width, rect.height) * 0.42;
            const distance = Math.hypot(dx, dy);
            const rho = Math.floor(clamp_i32(distance / Math.max(1, maxRadius), 0, 0.999) * this.field.radial_bins);

            this.inject(
                sector,
                rho,
                160,
                1,
                Math.floor(normalizedAngle / (Math.PI * 2) * 255),
                new Uint8Array([0, 0, 0, 0, 0, 0, 180, 0]),
            );
        });
    }

    public inject(
        x: number,
        y: number,
        energy: number,
        radius: number,
        phaseShift: number,
        plasmid: Uint8Array,
    ) {
        const sector = ((x % this.field.sectors) + this.field.sectors) % this.field.sectors;
        const rho = ((y % this.field.radial_bins) + this.field.radial_bins) % this.field.radial_bins;
        const harmonic = (plasmid[0] ^ plasmid[7]) % this.field.harmonics;
        const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;

        if (this.engine) {
            // O-23 Native WebGPU staging buffer injection
            this.engine.injectEnergy(idx, phaseShift);
            if (this.oracle) {
                // Request a semantic payload from LLM synchronously to the user click!
                this.oracle.request(idx);
            }
            return;
        }

        // Legacy WASM buffer mutation via 16-byte PhaseAgent struct
        const ptr = this.field.ptr_agents();
        const memoryView = new DataView(this.memory.buffer);
        const agentOffset = ptr + idx * 16;

        const currentTheta = memoryView.getUint8(agentOffset);
        memoryView.setUint8(agentOffset, (currentTheta + phaseShift) & 0xFF);

        const currentOmega = memoryView.getInt16(agentOffset + 2, true);
        memoryView.setInt16(agentOffset + 2, clamp_i32(currentOmega + ((plasmid[1] % 5) - 2), -16, 16), true);

        const currentAmplitude = memoryView.getUint8(agentOffset + 4);
        memoryView.setUint8(agentOffset + 4, clamp_i32(currentAmplitude + Math.floor(energy / Math.max(1, radius + 1)), 0, 255));

        const currentLock = memoryView.getUint8(agentOffset + 5);
        memoryView.setUint8(agentOffset + 5, clamp_i32(currentLock + 12, 0, 255));

        const currentEntanglement = memoryView.getUint8(agentOffset + 6);
        memoryView.setUint8(agentOffset + 6, Math.max(currentEntanglement, plasmid[6]));
    }
}
