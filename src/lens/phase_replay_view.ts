import { phaseDistance, projectCellToCartesian } from "../shared/phase_lattice.ts";
import type { PhaseField } from "../shared/phase_lattice.ts";
import type { PhaseReplayDiffSummary, ReplayCompareMode } from "../replay/phase_replay.ts";

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

interface ReplayRenderMeta {
    tick: number;
    totalTicks: number;
    compareMode: ReplayCompareMode;
    summary: PhaseReplayDiffSummary;
    title: string;
    statusLine: string;
    leftLabel: string;
    rightLabel: string;
}

export class PhaseReplayObserver {
    private canvas: HTMLCanvasElement;
    private context!: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public init(): void {
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("2D canvas not supported");
        }
        this.context = context;
    }

    public render(current: PhaseField, compare: PhaseField | null, meta: ReplayRenderMeta): void {
        if (!this.context) {
            return;
        }

        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) * 0.42;

        ctx.clearRect(0, 0, width, height);

        const bg = ctx.createRadialGradient(cx, cy, maxRadius * 0.04, cx, cy, maxRadius * 1.1);
        bg.addColorStop(0, "rgba(18, 44, 72, 0.24)");
        bg.addColorStop(0.45, "rgba(7, 14, 28, 0.38)");
        bg.addColorStop(1, "rgba(0, 0, 0, 0.96)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        drawRings(ctx, cx, cy, maxRadius, current.shape.radialBins);
        drawDiffField(ctx, current, compare, cx, cy, maxRadius);
        drawEntanglement(ctx, current, cx, cy, maxRadius);
        drawField(ctx, current, compare, cx, cy, maxRadius);
        drawLegend(ctx, meta, width, height);
    }
}

function drawRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxRadius: number,
    radialBins: number,
): void {
    ctx.save();
    ctx.translate(cx, cy);
    for (let ring = 1; ring <= radialBins; ring++) {
        const r = maxRadius * (ring / (radialBins + 1));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(126, 209, 255, ${0.05 + ring * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function drawEntanglement(
    ctx: CanvasRenderingContext2D,
    field: PhaseField,
    cx: number,
    cy: number,
    maxRadius: number,
): void {
    if (field.shape.sectors % 2 !== 0) {
        return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    for (let harmonic = 0; harmonic < field.shape.harmonics; harmonic++) {
        for (let rho = 0; rho < field.shape.radialBins; rho++) {
            for (let sector = 0; sector < field.shape.sectors / 2; sector++) {
                const index = harmonic * field.shape.radialBins * field.shape.sectors + rho * field.shape.sectors + sector;
                const cell = field.cells[index];
                if (cell.entanglement < 120) {
                    continue;
                }

                const antipodeSector = sector + field.shape.sectors / 2;
                const radius = maxRadius * ((rho + 1) / (field.shape.radialBins + 1));
                const baseAngle = (sector / field.shape.sectors) * Math.PI * 2;
                const antiAngle = (antipodeSector / field.shape.sectors) * Math.PI * 2;

                ctx.beginPath();
                ctx.moveTo(Math.cos(baseAngle) * radius, Math.sin(baseAngle) * radius);
                ctx.lineTo(Math.cos(antiAngle) * radius, Math.sin(antiAngle) * radius);
                ctx.strokeStyle = `rgba(90, 243, 229, ${0.04 + cell.entanglement / 900})`;
                ctx.lineWidth = 0.8 + cell.entanglement / 180;
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function drawDiffField(
    ctx: CanvasRenderingContext2D,
    current: PhaseField,
    compare: PhaseField | null,
    cx: number,
    cy: number,
    maxRadius: number,
): void {
    if (!compare) {
        return;
    }

    for (let index = 0; index < current.cells.length; index++) {
        const cell = current.cells[index];
        const previous = compare.cells[index];
        const thetaDelta = phaseDistance(cell.theta, previous.theta) / 128;
        const amplitudeDelta = Math.abs(cell.amplitude - previous.amplitude) / 255;
        const lockDelta = Math.abs(cell.lock - previous.lock) / 255;
        const entanglementDelta = Math.abs(cell.entanglement - previous.entanglement) / 255;
        const delta = Math.max(thetaDelta, amplitudeDelta, lockDelta, entanglementDelta);

        if (delta < 0.03) {
            continue;
        }

        const point = projectCellToCartesian(cell, current.shape, maxRadius / (current.shape.radialBins + 1));
        const x = cx + point.x;
        const y = cy + point.y;
        const radius = 2 + delta * 10;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 148, 64, ${0.12 + delta * 0.55})`;
        ctx.lineWidth = 0.8 + delta * 2.6;
        ctx.stroke();
    }
}

function drawField(
    ctx: CanvasRenderingContext2D,
    current: PhaseField,
    compare: PhaseField | null,
    cx: number,
    cy: number,
    maxRadius: number,
): void {
    for (let index = 0; index < current.cells.length; index++) {
        const cell = current.cells[index];
        const point = projectCellToCartesian(cell, current.shape, maxRadius / (current.shape.radialBins + 1));
        const harmonicOffset = (cell.harmonic - (current.shape.harmonics - 1) / 2) * 3;
        const angle = (cell.sector / current.shape.sectors) * Math.PI * 2;
        const x = cx + Math.cos(angle) * harmonicOffset + point.x;
        const y = cy + Math.sin(angle) * harmonicOffset + point.y;

        const hue = cell.theta / 255;
        const saturation = 0.58 + cell.entanglement / 1024;
        const value = 0.28 + cell.amplitude / 320;
        const [r, g, b] = hsv2rgb(hue, Math.min(1, saturation), Math.min(1, value));
        const alpha = 0.22 + Math.min(0.72, cell.lock / 255 * 0.42 + cell.amplitude / 255 * 0.32);
        const size = 1.25 + cell.amplitude / 108 + cell.entanglement / 240;

        ctx.beginPath();
        ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
        ctx.shadowColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.42)`;
        ctx.shadowBlur = 8 + cell.entanglement / 18;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        if (compare) {
            const previous = compare.cells[index];
            const omegaDelta = Math.abs(cell.omega - previous.omega);
            if (omegaDelta > 0) {
                ctx.beginPath();
                ctx.arc(x, y, size + 1.6, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.04 + Math.min(0.25, omegaDelta / 40)})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
        }
    }

    ctx.shadowBlur = 0;
}

function drawLegend(
    ctx: CanvasRenderingContext2D,
    meta: ReplayRenderMeta,
    width: number,
    height: number,
): void {
    const helperX = width < 720 ? 24 : width - 330;
    const helperY = width < 720 ? 64 : 28;
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = "12px monospace";
    ctx.fillText(`${meta.title} tick ${meta.tick}/${meta.totalTicks}`, 24, 28);
    ctx.fillText(meta.statusLine, 24, 46);
    ctx.fillText(
        `Δcells ${meta.summary.changedCells} | Δamp ${signed(meta.summary.totalAmplitudeDelta)} | Δlock ${signed(meta.summary.totalLockDelta)}`,
        24,
        height - 34,
    );
    ctx.fillText(
        `${meta.leftLabel} ${meta.summary.referenceStructuralSignature.slice(0, 12)} | ${meta.rightLabel} ${meta.summary.wasmStructuralSignature.slice(0, 12)} | θmax ${meta.summary.maxPhaseDistance}`,
        24,
        height - 16,
    );
    ctx.fillText("orange halos = diff magnitude vs comparison frame", helperX, helperY);
}

function signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
}
