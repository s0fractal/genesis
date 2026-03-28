import computeV2Src from './shaders/compute_v2.wgsl?raw';
import renderV2Src from './shaders/render_v2.wgsl?raw';
import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class PhaseV2Renderer {
    private device: GPUDevice;
    private engine: OmegaV2Engine;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;

    private computePipeline!: GPUComputePipeline;
    private renderPipeline!: GPURenderPipeline;
    private computeBindGroup!: GPUBindGroup;
    private renderBindGroup!: GPUBindGroup;

    private topologyBuffer!: GPUBuffer;
    private signalsBuffer!: GPUBuffer;
    private intentBuffer!: GPUBuffer;
    private agentsBuffer!: GPUBuffer;
    private stagingAgentsBuffer!: GPUBuffer;
    private sineLutBuffer!: GPUBuffer;
    
    // Era 4000: Global Order Parameter Feedback Loop
    private newMeanFieldBuffer!: GPUBuffer;
    private oldMeanFieldBuffer!: GPUBuffer;
    
    private _mouseBound: boolean = false;

    constructor(context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat, engine: OmegaV2Engine) {
        this.context = context;
        this.format = format;
        this.device = device;
        this.engine = engine;
    }

    public async initialize() {
        console.log("🌌 [V2-WEBGPU] Initializing Zero-Copy Pipelines...");

        const pointers = this.engine.getMemoryPointers();

        this.topologyBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.signalsBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.intentBuffer = this.device.createBuffer({
            size: 64, // 4 intents * 16 bytes each
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.agentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.stagingAgentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Initialize GPU with the Genesis State once
        this.device.queue.writeBuffer(this.agentsBuffer, 0, pointers.agentBytes);

        // 128 elements * 4 bytes (i32) = 512 bytes tightly packed Read-Only Storage Array
        this.sineLutBuffer = this.device.createBuffer({
            size: 512,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        
        // Era 4000: Ping-Pong Global Order Accumulator (8 bytes: i32 Cos, i32 Sin)
        this.newMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        
        this.oldMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        const computeModule = this.device.createShaderModule({ code: computeV2Src });
        const renderModule = this.device.createShaderModule({ code: renderV2Src });
        
        this.computePipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module: computeModule,
                entryPoint: 'compute_main',
            },
        });

        this.renderPipeline = await this.device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module: renderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: renderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                    }
                }],
            },
            primitive: {
                topology: 'triangle-list',
            }
        });

        const computeBindEntries = [
            { binding: 0, resource: { buffer: this.topologyBuffer } },
            { binding: 1, resource: { buffer: this.signalsBuffer } },
            { binding: 2, resource: { buffer: this.agentsBuffer } },
            { binding: 3, resource: { buffer: this.sineLutBuffer } },
            { binding: 4, resource: { buffer: this.intentBuffer } },
            { binding: 5, resource: { buffer: this.newMeanFieldBuffer } },
            { binding: 6, resource: { buffer: this.oldMeanFieldBuffer } },
        ];

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: computeBindEntries,
        });

        const renderBindEntries = [
            { binding: 0, resource: { buffer: this.topologyBuffer } },
            { binding: 1, resource: { buffer: this.signalsBuffer } },
            { binding: 2, resource: { buffer: this.agentsBuffer } },
        ];

        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: renderBindEntries,
        });

        console.log("✅ [V2-WEBGPU] Pipeline Assembled.");
    }

    public tick() {
        this.engine.tick();
        const ptrs = this.engine.getMemoryPointers();

        this.device.queue.writeBuffer(this.topologyBuffer, 0, ptrs.uniformBytes, 0, 16);
        this.device.queue.writeBuffer(this.signalsBuffer, 0, ptrs.uniformBytes, 16, 16);
        this.device.queue.writeBuffer(this.intentBuffer, 0, ptrs.uniformBytes, 32, 64);
        
        // Removed: this.device.queue.writeBuffer(this.agentsBuffer, 0, ptrs.agentBytes);
        // We do NOT overwrite the GPU state every frame anymore. WebGPU owns the matrix math.


        // Upload LUT (Only once per frame is redundant since it's static, but ensures zero-cost pointer persistence)
        this.device.queue.writeBuffer(this.sineLutBuffer, 0, ptrs.sineLutBytes);

        const commandEncoder = this.device.createCommandEncoder();
        
        // ERA 4000: Clear the atomic aggregation buffer for this frame's Mean Field reduction
        commandEncoder.clearBuffer(this.newMeanFieldBuffer);
        
        // 1. Compute Pass
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.computeBindGroup);
        
        const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
        const dispatchSize = Math.ceil(activeCount / 64);
        if (dispatchSize > 0) { passEncoder.dispatchWorkgroups(dispatchSize); }
        passEncoder.end();
        
        // ERA 4000: Map the newly reduced Global Vector into the historical reader buffer for the subsequent frame
        if (dispatchSize > 0) {
            commandEncoder.copyBufferToBuffer(this.newMeanFieldBuffer, 0, this.oldMeanFieldBuffer, 0, 8);
        }
        
        // 2. Render Pass
        const renderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        
        // --- 1010 Event Mapping ---
        if (!this._mouseBound) {
            this._mouseBound = true;
            globalThis.addEventListener('mousemove', (e: Event) => {
                const mouseEvent = e as MouseEvent;
                if (!(this.context.canvas instanceof HTMLCanvasElement)) return;
                const rect = this.context.canvas.getBoundingClientRect();
                const x = ((mouseEvent.clientX - rect.left) / rect.width) * 2.0 - 1.0;
                const y = -(((mouseEvent.clientY - rect.top) / rect.height) * 2.0 - 1.0);
                
                const ix = Math.floor(x * 1000);
                const iy = Math.floor(y * 1000);
                
                // Update Mesh broadcasting intent
                if ((globalThis as any)._v2Mesh) {
                    (globalThis as any)._v2Mesh.__lastLocalIntent = { x: ix, y: iy, m: 1000, r: 200 };
                }
                
                // Target Intent Slot 0 for local mouse
                const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(0, ix, iy, 1000, 200);
            });
            globalThis.addEventListener('mouseout', () => {
                if ((globalThis as any)._v2Mesh) {
                    (globalThis as any)._v2Mesh.__lastLocalIntent = { x: 0, y: 0, m: 0, r: 0 };
                }
                const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(0, 0, 0, 0, 0);
            });
        }
        
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.renderBindGroup);
        if (activeCount > 0) { renderPassEncoder.draw(6, activeCount, 0, 0); }
        renderPassEncoder.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }

    /** 
     * Era 2020: WebRTC Snapshot Extraction
     * Maps the GPU agents buffer into JS memory, then copies it into the Zero-Copy WASM pointer
     * Finally computes the deterministic Golden Trace checksum.
     */
    public async readStateFromGPUAndHash(): Promise<{ goldenTrace: string, snapshot: Uint8Array }> {
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.agentsBuffer, 0,
            this.stagingAgentsBuffer, 0,
            this.stagingAgentsBuffer.size
        );
        this.device.queue.submit([commandEncoder.finish()]);
        
        await this.stagingAgentsBuffer.mapAsync(GPUMapMode.READ);
        const copyArray = new Uint8Array(this.stagingAgentsBuffer.getMappedRange());
        
        // Make a clone of the snapshot to return to WebRTC
        const snapshot = new Uint8Array(copyArray);
        
        const ptrs = this.engine.getMemoryPointers();
        ptrs.agentBytes.set(snapshot); // Flush the memory back into the bare-metal Rust `.bss`
        
        // Era 3000: Execute the single-threaded CPU Darwinian Mitosis Sweep
        const mitosis = this.engine.wasm?.exports.v2_mitosis_sweep as CallableFunction;
        const numReplications = mitosis ? mitosis() as number : 0;
        
        // If the CPU mutated the matrix (cells died or split), we must re-upload the modified .bss to the GPU instantly
        if (numReplications > 0) {
             this.overwriteGPUState(ptrs.agentBytes);
             snapshot.set(ptrs.agentBytes); // Update the WebRTC snapshot reference to the post-mitosis state
        }
        
        this.stagingAgentsBuffer.unmap();
        
        // Execute the fast cryptographic O(N/1024) matrix hashing in WASM
        const traceNum = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)();
        return {
            goldenTrace: traceNum.toString(16).toUpperCase(),
            snapshot
        };
    }

    /** Overwrites the entire local GPU state with a WebRTC rollback snapshot */
    public overwriteGPUState(snapshot: Uint8Array) {
        this.device.queue.writeBuffer(this.agentsBuffer, 0, snapshot.buffer as ArrayBuffer, snapshot.byteOffset, snapshot.byteLength);
    }
}
