import computeV2Src from './shaders/compute_v2.wgsl?raw';
import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class PhaseV2Renderer {
    private device: GPUDevice;
    private engine: OmegaV2Engine;

    private pipeline!: GPUComputePipeline;
    private bindGroup!: GPUBindGroup;

    private topologyBuffer!: GPUBuffer;
    private signalsBuffer!: GPUBuffer;
    private agentsBuffer!: GPUBuffer;

    constructor(device: GPUDevice, engine: OmegaV2Engine) {
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

        this.agentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        const shaderModule = this.device.createShaderModule({ code: computeV2Src });
        
        this.pipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'compute_main',
            },
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBuffer } },
            ],
        });

        console.log("✅ [V2-WEBGPU] Pipeline Assembled.");
    }
}
