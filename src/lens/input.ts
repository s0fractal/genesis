/// <reference types="@webgpu/types" />

import { apply_perturbation, Field } from "../../omega_core/pkg/omega_core.js";

export class PerturbationInjector {
    private canvas: HTMLCanvasElement;
    private field: Field;

    constructor(canvas: HTMLCanvasElement, field: Field) {
        this.canvas = canvas;
        this.field = field;
    }

    public attach() {
        this.canvas.addEventListener('pointerdown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Translate absolute pointers to grid coordinates
            const x = Math.floor((e.clientX - rect.left) / rect.width * 256);
            const y = Math.floor((e.clientY - rect.top) / rect.height * 256);
            
            // Generate raw kinetic disturbance intent without specific semantic plasmid
            this.inject(x, y, 500, 10, 128, new Uint8Array(8));
        });
    }

    public inject(x: number, y: number, energy: number, radius: number, phaseShift: number, plasmid: Uint8Array) {
        // Cast the 8-byte plasmid into two u32 parts for WASM binding
        const p_lo = (plasmid[3] << 24) | (plasmid[2] << 16) | (plasmid[1] << 8) | plasmid[0];
        const p_hi = (plasmid[7] << 24) | (plasmid[6] << 16) | (plasmid[5] << 8) | plasmid[4];
        
        apply_perturbation(this.field, x, y, energy, radius, phaseShift, p_lo >>> 0, p_hi >>> 0);
    }
}
