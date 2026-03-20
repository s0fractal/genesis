/// <reference types="@webgpu/types" />

import phaseLensWgsl from './shaders/phase_lens.wgsl?raw';
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";

export class PhaseWebGPUObserver {
    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private bindGroup!: GPUBindGroup;
    private fieldBuffer!: GPUBuffer;
    private paramsBuffer!: GPUBuffer;
    private field: PhaseLatticeField;
    private wasmMemory: WebAssembly.Memory;
    private offsets: number[] = [];
    private startTime: number;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.canvas = canvas;
        this.field = field;
        this.wasmMemory = memory;
        this.startTime = performance.now();
    }

    async init() {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error("WebGPU not supported");
        
        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        
        const numCells = this.field.cell_count();
        const S_U8 = numCells;
        const S_I16 = numCells * 2;
        const S_U64 = numCells * 8;
        
        let cursor = 0;
        const offTheta = cursor; cursor += S_U8;
        const offOmega = cursor; cursor += S_I16;
        const offAmplitude = cursor; cursor += S_U8;
        const offLock = cursor; cursor += S_U8;
        const offEntanglement = cursor; cursor += S_U8;
        const offPlasmids = cursor; cursor += S_U64;
        
        this.offsets = [offTheta, offOmega, offAmplitude, offLock, offEntanglement, offPlasmids];
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        this.fieldBuffer = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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
            primitive: { topology: 'triangle-strip' },
            depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'always',
                format: 'depth24plus'
            }
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.fieldBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } }
            ]
        });
    }

    render() {
        if (!this.device || !this.context) return;

        const numCells = this.field.cell_count();
        const mem = this.wasmMemory.buffer;
        const f = this.field;
        const off = this.offsets;
        
        this.device.queue.writeBuffer(this.fieldBuffer, off[0], new Uint8Array(mem, f.ptr_theta(), numCells));
        this.device.queue.writeBuffer(this.fieldBuffer, off[1], new Uint8Array(mem, f.ptr_omega(), numCells * 2));
        this.device.queue.writeBuffer(this.fieldBuffer, off[2], new Uint8Array(mem, f.ptr_amplitude(), numCells));
        this.device.queue.writeBuffer(this.fieldBuffer, off[3], new Uint8Array(mem, f.ptr_lock(), numCells));
        this.device.queue.writeBuffer(this.fieldBuffer, off[4], new Uint8Array(mem, f.ptr_entanglement(), numCells));
        this.device.queue.writeBuffer(this.fieldBuffer, off[5], new Uint8Array(mem, f.ptr_plasmids(), numCells * 8));

        const time = (performance.now() - this.startTime) / 1000.0;
        const aspect = this.canvas.width / this.canvas.height;

        const uniformBuffer = new ArrayBuffer(48);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        viewU32[0] = f.sectors;
        viewU32[1] = f.radial_bins;
        viewU32[2] = f.harmonics;
        viewF32[3] = time;
        viewU32[4] = Math.floor(off[0] / 4);
        viewU32[5] = Math.floor(off[1] / 4);
        viewU32[6] = Math.floor(off[2] / 4);
        viewU32[7] = Math.floor(off[3] / 4);
        viewU32[8] = Math.floor(off[4] / 4);
        viewU32[9] = Math.floor(off[5] / 4);
        viewF32[10] = aspect;
        viewU32[11] = 0;

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);

        const commandEncoder = this.device.createCommandEncoder();
        
        // Pseudo depth pass (just ignoring depth but using depthStencilAttachment struct)
        const depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.02, g: 0.03, b: 0.06, a: 1 },
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(4, numCells); 
        pass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
