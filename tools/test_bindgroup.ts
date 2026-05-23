import computeHoloWgsl from "../src/lens/shaders/compute_hologram.wgsl" with {
  type: "text",
};
import holoLensWgsl from "../src/lens/shaders/holo_lens.wgsl" with {
  type: "text",
};

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter!.requestDevice();

const texture2d = device.createTexture({
  size: { width: 4, height: 4, depthOrArrayLayers: 4 },
  format: "rgba8unorm",
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

const computeHoloModule = device.createShaderModule({ code: computeHoloWgsl });
const pipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module: computeHoloModule, entryPoint: "compute_main" },
});

try {
  device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.STORAGE,
          }),
        },
      },
      {
        binding: 1,
        resource: {
          buffer: device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM,
          }),
        },
      },
      { binding: 2, resource: texture2d.createView() },
    ],
  });
  console.log("BindGroup 2D successful? BAD!");
} catch (e) {
  console.log("BindGroup 2D failed as expected: ", e.message);
}

const texture3d = device.createTexture({
  dimension: "3d", // The fix!
  size: { width: 4, height: 4, depthOrArrayLayers: 4 },
  format: "rgba8unorm",
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

try {
  device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.STORAGE,
          }),
        },
      },
      {
        binding: 1,
        resource: {
          buffer: device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM,
          }),
        },
      },
      { binding: 2, resource: texture3d.createView() }, // Doesn't need {dimension: '3d'} if texture is already '3d'
    ],
  });
  console.log("BindGroup 3D successful! GOOD!");
} catch (e) {
  console.log("BindGroup 3D failed: ", e.message);
}
