import { OmegaV2Engine } from '../environment/v2_bridge.ts';
import { RendererBuffers } from './renderer_buffers.ts';
import { RendererPipelines } from './renderer_modes.ts';
import { RendererDaemon } from './renderer_daemon.ts';
import { RendererReadback } from './renderer_readback.ts';

export class PhaseV2Renderer {
    private device: GPUDevice;
    private engine: OmegaV2Engine;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;

    private buffers!: RendererBuffers;
    private pipelines!: RendererPipelines;
    private daemon!: RendererDaemon;
    private readback!: RendererReadback;

    public get daemonState(): string {
        return this.daemon?.daemonState || "INITIALIZING";
    }

    constructor(context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat, engine: OmegaV2Engine) {
        this.context = context;
        this.format = format;
        this.device = device;
        this.engine = engine;
    }

    public async initialize() {
        console.log("🌌 [V2-WEBGPU] Initializing Zero-Copy Pipelines...");

        this.buffers = new RendererBuffers(this.device, this.engine);
        this.buffers.initialize();

        this.pipelines = new RendererPipelines(this.device, this.format, this.engine);
        await this.pipelines.initialize(this.buffers);

        this.daemon = new RendererDaemon(this.context, this.engine);
        this.daemon.bindGlobalEvents();

        this.readback = new RendererReadback(this.device, this.engine);
    }

    public setComputeMode(mode: 'v2' | 'toroidal') {
        this.pipelines.setComputeMode(mode, this.buffers);
    }

    public tick() {
        const ptrs = this.engine.getMemoryPointers();

        // Increment absolute_tick in WASM memory
        const tickView = new DataView(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 32, 32);
        const currentTick = tickView.getUint32(4, true);
        tickView.setUint32(4, currentTick + 1, true);

        // Upload uniforms
        this.buffers.writeUniforms(ptrs);

        let stablePtrs = ptrs;
        if (this.engine.memoryBuffer !== ptrs.wasmMemoryBuffer) {
            stablePtrs = this.engine.getMemoryPointers();
        }

        const commandEncoder = this.device.createCommandEncoder();
        
        let computePipeline: GPUComputePipeline;
        let computeBindGroup: GPUBindGroup;
        
        if (this.pipelines.useToroidalShader) {
            computePipeline = this.pipelines.toroidalComputePipeline;
            computeBindGroup = this.buffers.agentsPingPong === 0
                ? this.pipelines.computeBindGroupToroidalA
                : this.pipelines.computeBindGroupToroidalB;
        } else {
            this.device.queue.writeBuffer(this.buffers.intentBuffer, 0, stablePtrs.uniformBytes, 64, 128);
            commandEncoder.clearBuffer(this.buffers.newMeanFieldBuffer);
            
            computePipeline = this.pipelines.computePipeline;
            computeBindGroup = this.buffers.agentsPingPong === 0
                ? this.pipelines.computeBindGroupV2A
                : this.pipelines.computeBindGroupV2B;
        }
        
        const renderBindGroup = this.buffers.agentsPingPong === 0
            ? this.pipelines.renderBindGroupB 
            : this.pipelines.renderBindGroupA;
        
        // 1. Compute Pass
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, computeBindGroup);
        
        const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 32 + 8, 1)[0];
        const dispatchSize = Math.ceil(activeCount / 64);
        if (dispatchSize > 0) { passEncoder.dispatchWorkgroups(dispatchSize); }
        passEncoder.end();
        
        // Map global vector
        if (!this.pipelines.useToroidalShader && dispatchSize > 0) {
            commandEncoder.copyBufferToBuffer(this.buffers.newMeanFieldBuffer, 0, this.buffers.oldMeanFieldBuffer, 0, 8);
        }
        
        // Ping-pong: swap source/target
        this.buffers.agentsPingPong = 1 - this.buffers.agentsPingPong;
        
        // 2. Render Pass
        const renderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        
        renderPassEncoder.setPipeline(this.pipelines.renderPipeline);
        renderPassEncoder.setBindGroup(0, renderBindGroup);
        if (activeCount > 0) { renderPassEncoder.draw(6, activeCount, 0, 0); }
        renderPassEncoder.end();
        
        this.daemon.evaluate(activeCount);
        
        this.device.queue.submit([commandEncoder.finish()]);
    }

    public async readStateFromGPUAndHash(): Promise<{ goldenTrace: string, goldenTraceNum: number, snapshot: Uint8Array }> {
        return await this.readback.readStateFromGPUAndHash(this.buffers);
    }

    public overwriteGPUState(snapshot: Uint8Array) {
        this.readback.overwriteGPUState(snapshot, this.buffers);
    }
}
