/// <reference types="@webgpu/types" />

import phaseLensWgsl from './shaders/phase_lens.wgsl?raw';
import { PhaseLatticeField } from "@wasm";
import { PhaseComputeEngine } from './phase_compute.ts';
import * as C from "../shared/constants.ts";
import { OrbitCamera, mat4Perspective, mat4LookAt, createMat4, vec4TransformMat4, mat4Multiply } from "./math_3d.ts";
import { BioAcousticChoir } from "./audio_synth.ts";

export class PhaseWebGPUObserver {
    public heatmapEnabled: boolean = false;
    private canvas: HTMLCanvasElement;
    private device: GPUDevice | null;
    private context!: GPUCanvasContext | CanvasRenderingContext2D;
    private pipeline!: GPURenderPipeline;
    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;
    private paramsBuffer!: GPUBuffer;
    private field: PhaseLatticeField;
    private engine: PhaseComputeEngine;
    private startTime: number;
    public camera: OrbitCamera;
    public choir: BioAcousticChoir;
    private isDragging: boolean = false;
    private lastPinchDist = 0;
    private shadowXRayActive: boolean = false;
    private mouseNDC: {x: number, y: number} | null = null;
    private hoveredHash: bigint | null = null;
    
    // Era 238: The Canvas Pool (Zero-Copy Observer)
    private snapshotCanvas?: HTMLCanvasElement;
    private snapshotCtx?: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement, field: PhaseLatticeField, engine: PhaseComputeEngine, device: GPUDevice | null) {
        this.canvas = canvas;
        this.canvas.tabIndex = 0; // O-194: Accessibility Focus
        this.canvas.style.outline = "none";
        this.field = field;
        this.engine = engine;
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
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseNDC = null;
            if (this.hoveredHash !== null) {
                this.hoveredHash = null;
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
        
        const _numCells = this.field.cell_count();
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        (this.context as GPUCanvasContext).configure({
            device: this.device,
            format,
            alphaMode: 'opaque'
        });

        // Era 239: The Quantum Eye (Observer Effect) - 448 bytes total
        // 64 default bytes + 64 bytes VIEW + 64 bytes PROJ + 256 bytes (64 floats of sectorHeat)
        this.paramsBuffer = this.device.createBuffer({
            size: 448,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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
        if (!this.context) return;
        
        const numCells = this.field.cell_count();

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
            
            const ptrAgents = this.field.ptr_agents() as number;
            const dv = new DataView(this.engine.wasmMemory.buffer, ptrAgents, numCells * 16);
            
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

        const activeBindGroup = activeFieldBuffer === this.engine.bufferA ? this.bindGroupA : this.bindGroupB;

        const time = (performance.now() - this.startTime) / 1000.0;
        const aspect = this.canvas.width / this.canvas.height;

        const uniformBuffer = new ArrayBuffer(448);
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
        
        // Era 239.2: Torus Sector Heat (The Topos Panopticon Array mapping)
        // 64 Float32s packed sequentially starting at float offset 48
        // deno-lint-ignore no-explicit-any
        const oracle = (this.engine as any).oracle;
        if (oracle && oracle.sectorHeat) {
            viewF32.set(oracle.sectorHeat, 48);
        }

        this.device.queue.writeBuffer(this.paramsBuffer, 0, uniformBuffer);

        const view_proj = createMat4();
        mat4Multiply(view_proj, proj, view);

        // Topos Raycasting Logic 
        if (this.mouseNDC) {
            let closestDist = Infinity;
            let closestHash: bigint | null = null;
            let closestAmp = 0;
            let closestLock = 0;
            let closestEnt = 0;

            const ptrAgents = this.field.ptr_agents() as number;
            const dv = new DataView(this.engine.wasmMemory.buffer, ptrAgents, numCells * 16);
            
            const vOut = new Float32Array(4);
            const vPos = new Float32Array(4);
            vPos[3] = 1.0;

            const current_tau = this.field.get_current_tau();
            const layer_size = this.field.harmonics * this.field.radial_bins * this.field.sectors;
            const base_idx = current_tau * layer_size;

            for (let i = 0; i < layer_size; i++) {
                const idx = base_idx + i;
                const offset = idx * 16;
                const plasmid_low = dv.getUint32(offset, true);
                const plasmid_high = dv.getUint32(offset + 4, true);

                if (plasmid_low === 0 && plasmid_high === 0) continue;

                const harmonic = Math.floor(i / (this.field.radial_bins * this.field.sectors));
                const rem = i % (this.field.radial_bins * this.field.sectors);
                const rho = Math.floor(rem / this.field.sectors);
                const sector = rem % this.field.sectors;

                const _amplitude = dv.getUint8(offset + 13) / 255.0;
                const lock = dv.getUint8(offset + 14) / 255.0;
                const entanglement = dv.getUint8(offset + 15) / 255.0;
                
                const plasmid_amplitude = (plasmid_low >>> 24) & 0xFF;
                const plasmid_entanglement = (plasmid_low >>> 16) & 0xFF;
                const p_amp_norm = Math.max(0, Math.min(1.0, (plasmid_amplitude - 40) / 215));
                const p_ent_norm = Math.max(0, Math.min(1.0, plasmid_entanglement / 255));

                const angle = (sector / this.field.sectors) * Math.PI * 2;
                const radius_t = (rho + 1) / (this.field.radial_bins + 1);
                const major_radius = 2.8 * radius_t;
                
                const z = (harmonic - (this.field.harmonics - 1) * 0.5) * 0.6;
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
                        closestHash = BigInt(plasmid_low) | (BigInt(plasmid_high) << 32n);
                        closestAmp = plasmid_amplitude;
                        closestLock = Math.floor(lock * 255);
                        closestEnt = Math.floor(entanglement * 255);
                    }
                }
            }

            if (closestHash !== this.hoveredHash) {
                this.hoveredHash = closestHash;
                if (closestHash !== null) {
                    globalThis.dispatchEvent(new CustomEvent('gridHover', { detail: { hash: closestHash, amp: closestAmp, lock: closestLock, ent: closestEnt } }));
                } else {
                    globalThis.dispatchEvent(new CustomEvent('gridHover', { detail: null }));
                }
            }
        }

        const commandEncoder = this.device.createCommandEncoder();

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
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
