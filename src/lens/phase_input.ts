import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";
import { PhaseComputeEngine } from "./phase_compute.ts";
import { SovereignOracle } from "../ontology/oracle.ts";

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

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
            const rho = Math.floor(clamp(distance / Math.max(1, maxRadius), 0, 0.999) * this.field.radial_bins);

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

        // Legacy WASM buffer mutation
        const theta = new Uint8Array(this.memory.buffer, this.field.ptr_theta(), this.field.cell_count());
        const omega = new Int16Array(this.memory.buffer, this.field.ptr_omega(), this.field.cell_count());
        const amplitude = new Uint8Array(this.memory.buffer, this.field.ptr_amplitude(), this.field.cell_count());
        const lock = new Uint8Array(this.memory.buffer, this.field.ptr_lock(), this.field.cell_count());
        const entanglement = new Uint8Array(this.memory.buffer, this.field.ptr_entanglement(), this.field.cell_count());

        theta[idx] = (theta[idx] + phaseShift) & 0xFF;
        amplitude[idx] = clamp(amplitude[idx] + Math.floor(energy / Math.max(1, radius + 1)), 0, 255);
        omega[idx] = clamp(omega[idx] + ((plasmid[1] % 5) - 2), -16, 16);
        lock[idx] = clamp(lock[idx] + 12, 0, 255);
        entanglement[idx] = Math.max(entanglement[idx], plasmid[6]);
    }
}
