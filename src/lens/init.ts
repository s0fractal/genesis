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
    public W: number = 256;
    public H: number = 256;
    private offsets: number[] = [];

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
        
        // --- Ontology 19: Dynamic Hardware Allocation ---
        const maxBinding = adapter.limits.maxStorageBufferBindingSize;
        // A single cell takes 19 bytes in our SoA struct
        const maxCells = Math.floor(maxBinding / 19);
        // Era 163 (Ontology 72): Forced 1400x800 Asymmetric Topology Stress Test
        this.W = 1400; 
        this.H = 800;
        const numCells = this.W * this.H;
        
        const S_I16 = numCells * 2; // bytes
        const S_U8 = numCells;
        const S_U64 = numCells * 8;
        
        // Compute precise unaligned 1D linear buffer accumulation offsets
        let cursor = 0;
        const offX = cursor; cursor += S_I16;
        const offY = cursor; cursor += S_I16;
        const offThetaNow = cursor; cursor += S_U8;
        const offThetaF1 = cursor; cursor += S_U8;
        const offThetaF2 = cursor; cursor += S_U8;
        const offThetaF3 = cursor; cursor += S_U8;
        const offOmega = cursor; cursor += S_U8;
        const offEnergy = cursor; cursor += S_U8;
        const offPlasmids = cursor; cursor += S_U64;
        const offHebbian = cursor; cursor += S_U8;
        
        this.offsets = [offX, offY, offThetaNow, offThetaF1, offThetaF2, offThetaF3, offOmega, offEnergy, offPlasmids, offHebbian];
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        // Contiguous dynamic scaling
        this.fieldBuffer = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const paramsBuffer = this.device.createBuffer({
            size: 40, // 2 dimensions + 8 offsets = 10 x u32 (40 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const uniformData = new Uint32Array([
            this.W, this.H, 
            offThetaNow/4, offEnergy/4, offPlasmids/4, offHebbian/4,
            0, 0, 0, 0 // padding for 16-byte WGSL alignment rules
        ]);
        this.device.queue.writeBuffer(paramsBuffer, 0, uniformData);

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
            const numCells = this.W * this.H;
            const S_I16 = numCells * 2;
            const S_U8 = numCells;
            const S_U64 = numCells * 8;
            const mem = this.wasmMemory.buffer;
            const f = this.wasmField;
            const off = this.offsets;
            
            this.device.queue.writeBuffer(this.fieldBuffer, off[0], new Uint8Array(mem, f.ptr_x(), S_I16));
            this.device.queue.writeBuffer(this.fieldBuffer, off[1], new Uint8Array(mem, f.ptr_y(), S_I16));
            this.device.queue.writeBuffer(this.fieldBuffer, off[2], new Uint8Array(mem, f.ptr_theta_now(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[3], new Uint8Array(mem, f.ptr_theta_f1(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[4], new Uint8Array(mem, f.ptr_theta_f2(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[5], new Uint8Array(mem, f.ptr_theta_f3(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[6], new Uint8Array(mem, f.ptr_omega(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[7], new Uint8Array(mem, f.ptr_energy(), S_U8));
            this.device.queue.writeBuffer(this.fieldBuffer, off[8], new Uint8Array(mem, f.ptr_plasmids(), S_U64));
            this.device.queue.writeBuffer(this.fieldBuffer, off[9], new Uint8Array(mem, f.ptr_hebbian_locks(), S_U8));
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
