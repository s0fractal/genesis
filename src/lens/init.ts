/// <reference types="@webgpu/types" />

import lensWgsl from './shaders/lens.wgsl?raw';
import { Field } from "../../omega_core/pkg/omega_core.js";

export class LensObserver {
    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private bindGroup!: GPUBindGroup;
    private fieldBuffer!: GPUBuffer;
    private sab: SharedArrayBuffer | ArrayBuffer | null;
    private wasmField: Field | null = null;
    private wasmMemory: WebAssembly.Memory | null = null;
    private W: number = 256;
    private H: number = 256;

    constructor(canvas: HTMLCanvasElement, sab: SharedArrayBuffer | ArrayBuffer | null = null) {
        this.canvas = canvas;
        this.sab = sab;
    }

    public setWasmContext(wasmField: Field, memory: WebAssembly.Memory) {
        this.wasmField = wasmField;
        this.wasmMemory = memory;
    }

    async init() {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error("WebGPU not supported");
        
        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        // Contiguous 1,245,184 bytes (19 bytes per cell * 65536)
        this.fieldBuffer = this.device.createBuffer({
            size: 1245184,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const paramsBuffer = this.device.createBuffer({
            size: 8, // two u32s
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([this.W, this.H]));

        const shaderModule = this.device.createShaderModule({
            code: lensWgsl 
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
                targets: [{ format }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.fieldBuffer } },
                { binding: 1, resource: { buffer: paramsBuffer } }
            ]
        });
    }

    render() {
        if (!this.device || !this.context) return;

        if (this.wasmField && this.wasmMemory) {
            const S_I16 = 131072;
            const S_U8 = 65536;
            const S_U64 = 524288;
            const mem = this.wasmMemory.buffer;
            
            this.device.queue.writeBuffer(this.fieldBuffer, 0, new Uint8Array(mem, this.wasmField.ptr_x(), S_I16));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16, new Uint8Array(mem, this.wasmField.ptr_y(), S_I16));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2, new Uint8Array(mem, this.wasmField.ptr_theta_now(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8, new Uint8Array(mem, this.wasmField.ptr_theta_f1(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8*2, new Uint8Array(mem, this.wasmField.ptr_theta_f2(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8*3, new Uint8Array(mem, this.wasmField.ptr_theta_f3(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8*4, new Uint8Array(mem, this.wasmField.ptr_omega(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8*5, new Uint8Array(mem, this.wasmField.ptr_energy(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8*6, new Uint8Array(mem, this.wasmField.ptr_plasmids(), S_U64));
            this.device.queue.writeBuffer(this.fieldBuffer, S_I16*2 + S_U8*6 + S_U64, new Uint8Array(mem, this.wasmField.ptr_hebbian_locks(), S_U8));
        } else if (this.sab) {
            this.device.queue.writeBuffer(this.fieldBuffer, 0, new Uint8Array(this.sab as ArrayBuffer));
        }

        const commandEncoder = this.device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                storeOp: 'store'
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(4); // full screen quad
        pass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
