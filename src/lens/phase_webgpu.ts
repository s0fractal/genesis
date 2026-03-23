/// <reference types="@webgpu/types" />

import phaseLensWgsl from './shaders/phase_lens.wgsl?raw';
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";
import { PhaseComputeEngine } from './phase_compute.ts';
import { generateWgslConstants } from "../shared/constants.ts";
import { OrbitCamera, mat4Perspective, mat4LookAt, createMat4 } from "./math_3d.ts";

export class PhaseWebGPUObserver {
    public heatmapEnabled: boolean = false;
    private canvas: HTMLCanvasElement;
    private device: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;
    private paramsBuffer!: GPUBuffer;
    private field: PhaseLatticeField;
    private engine: PhaseComputeEngine;
    private startTime: number;
    public camera: OrbitCamera;
    private isDragging: boolean = false;
    private lastPinchDist = 0;
    private shadowXRayActive: boolean = false;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, engine: PhaseComputeEngine, device: GPUDevice) {
        this.canvas = canvas;
        this.field = field;
        this.engine = engine;
        this.device = device;
        this.startTime = performance.now();
        
        this.camera = new OrbitCamera();
        this.camera.pitch = Math.PI / 4; // 45 degrees
        this.camera.distance = 6.0;
        
        this.setupInteractions();
    }
    
    private setupInteractions() {
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 0) this.isDragging = true;
        });

        globalThis.addEventListener('pointerup', () => {
            this.isDragging = false;
            this.lastPinchDist = 0;
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            this.camera.yaw -= e.movementX * 0.01;
            this.camera.pitch += e.movementY * 0.01;
            
            // Clamp pitch to prevent flipping
            const PITCH_LIMIT = Math.PI / 2 - 0.05;
            if (this.camera.pitch > PITCH_LIMIT) this.camera.pitch = PITCH_LIMIT;
            if (this.camera.pitch < -PITCH_LIMIT) this.camera.pitch = -PITCH_LIMIT;
        });

        this.canvas.addEventListener('wheel', (e) => {
            this.camera.distance += e.deltaY * 0.01;
            if (this.camera.distance < 1.0) this.camera.distance = 1.0;
            if (this.camera.distance > 20.0) this.camera.distance = 20.0;
        }, { passive: true });
        
        // Touch scaling for pinch to zoom
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (this.lastPinchDist > 0) {
                    this.camera.distance += (this.lastPinchDist - dist) * 0.02;
                    if (this.camera.distance < 1.0) this.camera.distance = 1.0;
                    if (this.camera.distance > 20.0) this.camera.distance = 20.0;
                }
                this.lastPinchDist = dist;
            }
        }, { passive: true });
    }

    // deno-lint-ignore require-await
    async init() {
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        
        const _numCells = this.field.cell_count();
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        // 192 bytes total structurally (64 default bytes + 64 bytes VIEW + 64 bytes PROJ)
        this.paramsBuffer = this.device.createBuffer({
            size: 192,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const shaderModule = this.device.createShaderModule({
            code: generateWgslConstants() + phaseLensWgsl 
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        this.bindGroupA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.engine.bufferA } },
                { binding: 1, resource: { buffer: this.paramsBuffer } }
            ]
        });
        
        this.bindGroupB = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.engine.bufferB } },
                { binding: 1, resource: { buffer: this.paramsBuffer } }
            ]
        });

        // Era 171: The Shadow Network X-Ray Trigger
        globalThis.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'x') {
                this.shadowXRayActive = !this.shadowXRayActive;
                console.log(`☢️ [X-RAY] Latent Shadow Network Visibility: ${this.shadowXRayActive ? 'ON' : 'OFF'}`);
            }
        });
    }

    render(activeFieldBuffer: GPUBuffer) {
        if (!this.device || !this.context) return;
        
        const activeBindGroup = activeFieldBuffer === this.engine.bufferA ? this.bindGroupA : this.bindGroupB;

        const numCells = this.field.cell_count();

        const time = (performance.now() - this.startTime) / 1000.0;
        const aspect = this.canvas.width / this.canvas.height;

        const uniformBuffer = new ArrayBuffer(192);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        viewU32[0] = this.field.sectors;
        viewU32[1] = this.field.radial_bins;
        viewU32[2] = this.field.harmonics;
        viewU32[3] = this.field.tau_depth;
        viewU32[4] = this.field.get_current_tau();
        
        viewF32[5] = time;
        viewF32[6] = aspect;
        viewU32[7] = this.heatmapEnabled ? 1 : 0;
        
        viewU32[8] = Math.floor(this.engine.offsets[0] / 4);
        viewU32[9] = Math.floor(this.engine.offsets[1] / 4);
        viewU32[10] = Math.floor(this.engine.offsets[2] / 4);
        viewU32[11] = Math.floor(this.engine.offsets[3] / 4);
        viewU32[12] = Math.floor(this.engine.offsets[4] / 4);
        viewU32[13] = Math.floor(this.engine.offsets[5] / 4);
        viewU32[14] = this.shadowXRayActive ? 1 : 0; // O-129 X-Ray Toggle
        
        // Compute View and Proj Matrices
        const proj = createMat4();
        const view = createMat4();
        mat4Perspective(proj, Math.PI / 4, aspect, 0.1, 100.0);
        
        const cp = Math.cos(this.camera.pitch);
        const sp = Math.sin(this.camera.pitch);
        const cy = Math.cos(this.camera.yaw);
        const sy = Math.sin(this.camera.yaw);
        const eyeX = this.camera.targetX + this.camera.distance * cp * sy;
        const eyeY = this.camera.targetY + this.camera.distance * sp;
        const eyeZ = this.camera.targetZ + this.camera.distance * cp * cy;
        
        mat4LookAt(view, eyeX, eyeY, eyeZ, this.camera.targetX, this.camera.targetY, this.camera.targetZ, 0, 1, 0);

        // Inject Matrices sequentially into the single continuous Uniform Buffer
        viewF32.set(view, 16);  // Float offset 16 = Byte offset 64
        viewF32.set(proj, 32);  // Float offset 32 = Byte offset 128

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);

        const commandEncoder = this.device.createCommandEncoder();

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.02, g: 0.03, b: 0.06, a: 1 },
                storeOp: 'store'
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, activeBindGroup);
        pass.draw(4, numCells); 
        pass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    extractImageBase64(downscaleSize = 512): string {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = downscaleSize;
        tempCanvas.height = downscaleSize;
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, downscaleSize, downscaleSize);
            // Slice off the "data:image/png;base64," header correctly for direct Ollama ingestion
            const dataUrl = tempCanvas.toDataURL("image/png");
            return dataUrl.substring(dataUrl.indexOf(",") + 1);
        }
        return "";
    }
}
