import computeV2Src from './shaders/compute_v2.wgsl?raw';
import computeToroidalSrc from './shaders/compute_toroidal.wgsl?raw';
import renderV2Src from './shaders/render_v2.wgsl?raw';
import { RendererBuffers } from './renderer_buffers.ts';
import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class RendererPipelines {
    private device: GPUDevice;
    private format: GPUTextureFormat;
    private engine: OmegaV2Engine;

    public computePipeline!: GPUComputePipeline;
    public toroidalComputePipeline!: GPUComputePipeline;
    public renderPipeline!: GPURenderPipeline;

    public computeBindGroupV2A!: GPUBindGroup;
    public computeBindGroupV2B!: GPUBindGroup;
    public computeBindGroupToroidalA!: GPUBindGroup;
    public computeBindGroupToroidalB!: GPUBindGroup;
    public renderBindGroupA!: GPUBindGroup;
    public renderBindGroupB!: GPUBindGroup;

    public useToroidalShader: boolean = false;

    constructor(device: GPUDevice, format: GPUTextureFormat, engine: OmegaV2Engine) {
        this.device = device;
        this.format = format;
        this.engine = engine;
    }

    public async initialize(buffers: RendererBuffers) {
        const computeModule = this.device.createShaderModule({ code: computeV2Src });
        const renderModule = this.device.createShaderModule({ code: renderV2Src });
        const toroidalModule = this.device.createShaderModule({ code: computeToroidalSrc });
        
        this.computePipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: { module: computeModule, entryPoint: 'compute_main' },
        });

        this.toroidalComputePipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: { module: toroidalModule, entryPoint: 'compute_main' },
        });

        this.renderPipeline = await this.device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: { module: renderModule, entryPoint: 'vs_main' },
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
            primitive: { topology: 'triangle-list' }
        });

        // Era 2088: Pre-allocate all ping-pong bind groups once
        this.computeBindGroupV2A = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffers.topologyBuffer } },
                { binding: 1, resource: { buffer: buffers.signalsBuffer } },
                { binding: 2, resource: { buffer: buffers.agentsBufferA } },
                { binding: 3, resource: { buffer: buffers.sineLutBuffer } },
                { binding: 4, resource: { buffer: buffers.intentBuffer } },
                { binding: 5, resource: { buffer: buffers.newMeanFieldBuffer } },
                { binding: 6, resource: { buffer: buffers.oldMeanFieldBuffer } },
                { binding: 7, resource: { buffer: buffers.agentsBufferB } },
                { binding: 8, resource: { buffer: buffers.attractorBuffer } },
            ],
        });
        this.computeBindGroupV2B = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffers.topologyBuffer } },
                { binding: 1, resource: { buffer: buffers.signalsBuffer } },
                { binding: 2, resource: { buffer: buffers.agentsBufferB } },
                { binding: 3, resource: { buffer: buffers.sineLutBuffer } },
                { binding: 4, resource: { buffer: buffers.intentBuffer } },
                { binding: 5, resource: { buffer: buffers.newMeanFieldBuffer } },
                { binding: 6, resource: { buffer: buffers.oldMeanFieldBuffer } },
                { binding: 7, resource: { buffer: buffers.agentsBufferA } },
                { binding: 8, resource: { buffer: buffers.attractorBuffer } },
            ],
        });

        this.computeBindGroupToroidalA = this.device.createBindGroup({
            layout: this.toroidalComputePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffers.topologyBuffer } },
                { binding: 1, resource: { buffer: buffers.signalsBuffer } },
                { binding: 2, resource: { buffer: buffers.agentsBufferA } },
                { binding: 3, resource: { buffer: buffers.sineLutBuffer } },
                { binding: 4, resource: { buffer: buffers.intentBuffer } },
                { binding: 7, resource: { buffer: buffers.agentsBufferB } },
            ],
        });
        this.computeBindGroupToroidalB = this.device.createBindGroup({
            layout: this.toroidalComputePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffers.topologyBuffer } },
                { binding: 1, resource: { buffer: buffers.signalsBuffer } },
                { binding: 2, resource: { buffer: buffers.agentsBufferB } },
                { binding: 3, resource: { buffer: buffers.sineLutBuffer } },
                { binding: 4, resource: { buffer: buffers.intentBuffer } },
                { binding: 7, resource: { buffer: buffers.agentsBufferA } },
            ],
        });

        this.renderBindGroupA = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffers.topologyBuffer } },
                { binding: 1, resource: { buffer: buffers.agentsBufferA } },
            ],
        });
        this.renderBindGroupB = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffers.topologyBuffer } },
                { binding: 1, resource: { buffer: buffers.agentsBufferB } },
            ],
        });
    }

    public setComputeMode(mode: 'v2' | 'toroidal', buffers: RendererBuffers) {
        if (mode === 'toroidal') {
            this.useToroidalShader = true;
            console.log("🌌 [V2-WEBGPU] Mode: Toroidal (Phase parity)");
            const ptrs = this.engine.getMemoryPointers();
            this.device.queue.writeBuffer(buffers.sineLutBuffer, 0, ptrs.sineLutQ10Bytes);
        } else {
            this.useToroidalShader = false;
            console.log("🌌 [V2-WEBGPU] Mode: V2 (Mean Field + intents)");
            const ptrs = this.engine.getMemoryPointers();
            if (buffers.sineLutBuffer) {
                this.device.queue.writeBuffer(buffers.sineLutBuffer, 0, ptrs.sineLutBytes);
            }
        }
    }
}
