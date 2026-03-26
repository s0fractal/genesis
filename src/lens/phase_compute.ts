import computeKuramotoWgsl from './shaders/compute_kuramoto.wgsl?raw';
import generatedWgslConstants from './shaders/generated_constants.wgsl?raw';
import computeMycelialWgsl from './shaders/compute_mycelial.wgsl?raw';
import { PhaseLatticeField, execute_phase_lattice_tick } from "@wasm";
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
    public device: GPUDevice | null;
    public bufferA!: GPUBuffer;
    public bufferB!: GPUBuffer;
    public paramsBuffer!: GPUBuffer;
    public mycelialBuffer!: GPUBuffer;
    public haloLeftBuffer!: GPUBuffer;
    public haloRightBuffer!: GPUBuffer;
    public haloOutBuffer!: GPUBuffer;
    
    private pipeline!: GPUComputePipeline;
    private mycelialPipeline!: GPUComputePipeline;
    
    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;
    private mycelialBindGroupA!: GPUBindGroup;
    private mycelialBindGroupB!: GPUBindGroup;
    
    private field: PhaseLatticeField;
    public wasmMemory: WebAssembly.Memory;
    private isPingPongA: boolean = true;
    public offsets: number[] = [];
    private startTime: number;
    
    // Era 218: Pre-allocated Object Pool (Zero-GC Injection Queue)
    private readonly INJECTION_POOL_SIZE = 1024;
    private injectionPool: PendingInjection[] = [];
    private injectionHead = 0;
    private injectionTail = 0;

    private stagingPool: GPUBuffer[] = [];
    
    // O-200 Triplex Ring Buffering (Non-Blocking GPU Readbacks)
    private readbackRing: GPUBuffer[] = [];
    private ringIndex = 0;

    constructor(device: GPUDevice | null, field: PhaseLatticeField, memory: WebAssembly.Memory) {
        this.device = device;
        this.field = field;
        this.wasmMemory = memory;
        this.startTime = performance.now();
        
        if (this.device) {
            // Utilize generic wrapper for Deno WebGPU Type Compatibility bounds
            (this.device as unknown as { onuncapturederror: (e: { error: Error }) => void }).onuncapturederror = ((event: { error: Error }) => {
                console.error("[O-64 GPU FATAL]", event.error);
                const errDiv = document.getElementById('wgsl-err') || document.createElement('div');
                if (!errDiv.id) {
                    errDiv.id = 'wgsl-err';
                    errDiv.style.cssText = 'position:fixed;top:50px;left:10px;color:#ff3333;z-index:9999;font-size:12px;background:rgba(0,0,0,0.9);padding:10px;font-family:monospace;max-width:80vw;';
                    document.body.appendChild(errDiv);
                }
                errDiv.innerText += `[O-64 GPU]\n${event.error.message}\n\n`;
            });
        }
            
        for (let i = 0; i < this.INJECTION_POOL_SIZE; i++) {
            this.injectionPool.push({ idx: 0, bucket: 0, hashLow: 0, hashHigh: 0, amp: 0, phase: 0, ent: 0 });
        }
    }

    private getStagingBuffer(size: number): GPUBuffer {
        if (!this.device) return {} as GPUBuffer;
        
        const existing = this.stagingPool.find(b => b.size >= size && b.size <= size * 2 && b.mapState === 'unmapped');
        if (existing) return existing;
        const newBuf = this.device.createBuffer({
            size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        this.stagingPool.push(newBuf);
        return newBuf;
    }

    // deno-lint-ignore require-await
    async init() {
        if (!this.device) return;
        
        const numCells = this.field.cell_count();
        const AGENT_BYTES = 24;
        const totalSize = numCells * AGENT_BYTES;
        const haloSize = this.field.radial_bins * AGENT_BYTES;
        
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

        this.haloLeftBuffer = this.device.createBuffer({
            size: haloSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.haloRightBuffer = this.device.createBuffer({
            size: haloSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.haloOutBuffer = this.device.createBuffer({
            size: haloSize * 2,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // Seed deterministic WASM state into Buffer A
        const mem = this.wasmMemory.buffer;
        const f = this.field;
        // @ts-ignore ptr_agents maps array of structs natively
        const agentPtr = f.ptr_agents();
        
        this.device.queue.writeBuffer(this.bufferA, 0, new Uint8Array(mem, agentPtr, totalSize));
        this.device.queue.writeBuffer(this.bufferB, 0, new Uint8Array(mem, agentPtr, totalSize));

        const cleanKuramoto = computeKuramotoWgsl.replace(/\/\/ @polyfill[\s\S]*?\/\/ @end_polyfill/g, "");
        const cleanMycelial = computeMycelialWgsl.replace(/\/\/ @polyfill[\s\S]*?\/\/ @end_polyfill/g, "");
        
        const shaderModule = this.device.createShaderModule({ code: generatedWgslConstants + "\n" + cleanKuramoto });
        const mycelialModule = this.device.createShaderModule({ code: generatedWgslConstants + "\n" + cleanMycelial });

        this.pipeline = this.device.createComputePipeline({
            label: "Kuramoto Thermodynamic Physics Matrix",
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            }
        });

        this.mycelialPipeline = this.device.createComputePipeline({
            label: "Mycelial Centroid Matrix",
            layout: 'auto',
            compute: {
                module: mycelialModule,
                entryPoint: 'main',
            }
        });

        this.bindGroupA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferA } },
                { binding: 1, resource: { buffer: this.bufferB } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } },
                { binding: 4, resource: { buffer: this.haloLeftBuffer } },
                { binding: 5, resource: { buffer: this.haloRightBuffer } }
            ]
        });

        this.bindGroupB = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.bufferB } },
                { binding: 1, resource: { buffer: this.bufferA } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
                { binding: 3, resource: { buffer: this.mycelialBuffer } },
                { binding: 4, resource: { buffer: this.haloLeftBuffer } },
                { binding: 5, resource: { buffer: this.haloRightBuffer } }
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
        if (!this.device) {
            // Era 243.2: CPU Fallback Execution
            const numCells = this.field.cell_count();
            const ptrAgents = this.field.ptr_agents() as number;
            const dv = new DataView(this.wasmMemory.buffer, ptrAgents, numCells * 24);
            
            while (this.injectionHead !== this.injectionTail) {
                const inj = this.injectionPool[this.injectionHead];
                this.injectionHead = (this.injectionHead + 1) & (this.INJECTION_POOL_SIZE - 1);
                
                let targetIdx = inj.idx;
                if (inj.bucket !== undefined) {
                    targetIdx = Math.floor(Math.random() * numCells); 
                }
                
                const offset = targetIdx * 24;
                dv.setUint8(offset + 12, 255); // max amp
                dv.setUint8(offset + 13, inj.ent); // max lock
                dv.setUint32(offset, inj.hashLow, true);     // plasmid low
                dv.setUint32(offset + 4, inj.hashHigh, true); // plasmid high
            }
            
            execute_phase_lattice_tick(this.field);
            return;
        }

        const time = (performance.now() - this.startTime) / 1000.0;
        const uniformBuffer = new ArrayBuffer(112);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);
        const viewI32 = new Int32Array(uniformBuffer);

        let activeInj: PendingInjection | null = null;
        if (this.injectionHead !== this.injectionTail) {
            activeInj = this.injectionPool[this.injectionHead];
            this.injectionHead = (this.injectionHead + 1) & (this.INJECTION_POOL_SIZE - 1); // 1024 mask
        }

        viewU32[0] = this.field.sectors;
        viewU32[1] = this.field.radial_bins;
        viewU32[2] = this.field.harmonics;
        viewU32[3] = Math.floor(time * 1000);

        viewI32[4] = Math.round(C.KURAMOTO_COUPLING_BASE * C.MATH_Q_SCALE);
        viewI32[5] = Math.round(C.KURAMOTO_COUPLING_ANTIPODE * C.MATH_Q_SCALE);
        viewI32[6] = Math.round(C.KURAMOTO_COUPLING_HARMONIC_PEER * C.MATH_Q_SCALE);
        viewI32[7] = Math.round(C.KURAMOTO_COHERENCE_THRESHOLD_LOCK * C.MATH_Q_SCALE);
        viewI32[8] = Math.round(C.KURAMOTO_COHERENCE_THRESHOLD_HIGH * C.MATH_Q_SCALE);
        viewI32[9] = Math.round(C.KURAMOTO_ADOPTION_RESONANCE_THRESHOLD * C.MATH_Q_SCALE);
        viewI32[10] = Math.round(C.KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD * C.MATH_Q_SCALE);
        viewI32[11] = Math.round(C.KURAMOTO_COUPLING_PLASMID * C.MATH_Q_SCALE);

        viewU32[12] = 1820; // 16/9 in Q10 (1.777 * 1024)
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
        const physicalCells = this.field.sectors * this.field.radial_bins;
        const workgroupsMycelial = Math.ceil(numCells / 64);
        const workgroupsKuramoto = Math.ceil(physicalCells / 64);
        
        // Pass 0: Mycelial Aggregation (Accumulate Mean-Fields via Atomically)
        const pass0 = commandEncoder.beginComputePass();
        pass0.setPipeline(this.mycelialPipeline);
        pass0.setBindGroup(0, this.isPingPongA ? this.mycelialBindGroupA : this.mycelialBindGroupB);
        pass0.dispatchWorkgroups(workgroupsMycelial);
        pass0.end();

        // Pass 1: Kuramoto Evolution (Resolve Topological Forces)
        // A fresh compute pass guarantees a hardware memory barrier from Pass 0
        const pass1 = commandEncoder.beginComputePass();
        pass1.setPipeline(this.pipeline);
        pass1.setBindGroup(0, this.isPingPongA ? this.bindGroupA : this.bindGroupB);
        pass1.dispatchWorkgroups(workgroupsKuramoto);
        pass1.end();

        // O-194 Semantic Optimization Pipeline: Native Zero-Overhead Fossil Storage VRAM Migration (Bypassing WGSL execution)
        if (this.field.harmonics > 1) {
            const bytesPerCell = 24;
            const fossilOffset = physicalCells * bytesPerCell;
            const fossilSize = (numCells - physicalCells) * bytesPerCell;
            const src = this.isPingPongA ? this.bufferA : this.bufferB;
            const dst = this.isPingPongA ? this.bufferB : this.bufferA;
            commandEncoder.copyBufferToBuffer(src, fossilOffset, dst, fossilOffset, fossilSize);
        }

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
        const nextTail = (this.injectionTail + 1) & (this.INJECTION_POOL_SIZE - 1);
        if (nextTail === this.injectionHead) return; // Drop if queue full to preserve homeostasis
        
        // Era 240.3: Atomically secure the local pointer before async resolution (Kimi Audit)
        const currentTail = this.injectionTail;
        this.injectionTail = nextTail;

        const dec = decomposeHash(hash);
        const inj = this.injectionPool[currentTail];
        inj.idx = index;
        inj.bucket = undefined;
        inj.hashLow = dec.low;
        inj.hashHigh = dec.high;
        inj.amp = Math.max(20, dec.amp); 
        inj.phase = dec.phase;
        inj.ent = dec.ent;
    }

    injectPlasmidIntoBucket(bucketId: number, hash: bigint) {
        const nextTail = (this.injectionTail + 1) & (this.INJECTION_POOL_SIZE - 1);
        if (nextTail === this.injectionHead) return;
        
        // Era 240.3: Atomically secure the local pointer before async resolution (Kimi Audit)
        const currentTail = this.injectionTail;
        this.injectionTail = nextTail;

        const dec = decomposeHash(hash);
        const inj = this.injectionPool[currentTail];
        inj.idx = 0xFFFFFFFF;
        inj.bucket = bucketId;
        inj.hashLow = dec.low;
        inj.hashHigh = dec.high;
        inj.amp = Math.max(20, dec.amp); 
        inj.phase = dec.phase;
        inj.ent = dec.ent;
    }

    injectEnergy(index: number, phaseShift: number) {
        const nextTail = (this.injectionTail + 1) & (this.INJECTION_POOL_SIZE - 1);
        if (nextTail === this.injectionHead) return;
        
        // Era 240.3: Secure pointer synchronously
        const currentTail = this.injectionTail;
        this.injectionTail = nextTail;
        
        const inj = this.injectionPool[currentTail];
        inj.idx = index;
        inj.bucket = undefined;
        inj.hashLow = 0;
        inj.hashHigh = 0;
        inj.amp = 255;
        inj.phase = phaseShift;
        inj.ent = 255;
    }

    readMycelialCentroids(): Float32Array | null {
        if (!this.device) return null;
        
        const size = 16384; // 1024 buckets * 16 bytes
        
        // Lazy initialize the Triplex Buffer strictly
        if (this.readbackRing.length === 0) {
            for (let i = 0; i < 3; i++) {
                this.readbackRing.push(this.device.createBuffer({
                    size,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                }));
            }
        }
        
        const buf = this.readbackRing[this.ringIndex];
        
        if (buf.mapState === 'unmapped') {
            const commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(this.mycelialBuffer, 0, buf, 0, size);
            this.device.queue.submit([commandEncoder.finish()]);
            
            // Advance the ring
            this.ringIndex = (this.ringIndex + 1) % 3;
            
            // Map asynchronously without awaiting
            buf.mapAsync(GPUMapMode.READ).catch(e => {
                console.warn("[O-64 GPU] Triplex Map Failed:", e);
            });
            
            return null; // Return null intentionally to yield thread
        } else if (buf.mapState === 'mapped') {
            const mappedBuffer = buf.getMappedRange();
            const f32Data = new Float32Array(mappedBuffer.slice(0)); // copy the data
            buf.unmap();
            return f32Data;
        }

        return null;
    }

    // O-59 Persistent Substrate Serialization Hooks
    async extractPlasmidsBuffer(): Promise<BigUint64Array> {
        const numCells = this.field.cell_count();
        const data = new BigUint64Array(numCells);
        
        // Era 248: CPU-only Extraction Fallback
        if (!this.device) {
            const ptrAgents = this.field.ptr_agents() as number;
            const dv = new DataView(this.wasmMemory.buffer, ptrAgents, numCells * 24);
            for(let i=0; i<numCells; i++) {
                data[i] = dv.getBigUint64(i * 24 + 0, true);
            }
            return data;
        }
        
        const activeBuffer = this.getActiveBuffer();
        const size = numCells * 24; // 24 bytes per PhaseAgent
        
        const stagingBuffer = this.getStagingBuffer(size);

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(activeBuffer, 0, stagingBuffer, 0, size);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyBuffer = stagingBuffer.getMappedRange();
        const dataU8 = new Uint8Array(copyBuffer.slice(0));
        
        const dataView = new DataView(dataU8.buffer);
        // Extract the 64-bit Plasmid from offset 0 of each 24-byte AoS struct
        for(let i=0; i<numCells; i++) {
            data[i] = dataView.getBigUint64(i * 24 + 0, true);
        }
        
        stagingBuffer.unmap();
        // Zero-copy pooling mechanism
        
        return data;
    }

    async extractLocalHalosAsync(): Promise<{ left: Uint8Array, right: Uint8Array } | null> {
        if (!this.device) return null;
        
        const activeBuffer = this.getActiveBuffer();
        const AGENT_BYTES = 24;
        const radialBins = this.field.radial_bins;
        const sectors = this.field.sectors;
        
        const commandEncoder = this.device.createCommandEncoder();
        
        for (let rho = 0; rho < radialBins; rho++) {
            const srcOffset = (rho * sectors + 0) * AGENT_BYTES;
            const dstOffset = rho * AGENT_BYTES;
            commandEncoder.copyBufferToBuffer(activeBuffer, srcOffset, this.haloOutBuffer, dstOffset, AGENT_BYTES);
        }

        for (let rho = 0; rho < radialBins; rho++) {
            const srcOffset = (rho * sectors + (sectors - 1)) * AGENT_BYTES;
            const dstOffset = (radialBins * AGENT_BYTES) + (rho * AGENT_BYTES);
            commandEncoder.copyBufferToBuffer(activeBuffer, srcOffset, this.haloOutBuffer, dstOffset, AGENT_BYTES);
        }

        this.device.queue.submit([commandEncoder.finish()]);

        await this.haloOutBuffer.mapAsync(GPUMapMode.READ);
        const copyBuffer = this.haloOutBuffer.getMappedRange();
        
        const leftU8 = new Uint8Array(copyBuffer.slice(0, radialBins * AGENT_BYTES));
        const rightU8 = new Uint8Array(copyBuffer.slice(radialBins * AGENT_BYTES, 2 * radialBins * AGENT_BYTES));
        
        this.haloOutBuffer.unmap();
        
        return { left: leftU8, right: rightU8 };
    }

    ingestRemoteHalos(left: Uint8Array, right: Uint8Array) {
        if (!this.device) return;
        this.device.queue.writeBuffer(this.haloLeftBuffer, 0, left.buffer as unknown as ArrayBuffer, left.byteOffset, left.byteLength);
        this.device.queue.writeBuffer(this.haloRightBuffer, 0, right.buffer as unknown as ArrayBuffer, right.byteOffset, right.byteLength);
    }

    injectGridState(grid: Record<number, string>) {
        const numCells = this.field.cell_count();
        const AGENT_BYTES = 24; // Era 260 Struct Alignment
        const totalSize = numCells * AGENT_BYTES;
        const mem = this.wasmMemory.buffer;
        
        // @ts-ignore AoS mapping
        const agentPtr = this.field.ptr_agents();
        const dataU8 = new Uint8Array(mem, agentPtr, totalSize);
        const dataView = new DataView(dataU8.buffer, dataU8.byteOffset, dataU8.byteLength);

        dataU8.fill(0);

        for (const [idxStr, hashStr] of Object.entries(grid)) {
            const idx = parseInt(idxStr, 10);
            const hash = BigInt(hashStr);
            const offset = idx * AGENT_BYTES;
            
            // 8-byte aligned layout (24 Bytes Total):
            // 0: plasmid (64-bit)
            // 8: omega (16-bit)
            // 10: time_dilation (8-bit)
            // 11: preferred_theta (8-bit)
            // 12: theta (8-bit)
            // 13: energy (8-bit)
            // 14: lock (8-bit)
            // 15: entanglement (8-bit)
            // 16: memory_strength (8-bit)
            // 17-23: Padding
            
            dataView.setBigUint64(offset + 0, hash, true);
            dataView.setInt16(offset + 8, Number((hash >> 16n) & 0x07n) - 3, true); 
            dataView.setUint8(offset + 10, 0); 
            dataView.setUint8(offset + 11, Number((hash >> 8n) & 0xFFn)); 
            dataView.setUint8(offset + 12, Number((hash >> 8n) & 0xFFn)); 
            dataView.setUint8(offset + 13, Math.max(20, Number((hash >> 24n) & 0x3Fn))); 
            dataView.setUint8(offset + 14, 0); 
            dataView.setUint8(offset + 15, 0); 
            dataView.setUint8(offset + 16, 255); 
        }

        // Era 248: Protect GPU copy in CPU-only environments
        if (this.device) {
            // Parallel hardware pipeline teleportation using unified payload
            this.device.queue.writeBuffer(this.bufferA, 0, dataU8);
            this.device.queue.writeBuffer(this.bufferB, 0, dataU8);
        }
    }
}
