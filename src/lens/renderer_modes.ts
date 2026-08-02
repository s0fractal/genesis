import computeToroidalSrc from "./shaders/compute_toroidal.wgsl?raw";
import renderV2Src from "./shaders/render_v2.wgsl?raw";
import { RendererBuffers } from "./renderer_buffers.ts";
import { OmegaV2Engine } from "../environment/v2_bridge.ts";

export class RendererPipelines {
  private device: GPUDevice;
  private format: GPUTextureFormat;
  private engine: OmegaV2Engine;

  public toroidalComputePipeline!: GPUComputePipeline;
  public renderPipeline!: GPURenderPipeline;

  public computeBindGroupToroidalA!: GPUBindGroup;
  public computeBindGroupToroidalB!: GPUBindGroup;
  public renderBindGroupA!: GPUBindGroup;
  public renderBindGroupB!: GPUBindGroup;

  public useToroidalShader: boolean = true; // Hardcoded to Toroidal

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    engine: OmegaV2Engine,
  ) {
    this.device = device;
    this.format = format;
    this.engine = engine;
  }

  public async initialize(buffers: RendererBuffers) {
    const renderModule = this.device.createShaderModule({ code: renderV2Src });
    const toroidalModule = this.device.createShaderModule({
      code: computeToroidalSrc,
    });

    this.toroidalComputePipeline = await this.device.createComputePipelineAsync(
      {
        layout: "auto",
        compute: { module: toroidalModule, entryPoint: "compute_main" },
      },
    );

    this.renderPipeline = await this.device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vs_main" },
      fragment: {
        module: renderModule,
        entryPoint: "fs_main",
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        }],
      },
      primitive: { topology: "triangle-list" },
    });

    // Toroidal Mode — bindings MUST mirror compute_toroidal.wgsl exactly
    // (layout: 'auto'): 0 topology, 1 signals, 2 agents_in, 3 sine_lut,
    // 7 agents_out, 8 attractor_array. No binding 4 exists in the shader.
    this.computeBindGroupToroidalA = this.device.createBindGroup({
      layout: this.toroidalComputePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.topologyBuffer } },
        { binding: 1, resource: { buffer: buffers.signalsBuffer } },
        { binding: 2, resource: { buffer: buffers.agentsBufferA } },
        { binding: 3, resource: { buffer: buffers.sineLutBuffer } },
        { binding: 7, resource: { buffer: buffers.agentsBufferB } },
        { binding: 8, resource: { buffer: buffers.attractorBuffer } },
      ],
    });
    this.computeBindGroupToroidalB = this.device.createBindGroup({
      layout: this.toroidalComputePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.topologyBuffer } },
        { binding: 1, resource: { buffer: buffers.signalsBuffer } },
        { binding: 2, resource: { buffer: buffers.agentsBufferB } },
        { binding: 3, resource: { buffer: buffers.sineLutBuffer } },
        { binding: 7, resource: { buffer: buffers.agentsBufferA } },
        { binding: 8, resource: { buffer: buffers.attractorBuffer } },
      ],
    });

    // render_v2.wgsl: 0 topology, 1 signals, 2 agents.
    this.renderBindGroupA = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.topologyBuffer } },
        { binding: 1, resource: { buffer: buffers.signalsBuffer } },
        { binding: 2, resource: { buffer: buffers.agentsBufferA } },
      ],
    });
    this.renderBindGroupB = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.topologyBuffer } },
        { binding: 1, resource: { buffer: buffers.signalsBuffer } },
        { binding: 2, resource: { buffer: buffers.agentsBufferB } },
      ],
    });
  }

  public setComputeMode(mode: "toroidal", buffers: RendererBuffers) {
    this.useToroidalShader = true;
    console.log("🌌 [V2-WEBGPU] Mode: Toroidal (Phase parity) - ONE LAW");
    const ptrs = this.engine.getMemoryPointers();
    this.device.queue.writeBuffer(
      buffers.sineLutBuffer,
      0,
      ptrs.sineLutQ10Bytes,
    );
  }
}
