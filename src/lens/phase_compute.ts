import computeKuramotoWgsl from './shaders/compute_kuramoto.wgsl?raw';
import generatedBiologyWgsl from './shaders/generated_biology.wgsl?raw';
import computeMycelialWgsl from './shaders/compute_mycelial.wgsl?raw';
import { PhaseLatticeField } from "../../omega_core/pkg/omega_core.js";
import { generateWgslConstants } from "../shared/constants.ts";

interface PendingInjection {
    idx: number;
    bucket?: number;
    hashLow: number;
    hashHigh: number;
    amp: number;
    phase: number;
    ent: number;
}

export class PhaseComputeEngine {
    public device: GPUDevice;
    public bufferA!: GPUBuffer;
    public bufferB!: GPUBuffer;
    public paramsBuffer!: GPUBuffer;
    public mycelialBuffer!: GPUBuffer;
    
    private pipeline!: GPUComputePipeline;
    private mycelialPipeline!: GPUComputePipeline;
    
    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;
    private mycelialBindGroupA!: GPUBindGroup;
    private mycelialBindGroupB!: GPUBindGroup;
    
    private field: PhaseLatticeField;
    private wasmMemory: WebAssembly.Memory;
    private isPingPongA: boolean = true;
    public offsets: number[] = [];
    private startTime: number;
    private injections = new Map<number, PendingInjection>();

    constructor(device: GPUDevice, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.device = device;
        this.field = field;
        this.wasmMemory = memory;
        this.startTime = performance.now();
        
        // deno-lint-ignore no-explicit-any
        (this.device as any).onuncapturederror = ((event: any) => {
            console.error("[O-64 GPU FATAL]", event.error);
            const errDiv = document.getElementById('wgsl-err') || document.createElement('div');
            if (!errDiv.id) {
                errDiv.id = 'wgsl-err';
                errDiv.style.cssText = 'position:fixed;top:50px;left:10px;color:#ff3333;z-index:9999;font-size:12px;background:rgba(0,0,0,0.9);padding:10px;font-family:monospace;max-width:80vw;';
                document.body.appendChild(errDiv);
            }
            errDiv.innerText += `[O-64 GPU]\n${event.error.message}\n\n`;
            // deno-lint-ignore no-explicit-any
        }) as any;
    }

    // deno-lint-ignore require-await
    async init() {
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

        this.bufferA = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.bufferB = this.device.createBuffer({
            size: cursor,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.paramsBuffer = this.device.createBuffer({
            size: 112,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 1024 Mycelial Buckets * 16 bytes per bucket (i32, i32, u32, pad)
        this.mycelialBuffer = this.device.createBuffer({
            size: 16384,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // Seed deterministic WASM state into Buffer A
        const mem = this.wasmMemory.buffer;
        const f = this.field;
        this.device.queue.writeBuffer(this.bufferA, this.offsets[0], new Uint8Array(mem, f.ptr_theta(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[1], new Uint8Array(mem, f.ptr_omega(), numCells * 2));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[2], new Uint8Array(mem, f.ptr_amplitude(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[3], new Uint8Array(mem, f.ptr_lock(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[4], new Uint8Array(mem, f.ptr_entanglement(), numCells));
        this.device.queue.writeBuffer(this.bufferA, this.offsets[5], new Uint8Array(mem, f.ptr_plasmids(), numCells * 8));
        // Clone into B so atomic updates work on initialized memory
        this.device.queue.writeBuffer(this.bufferB, this.offsets[0], new Uint8Array(mem, f.ptr_theta(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[1], new Uint8Array(mem, f.ptr_omega(), numCells * 2));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[2], new Uint8Array(mem, f.ptr_amplitude(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[3], new Uint8Array(mem, f.ptr_lock(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[4], new Uint8Array(mem, f.ptr_entanglement(), numCells));
        this.device.queue.writeBuffer(this.bufferB, this.offsets[5], new Uint8Array(mem, f.ptr_plasmids(), numCells * 8));

        const shaderModule = this.device.createShaderModule({ code: generateWgslConstants() + generatedBiologyWgsl + "\n" + computeKuramotoWgsl });
        const mycelialModule = this.device.createShaderModule({ code: generateWgslConstants() + computeMycelialWgsl });

        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });

        this.mycelialPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: mycelialModule,
                entryPoint: 'main'
            }
        });

        this.bindGroupA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferA } },
                { binding: 1, resource: { buffer: this.bufferB } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });

        this.bindGroupB = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferB } },
                { binding: 1, resource: { buffer: this.bufferA } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });

        this.mycelialBindGroupA = this.device.createBindGroup({
            layout: this.mycelialPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferA } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });

        this.mycelialBindGroupB = this.device.createBindGroup({
            layout: this.mycelialPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferB } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } }
            ]
        });
    }

    tick() {
        if (!this.device) return;

        const time = (performance.now() - this.startTime) / 1000.0;
        const uniformBuffer = new ArrayBuffer(72);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        let activeInj: PendingInjection | null = null;
        for (const [idx, inj] of this.injections.entries()) {
            activeInj = inj;
            this.injections.delete(idx);
            break; // Process one injection per frame mathematically
        }

        viewU32[0] = this.field.sectors;
        viewU32[1] = this.field.radial_bins;
        viewU32[2] = this.field.harmonics;
        viewF32[3] = time;
        viewU32[4] = Math.floor(this.offsets[0] / 4);
        viewU32[5] = Math.floor(this.offsets[1] / 4);
        viewU32[6] = Math.floor(this.offsets[2] / 4);
        viewU32[7] = Math.floor(this.offsets[3] / 4);
        viewU32[8] = Math.floor(this.offsets[4] / 4);
        viewU32[9] = Math.floor(this.offsets[5] / 4);
        viewF32[10] = 16.0 / 9.0;
        viewU32[11] = activeInj ? activeInj.idx : 0xFFFFFFFF;
        viewU32[12] = activeInj ? activeInj.hashLow : 0;
        viewU32[13] = activeInj ? activeInj.hashHigh : 0;
        viewU32[14] = activeInj ? activeInj.amp : 0;
        viewU32[15] = activeInj ? activeInj.phase : 0;
        viewU32[16] = activeInj ? activeInj.ent : 0;
        viewU32[17] = activeInj && activeInj.bucket !== undefined ? activeInj.bucket : 0xFFFFFFFF;

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);
        
        // Zero-out the Mycelial buffer natively on the GPU (Zero-cost, zero-GC)
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.clearBuffer(this.mycelialBuffer, 0, 16384);

        const numCells = this.field.cell_count();
        const workgroups = Math.ceil(numCells / 64);
        
        // Pass 0: Mycelial Aggregation (Accumulate Mean-Fields via Atomically)
        const pass0 = commandEncoder.beginComputePass();
        pass0.setPipeline(this.mycelialPipeline);
        pass0.setBindGroup(0, this.isPingPongA ? this.mycelialBindGroupA : this.mycelialBindGroupB);
        pass0.dispatchWorkgroups(workgroups);
        pass0.end();

        // Pass 1: Kuramoto Evolution (Resolve Topological Forces)
        // A fresh compute pass guarantees a hardware memory barrier from Pass 0
        const pass1 = commandEncoder.beginComputePass();
        pass1.setPipeline(this.pipeline);
        pass1.setBindGroup(0, this.isPingPongA ? this.bindGroupA : this.bindGroupB);
        pass1.dispatchWorkgroups(workgroups);
        pass1.end();

        this.device.queue.submit([commandEncoder.finish()]);

        // Flip ping-pong.
        // If we compute reading A, output goes to B. Next flip reads B and outputs to A.
        this.isPingPongA = !this.isPingPongA;
    }

    getActiveBuffer(): GPUBuffer {
        // We just completed a tick, meaning the NEWEST data is in the buffer we WRITTEN to
        // If isPingPongA is now FALSE, we just finished executing A->B, so B is newest data.
        return this.isPingPongA ? this.bufferB : this.bufferA;
    }

    injectPlasmid(index: number, hash: bigint) {
        if (!this.device) return;
        const amp = Number((hash >> 24n) & 0xFFn);
        const phase = Number((hash >> 8n) & 0xFFn);
        const ent = Number((hash >> 16n) & 0xFFn);
        
        const inj = this.injections.get(index) || { idx: index, hashLow: 0, hashHigh: 0, amp: 200, phase: 0, ent: 128 };
        inj.hashLow = Number(hash & 0xFFFFFFFFn);
        inj.hashHigh = Number(hash >> 32n);
        inj.amp = Math.max(20, amp); 
        inj.phase = phase;
        inj.ent = ent;
        this.injections.set(index, inj);
    }

    private nextInjId = -1000;

    injectPlasmidIntoBucket(bucketId: number, hash: bigint) {
        if (!this.device) return;
        const injId = this.nextInjId--;
        const amp = Number((hash >> 24n) & 0xFFn);
        const phase = Number((hash >> 8n) & 0xFFn);
        const ent = Number((hash >> 16n) & 0xFFn);
        
        const inj = { 
            idx: 0xFFFFFFFF, 
            bucket: bucketId, 
            hashLow: Number(hash & 0xFFFFFFFFn), 
            hashHigh: Number(hash >> 32n), 
            amp: Math.max(20, amp), 
            phase: phase, 
            ent: ent 
        };
        this.injections.set(injId, inj);
    }

    injectEnergy(index: number, phaseShift: number) {
        if (!this.device) return;
        const inj = this.injections.get(index) || { idx: index, hashLow: 0, hashHigh: 0, amp: 0, phase: 0, ent: 0 };
        inj.amp = 255;
        inj.phase = phaseShift;
        inj.ent = 255;
        this.injections.set(index, inj);
    }

    async readMycelialCentroids(): Promise<Float32Array> {
        if (!this.device) return new Float32Array(0);
        
        const size = this.mycelialBuffer.size;
        const stagingBuffer = this.device.createBuffer({
            size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.mycelialBuffer, 0, stagingBuffer, 0, size);
        this.device.queue.submit([commandEncoder.finish()]);

        // Await the hardware transfer from VRAM to System RAM
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyBuffer = stagingBuffer.getMappedRange();
        const f32Data = new Float32Array(copyBuffer.slice(0));
        
        stagingBuffer.unmap();
        // Discard the staging bridge explicitly to free heap bounds
        stagingBuffer.destroy();
        
        return f32Data;
    }

    // O-59 Persistent Substrate Serialization Hooks
    async extractPlasmidsBuffer(): Promise<BigUint64Array> {
        if (!this.device) return new BigUint64Array(0);
        
        const activeBuffer = this.getActiveBuffer();
        const size = this.field.cell_count() * 8; // 8 bytes per u64
        const offset = this.offsets[5];
        
        const stagingBuffer = this.device.createBuffer({
            size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(activeBuffer, offset, stagingBuffer, 0, size);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyBuffer = stagingBuffer.getMappedRange();
        const data = new BigUint64Array(copyBuffer.slice(0));
        
        stagingBuffer.unmap();
        stagingBuffer.destroy();
        
        return data;
    }

    injectGridState(grid: Record<number, string>) {
        if (!this.device) return;
        
        const numCells = this.field.cell_count();
        const mem = this.wasmMemory.buffer;
        
        const thetaArray = new Uint8Array(mem, this.field.ptr_theta(), numCells);
        // @ts-ignore ptr_omega might exist but typescript field map is partial
        const omegaPtr = this.field.ptr_omega ? this.field.ptr_omega() : this.field.ptr_theta() + numCells;
        const omegaArray = new Int16Array(mem, omegaPtr, numCells);
        const ampArray = new Uint8Array(mem, this.field.ptr_amplitude(), numCells);
        const plasmids = new BigUint64Array(mem, this.field.ptr_plasmids(), numCells);
        
        thetaArray.fill(0);
        omegaArray.fill(0);
        ampArray.fill(0);
        plasmids.fill(0n);

        for (const [idxStr, hashStr] of Object.entries(grid)) {
            const idx = parseInt(idxStr, 10);
            const hash = BigInt(hashStr);
            
            plasmids[idx] = hash;
            ampArray[idx] = Math.max(20, Number((hash >> 24n) & 0x3Fn)); 
            thetaArray[idx] = Number((hash >> 8n) & 0xFFn);
            omegaArray[idx] = Number((hash >> 16n) & 0x07n) - 3;
        }

        // Parallel hardware pipeline teleportation
        this.device.queue.writeBuffer(this.bufferA, this.offsets[0], thetaArray);
        this.device.queue.writeBuffer(this.bufferA, this.offsets[1], omegaArray);
        this.device.queue.writeBuffer(this.bufferA, this.offsets[2], ampArray);
        this.device.queue.writeBuffer(this.bufferA, this.offsets[5], plasmids);
        
        this.device.queue.writeBuffer(this.bufferB, this.offsets[0], thetaArray);
        this.device.queue.writeBuffer(this.bufferB, this.offsets[1], omegaArray);
        this.device.queue.writeBuffer(this.bufferB, this.offsets[2], ampArray);
        this.device.queue.writeBuffer(this.bufferB, this.offsets[5], plasmids);
    }
}
