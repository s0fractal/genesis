/// <reference types="@webgpu/types" />

import cullWgsl from './shaders/compute_cull.wgsl?raw';
import phaseLensWgsl from './shaders/phase_lens.wgsl?raw';
import * as C from "../shared/constants.ts";
import { Frustum, TorusQuadtree, OrbitCamera, mat4Perspective, mat4LookAt, createMat4, vec4TransformMat4, mat4Multiply } from "./math_3d.ts";
import { BioAcousticChoir } from "./audio_synth.ts";

export interface TopologyMetadata {
    sectors: number;
    radial_bins: number;
    harmonics: number;
    tau_depth: number;
    cell_count: number;
    ptr_agents: number;
    ptr_header: number;
    ptr_spatial_memory_theta?: () => number;
    ptr_spatial_memory_strength?: () => number;
}

export class PhaseWebGPUObserver {
    public heatmapEnabled: boolean = false;
    private canvas: HTMLCanvasElement;
    private device: GPUDevice | null;
    private context!: GPUCanvasContext | CanvasRenderingContext2D;
    private pipeline!: GPURenderPipeline;
    private bindGroup!: GPUBindGroup;
    private latticeBuffer!: GPUBuffer;
    private paramsBuffer!: GPUBuffer;
    private akashicThetaBuffer!: GPUBuffer;
    private akashicStrengthBuffer!: GPUBuffer;
    
    // Era 267: Frustum Culling Buffers
    private frustum!: Frustum;
    private quadtree!: TorusQuadtree;
    private cullPipeline!: GPUComputePipeline;
    private cullBindGroup!: GPUBindGroup;
    private indirectBuffer!: GPUBuffer;
    private indirectResetBuffer!: GPUBuffer;
    private visibleInstancesBuffer!: GPUBuffer;
    private quadNodesBuffer!: GPUBuffer;
    private cullParamsBuffer!: GPUBuffer;

    private metadata: TopologyMetadata;
    private startTime: number;
    public camera: OrbitCamera;
    public choir: BioAcousticChoir;
    private isDragging: boolean = false;
    private lastPinchDist = 0;
    private shadowXRayActive: boolean = false;
    private mouseNDC: {x: number, y: number} | null = null;
    private hoveredHash: bigint | null = null;
    public hoveredIdx: number | null = null;
    
    // Era 238: The Canvas Pool (Zero-Copy Observer)
    private snapshotCanvas?: HTMLCanvasElement;
    private snapshotCtx?: CanvasRenderingContext2D;
    
    // Inbound messaging port to relay God Hand actions back to worker
    public workerPort?: MessagePort;

    constructor(canvas: HTMLCanvasElement, metadata: TopologyMetadata, device: GPUDevice | null) {
        this.canvas = canvas;
        this.canvas.tabIndex = 0; // O-194: Accessibility Focus
        this.canvas.style.outline = "none";
        this.metadata = metadata;
        this.device = device;
        this.startTime = performance.now();
        
        this.camera = new OrbitCamera();
        this.camera.pitch = Math.PI / 4; // 45 degrees
        this.camera.distance = 6.0;
        this.choir = new BioAcousticChoir();
        
        if (this.device) {
            this.device.lost.then((info) => {
                console.warn(`[AION] WebGPU device lost: ${info.reason}`, info.message);
                // Broadcast collapse to trigger hard reload from Genesis Checkpoint
                globalThis.dispatchEvent(new CustomEvent("substrateCollapse", { detail: { reason: info.reason } }));
            });
        }
        
        this.setupInteractions();
    }
    
    private setupInteractions() {
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 0) this.isDragging = true;
            
            // Era 249: God Hand Immediate Injection via Worker
            if (this.hoveredIdx !== null && this.workerPort) {
                if (e.shiftKey) {
                    this.workerPort.postMessage({ type: 'GOD_HAND_ENERGY', idx: this.hoveredIdx, energy: Math.floor(Math.random() * 255) });
                    this.choir.triggerNoiseBurst(0, 0);
                } else if (e.altKey) {
                    this.workerPort.postMessage({ type: 'GOD_HAND_PLASMID', idx: this.hoveredIdx, hash: "0x0111222233334444" });
                    this.choir.triggerSineBell(0, 0);
                }
            }
            
            try {
                this.choir.init();
                this.choir.resume();
            } catch (_err) {
                // AudioContext resume might fail before user interaction is trusted
            }
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

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseNDC = {
                x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
                y: -(((e.clientY - rect.top) / rect.height) * 2 - 1)
            };
            
            // Era 249: God Hand Drag Injection
            if (this.hoveredIdx !== null && e.buttons === 1 && this.workerPort) {
                if (e.shiftKey) {
                    this.workerPort.postMessage({ type: 'GOD_HAND_ENERGY', idx: this.hoveredIdx, energy: Math.floor(Math.random() * 255) });
                } else if (e.altKey) {
                    this.workerPort.postMessage({ type: 'GOD_HAND_PLASMID', idx: this.hoveredIdx, hash: "0x0111222233334444" });
                }
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseNDC = null;
            if (this.hoveredHash !== null) {
                this.hoveredHash = null;
                this.hoveredIdx = null;
                globalThis.dispatchEvent(new CustomEvent('gridHover', { detail: null }));
            }
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
        // O-194: High-DPI Accessibility Scaling
        const dpr = globalThis.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
        }

        if (!this.device) {
            this.context = this.canvas.getContext('2d', { alpha: false, desynchronized: true }) as CanvasRenderingContext2D;
            return;
        }

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        
        const numCells = this.metadata.cell_count;
        const totalSize = numCells * 16;
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        (this.context as GPUCanvasContext).configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        this.latticeBuffer = this.device.createBuffer({
            size: totalSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Phase 15: The Akashic Field (Spatial Memory Grid)
        const spatialSize = this.metadata.sectors * this.metadata.radial_bins * this.metadata.harmonics;
        const alignedSpatialSize = Math.ceil(spatialSize / 4) * 4;
        this.akashicThetaBuffer = this.device.createBuffer({
            size: alignedSpatialSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.akashicStrengthBuffer = this.device.createBuffer({
            size: alignedSpatialSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Era 239: The Quantum Eye (Observer Effect) - 448 bytes total
        // 64 default bytes + 64 bytes VIEW + 64 bytes PROJ + 256 bytes (64 floats of sectorHeat)
        this.paramsBuffer = this.device.createBuffer({
            size: 448,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Era 267: GPU Indirect Frustum Culling Pipeline
        this.frustum = new Frustum();
        this.quadtree = new TorusQuadtree(this.metadata.sectors, this.metadata.radial_bins);

        this.indirectBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        
        this.indirectResetBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.indirectResetBuffer, 0, new Uint32Array([4, 0, 0, 0]));

        this.visibleInstancesBuffer = this.device.createBuffer({
            size: numCells * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.quadNodesBuffer = this.device.createBuffer({
            size: 1024 * 16, 
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        
        this.cullParamsBuffer = this.device.createBuffer({
            size: 32, // 8 x u32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const cullModule = this.device.createShaderModule({ code: cullWgsl });
        this.cullPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: cullModule, entryPoint: 'main' }
        });

        this.cullBindGroup = this.device.createBindGroup({
            layout: this.cullPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.cullParamsBuffer } },
                { binding: 1, resource: { buffer: this.indirectBuffer } },
                { binding: 2, resource: { buffer: this.visibleInstancesBuffer } },
                { binding: 3, resource: { buffer: this.quadNodesBuffer } }
            ]
        });
        
        const shaderModule = this.device.createShaderModule({
            code: phaseLensWgsl 
        });

        const pipelineConstants = {
            SHADOW_BUCKET_MIN: C.SENATE_SHADOW_BUCKET_MIN,
            SHADOW_BUCKET_MAX: C.SENATE_SHADOW_BUCKET_MAX,
        };

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                constants: pipelineConstants
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

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.latticeBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
                { binding: 2, resource: { buffer: this.akashicThetaBuffer } },
                { binding: 3, resource: { buffer: this.akashicStrengthBuffer } },
                { binding: 4, resource: { buffer: this.visibleInstancesBuffer } }
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

    render(sab: ArrayBufferLike, current_tau: number, sectorHeatArray?: Float32Array) {
        if (!this.context) return;
        
        const numCells = this.metadata.cell_count;

        // Era 243.3: CPU Render Boundary
        if (!this.device) {
            const ctx = this.context as CanvasRenderingContext2D;
            
            const side = Math.ceil(Math.sqrt(numCells));
            const w = this.canvas.width;
            const h = this.canvas.height;
            const cellW = w / side;
            const cellH = h / side;
            
            ctx.fillStyle = '#05080f';
            ctx.fillRect(0, 0, w, h);
            
            const ptrAgents = this.metadata.ptr_agents;
            const dv = new DataView(sab, ptrAgents, numCells * 16);
            
            for (let i = 0; i < numCells; i++) {
                const offset = i * 16;
                const plasmidLow = dv.getUint32(offset, true);
                const plasmidHigh = dv.getUint32(offset + 4, true);
                if (plasmidLow !== 0 || plasmidHigh !== 0) {
                    const cx = (i % side) * cellW;
                    const cy = Math.floor(i / side) * cellH;
                    
                    const r = (plasmidLow & 0xFF);
                    const g = ((plasmidLow >> 8) & 0xFF);
                    const b = ((plasmidLow >> 16) & 0xFF);
                    
                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    ctx.fillRect(cx, cy, cellW, cellH);
                }
            }
            return;
        }

        // Upload new array buffer slice onto VRAM
        const byteSize = numCells * 16;
        this.device.queue.writeBuffer(this.latticeBuffer, 0, sab as ArrayBuffer, this.metadata.ptr_agents, byteSize);

        if (this.metadata.ptr_spatial_memory_theta && this.metadata.ptr_spatial_memory_strength) {
            const spatialSize = this.metadata.sectors * this.metadata.radial_bins * this.metadata.harmonics;
            this.device.queue.writeBuffer(this.akashicThetaBuffer, 0, sab as ArrayBuffer, this.metadata.ptr_spatial_memory_theta(), spatialSize);
            this.device.queue.writeBuffer(this.akashicStrengthBuffer, 0, sab as ArrayBuffer, this.metadata.ptr_spatial_memory_strength(), spatialSize);
        }

        const time = (performance.now() - this.startTime) / 1000.0;
        const aspect = this.canvas.width / this.canvas.height;

        const uniformBuffer = new ArrayBuffer(448);
        const viewU32 = new Uint32Array(uniformBuffer);
        const viewF32 = new Float32Array(uniformBuffer);

        viewU32[0] = this.metadata.sectors;
        viewU32[1] = this.metadata.radial_bins;
        viewU32[2] = this.metadata.harmonics;
        viewU32[3] = this.metadata.tau_depth;
        viewU32[4] = current_tau;
        
        viewF32[5] = time;
        viewF32[6] = aspect;
        viewU32[7] = this.heatmapEnabled ? 1 : 0;
        
        viewU32[8] = 0;
        viewU32[9] = 0;
        viewU32[10] = 0;
        viewU32[11] = 0;
        viewU32[12] = 0;
        viewU32[13] = 0;
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
        
        // Era 239.2: Torus Sector Heat (The Topos Panopticon Array mapping)
        // 64 Float32s packed sequentially starting at float offset 48
        if (sectorHeatArray) {
            viewF32.set(sectorHeatArray, 48);
        }

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);

        const view_proj = createMat4();
        mat4Multiply(view_proj, proj, view);

        // Topos Raycasting Logic 
        if (this.mouseNDC) {
            let closestDist = Infinity;
            let closestIdx: number | null = null;
            let closestHash: bigint | null = null;
            let closestAmp = 0;
            let closestLock = 0;
            let closestEnt = 0;

            const dv = new DataView(sab, this.metadata.ptr_agents, numCells * 16);
            
            const vOut = new Float32Array(4);
            const vPos = new Float32Array(4);
            vPos[3] = 1.0;

            const layer_size = this.metadata.harmonics * this.metadata.radial_bins * this.metadata.sectors;
            const base_idx = current_tau * layer_size;

            for (let i = 0; i < layer_size; i++) {
                const idx = base_idx + i;
                const offset = idx * 16;
                const plasmid_low = dv.getUint32(offset, true);
                const plasmid_high = dv.getUint32(offset + 4, true);

                if (plasmid_low === 0 && plasmid_high === 0) continue;

                const harmonic = Math.floor(i / (this.metadata.radial_bins * this.metadata.sectors));
                const rem = i % (this.metadata.radial_bins * this.metadata.sectors);
                const rho = Math.floor(rem / this.metadata.sectors);
                const sector = rem % this.metadata.sectors;

                const _amplitude = dv.getUint8(offset + 13) / 255.0;
                const lock = dv.getUint8(offset + 14) / 255.0;
                const entanglement = dv.getUint8(offset + 15) / 255.0;
                
                const plasmid_amplitude = (plasmid_low >>> 24) & 0xFF;
                const plasmid_entanglement = (plasmid_low >>> 16) & 0xFF;
                const p_amp_norm = Math.max(0, Math.min(1.0, (plasmid_amplitude - 40) / 215));
                const p_ent_norm = Math.max(0, Math.min(1.0, plasmid_entanglement / 255));

                const angle = (sector / this.metadata.sectors) * Math.PI * 2;
                const radius_t = (rho + 1) / (this.metadata.radial_bins + 1);
                const major_radius = 2.8 * radius_t;
                
                const z = (harmonic - (this.metadata.harmonics - 1) * 0.5) * 0.6;
                const chrono_z = z + (p_amp_norm * 0.55);
                const wobble_z = Math.sin(time * 2.0 + angle * 4.0 + radius_t * 8.0) * 0.05 * (entanglement + (p_ent_norm * 2.5));

                vPos[0] = Math.cos(angle) * major_radius;
                vPos[1] = Math.sin(angle) * major_radius;
                vPos[2] = chrono_z + wobble_z;

                vec4TransformMat4(vOut, vPos, view_proj);
                
                if (vOut[3] > 0) { 
                    const ndcX = vOut[0] / vOut[3];
                    const ndcY = vOut[1] / vOut[3];
                    
                    const dx = ndcX - this.mouseNDC.x;
                    const dy = ndcY - this.mouseNDC.y;
                    const distSq = dx*dx + dy*dy;
                    
                    if (distSq < 0.005 && distSq < closestDist) { 
                        closestDist = distSq;
                        closestIdx = idx;
                        closestHash = BigInt(plasmid_low) | (BigInt(plasmid_high) << 32n);
                        closestAmp = plasmid_amplitude;
                        closestLock = Math.floor(lock * 255);
                        closestEnt = Math.floor(entanglement * 255);
                    }
                }
            }

            if (closestHash !== this.hoveredHash) {
                this.hoveredHash = closestHash;
                this.hoveredIdx = closestIdx;
                if (closestHash !== null) {
                    globalThis.dispatchEvent(new CustomEvent('gridHover', { detail: { hash: closestHash, amp: closestAmp, lock: closestLock, ent: closestEnt } }));
                } else {
                    globalThis.dispatchEvent(new CustomEvent('gridHover', { detail: null }));
                }
            }
        }

        // Era 267: GPU Compute Culling
        const commandEncoder = this.device.createCommandEncoder();

        // 1. Traverse CPU Quadtree
        this.frustum.update(view_proj);
        let visibleLeaves = this.quadtree.getVisibleLeaves(this.frustum);
        if (visibleLeaves.length > 1024) visibleLeaves = visibleLeaves.slice(0, 1024);

        if (visibleLeaves.length > 0) {
            const nodeData = new Uint32Array(visibleLeaves.length * 4);
            for (let i = 0; i < visibleLeaves.length; i++) {
                nodeData[i*4]   = visibleLeaves[i].minSector;
                nodeData[i*4+1] = visibleLeaves[i].maxSector;
                nodeData[i*4+2] = visibleLeaves[i].minRho;
                nodeData[i*4+3] = visibleLeaves[i].maxRho;
            }
            this.device.queue.writeBuffer(this.quadNodesBuffer, 0, nodeData);
        }

        const cullParams = new Uint32Array(8);
        cullParams[0] = numCells;
        cullParams[1] = this.metadata.sectors;
        cullParams[2] = this.metadata.radial_bins;
        cullParams[3] = this.metadata.harmonics;
        cullParams[4] = visibleLeaves.length;
        this.device.queue.writeBuffer(this.cullParamsBuffer, 0, cullParams);

        // 2. Reset DrawIndirect Counters
        commandEncoder.copyBufferToBuffer(this.indirectResetBuffer, 0, this.indirectBuffer, 0, 16);

        // 3. Dispatch Compute Cull
        if (visibleLeaves.length > 0) {
            const cullPass = commandEncoder.beginComputePass();
            cullPass.setPipeline(this.cullPipeline);
            cullPass.setBindGroup(0, this.cullBindGroup);
            cullPass.dispatchWorkgroups(Math.ceil(numCells / 256));
            cullPass.end();
        }

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.02, g: 0.03, b: 0.06, a: 1 },
                storeOp: 'store'
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        // Era 267: Draw only instances flagged visible by QuadTree bounds
        pass.drawIndirect(this.indirectBuffer, 0); 
        pass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    extractImageBase64(downscaleSize = 512): string {
        if (!this.snapshotCanvas || !this.snapshotCtx) {
            this.snapshotCanvas = document.createElement("canvas");
            this.snapshotCtx = this.snapshotCanvas.getContext("2d") as CanvasRenderingContext2D;
        }
        
        if (this.snapshotCanvas.width !== downscaleSize) {
            this.snapshotCanvas.width = downscaleSize;
            this.snapshotCanvas.height = downscaleSize;
        }

        this.snapshotCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, downscaleSize, downscaleSize);
        // Era 238: Slicing the JPEG buffer correctly for direct Ollama ingestion and reducing visual context bandwith
        const dataUrl = this.snapshotCanvas.toDataURL("image/jpeg", 0.7);
        return dataUrl.substring(dataUrl.indexOf(",") + 1);
    }
}
