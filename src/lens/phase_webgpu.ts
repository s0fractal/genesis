/// <reference types="@webgpu/types" />

import phaseLensWgsl from './shaders/phase_lens.wgsl?raw';
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";
import { PhaseComputeEngine } from './phase_compute.ts';

export class PhaseWebGPUObserver {
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

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, engine: PhaseComputeEngine, device: GPUDevice) {
        this.canvas = canvas;
        this.field = field;
        this.engine = engine;
        this.device = device;
        this.startTime = performance.now();
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

        // 112 bytes total structurally
        this.paramsBuffer = this.device.createBuffer({
            size: 112,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const shaderModule = this.device.createShaderModule({
            code: phaseLensWgsl 
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
    }

    render(activeFieldBuffer: GPUBuffer) {
        if (!this.device || !this.context) return;
        
        const activeBindGroup = activeFieldBuffer === this.engine.bufferA ? this.bindGroupA : this.bindGroupB;

        const numCells = this.field.cell_count();

        const time = (performance.now() - this.startTime) / 1000.0;
        const aspect = this.canvas.width / this.canvas.height;

        const uniformBuffer = new ArrayBuffer(48);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        viewU32[0] = this.field.sectors;
        viewU32[1] = this.field.radial_bins;
        viewU32[2] = this.field.harmonics;
        viewF32[3] = time;
        viewU32[4] = Math.floor(this.engine.offsets[0] / 4);
        viewU32[5] = Math.floor(this.engine.offsets[1] / 4);
        viewU32[6] = Math.floor(this.engine.offsets[2] / 4);
        viewU32[7] = Math.floor(this.engine.offsets[3] / 4);
        viewU32[8] = Math.floor(this.engine.offsets[4] / 4);
        viewU32[9] = Math.floor(this.engine.offsets[5] / 4);
        viewF32[10] = aspect;
        viewU32[11] = 0;

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
