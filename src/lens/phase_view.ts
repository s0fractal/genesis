// @ts-nocheck
import { PhaseLatticeField, phase_lattice_omega_span } from "@wasm";

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

export class PhaseLensObserver {
    private canvas: HTMLCanvasElement;
    private field: PhaseLatticeField;
    private memory: WebAssembly.Memory;
    private context!: CanvasRenderingContext2D;
    private plasmidGroups = new Map<bigint, { count: number, sumX: number, sumY: number }>();

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.canvas = canvas;
        this.field = field;
        this.memory = memory;
    }

    public init() {
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("2D canvas not supported");
        }
        this.context = context;
    }

    public render() {
        if (!this.context) {
            return;
        }

        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) * 0.42;

        const ptrAgents = this.field.ptr_agents() as number;
        const view = new DataView(this.memory.buffer);

        ctx.clearRect(0, 0, width, height);

        const bg = ctx.createRadialGradient(cx, cy, maxRadius * 0.05, cx, cy, maxRadius);
        bg.addColorStop(0, "rgba(22, 54, 66, 0.25)");
        bg.addColorStop(0.6, "rgba(5, 10, 20, 0.2)");
        bg.addColorStop(1, "rgba(0, 0, 0, 0.95)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(cx, cy);
        for (let ring = 1; ring <= this.field.radial_bins; ring++) {
            const r = maxRadius * (ring / (this.field.radial_bins + 1));
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(120, 220, 255, ${0.06 + ring * 0.01})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();

        if (this.field.sectors % 2 === 0) {
            ctx.save();
            ctx.translate(cx, cy);
            for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
                for (let rho = 0; rho < this.field.radial_bins; rho++) {
                    for (let sector = 0; sector < this.field.sectors / 2; sector++) {
                        const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                        const agentOffset = ptrAgents + idx * 16;
                        const strength = view.getUint8(agentOffset + 6);
                        if (strength < 120) {
                            continue;
                        }

                        const antipode = sector + this.field.sectors / 2;
                        const radius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                        const baseAngle = sector / this.field.sectors * Math.PI * 2;
                        const antiAngle = antipode / this.field.sectors * Math.PI * 2;
                        const x1 = Math.cos(baseAngle) * radius;
                        const y1 = Math.sin(baseAngle) * radius;
                        const x2 = Math.cos(antiAngle) * radius;
                        const y2 = Math.sin(antiAngle) * radius;

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = `rgba(120, 255, 244, ${0.06 + strength / 1024})`;
                        ctx.lineWidth = 1 + strength / 180;
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        }

        // O-29: Transdimensional Visual Parity (Plasmid Threads)
        this.plasmidGroups.clear();
        for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
            for (let rho = 0; rho < this.field.radial_bins; rho++) {
                for (let sector = 0; sector < this.field.sectors; sector++) {
                    const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                    const agentOffset = ptrAgents + idx * 16;
                    const p = view.getBigUint64(agentOffset + 8, true);
                    if (p !== 0n) {
                        const angle = sector / this.field.sectors * Math.PI * 2;
                        const ringRadius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                        const harmonicOffset = (harmonic - (this.field.harmonics - 1) / 2) * 3;
                        const x = Math.cos(angle) * (ringRadius + harmonicOffset);
                        const y = Math.sin(angle) * (ringRadius + harmonicOffset);
                        
                        let group = this.plasmidGroups.get(p);
                        if (!group) {
                            group = { count: 0, sumX: 0, sumY: 0 };
                            this.plasmidGroups.set(p, group);
                        }
                        group.count++;
                        group.sumX += x;
                        group.sumY += y;
                    }
                }
            }
        }

        ctx.save();
        ctx.translate(cx, cy);
        for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
            for (let rho = 0; rho < this.field.radial_bins; rho++) {
                for (let sector = 0; sector < this.field.sectors; sector++) {
                    const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                    const agentOffset = ptrAgents + idx * 16;
                    const p = view.getBigUint64(agentOffset + 8, true);
                    if (p !== 0n) {
                        const group = this.plasmidGroups.get(p);
                        if (group && group.count > 1) {
                            const angle = sector / this.field.sectors * Math.PI * 2;
                            const ringRadius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                            const harmonicOffset = (harmonic - (this.field.harmonics - 1) / 2) * 3;
                            const x = Math.cos(angle) * (ringRadius + harmonicOffset);
                            const y = Math.sin(angle) * (ringRadius + harmonicOffset);
                            
                            const cX = group.sumX / group.count;
                            const cY = group.sumY / group.count;

                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            ctx.lineTo(cX, cY);
                            // Hash the plasmid into a deterministic hue degree
                            const hashColor = Number(p % 360n);
                            ctx.strokeStyle = `hsla(${hashColor}, 90%, 65%, 0.12)`;
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        }
                    }
                }
            }
        }
        ctx.restore();

        for (let harmonic = 0; harmonic < this.field.harmonics; harmonic++) {
            for (let rho = 0; rho < this.field.radial_bins; rho++) {
                for (let sector = 0; sector < this.field.sectors; sector++) {
                    const idx = harmonic * this.field.radial_bins * this.field.sectors + rho * this.field.sectors + sector;
                    const agentOffset = ptrAgents + idx * 16;

                    const angle = sector / this.field.sectors * Math.PI * 2;
                    const ringRadius = maxRadius * ((rho + 1) / (this.field.radial_bins + 1));
                    const harmonicOffset = (harmonic - (this.field.harmonics - 1) / 2) * 3;
                    const x = cx + Math.cos(angle) * (ringRadius + harmonicOffset);
                    const y = cy + Math.sin(angle) * (ringRadius + harmonicOffset);

                    const currentTheta = view.getUint8(agentOffset);
                    const currentEntanglement = view.getUint8(agentOffset + 6);
                    const currentAmplitude = view.getUint8(agentOffset + 4);
                    const currentLock = view.getUint8(agentOffset + 5);

                    const hue = currentTheta / 255;
                    const saturation = 0.6 + currentEntanglement / 1024;
                    const value = 0.3 + currentAmplitude / 320;
                    const [r, g, b] = hsv2rgb(hue, Math.min(1, saturation), Math.min(1, value));
                    const alpha = 0.25 + Math.min(0.7, currentLock / 255 * 0.5 + currentAmplitude / 255 * 0.25);
                    const size = 1.4 + currentAmplitude / 100 + currentEntanglement / 220;

                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
                    ctx.shadowColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.45)`;
                    ctx.shadowBlur = 8 + currentEntanglement / 16;
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.font = "12px monospace";
        ctx.fillText(`phase lattice ${this.field.sectors}x${this.field.radial_bins}x${this.field.harmonics}`, 24, 28);
        ctx.fillText(`omega span ${phase_lattice_omega_span(this.field)}`, 24, 46);
    }
}
