import computeKuramotoWgsl from './shaders/compute_kuramoto.wgsl?raw';
import commonWgsl from './shaders/common.wgsl?raw';
import generatedWgslLut from './shaders/generated/lut_data.wgsl?raw';
import computeMycelialWgsl from './shaders/compute_mycelial.wgsl?raw';
import { PhaseLatticeField } from "@wasm";
import * as C from "../shared/constants.ts";

interface PendingInjection {
    idx: number;
    bucket?: number;
    hashLow: number;
    hashHigh: number;
    amp: number;
    phase: number;
    ent: number;
}

function decomposeHash(hash: bigint) {
    return {
        amp: Number((hash >> 24n) & 0xFFn),
        phase: Number((hash >> 8n) & 0xFFn),
        ent: Number((hash >> 16n) & 0xFFn),
        low: Number(hash & 0xFFFFFFFFn),
        high: Number(hash >> 32n),
    };
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
        const AGENT_BYTES = 16;
        const totalSize = numCells * AGENT_BYTES;
        
        this.offsets = [0]; // Deprecated, keeping array for compatibility

        this.bufferA = this.device.createBuffer({
            size: totalSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.bufferB = this.device.createBuffer({
            size: totalSize,
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
        // @ts-ignore ptr_agents maps array of structs natively
        const agentPtr = f.ptr_agents();
        
        this.device.queue.writeBuffer(this.bufferA, 0, new Uint8Array(mem, agentPtr, totalSize));
        this.device.queue.writeBuffer(this.bufferB, 0, new Uint8Array(mem, agentPtr, totalSize));

        const fullCommonWgsl = generatedWgslLut + "\n" + commonWgsl;
        const shaderModule = this.device.createShaderModule({ code: fullCommonWgsl + "\n" + computeKuramotoWgsl });
        const mycelialModule = this.device.createShaderModule({ code: fullCommonWgsl + "\n" + computeMycelialWgsl });

        const pipelineConstants = {
            PHASE_LUT_SIZE: C.PHASE_LUT_SIZE,
            MAX_AMPLITUDE: C.PHASE_MAX_AMPLITUDE,
            MAX_ENTANGLEMENT: C.PHASE_MAX_ENTANGLEMENT,
            MAX_OMEGA: C.PHASE_MAX_OMEGA,
            SHADOW_BUCKET_MIN: C.SENATE_SHADOW_BUCKET_MIN,
            SHADOW_BUCKET_MAX: C.SENATE_SHADOW_BUCKET_MAX,
        };

        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
                constants: pipelineConstants
            }
        });

        this.mycelialPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: mycelialModule,
                entryPoint: 'main',
                constants: pipelineConstants
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
        const uniformBuffer = new ArrayBuffer(112);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);
        const viewI32 = new Int32Array(uniformBuffer);

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

        viewI32[4] = Math.round(C.KURAMOTO_COUPLING_BASE * C.MATH_Q_SCALE);
        viewI32[5] = Math.round(C.KURAMOTO_COUPLING_ANTIPODE * C.MATH_Q_SCALE);
        viewI32[6] = Math.round(C.KURAMOTO_COUPLING_HARMONIC_PEER * C.MATH_Q_SCALE);
        viewI32[7] = Math.round(C.KURAMOTO_COHERENCE_THRESHOLD_LOCK * C.MATH_Q_SCALE);
        viewI32[8] = Math.round(C.KURAMOTO_COHERENCE_THRESHOLD_HIGH * C.MATH_Q_SCALE);
        viewI32[9] = Math.round(C.KURAMOTO_ADOPTION_RESONANCE_THRESHOLD * C.MATH_Q_SCALE);
        viewI32[10] = Math.round(C.KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD * C.MATH_Q_SCALE);
        viewI32[11] = Math.round(C.KURAMOTO_COUPLING_PLASMID * C.MATH_Q_SCALE);

        viewF32[12] = 16.0 / 9.0;
        viewU32[13] = activeInj ? activeInj.idx : 0xFFFFFFFF;
        viewU32[14] = activeInj ? activeInj.hashLow : 0;
        viewU32[15] = activeInj ? activeInj.hashHigh : 0;
        viewU32[16] = activeInj ? activeInj.amp : 0;
        viewU32[17] = activeInj ? activeInj.phase : 0;
        viewU32[18] = activeInj ? activeInj.ent : 0;
        viewU32[19] = activeInj && activeInj.bucket !== undefined ? activeInj.bucket : 0xFFFFFFFF;

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
        const dec = decomposeHash(hash);
        
        const inj = this.injections.get(index) || { idx: index, hashLow: 0, hashHigh: 0, amp: 200, phase: 0, ent: 128 };
        inj.hashLow = dec.low;
        inj.hashHigh = dec.high;
        inj.amp = Math.max(20, dec.amp); 
        inj.phase = dec.phase;
        inj.ent = dec.ent;
        this.injections.set(index, inj);
    }

    private nextInjId = -1000;

    injectPlasmidIntoBucket(bucketId: number, hash: bigint) {
        if (!this.device) return;
        const injId = this.nextInjId--;
        const dec = decomposeHash(hash);
        
        const inj = { 
            idx: 0xFFFFFFFF, 
            bucket: bucketId, 
            hashLow: dec.low, 
            hashHigh: dec.high, 
            amp: Math.max(20, dec.amp), 
            phase: dec.phase, 
            ent: dec.ent 
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
        const numCells = this.field.cell_count();
        const size = numCells * 16; // 16 bytes per PhaseAgent
        
        const stagingBuffer = this.device.createBuffer({
            size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(activeBuffer, 0, stagingBuffer, 0, size);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyBuffer = stagingBuffer.getMappedRange();
        const dataU8 = new Uint8Array(copyBuffer.slice(0));
        
        const data = new BigUint64Array(numCells);
        const dataView = new DataView(dataU8.buffer);
        // Extract the 64-bit Plasmid from offset 8 of each 16-byte AoS struct
        for(let i=0; i<numCells; i++) {
            data[i] = dataView.getBigUint64(i * 16 + 8, true);
        }
        
        stagingBuffer.unmap();
        stagingBuffer.destroy();
        
        return data;
    }

    injectGridState(grid: Record<number, string>) {
        if (!this.device) return;
        
        const numCells = this.field.cell_count();
        const AGENT_BYTES = 16;
        const totalSize = numCells * AGENT_BYTES;
        const mem = this.wasmMemory.buffer;
        
        // @ts-ignore AoS mapping
        const agentPtr = this.field.ptr_agents();
        const dataU8 = new Uint8Array(mem, agentPtr, totalSize);
        const dataView = new DataView(dataU8.buffer, dataU8.byteOffset, dataU8.byteLength);

        // Zero out memory
        dataU8.fill(0);

        for (const [idxStr, hashStr] of Object.entries(grid)) {
            const idx = parseInt(idxStr, 10);
            const hash = BigInt(hashStr);
            const offset = idx * AGENT_BYTES;
            
            dataView.setUint8(offset + 0, Number((hash >> 8n) & 0xFFn)); // theta
            dataView.setUint8(offset + 1, Math.max(20, Number((hash >> 24n) & 0x3Fn))); // energy
            dataView.setInt16(offset + 2, Number((hash >> 16n) & 0x07n) - 3, true); // omega
            // lock = 0, ent = 0, pad = 0
            dataView.setBigUint64(offset + 8, hash, true); // plasmid
        }

        // Parallel hardware pipeline teleportation using unified payload
        this.device.queue.writeBuffer(this.bufferA, 0, dataU8);
        this.device.queue.writeBuffer(this.bufferB, 0, dataU8);
    }
}
