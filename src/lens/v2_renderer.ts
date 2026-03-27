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
    private sineLutBuffer!: GPUBuffer;

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
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.agentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // 128 elements * 4 bytes (i32) = 512 bytes tightly packed Read-Only Storage Array
        this.sineLutBuffer = this.device.createBuffer({
            size: 512,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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

        const bindEntries = [
            { binding: 0, resource: { buffer: this.topologyBuffer } },
            { binding: 1, resource: { buffer: this.signalsBuffer } },
            { binding: 2, resource: { buffer: this.agentsBuffer } },
            { binding: 3, resource: { buffer: this.sineLutBuffer } },
            { binding: 4, resource: { buffer: this.intentBuffer } },
        ];

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: bindEntries,
        });

        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: bindEntries,
        });

        console.log("✅ [V2-WEBGPU] Pipeline Assembled.");
    }

    public tick() {
        this.engine.tick();
        const ptrs = this.engine.getMemoryPointers();

        this.device.queue.writeBuffer(this.topologyBuffer, 0, ptrs.uniformBytes, 0, 16);
        this.device.queue.writeBuffer(this.signalsBuffer, 0, ptrs.uniformBytes, 16, 16);
        this.device.queue.writeBuffer(this.intentBuffer, 0, ptrs.uniformBytes, 32, 16);
        this.device.queue.writeBuffer(this.agentsBuffer, 0, ptrs.agentBytes);

        // Upload LUT (Only once per frame is redundant since it's static, but ensures zero-cost pointer persistence)
        this.device.queue.writeBuffer(this.sineLutBuffer, 0, ptrs.sineLutBytes);

        const commandEncoder = this.device.createCommandEncoder();
        
        // 1. Compute Pass
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.computeBindGroup);
        
        const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
        const dispatchSize = Math.ceil(activeCount / 64);
        if (dispatchSize > 0) { passEncoder.dispatchWorkgroups(dispatchSize); }
        passEncoder.end();
        
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
            window.addEventListener('mousemove', (e) => {
                const rect = this.context.canvas.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
                const y = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
                
                const ix = Math.floor(x * 1000);
                const iy = Math.floor(y * 1000);
                
                const setIntent = this.engine.wasmInstance?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(ix, iy, 1000, 200);
            });
            window.addEventListener('mouseout', () => {
                const setIntent = this.engine.wasmInstance?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(0, 0, 0, 0);
            });
        }
        
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.renderBindGroup);
        if (activeCount > 0) { renderPassEncoder.draw(6, activeCount, 0, 0); }
        renderPassEncoder.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
}
